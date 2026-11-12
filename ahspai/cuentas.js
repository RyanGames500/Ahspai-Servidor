// Cuentas de jugadores de Ahspai: usuario + contraseña, guardadas en Neon (Postgres).
// Cada cuenta es una fila con sus datos en JSON: colección, mazos, monedas, estadísticas, amigos...
//
// Dónde se conecta (variables de Render):
//   DATABASE_URL = la línea completa "postgresql://..."  o  solo la contraseña de Neon
//   (también sirve PGPASSWORD). El servidor, el usuario y la base de Neon ya vienen puestos abajo.
// Si no hay nada configurado (por ejemplo, en tu compu para probar), guarda en memoria y avisa.
"use strict";
const crypto = require("crypto");
const CARTAS = require("./cartas.js");
const RAREZAS = require("./rarezas.js");
const motor = require("./motor.js");

const NEON = {
  host: "ep-proud-mud-arbefpj4-pooler.c-4.us-west-2.aws.neon.tech",
  user: "neondb_owner",
  database: "neondb",
};

// Copias iniciales según la rareza.
// Cuentas viejas: recibieron AHAHO + Encuentro con 3/2/1/1 (se quedan así).
// Cuentas nuevas: eligen UN mazo (AHAHO o Encuentro) con 2/2/1/1, y se rellena con
// comunes del otro mazo hasta que alcance para un mazo jugable.
const COPIAS_INICIALES = { comun: 3, legendaria: 2, mitica: 1, divina: 1 };
const COPIAS_REGALO = { comun: 2, legendaria: 2, mitica: 1, divina: 1 };
const EXPANSIONES_INICIALES = ["AHAHO", "ENCUENTRO"];
const PREMIO = { ganada: 50, empatada: 25, perdida: 10 };
const SOBRE = { precio: 100, cartas: 5 };
const PROB_RAREZA = [["comun", 80], ["legendaria", 15], ["mitica", 4], ["divina", 1]]; // de 100
const SOBRES = { todas: null, AHAHO: "AHAHO", ENCUENTRO: "ENCUENTRO" }; // qué expansión trae cada sobre

// Logros: se calculan con los datos de la cuenta
const LOGROS = [
  { id: "primera_victoria", t: "Primera victoria", d: "Gana tu primera partida", ok: (d) => d.stats.ganadas >= 1 },
  { id: "veterano", t: "Veterano", d: "Juega 20 partidas", ok: (d) => d.stats.ganadas + d.stats.perdidas + d.stats.empatadas >= 20 },
  { id: "imparable", t: "Imparable", d: "Gana 5 partidas seguidas", ok: (d) => (d.mejorRacha || 0) >= 5 },
  { id: "campeon", t: "Campeon", d: "Gana 50 partidas", ok: (d) => d.stats.ganadas >= 50 },
  { id: "coleccionista", t: "Coleccionista", d: "Ten 50 cartas distintas", ok: (d) => Object.values(d.coleccion).filter((n) => n > 0).length >= 50 },
  { id: "completo", t: "Album completo", d: "Ten todas las cartas", ok: (d) => Object.keys(CARTAS).every((k) => (d.coleccion[k] || 0) > 0) },
  { id: "arquitecto", t: "Arquitecto", d: "Guarda 3 mazos", ok: (d) => d.mazos.filter(Boolean).length >= 3 },
  { id: "abre_sobres", t: "Abre-sobres", d: "Abre 10 sobres", ok: (d) => (d.sobres || 0) >= 10 },
  { id: "divino", t: "Divino", d: "Consigue una carta divina", ok: (d) => Object.keys(d.coleccion).some((k) => d.coleccion[k] > 0 && RAREZAS[k] === "divina") },
  { id: "rico", t: "Bolsillo lleno", d: "Junta 1000 monedas", ok: (d) => d.monedas >= 1000 },
  { id: "campeon_torneo", t: "Campeon de torneo", d: "Gana un torneo del Contador Ashpai", ok: (d) => (d.torneos_ganados || 0) >= 1 },
];

let pool = null;      // conexión a Neon
let memoria = null;   // si no hay base de datos: Map usuario -> fila
let memCodigos = null; // si no hay base de datos: Map codigo -> fila
let listo = null;     // promesa de inicio

function configPg() {
  const url = process.env.DATABASE_URL || "";
  if (url.includes("://")) {
    // Línea completa: se quita channel_binding (no hace falta y algunas versiones no lo entienden)
    const limpia = url.replace(/[?&]channel_binding=[^&]*/g, "").replace(/\?&/, "?").replace(/\?$/, "");
    return { connectionString: limpia, ssl: { rejectUnauthorized: true } };
  }
  const clave = url || process.env.PGPASSWORD || "";
  if (!clave) return null;
  return {
    host: process.env.PGHOST || NEON.host,
    user: process.env.PGUSER || NEON.user,
    database: process.env.PGDATABASE || NEON.database,
    password: clave,
    port: 5432,
    ssl: { rejectUnauthorized: true },
  };
}

function iniciar() {
  if (listo) return listo;
  listo = (async () => {
    const cfg = configPg();
    if (!cfg) {
      console.log("[Ahspai] Sin base de datos (DATABASE_URL vacía): las cuentas se guardan solo en memoria.");
      memoria = new Map();
      memCodigos = new Map();
      return;
    }
    const { Pool } = require("pg");
    pool = new Pool({ ...cfg, max: 5, idleTimeoutMillis: 30000 });
    pool.on("error", (e) => console.log("[Ahspai] Error de la base de datos:", e.message));
    await pool.query(`CREATE TABLE IF NOT EXISTS ahspai_cuentas (
      usuario TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      hash TEXT NOT NULL,
      sal TEXT NOT NULL,
      token TEXT,
      datos JSONB NOT NULL,
      creado TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    // Versión de cada cuenta: si dos aparatos guardan a la vez, el segundo se reintenta en vez de pisar al primero
    await pool.query("ALTER TABLE ahspai_cuentas ADD COLUMN IF NOT EXISTS ver INTEGER NOT NULL DEFAULT 0");
    // Códigos de regalo (los crea el admin desde el Contador Ashpai)
    await pool.query(`CREATE TABLE IF NOT EXISTS ahspai_codigos (
      codigo TEXT PRIMARY KEY,
      premio JSONB NOT NULL,
      usos_max INTEGER NOT NULL DEFAULT 1,
      usos INTEGER NOT NULL DEFAULT 0,
      canjes JSONB NOT NULL DEFAULT '[]',
      nota TEXT NOT NULL DEFAULT '',
      por TEXT NOT NULL,
      creado TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    console.log("[Ahspai] Base de datos Neon lista.");
  })().catch((e) => {
    console.log("[Ahspai] No se pudo conectar a la base de datos:", e.message);
    listo = null; // se reintenta en el próximo pedido
    throw new Error("base_de_datos_no_disponible");
  });
  return listo;
}

// ---------- Guardar y leer ----------
// En memoria se guardan copias (así se comporta igual que la base de datos)
const copia = (f) => (f ? JSON.parse(JSON.stringify(f)) : null);
async function leer(usuario) {
  await iniciar();
  if (memoria) return copia(memoria.get(usuario));
  const r = await pool.query("SELECT usuario, nombre, hash, sal, token, datos, ver FROM ahspai_cuentas WHERE usuario = $1", [usuario]);
  return r.rows[0] || null;
}
async function leerPorToken(tokenHash) {
  await iniciar();
  if (memoria) { for (const f of memoria.values()) if ((f.datos.tokens || []).includes(tokenHash)) return copia(f); return null; }
  const r = await pool.query("SELECT usuario, nombre, hash, sal, token, datos, ver FROM ahspai_cuentas WHERE datos->'tokens' ? $1", [tokenHash]);
  return r.rows[0] || null;
}
async function insertar(f) {
  await iniciar();
  if (memoria) { if (memoria.has(f.usuario)) return false; memoria.set(f.usuario, copia({ ...f, ver: 0 })); return true; }
  const r = await pool.query(
    "INSERT INTO ahspai_cuentas (usuario, nombre, hash, sal, token, datos) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (usuario) DO NOTHING",
    [f.usuario, f.nombre, f.hash, f.sal, f.token, JSON.stringify(f.datos)]);
  return r.rowCount === 1;
}
// Guarda solo si nadie más guardó esa cuenta desde que la leímos; si no, avisa "conflicto"
async function actualizar(f) {
  await iniciar();
  const ver = f.ver || 0;
  if (memoria) {
    const actual = memoria.get(f.usuario);
    if (!actual || (actual.ver || 0) !== ver) throw new Error("conflicto");
    memoria.set(f.usuario, copia({ ...f, ver: ver + 1 }));
    f.ver = ver + 1;
    return;
  }
  const r = await pool.query("UPDATE ahspai_cuentas SET token = $2, datos = $3, ver = ver + 1 WHERE usuario = $1 AND ver = $4",
    [f.usuario, f.token, JSON.stringify(f.datos), ver]);
  if (r.rowCount !== 1) throw new Error("conflicto");
  f.ver = ver + 1;
}
// Repite la operación (leyendo de nuevo) si hubo conflicto
async function reintentar(fn) {
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (e) { if (e.message !== "conflicto" || i >= 4) throw e; await new Promise((r) => setTimeout(r, 30 + Math.random() * 70)); }
  }
}

// ---------- Contraseñas y tokens ----------
function hashClave(clave, sal) {
  return new Promise((res, rej) => crypto.scrypt(String(clave), sal, 32, (e, k) => (e ? rej(e) : res(k.toString("hex")))));
}
const hashToken = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
// Cada aparato con "Recordarme" tiene su token; se guardan los últimos 5
function nuevoToken(f) {
  const t = crypto.randomBytes(24).toString("hex");
  const h = hashToken(t);
  f.token = h;
  f.datos.tokens = [...(f.datos.tokens || []).filter((x) => x !== h), h].slice(-5);
  return t;
}

// ---------- Datos de una cuenta nueva ----------
function coleccionInicial() {
  const col = {};
  for (const [id, c] of Object.entries(CARTAS)) {
    if (!EXPANSIONES_INICIALES.includes(c.expansion)) continue;
    col[id] = COPIAS_INICIALES[RAREZAS[id] || "comun"] || 1;
  }
  return col;
}
// Colección de regalo de una cuenta nueva: el mazo elegido (2/2/1/1) + comunes del otro
// mazo, de a una copia, solo las que hagan falta para llegar al mínimo de un mazo jugable.
function coleccionRegalo(exp) {
  const col = {};
  for (const [id, c] of Object.entries(CARTAS)) {
    if (c.expansion === exp) col[id] = COPIAS_REGALO[RAREZAS[id] || "comun"] || 1;
  }
  const otras = Object.keys(CARTAS)
    .filter((id) => EXPANSIONES_INICIALES.includes(CARTAS[id].expansion) && CARTAS[id].expansion !== exp && (RAREZAS[id] || "comun") === "comun")
    .sort();
  for (let ronda = 0; ronda < 2; ronda++) {
    for (const id of otras) {
      const falta = motor.validarMazo(mazoInicial(col), CARTAS) || "";
      if (!falta) return col;
      const m = falta.match(/^mazo_(principal|sobrenatural|recursos)_\d+_debe_ser/);
      if (!m || categoria(id) !== m[1] || (col[id] || 0) > ronda) continue;
      col[id] = (col[id] || 0) + 1;
    }
  }
  return col;
}
function datosNuevos() {
  return {
    creado: new Date().toISOString(),
    coleccion: {},
    elegir_mazo: true,                        // al entrar elige AHAHO o ENCUENTRO
    mazos: [null, null, null, null, null],    // 5 espacios para guardar mazos
    activo: -1,                               // qué mazo está activo
    monedas: 0,
    stats: { ganadas: 0, perdidas: 0, empatadas: 0 },
    logros: [],
    foto: "condor_andino",
    amigos: [],
    solicitudes: [],
  };
}

// ---------- Mazos ----------
const categoria = (id) => (CARTAS[id].tipo === "estructura" ? "recursos" : CARTAS[id].sobrenatural ? "sobrenatural" : "principal");

// Revisa un mazo: que tengas las copias, que cada carta vaya en su mazo, y si ya se puede jugar
function revisarMazo(col, m) {
  const cuenta = {};
  for (const lista of ["principal", "sobrenatural", "recursos"]) {
    if (!Array.isArray(m[lista])) return { error: "mazo_invalido" };
    for (const id of m[lista]) {
      if (!CARTAS[id]) return { error: "carta_no_existe" };
      if (categoria(id) !== lista) return { error: "carta_en_mazo_equivocado" };
      cuenta[id] = (cuenta[id] || 0) + 1;
    }
  }
  for (const [id, n] of Object.entries(cuenta)) if (n > (col[id] || 0)) return { error: "no_tienes_tantas_copias" };
  const problema = motor.validarMazo(m, CARTAS);
  return { listo: problema === null, problema };
}

// Arma un mazo jugable con la colección (para que una cuenta nueva pueda jugar de una)
function mazoInicial(col) {
  const m = { nombre: "Mazo inicial", principal: [], sobrenatural: [], recursos: [] };
  const meta = { principal: 40, sobrenatural: 6, recursos: 10 };
  const ids = Object.keys(col).sort();
  for (let ronda = 0; ronda < 4; ronda++) {
    for (const id of ids) {
      const l = categoria(id);
      if (m[l].length >= meta[l]) continue;
      const ya = m[l].filter((x) => x === id).length;
      if (ya >= col[id] || ya > ronda) continue;
      m[l].push(id);
      if (revisarMazo(col, m).error || (motor.validarMazo({ principal: [], sobrenatural: [], recursos: [], ...m }, CARTAS) || "").startsWith("demasiadas")) m[l].pop();
    }
  }
  const r = revisarMazo(col, m);
  m.listo = !!r.listo;
  return m;
}

// El mazo activo listo para la partida (o null si no hay)
function mazoParaJugar(d) {
  const m = d.activo >= 0 ? d.mazos[d.activo] : null;
  if (!m || !revisarMazo(d.coleccion, m).listo) return null;
  return { principal: [...m.principal], sobrenatural: [...m.sobrenatural], recursos: [...m.recursos] };
}

// Lo que el juego necesita mostrar de la cuenta
function perfil(f) {
  const d = f.datos;
  const copias = Object.values(d.coleccion || {}).reduce((a, n) => a + n, 0);
  const mazo = d.activo >= 0 && d.mazos[d.activo] ? d.mazos[d.activo] : null;
  return {
    usuario: f.usuario,
    nombre: f.nombre,
    monedas: d.monedas,
    stats: d.stats,
    foto: d.foto,
    cartas_distintas: Object.keys(d.coleccion || {}).length,
    copias,
    mazos_guardados: d.mazos.filter(Boolean).length,
    mazo_activo: mazo ? mazo.nombre : "",
    amigos: (d.amigos || []).length,
    solicitudes: (d.solicitudes || []).length,
    logros: LOGROS.map((l) => ({ id: l.id, t: l.t, d: l.d, ok: !!l.ok(d) })),
    creado: d.creado || "",
    racha: d.racha || 0,
    sobres: d.sobres || 0,
    elegir_mazo: !!d.elegir_mazo,
    torneos_ganados: d.torneos_ganados || 0,
    es_admin: esAdmin(f.usuario),
  };
}

// ---------- Lo que se usa desde scripts.js ----------
const USUARIO_OK = /^[a-zA-Z0-9_]{3,16}$/;

async function crear(usuario, clave) {
  usuario = String(usuario || "").trim();
  clave = String(clave || "");
  if (!USUARIO_OK.test(usuario)) throw new Error("usuario_invalido");
  if (clave.length < 4 || clave.length > 64) throw new Error("clave_muy_corta");
  const sal = crypto.randomBytes(16).toString("hex");
  const f = { usuario: usuario.toLowerCase(), nombre: usuario, sal, hash: await hashClave(clave, sal), token: null, datos: { ...datosNuevos(), tokens: [] } };
  const token = nuevoToken(f);
  if (!(await insertar(f))) throw new Error("usuario_ya_existe");
  return { token, perfil: perfil(f), mazo: mazoParaJugar(f.datos) };
}

// Cuentas creadas antes de los mazos: se les arma el mazo inicial
function completar(f) {
  const d = f.datos;
  if (!Array.isArray(d.mazos)) d.mazos = [null, null, null, null, null];
  if (!d.elegir_mazo && !d.mazos.some(Boolean)) { d.mazos[0] = mazoInicial(d.coleccion); d.activo = d.mazos[0].listo ? 0 : -1; }
  if (!d.creado) d.creado = new Date().toISOString();
}

async function _entrar(usuario, clave) {
  const f = await leer(String(usuario || "").trim().toLowerCase());
  if (!f) throw new Error("usuario_o_clave_incorrectos");
  const h = await hashClave(clave, f.sal);
  if (!crypto.timingSafeEqual(Buffer.from(h, "hex"), Buffer.from(f.hash, "hex"))) throw new Error("usuario_o_clave_incorrectos");
  completar(f);
  const token = nuevoToken(f);
  await actualizar(f);
  return { token, perfil: perfil(f), mazo: mazoParaJugar(f.datos) };
}

async function _conToken(token) {
  if (!token) throw new Error("sesion_vencida");
  const f = await leerPorToken(hashToken(token));
  if (!f) throw new Error("sesion_vencida");
  const antes = JSON.stringify(f.datos.mazos);
  completar(f);
  if (JSON.stringify(f.datos.mazos) !== antes) await actualizar(f);
  return { token, perfil: perfil(f), mazo: mazoParaJugar(f.datos) };
}

// Cuenta nueva: elige su mazo de regalo (una sola vez)
async function _elegirMazo(usuario, exp) {
  exp = String(exp || "").toUpperCase();
  if (!EXPANSIONES_INICIALES.includes(exp)) throw new Error("mazo_no_existe");
  const f = await leer(usuario);
  if (!f) throw new Error("no_has_entrado");
  const d = f.datos;
  if (!d.elegir_mazo) throw new Error("ya_elegiste_mazo");
  d.coleccion = coleccionRegalo(exp);
  const m = mazoInicial(d.coleccion);
  m.nombre = exp === "AHAHO" ? "Mazo AHAHO" : "Mazo Encuentro";
  d.mazos[0] = m;
  d.activo = m.listo ? 0 : -1;
  delete d.elegir_mazo;
  await actualizar(f);
  return { perfil: perfil(f), mazo: mazoParaJugar(d) };
}

// Cerrar sesión en este aparato: su token deja de servir
async function _salir(usuario, token) {
  const f = await leer(usuario);
  if (!f) return;
  const h = hashToken(token);
  f.datos.tokens = (f.datos.tokens || []).filter((x) => x !== h);
  await actualizar(f);
}

// La colección completa: { idCarta: copias }
async function verColeccion(usuario) {
  const f = await leer(usuario);
  if (!f) throw new Error("cuenta_no_existe");
  return { coleccion: f.datos.coleccion || {} };
}

async function verPerfil(usuario) {
  const f = await leer(usuario);
  if (!f) throw new Error("cuenta_no_existe");
  return perfil(f);
}

// Al terminar una partida: monedas y estadísticas. resultado = "ganada" | "perdida" | "empatada"
async function _premiar(usuario, resultado) {
  const f = await leer(usuario);
  if (!f || !PREMIO[resultado]) return null;
  f.datos.monedas += PREMIO[resultado];
  const k = resultado === "ganada" ? "ganadas" : resultado === "perdida" ? "perdidas" : "empatadas";
  f.datos.stats[k] = (f.datos.stats[k] || 0) + 1;
  f.datos.racha = resultado === "ganada" ? (f.datos.racha || 0) + 1 : 0;
  f.datos.mejorRacha = Math.max(f.datos.mejorRacha || 0, f.datos.racha);
  await actualizar(f);
  return { monedas: PREMIO[resultado], perfil: perfil(f) };
}

async function cargar(usuario) {
  const f = await leer(usuario);
  if (!f) throw new Error("cuenta_no_existe");
  completar(f);
  return f;
}

// ---------- Mazos ----------
async function verMazos(usuario) {
  const f = await cargar(usuario);
  return { mazos: f.datos.mazos, activo: f.datos.activo, coleccion: f.datos.coleccion };
}
async function _guardarMazo(usuario, slot, m) {
  slot = Math.floor(Number(slot));
  if (!(slot >= 0 && slot < 5)) throw new Error("espacio_invalido");
  const f = await cargar(usuario);
  const mazo = {
    nombre: String(m?.nombre || "Mi mazo").trim().slice(0, 20) || "Mi mazo",
    principal: Array.isArray(m?.principal) ? m.principal.map(String).slice(0, 60) : [],
    sobrenatural: Array.isArray(m?.sobrenatural) ? m.sobrenatural.map(String).slice(0, 12) : [],
    recursos: Array.isArray(m?.recursos) ? m.recursos.map(String).slice(0, 12) : [],
  };
  const r = revisarMazo(f.datos.coleccion, mazo);
  if (r.error) throw new Error(r.error);
  mazo.listo = r.listo;
  f.datos.mazos[slot] = mazo;
  if (f.datos.activo === slot && !mazo.listo) f.datos.activo = -1;
  await actualizar(f);
  return { mazos: f.datos.mazos, activo: f.datos.activo, problema: r.problema || "", perfil: perfil(f), mazo: mazoParaJugar(f.datos) };
}
async function _borrarMazo(usuario, slot) {
  const f = await cargar(usuario);
  slot = Math.floor(Number(slot));
  if (!f.datos.mazos[slot]) throw new Error("espacio_vacio");
  f.datos.mazos[slot] = null;
  if (f.datos.activo === slot) f.datos.activo = -1;
  await actualizar(f);
  return { mazos: f.datos.mazos, activo: f.datos.activo, perfil: perfil(f), mazo: mazoParaJugar(f.datos) };
}
async function _activarMazo(usuario, slot) {
  const f = await cargar(usuario);
  slot = Math.floor(Number(slot));
  const m = f.datos.mazos[slot];
  if (!m) throw new Error("espacio_vacio");
  if (!revisarMazo(f.datos.coleccion, m).listo) throw new Error("mazo_incompleto");
  f.datos.activo = slot;
  await actualizar(f);
  return { mazos: f.datos.mazos, activo: f.datos.activo, perfil: perfil(f), mazo: mazoParaJugar(f.datos) };
}

// ---------- Tienda ----------
function sacarCarta(pool) {
  let tiro = crypto.randomInt(100), rareza = "comun";
  for (const [r, p] of PROB_RAREZA) { if (tiro < p) { rareza = r; break; } tiro -= p; }
  // Si en ese sobre no hay de esa rareza, baja a la siguiente más común
  const orden = ["divina", "mitica", "legendaria", "comun"];
  for (let i = orden.indexOf(rareza); i < orden.length; i++) {
    const opciones = pool.filter((id) => (RAREZAS[id] || "comun") === orden[i]);
    if (opciones.length) return opciones[crypto.randomInt(opciones.length)];
  }
  return pool[crypto.randomInt(pool.length)];
}
async function _comprarSobre(usuario, tipo) {
  if (!(tipo in SOBRES)) throw new Error("sobre_invalido");
  const f = await cargar(usuario);
  if (f.datos.monedas < SOBRE.precio) throw new Error("no_te_alcanzan_las_monedas");
  const pool = Object.keys(CARTAS).filter((id) => !SOBRES[tipo] || CARTAS[id].expansion === SOBRES[tipo]);
  const cartas = [], nuevas = [];
  for (let i = 0; i < SOBRE.cartas; i++) {
    const id = sacarCarta(pool);
    if (!(f.datos.coleccion[id] > 0) && !nuevas.includes(id)) nuevas.push(id);
    f.datos.coleccion[id] = (f.datos.coleccion[id] || 0) + 1;
    cartas.push(id);
  }
  f.datos.monedas -= SOBRE.precio;
  f.datos.sobres = (f.datos.sobres || 0) + 1;
  await actualizar(f);
  return { cartas, nuevas, perfil: perfil(f) };
}

// ---------- Perfil ----------
async function _cambiarFoto(usuario, carta) {
  const f = await cargar(usuario);
  const c = CARTAS[carta];
  if (!c || !(f.datos.coleccion[carta] > 0)) throw new Error("no_tienes_esa_carta");
  f.datos.foto = c.archivo;
  await actualizar(f);
  return perfil(f);
}
async function perfilPublico(usuario) {
  const f = await cargar(String(usuario || "").toLowerCase());
  const p = perfil(f);
  return { usuario: p.usuario, nombre: p.nombre, foto: p.foto, stats: p.stats, logros: p.logros, creado: p.creado, amigos: p.amigos };
}

// ---------- Amigos ----------
async function _solicitar(usuario, otro) {
  otro = String(otro || "").trim().toLowerCase();
  if (!otro) throw new Error("escribe_un_usuario");
  if (otro === usuario) throw new Error("no_puedes_agregarte");
  const yo = await cargar(usuario);
  const el = await leer(otro);
  if (!el) throw new Error("ese_usuario_no_existe");
  if ((yo.datos.amigos || []).includes(otro)) throw new Error("ya_son_amigos");
  // Si él ya me había mandado solicitud, quedan amigos de una
  if ((yo.datos.solicitudes || []).includes(otro)) return _responder(usuario, otro, true);
  el.datos.solicitudes = [...new Set([...(el.datos.solicitudes || []), usuario])].slice(-50);
  await actualizar(el);
  return { enviada: true, nombre: el.nombre };
}
async function _responder(usuario, otro, aceptar) {
  otro = String(otro || "").toLowerCase();
  const yo = await cargar(usuario);
  yo.datos.solicitudes = (yo.datos.solicitudes || []).filter((x) => x !== otro);
  if (aceptar) {
    const el = await leer(otro);
    if (el) {
      yo.datos.amigos = [...new Set([...(yo.datos.amigos || []), otro])];
      el.datos.amigos = [...new Set([...(el.datos.amigos || []), usuario])];
      el.datos.solicitudes = (el.datos.solicitudes || []).filter((x) => x !== usuario);
      await actualizar(el);
    }
  }
  await actualizar(yo);
  return { amigos: true, perfil: perfil(yo) };
}
async function _quitarAmigo(usuario, otro) {
  otro = String(otro || "").toLowerCase();
  const yo = await cargar(usuario);
  yo.datos.amigos = (yo.datos.amigos || []).filter((x) => x !== otro);
  await actualizar(yo);
  const el = await leer(otro);
  if (el) { el.datos.amigos = (el.datos.amigos || []).filter((x) => x !== usuario); await actualizar(el); }
  return { perfil: perfil(yo) };
}
// Lista con nombre y foto de cada uno (el estado "en línea" lo pone scripts.js)
async function listaAmigos(usuario) {
  const yo = await cargar(usuario);
  const datosDe = async (u) => { const f = await leer(u); return f ? { usuario: f.usuario, nombre: f.nombre, foto: f.datos.foto } : null; };
  const amigos = (await Promise.all((yo.datos.amigos || []).map(datosDe))).filter(Boolean);
  const solicitudes = (await Promise.all((yo.datos.solicitudes || []).map(datosDe))).filter(Boolean);
  return { amigos, solicitudes };
}
async function sonAmigos(usuario, otro) {
  const yo = await cargar(usuario);
  return (yo.datos.amigos || []).includes(String(otro || "").toLowerCase());
}

// =====================================================================
// CÓDIGOS DE REGALO (Contador Ashpai)
// Solo el admin (AHSPAI_ADMIN, por defecto "ryangames") los crea.
// Premio: { monedas, sobre: "todas"|"AHAHO"|"ENCUENTRO", sobres: n, carta: id, copias: n }
// usos_max: 1 = lo canjea una sola cuenta; más = lo pueden canjear varias (cada cuenta una vez)
// =====================================================================
const ADMIN = () => String(process.env.AHSPAI_ADMIN || "ryangames").toLowerCase();
const esAdmin = (usuario) => String(usuario || "").toLowerCase() === ADMIN();
const LETRAS_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I para que no se confundan
const limpiarCodigo = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
function nuevoCodigo() {
  let c = "";
  const b = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) c += LETRAS_CODIGO[b[i] % LETRAS_CODIGO.length];
  return c;
}
function revisarPremio(p) {
  p = p || {};
  const out = {};
  const monedas = Math.floor(Number(p.monedas) || 0);
  if (monedas > 0) out.monedas = Math.min(monedas, 100000);
  if (p.sobre !== undefined && p.sobre !== "") {
    if (!(p.sobre in SOBRES)) throw new Error("sobre_invalido");
    out.sobre = p.sobre;
    out.sobres = Math.min(Math.max(1, Math.floor(Number(p.sobres) || 1)), 20);
  }
  if (p.carta) {
    if (!CARTAS[p.carta]) throw new Error("carta_no_existe");
    out.carta = p.carta;
    out.copias = Math.min(Math.max(1, Math.floor(Number(p.copias) || 1)), 10);
  }
  if (!Object.keys(out).length) throw new Error("elige_un_premio");
  return out;
}
async function crearCodigos(usuario, premio, cantidad, usosMax, nota) {
  if (!esAdmin(usuario)) throw new Error("solo_el_admin");
  await iniciar();
  const pr = revisarPremio(premio);
  cantidad = Math.min(Math.max(1, Math.floor(Number(cantidad) || 1)), 200);
  usosMax = Math.min(Math.max(1, Math.floor(Number(usosMax) || 1)), 10000);
  nota = String(nota || "").slice(0, 60);
  const codigos = [];
  while (codigos.length < cantidad) {
    const c = nuevoCodigo();
    const fila = { codigo: c, premio: pr, usos_max: usosMax, usos: 0, canjes: [], nota, por: ADMIN(), creado: new Date().toISOString() };
    if (memCodigos) { if (memCodigos.has(c)) continue; memCodigos.set(c, fila); codigos.push(c); continue; }
    const r = await pool.query("INSERT INTO ahspai_codigos (codigo, premio, usos_max, nota, por) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (codigo) DO NOTHING",
      [c, JSON.stringify(pr), usosMax, nota, fila.por]);
    if (r.rowCount === 1) codigos.push(c);
  }
  return { codigos, premio: pr, usos_max: usosMax, nota };
}
async function verCodigos(usuario) {
  if (!esAdmin(usuario)) throw new Error("solo_el_admin");
  await iniciar();
  if (memCodigos) return { codigos: [...memCodigos.values()].slice(-50).reverse().map(({ canjes, ...r }) => r) };
  const r = await pool.query("SELECT codigo, premio, usos_max, usos, nota, creado FROM ahspai_codigos ORDER BY creado DESC LIMIT 50");
  return { codigos: r.rows };
}
// Reserva un uso del código para esta cuenta (de una sola vez, sin que dos lo gasten a la vez)
async function tomarCodigo(codigo, usuario) {
  if (memCodigos) {
    const f = memCodigos.get(codigo);
    if (!f) throw new Error("codigo_no_existe");
    if (f.canjes.includes(usuario)) throw new Error("ya_canjeaste_este_codigo");
    if (f.usos >= f.usos_max) throw new Error("codigo_ya_usado");
    f.usos++; f.canjes.push(usuario);
    return copia(f.premio);
  }
  const r = await pool.query(
    `UPDATE ahspai_codigos SET usos = usos + 1, canjes = canjes || to_jsonb($2::text)
     WHERE codigo = $1 AND usos < usos_max AND NOT (canjes ? $2) RETURNING premio`, [codigo, usuario]);
  if (r.rowCount === 1) return r.rows[0].premio;
  const e = await pool.query("SELECT usos, usos_max, canjes FROM ahspai_codigos WHERE codigo = $1", [codigo]);
  if (!e.rows[0]) throw new Error("codigo_no_existe");
  if ((e.rows[0].canjes || []).includes(usuario)) throw new Error("ya_canjeaste_este_codigo");
  throw new Error("codigo_ya_usado");
}
async function devolverCodigo(codigo, usuario) {
  try {
    if (memCodigos) { const f = memCodigos.get(codigo); if (f) { f.usos--; f.canjes = f.canjes.filter((u) => u !== usuario); } return; }
    await pool.query("UPDATE ahspai_codigos SET usos = usos - 1, canjes = canjes - $2 WHERE codigo = $1", [codigo, usuario]);
  } catch (e) { console.log("[Ahspai] No se pudo devolver el código", codigo, e.message); }
}
// Abre sobres o da cartas/monedas a una cuenta (se usa en canjes y premios)
function darPremio(d, pr) {
  const res = { monedas: 0, cartas: [], nuevas: [] };
  if (pr.monedas) { d.monedas += pr.monedas; res.monedas = pr.monedas; }
  const sumar = (id) => {
    if (!(d.coleccion[id] > 0) && !res.nuevas.includes(id)) res.nuevas.push(id);
    d.coleccion[id] = (d.coleccion[id] || 0) + 1;
    res.cartas.push(id);
  };
  if (pr.sobre !== undefined) {
    const pool = Object.keys(CARTAS).filter((id) => !SOBRES[pr.sobre] || CARTAS[id].expansion === SOBRES[pr.sobre]);
    for (let s = 0; s < (pr.sobres || 1); s++) for (let i = 0; i < SOBRE.cartas; i++) sumar(sacarCarta(pool));
    d.sobres = (d.sobres || 0) + (pr.sobres || 1);
  }
  if (pr.carta) for (let i = 0; i < (pr.copias || 1); i++) sumar(pr.carta);
  return res;
}
async function canjearCodigo(usuario, codigo) {
  await iniciar();
  codigo = limpiarCodigo(codigo);
  if (codigo.length !== 8) throw new Error("codigo_invalido");
  await cargar(usuario); // que la cuenta exista
  const pr = await tomarCodigo(codigo, usuario);
  try {
    return await reintentar(async () => {
      const f = await cargar(usuario);
      const res = darPremio(f.datos, pr);
      await actualizar(f);
      const nombres = res.cartas.map((id) => ({ id, nombre: CARTAS[id].nombre, rareza: RAREZAS[id] || "comun" }));
      return { premio: pr, ...res, nombres, perfil: perfil(f) };
    });
  } catch (e) {
    await devolverCodigo(codigo, usuario); // si no se pudo dar el premio, el código sigue sirviendo
    throw e;
  }
}

// =====================================================================
// TORNEOS (Contador Ashpai): premio al campeón
// Para que no se abuse: mínimo 4 jugadores, 2 con cuenta, y cada cuenta gana premio 1 vez por día.
// =====================================================================
const PREMIO_TORNEO = 100;
async function _torneoCampeon(organizador, campeon, jugadores, nombre) {
  campeon = String(campeon || "").toLowerCase();
  const lista = Array.isArray(jugadores) ? jugadores.map((j) => String(j || "")).slice(0, 64) : [];
  if (lista.length < 4) throw new Error("torneo_muy_chico");
  const conCuenta = [];
  for (const u of new Set(lista.map((x) => x.toLowerCase()))) if (await leer(u)) conCuenta.push(u);
  if (conCuenta.length < 2) throw new Error("faltan_jugadores_con_cuenta");
  if (!conCuenta.includes(campeon)) throw new Error("el_campeon_no_tiene_cuenta");
  const f = await cargar(campeon);
  const hoy = new Date().toISOString().slice(0, 10);
  const d = f.datos;
  d.torneos_ganados = (d.torneos_ganados || 0) + 1;
  let monedas = 0;
  if (d.ultimo_premio_torneo !== hoy) { d.monedas += PREMIO_TORNEO; monedas = PREMIO_TORNEO; d.ultimo_premio_torneo = hoy; }
  d.historial_torneos = [...(d.historial_torneos || []), { nombre: String(nombre || "Torneo").slice(0, 40), fecha: hoy, por: organizador, jugadores: lista.length }].slice(-20);
  await actualizar(f);
  return { campeon, monedas, torneos_ganados: d.torneos_ganados };
}
const torneoCampeon = (...a) => reintentar(() => _torneoCampeon(...a));


const entrar = (...a) => reintentar(() => _entrar(...a));
const conToken = (...a) => reintentar(() => _conToken(...a));
const salir = (...a) => reintentar(() => _salir(...a));
const elegirMazo = (...a) => reintentar(() => _elegirMazo(...a));
const premiar = (...a) => reintentar(() => _premiar(...a));
const guardarMazo = (...a) => reintentar(() => _guardarMazo(...a));
const borrarMazo = (...a) => reintentar(() => _borrarMazo(...a));
const activarMazo = (...a) => reintentar(() => _activarMazo(...a));
const comprarSobre = (...a) => reintentar(() => _comprarSobre(...a));
const cambiarFoto = (...a) => reintentar(() => _cambiarFoto(...a));
const solicitar = (...a) => reintentar(() => _solicitar(...a));
const responder = (...a) => reintentar(() => _responder(...a));
const quitarAmigo = (...a) => reintentar(() => _quitarAmigo(...a));

module.exports = {
  crearCodigos, verCodigos, canjearCodigo, torneoCampeon, esAdmin,
  verMazos, guardarMazo, borrarMazo, activarMazo, mazoInicial, revisarMazo, elegirMazo, coleccionRegalo,
  comprarSobre, cambiarFoto, perfilPublico,
  solicitar, responder, quitarAmigo, listaAmigos, sonAmigos, SOBRE, iniciar, crear, entrar, conToken, salir, verPerfil, verColeccion, premiar, coleccionInicial, PREMIO, _usarMemoria: () => { memoria = new Map(); memCodigos = new Map(); listo = Promise.resolve(); } };
