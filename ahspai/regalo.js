// Mazos de regalo EXACTOS (listas de Ryan, 13-nov-2026).
// Antes se regalaba por rareza (2/2/1/1) y se rellena con comunes del otro mazo:
// eso metia cartas que no correspondian y dejaba afuera unidades/sucesos/objetos/sobrenaturales.
// Cada nombre se busca en cartas.js ignorando acentos y mayusculas.
// Prueba:  node ahspai/regalo.js   (imprime la lista resuelta y avisa si algo no encuentra)
//
// COMO SE ACTIVA: cuentas.js es muy grande para editarlo entero, asi que el arreglo
// entra por rarezas.js (que cuentas.js siempre carga): al arrancar el servidor,
// instalar() envuelve cuentas.elegirMazo para que, despues del flujo normal,
// la coleccion quede con la lista EXACTA de aqui (arregla tambien el mazo guardado
// en la base de datos y el mazo de esa sesion). Para quitar el parche: borrar la
// linea de rarezas.js que llama a instalar() (o hacer el cambio de 3 lineas en
// cuentas.js usando require("./regalo.js") dentro de coleccionRegalo).
"use strict";

// Escrituras de Ryan -> nombre como esta en cartas.js (solo las que hacen falta)
const ALIASES = {
  "ama sua ama quella": "ama sua ama llulla ama quella",
  "ainy": "ayni",
  "guallanca del supay": "guallcanga del supay",
  "furufuhue": "furufurhue",
  "willak uma": "willka uma",
  "cervatana guarani": "cerbatana guarani",
  "convertir al catolisismo": "convertir al catolicismo",
  "exorsismo diivno": "exorcismo divino",
  "hoy te convertis en heroe": "hoy te conviertes en heroe",
  "pero del conquistador": "perro del conquistador",
};

// Cartas que debe darte el mazo AHAHO al elegirlo al abrir cuenta
const REGALO_AHAHO = {
  "Manco Capac": 1,
  "Viejo Camac": 2,
  "Quirquincho": 2,
  "Condor Andino": 2,
  "Kalla de los Cerros": 2,
  "Willak Uma": 2,
  "Lariku": 2,
  "Aclla de Mama Cocha": 2,
  "Curandero Chaman": 2,
  "Achaquik Lanza Sangrienta": 2,
  "Amauta": 2,
  "Paisano": 3,
  "Paisana": 3,
  "Warakusi": 2,
  "Ainy": 2,
  "Minka": 2,
  "Mita": 2,
  "Pirca": 2,
  "Templo del Sol": 2,
  "Cana con Ruda": 2,
  "Cervatana Guarani": 2,
  "Guallanca del Supay": 2,
  "Hacha Arrojadiza": 2,
  "Huaca Hampatu": 1,
  "Ama Sua Ama Quella": 2,
  "Choque Cultural": 2,
  "Coca": 2,
  "Aclla de Hampatu": 1,
  "Reagrupacion Militar": 2,
  "Golpe Zonda": 2,
  "Huevo de Oro": 1,
  "Hurkaway": 2,
  "Primera Estrella": 2,
  "Furufuhue": 1,
  "Mama Cocha": 1,
  "Vichama": 1,
  "Pillan": 1,
  "Xalpen": 1,
  "Sachayoj": 1,
  "Olum": 1,
};

// Cartas que debe darte el mazo ENCUENTRO al elegirlo al abrir cuenta
const REGALO_ENCUENTRO = {
  "Aldeana": 3,
  "Aldeano": 3,
  "Arcabucero": 2,
  "Ballestero": 2,
  "Nuno": 2,
  "Caballero Conquistador": 2,
  "Caballo Andaluz": 2,
  "Cerdos de Batalla": 2,
  "Carlos": 1,
  "Diego": 2,
  "Pedro": 2,
  "Hombre de Fe": 2,
  "Francisco Pizarro": 2,
  "Sorgina": 2,
  "Convertir al Catolisismo": 2,
  "Exorsismo Diivno": 1,
  "Hoy te Convertis en Heroe": 2,
  "Pena de Muerte": 2,
  "Refuerzo": 2,
  "Tentacion Lujuriosa": 2,
  "Terremoto Divino": 2,
  "Trato con Mandinga": 1,
  "Sagrada Biblia": 2,
  "Montura": 2,
  "Pero del Conquistador": 2,
  "Santo Grial": 1,
  "Monedas": 2,
  "Barco Pesquero": 2,
  "Canon": 2,
  "Santa Catedral": 2,
  "Criadero de Chanchos": 2,
  "Monumento a los Caidos": 2,
  "San Jorge": 1,
  "Leon de San Marcos": 1,
  "Demonio Legion": 1,
  "Buer": 1,
  "Arcangel Miguel": 1,
  "Arcangel Uriel": 1,
  "Duque Demoniaco": 1,
  "Santa Cruz Divina": 1,
};

function normalizar(t) {
  return String(t || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}
const singular = (t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t);

// Busca el id de una carta por nombre. Devuelve null si no la encuentra.
function buscar(nombre, CARTAS) {
  const claves = [normalizar(nombre)];
  const alias = ALIASES[String(nombre).toLowerCase()];
  if (alias) claves.push(normalizar(alias));
  for (const texto of claves) {
    let parcial = [];
    for (const [id, c] of Object.entries(CARTAS)) {
      const cn = normalizar(c.nombre);
      if (!cn) continue;
      if (cn === texto) return id;                                   // nombre exacto
      if (cn.startsWith(texto)) parcial.push(id);                    // el nombre largo de la carta empieza con el nuestro
    }
    if (parcial.length === 1) return parcial[0];
    if (parcial.length > 1) {                                        // si hay varias, la mas corta (la mas parecida)
      parcial.sort((a, b) => normalizar(CARTAS[a].nombre).length - normalizar(CARTAS[b].nombre).length);
      if (normalizar(CARTAS[parcial[0]].nombre).length < normalizar(CARTAS[parcial[1]].nombre).length) return parcial[0];
    }
    // tokens en orden (admite plural: "refuerzo" encuentra "Refuerzos")
    const tks = texto.split(" ").map(singular).filter(Boolean);
    if (tks.length) {
      let tok = [];
      for (const [id, c] of Object.entries(CARTAS)) {
        const ct = normalizar(c.nombre).split(" ").map(singular);
        let i = 0;
        for (const t of ct) if (i < tks.length && t === tks[i]) i++;
        if (i === tks.length) tok.push(id);
      }
      if (tok.length === 1) return tok[0];
    }
  }
  return null;
}

/** Coleccion de regalo exacta: { idCarta: copias } */
function coleccion(exp, CARTAS) {
  const lista = exp === "AHAHO" ? REGALO_AHAHO : exp === "ENCUENTRO" ? REGALO_ENCUENTRO : null;
  if (!lista) throw new Error("mazo_no_existe");
  const col = {};
  for (const [nombre, copias] of Object.entries(lista)) {
    const id = buscar(nombre, CARTAS);
    if (!id) { console.log("[Ahspai] Carta de regalo NO ENCONTRADA (" + exp + "): " + nombre); continue; }
    if (CARTAS[id].expansion && CARTAS[id].expansion !== exp)
      console.log("[Ahspai] AVISO: '" + nombre + "' es de la expansion " + CARTAS[id].expansion + ", no " + exp);
    col[id] = copias;
  }
  return col;
}

// =====================================================================
// PARCHE AUTOMATICO (ver comentario arriba). Lo llama rarezas.js al
// arrancar el servidor. No toca cuentas.js: envuelve elegirMazo.
// =====================================================================

// Misma configuracion de base de datos que cuentas.js (Neon / Render)
function configDbRegalo() {
  const url = process.env.DATABASE_URL || "";
  if (url.includes("://")) {
    const limpia = url.replace(/[?&]channel_binding=[^&]*/g, "").replace(/\?&/, "?").replace(/\?$/, "");
    return { connectionString: limpia, ssl: { rejectUnauthorized: true } };
  }
  const clave = url || process.env.PGPASSWORD || "";
  if (!clave) return null;
  return {
    host: process.env.PGHOST || "ep-proud-mud-arbefpj4-pooler.c-4.us-west-2.aws.neon.tech",
    user: process.env.PGUSER || "neondb_owner",
    database: process.env.PGDATABASE || "neondb",
    password: clave,
    port: 5432,
    ssl: { rejectUnauthorized: true },
  };
}

// Reemplaza en la base de datos la coleccion (y el mazo guardado) por la lista exacta
async function corregir(usuario, exp, cuentas, CARTAS) {
  const col = coleccion(exp, CARTAS);
  const cfg = configDbRegalo();
  if (!cfg) { console.log("[Ahspai] Sin base de datos: no se corrige el mazo de regalo de " + usuario + " (solo pasa en pruebas locales)."); return; }
  const { Pool } = require("pg");
  const pool = new Pool({ ...cfg, max: 2 });
  try {
    for (let intento = 0; intento < 5; intento++) {
      const r = await pool.query("SELECT datos, ver FROM ahspai_cuentas WHERE usuario = $1", [usuario]);
      const fila = r.rows[0];
      if (!fila) return;
      const d = fila.datos;
      const m = cuentas.mazoInicial(col);
      m.nombre = exp === "AHAHO" ? "Mazo AHAHO" : "Mazo Encuentro";
      d.coleccion = col;
      if (!Array.isArray(d.mazos)) d.mazos = [null, null, null, null, null];
      d.mazos[0] = m;
      d.activo = m.listo ? 0 : -1;
      const u = await pool.query(
        "UPDATE ahspai_cuentas SET datos = $2, ver = ver + 1 WHERE usuario = $1 AND ver = $3",
        [usuario, JSON.stringify(d), fila.ver]);
      if (u.rowCount === 1) {
        console.log("[Ahspai] Mazo de regalo " + exp + " corregido con la lista exacta para " + usuario + ".");
        return;
      }
      // ver cambio en el medio: se reintenta con los datos nuevos
    }
    console.log("[Ahspai] No se pudo corregir el mazo de regalo de " + usuario + " (conflicto de version).");
  } finally {
    pool.end().catch(() => {});
  }
}

// Se llama desde rarezas.js. Espera a que cuentas.js este cargado y envuelve elegirMazo:
// el flujo original corre igual (chequeos, guardado, respuesta bien formada) y despues
// la coleccion queda con la lista EXACTA de este archivo.
function instalar() {
  if (typeof process !== "object" || typeof process.nextTick !== "function") return;
  process.nextTick(() => {
    try {
      const cuentas = require("./cuentas.js");
      if (!cuentas || typeof cuentas.elegirMazo !== "function" || typeof cuentas.mazoInicial !== "function") {
        console.log("[Ahspai] Parche de regalo: cuentas.js no tiene elegirMazo/mazoInicial, no se instala.");
        return;
      }
      if (cuentas._parche_regalo_exacto) return; // ya instalado
      cuentas._parche_regalo_exacto = true;
      const CARTAS = require("./cartas.js");
      const original = cuentas.elegirMazo;
      cuentas.elegirMazo = async function (usuario, exp) {
        const r = await original(usuario, exp); // flujo normal (chequea cuenta, guarda, responde)
        const e = String(exp || "").toUpperCase();
        const u = String(usuario || "");
        try { await corregir(u, e, cuentas, CARTAS); }
        catch (err) { console.log("[Ahspai] No se pudo corregir el mazo de regalo de " + u + ":", (err && err.message) || err); }
        try {
          // El mazo de ESTA sesion tambien debe ser el exacto (conMazo en scripts.js lo guarda)
          if (r && "mazo" in r) {
            const m = cuentas.mazoInicial(coleccion(e, CARTAS));
            if (m && m.listo !== false) r.mazo = m;
          }
        } catch (err) { /* si falla, queda el mazo del flujo original */ }
        return r;
      };
      console.log("[Ahspai] Parche activo: los mazos de regalo (AHAHO/ENCUENTRO) son las listas exactas de regalo.js.");
    } catch (e) {
      console.log("[Ahspai] No se pudo activar el parche de mazos de regalo:", (e && e.message) || e);
    }
  });
}

module.exports = { coleccion, buscar, normalizar, instalar, REGALO_AHAHO, REGALO_ENCUENTRO };

// ---------- Prueba:  node ahspai/regalo.js ----------
if (require.main === module) {
  const CARTAS = require("./cartas.js");
  let motor = null;
  try { motor = require("./motor.js"); } catch (e) {}
  let ok = true;
  for (const [exp, lista] of [["AHAHO", REGALO_AHAHO], ["ENCUENTRO", REGALO_ENCUENTRO]]) {
    console.log("\n===== Mazo " + exp + " =====");
    const col = {};
    for (const [nombre, copias] of Object.entries(lista)) {
      const id = buscar(nombre, CARTAS);
      if (!id) { console.log("  ✗ NO ENCONTRADA: " + nombre); ok = false; continue; }
      col[id] = copias;
      console.log("  " + id + "  " + CARTAS[id].nombre + " x" + copias);
    }
    if (motor && motor.validarMazo) {
      const mazo = { principal: [], sobrenatural: [], recursos: [] };
      for (const [id, n] of Object.entries(col)) {
        const c = CARTAS[id];
        const destino = c.sobrenatural ? mazo.sobrenatural : (c.tipo === "estructura" ? mazo.recursos : mazo.principal);
        for (let k = 0; k < n; k++) destino.push(id);
      }
      console.log("  validarMazo: " + (motor.validarMazo(mazo, CARTAS) || "OK ✔"));
    }
  }
  console.log(ok ? "\nTodo resuelto." : "\nHay cartas sin resolver (arreglales el nombre o agrega un alias en ALIASES).");
  process.exit(ok ? 0 : 1);
}
