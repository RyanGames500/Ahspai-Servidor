// Pruebas automáticas del servidor Órbita.  Uso: npm test   (arranca su propio servidor en el puerto 3997)
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const WebSocket = require("ws");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 3997;
let pass = 0, fail = 0;
const ok = (c, msg) => { c ? pass++ : fail++; console.log((c ? "  OK   " : "  FALLA") + "  " + msg); };

function client(game = "Prueba", key = "") {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    const c = { ws, log: [], id: -1, r: 1, pending: {} };
    ws.on("message", (raw) => {
      const m = JSON.parse(raw);
      c.log.push(m);
      if (m.t === "welcome") { c.id = m.id; resolve(c); }
      if (m.t === "res" && c.pending[m.r]) { c.pending[m.r](m); delete c.pending[m.r]; }
      if (m.t === "err") { c.error = m; resolve(c); }
    });
    ws.on("open", () => ws.send(JSON.stringify({ t: "hello", proto: 1, game, key })));
    c.send = (o) => ws.send(JSON.stringify(o));
    c.req = (op, args = {}) => new Promise((res) => { const r = c.r++; c.pending[r] = res; c.send({ t: "req", r, op, ...args }); });
    c.last = (t, f = () => true) => [...c.log].reverse().find((m) => m.t === t && f(m));
    c.all = (t) => c.log.filter((m) => m.t === t);
    c.clear = () => (c.log = []);
  });
}

(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "orbita-"));
  const env = { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, GAME_KEY: "" };
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], { env, stdio: "ignore" });
  await sleep(700);
  try {
    console.log("\nConexión");
    const a = await client(), b = await client(), c = await client();
    ok(a.id > 0 && b.id > 0 && a.id !== b.id, "welcome con id único");
    const bad = await new Promise((res) => {
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
      ws.on("open", () => ws.send(JSON.stringify({ t: "hello", proto: 99, game: "x" })));
      ws.on("message", (raw) => res(JSON.parse(raw)));
    });
    ok(bad.t === "err" && bad.code === "bad_protocol", "protocolo incompatible se rechaza con mensaje claro");
    a.send({ t: "ping", c: 1234 }); await sleep(60);
    ok(a.last("pong")?.c === 1234, "ping/pong");

    console.log("\nSalas");
    let r = await a.req("join", { rm: "lobby", mx: 3 });
    ok(r.ok && a.last("room")?.id === "lobby" && a.last("room").host === a.id && a.last("room").slot === 0, "entrar a sala: primero es host y puesto 0");
    a.send({ t: "st", s: { x: 10, y: 20, nombre: "Ana" }, e: { 1: { x: 5, kind: "obj_bala" } } }); await sleep(60);
    r = await b.req("join", { rm: "lobby" });
    const snap = b.last("room");
    ok(r.ok && snap.slot === 1 && snap.host === a.id, "segundo jugador: puesto 1, ve al host");
    ok(snap.players.length === 1 && snap.players[0].s.nombre === "Ana" && snap.players[0].e["1"].kind === "obj_bala", "quien entra tarde recibe estado y entidades de los demás");
    ok(a.last("join")?.id === b.id && a.last("join").slot === 1, "los de la sala reciben 'join'");
    await c.req("join", { rm: "lobby" });
    const d = await client();
    r = await d.req("join", { rm: "lobby" });
    ok(!r.ok && r.d === "room_full", "sala llena se rechaza (max 3)");

    console.log("\nEstado y entidades");
    a.send({ t: "st", s: { x: 50, y: 20, nombre: "Ana" } }); await sleep(60);
    ok(b.last("st")?.s?.x === 50 && !a.last("st", (m) => m.id === a.id), "estado llega a los demás y no rebota a uno mismo");
    a.send({ t: "st", e: { 2: { x: 1, kind: "obj_bala" } }, d: [1] }); await sleep(60);
    const st = b.last("st");
    ok(st.e?.["2"]?.x === 1 && st.d?.[0] === "1", "entidad nueva y entidad destruida");
    const e2 = await client(); await e2.req("join", { rm: "lobby2" });
    a.clear();
    await a.req("join", { rm: "lobby2" });
    ok(b.last("leave")?.id === a.id && b.last("host")?.id === b.id, "al irse el host, la sala recibe 'leave' y nuevo host");
    ok(a.last("room").players[0].e && Object.keys(a.last("room").players[0].e).length === 0, "al cambiar de sala se limpian las entidades");
    await a.req("join", { rm: "lobby" });
    ok(a.last("room").slot === 0, "puesto libre se reutiliza (equipos estables)");

    console.log("\nEventos");
    b.clear(); c.clear(); a.clear();
    a.send({ t: "ev", to: b.id, n: "saludo", d: { txt: "hola" } });
    a.send({ t: "ev", to: "room", n: "grito", d: { v: 1 } });
    a.send({ t: "ev", to: "all", n: "todos", d: { v: 2 } }); await sleep(80);
    ok(b.last("ev", (m) => m.n === "saludo")?.d.txt === "hola" && b.last("ev", (m) => m.n === "saludo").from === a.id && !c.last("ev", (m) => m.n === "saludo"), "evento a un jugador");
    ok(b.last("ev", (m) => m.n === "grito") && c.last("ev", (m) => m.n === "grito") && !a.last("ev", (m) => m.n === "grito"), "evento a la sala (sin uno mismo)");
    ok(a.last("ev", (m) => m.n === "todos") && b.last("ev", (m) => m.n === "todos"), "evento a todos (con uno mismo)");
    a.send({ t: "sev", n: "tirar_dado", d: {} }); await sleep(80);
    const dado = b.last("ev", (m) => m.n === "resultado_dado");
    ok(dado && dado.from === -1 && dado.d.valor >= 1 && dado.d.valor <= 6, "evento al servidor -> scripts.js responde a la sala (from = -1)");
    r = await a.req("server", { n: "sumar", d: { a: 2, b: 3 } });
    ok(r.ok && r.d === 5, "petición al servidor con respuesta (scripts.js onRequest)");
    r = await a.req("server", { n: "no_existe", d: {} });
    ok(!r.ok && r.d === "pregunta_desconocida", "petición al servidor con error devuelve ok=false");

    console.log("\nBase de datos");
    r = await a.req("db_set", { c: "perfiles", k: "ana", v: { nivel: 1, oro: 5 } }); ok(r.ok, "guardar");
    r = await a.req("db_merge", { c: "perfiles", k: "ana", v: { oro: 50, gemas: 2 } });
    ok(r.ok && r.d.nivel === 1 && r.d.oro === 50 && r.d.gemas === 2, "mezclar campos");
    r = await b.req("db_get", { c: "perfiles", k: "ana" }); ok(r.ok && r.d.oro === 50, "leer");
    r = await b.req("db_get", { c: "perfiles", k: "nadie" }); ok(!r.ok && r.d === "not_found", "leer lo que no existe -> not_found");
    r = await a.req("db_list", { c: "perfiles" }); ok(r.ok && r.d.includes("ana"), "listar claves de una colección");
    r = await a.req("db_delete", { c: "perfiles", k: "ana" }); r = await a.req("db_get", { c: "perfiles", k: "ana" }); ok(!r.ok, "borrar");
    const otro = await client("OtroJuego");
    await a.req("db_set", { c: "x", k: "y", v: 1 });
    r = await otro.req("db_get", { c: "x", k: "y" }); ok(!r.ok, "cada juego tiene su base de datos separada");

    console.log("\nObjetos del mundo (persistentes)");
    b.clear();
    r = await a.req("world_create", { p: { tipo: "cofre", x: 100 } });
    const wid = r.d;
    ok(r.ok && wid > 0 && b.last("world")?.id === wid, "crear: la sala lo recibe");
    a.send({ t: "world_edit", id: wid, p: { tipo: "cofre", x: 100, abierto: true } }); await sleep(60);
    ok(b.last("world")?.p.abierto === true, "editar");
    const late = await client(); await late.req("join", { rm: "lobby2" }); await late.req("leave");
    r = await a.req("rooms"); ok(r.ok && r.d.some((x) => x.id === "lobby" && x.players === 3 && x.max === 3), "listar salas");
    r = await a.req("players", { rm: "lobby" }); ok(r.ok && r.d.length === 3, "jugadores de una sala");
    r = await a.req("time"); ok(r.ok && Math.abs(r.d - Date.now()) < 5000, "hora del servidor");

    console.log("\nPartida rápida");
    const q1 = await client(), q2 = await client(), q3 = await client();
    await q1.req("mm", { size: 2, mode: "ctf" }); await sleep(50);
    ok(q1.last("queue")?.count === 1 && q1.last("queue").size === 2, "en cola: 1/2");
    await q3.req("mm", { size: 3, mode: "ctf" }); await sleep(50);
    await q2.req("mm", { size: 2, mode: "ctf" }); await sleep(100);
    const rq1 = q1.last("room"), rq2 = q2.last("room");
    ok(rq1?.id && rq1.id === rq2?.id && rq1.id.startsWith("match_ctf_"), "dos jugadores emparejados en la misma sala");
    ok(rq1.slot !== rq2.slot && (rq1.host === q1.id) && q3.last("queue")?.count === 1, "puestos distintos, host el primero, otra cola no se mezcla");
    await q3.req("mm_cancel"); r = await q3.req("players", { rm: rq1.id }); ok(r.ok && !r.d.includes(q3.id), "cancelar búsqueda");

    console.log("\nServidor y seguridad");
    a.clear(); b.clear(); c.clear();
    // b es el host desde que a salió y volvió
    a.send({ t: "kick", id: b.id }); await sleep(80);
    ok(b.last("room") === undefined, "un no-host no puede expulsar");
    b.send({ t: "kick", id: c.id }); await sleep(80);
    ok(c.last("room")?.id === "" && c.last("ev", (m) => m.n === "orb:kicked"), "el host puede expulsar");
    r = await a.req("ai", { msgs: [{ role: "user", content: "hola" }], temp: 0.5 });
    ok(!r.ok && r.d === "ai_disabled", "IA sin clave responde error claro");
    r = await a.req("discord", { ch: "123", msg: "x" });
    ok(!r.ok && r.d === "discord_disabled", "Discord sin token responde error claro");
    const spam = await client();
    for (let i = 0; i < 400; i++) spam.send({ t: "ping", c: i });
    await sleep(300);
    ok(spam.last("err")?.code === "rate_limited" && spam.all("pong").length <= 240, "límite de mensajes por segundo");
    a.ws.send("esto no es json"); a.ws.send(JSON.stringify({ t: "st", s: "no-objeto" })); a.ws.send(JSON.stringify([1, 2]));
    await sleep(60);
    r = await a.req("time"); ok(r.ok, "mensajes basura no rompen nada");
    r = await a.req("operacion_rara"); ok(!r.ok && r.d === "unknown_op", "operación desconocida");

    console.log("\nDesconexión y guardado");
    b.clear();
    a.ws.terminate(); await sleep(150);
    ok(b.last("leave")?.id === a.id, "si alguien se cae, la sala recibe 'leave'");
    await sleep(2300);
    const saved = JSON.parse(fs.readFileSync(path.join(dataDir, "world.json"), "utf8"));
    ok(saved.Prueba.rooms.lobby[wid].abierto === true, "los objetos del mundo se guardan en disco");
  } catch (e) {
    fail++; console.log("  FALLA  excepción:", e);
  }
  srv.kill();
  console.log(`\n${pass} pruebas OK, ${fail} fallas\n`);
  process.exit(fail ? 1 : 0);
})();
