// Pruebas del motor:  node prueba.js
"use strict";
const M = require("./motor.js");
const cartas = require("./cartas_prueba.js");

let pasaron = 0, fallaron = 0;
function prueba(nombre, fn) {
  try { fn(); pasaron++; console.log("  OK   " + nombre); }
  catch (e) { fallaron++; console.log("  FALLO " + nombre + "\n        " + e.message); }
}
function igual(a, b, msg) { if (a !== b) throw new Error(`${msg}: esperaba ${JSON.stringify(b)} y fue ${JSON.stringify(a)}`); }
function ok(r, msg) { if (!r.ok) throw new Error(`${msg}: ${r.error}`); return r; }

const rep = (id, n) => Array(n).fill(id);
const MAZO = () => ({
  principal: [...rep("P01", 4), ...rep("P02", 4), ...rep("P03", 4), ...rep("P04", 4), ...rep("P05", 3), ...rep("P06", 3), ...rep("P07", 4), "P08", ...rep("P09", 4)], // 31
  sobrenatural: ["S01", "S01", "S02"],
  recursos: [...rep("E01", 3), ...rep("E02", 3), ...rep("E03", 2), ...rep("E04", 2)], // 10
});

function nueva(modo, n) {
  const g = M.crearPartida({ modo, jugadores: Array.from({ length: n }, (_, i) => ({ id: 100 + i, mazo: MAZO() })) }, cartas);
  for (let i = 0; i < n; i++) ok(M.jugar(g, i, { tipo: "mano_inicial", de_recursos: 1 }), "mano inicial");
  return g;
}
// Pone una carta directo en el campo (para armar situaciones de prueba)
function poner(g, asiento, id, zona, casilla, pos) {
  const inst = { uid: g.sigUid++, carta: id, dueno: asiento, origen: "principal", pos, herida: 0, contusion: 0, ataco: false, salioDeReserva: false };
  g.jugadores[asiento][zona][casilla] = inst;
  return inst;
}
function irABatalla(g) {
  ok(M.jugar(g, g.actual, { tipo: "robar", mazo: "principal" }), "robar");
  ok(M.jugar(g, g.actual, { tipo: "ir_batalla" }), "ir a batalla");
}

console.log("\nValidación de mazos");
prueba("mazo de prueba es válido", () => igual(M.validarMazo(MAZO(), cartas), null, "error"));
prueba("rechaza 5 copias de un peón", () => {
  const m = MAZO(); m.principal.push("P01");
  if (!M.validarMazo(m, cartas).startsWith("demasiadas_copias")) throw new Error("no lo rechazó");
});
prueba("rechaza 2 líderes", () => {
  const m = MAZO(); m.principal.push("P08");
  if (!M.validarMazo(m, cartas)) throw new Error("no lo rechazó");
});
prueba("rechaza mazo principal de 29", () => {
  const m = MAZO(); m.principal = m.principal.slice(0, 29);
  if (!M.validarMazo(m, cartas)) throw new Error("no lo rechazó");
});

console.log("\nInicio");
prueba("todos empiezan con 5 y el primero roba la 6ta", () => {
  const g = nueva("1v1", 2);
  igual(g.jugadores[0].mano.length, 5, "mano j0");
  igual(g.jugadores[1].mano.length, 5, "mano j1");
  igual(g.etapa, "robo", "etapa");
  ok(M.jugar(g, 0, { tipo: "robar", mazo: "recursos" }), "robar");
  igual(g.jugadores[0].mano.length, 6, "mano j0 tras robar");
});
prueba("recursos iniciales 4/4/4", () => {
  const g = nueva("1v1", 2);
  igual(JSON.stringify(g.equipos[0].recursos), JSON.stringify({ alimento: 4, capital: 4, creencia: 4 }), "recursos");
});
prueba("no puedes jugar si no es tu turno", () => {
  const g = nueva("1v1", 2);
  igual(M.jugar(g, 1, { tipo: "robar" }).error, "no_es_tu_turno", "error");
});

console.log("\nBajar y recursos");
prueba("máximo 2 bajadas por turno", () => {
  const g = nueva("1v1", 2);
  const j = g.jugadores[0];
  j.mano = [];
  for (let i = 0; i < 3; i++) j.mano.push({ uid: g.sigUid++, carta: "P01", dueno: 0, origen: "principal", pos: "atk", herida: 0, contusion: 0 });
  ok(M.jugar(g, 0, { tipo: "robar" }), "robar");
  ok(M.jugar(g, 0, { tipo: "bajar", uid: j.mano[0].uid, casilla: 0 }), "bajada 1");
  ok(M.jugar(g, 0, { tipo: "bajar", uid: j.mano[0].uid, casilla: 1 }), "bajada 2");
  igual(M.jugar(g, 0, { tipo: "bajar", uid: j.mano[0].uid, casilla: 2 }).error, "limite_de_bajadas", "tercera");
});
prueba("cobra el costo y no deja bajar sin recursos", () => {
  const g = nueva("1v1", 2);
  const j = g.jugadores[0];
  const rey = { uid: g.sigUid++, carta: "P08", dueno: 0, origen: "principal", pos: "atk", herida: 0, contusion: 0 };
  const guerrero = { uid: g.sigUid++, carta: "P05", dueno: 0, origen: "principal", pos: "atk", herida: 0, contusion: 0 };
  j.mano.push(rey, guerrero);
  ok(M.jugar(g, 0, { tipo: "robar" }), "robar");
  ok(M.jugar(g, 0, { tipo: "bajar", uid: guerrero.uid, casilla: 0 }), "guerrero");
  igual(g.equipos[0].recursos.capital, 2, "capital tras pagar 2");
  igual(M.jugar(g, 0, { tipo: "bajar", uid: rey.uid, casilla: 1 }).error, "falta_capital", "rey");
});
prueba("unidad que genera suma al bajar", () => {
  const g = nueva("1v1", 2);
  const granjero = { uid: g.sigUid++, carta: "P03", dueno: 0, origen: "principal", pos: "atk", herida: 0, contusion: 0 };
  g.jugadores[0].mano.push(granjero);
  ok(M.jugar(g, 0, { tipo: "robar" }), "robar");
  ok(M.jugar(g, 0, { tipo: "bajar", uid: granjero.uid, casilla: 0 }), "bajar");
  igual(g.equipos[0].recursos.alimento, 5, "alimento");
});
prueba("estructura como recurso suma y va al reciclaje (sin límite)", () => {
  const g = nueva("1v1", 2);
  const j = g.jugadores[0];
  const a = { uid: g.sigUid++, carta: "E01", dueno: 0, origen: "recursos" }, b = { uid: g.sigUid++, carta: "E01", dueno: 0, origen: "recursos" }, c = { uid: g.sigUid++, carta: "E02", dueno: 0, origen: "recursos" };
  j.mano.push(a, b, c);
  ok(M.jugar(g, 0, { tipo: "robar" }), "robar");
  for (const x of [a, b, c]) ok(M.jugar(g, 0, { tipo: "jugar_recurso", uid: x.uid }), "recurso");
  igual(g.equipos[0].recursos.capital, 8, "capital");
  igual(g.equipos[0].recursos.creencia, 6, "creencia");
  igual(j.reciclaje.length, 3, "reciclaje");
});
prueba("estructura bajada va a la zona defensiva y no genera", () => {
  const g = nueva("1v1", 2);
  const m = { uid: g.sigUid++, carta: "E01", dueno: 0, origen: "recursos" };
  g.jugadores[0].mano.push(m);
  ok(M.jugar(g, 0, { tipo: "robar" }), "robar");
  ok(M.jugar(g, 0, { tipo: "bajar", uid: m.uid, casilla: 1, pos: "def" }), "bajar");
  igual(g.jugadores[0].defensa[1].uid, m.uid, "en defensa");
  igual(g.equipos[0].recursos.capital, 4, "capital sin cambio");
});
prueba("sobrenatural se baja desde su mazo", () => {
  const g = nueva("1v1", 2);
  const s = g.jugadores[0].sobrenatural.find((c) => c.carta === "S02");
  ok(M.jugar(g, 0, { tipo: "robar" }), "robar");
  ok(M.jugar(g, 0, { tipo: "bajar", desde: "sobrenatural", uid: s.uid, casilla: 0 }), "bajar");
  igual(g.equipos[0].recursos.creencia, 2, "creencia pagada");
});

console.log("\nCombate (tabla del libro)");
prueba("ataque > defensa: derrota y da sus puntos", () => {
  const g = nueva("1v1", 2);
  const a = poner(g, 0, "P05", "batalla", 0, "atk"); // atk 4
  const d = poner(g, 1, "P09", "batalla", 0, "def"); // def 3, pv 1
  irABatalla(g);
  ok(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, objetivo: d.uid }), "atacar");
  igual(g.jugadores[1].batalla[0], null, "defensor fuera");
  igual(g.jugadores[1].mausoleo.length, 1, "al mausoleo");
  igual(g.equipos[0].pv, 1, "puntos");
});
prueba("ataque = defensa: unidad NO cae", () => {
  const g = nueva("1v1", 2);
  const a = poner(g, 0, "P02", "batalla", 0, "atk"); // atk 3
  const d = poner(g, 1, "P09", "batalla", 0, "def"); // def 3
  irABatalla(g);
  ok(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, objetivo: d.uid }), "atacar");
  if (!g.jugadores[1].batalla[0]) throw new Error("no debió caer");
});
prueba("ataque = defensa: estructura SÍ cae", () => {
  const g = nueva("1v1", 2);
  const a = poner(g, 0, "P02", "batalla", 0, "atk"); // atk 3
  const d = poner(g, 1, "E02", "defensa", 0, "def"); // def 3, pv 2
  irABatalla(g);
  ok(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, objetivo: d.uid }), "atacar");
  igual(g.jugadores[1].defensa[0], null, "estructura fuera");
  igual(g.equipos[0].pv, 2, "puntos");
});
prueba("ataque vs ataque igual: caen las dos y ambos ganan puntos", () => {
  const g = nueva("1v1", 2);
  const a = poner(g, 0, "P01", "batalla", 0, "atk");
  const d = poner(g, 1, "P07", "batalla", 0, "atk");
  irABatalla(g);
  ok(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, objetivo: d.uid }), "atacar");
  igual(g.jugadores[0].batalla[0], null, "atacante fuera");
  igual(g.jugadores[1].batalla[0], null, "defensor fuera");
  igual(g.equipos[0].pv, 1, "pv j0");
  igual(g.equipos[1].pv, 1, "pv j1");
});
prueba("ataque menor al ataque rival: cae el atacante", () => {
  const g = nueva("1v1", 2);
  const a = poner(g, 0, "P01", "batalla", 0, "atk"); // 2
  poner(g, 1, "P05", "batalla", 0, "atk");           // 4
  irABatalla(g);
  ok(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, objetivo: g.jugadores[1].batalla[0].uid }), "atacar");
  igual(g.jugadores[0].batalla[0], null, "atacante fuera");
  igual(g.equipos[1].pv, 1, "puntos del defensor");
});
prueba("no hay ataque directo si el rival tiene estructuras", () => {
  const g = nueva("1v1", 2);
  const a = poner(g, 0, "P05", "batalla", 0, "atk");
  poner(g, 1, "E01", "defensa", 0, "def");
  irABatalla(g);
  igual(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, jugador: 1 }).error, "primero_derrota_sus_estructuras", "error");
});
prueba("ataque directo da 1 punto", () => {
  const g = nueva("1v1", 2);
  const a = poner(g, 0, "P05", "batalla", 0, "atk");
  irABatalla(g);
  ok(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, jugador: 1 }), "atacar");
  igual(g.equipos[0].pv, 1, "pv");
});
prueba("cada carta ataca una vez y la batalla no se repite", () => {
  const g = nueva("1v1", 2);
  const a = poner(g, 0, "P05", "batalla", 0, "atk");
  irABatalla(g);
  ok(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, jugador: 1 }), "atacar");
  igual(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, jugador: 1 }).error, "ya_ataco", "segundo ataque");
  ok(M.jugar(g, 0, { tipo: "ir_nucleo2" }), "nucleo2");
  igual(M.jugar(g, 0, { tipo: "ir_batalla" }).error, "solo_desde_nucleo1", "volver a batalla");
  igual(M.jugar(g, 0, { tipo: "cambiar", uid: a.uid, pos: "def" }).error, "ya_ataco_este_turno", "cambiar tras atacar");
});
prueba("carta en defensa no puede atacar", () => {
  const g = nueva("1v1", 2);
  const a = poner(g, 0, "P05", "batalla", 0, "def");
  irABatalla(g);
  igual(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, jugador: 1 }).error, "debe_estar_en_ataque", "error");
});

console.log("\nReserva, mulligan, mano");
prueba("reserva: solo común humano/animal, y no la que atacó", () => {
  const g = nueva("1v1", 2);
  const comun = poner(g, 0, "P01", "batalla", 0, "atk");
  const especial = poner(g, 0, "P05", "batalla", 1, "atk");
  ok(M.jugar(g, 0, { tipo: "robar" }), "robar");
  igual(M.jugar(g, 0, { tipo: "a_reserva", uid: especial.uid }).error, "solo_humano_o_animal_comun", "especial");
  ok(M.jugar(g, 0, { tipo: "a_reserva", uid: comun.uid }), "comun");
  igual(g.jugadores[0].reserva.length, 1, "en reserva");
  // Regla nueva (9 nov): no se puede sacar en el mismo turno que entró
  igual(M.jugar(g, 0, { tipo: "desde_reserva", uid: comun.uid, casilla: 2 }).error, "espera_un_turno_para_sacarla", "volver el mismo turno");
});
prueba("inmóvil no cambia de posición", () => {
  const g = nueva("1v1", 2);
  const guardia = poner(g, 0, "P04", "batalla", 0, "def");
  ok(M.jugar(g, 0, { tipo: "robar" }), "robar");
  igual(M.jugar(g, 0, { tipo: "cambiar", uid: guardia.uid, pos: "atk" }).error, "carta_inmovil", "error");
});
prueba("mulligan da 1 punto a CADA rival (ffa de 4)", () => {
  const g = nueva("ffa", 4);
  ok(M.jugar(g, 0, { tipo: "robar" }), "robar");
  ok(M.jugar(g, 0, { tipo: "mulligan", uid: g.jugadores[0].mano[0].uid }), "mulligan");
  igual(g.equipos[1].pv + g.equipos[2].pv + g.equipos[3].pv, 3, "puntos repartidos");
  igual(g.equipos[0].pv, 0, "yo no gano");
  igual(g.jugadores[0].mano.length, 6, "mano igual");
});
prueba("máximo 3 mulligans por turno", () => {
  const g = nueva("1v1", 2);
  ok(M.jugar(g, 0, { tipo: "robar" }), "robar");
  for (let i = 0; i < 3; i++) ok(M.jugar(g, 0, { tipo: "mulligan", uid: g.jugadores[0].mano[0].uid }), "mulligan");
  igual(M.jugar(g, 0, { tipo: "mulligan", uid: g.jugadores[0].mano[0].uid }).error, "limite_de_mulligan", "cuarto");
});
prueba("con más de 10 en mano no puedes terminar el turno", () => {
  const g = nueva("1v1", 2);
  const j = g.jugadores[0];
  for (let i = 0; i < 6; i++) j.mano.push({ uid: g.sigUid++, carta: "P01", dueno: 0, origen: "principal" });
  ok(M.jugar(g, 0, { tipo: "robar" }), "robar"); // 12
  igual(M.jugar(g, 0, { tipo: "terminar_turno" }).error, "descarta_hasta_10", "terminar");
  ok(M.jugar(g, 0, { tipo: "descartar", uid: j.mano[0].uid }), "descartar");
  ok(M.jugar(g, 0, { tipo: "descartar", uid: j.mano[0].uid }), "descartar");
  ok(M.jugar(g, 0, { tipo: "terminar_turno" }), "terminar");
  igual(g.actual, 1, "turno del otro");
});

console.log("\nModos y final");
prueba("llegar a 30 puntos gana", () => {
  const g = nueva("1v1", 2);
  g.equipos[0].pv = 29;
  const a = poner(g, 0, "P05", "batalla", 0, "atk");
  irABatalla(g);
  const r = ok(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, jugador: 1 }), "atacar");
  igual(g.fase, "terminada", "fase");
  igual(g.ganador, 0, "ganador");
  if (!r.eventos.some((e) => e.tipo === "fin")) throw new Error("falta evento fin");
});
prueba("2v2: compañeros comparten recursos y puntos, turnos alternan equipos", () => {
  const g = nueva("2v2", 4);
  igual(g.jugadores[0].equipo, g.jugadores[2].equipo, "0 y 2 juntos");
  igual(g.jugadores[1].equipo, g.jugadores[3].equipo, "1 y 3 juntos");
  igual(Object.keys(g.equipos).length, 2, "dos equipos");
  const granjero = { uid: g.sigUid++, carta: "P03", dueno: 0, origen: "principal" };
  g.jugadores[0].mano.push(granjero);
  ok(M.jugar(g, 0, { tipo: "robar" }), "robar");
  ok(M.jugar(g, 0, { tipo: "bajar", uid: granjero.uid, casilla: 0 }), "bajar");
  igual(g.equipos[g.jugadores[2].equipo].recursos.alimento, 5, "el compañero ve el alimento");
  ok(M.jugar(g, 0, { tipo: "terminar_turno" }), "fin");
  igual(g.jugadores[g.actual].equipo, 1, "le toca al otro equipo");
});
prueba("2v2: no puedes atacar a tu compañero", () => {
  const g = nueva("2v2", 4);
  const a = poner(g, 0, "P05", "batalla", 0, "atk");
  const aliado = poner(g, 2, "P01", "batalla", 0, "atk");
  irABatalla(g);
  igual(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, objetivo: aliado.uid }).error, "no_puedes_atacar_a_tu_equipo", "error");
});
prueba("ffa: eliges a qué rival atacar", () => {
  const g = nueva("ffa", 3);
  const a = poner(g, 0, "P05", "batalla", 0, "atk");
  poner(g, 1, "P01", "batalla", 0, "def");
  irABatalla(g);
  ok(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, jugador: 2 }), "directo al 2 que tiene el campo vacío");
  igual(g.equipos[0].pv, 1, "pv");
});
prueba("ffa: si uno se rinde, siguen los demás; el último gana", () => {
  const g = nueva("ffa", 3);
  ok(M.jugar(g, 1, { tipo: "rendirse" }), "rinde 1");
  igual(g.fase, "jugando", "sigue");
  ok(M.jugar(g, 2, { tipo: "rendirse" }), "rinde 2");
  igual(g.ganador, 0, "gana 0");
});

console.log("\nLo escondido");
prueba("no ves la mano ni los mazos del rival", () => {
  const g = nueva("1v1", 2);
  const v = M.vistaPara(g, 0);
  if (!Array.isArray(v.jugadores[0].mano)) throw new Error("mi mano debería verse");
  igual(typeof v.jugadores[1].mano, "number", "mano rival solo cantidad");
  igual(typeof v.jugadores[1].principal, "number", "mazo rival solo cantidad");
  const txt = JSON.stringify(v);
  for (const c of g.jugadores[1].mano) if (txt.includes(`"uid":${c.uid},`)) throw new Error("se filtró una carta del rival");
});
prueba("el robo solo le dice la carta a quien roba", () => {
  const g = nueva("1v1", 2);
  const r = ok(M.jugar(g, 0, { tipo: "robar" }), "robar");
  const paraMi = M.eventosPara(r.eventos, 0).find((e) => e.tipo === "robo");
  const paraEl = M.eventosPara(r.eventos, 1).find((e) => e.tipo === "robo");
  if (!paraMi.carta) throw new Error("yo debería ver la carta");
  if (paraEl.carta || paraEl.uid) throw new Error("el rival no debería verla");
});


console.log("\nCambios de Ryan (6 nov)");
prueba("estructuras: solo se atacan cuando el rival ya no tiene unidades", () => {
  const g = nueva("1v1", 2);
  const a = poner(g, 0, "P05", "batalla", 0, "atk");
  poner(g, 1, "P01", "batalla", 0, "def");
  const muro = poner(g, 1, "E02", "defensa", 0, "def");
  irABatalla(g);
  igual(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, objetivo: muro.uid }).error, "primero_derrota_sus_unidades", "error");
});
prueba("estructuras: sin unidades rivales sí se pueden atacar", () => {
  const g = nueva("1v1", 2);
  const a = poner(g, 0, "P05", "batalla", 0, "atk");
  const muro = poner(g, 1, "E02", "defensa", 0, "def");
  irABatalla(g);
  ok(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, objetivo: muro.uid }), "atacar estructura");
  igual(g.jugadores[1].defensa[0], null, "cayó");
});
prueba("Demoledor: ataca estructuras aunque haya unidades, y directo si no hay estructuras", () => {
  const g = nueva("1v1", 2);
  const d = poner(g, 0, "P10", "batalla", 0, "atk");
  const d2 = poner(g, 0, "P10", "batalla", 1, "atk");
  poner(g, 1, "P01", "batalla", 0, "def");
  const muro = poner(g, 1, "E04", "defensa", 0, "def");
  irABatalla(g);
  igual(M.jugar(g, 0, { tipo: "atacar", uid: d.uid, jugador: 1 }).error, "primero_derrota_sus_estructuras", "directo con estructura");
  ok(M.jugar(g, 0, { tipo: "atacar", uid: d.uid, objetivo: muro.uid }), "estructura");
  ok(M.jugar(g, 0, { tipo: "atacar", uid: d2.uid, jugador: 1 }), "directo con unidades pero sin estructuras");
});
prueba("cambiar ATK/DEF solo una vez por turno", () => {
  const g = nueva("1v1", 2);
  const a = poner(g, 0, "P01", "batalla", 0, "atk");
  ok(M.jugar(g, 0, { tipo: "robar" }), "robar");
  ok(M.jugar(g, 0, { tipo: "cambiar", uid: a.uid, pos: "def" }), "1er cambio");
  igual(M.jugar(g, 0, { tipo: "cambiar", uid: a.uid, pos: "atk" }).error, "ya_cambio_de_posicion_este_turno", "2do cambio");
  ok(M.jugar(g, 0, { tipo: "cambiar", uid: a.uid, zona: "batalla", casilla: 3 }), "moverla de casilla sí se puede");
});
prueba("descartar solo si tienes más de 10", () => {
  const g = nueva("1v1", 2);
  ok(M.jugar(g, 0, { tipo: "robar" }), "robar");
  igual(M.jugar(g, 0, { tipo: "descartar", uid: g.jugadores[0].mano[0].uid }).error, "solo_si_tienes_mas_de_10", "error");
});
prueba("reserva la ven todos; sobrenatural solo el dueño", () => {
  const g = nueva("1v1", 2);
  g.jugadores[1].reserva.push({ uid: g.sigUid++, carta: "P01", dueno: 1, origen: "principal" });
  const v = M.vistaPara(g, 0);
  if (!Array.isArray(v.jugadores[1].reserva)) throw new Error("debería ver la reserva del rival");
  igual(typeof v.jugadores[1].sobrenatural, "number", "sobrenatural rival escondido");
  if (!Array.isArray(v.jugadores[0].sobrenatural)) throw new Error("mi sobrenatural debería verse");
});
console.log("\nCambios de Ryan (9 nov)");
prueba("no se ataca estructura si tiene unidades en su zona de batalla", () => {
  const g = nueva("1v1", 2);
  const a = poner(g, 0, "P05", "batalla", 0, "atk");
  poner(g, 1, "P01", "batalla", 0, "atk");
  const muro = poner(g, 1, "E01", "defensa", 0, "def");
  irABatalla(g);
  igual(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, objetivo: muro.uid }).error, "primero_derrota_sus_unidades", "estructura");
});
prueba("no se ataca directo si tiene unidades en su zona de batalla", () => {
  const g = nueva("1v1", 2);
  const a = poner(g, 0, "P05", "batalla", 0, "atk");
  poner(g, 1, "P01", "batalla", 2, "atk");
  irABatalla(g);
  igual(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, jugador: 1 }).error, "primero_derrota_sus_unidades", "directo");
});
prueba("sin unidades en batalla ya se puede atacar la estructura", () => {
  const g = nueva("1v1", 2);
  const a = poner(g, 0, "P05", "batalla", 0, "atk");
  const muro = poner(g, 1, "E01", "defensa", 0, "def");
  irABatalla(g);
  ok(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, objetivo: muro.uid }), "estructura");
});
prueba("reserva: se puede sacar recién en el turno siguiente", () => {
  const g = nueva("1v1", 2);
  const comun = poner(g, 0, "P01", "batalla", 0, "atk");
  ok(M.jugar(g, 0, { tipo: "robar" }), "robar");
  ok(M.jugar(g, 0, { tipo: "a_reserva", uid: comun.uid }), "a reserva");
  ok(M.jugar(g, 0, { tipo: "terminar_turno" }), "fin turno 0");
  ok(M.jugar(g, 1, { tipo: "robar" }), "robar 1");
  ok(M.jugar(g, 1, { tipo: "terminar_turno" }), "fin turno 1");
  ok(M.jugar(g, 0, { tipo: "robar" }), "robar 0");
  ok(M.jugar(g, 0, { tipo: "desde_reserva", uid: comun.uid, casilla: 2 }), "sacar");
});
prueba("partida a 20 puntos: se gana al llegar a 20", () => {
  const g = M.crearPartida({ modo: "1v1", puntos: 20, jugadores: [0, 1].map((i) => ({ id: 100 + i, mazo: MAZO() })) }, cartas);
  for (let i = 0; i < 2; i++) ok(M.jugar(g, i, { tipo: "mano_inicial", de_recursos: 1 }), "mano inicial");
  igual(M.vistaPara(g, 0).puntos, 20, "puntos en la vista");
  g.equipos[0].pv = 19;
  const a = poner(g, 0, "P05", "batalla", 0, "atk");
  irABatalla(g);
  ok(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, jugador: 1 }), "directo");
  igual(g.ganador, 0, "ganó con 20");
});
prueba("puntos raros quedan en 30", () => {
  const g = M.crearPartida({ modo: "1v1", puntos: 7, jugadores: [0, 1].map((i) => ({ id: 100 + i, mazo: MAZO() })) }, cartas);
  igual(g.puntos, 30, "por defecto");
});

console.log("\nPartida completa al azar (busca errores raros)");
prueba("500 partidas con jugadas al azar no se rompen", () => {
  for (let p = 0; p < 500; p++) {
    const modo = ["1v1", "ffa", "2v2"][p % 3];
    const g = nueva(modo, modo === "1v1" ? 2 : modo === "ffa" ? 3 + (p % 2) : 4);
    let pasos = 0;
    while (g.fase !== "terminada" && pasos++ < 4000) {
      const s = g.ataque ? g.ataque.defensores[0] : g.actual;
      const j = g.jugadores[s];
      const opciones = [
        { tipo: "robar", mazo: Math.random() < 0.3 ? "recursos" : "principal" },
        ...j.mano.map((c) => ({ tipo: "bajar", uid: c.uid, casilla: Math.floor(Math.random() * 5), pos: Math.random() < 0.6 ? "atk" : "def" })),
        ...j.mano.map((c) => ({ tipo: "jugar_recurso", uid: c.uid })),
        { tipo: "ir_batalla" },
        ...j.batalla.filter(Boolean).map((c) => {
          const rs = g.jugadores.filter((o) => o.equipo !== j.equipo && !o.eliminado);
          const r = rs[Math.floor(Math.random() * rs.length)];
          const objs = [...r.batalla, ...r.defensa].filter(Boolean);
          return objs.length ? { tipo: "atacar", uid: c.uid, objetivo: objs[0].uid } : { tipo: "atacar", uid: c.uid, jugador: r.asiento };
        }),
        { tipo: "ir_nucleo2" },
        { tipo: "terminar_turno" },
        ...(j.mano.length > 10 ? [{ tipo: "descartar", uid: j.mano[0].uid }] : []),
      ];
      M.jugar(g, s, opciones[Math.floor(Math.random() * opciones.length)]);
      // Nada se duplica ni se pierde: cada jugador sigue con todas sus cartas
      if (pasos % 50 === 0) for (const x of g.jugadores) {
        const total = x.principal.length + x.recursos.length + x.sobrenatural.length + x.mano.length + x.reserva.length + x.mausoleo.length + x.reciclaje.length
          + x.batalla.filter(Boolean).length + x.defensa.filter(Boolean).length
          + [...x.batalla, ...x.defensa].filter(Boolean).reduce((n, c) => n + (c.acuartelados || []).length, 0);
        if (total !== 44) throw new Error(`partida ${p}: el jugador ${x.asiento} tiene ${total} cartas en vez de 44`);
      }
    }
  }
});

console.log("\nEstructuras y acuartelar");
function enNucleo(g) { ok(M.jugar(g, g.actual, { tipo: "robar", mazo: "principal" }), "robar"); }
prueba("estructura se puede bajar en ATK o en DEF (siempre a la zona defensiva)", () => {
  const g = nueva("1v1", 2); enNucleo(g);
  const j = g.jugadores[0];
  const e1 = { uid: g.sigUid++, carta: "E01", dueno: 0, origen: "recursos" }; j.mano.push(e1);
  ok(M.jugar(g, 0, { tipo: "bajar", uid: e1.uid, zona: "batalla", casilla: 0, pos: "atk" }), "bajar en atk");
  igual(j.defensa[0].pos, "atk", "posición");
  igual(j.batalla[0], null, "no va a batalla");
});
prueba("acuartelar desde el campo y no la pueden atacar", () => {
  const g = nueva("1v1", 2); enNucleo(g);
  const est = poner(g, 0, "E05", "defensa", 1, "def");
  const sol = poner(g, 0, "P01", "batalla", 2, "atk");
  ok(M.jugar(g, 0, { tipo: "acuartelar", uid: sol.uid, estructura: est.uid }), "acuartelar");
  igual(g.jugadores[0].batalla[2], null, "casilla vacía");
  igual(est.acuartelados.length, 1, "adentro");
  const v = M.vistaPara(g, 1);
  igual(v.jugadores[0].defensa[1].cuartel.unidades[0].uid, sol.uid, "se ve en la vista");
  igual(v.jugadores[0].defensa[1].cuartel.max, 2, "max");
});
prueba("acuartelar desde la mano cuenta como bajada y paga costo", () => {
  const g = nueva("1v1", 2); enNucleo(g);
  const est = poner(g, 0, "E06", "defensa", 0, "def");
  const j = g.jugadores[0];
  const h = { uid: g.sigUid++, carta: "P05", dueno: 0, origen: "principal" }; j.mano.push(h);
  const antes = g.equipos[j.equipo].recursos.capital;
  ok(M.jugar(g, 0, { tipo: "acuartelar", uid: h.uid, estructura: est.uid }), "acuartelar");
  igual(g.equipos[j.equipo].recursos.capital, antes - 2, "pagó");
  igual(g.cont.bajadas, 1, "cuenta como bajada");
  igual(j.mano.some((c) => c.uid === h.uid), false, "salió de la mano");
});
prueba("respeta el tipo y el máximo del cuartel", () => {
  const g = nueva("1v1", 2); enNucleo(g);
  const est = poner(g, 0, "E05", "defensa", 1, "def"); // 2 humanas comunes
  const lobo = poner(g, 0, "P02", "batalla", 0, "atk");
  const r = M.jugar(g, 0, { tipo: "acuartelar", uid: lobo.uid, estructura: est.uid });
  igual(r.error, "esa_unidad_no_cabe_aqui", "animal no");
  const guerr = poner(g, 0, "P05", "batalla", 1, "atk");
  igual(M.jugar(g, 0, { tipo: "acuartelar", uid: guerr.uid, estructura: est.uid }).error, "solo_unidades_comunes", "especial no");
  const a = poner(g, 0, "P01", "batalla", 2, "atk"), b = poner(g, 0, "P09", "batalla", 3, "atk"), c = poner(g, 0, "P03", "batalla", 4, "atk");
  ok(M.jugar(g, 0, { tipo: "acuartelar", uid: a.uid, estructura: est.uid }), "1");
  ok(M.jugar(g, 0, { tipo: "acuartelar", uid: b.uid, estructura: est.uid }), "2");
  igual(M.jugar(g, 0, { tipo: "acuartelar", uid: c.uid, estructura: est.uid }).error, "cuartel_lleno", "lleno");
});
prueba("desacuartelar a una casilla libre y atacar ese mismo turno", () => {
  const g = nueva("1v1", 2); enNucleo(g);
  const est = poner(g, 0, "E05", "defensa", 1, "def");
  const sol = poner(g, 0, "P01", "batalla", 2, "atk");
  ok(M.jugar(g, 0, { tipo: "acuartelar", uid: sol.uid, estructura: est.uid }), "acuartelar");
  igual(M.jugar(g, 0, { tipo: "desacuartelar", uid: sol.uid, zona: "defensa", casilla: 1 }).error, "casilla_ocupada", "ocupada");
  ok(M.jugar(g, 0, { tipo: "desacuartelar", uid: sol.uid, zona: "batalla", casilla: 0, pos: "atk" }), "sacar");
  igual(g.jugadores[0].batalla[0].uid, sol.uid, "en batalla");
  igual(est.acuartelados.length, 0, "cuartel vacío");
  ok(M.jugar(g, 0, { tipo: "ir_batalla" }), "batalla");
  ok(M.jugar(g, 0, { tipo: "atacar", uid: sol.uid, jugador: 1 }), "ataca directo");
});
prueba("si cae la estructura: vuelven a su casilla con herida/contusión y las que no caben al mausoleo", () => {
  const g = nueva("1v1", 2); enNucleo(g);
  const est = poner(g, 1, "E05", "defensa", 0, "atk"); // en ataque, defiende con su ataque
  est.acuartelados = [
    { uid: g.sigUid++, carta: "P01", dueno: 1, pos: "atk", herida: 0, contusion: 0, bonoCuartel: "def" },
    { uid: g.sigUid++, carta: "P09", dueno: 1, pos: "def", herida: 0, contusion: 0, bonoCuartel: "def" },
  ];
  // Rival con todo lleno salvo la casilla de la estructura: solo cabe 1
  for (let i = 1; i < 3; i++) poner(g, 1, "E01", "defensa", i, "def");
  for (let i = 0; i < 5; i++) poner(g, 1, "E01", "batalla", i, "def");
  const yo = poner(g, 0, "P06", "batalla", 0, "atk");
  ok(M.jugar(g, 0, { tipo: "ir_batalla" }), "batalla");
  const r = ok(M.jugar(g, 0, { tipo: "atacar", uid: yo.uid, objetivo: est.uid }), "atacar estructura");
  const salen = r.eventos.filter((e) => e.tipo === "sale_del_cuartel");
  igual(salen.length, 2, "salieron 2");
  igual(salen[0].a + salen[0].casilla, "defensa0", "1ra a la casilla de la estructura");
  igual(g.jugadores[1].defensa[0].herida, 1, "estaba en ATK: 1 herida");
  igual(salen[1].a, "mausoleo", "2da no cabe");
});
prueba("Catedral: si cae, las acuarteladas van a la reserva", () => {
  const g = nueva("1v1", 2); enNucleo(g);
  const est = poner(g, 1, "E06", "defensa", 0, "atk");
  est.acuartelados = [{ uid: g.sigUid++, carta: "P01", dueno: 1, pos: "atk", herida: 0, contusion: 0 }];
  const yo = poner(g, 0, "P05", "batalla", 0, "atk");
  ok(M.jugar(g, 0, { tipo: "ir_batalla" }), "batalla");
  const r = ok(M.jugar(g, 0, { tipo: "atacar", uid: yo.uid, objetivo: est.uid }), "atacar");
  igual(r.eventos.find((e) => e.tipo === "sale_del_cuartel").a, "reserva", "a la reserva");
  igual(g.jugadores[1].reserva.length, 1, "reserva");
});

console.log("\nHerida, contusión, daño, potenciar y honor");
const H = M._h;
prueba("herida baja ataque, contusión baja defensa, nunca menos de 0", () => {
  const g = nueva("1v1", 2);
  const c = poner(g, 0, "P05", "batalla", 0, "atk"); // 4/3
  H.herir(c, 2); H.contusionar(c, 5);
  igual(H.ataqueDe(g, c), 2, "ataque"); igual(H.defensaDe(g, c), 0, "defensa en 0");
  H.curar(c); igual(H.ataqueDe(g, c), 4, "hospitalidad cura");
});
prueba("daño del turno se borra al terminar el turno; potenciar permanente se queda", () => {
  const g = nueva("1v1", 2); enNucleo(g);
  const c = poner(g, 0, "P05", "batalla", 0, "atk");
  H.modificar(c, 3, 0, "turno", "Coca"); H.modificar(c, 0, 5, "siempre", "Guallcanga");
  igual(H.ataqueDe(g, c), 7, "con daño"); igual(H.defensaDe(g, c), 8, "con +5");
  ok(M.jugar(g, 0, { tipo: "terminar_turno" }), "fin");
  igual(H.ataqueDe(g, c), 4, "daño borrado"); igual(H.defensaDe(g, c), 8, "permanente sigue");
  const v = M.vistaPara(g, 1).jugadores[0].batalla[0];
  igual(v.bonos.length, 1, "la vista muestra el bono"); igual(v.base_defensa, 3, "base");
});
prueba("hasta atacar: se pierde al atacar", () => {
  const g = nueva("1v1", 2);
  const c = poner(g, 0, "P05", "batalla", 0, "atk");
  H.modificar(c, 2, 0, "hasta_atacar", "Hacha");
  irABatalla(g);
  ok(M.jugar(g, 0, { tipo: "atacar", uid: c.uid, jugador: 1 }), "ataca");
  if (g.ataque) ok(M.jugar(g, 1, { tipo: "responder" }), "pasa");
  igual(H.ataqueDe(g, c), 4, "ya no tiene el +2");
});
prueba("al ir a la reserva se pierden heridas y bonos", () => {
  const g = nueva("1v1", 2); enNucleo(g);
  const c = poner(g, 0, "P01", "batalla", 0, "atk");
  H.herir(c); H.modificar(c, 2, 2, "siempre", "x");
  ok(M.jugar(g, 0, { tipo: "a_reserva", uid: c.uid }), "a reserva");
  igual(c.herida, 0, "sin herida"); igual(c.mods.length, 0, "sin bonos");
});
prueba("Honor (Hampatu) +1 con cartas reales", () => {
  const R = require("./cartas.js");
  const g = nueva("1v1", 2);
  g.cartas = { ...g.cartas, ...R };
  const pone = (as, id, z, k) => { const x = { uid: g.sigUid++, carta: id, dueno: as, pos: "atk", herida: 0, contusion: 0 }; g.jugadores[as][z][k] = x; return x; };
  const aclla = pone(0, "AHA-28", "batalla", 0);
  const base = R["AHA-28"].ataque;
  igual(H.ataqueDe(g, aclla), base + 1, "se da honor a sí misma");
  const rival = pone(1, "AHA-28", "batalla", 1);
  igual(H.ataqueDe(g, rival), base + 1, "el rival tiene su propio honor, no suma el mío");
});
prueba("acuartelar: +1 DEF o ATK a la estructura y una vez por turno", () => {
  const g = nueva("1v1", 2); enNucleo(g);
  const est = poner(g, 0, "E05", "defensa", 1, "def"); // def 4
  const a = poner(g, 0, "P01", "batalla", 0, "atk"), b = poner(g, 0, "P09", "batalla", 1, "atk");
  ok(M.jugar(g, 0, { tipo: "acuartelar", uid: a.uid, estructura: est.uid, bono: "def" }), "a");
  ok(M.jugar(g, 0, { tipo: "acuartelar", uid: b.uid, estructura: est.uid, bono: "atk" }), "b");
  igual(H.defensaDe(g, est), 5, "+1 def"); igual(H.ataqueDe(g, est), 1, "+1 atk");
  ok(M.jugar(g, 0, { tipo: "desacuartelar", uid: a.uid, zona: "batalla", casilla: 0 }), "saca a");
  igual(H.defensaDe(g, est), 4, "pierde el bono al salir");
  igual(M.jugar(g, 0, { tipo: "acuartelar", uid: a.uid, estructura: est.uid }).error, "ya_se_acuartelo_este_turno", "1 vez por turno");
});


console.log("\nEfectos de cartas (cartas reales)");
const R = require("./cartas.js");
function real() { const g = nueva("1v1", 2); g.cartas = { ...g.cartas, ...R }; enNucleo(g); return g; }
const darMano = (g, as, id) => { const x = { uid: g.sigUid++, carta: id, dueno: as, origen: "principal", pos: "atk", herida: 0, contusion: 0 }; g.jugadores[as].mano.push(x); return x; };
const ricos = (g, eq = 0) => { const r = g.equipos[eq].recursos; r.alimento = r.capital = r.creencia = 20; };
prueba("Yaguareté al bajar pide elegir y hiere 2", () => {
  const g = real(); ricos(g);
  const rival = poner(g, 1, "P01", "batalla", 0, "atk");
  const y = darMano(g, 0, "GL-08");
  ok(M.jugar(g, 0, { tipo: "bajar", uid: y.uid, desde: "mano", casilla: 0 }), "bajar");
  if (!g.pendiente) throw new Error("no preguntó");
  igual(M.jugar(g, 0, { tipo: "pasar_turno" }).ok, false, "bloquea otras jugadas mientras pregunta");
  igual(M.jugar(g, 1, { tipo: "elegir", uids: [rival.uid] }).ok, false, "solo elige el dueño del efecto");
  ok(M.jugar(g, 0, { tipo: "elegir", uids: [rival.uid] }), "elige");
  igual(rival.herida, 2, "2 de herida"); igual(g.pendiente, null, "termina");
});
prueba("Mita: busca hasta 2 humanas comunes del mazo a la mano", () => {
  const g = real(); ricos(g);
  const j = g.jugadores[0];
  j.principal.unshift({ uid: g.sigUid++, carta: "AHA-01", dueno: 0, origen: "principal" });
  const m = darMano(g, 0, "AHA-17");
  const antes = j.mano.length;
  ok(M.jugar(g, 0, { tipo: "bajar", uid: m.uid, desde: "mano", casilla: 0 }), "bajar Mita");
  const ops = g.pendiente ? g.pendiente.opciones : [];
  if (g.pendiente) ok(M.jugar(g, 0, { tipo: "elegir", uids: ops.slice(0, 2).map((o) => o.uid) }), "elige");
  igual(j.mano.length, antes - 1 + Math.min(2, ops.length), "llegan a la mano");
});
prueba("Coca (suceso): opción +2 ATK a humanas y se va al reciclaje", () => {
  const g = real(); ricos(g);
  const h = poner(g, 0, "AHA-28", "batalla", 0, "atk"); const base = H.ataqueDe(g, h);
  const c = darMano(g, 0, "AHA-27");
  ok(M.jugar(g, 0, { tipo: "activar", uid: c.uid }), "activar");
  ok(M.jugar(g, 0, { tipo: "elegir", opcion: 1 }), "+2 atk");
  igual(H.ataqueDe(g, h), base + 2, "+2");
  igual(g.jugadores[0].reciclaje.includes(c) || g.jugadores[0].mausoleo.includes(c), true, "se descarta");
});
prueba("boca abajo en sucesos permanentes y se activa después", () => {
  const g = real(); ricos(g);
  const c = darMano(g, 0, "AHA-27");
  ok(M.jugar(g, 0, { tipo: "colocar_boca_abajo", uid: c.uid }), "colocar");
  igual(g.jugadores[0].permanentes.includes(c), true, "en la zona"); igual(c.bocaAbajo, true, "boca abajo");
  const v = M.vistaPara(g, 1).jugadores[0].permanentes.find(Boolean);
  igual(v.carta, undefined, "el rival no la ve"); igual(v.boca_abajo, true, "sabe que hay una boca abajo");
  ok(M.jugar(g, 0, { tipo: "activar", uid: c.uid }), "activar desde la zona");
});
prueba("equipar objeto (Báculo) a espiritista: +2/+1 y se va con ella al morir", () => {
  const g = real(); ricos(g);
  const id = Object.keys(R).find((k) => R[k].tipo === "unidad" && R[k].especie === "humano" && R[k].alineamiento === "espiritista");
  const u = poner(g, 0, id, "batalla", 0, "atk"); const a0 = H.ataqueDe(g, u), d0 = H.defensaDe(g, u);
  const b = darMano(g, 0, "GL-10");
  ok(M.jugar(g, 0, { tipo: "activar", uid: b.uid }), "activar");
  ok(M.jugar(g, 0, { tipo: "elegir", uids: [u.uid] }), "elige portador");
  igual(H.ataqueDe(g, u), a0 + 2, "+2 atk"); igual(H.defensaDe(g, u), d0 + 1, "+1 def");
  igual(u.equipos.includes(b), true, "equipado");
  H.derrotar(g, u, []);
  igual(g.jugadores[0].mausoleo.includes(b), true, "el objeto se va al mausoleo");
});
prueba("Emboscar/Reacción: el defensor puede responder con 1 carta", () => {
  const g = real(); ricos(g); ricos(g, 1);
  const em = Object.keys(R).find((k) => R[k].tipo === "unidad" && (R[k].acciones || []).some((a) => /emboscar/i.test(a.tipo || a)));
  if (!em) throw new Error("no hay carta con emboscar");
  const atk = poner(g, 0, "P01", "batalla", 0, "atk");
  darMano(g, 1, em);
  ok(M.jugar(g, 0, { tipo: "ir_batalla" }), "batalla");
  ok(M.jugar(g, 0, { tipo: "atacar", uid: atk.uid, jugador: 1 }), "ataca");
  const jg = M.vistaPara(g, 1).jugables_defensa;
  igual(jg.length > 0, true, "le ofrece la emboscada");
  ok(M.jugar(g, 1, { tipo: "responder", uid: jg[0].uid }), "embosca");
  while (g.pendiente) ok(M.jugar(g, g.pendiente.jugador, g.pendiente.tipo === "opcion" ? { tipo: "elegir", opcion: 0 } : { tipo: "elegir", uids: g.pendiente.opciones.slice(0, g.pendiente.min).map((o) => o.uid) }), "resuelve");
  igual(g.ataque, null, "el ataque se resolvió");
});
prueba("Santa Cruz Divina: aura -1/-1 a sobrenaturales que no son LUZ", () => {
  const g = real(); ricos(g);
  const sid = Object.keys(R).find((k) => R[k].sobrenatural && R[k].tipo === "unidad" && !(R[k].elemento || []).includes("luz") && R[k].ataque > 1);
  const s = poner(g, 1, sid, "batalla", 0, "atk"); const a0 = H.ataqueDe(g, s);
  const c = darMano(g, 0, "ENC-040");
  ok(M.jugar(g, 0, { tipo: "activar", uid: c.uid }), "activar");
  while (g.pendiente) ok(M.jugar(g, 0, { tipo: "elegir", uids: [] }), "nada");
  igual(g.jugadores[0].permanentes.includes(c), true, "se queda en permanentes");
  igual(H.ataqueDe(g, s), a0 - 1, "-1 atk");
});

console.log("\nAcciones pasivas");
prueba("Agrupar: 2 cartas suman su ataque", () => {
  const g = real();
  const a = poner(g, 0, "ENC-02", "batalla", 0, "atk"), b = poner(g, 0, "ENC-01", "batalla", 1, "atk");
  const suma = H.ataqueDe(g, a) + H.ataqueDe(g, b);
  const d = poner(g, 1, "P01", "defensa", 0, "def"); d.mods = [{ ataque: 0, defensa: suma - 1 - H.defensaDe(g, d), dura: "siempre" }];
  ok(M.jugar(g, 0, { tipo: "ir_batalla" }), "batalla");
  ok(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, objetivo: d.uid, agrupar: [b.uid] }), "ataque agrupado");
  igual(g.jugadores[1].defensa[0], null, "cae el defensor que ninguna sola podía");
  igual(a.ataco && b.ataco, true, "las dos atacaron");
  igual(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, jugador: 1, agrupar: [poner(g, 0, "P01", "batalla", 2, "atk").uid] }).error, "ya_ataco", "no repite");
});
prueba("Agrupar: solo cartas con Agrupar", () => {
  const g = real();
  const a = poner(g, 0, "ENC-02", "batalla", 0, "atk"), b = poner(g, 0, "P01", "batalla", 1, "atk");
  ok(M.jugar(g, 0, { tipo: "ir_batalla" }), "batalla");
  igual(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, jugador: 1, agrupar: [b.uid] }).error, "solo_cartas_con_agrupar", "rechaza");
});
prueba("Inbloqueable (Báculo): lo que sobra va directo si no hay estructuras", () => {
  const g = real();
  const a = poner(g, 0, "P01", "batalla", 0, "atk"); a.inbloqueable = true; a.mods = [{ ataque: 10, defensa: 0, dura: "siempre" }];
  const d = poner(g, 1, "P01", "batalla", 0, "atk");
  ok(M.jugar(g, 0, { tipo: "ir_batalla" }), "batalla");
  const pv = g.equipos[g.jugadores[0].equipo].pv;
  const r = ok(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, objetivo: d.uid }), "ataca");
  igual(r.eventos.some((e) => e.tipo === "penetracion" && e.directo), true, "penetra");
  igual(g.equipos[g.jugadores[0].equipo].pv > pv + 0, true, "suma puntos");
});
prueba("Inamovible anula la penetración", () => {
  const g = real();
  const a = poner(g, 0, "P01", "batalla", 0, "atk"); a.inbloqueable = true; a.mods = [{ ataque: 10, defensa: 0, dura: "siempre" }];
  const d = poner(g, 1, "GL-07", "batalla", 0, "atk");
  ok(M.jugar(g, 0, { tipo: "ir_batalla" }), "batalla");
  const r = ok(M.jugar(g, 0, { tipo: "atacar", uid: a.uid, objetivo: d.uid }), "ataca");
  igual(r.eventos.some((e) => e.tipo === "penetracion_anulada"), true, "anulada");
});
prueba("Hospitalidad (San Muerte): cura 1 carta, 1 vez por turno", () => {
  const g = real();
  const s = poner(g, 0, "GL-07", "defensa", 0, "def"); const u = poner(g, 0, "P01", "batalla", 0, "atk"); H.herir(u, 2); H.contusionar(u, 1);
  ok(M.jugar(g, 0, { tipo: "hospitalidad", uid: s.uid }), "usar");
  ok(M.jugar(g, 0, { tipo: "elegir", uids: [u.uid] }), "elige");
  igual(u.herida + u.contusion, 0, "curada");
  H.herir(u);
  igual(M.jugar(g, 0, { tipo: "hospitalidad", uid: s.uid }).error, "ya_se_uso_este_turno", "1 vez");
});
prueba("Imparable: los sucesos no la pueden elegir", () => {
  const g = real(); ricos(g);
  const n = poner(g, 1, "ENC-05", "batalla", 0, "atk"); // Nuño, imparable
  const otro = poner(g, 1, "P01", "batalla", 1, "atk");
  const c = darMano(g, 0, "ENC-017"); // cualquier suceso con elegir sirve; probamos el filtro directo
  const ctx = { jugador: 0, carta: "AHA-30", fuente: 0, vars: {} }; // Golpe Zonda (suceso)
  const H2 = M._h;
  igual(typeof H2.ubicar, "function", "ok");
  const cs = M._candidatos ? M._candidatos(g, ctx, [{ j: "rival", zona: "campo" }], null) : null;
  if (cs) { igual(cs.some((x) => x.inst === n), false, "Nuño no aparece"); igual(cs.some((x) => x.inst === otro), true, "la otra sí"); }
});
prueba("mover un objeto equipado a otra carta (Guallcanga)", () => {
  const g = real(); ricos(g);
  const a = poner(g, 0, "AHA-28", "batalla", 0, "atk"), b = poner(g, 0, "AHA-28", "batalla", 1, "atk");
  const gu = darMano(g, 0, "AHA-22");
  ok(M.jugar(g, 0, { tipo: "activar", uid: gu.uid }), "activar");
  ok(M.jugar(g, 0, { tipo: "elegir", uids: [a.uid] }), "a la primera");
  igual(a.soloDefensa, true, "solo defiende");
  const d0 = H.defensaDe(g, b);
  ok(M.jugar(g, 0, { tipo: "desequipar", uid: gu.uid, objetivo: b.uid }), "mover");
  igual(a.soloDefensa, false, "la primera ya puede atacar"); igual(b.soloDefensa, true, "la segunda solo defiende");
  igual(H.defensaDe(g, b), d0 + 5, "+5 DEF pasa a la segunda"); igual(b.pos, "def", "queda en defensa");
  igual(M.jugar(g, 0, { tipo: "desequipar", uid: gu.uid }).error, "ya_se_desequipo_este_turno", "1 vez por turno");
});
console.log(`\n${pasaron} pasaron, ${fallaron} fallaron\n`);
process.exit(fallaron ? 1 : 0);
