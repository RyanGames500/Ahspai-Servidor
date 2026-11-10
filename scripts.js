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
const CUENTAS = require("./ahspai/cuentas.js"); // usuarios, colección, monedas... (Neon)
const RAREZAS = require("./ahspai/rarezas.js");

// Manda el catálogo de cartas (con su rareza) en pedacitos chicos, para el menú y la colección
function ahspaiEnviarCatalogo(api, pid) {
  const claves = Object.keys(CARTAS);
  for (let i = 0; i < claves.length; i += 6) {
    const parte = {};
    for (const k of claves.slice(i, i + 6)) parte[k] = { ...CARTAS[k], rareza: RAREZAS[k] || "comun" };
    api.sendTo(pid, "ahspai_catalogo", { parte, total: claves.length });
  }
}
const sesiones = new Map();  // idJugador -> usuario con el que entró
const mazosSesion = new Map(); // idJugador -> mazo activo listo para jugar (o nada = mazo de prueba)
// ¿Está en línea / jugando este usuario?
function pidsDe(usuario) { const out = []; for (const [pid, u] of sesiones) if (u === usuario) out.push(pid); return out; }
function enPartida(pid) { for (const pt of partidas.values()) if (pt.g.fase !== "terminada" && pt.asientos.has(pid)) return true; return false; }
const intentos = new Map();  // idJugador -> { n, desde } (para frenar a quien prueba contraseñas)
CUENTAS.iniciar().catch(() => {}); // conecta a la base al arrancar (si falla, reintenta luego)

function demasiadosIntentos(pid) {
  const ahora = Date.now();
  const i = intentos.get(pid) || { n: 0, desde: ahora };
  if (ahora - i.desde > 60000) { i.n = 0; i.desde = ahora; }
  i.n++;
  intentos.set(pid, i);
  return i.n > 8; // más de 8 intentos por minuto
}

// Guarda el mazo activo de esa sesión (para la partida) y no lo manda al juego
function conMazo(pid, r) {
  if (r && "mazo" in r) {
    if (r.mazo) mazosSesion.set(pid, r.mazo); else mazosSesion.delete(pid);
    delete r.mazo;
  }
  return r;
}

// Al terminar la partida: monedas y estadísticas a cada jugador con cuenta (una sola vez)
function ahspaiPremiar(api, pt) {
  if (pt.premiado || pt.g.fase !== "terminada") return;
  pt.premiado = true;
  for (const [pid, asiento] of pt.asientos) {
    const usuario = sesiones.get(pid);
    if (!usuario) continue;
    const equipo = pt.g.jugadores[asiento].equipo;
    const resultado = pt.g.ganador === null ? "empatada" : (pt.g.ganador === equipo ? "ganada" : "perdida");
    CUENTAS.premiar(usuario, resultado)
      .then((r) => { if (r) api.sendTo(pid, "ahspai_premio", { resultado, monedas: r.monedas, perfil: r.perfil }); })
      .catch((e) => api.log("[Ahspai] No se pudo guardar el premio de " + usuario + ": " + e.message));
  }
}

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
  ahspaiPremiar(api, pt);
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
    { modo: modo.startsWith("ffa") ? "ffa" : modo, puntos: Number(puntos) || 30, jugadores: jugadores.map((p) => ({ id: p.id, mazo: mazosSesion.get(p.id) || mazoPrueba() })) },
    CARTAS
  );
  const asientos = new Map(jugadores.map((p, i) => [p.id, i]));
  partidas.set(sala, { g, asientos, modo });
  api.log(`[Ahspai] Partida ${modo} en "${sala}": ${jugadores.map((p) => p.id).join(", ")}`);
  for (const [pid, asiento] of asientos) ahspaiEnviarInicio(api, pid, asiento, modo);
  ahspaiEnviarEstado(api, sala, []);
  return null;
}

// ---------- Reconexión ----------
// Si alguien con cuenta se sale de una partida en curso (se le cayó el internet, cerró el juego...),
// tiene ESPERA_VOLVER ms para volver a entrar con su cuenta. Si no vuelve, se rinde solo.
const ESPERA_VOLVER = Number(process.env.AHSPAI_ESPERA_VOLVER) || 60000;

function avisarSala(api, pt, evento, datos) {
  for (const pid of pt.asientos.keys()) api.sendTo(pid, evento, datos);
}

function ahspaiSalio(api, p, sala) {
  const pt = partidas.get(sala);
  if (!pt) return;
  const asiento = pt.asientos.get(p.id);
  if (asiento !== undefined) {
    pt.asientos.delete(p.id);
    const usuario = sesiones.get(p.id);
    const enCurso = pt.g.fase !== "terminada" && !pt.g.jugadores[asiento].eliminado;
    if (enCurso && usuario) {
      // Le guardamos el lugar un rato
      pt.ausentes = pt.ausentes || new Map();
      const timer = setTimeout(() => {
        const a = pt.ausentes.get(usuario);
        if (!a) return;
        pt.ausentes.delete(usuario);
        const r = motor.jugar(pt.g, a.asiento, { tipo: "rendirse" });
        if (r.ok) ahspaiEnviarEstado(api, sala, r.eventos);
        if (pt.asientos.size === 0 && pt.ausentes.size === 0) partidas.delete(sala);
      }, ESPERA_VOLVER);
      pt.ausentes.set(usuario, { asiento, timer, hasta: Date.now() + ESPERA_VOLVER });
      avisarSala(api, pt, "ahspai_ausente", { asiento, segundos: Math.round(ESPERA_VOLVER / 1000) });
      return;
    }
    if (enCurso) {
      // Sin cuenta: salirse = rendirse
      const r = motor.jugar(pt.g, asiento, { tipo: "rendirse" });
      if (r.ok) ahspaiEnviarEstado(api, sala, r.eventos);
    }
  }
  if (pt.asientos.size === 0 && !(pt.ausentes && pt.ausentes.size)) partidas.delete(sala);
}

// Al entrar con la cuenta: si tenía una partida esperándolo, lo devuelve a su lugar
function ahspaiVolver(api, pid, usuario) {
  for (const [sala, pt] of partidas) {
    const a = pt.ausentes && pt.ausentes.get(usuario);
    if (!a) continue;
    clearTimeout(a.timer);
    pt.ausentes.delete(usuario);
    if (pt.g.fase === "terminada" || pt.g.jugadores[a.asiento].eliminado) return false;
    pt.asientos.set(pid, a.asiento);
    api.moveToRoom(pid, sala, TAM[pt.modo] || 0);
    ahspaiEnviarInicio(api, pid, a.asiento, pt.modo);
    api.sendTo(pid, "ahspai_estado", { vista: motor.vistaPara(pt.g, a.asiento), eventos: [] });
    for (const otro of pt.asientos.keys()) if (otro !== pid) api.sendTo(otro, "ahspai_volvio", { asiento: a.asiento });
    return true;
  }
  return false;
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

  onDisconnect(api, p) {
    sesiones.delete(p.id);
    mazosSesion.delete(p.id);
    intentos.delete(p.id);
  },

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
    // ---------- Cuentas de Ahspai ----------
    if (p.gameId === AHSPAI && name.startsWith("cuenta_")) {
      if (name === "cuenta_crear" || name === "cuenta_entrar") {
        if (demasiadosIntentos(p.id)) throw new Error("espera_un_minuto");
        const r = name === "cuenta_crear"
          ? await CUENTAS.crear(data?.usuario, data?.clave)
          : await CUENTAS.entrar(data?.usuario, data?.clave);
        sesiones.set(p.id, r.perfil.usuario);
        conMazo(p.id, r);
        ahspaiEnviarCatalogo(api, p.id);
        r.volvio_a_partida = ahspaiVolver(api, p.id, r.perfil.usuario);
        return r;
      }
      if (name === "cuenta_token") {
        if (demasiadosIntentos(p.id)) throw new Error("espera_un_minuto");
        const r = await CUENTAS.conToken(data?.token);
        sesiones.set(p.id, r.perfil.usuario);
        conMazo(p.id, r);
        ahspaiEnviarCatalogo(api, p.id);
        r.volvio_a_partida = ahspaiVolver(api, p.id, r.perfil.usuario);
        return r;
      }
      const usuario = sesiones.get(p.id);
      if (!usuario) throw new Error("no_has_entrado");
      if (name === "cuenta_perfil") return await CUENTAS.verPerfil(usuario);
      if (name === "cuenta_coleccion") return await CUENTAS.verColeccion(usuario);
      // Mazos
      if (name === "cuenta_mazos") return await CUENTAS.verMazos(usuario);
      if (name === "cuenta_guardar_mazo") return conMazo(p.id, await CUENTAS.guardarMazo(usuario, data?.slot, data?.mazo));
      if (name === "cuenta_borrar_mazo") return conMazo(p.id, await CUENTAS.borrarMazo(usuario, data?.slot));
      if (name === "cuenta_activar_mazo") return conMazo(p.id, await CUENTAS.activarMazo(usuario, data?.slot));
      // Tienda y perfil
      if (name === "cuenta_comprar") return await CUENTAS.comprarSobre(usuario, String(data?.sobre || ""));
      if (name === "cuenta_foto") return await CUENTAS.cambiarFoto(usuario, String(data?.carta || ""));
      if (name === "cuenta_ver_perfil") return await CUENTAS.perfilPublico(data?.usuario);
      // Amigos
      if (name === "cuenta_amigos") {
        const r = await CUENTAS.listaAmigos(usuario);
        for (const a of r.amigos) { const ps = pidsDe(a.usuario); a.en_linea = ps.length > 0; a.en_partida = ps.some(enPartida); }
        return r;
      }
      if (name === "cuenta_solicitar") {
        const r = await CUENTAS.solicitar(usuario, data?.usuario);
        for (const pid of pidsDe(String(data?.usuario || "").toLowerCase())) api.sendTo(pid, "ahspai_aviso_amigos", {});
        return r;
      }
      if (name === "cuenta_responder") return await CUENTAS.responder(usuario, data?.usuario, !!data?.aceptar);
      if (name === "cuenta_quitar_amigo") return await CUENTAS.quitarAmigo(usuario, data?.usuario);
      if (name === "cuenta_invitar") {
        const otro = String(data?.usuario || "").toLowerCase();
        if (!(await CUENTAS.sonAmigos(usuario, otro))) throw new Error("no_son_amigos");
        const ps = pidsDe(otro).filter((x) => !enPartida(x));
        if (!ps.length) throw new Error("tu_amigo_no_esta_disponible");
        const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        let codigo = "";
        for (let i = 0; i < 4; i++) codigo += letras[Math.floor(Math.random() * letras.length)];
        const yo = await CUENTAS.verPerfil(usuario);
        for (const pid of ps) api.sendTo(pid, "ahspai_invitacion", { de: yo.nombre, codigo, puntos: Number(data?.puntos) || 30 });
        return { codigo };
      }
      if (name === "cuenta_salir") { sesiones.delete(p.id); await CUENTAS.salir(usuario, data?.token); return ""; }
      throw new Error("pregunta_desconocida");
    }
    if (name === "hora_servidor") return { hora: new Date().toISOString() };
    if (name === "sumar") return Number(data?.a || 0) + Number(data?.b || 0);
    throw new Error("pregunta_desconocida");
  },

  // Se llama 10 veces por segundo (bórrala si no la usas)
  // onTick(api) {},
};
