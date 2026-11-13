/*
 * AHSPAI - Motor de reglas (corre en el servidor, dentro de Orbita)
 *
 * No sabe nada de internet: solo recibe jugadas y dice si se valen.
 *   crearPartida(config, cartas)      -> partida nueva
 *   jugar(partida, asiento, accion)   -> { ok, error, eventos }
 *   vistaPara(partida, asiento)       -> lo que ESE jugador puede ver (sin manos ni mazos ajenos)
 *
 * Modos: "1v1", "ffa" (3 o 4, todos contra todos), "2v2" (equipos, comparten recursos y puntos).
 */
"use strict";
const crypto = require("crypto");

// ------------------------------------------------------------------
// Reglas fijas del libro
// ------------------------------------------------------------------
const REGLAS = {
  puntosParaGanar: 30,
  manoInicial: 5,
  limiteMano: 10,
  bajadasPorTurno: 2,
  mulligansPorTurno: 3,
  retiradasPorTurno: 3,
  desdeReservaPorTurno: 3,
  recursosIniciales: { alimento: 4, capital: 4, creencia: 4 },
  casillas: { batalla: 5, defensa: 3, permanentes: 2 },
  mazos: {
    principal: [30, 60],
    sobrenatural: [2, 12],
    recursos: [8, 12],
  },
  copias: { peon: 4, belico: 3, heroe: 3, lider: 1, sobrenatural: 2, estructura: 3 },
};
const RECURSOS = ["alimento", "capital", "creencia"];

// ------------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------------
function barajar(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
const mal = (error) => ({ ok: false, error, eventos: [] });

function carta(g, inst) {
  return g.cartas[inst.carta];
}
// ------------------------------------------------------------------
// Valores de ataque y defensa (reglamento: "Puntos de aplicación")
//   Herida: -1 ATK permanente y acumulable.  Contusión: -1 DEF permanente y acumulable.
//   Daño / potenciar / disminuir: modificadores en inst.mods
//     { ataque, defensa, dura: "turno" | "siempre" | "hasta_atacar", texto, desde }
//     "turno" = se borra al terminar el turno (el Daño del reglamento)
//   Honor (Nombre) +N: todas TUS cartas en tablero con ese nombre ganan +N de ATK y DEF.
//   Acuartelar: la estructura gana +1 ATK o +1 DEF por cada unidad adentro (lo elige el dueño).
//   Nunca baja de 0 (las cartas no mueren por herida o contusión).
// ------------------------------------------------------------------
function bonos(g, inst) {
  const lista = [];
  for (const m of inst.mods || []) lista.push({ ataque: m.ataque || 0, defensa: m.defensa || 0, texto: m.texto || "", dura: m.dura || "siempre" });
  // Honor de las cartas del mismo tablero
  const j = duenoEnTablero(g, inst);
  if (j) {
    const nombre = String(carta(g, inst).nombre || "").toLowerCase();
    for (const h of cartasEnTablero(j)) {
      const ch = carta(g, h);
      if (!(ch.acciones || []).includes("honor") || !ch.honor) continue;
      if (!nombre.includes(String(ch.honor).toLowerCase())) continue;
      const m = /honor\s*\([^)]*\)\s*\+\s*(\d+)/i.exec(ch.efecto || "");
      const n = m ? Number(m[1]) : 1;
      lista.push({ ataque: n, defensa: n, texto: `Honor (${ch.honor})`, dura: "aura" });
    }
  }
  // Unidades acuarteladas: +1 ATK o +1 DEF cada una
  for (const u of inst.acuartelados || []) {
    lista.push(u.bonoCuartel === "atk" ? { ataque: 1, defensa: 0, texto: "Acuartelada", dura: "aura" } : { ataque: 0, defensa: 1, texto: "Acuartelada", dura: "aura" });
  }
  return lista;
}
function ataqueDe(g, inst) {
  const b = bonos(g, inst).reduce((n, x) => n + x.ataque, 0);
  return Math.max(0, (carta(g, inst).ataque || 0) + b - (inst.herida || 0));
}
function defensaDe(g, inst) {
  const b = bonos(g, inst).reduce((n, x) => n + x.defensa, 0);
  return Math.max(0, (carta(g, inst).defensa || 0) + b - (inst.contusion || 0));
}
// Herramientas para los efectos de las cartas
function herir(inst, n = 1) { inst.herida = (inst.herida || 0) + n; }
function contusionar(inst, n = 1) { inst.contusion = (inst.contusion || 0) + n; }
function curar(inst) { inst.herida = 0; inst.contusion = 0; } // Hospitalidad
function modificar(inst, ataque, defensa, dura, texto, desde) {
  if (!Array.isArray(inst.mods)) inst.mods = [];
  inst.mods.push({ ataque: ataque || 0, defensa: defensa || 0, dura: dura || "siempre", texto: texto || "", desde: desde || "" });
}
function quitarMods(inst, filtro) { if (Array.isArray(inst.mods)) inst.mods = inst.mods.filter((m) => !filtro(m)); }
// Todas las cartas de un tablero (también las acuarteladas, que cuentan como "en tablero")
function cartasEnTablero(j) {
  const out = [];
  for (const c of [...j.batalla, ...j.defensa]) if (c) { out.push(c); for (const u of c.acuartelados || []) out.push(u); }
  return out;
}
function duenoEnTablero(g, inst) {
  for (const j of g.jugadores) if (cartasEnTablero(j).includes(inst)) return j;
  return null;
}
function tieneAccion(g, inst, nombre) {
  return (carta(g, inst).acciones || []).includes(nombre);
}

// ------------------------------------------------------------------
// Validar un mazo
// ------------------------------------------------------------------
function validarMazo(mazo, cartas) {
  for (const nombre of ["principal", "sobrenatural", "recursos"]) {
    const lista = mazo[nombre] || [];
    const [min, max] = REGLAS.mazos[nombre];
    if (lista.length < min || lista.length > max) return `mazo_${nombre}_${lista.length}_debe_ser_${min}_a_${max}`;
    for (const id of lista) if (!cartas[id]) return `carta_no_existe_${id}`;
  }
  // El mazo de recursos solo lleva estructuras; el sobrenatural solo unidades sobrenaturales
  for (const id of mazo.recursos) if (cartas[id].tipo !== "estructura") return `en_recursos_solo_estructuras_${id}`;
  for (const id of mazo.sobrenatural) if (!cartas[id].sobrenatural) return `en_sobrenatural_solo_sobrenaturales_${id}`;
  for (const id of mazo.principal) {
    const c = cartas[id];
    if (c.tipo === "estructura" || c.sobrenatural) return `no_va_en_principal_${id}`;
  }
  // Copias
  const cuenta = {};
  for (const id of [...mazo.principal, ...mazo.sobrenatural, ...mazo.recursos]) cuenta[id] = (cuenta[id] || 0) + 1;
  for (const [id, n] of Object.entries(cuenta)) {
    const c = cartas[id];
    const tipoCopia = c.sobrenatural ? "sobrenatural" : c.tipo === "estructura" ? "estructura" : c.alineamiento;
    const max = REGLAS.copias[tipoCopia];
    if (max !== undefined && n > max) return `demasiadas_copias_${id}_${n}_max_${max}`;
  }
  return null;
}

// ------------------------------------------------------------------
// Crear partida
// ------------------------------------------------------------------
// config = { modo, jugadores: [{ id, mazo: { principal, sobrenatural, recursos } }] }
function crearPartida(config, cartas) {
  const modo = config.modo;
  const n = config.jugadores.length;
  if (modo === "1v1" && n !== 2) throw new Error("1v1 necesita 2 jugadores");
  if (modo === "ffa" && (n < 3 || n > 4)) throw new Error("ffa necesita 3 o 4 jugadores");
  if (modo === "2v2" && n !== 4) throw new Error("2v2 necesita 4 jugadores");

  const g = {
    modo,
    cartas,
    fase: "mano_inicial", // mano_inicial -> jugando -> terminada
    turno: 0,
    actual: 0,
    etapa: "",            // robo -> nucleo1 -> batalla -> nucleo2
    jugadores: [],
    equipos: {},
    cont: null,
    ataque: null,         // ataque esperando respuesta del defensor
    ganador: null,        // número de equipo
    puntos: [16, 20, 25, 30].includes(Number(config.puntos)) ? Number(config.puntos) : REGLAS.puntosParaGanar, // puntos para ganar
    sigUid: 1,
  };

  config.jugadores.forEach((j, asiento) => {
    const error = validarMazo(j.mazo, cartas);
    if (error) throw new Error(`Mazo inválido del jugador ${j.id}: ${error}`);
    // En 2v2 los equipos son asiento 0+2 y 1+3 (igual que orb_slot() mod 2) y así los turnos se alternan
    const equipo = modo === "2v2" ? asiento % 2 : asiento;
    const nuevas = (lista, origen) => barajar(lista.map((id) => ({
      uid: g.sigUid++, carta: id, dueno: asiento, origen,
      pos: "atk", herida: 0, contusion: 0, ataco: false, salioDeReserva: false,
    })));
    g.jugadores.push({
      id: j.id, asiento, equipo,
      principal: nuevas(j.mazo.principal, "principal"),
      recursos: nuevas(j.mazo.recursos, "recursos"),
      sobrenatural: nuevas(j.mazo.sobrenatural, "sobrenatural"), // boca arriba, se elige de aquí
      mano: [],
      batalla: Array(REGLAS.casillas.batalla).fill(null),
      defensa: Array(REGLAS.casillas.defensa).fill(null),
      permanentes: Array(REGLAS.casillas.permanentes).fill(null),
      reserva: [], mausoleo: [], reciclaje: [],
      listo: false, eliminado: false,
    });
    if (!g.equipos[equipo]) g.equipos[equipo] = { pv: 0, recursos: { ...REGLAS.recursosIniciales } };
  });
  return g;
}

// ------------------------------------------------------------------
// Buscar cartas
// ------------------------------------------------------------------
function buscarEnCampo(g, uid) {
  for (const j of g.jugadores) {
    for (const zona of ["batalla", "defensa"]) {
      const i = j[zona].findIndex((c) => c && c.uid === uid);
      if (i >= 0) return { jug: j, zona, casilla: i, inst: j[zona][i] };
    }
  }
  return null;
}
// ------------------------------------------------------------------
// Acuartelar: unidades guardadas dentro de una estructura
// "2 Unid. humana común" → hasta 2, humanas, clase común. También: animales, sobrenaturales, espiritista.
// Adentro no atacan ni las pueden atacar; al salir pueden atacar ese mismo turno.
// ------------------------------------------------------------------
function reglaCuartel(c) {
  const t = String((c && c.acuartelar) || "").toLowerCase();
  if (!t) return null;
  const max = parseInt(t, 10) || 0;
  if (max <= 0) return null;
  const especies = [];
  if (/human/.test(t)) especies.push("humano");
  if (/animal/.test(t)) especies.push("animal");
  if (/sobrenatural/.test(t)) especies.push("sobrenatural");
  return { max, especies, comun: /com[uú]n/.test(t), espiritista: /espiritista/.test(t) };
}
// null si la unidad cabe en ese cuartel; si no, el motivo
function motivoNoCabe(regla, c) {
  if (c.tipo !== "unidad") return "solo_unidades_se_acuartelan";
  const especie = c.sobrenatural ? "sobrenatural" : c.especie;
  if (regla.especies.length && !regla.especies.includes(especie)) return "esa_unidad_no_cabe_aqui";
  if (regla.comun && c.clase !== "comun") return "solo_unidades_comunes";
  if (regla.espiritista && c.alineamiento !== "espiritista") return "solo_unidades_espiritistas";
  return null;
}
// Busca una unidad acuartelada de un jugador
function buscarEnCuartel(j, uid) {
  for (const zona of ["batalla", "defensa"]) for (const est of j[zona]) {
    if (!est || !Array.isArray(est.acuartelados)) continue;
    const i = est.acuartelados.findIndex((c) => c.uid === uid);
    if (i >= 0) return { est, i, inst: est.acuartelados[i] };
  }
  return null;
}
function campoVacio(j) {
  return j.batalla.every((c) => !c) && j.defensa.every((c) => !c);
}
// Cartas en el campo de un jugador de cierto tipo ("unidad" o "estructura")
function enCampo(g, j, tipo) {
  return [...j.batalla, ...j.defensa].filter((c) => c && carta(g, c).tipo === tipo);
}
// ¿Se puede atacar directo a este rival? Normal: campo vacío. Demoledor: basta con que no tenga estructuras.
// Unidades del rival en su zona de batalla (son las que bloquean atacar estructuras o directo)
function unidadesEnBatalla(g, j) {
  return j.batalla.filter((c) => c && carta(g, c).tipo === "unidad");
}
function puedeAtacarDirecto(g, rival, demoledor) {
  const sinEstructuras = enCampo(g, rival, "estructura").length === 0;
  // Demoledor: basta con que no tenga estructuras. Normal: sin unidades en batalla y sin estructuras.
  return demoledor ? sinEstructuras : (sinEstructuras && unidadesEnBatalla(g, rival).length === 0);
}
function rivales(g, j) {
  return g.jugadores.filter((o) => o.equipo !== j.equipo && !o.eliminado);
}
function sacarDe(lista, uid) {
  const i = lista.findIndex((c) => c.uid === uid);
  return i >= 0 ? lista.splice(i, 1)[0] : null;
}
function limpiarInst(inst) {
  inst.herida = 0; inst.contusion = 0; inst.ataco = false; inst.salioDeReserva = false; inst.cambioPos = false; inst.pos = "atk";
  inst.mods = []; // al salir del tablero se pierden potenciadores y disminuciones
}

// ------------------------------------------------------------------
// Puntos y fin de partida
// ------------------------------------------------------------------
function darPuntos(g, equipo, cantidad, ev, motivo) {
  if (cantidad <= 0 || g.fase === "terminada") return;
  g.equipos[equipo].pv += cantidad;
  ev.push({ tipo: "puntos", equipo, cantidad, total: g.equipos[equipo].pv, motivo });
  if (g.equipos[equipo].pv >= g.puntos) terminar(g, equipo, ev, "puntos");
}
function terminar(g, equipo, ev, motivo) {
  if (g.fase === "terminada") return;
  g.fase = "terminada";
  g.ganador = equipo;
  ev.push({ tipo: "fin", ganador: equipo, motivo });
}
function revisarSobrevivientes(g, ev) {
  const vivos = new Set(g.jugadores.filter((j) => !j.eliminado).map((j) => j.equipo));
  if (vivos.size === 1) terminar(g, [...vivos][0], ev, "ultimo_en_pie");
}
function eliminar(g, j, ev, motivo) {
  if (j.eliminado) return;
  j.eliminado = true;
  ev.push({ tipo: "eliminado", jugador: j.asiento, motivo });
  revisarSobrevivientes(g, ev);
}

function derrotar(g, inst, ev, equipoQueGana) {
  const lugar = buscarEnCampo(g, inst.uid);
  if (!lugar) return;
  lugar.jug[lugar.zona][lugar.casilla] = null;
  limpiarInst(inst);
  lugar.jug.mausoleo.push(inst);
  ev.push({ tipo: "derrotada", uid: inst.uid, carta: inst.carta, jugador: lugar.jug.asiento });
  // Estructura con unidades acuarteladas (reglamento): vuelven al tablero en la casilla de la estructura
  // (y si no caben, en otras casillas libres) con 1 Herida si estaban en ATK o 1 Contusión si en DEF.
  // Las que no quepan van al Mausoleo. Santa Catedral: las manda a la reserva.
  const dentro = Array.isArray(inst.acuartelados) ? inst.acuartelados : [];
  inst.acuartelados = [];
  const aReserva = /acuarteladas se env[ií]an al mazo de reserva/i.test(carta(g, inst).efecto || "");
  const jd = lugar.jug;
  const libres = [[lugar.zona, lugar.casilla]];
  for (const z of ["defensa", "batalla"]) jd[z].forEach((c, k) => { if (!c && !(z === lugar.zona && k === lugar.casilla)) libres.push([z, k]); });
  for (const u of dentro) {
    if (aReserva) {
      limpiarInst(u); u.entroReserva = g.turno; jd.reserva.push(u);
      ev.push({ tipo: "sale_del_cuartel", jugador: jd.asiento, uid: u.uid, carta: u.carta, a: "reserva" });
      continue;
    }
    const lib = libres.shift();
    if (lib) {
      if (u.pos === "def") contusionar(u); else herir(u);
      jd[lib[0]][lib[1]] = u;
      ev.push({ tipo: "sale_del_cuartel", jugador: jd.asiento, uid: u.uid, carta: u.carta, a: lib[0], casilla: lib[1], pos: u.pos, herida: u.pos !== "def", contusion: u.pos === "def" });
    } else {
      limpiarInst(u); jd.mausoleo.push(u);
      ev.push({ tipo: "sale_del_cuartel", jugador: jd.asiento, uid: u.uid, carta: u.carta, a: "mausoleo" });
    }
  }
  if (equipoQueGana !== undefined) darPuntos(g, equipoQueGana, carta(g, inst).pv || 0, ev, "derrota_en_combate");
}

// ------------------------------------------------------------------
// Turnos
// ------------------------------------------------------------------
function empezarTurno(g, ev) {
  // Saltar a los eliminados
  let vueltas = 0;
  while (g.jugadores[g.actual].eliminado && vueltas++ < g.jugadores.length) g.actual = (g.actual + 1) % g.jugadores.length;
  const j = g.jugadores[g.actual];
  g.turno++;
  g.etapa = "robo";
  g.ataque = null;
  g.cont = { bajadas: 0, mulligans: 0, retiradas: 0, desdeReserva: 0 };
  for (const z of ["batalla", "defensa"]) for (const c of j[z]) if (c) {
    c.ataco = false; c.salioDeReserva = false; c.cambioPos = false;
    for (const u of c.acuartelados || []) { u.ataco = false; u.salioDeReserva = false; u.cambioPos = false; }
  }
  ev.push({ tipo: "turno", jugador: j.asiento, turno: g.turno });

  // Sin cartas en mano, mazo principal ni reserva: queda fuera
  if (j.mano.length === 0 && j.principal.length === 0 && j.reserva.length === 0) {
    eliminar(g, j, ev, "sin_cartas");
    if (g.fase !== "terminada") pasarTurno(g, ev);
    return;
  }
  // Si no hay de dónde robar, se salta el robo
  if (j.principal.length === 0 && j.recursos.length === 0) {
    g.etapa = "nucleo1";
    ev.push({ tipo: "etapa", etapa: g.etapa });
  }
}
function pasarTurno(g, ev) {
  // El "Daño" (y todo lo que dura un turno) se borra al terminar el turno
  for (const x of g.jugadores) for (const c of cartasEnTablero(x)) quitarMods(c, (m) => m.dura === "turno");
  g.actual = (g.actual + 1) % g.jugadores.length;
  empezarTurno(g, ev);
}

function robar(g, j, mazo, ev) {
  const lista = j[mazo];
  if (lista.length === 0) return false;
  const inst = lista.shift();
  j.mano.push(inst);
  ev.push({ tipo: "robo", jugador: j.asiento, mazo, privado: { uid: inst.uid, carta: inst.carta } });
  return true;
}

// ------------------------------------------------------------------
// Combate (tabla del libro)
// ------------------------------------------------------------------
function resolverAtaque(g, ev) {
  const a = g.ataque;
  g.ataque = null;
  const lugarA = buscarEnCampo(g, a.atacante);
  if (!lugarA) return; // el atacante ya no está
  const atacante = lugarA.inst;
  const yo = lugarA.jug;
  atacante.ataco = true;
  quitarMods(atacante, (m) => m.dura === "hasta_atacar"); // ej. Hacha Arrojadiza: dura hasta que ataca

  // Ataque directo
  if (a.directo !== undefined) {
    const rival = g.jugadores[a.directo];
    if (!puedeAtacarDirecto(g, rival, a.demoledor)) { ev.push({ tipo: "ataque_anulado", motivo: "campo_ya_no_vacio" }); return; }
    ev.push({ tipo: "ataque_directo", atacante: atacante.uid, jugador: rival.asiento });
    darPuntos(g, yo.equipo, 1, ev, "ataque_directo");
    return;
  }

  const lugarD = buscarEnCampo(g, a.objetivo);
  if (!lugarD) { ev.push({ tipo: "ataque_anulado", motivo: "objetivo_ya_no_esta" }); return; }
  const defensor = lugarD.inst;
  const rival = lugarD.jug;
  const atk = ataqueDe(g, atacante);
  const esEstructura = carta(g, defensor).tipo === "estructura";
  let resultado;

  if (defensor.pos === "def") {
    const def = defensaDe(g, defensor);
    // Estructuras: si el ataque iguala la defensa, también cae
    const cae = esEstructura ? atk >= def : atk > def;
    resultado = cae ? "defensor_derrotado" : "nulo";
    ev.push({ tipo: "combate", atacante: atacante.uid, objetivo: defensor.uid, ataque: atk, defensa: def, resultado });
    if (cae) derrotar(g, defensor, ev, yo.equipo);
  } else {
    const atkRival = ataqueDe(g, defensor);
    resultado = atk > atkRival ? "defensor_derrotado" : atk === atkRival ? "ambos_derrotados" : "atacante_derrotado";
    ev.push({ tipo: "combate", atacante: atacante.uid, objetivo: defensor.uid, ataque: atk, ataqueRival: atkRival, resultado });
    if (resultado !== "atacante_derrotado") derrotar(g, defensor, ev, yo.equipo);
    if (resultado !== "defensor_derrotado") derrotar(g, atacante, ev, rival.equipo);
  }
}

// ¿Alguien del lado defensor puede responder? (Emboscar / Reacción en la mano)
function puedeResponder(g, defensores) {
  return defensores.some((j) => j.mano.some((c) => tieneAccion(g, c, "emboscar") || tieneAccion(g, c, "reaccion")));
}

// ------------------------------------------------------------------
// Jugadas
// ------------------------------------------------------------------
function jugar(g, asiento, accion) {
  if (g.fase === "terminada") return mal("partida_terminada");
  const j = g.jugadores[asiento];
  if (!j) return mal("jugador_no_existe");
  if (!accion || typeof accion.tipo !== "string") return mal("accion_invalida");
  const ev = [];
  const t = accion.tipo;

  // ---- Rendirse: en cualquier momento ----
  if (t === "rendirse") {
    if (j.eliminado) return mal("ya_eliminado");
    eliminar(g, j, ev, "se_rindio");
    if (g.fase !== "terminada" && g.fase === "jugando" && g.actual === asiento) pasarTurno(g, ev);
    return { ok: true, eventos: ev };
  }

  // ---- Mano inicial: cada uno elige cuántas de las 5 saca de Recursos ----
  if (g.fase === "mano_inicial") {
    if (t !== "mano_inicial") return mal("primero_elige_mano_inicial");
    if (j.listo) return mal("ya_elegiste");
    const deRecursos = Math.floor(Number(accion.de_recursos) || 0);
    if (deRecursos < 0 || deRecursos > REGLAS.manoInicial) return mal("cantidad_invalida");
    for (let i = 0; i < REGLAS.manoInicial; i++) robar(g, j, i < deRecursos ? "recursos" : "principal", ev);
    j.listo = true;
    if (g.jugadores.every((x) => x.listo)) {
      g.fase = "jugando";
      g.actual = 0;
      empezarTurno(g, ev);
    }
    return { ok: true, eventos: ev };
  }

  // ---- Responder a un ataque (le toca al defensor, no al del turno) ----
  if (g.ataque) {
    if (t !== "responder") return mal("esperando_respuesta_al_ataque");
    if (!g.ataque.defensores.includes(asiento)) return mal("no_te_toca_responder");
    // Por ahora solo "pasar". Emboscar y Reacción llegan con las acciones de carta.
    resolverAtaque(g, ev);
    return { ok: true, eventos: ev };
  }

  if (asiento !== g.actual) return mal("no_es_tu_turno");
  const e = g.etapa;
  const enNucleo = e === "nucleo1" || e === "nucleo2";

  switch (t) {
    // ---------- Robo de inicio de turno ----------
    case "robar": {
      if (e !== "robo") return mal("ya_robaste");
      const mazo = accion.mazo === "recursos" ? "recursos" : "principal";
      if (!robar(g, j, mazo, ev)) return mal("mazo_vacio");
      g.etapa = "nucleo1";
      ev.push({ tipo: "etapa", etapa: g.etapa });
      return { ok: true, eventos: ev };
    }

    // ---------- Bajar unidad o estructura ----------
    case "bajar": {
      if (!enNucleo) return mal("solo_en_nucleo");
      if (g.cont.bajadas >= REGLAS.bajadasPorTurno) return mal("limite_de_bajadas");
      const desde = accion.desde === "sobrenatural" ? "sobrenatural" : "mano";
      const lista = j[desde];
      const inst = lista.find((c) => c.uid === accion.uid);
      if (!inst) return mal("carta_no_esta");
      const c = carta(g, inst);
      if (c.tipo !== "unidad" && c.tipo !== "estructura") return mal("solo_unidades_o_estructuras");
      // Unidades a la zona de batalla, estructuras a la defensiva
      const zona = c.tipo === "estructura" ? "defensa" : (accion.zona === "defensa" ? "defensa" : "batalla");
      const casilla = Math.floor(Number(accion.casilla));
      if (!(casilla >= 0 && casilla < j[zona].length)) return mal("casilla_invalida");
      if (j[zona][casilla]) return mal("casilla_ocupada");
      if (c.costoExtra) return mal("costo_especial_todavia_no_disponible"); // sacrificios, etc.
      const costo = c.costo || {};
      const rec = g.equipos[j.equipo].recursos;
      for (const r of RECURSOS) if ((rec[r] || 0) < (costo[r] || 0)) return mal(`falta_${r}`);
      for (const r of RECURSOS) rec[r] -= costo[r] || 0;
      sacarDe(lista, inst.uid);
      inst.pos = accion.pos === "def" ? "def" : "atk";
      j[zona][casilla] = inst;
      g.cont.bajadas++;
      ev.push({ tipo: "bajada", jugador: j.asiento, uid: inst.uid, carta: inst.carta, zona, casilla, pos: inst.pos, costo });
      // Las unidades generan al bajar (las estructuras bajadas NO generan)
      if (c.tipo === "unidad" && c.genera) {
        for (const r of RECURSOS) rec[r] += c.genera[r] || 0;
        ev.push({ tipo: "genera", equipo: j.equipo, recursos: c.genera });
      }
      return { ok: true, eventos: ev };
    }

    // ---------- Acuartelar (desde el campo o desde la mano/sobrenatural) ----------
    case "acuartelar": {
      if (!enNucleo) return mal("solo_en_nucleo");
      const lugarE = buscarEnCampo(g, accion.estructura);
      if (!lugarE || lugarE.jug !== j) return mal("estructura_no_esta");
      const est = lugarE.inst;
      const regla = reglaCuartel(carta(g, est));
      if (!regla) return mal("esa_estructura_no_acuartela");
      if (!Array.isArray(est.acuartelados)) est.acuartelados = [];
      if (est.acuartelados.length >= regla.max) return mal("cuartel_lleno");
      const lugarU = buscarEnCampo(g, accion.uid);
      let inst, desde;
      if (lugarU) {
        if (lugarU.jug !== j) return mal("carta_no_esta");
        inst = lugarU.inst; desde = "campo";
      } else {
        desde = accion.desde === "sobrenatural" ? "sobrenatural" : "mano";
        inst = j[desde].find((c) => c.uid === accion.uid);
      }
      if (!inst) return mal("carta_no_esta");
      const c = carta(g, inst);
      const motivo = motivoNoCabe(regla, c);
      if (motivo) return mal(motivo);
      // Reglamento: cada carta se puede acuartelar una vez por turno
      if (inst.acuarteloTurno === g.turno) return mal("ya_se_acuartelo_este_turno");
      const rec = g.equipos[j.equipo].recursos;
      if (desde === "campo") {
        if (c.movil === false) return mal("carta_inmovil");
        if (inst.ataco) return mal("ya_ataco_este_turno");
        j[lugarU.zona][lugarU.casilla] = null;
      } else {
        // Desde la mano es como bajarla: cuenta como bajada y se paga su costo
        if (g.cont.bajadas >= REGLAS.bajadasPorTurno) return mal("limite_de_bajadas");
        if (c.costoExtra) return mal("costo_especial_todavia_no_disponible");
        const costo = c.costo || {};
        for (const r of RECURSOS) if ((rec[r] || 0) < (costo[r] || 0)) return mal(`falta_${r}`);
        for (const r of RECURSOS) rec[r] -= costo[r] || 0;
        sacarDe(j[desde], inst.uid);
        inst.pos = accion.pos === "def" ? "def" : "atk";
        g.cont.bajadas++;
      }
      // La estructura gana +1 ATK o +1 DEF por esta unidad (lo eliges tú; si no, DEF)
      inst.bonoCuartel = accion.bono === "atk" ? "atk" : "def";
      inst.acuarteloTurno = g.turno;
      est.acuartelados.push(inst);
      ev.push({ tipo: "acuartelada", jugador: j.asiento, uid: inst.uid, carta: inst.carta, estructura: est.uid, desde, bono: inst.bonoCuartel });
      if (desde !== "campo" && c.genera) {
        for (const r of RECURSOS) rec[r] += c.genera[r] || 0;
        ev.push({ tipo: "genera", equipo: j.equipo, recursos: c.genera });
      }
      return { ok: true, eventos: ev };
    }

    // ---------- Sacar del cuartel (puede atacar ese mismo turno) ----------
    case "desacuartelar": {
      if (!enNucleo) return mal("solo_en_nucleo");
      const lugar = buscarEnCuartel(j, accion.uid);
      if (!lugar) return mal("carta_no_esta");
      const zona = accion.zona === "defensa" ? "defensa" : "batalla";
      const casilla = Math.floor(Number(accion.casilla));
      if (!(casilla >= 0 && casilla < j[zona].length)) return mal("casilla_invalida");
      if (j[zona][casilla]) return mal("casilla_ocupada");
      const inst = lugar.inst;
      lugar.est.acuartelados.splice(lugar.i, 1);
      if (accion.pos === "atk" || accion.pos === "def") inst.pos = accion.pos;
      j[zona][casilla] = inst;
      ev.push({ tipo: "desacuartelada", jugador: j.asiento, uid: inst.uid, carta: inst.carta, estructura: lugar.est.uid, zona, casilla, pos: inst.pos });
      return { ok: true, eventos: ev };
    }

    // ---------- Estructura como recurso ----------
    case "jugar_recurso": {
      if (!enNucleo) return mal("solo_en_nucleo");
      const inst = j.mano.find((c) => c.uid === accion.uid);
      if (!inst) return mal("carta_no_esta");
      const c = carta(g, inst);
      if (c.tipo !== "estructura") return mal("solo_estructuras");
      sacarDe(j.mano, inst.uid);
      j.reciclaje.push(inst);
      const rec = g.equipos[j.equipo].recursos;
      for (const r of RECURSOS) rec[r] += (c.genera || {})[r] || 0;
      ev.push({ tipo: "recurso", jugador: j.asiento, uid: inst.uid, carta: inst.carta, recursos: c.genera || {} });
      return { ok: true, eventos: ev };
    }

    // ---------- Cambiar posición o casilla ----------
    case "cambiar": {
      if (!enNucleo) return mal("solo_en_nucleo");
      const lugar = buscarEnCampo(g, accion.uid);
      if (!lugar || lugar.jug !== j) return mal("carta_no_esta");
      const inst = lugar.inst;
      if (carta(g, inst).movil === false) return mal("carta_inmovil");
      if (inst.ataco) return mal("ya_ataco_este_turno");
      if ((accion.pos === "atk" || accion.pos === "def") && accion.pos !== inst.pos) {
        // Ataque <-> defensa: una sola vez por turno (y nunca si ya atacó)
        if (inst.cambioPos) return mal("ya_cambio_de_posicion_este_turno");
        inst.pos = accion.pos;
        inst.cambioPos = true;
      }
      if (accion.zona !== undefined) {
        const zona = accion.zona === "defensa" ? "defensa" : "batalla";
        const casilla = Math.floor(Number(accion.casilla));
        if (!(casilla >= 0 && casilla < j[zona].length)) return mal("casilla_invalida");
        const otra = j[zona][casilla];
        if (otra && carta(g, otra).movil === false) return mal("la_otra_carta_es_inmovil");
        if (otra && carta(g, otra).tipo === "estructura" && lugar.zona !== "defensa") return mal("estructura_solo_en_defensa");
        j[lugar.zona][lugar.casilla] = otra; // intercambio (o deja vacío)
        j[zona][casilla] = inst;
      }
      ev.push({ tipo: "cambio", jugador: j.asiento, uid: inst.uid, pos: inst.pos, zona: accion.zona, casilla: accion.casilla });
      return { ok: true, eventos: ev };
    }

    // ---------- Mulligan ----------
    case "mulligan": {
      if (!enNucleo) return mal("solo_en_nucleo");
      if (g.cont.mulligans >= REGLAS.mulligansPorTurno) return mal("limite_de_mulligan");
      const inst = j.mano.find((c) => c.uid === accion.uid);
      if (!inst) return mal("carta_no_esta");
      const de = accion.robar_de === "recursos" ? "recursos" : "principal";
      // Al fondo de su mazo
      const mazoDeVuelta = inst.origen === "recursos" ? "recursos" : "principal";
      if (inst.origen === "sobrenatural") return mal("no_aplica");
      if (j[de].length === 0 && !(de === mazoDeVuelta)) return mal("mazo_vacio");
      sacarDe(j.mano, inst.uid);
      j[mazoDeVuelta].push(inst);
      g.cont.mulligans++;
      ev.push({ tipo: "mulligan", jugador: j.asiento });
      robar(g, j, de, ev);
      for (const eq of new Set(rivales(g, j).map((o) => o.equipo))) darPuntos(g, eq, 1, ev, "mulligan_rival");
      return { ok: true, eventos: ev };
    }

    // ---------- Enviar a la reserva ----------
    case "a_reserva": {
      if (!enNucleo) return mal("solo_en_nucleo");
      if (g.cont.retiradas >= REGLAS.retiradasPorTurno) return mal("limite_de_retiradas");
      const lugar = buscarEnCampo(g, accion.uid);
      if (!lugar || lugar.jug !== j) return mal("carta_no_esta");
      const inst = lugar.inst;
      const c = carta(g, inst);
      if (c.tipo !== "unidad" || c.clase !== "comun" || !["humano", "animal"].includes(c.especie)) return mal("solo_humano_o_animal_comun");
      if (c.movil === false) return mal("carta_inmovil");
      if (inst.ataco) return mal("ya_ataco_este_turno");
      if (inst.salioDeReserva) return mal("salio_de_reserva_este_turno");
      j[lugar.zona][lugar.casilla] = null;
      limpiarInst(inst);
      inst.entroReserva = g.turno; // no se puede sacar en este mismo turno
      j.reserva.push(inst);
      g.cont.retiradas++;
      ev.push({ tipo: "a_reserva", jugador: j.asiento, uid: inst.uid });
      return { ok: true, eventos: ev };
    }

    // ---------- Colocar desde la reserva (no genera, no cuenta como bajada) ----------
    case "desde_reserva": {
      if (!enNucleo) return mal("solo_en_nucleo");
      if (g.cont.desdeReserva >= REGLAS.desdeReservaPorTurno) return mal("limite_desde_reserva");
      const inst = j.reserva.find((c) => c.uid === accion.uid);
      if (!inst) return mal("carta_no_esta");
      if (inst.entroReserva === g.turno) return mal("espera_un_turno_para_sacarla");
      const zona = accion.zona === "defensa" ? "defensa" : "batalla";
      const casilla = Math.floor(Number(accion.casilla));
      if (!(casilla >= 0 && casilla < j[zona].length)) return mal("casilla_invalida");
      if (j[zona][casilla]) return mal("casilla_ocupada");
      sacarDe(j.reserva, inst.uid);
      inst.pos = accion.pos === "def" ? "def" : "atk";
      inst.salioDeReserva = true;
      j[zona][casilla] = inst;
      g.cont.desdeReserva++;
      ev.push({ tipo: "desde_reserva", jugador: j.asiento, uid: inst.uid, carta: inst.carta, zona, casilla, pos: inst.pos });
      return { ok: true, eventos: ev };
    }

    // ---------- Pasar a la batalla (una sola vez) ----------
    case "ir_batalla": {
      if (e !== "nucleo1") return mal("solo_desde_nucleo1");
      g.etapa = "batalla";
      ev.push({ tipo: "etapa", etapa: g.etapa });
      return { ok: true, eventos: ev };
    }

    // ---------- Atacar ----------
    case "atacar": {
      if (e !== "batalla") return mal("solo_en_batalla");
      const lugarA = buscarEnCampo(g, accion.uid);
      if (!lugarA || lugarA.jug !== j) return mal("carta_no_esta");
      const atacante = lugarA.inst;
      if (atacante.pos !== "atk") return mal("debe_estar_en_ataque");
      if (atacante.ataco) return mal("ya_ataco");
      if (carta(g, atacante).tipo !== "unidad") return mal("solo_unidades_atacan");

      const demoledor = tieneAccion(g, atacante, "demoledor");
      let rival, ataque;
      if (accion.jugador !== undefined) {
        rival = g.jugadores[Number(accion.jugador)];
        if (!rival || rival.equipo === j.equipo || rival.eliminado) return mal("rival_invalido");
        if (!puedeAtacarDirecto(g, rival, demoledor)) {
          if (!demoledor && unidadesEnBatalla(g, rival).length > 0) return mal("primero_derrota_sus_unidades");
          return mal("primero_derrota_sus_estructuras");
        }
        ataque = { atacante: atacante.uid, directo: rival.asiento, demoledor };
      } else {
        const lugarD = buscarEnCampo(g, accion.objetivo);
        if (!lugarD) return mal("objetivo_no_esta");
        rival = lugarD.jug;
        if (rival.equipo === j.equipo) return mal("no_puedes_atacar_a_tu_equipo");
        // Las estructuras solo se atacan cuando el rival ya no tiene unidades (salvo Demoledor)
        // Las estructuras solo se atacan cuando el rival ya no tiene unidades en su zona de batalla (salvo Demoledor)
        if (carta(g, lugarD.inst).tipo === "estructura" && !demoledor && unidadesEnBatalla(g, rival).length > 0) return mal("primero_derrota_sus_unidades");
        ataque = { atacante: atacante.uid, objetivo: lugarD.inst.uid };
      }
      // Defienden el atacado y, en 2v2, su compañero
      const defensores = g.jugadores.filter((o) => o.equipo === rival.equipo && !o.eliminado);
      ataque.defensores = defensores.map((o) => o.asiento);
      g.ataque = ataque;
      ev.push({ tipo: "ataque", jugador: j.asiento, ...ataque });
      if (!puedeResponder(g, defensores)) resolverAtaque(g, ev);
      else ev.push({ tipo: "esperando_respuesta", defensores: ataque.defensores });
      return { ok: true, eventos: ev };
    }

    // ---------- Núcleo 2 ----------
    case "ir_nucleo2": {
      if (e !== "batalla" && e !== "nucleo1") return mal("no_se_puede_ahora");
      g.etapa = "nucleo2"; // desde núcleo 1 = no quiso atacar
      ev.push({ tipo: "etapa", etapa: g.etapa });
      return { ok: true, eventos: ev };
    }

    // ---------- Descartar (para bajar a 10 cartas) ----------
    case "descartar": {
      if (e === "robo") return mal("no_se_puede_ahora");
      // Solo para bajar a 10 cartas al final del turno (los demás descartes los hacen los efectos)
      if (j.mano.length <= REGLAS.limiteMano) return mal("solo_si_tienes_mas_de_10");
      const inst = sacarDe(j.mano, accion.uid);
      if (!inst) return mal("carta_no_esta");
      j.mausoleo.push(inst);
      ev.push({ tipo: "descarte", jugador: j.asiento, uid: inst.uid, carta: inst.carta });
      return { ok: true, eventos: ev };
    }

    // ---------- Terminar turno ----------
    case "terminar_turno": {
      if (e === "robo") return mal("primero_roba");
      if (j.mano.length > REGLAS.limiteMano) return mal(`descarta_hasta_${REGLAS.limiteMano}`);
      ev.push({ tipo: "fin_turno", jugador: j.asiento });
      pasarTurno(g, ev);
      return { ok: true, eventos: ev };
    }
  }
  return mal("accion_desconocida");
}

// ------------------------------------------------------------------
// Lo que ve cada jugador (aquí se esconden las manos y los mazos)
// ------------------------------------------------------------------
function vistaCarta(g, inst) {
  if (!inst) return null;
  const regla = reglaCuartel(carta(g, inst));
  const cuartel = regla ? { max: regla.max, especies: regla.especies, comun: regla.comun, espiritista: regla.espiritista, unidades: (inst.acuartelados || []).map((u) => ({ uid: u.uid, carta: u.carta, pos: u.pos, bono: u.bonoCuartel || "def", herida: u.herida || 0, contusion: u.contusion || 0 })) } : undefined;
  return {
    cuartel,
    uid: inst.uid, carta: inst.carta, pos: inst.pos,
    ataque: ataqueDe(g, inst), defensa: defensaDe(g, inst),
    herida: inst.herida, contusion: inst.contusion, ataco: inst.ataco,
    base_ataque: carta(g, inst).ataque || 0, base_defensa: carta(g, inst).defensa || 0,
    bonos: bonos(g, inst).filter((b) => b.ataque || b.defensa),
  };
}
function vistaPara(g, asiento) {
  return {
    modo: g.modo, fase: g.fase, turno: g.turno, actual: g.actual, etapa: g.etapa,
    yo: asiento, ganador: g.ganador, puntos: g.puntos, contadores: g.cont,
    ataque: g.ataque,
    equipos: g.equipos,
    jugadores: g.jugadores.map((j) => {
      const mio = j.asiento === asiento;
      return {
        id: j.id, asiento: j.asiento, equipo: j.equipo, eliminado: j.eliminado, listo: j.listo,
        batalla: j.batalla.map((c) => vistaCarta(g, c)),
        defensa: j.defensa.map((c) => vistaCarta(g, c)),
        mausoleo: j.mausoleo.map((c) => c.carta),
        reciclaje: j.reciclaje.map((c) => c.carta),
        sobrenatural: mio ? j.sobrenatural.map((c) => ({ uid: c.uid, carta: c.carta })) : j.sobrenatural.length, // solo el dueño lo ve
        mano: mio ? j.mano.map((c) => ({ uid: c.uid, carta: c.carta })) : j.mano.length,
        reserva: j.reserva.map((c) => ({ uid: c.uid, carta: c.carta })), // la ven todos
        principal: j.principal.length,
        recursos: j.recursos.length,
      };
    }),
  };
}
// Quita lo privado de los eventos para los que no son dueños
function eventosPara(eventos, asiento) {
  return eventos.map((e) => {
    if (!e.privado) return e;
    const { privado, ...resto } = e;
    return e.jugador === asiento ? { ...resto, ...privado } : resto;
  });
}

module.exports = { REGLAS, crearPartida, jugar, vistaPara, eventosPara, validarMazo,
  // para los efectos de cartas y las pruebas
  _h: { ataqueDe, defensaDe, herir, contusionar, curar, modificar, quitarMods, bonos, cartasEnTablero } };
