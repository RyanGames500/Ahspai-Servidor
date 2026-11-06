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
function ataqueDe(g, inst) {
  return Math.max(0, (carta(g, inst).ataque || 0) - inst.herida);
}
function defensaDe(g, inst) {
  return Math.max(0, (carta(g, inst).defensa || 0) - inst.contusion);
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
function campoVacio(j) {
  return j.batalla.every((c) => !c) && j.defensa.every((c) => !c);
}
function rivales(g, j) {
  return g.jugadores.filter((o) => o.equipo !== j.equipo && !o.eliminado);
}
function sacarDe(lista, uid) {
  const i = lista.findIndex((c) => c.uid === uid);
  return i >= 0 ? lista.splice(i, 1)[0] : null;
}
function limpiarInst(inst) {
  inst.herida = 0; inst.contusion = 0; inst.ataco = false; inst.salioDeReserva = false; inst.pos = "atk";
}

// ------------------------------------------------------------------
// Puntos y fin de partida
// ------------------------------------------------------------------
function darPuntos(g, equipo, cantidad, ev, motivo) {
  if (cantidad <= 0 || g.fase === "terminada") return;
  g.equipos[equipo].pv += cantidad;
  ev.push({ tipo: "puntos", equipo, cantidad, total: g.equipos[equipo].pv, motivo });
  if (g.equipos[equipo].pv >= REGLAS.puntosParaGanar) terminar(g, equipo, ev, "puntos");
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
  for (const z of ["batalla", "defensa"]) for (const c of j[z]) if (c) { c.ataco = false; c.salioDeReserva = false; }
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

  // Ataque directo
  if (a.directo !== undefined) {
    const rival = g.jugadores[a.directo];
    if (!campoVacio(rival)) { ev.push({ tipo: "ataque_anulado", motivo: "campo_ya_no_vacio" }); return; }
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
      if (accion.pos === "atk" || accion.pos === "def") inst.pos = accion.pos;
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

      let rival, ataque;
      if (accion.jugador !== undefined) {
        rival = g.jugadores[Number(accion.jugador)];
        if (!rival || rival.equipo === j.equipo || rival.eliminado) return mal("rival_invalido");
        if (!campoVacio(rival)) return mal("primero_limpia_su_campo");
        ataque = { atacante: atacante.uid, directo: rival.asiento };
      } else {
        const lugarD = buscarEnCampo(g, accion.objetivo);
        if (!lugarD) return mal("objetivo_no_esta");
        rival = lugarD.jug;
        if (rival.equipo === j.equipo) return mal("no_puedes_atacar_a_tu_equipo");
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
  return {
    uid: inst.uid, carta: inst.carta, pos: inst.pos,
    ataque: ataqueDe(g, inst), defensa: defensaDe(g, inst),
    herida: inst.herida, contusion: inst.contusion, ataco: inst.ataco,
  };
}
function vistaPara(g, asiento) {
  return {
    modo: g.modo, fase: g.fase, turno: g.turno, actual: g.actual, etapa: g.etapa,
    yo: asiento, ganador: g.ganador, contadores: g.cont,
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
        sobrenatural: j.sobrenatural.map((c) => ({ uid: c.uid, carta: c.carta })), // va boca arriba
        mano: mio ? j.mano.map((c) => ({ uid: c.uid, carta: c.carta })) : j.mano.length,
        reserva: mio ? j.reserva.map((c) => ({ uid: c.uid, carta: c.carta })) : j.reserva.length,
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

module.exports = { REGLAS, crearPartida, jugar, vistaPara, eventosPara, validarMazo };
