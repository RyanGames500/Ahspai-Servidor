/*
 * ÓRBITA - Servidor multijugador para GameMaker
 * Protocolo propio (WebSocket + JSON). Cliente: carpeta "gamemaker".
 *
 * Uso:  npm install   y luego   npm start
 * Variables de entorno: ver LEEME.md
 */

"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer, WebSocket } = require("ws");

const PROTOCOL = 1;

// ------------------------------------------------------------------
// Configuración
// ------------------------------------------------------------------
const PORT = Number(process.env.PORT) || 3000;
const GAME_KEY = process.env.GAME_KEY || ""; // si se pone, el juego debe tener la misma clave (ORB_GAME_KEY)
const GAME_KEY_MD5 = GAME_KEY ? md5(GAME_KEY) : "";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const MAX_MSG_PER_SEC = Number(process.env.MAX_MSG_PER_SEC) || 240;
const MAX_ROOM_SIZE = Number(process.env.MAX_ROOM_SIZE) || 64;

const AI_PROVIDER = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || (AI_PROVIDER === "anthropic" ? "claude-haiku-5-5" : "");
const AI_API_URL =
  process.env.AI_API_URL ||
  (AI_PROVIDER === "anthropic" ? "https://api.anthropic.com/v1/messages" : "https://api.openai.com/v1/chat/completions");
const AI_MAX_TOKENS = Number(process.env.AI_MAX_TOKENS) || 512;
const AI_MAX_PER_MINUTE = Number(process.env.AI_MAX_PER_MINUTE) || 10;

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || "";
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || ""; // servidor de Discord permitido
const DISCORD_MAX_PER_MINUTE = Number(process.env.DISCORD_MAX_PER_MINUTE) || 5;

function md5(s) {
  return crypto.createHash("md5").update(s, "utf8").digest("hex");
}
function log(...a) {
  console.log(new Date().toISOString(), ...a);
}
function safeJSON(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v, max = 128) => (typeof v === "string" || typeof v === "number" ? String(v).slice(0, max) : "");

// ------------------------------------------------------------------
// Datos en disco: base de datos y objetos del mundo (persistentes)
// ------------------------------------------------------------------
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, "db.json");
const WORLD_FILE = path.join(DATA_DIR, "world.json");
const db = safeJSON(fs.existsSync(DB_FILE) ? fs.readFileSync(DB_FILE, "utf8") : "{}", {}); // game -> col -> key -> value
const world = safeJSON(fs.existsSync(WORLD_FILE) ? fs.readFileSync(WORLD_FILE, "utf8") : "{}", {}); // game -> {next, rooms: {room: {id: props}}}
const dirty = { db: false, world: false };

function flush() {
  for (const [k, file, obj] of [["db", DB_FILE, db], ["world", WORLD_FILE, world]]) {
    if (!dirty[k]) continue;
    dirty[k] = false;
    try {
      fs.writeFileSync(file + ".tmp", JSON.stringify(obj));
      fs.renameSync(file + ".tmp", file);
    } catch (e) {
      log("No se pudo guardar", file, e.message);
    }
  }
}
setInterval(flush, 2000);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { flush(); process.exit(0); });

const gameDb = (g) => (db[g] ||= {});
const gameWorld = (g) => (world[g] ||= { next: 1, rooms: {} });

// ------------------------------------------------------------------
// Estado en memoria
// ------------------------------------------------------------------
let nextId = 1;
const clients = new Map(); // id -> client
const games = new Map(); // gameId -> { rooms: Map, queues: Map, matchCounter }

function getGame(id) {
  if (!games.has(id)) games.set(id, { id, rooms: new Map(), queues: new Map(), matchCounter: 1 });
  return games.get(id);
}

function send(c, obj) {
  if (c && c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(obj));
}
function sendRoom(game, roomId, obj, exceptId) {
  const room = game.rooms.get(roomId);
  if (!room) return;
  const txt = JSON.stringify(obj);
  for (const id of room.members) {
    if (id === exceptId) continue;
    const c = clients.get(id);
    if (c && c.ws.readyState === WebSocket.OPEN) c.ws.send(txt);
  }
}
function playerInfo(c) {
  return { id: c.id, slot: c.slot, s: c.state, e: c.entities, pd: c.pdata };
}

// ------------------------------------------------------------------
// Salas
// ------------------------------------------------------------------
function hostOf(room) {
  return room && room.members.length ? room.members[0] : -1;
}

function leaveRoom(c, notifySelf = true) {
  leaveQueue(c);
  if (!c.roomId) return;
  const game = c.game;
  const room = game.rooms.get(c.roomId);
  const oldRoom = c.roomId;
  c.roomId = "";
  c.slot = -1;
  c.entities = {};
  if (room) {
    const wasHost = hostOf(room) === c.id;
    room.members = room.members.filter((id) => id !== c.id);
    if (room.members.length === 0) game.rooms.delete(room.id);
    else {
      sendRoom(game, room.id, { t: "leave", id: c.id });
      if (wasHost) sendRoom(game, room.id, { t: "host", id: hostOf(room) });
    }
  }
  if (notifySelf) send(c, { t: "room", id: "", host: -1, slot: -1, players: [], world: [] });
  script("onLeaveRoom", c, oldRoom);
}

function joinRoom(c, roomId, max = 0) {
  const game = c.game;
  let room = game.rooms.get(roomId);
  if (room && room.members.includes(c.id)) return { ok: true };
  if (room && room.max > 0 && room.members.length >= room.max) return { ok: false, error: "room_full" };
  if (room && room.members.length >= MAX_ROOM_SIZE) return { ok: false, error: "room_full" };

  leaveRoom(c, false);
  if (!room) {
    room = { id: roomId, members: [], max: Math.max(0, Math.min(MAX_ROOM_SIZE, Number(max) || 0)) };
    game.rooms.set(roomId, room);
  }
  // Puesto fijo: el número más chico libre (sirve para equipos: slot % 2)
  const used = new Set(room.members.map((id) => clients.get(id)?.slot));
  let slot = 0;
  while (used.has(slot)) slot++;

  room.members.push(c.id);
  c.roomId = roomId;
  c.slot = slot;
  c.entities = {};

  const others = room.members.filter((id) => id !== c.id).map((id) => clients.get(id)).filter(Boolean);
  const objs = gameWorld(game.id).rooms[roomId] || {};
  send(c, {
    t: "room",
    id: roomId,
    host: hostOf(room),
    slot,
    players: others.map(playerInfo),
    world: Object.entries(objs).map(([id, p]) => ({ id: Number(id), p })),
  });
  sendRoom(game, roomId, { t: "join", ...playerInfo(c) }, c.id);
  log(`[${game.id}] ${c.id} entró a "${roomId}" (${room.members.length}${room.max ? "/" + room.max : ""}) puesto ${slot}`);
  script("onJoinRoom", c, roomId);
  return { ok: true };
}

// Partida rápida: cola por (modo, tamaño)
function leaveQueue(c) {
  if (!c.queue) return;
  const q = c.game.queues.get(c.queue);
  c.queue = null;
  if (!q) return;
  q.members = q.members.filter((id) => id !== c.id);
  for (const id of q.members) send(clients.get(id), { t: "queue", size: q.size, count: q.members.length });
}

function enqueue(c, size, mode) {
  size = Math.max(1, Math.min(MAX_ROOM_SIZE, Math.floor(Number(size)) || 2));
  mode = str(mode, 32) || "default";
  const key = `${mode}:${size}`;
  const game = c.game;
  leaveRoom(c, true);
  if (!game.queues.has(key)) game.queues.set(key, { size, mode, members: [] });
  const q = game.queues.get(key);
  q.members.push(c.id);
  c.queue = key;
  for (const id of q.members) send(clients.get(id), { t: "queue", size, count: q.members.length });

  while (q.members.length >= size) {
    const picked = q.members.splice(0, size);
    const roomId = `match_${mode}_${game.matchCounter++}`;
    for (const id of picked) {
      const p = clients.get(id);
      if (!p) continue;
      p.queue = null;
      joinRoom(p, roomId, size);
    }
    log(`[${game.id}] Partida encontrada (${mode}, ${size}): ${picked.join(", ")} -> ${roomId}`);
  }
}

// ------------------------------------------------------------------
// Scripts del servidor (scripts.js)
// ------------------------------------------------------------------
let scripts = {};
try {
  scripts = require("./scripts.js");
  log("scripts.js cargado");
} catch (e) {
  if (e.code !== "MODULE_NOT_FOUND") log("Error cargando scripts.js:", e.message);
}

const api = {
  log,
  player: (id) => clients.get(Number(id)),
  playersInRoom(gameId, roomId) {
    const room = getGame(gameId).rooms.get(String(roomId));
    return room ? room.members.map((id) => clients.get(id)).filter(Boolean) : [];
  },
  hostOf: (gameId, roomId) => hostOf(getGame(gameId).rooms.get(String(roomId))),
  sendTo(playerId, name, data = {}) {
    send(clients.get(Number(playerId)), { t: "ev", from: -1, n: String(name), d: data });
  },
  sendToRoom(gameId, roomId, name, data = {}, exceptId) {
    sendRoom(getGame(gameId), String(roomId), { t: "ev", from: -1, n: String(name), d: data }, exceptId);
  },
  // Datos del jugador que pone el servidor (vida real, monedas...). Los ve toda la sala.
  setPlayerData(playerId, data) {
    const c = clients.get(Number(playerId));
    if (!c || !isObj(data)) return;
    c.pdata = { ...c.pdata, ...data };
    if (c.roomId) sendRoom(c.game, c.roomId, { t: "pd", id: c.id, d: c.pdata });
    else send(c, { t: "pd", id: c.id, d: c.pdata });
  },
  moveToRoom(playerId, roomId, max = 0) {
    const c = clients.get(Number(playerId));
    return c ? joinRoom(c, String(roomId), max) : { ok: false };
  },
  db: {
    get: (g, col, key) => (gameDb(g)[col] || {})[key],
    set(g, col, key, value) {
      (gameDb(g)[col] ||= {})[key] = value;
      dirty.db = true;
    },
    delete(g, col, key) {
      if (gameDb(g)[col]) delete gameDb(g)[col][key];
      dirty.db = true;
    },
  },
};

function script(name, ...args) {
  if (typeof scripts[name] !== "function") return undefined;
  try {
    return scripts[name](api, ...args);
  } catch (e) {
    log(`Error en scripts.js (${name}):`, e.message);
  }
}

// ------------------------------------------------------------------
// IA
// ------------------------------------------------------------------
function allowRate(c, key, perMinute) {
  const now = Date.now();
  const arr = (c.rate[key] = (c.rate[key] || []).filter((t) => now - t < 60000));
  if (arr.length >= perMinute) return false;
  arr.push(now);
  return true;
}

async function callAI(messages, temperature) {
  if (!AI_API_KEY) throw new Error("ai_disabled");
  if (!AI_MODEL) throw new Error("ai_model_missing");
  messages = (Array.isArray(messages) ? messages : [])
    .filter((m) => isObj(m) && typeof m.content === "string")
    .map((m) => ({ role: ["system", "assistant"].includes(m.role) ? m.role : "user", content: m.content.slice(0, 8000) }))
    .slice(-40);
  if (!messages.some((m) => m.role !== "system")) throw new Error("no_messages");
  const temp = Math.max(0, Math.min(1, Number(temperature) || 0.7));

  if (AI_PROVIDER === "anthropic") {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const res = await fetch(AI_API_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": AI_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: AI_MODEL, max_tokens: AI_MAX_TOKENS, temperature: temp,
        messages: messages.filter((m) => m.role !== "system"), ...(system ? { system } : {}),
      }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error?.message || `http_${res.status}`);
    return (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  }
  const res = await fetch(AI_API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${AI_API_KEY}` },
    body: JSON.stringify({ model: AI_MODEL, max_tokens: AI_MAX_TOKENS, temperature: temp, messages }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j?.error?.message || `http_${res.status}`);
  return j.choices?.[0]?.message?.content || "";
}

// ------------------------------------------------------------------
// Discord
// ------------------------------------------------------------------
const channelGuild = new Map();
async function discordSend(channel, text) {
  if (!DISCORD_BOT_TOKEN) throw new Error("discord_disabled");
  channel = str(channel, 32);
  if (!/^\d+$/.test(channel)) throw new Error("bad_channel");
  if (!channelGuild.has(channel)) {
    const r = await fetch(`https://discord.com/api/v10/channels/${channel}`, { headers: { authorization: `Bot ${DISCORD_BOT_TOKEN}` } });
    const j = await r.json();
    channelGuild.set(channel, r.ok ? String(j.guild_id || "") : "");
  }
  if (!DISCORD_GUILD_ID || channelGuild.get(channel) !== DISCORD_GUILD_ID) throw new Error("channel_not_allowed");
  const r = await fetch(`https://discord.com/api/v10/channels/${channel}/messages`, {
    method: "POST",
    headers: { authorization: `Bot ${DISCORD_BOT_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ content: String(text).slice(0, 2000), allowed_mentions: { parse: [] } }),
  });
  if (!r.ok) throw new Error(`http_${r.status}`);
}

function startDiscord() {
  if (!DISCORD_BOT_TOKEN) return;
  let seq = null, hb = null;
  const gw = new WebSocket("wss://gateway.discord.gg/?v=10&encoding=json");
  gw.on("message", (raw) => {
    const p = safeJSON(raw.toString(), null);
    if (!p) return;
    if (p.s != null) seq = p.s;
    if (p.op === 10) {
      const every = p.d.heartbeat_interval;
      setTimeout(() => gw.readyState === 1 && gw.send(JSON.stringify({ op: 1, d: seq })), Math.random() * every);
      hb = setInterval(() => gw.readyState === 1 && gw.send(JSON.stringify({ op: 1, d: seq })), every);
      gw.send(JSON.stringify({ op: 2, d: { token: DISCORD_BOT_TOKEN, intents: (1 << 0) | (1 << 9) | (1 << 15), properties: { os: "linux", browser: "orbita", device: "orbita" } } }));
    } else if (p.op === 1) gw.send(JSON.stringify({ op: 1, d: seq }));
    else if (p.op === 7 || p.op === 9) gw.close();
    else if (p.op === 0 && p.t === "READY") log(`Discord conectado como ${p.d.user?.username}`);
    else if (p.op === 0 && p.t === "MESSAGE_CREATE") {
      const m = p.d;
      if (m.author?.bot || String(m.guild_id) !== DISCORD_GUILD_ID) return;
      const msg = { t: "discord", ch: String(m.channel_id), user: m.author.global_name || m.author.username, user_id: String(m.author.id), msg: m.content || "" };
      for (const c of clients.values()) if (c.ready) send(c, msg);
    }
  });
  gw.on("close", (code) => {
    clearInterval(hb);
    if (code === 4004) return log("Discord: token inválido");
    setTimeout(startDiscord, 5000);
  });
  gw.on("error", () => {});
}

// ------------------------------------------------------------------
// Peticiones con respuesta (orb_db_get, orb_ai, ...)
// ------------------------------------------------------------------
async function handleRequest(c, m) {
  const g = c.gameId;
  const col = str(m.c, 64), key = str(m.k, 128);
  switch (m.op) {
    case "join": {
      const roomId = str(m.rm, 64);
      if (!roomId) return { ok: false, d: "bad_room" };
      const r = joinRoom(c, roomId, m.mx);
      return { ok: r.ok, d: r.ok ? roomId : r.error };
    }
    case "leave":
      leaveRoom(c, true);
      return { ok: true, d: "" };
    case "mm":
      enqueue(c, m.size, m.mode);
      return { ok: true, d: "" };
    case "mm_cancel":
      leaveQueue(c);
      return { ok: true, d: "" };
    case "rooms": {
      const list = [...c.game.rooms.values()].map((r) => ({ id: r.id, players: r.members.length, max: r.max }));
      return { ok: true, d: list };
    }
    case "players": {
      const r = c.game.rooms.get(str(m.rm, 64));
      return r ? { ok: true, d: [...r.members] } : { ok: false, d: "no_room" };
    }
    case "time":
      return { ok: true, d: Date.now() };

    case "db_get": {
      const colObj = gameDb(g)[col];
      if (!col || !colObj || !Object.prototype.hasOwnProperty.call(colObj, key)) return { ok: false, d: "not_found" };
      return { ok: true, d: colObj[key] };
    }
    case "db_set":
      if (!col || m.v === undefined) return { ok: false, d: "bad_args" };
      (gameDb(g)[col] ||= {})[key] = m.v;
      dirty.db = true;
      return { ok: true, d: "" };
    case "db_merge": {
      if (!col || !isObj(m.v)) return { ok: false, d: "bad_args" };
      const colObj = (gameDb(g)[col] ||= {});
      colObj[key] = { ...(isObj(colObj[key]) ? colObj[key] : {}), ...m.v };
      dirty.db = true;
      return { ok: true, d: colObj[key] };
    }
    case "db_delete":
      if (gameDb(g)[col]) {
        delete gameDb(g)[col][key];
        if (!Object.keys(gameDb(g)[col]).length) delete gameDb(g)[col];
        dirty.db = true;
      }
      return { ok: true, d: "" };
    case "db_list": {
      if (col) return { ok: true, d: Object.keys(gameDb(g)[col] || {}) };
      return { ok: true, d: Object.keys(gameDb(g)) };
    }

    case "world_create": {
      const roomId = str(m.rm, 64) || c.roomId;
      if (!roomId) return { ok: false, d: "no_room" };
      if (!isObj(m.p)) return { ok: false, d: "bad_args" };
      const w = gameWorld(g);
      const id = w.next++;
      (w.rooms[roomId] ||= {})[id] = m.p;
      dirty.world = true;
      sendRoom(c.game, roomId, { t: "world", id, p: m.p });
      return { ok: true, d: id };
    }

    case "ai": {
      if (!allowRate(c, "ai", AI_MAX_PER_MINUTE)) return { ok: false, d: "rate_limited" };
      try {
        return { ok: true, d: await callAI(m.msgs, m.temp) };
      } catch (e) {
        return { ok: false, d: e.message };
      }
    }
    case "discord": {
      if (!allowRate(c, "discord", DISCORD_MAX_PER_MINUTE)) return { ok: false, d: "rate_limited" };
      try {
        await discordSend(m.ch, m.msg);
        return { ok: true, d: "" };
      } catch (e) {
        return { ok: false, d: e.message };
      }
    }
    case "server": {
      // Petición a scripts.js que espera respuesta: orb_request_server("nombre", datos, callback)
      if (typeof scripts.onRequest !== "function") return { ok: false, d: "no_handler" };
      try {
        const r = await scripts.onRequest(api, c, str(m.n, 64), m.d);
        return { ok: true, d: r === undefined ? "" : r };
      } catch (e) {
        return { ok: false, d: String(e.message || e) };
      }
    }
  }
  return { ok: false, d: "unknown_op" };
}

// ------------------------------------------------------------------
// Mensajes
// ------------------------------------------------------------------
function findWorldRoom(g, id) {
  const w = gameWorld(g);
  for (const [roomId, objs] of Object.entries(w.rooms)) if (objs[id] !== undefined) return roomId;
  return null;
}

function onMessage(c, raw) {
  // Límite de mensajes por segundo (protege al servidor de spam)
  const now = Date.now();
  if (now - c.rateWindow >= 1000) { c.rateWindow = now; c.rateCount = 0; }
  if (++c.rateCount > MAX_MSG_PER_SEC) {
    if (c.rateCount === MAX_MSG_PER_SEC + 1) send(c, { t: "err", code: "rate_limited", msg: "Demasiados mensajes por segundo" });
    return;
  }

  const m = safeJSON(raw.toString("utf8").replace(/\0+$/, ""), null);
  if (!isObj(m) || typeof m.t !== "string") return;

  if (m.t === "hello") {
    if (c.ready) return;
    if (Number(m.proto) !== PROTOCOL) {
      send(c, { t: "err", code: "bad_protocol", msg: `El servidor usa el protocolo ${PROTOCOL}; actualiza Órbita en el juego` });
      return c.ws.close();
    }
    if (GAME_KEY_MD5 && m.key !== GAME_KEY_MD5) {
      send(c, { t: "err", code: "bad_key", msg: "La clave del juego (ORB_GAME_KEY) no coincide con la del servidor" });
      return c.ws.close();
    }
    c.ready = true;
    c.gameId = str(m.game, 64) || "default";
    c.game = getGame(c.gameId);
    send(c, { t: "welcome", id: c.id, time: Date.now(), proto: PROTOCOL });
    log(`[${c.gameId}] ${c.id} conectado`);
    script("onConnect", c);
    return;
  }
  if (!c.ready) return;

  switch (m.t) {
    case "ping":
      c.lastPing = now;
      send(c, { t: "pong", c: m.c });
      break;

    case "st": {
      // Estado del jugador y de sus entidades (solo lo que cambió)
      if (!c.roomId) break;
      const out = { t: "st", id: c.id };
      let any = false;
      if (isObj(m.s)) { c.state = m.s; out.s = m.s; any = true; }
      if (isObj(m.e)) {
        for (const [k, v] of Object.entries(m.e)) if (isObj(v)) c.entities[k] = v;
        out.e = m.e; any = true;
      }
      if (Array.isArray(m.d) && m.d.length) {
        for (const k of m.d) delete c.entities[String(k)];
        out.d = m.d.map(String); any = true;
      }
      if (any) sendRoom(c.game, c.roomId, out, c.id);
      break;
    }

    case "ev": {
      const name = str(m.n, 64);
      if (!name) break;
      const msg = { t: "ev", from: c.id, n: name, d: m.d === undefined ? {} : m.d };
      if (m.to === "room") { if (c.roomId) sendRoom(c.game, c.roomId, msg, c.id); }
      else if (m.to === "all") { if (c.roomId) sendRoom(c.game, c.roomId, msg); else send(c, msg); }
      else {
        const target = clients.get(Number(m.to));
        if (target && target.gameId === c.gameId) send(target, msg);
      }
      break;
    }

    case "sev":
      script("onEvent", c, str(m.n, 64), m.d === undefined ? {} : m.d);
      break;

    case "world_edit": {
      const id = String(Number(m.id));
      const roomId = findWorldRoom(c.gameId, id);
      if (!roomId || !isObj(m.p)) break;
      gameWorld(c.gameId).rooms[roomId][id] = m.p;
      dirty.world = true;
      sendRoom(c.game, roomId, { t: "world", id: Number(id), p: m.p });
      break;
    }
    case "world_destroy": {
      const id = String(Number(m.id));
      const roomId = findWorldRoom(c.gameId, id);
      if (!roomId) break;
      const w = gameWorld(c.gameId);
      delete w.rooms[roomId][id];
      if (!Object.keys(w.rooms[roomId]).length) delete w.rooms[roomId];
      dirty.world = true;
      sendRoom(c.game, roomId, { t: "world_del", id: Number(id) });
      break;
    }

    case "kick": {
      const room = c.game.rooms.get(c.roomId);
      const victim = clients.get(Number(m.id));
      if (room && hostOf(room) === c.id && victim && victim !== c && victim.roomId === c.roomId) {
        leaveRoom(victim, true);
        send(victim, { t: "ev", from: -1, n: "orb:kicked", d: { by: c.id } });
      }
      break;
    }

    case "req": {
      const r = m.r;
      handleRequest(c, m)
        .then((res) => send(c, { t: "res", r, ok: !!res.ok, d: res.d }))
        .catch((e) => send(c, { t: "res", r, ok: false, d: String(e.message || e) }));
      break;
    }

    case "bye":
      c.ws.close();
      break;
  }
}

// ------------------------------------------------------------------
// Servidor HTTP + WebSocket
// ------------------------------------------------------------------
const httpServer = http.createServer((req, res) => {
  const perGame = {};
  for (const c of clients.values()) if (c.ready) perGame[c.gameId] = (perGame[c.gameId] || 0) + 1;
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ server: "Orbita", protocol: PROTOCOL, players: clients.size, games: perGame }));
});

const wss = new WebSocketServer({ server: httpServer, perMessageDeflate: false, maxPayload: 256 * 1024 });

wss.on("connection", (ws) => {
  const c = {
    id: nextId++, ws, ready: false, gameId: "", game: null,
    roomId: "", slot: -1, queue: null,
    state: {}, entities: {}, pdata: {},
    lastPing: Date.now(), rate: {}, rateWindow: Date.now(), rateCount: 0,
  };
  clients.set(c.id, c);
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));
  ws.on("message", (raw) => {
    try { onMessage(c, raw); } catch (e) { log(`Error con el mensaje de ${c.id}:`, e.message); }
  });
  ws.on("close", () => {
    if (c.ready) {
      leaveRoom(c, false);
      script("onDisconnect", c);
      log(`[${c.gameId}] ${c.id} desconectado`);
    }
    clients.delete(c.id);
  });
  ws.on("error", () => {});
});

// Cierra conexiones muertas (internet caído sin avisar)
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, 10000);

if (typeof scripts.onTick === "function") setInterval(() => script("onTick"), 100);

httpServer.listen(PORT, () => {
  log(`Órbita escuchando en el puerto ${PORT} (protocolo ${PROTOCOL})`);
  log(`IA: ${AI_API_KEY ? `${AI_PROVIDER} / ${AI_MODEL}` : "desactivada"} | Discord: ${DISCORD_BOT_TOKEN ? "activado" : "desactivado"}${GAME_KEY ? " | clave de juego activada" : ""}`);
  startDiscord();
});
