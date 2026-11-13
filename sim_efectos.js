// Simulación dura de efectos: bots al azar que usan TODAS las jugadas.  node sim_efectos.js [partidas]
// Revisa que ninguna carta se pierda o se duplique y que ningún efecto tire error.
const M = require("./motor.js"), C = require("./cartas.js");
const ids = Object.keys(C);
const lim = (c) => c.sobrenatural ? 2 : c.tipo === "estructura" ? 3 : ({ peon: 4, belico: 3, heroe: 3, lider: 1 })[c.alineamiento] ?? 3;
const pick = (f, n, desde = 0) => { const out = []; const L = [...ids.slice(desde), ...ids.slice(0, desde)]; for (const id of L) { const c = C[id]; if (!f(c)) continue; for (let k = 0; k < lim(c) && out.length < n; k++) out.push(id); } return out; };
const mazoAzar = (s) => ({ principal: pick((c) => c.tipo !== "estructura" && !c.sobrenatural, 40, s), sobrenatural: pick((c) => c.sobrenatural, 12, s), recursos: pick((c) => c.tipo === "estructura", 12, s) });
const rnd = (n) => Math.floor(Math.random() * n), uno = (a) => a[rnd(a.length)];
const total = (j) => ["principal", "recursos", "sobrenatural", "mano", "reserva", "mausoleo", "reciclaje", "abismo"].reduce((n, z) => n + j[z].length, 0)
  + [...j.batalla, ...j.defensa].filter(Boolean).reduce((n, c) => n + cuenta(c), 0) + j.permanentes.filter(Boolean).length;
const cuenta = (c) => 1 + [...(c.acuartelados || []), ...(c.equipos || [])].reduce((n, x) => n + cuenta(x), 0);
const N = Number(process.argv[2] || 300);
let fin = 0, turnos = 0, errores = {}, efErr = {}, usados = {}, perdidas = 0, atascadas = 0;
for (let p = 0; p < N; p++) {
  const g = M.crearPartida({ modo: "1v1", jugadores: [{ id: 1, mazo: mazoAzar(rnd(ids.length)) }, { id: 2, mazo: mazoAzar(rnd(ids.length)) }] }, C);
  const inicial = g.jugadores.map(total);
  // Toda jugada pasa por aquí: resuelve las preguntas de las cartas al azar
  const J = (s, a) => {
    const r = M.jugar(g, s, a);
    if (!r.ok) errores[r.error] = (errores[r.error] || 0) + 1;
    for (const e of r.eventos) { if (e.tipo === "efecto_error") efErr[e.carta + ": " + e.error] = (efErr[e.carta + ": " + e.error] || 0) + 1; if (e.tipo === "activada" || e.tipo === "bajada" || e.tipo === "efecto_usado") usados[e.carta] = 1; }
    let k = 0;
    while (g.pendiente && k++ < 50) {
      const pd = g.pendiente;
      if (pd.tipo === "opcion") J(pd.jugador, { tipo: "elegir", opcion: rnd(pd.opciones.length) });
      else { const n = pd.min + rnd(pd.max - pd.min + 1); const op = [...pd.opciones].sort(() => Math.random() - 0.5).slice(0, n); J(pd.jugador, { tipo: "elegir", uids: op.map((o) => o.uid) }); }
    }
    const tg = g.jugadores.reduce((n, j) => n + total(j), 0), ti = inicial.reduce((x, y) => x + y, 0);
    if (tg !== ti) { perdidas++; if (perdidas < 6) console.log("CARTAS", a.tipo, JSON.stringify(a).slice(0, 60), r.eventos.map((e) => e.carta || e.tipo).join(","), tg, ti); g.jugadores.forEach((j, i) => { inicial[i] = total(j); }); }
    return r;
  };
  const resp = () => { let k = 0; while (g.ataque && !g.ataque.respondido && k++ < 10) { const d = g.ataque.defensores[0]; const jg = M.vistaPara(g, d).jugables_defensa; if (jg.length && Math.random() < 0.6) J(d, { tipo: "responder", uid: uno(jg).uid }); else J(d, { tipo: "responder" }); } };
  M.jugar(g, 0, { tipo: "mano_inicial", de_recursos: 2 }); M.jugar(g, 1, { tipo: "mano_inicial", de_recursos: 2 });
  let n = 0;
  while (g.fase !== "terminada" && n++ < 300) {
    resp();
    const s = g.actual, j = g.jugadores[s];
    if (!J(s, { tipo: "robar", mazo: "principal" }).ok) J(s, { tipo: "robar", mazo: "recursos" });
    for (const c of [...j.mano]) if (C[c.carta].tipo === "estructura" && Math.random() < 0.6) J(s, { tipo: "jugar_recurso", uid: c.uid });
    for (const c of [...j.mano]) {
      const t = C[c.carta].tipo;
      if (t === "suceso" || t === "objeto") { if (Math.random() < 0.5) J(s, { tipo: "activar", uid: c.uid }); else J(s, { tipo: "colocar_boca_abajo", uid: c.uid }); }
    }
    for (const c of [...j.mano, ...j.sobrenatural]) J(s, { tipo: "bajar", uid: c.uid, desde: j.sobrenatural.includes(c) ? "sobrenatural" : "mano", zona: Math.random() < 0.7 ? "batalla" : "defensa", casilla: rnd(5), pos: Math.random() < 0.7 ? "atk" : "def" });
    for (const c of j.permanentes.filter(Boolean)) if (Math.random() < 0.3) J(s, { tipo: "activar", uid: c.uid });
    const mios = [...j.batalla, ...j.defensa].filter(Boolean);
    for (const c of mios) if (Math.random() < 0.3) J(s, { tipo: "usar_efecto", uid: c.uid });
    for (const c of [...mios, ...j.permanentes.filter(Boolean)]) if ((C[c.carta].acciones || []).includes("hospitalidad")) J(s, { tipo: "hospitalidad", uid: c.uid });
    if (mios.length > 1 && Math.random() < 0.3) J(s, { tipo: "equipar", uid: uno(mios).uid, objetivo: uno(mios).uid });
    const ests = mios.filter((c) => c.cuartel !== undefined || C[c.carta].acuartelar);
    if (ests.length && Math.random() < 0.4) J(s, { tipo: "acuartelar", uid: uno(mios).uid, estructura: uno(ests).uid, bono: Math.random() < 0.5 ? "atk" : "def" });
    J(s, { tipo: "ir_batalla" });
    for (const c of j.batalla.filter(Boolean)) {
      resp(); if (Math.random() < 0.3) J(s, { tipo: "usar_efecto", uid: c.uid });
      const r = g.jugadores.find((o) => o.equipo !== j.equipo); const o = [...r.batalla, ...r.defensa].filter(Boolean);
      const ag = (C[c.carta].acciones || []).includes("agrupar") ? j.batalla.filter((x) => x && x !== c && !x.ataco && (C[x.carta].acciones || []).includes("agrupar")).map((x) => x.uid) : [];
      const base = o.length ? { tipo: "atacar", uid: c.uid, objetivo: uno(o).uid } : { tipo: "atacar", uid: c.uid, jugador: r.asiento };
      if (ag.length && Math.random() < 0.6) base.agrupar = ag;
      J(s, base);
      resp();
    }
    J(s, { tipo: "ir_nucleo2" });
    for (let k = 0; k < 20 && j.mano.length > 10; k++) J(s, { tipo: "descartar", uid: j.mano[0].uid });
    J(s, { tipo: "terminar_turno" });
    if (g.pendiente) { atascadas++; break; }
  }
  if (g.fase === "terminada") fin++; turnos += g.turno;
}
console.log(`partidas terminadas ${fin}/${N} · turnos promedio ${(turnos / N).toFixed(1)} · atascadas ${atascadas} · cartas perdidas/duplicadas ${perdidas}`);
console.log("cartas que se jugaron:", Object.keys(usados).length, "de", ids.length);
console.log("errores de efectos:", Object.keys(efErr).length ? efErr : "ninguno");
