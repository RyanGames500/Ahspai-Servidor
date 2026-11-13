// Mazos de regalo EXACTOS (listas de Ryan, 13-nov-2026).
// Antes se regalaba por rareza (2/2/1/1) y se rellenaba con comunes del otro mazo:
// eso metía cartas que no correspondían y dejaba afuera unidades/sucesos/objetos/sobrenaturales.
// Cada nombre se busca en cartas.js ignorando acentos y mayúsculas.
// Prueba:  node ahspai/regalo.js   (imprime la lista resuelta y avisa si algo no encuentra)
"use strict";

// Escrituras de Ryan -> nombre como está en cartas.js (solo las que hacen falta)
const ALIASES = {
  "ama sua ama quella": "ama sua ama llulla ama quella",
  "ainy": "ayni",
  "guallanca del supay": "guallcanga del supay",
  "furufuhue": "furufurhue",
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
    if (parcial.length > 1) {                                        // si hay varias, la más corta (la más parecida)
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

/** Colección de regalo exacta: { idCarta: copias } */
function coleccion(exp, CARTAS) {
  const lista = exp === "AHAHO" ? REGALO_AHAHO : exp === "ENCUENTRO" ? REGALO_ENCUENTRO : null;
  if (!lista) throw new Error("mazo_no_existe");
  const col = {};
  for (const [nombre, copias] of Object.entries(lista)) {
    const id = buscar(nombre, CARTAS);
    if (!id) { console.log("[Ahspai] Carta de regalo NO ENCONTRADA (" + exp + "): " + nombre); continue; }
    if (CARTAS[id].expansion && CARTAS[id].expansion !== exp)
      console.log("[Ahspai] AVISO: '" + nombre + "' es de la expansión " + CARTAS[id].expansion + ", no " + exp);
    col[id] = copias;
  }
  return col;
}

module.exports = { coleccion, buscar, normalizar, REGALO_AHAHO, REGALO_ENCUENTRO };

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
  console.log(ok ? "\nTodo resuelto." : "\nHay cartas sin resolver (arreglales el nombre o agrega un alias).");
  process.exit(ok ? 0 : 1);
}
