/*
 * ÓRBITA - Scripts del servidor
 * Lógica que corre EN EL SERVIDOR (nadie puede hacer trampa aquí).
 * Todas las funciones son opcionales.
 *
 * Herramientas (api):
 *   api.sendTo(playerId, "evento", {datos})               -> orb_on("evento", ...) en ese jugador (from = -1)
 *   api.sendToRoom(gameId, roomId, "evento", {datos})     -> a toda la sala
 *   api.setPlayerData(playerId, {vida: 100})              -> datos del jugador que ve toda la sala
 *   api.moveToRoom(playerId, "sala", maxJugadores)
 *   api.playersInRoom(gameId, roomId)  /  api.player(id)  /  api.hostOf(gameId, roomId)
 *   api.db.get(gameId, "coleccion", "clave") / api.db.set(...) / api.db.delete(...)
 *   api.log("texto")
 *
 * Cada jugador (p) tiene: p.id, p.gameId, p.roomId, p.slot, p.state (su orb_state), p.pdata
 */

// ==================================================================
// AHSPAI (solo para el juego con ORB_GAME_ID = "Ahspai"; los demás juegos no se enteran)
// ==================================================================
const AHSPAI = "Ahspai";
const motor = require("./ahspai/motor.js");
const CARTAS = require("./ahspai/cartas.js"); // las 62 cartas reales (cartas_prueba.js queda para las pruebas)
const TAM = { "1v1": 2, ffa3: 3, ffa4: 4, "2v2": 4 };
const partidas = new Map(); // sala -> { g, asientos: Map(idJugador -> asiento), modo }

// Mazo PROVISIONAL con cartas reales para todos, mientras Ryan pasa los 2 mazos iniciales.
// Copias: Peón 4, Bélico/Héroe 3, Líder 1, Sobrenatural 2, Estructura 3, el resto 3 (por confirmar).
function mazoPrueba() {
  const ids = Object.keys(CARTAS);
  const copias = (c) => (c.sobrenatural ? 2 : c.tipo === "estructura" ? 3 : ({ peon: 4, belico: 3, heroe: 3, lider: 1 })[c.alineamiento] ?? 3);
  const tomar = (filtro, max) => {
    const out = [];
    for (const id of ids) {
      const c = CARTAS[id];
      if (!filtro(c)) continue;
      for (let k = 0; k < copias(c) && out.length < max; k++) out.push(id);
    }
    return out;
  };
  return {
    principal: tomar((c) => c.tipo !== "estructura" && !c.sobrenatural, 40),
    sobrenatural: tomar((c) => c.sobrenatural, 12),
    recursos: tomar((c) => c.tipo === "estructura", 12),
  };
}

function ahspaiEnviarEstado(api, sala, eventos) {
  const pt = partidas.get(sala);
  if (!pt) return;
  for (const [pid, asiento] of pt.asientos) {
    api.sendTo(pid, "ahspai_estado", { vista: motor.vistaPara(pt.g, asiento), eventos: motor.eventosPara(eventos, asiento) });
  }
}

// Manda el inicio: primero quién eres, luego las cartas en pedacitos chicos (el celular no recibe bien mensajes grandes)
function ahspaiEnviarInicio(api, pid, asiento, modo) {
  const claves = Object.keys(CARTAS);
  api.sendTo(pid, "ahspai_inicio", { asiento, modo, total: claves.length });
  for (let i = 0; i < claves.length; i += 6) {
    const parte = {};
    for (const k of claves.slice(i, i + 6)) parte[k] = CARTAS[k];
    api.sendTo(pid, "ahspai_cartas", { parte });
  }
}

function ahspaiEmpezar(api, sala, modo, puntos) {
  const viejo = partidas.get(sala);
  if (viejo && viejo.g.fase !== "terminada") return "ya_hay_partida";
  const jugadores = api.playersInRoom(AHSPAI, sala).sort((a, b) => a.slot - b.slot);
  if (!TAM[modo]) return "modo_invalido";
  if (jugadores.length !== TAM[modo]) return `faltan_jugadores_${jugadores.length}_de_${TAM[modo]}`;
  const g = motor.crearPartida(
    { modo: modo.startsWith("ffa") ? "ffa" : modo, puntos: Number(puntos) || 30, jugadores: jugadores.map((p) => ({ id: p.id, mazo: mazoPrueba() })) },
    CARTAS
  );
  const asientos = new Map(jugadores.map((p, i) => [p.id, i]));
  partidas.set(sala, { g, asientos, modo });
  api.log(`[Ahspai] Partida ${modo} en "${sala}": ${jugadores.map((p) => p.id).join(", ")}`);
  for (const [pid, asiento] of asientos) ahspaiEnviarInicio(api, pid, asiento, modo);
  ahspaiEnviarEstado(api, sala, []);
  return null;
}

function ahspaiSalio(api, p, sala) {
  const pt = partidas.get(sala);
  if (!pt) return;
  const asiento = pt.asientos.get(p.id);
  if (asiento !== undefined) {
    // Por ahora, salirse = rendirse (volver a la partida llega después)
    const r = motor.jugar(pt.g, asiento, { tipo: "rendirse" });
    pt.asientos.delete(p.id);
    if (r.ok) ahspaiEnviarEstado(api, sala, r.eventos);
  }
  if (pt.asientos.size === 0) partidas.delete(sala);
}

module.exports = {
  onConnect(api, p) {},

  onJoinRoom(api, p, roomId) {
    // Partida rápida: cuando la sala del matchmaking se llena, empieza sola
    if (p.gameId !== AHSPAI) return;
    // La sala se llama match_ahspai_<modo>_p<puntos>_<n> (los puntos van en el modo del matchmaking)
    const m = /^match_ahspai_(1v1|ffa3|ffa4|2v2)_(?:p(16|20|25|30)_)?/.exec(roomId);
    if (m && api.playersInRoom(AHSPAI, roomId).length === TAM[m[1]]) ahspaiEmpezar(api, roomId, m[1], m[2]);
  },

  onLeaveRoom(api, p, roomId) {
    if (p.gameId === AHSPAI) ahspaiSalio(api, p, roomId);
  },

  onDisconnect(api, p) {},

  // orb_send_server("evento", {datos})  (sin respuesta)
  onEvent(api, p, name, data) {
    if (p.gameId === AHSPAI) {
      if (name === "ahspai_empezar") {
        if (api.hostOf(AHSPAI, p.roomId) !== p.id) return api.sendTo(p.id, "ahspai_error", { error: "solo_el_host_puede_empezar" });
        const error = ahspaiEmpezar(api, p.roomId, String(data?.modo || ""), data?.puntos);
        if (error) api.sendTo(p.id, "ahspai_error", { error });
        return;
      }
      if (name === "ahspai_pedir_inicio") {
        // El jugador no recibió el mensaje de inicio (pasa a veces en el celular): se lo mandamos otra vez
        const pt = partidas.get(p.roomId);
        const asiento = pt && pt.asientos.get(p.id);
        if (asiento === undefined) return;
        ahspaiEnviarInicio(api, p.id, asiento, pt.modo);
        api.sendTo(p.id, "ahspai_estado", { vista: motor.vistaPara(pt.g, asiento), eventos: [] });
        return;
      }
      if (name === "ahspai_jugada") {
        const pt = partidas.get(p.roomId);
        const asiento = pt && pt.asientos.get(p.id);
        if (asiento === undefined) return api.sendTo(p.id, "ahspai_error", { error: "no_estas_en_una_partida" });
        const r = motor.jugar(pt.g, asiento, data || {});
        if (!r.ok) return api.sendTo(p.id, "ahspai_error", { error: r.error });
        ahspaiEnviarEstado(api, p.roomId, r.eventos);
        return;
      }
    }

    // --- Ejemplo de Órbita (sigue funcionando igual) ---
    if (name === "tirar_dado") {
      const valor = 1 + Math.floor(Math.random() * 6);
      api.sendToRoom(p.gameId, p.roomId, "resultado_dado", { jugador: p.id, valor });
    }
  },

  // orb_request_server("pregunta", {datos}, function(ok, respuesta) {...})  (con respuesta)
  async onRequest(api, p, name, data) {
    if (name === "hora_servidor") return { hora: new Date().toISOString() };
    if (name === "sumar") return Number(data?.a || 0) + Number(data?.b || 0);
    throw new Error("pregunta_desconocida");
  },

  // Se llama 10 veces por segundo (bórrala si no la usas)
  // onTick(api) {},
};
