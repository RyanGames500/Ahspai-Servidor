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

const NEON = {
  host: "ep-proud-mud-arbefpj4-pooler.c-4.us-west-2.aws.neon.tech",
  user: "neondb_owner",
  database: "neondb",
};

// Copias iniciales según la rareza (mazos AHAHO y Encuentro)
const COPIAS_INICIALES = { comun: 3, legendaria: 2, mitica: 1, divina: 1 };
const EXPANSIONES_INICIALES = ["AHAHO", "ENCUENTRO"];
const PREMIO = { ganada: 50, empatada: 25, perdida: 10 };

let pool = null;      // conexión a Neon
let memoria = null;   // si no hay base de datos: Map usuario -> fila
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
    console.log("[Ahspai] Base de datos Neon lista.");
  })().catch((e) => {
    console.log("[Ahspai] No se pudo conectar a la base de datos:", e.message);
    listo = null; // se reintenta en el próximo pedido
    throw new Error("base_de_datos_no_disponible");
  });
  return listo;
}

// ---------- Guardar y leer ----------
async function leer(usuario) {
  await iniciar();
  if (memoria) return memoria.get(usuario) || null;
  const r = await pool.query("SELECT usuario, nombre, hash, sal, token, datos FROM ahspai_cuentas WHERE usuario = $1", [usuario]);
  return r.rows[0] || null;
}
async function leerPorToken(tokenHash) {
  await iniciar();
  if (memoria) { for (const f of memoria.values()) if ((f.datos.tokens || []).includes(tokenHash)) return f; return null; }
  const r = await pool.query("SELECT usuario, nombre, hash, sal, token, datos FROM ahspai_cuentas WHERE datos->'tokens' ? $1", [tokenHash]);
  return r.rows[0] || null;
}
async function insertar(f) {
  await iniciar();
  if (memoria) { if (memoria.has(f.usuario)) return false; memoria.set(f.usuario, f); return true; }
  const r = await pool.query(
    "INSERT INTO ahspai_cuentas (usuario, nombre, hash, sal, token, datos) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (usuario) DO NOTHING",
    [f.usuario, f.nombre, f.hash, f.sal, f.token, JSON.stringify(f.datos)]);
  return r.rowCount === 1;
}
async function actualizar(f) {
  await iniciar();
  if (memoria) { memoria.set(f.usuario, f); return; }
  await pool.query("UPDATE ahspai_cuentas SET token = $2, datos = $3 WHERE usuario = $1", [f.usuario, f.token, JSON.stringify(f.datos)]);
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
function datosNuevos() {
  return {
    coleccion: coleccionInicial(),
    mazos: [null, null, null, null, null], // 5 espacios para guardar mazos
    activo: -1,                             // qué mazo está activo (-1 = ninguno todavía)
    monedas: 0,
    stats: { ganadas: 0, perdidas: 0, empatadas: 0 },
    logros: [],
    foto: "condor_andino",
    amigos: [],
    solicitudes: [],
  };
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
    logros: d.logros || [],
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
  return { token, perfil: perfil(f) };
}

async function entrar(usuario, clave) {
  const f = await leer(String(usuario || "").trim().toLowerCase());
  if (!f) throw new Error("usuario_o_clave_incorrectos");
  const h = await hashClave(clave, f.sal);
  if (!crypto.timingSafeEqual(Buffer.from(h, "hex"), Buffer.from(f.hash, "hex"))) throw new Error("usuario_o_clave_incorrectos");
  const token = nuevoToken(f);
  await actualizar(f);
  return { token, perfil: perfil(f) };
}

async function conToken(token) {
  if (!token) throw new Error("sesion_vencida");
  const f = await leerPorToken(hashToken(token));
  if (!f) throw new Error("sesion_vencida");
  return { token, perfil: perfil(f) };
}

// Cerrar sesión en este aparato: su token deja de servir
async function salir(usuario, token) {
  const f = await leer(usuario);
  if (!f) return;
  const h = hashToken(token);
  f.datos.tokens = (f.datos.tokens || []).filter((x) => x !== h);
  await actualizar(f);
}

async function verPerfil(usuario) {
  const f = await leer(usuario);
  if (!f) throw new Error("cuenta_no_existe");
  return perfil(f);
}

// Al terminar una partida: monedas y estadísticas. resultado = "ganada" | "perdida" | "empatada"
async function premiar(usuario, resultado) {
  const f = await leer(usuario);
  if (!f || !PREMIO[resultado]) return null;
  f.datos.monedas += PREMIO[resultado];
  const k = resultado === "ganada" ? "ganadas" : resultado === "perdida" ? "perdidas" : "empatadas";
  f.datos.stats[k] = (f.datos.stats[k] || 0) + 1;
  await actualizar(f);
  return { monedas: PREMIO[resultado], perfil: perfil(f) };
}

module.exports = { iniciar, crear, entrar, conToken, salir, verPerfil, premiar, coleccionInicial, PREMIO, _usarMemoria: () => { memoria = new Map(); listo = Promise.resolve(); } };
