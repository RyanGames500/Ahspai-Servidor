// Espejo en JavaScript de la lógica de orb_internal.gml / orb_api.gml (misma estructura, mismos nombres).
// Sirve para probar el cliente contra el servidor real sin GameMaker.
const WebSocket = require("ws");

class OrbMirror {
  constructor(port, game = "Prueba") {
    this.port = port; this.game = game;
    // __orb_init
    Object.assign(this, {
      socket: null, status: "off", my_id: -1, room: "", want_room: "", want_room_max: 0, want_room_cb: undefined,
      host: -1, slot: -1, ping: -1, my_data: {}, in_queue: false, queue_count: 0, queue_size: 0,
      players: {}, world: {}, handlers: {}, pending: {}, next_request: 1, next_entity: 1,
      last_state_json: "", entity_cache: {}, manual_off: false, fatal: false,
      orb_state: {}, localEntities: [], // instancias de obj_orb_entity (simuladas)
      sent: [],                          // mensajes mandados (para medir)
    });
  }
  // ---- orb_api ----
  connect() { this._open(); }
  disconnect() { this.manual_off = true; this.want_room = ""; this._lost("manual"); }
  on(name, fn) { (this.handlers[name] ||= []).push(fn); }
  join(room, max = 0, cb) {
    this.want_room_max = max;
    if (this.status !== "connected") { this.want_room = room; this.want_room_cb = cb; return; }
    this._request("join", { rm: room, mx: max }, cb);
  }
  leave(cb) { this.want_room = ""; this._request("leave", {}, cb); }
  matchmake(size, mode = "default", cb) { this.want_room = ""; this._request("mm", { size, mode }, cb); }
  sendRoom(n, d = {}) { return this._send({ t: "ev", to: "room", n, d }); }
  dbGet(c, k, cb) { this._request("db_get", { c, k }, cb); }
  dbSet(c, k, v, cb) { this._request("db_set", { c, k, v }, cb); }
  worldCreate(p, cb) { this._request("world_create", { p }, cb); }
  worldEdit(id, p) { this._send({ t: "world_edit", p, id }); }
  // ---- __orb_* ----
  _open() {
    this.status = "connecting";
    this.socket = new WebSocket(`ws://127.0.0.1:${this.port}`);
    this.socket.on("open", () => this._send({ t: "hello", proto: 1, game: this.game, key: "" }));
    this.socket.on("message", (raw) => { let m; try { m = JSON.parse(raw); } catch { return; } if (m && typeof m.t === "string") this._handle(m); });
    this.socket.on("close", () => { if (!this._closingByMe) this._lost("server_closed"); });
  }
  _lost(reason) {
    const was = this.status === "connected";
    if (this.socket) { this._closingByMe = true; try { this.socket.terminate(); } catch {} this.socket = null; }
    Object.assign(this, { status: "off", my_id: -1, host: -1, slot: -1, ping: -1, room: "", in_queue: false, players: {}, world: {} });
    const p = this.pending; this.pending = {}; for (const k in p) p[k].fn(false, "disconnected");
    if (was) this._dispatch("orb:disconnected", { reason }, -1);
  }
  _send(msg) {
    if (!this.socket || this.socket.readyState !== 1) return false;
    if (this.status !== "connected" && msg.t !== "hello") return false;
    const txt = JSON.stringify(msg); this.sent.push(txt); this.socket.send(txt); return true;
  }
  _request(op, args, fn) {
    if (this.status !== "connected") { fn && fn(false, "not_connected"); return -1; }
    const r = this.next_request++; Object.assign(args, { t: "req", r, op });
    if (fn) this.pending[String(r)] = { fn, time: Date.now() };
    this._send(args); return r;
  }
  _dispatch(name, data, from) { for (const fn of [...(this.handlers[name] || [])]) fn(data, from); }
  _handle(m) {
    switch (m.t) {
      case "welcome":
        Object.assign(this, { status: "connected", my_id: m.id, last_state_json: "", entity_cache: {} });
        this._dispatch("orb:connected", { my_id: m.id }, -1);
        if (this.room === "" && this.want_room !== "") { const cb = this.want_room_cb; this.want_room_cb = undefined; this._request("join", { rm: this.want_room, mx: this.want_room_max }, cb); }
        break;
      case "err": if (m.code === "bad_key" || m.code === "bad_protocol") this.fatal = true; this._dispatch("orb:error", m, -1); break;
      case "pong": this.ping = Date.now() - m.c; break;
      case "res": { const p = this.pending[String(m.r)]; if (p) { delete this.pending[String(m.r)]; p.fn(m.ok === true, m.d); } break; }
      case "room":
        this.players = {}; this.world = {};
        this.room = typeof m.id === "string" ? m.id : ""; this.host = m.host; this.slot = m.slot;
        this.last_state_json = ""; this.entity_cache = {};
        if (this.room !== "") { this.in_queue = false; this.want_room = this.room; } else this.want_room = "";
        for (const p of m.players || []) this._addPlayer(p);
        for (const w of m.world || []) this.world[String(w.id)] = { wid: w.id, p: w.p };
        this._dispatch("orb:room", { name: this.room, host: this.host, slot: this.slot }, -1);
        break;
      case "join": this._addPlayer(m); this._dispatch("orb:player_joined", { player: m.id, slot: m.slot }, -1); break;
      case "leave": delete this.players[String(m.id)]; this._dispatch("orb:player_left", { player: m.id }, -1); break;
      case "host": this.host = m.id; break;
      case "queue": this.in_queue = true; this.queue_count = m.count; this.queue_size = m.size; break;
      case "st": {
        const pl = this.players[String(m.id)]; if (!pl) break;
        if (m.s && typeof m.s === "object") pl.s = m.s;
        if (m.e && typeof m.e === "object") for (const k of Object.keys(m.e)) pl.e[k] = m.e[k];
        if (Array.isArray(m.d)) for (const k of m.d) delete pl.e[String(k)];
        break;
      }
      case "ev": if (m.n === "orb:kicked") this.want_room = ""; this._dispatch(m.n, m.d, m.from); break;
      case "world": { const k = String(m.id); if (this.world[k]) this.world[k].p = m.p; else this.world[k] = { wid: m.id, p: m.p }; break; }
      case "world_del": delete this.world[String(m.id)]; break;
    }
  }
  _addPlayer(info) {
    if (info.id === this.my_id) return;
    this.players[String(info.id)] = { pid: info.id, slot: info.slot, s: info.s || {}, pd: info.pd || {}, e: info.e || {} };
  }
  // __orb_send_state (se llama cada ORB_SEND_EVERY frames)
  sendState() {
    if (this.room === "") return;
    const msg = { t: "st" }; let any = false;
    const sj = JSON.stringify(this.orb_state);
    if (sj !== this.last_state_json) { this.last_state_json = sj; msg.s = this.orb_state; any = true; }
    const changed = {}, seen = {}; let has = false;
    for (const ent of this.localEntities) {
      if (ent.orb_entity_id === undefined) ent.orb_entity_id = this.next_entity++;
      const data = { kind: ent.kind, props: ent.orb_props || {} };
      for (const v of ent.orb_sync || ["x", "y"]) if (v in ent) data[v] = ent[v];
      const key = String(ent.orb_entity_id), json = JSON.stringify(data);
      seen[key] = true;
      if (this.entity_cache[key] !== json) { this.entity_cache[key] = json; changed[key] = data; has = true; }
    }
    if (has) { msg.e = changed; any = true; }
    const dead = Object.keys(this.entity_cache).filter((k) => !seen[k]);
    for (const k of dead) delete this.entity_cache[k];
    if (dead.length) { msg.d = dead; any = true; }
    if (any) this._send(msg);
  }
}
module.exports = OrbMirror;
