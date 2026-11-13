// Simulación rápida con un mazo hecho de cartas reales:  node sim_reales.js
const M = require("./motor.js"), C = require("./cartas.js");
// Si una carta pregunta algo, se contesta lo mínimo (para que la simulación no se trabe)
const J0 = M.jugar;
M.jugar = (g, s, a) => { const r = J0(g, s, a); let k = 0; while (g.pendiente && k++ < 50) { const p = g.pendiente; J0(g, p.jugador, p.tipo === "opcion" ? { tipo: "elegir", opcion: 0 } : { tipo: "elegir", uids: p.opciones.slice(0, p.min).map((o) => o.uid) }); } return r; };
const ids = Object.keys(C);
const lim = (c) => c.sobrenatural ? 2 : c.tipo === "estructura" ? 3 : ({ peon: 4, belico: 3, heroe: 3, lider: 1 })[c.alineamiento] ?? 3;
const pick = (f, n) => { const out = []; for (const id of ids) { const c = C[id]; if (!f(c)) continue; for (let k = 0; k < lim(c) && out.length < n; k++) out.push(id); } return out; };
const mazo = { principal: pick((c) => c.tipo !== "estructura" && !c.sobrenatural, 40), sobrenatural: pick((c) => c.sobrenatural, 12), recursos: pick((c) => c.tipo === "estructura", 12) };
console.log("mazo:", mazo.principal.length, mazo.sobrenatural.length, mazo.recursos.length, "valido:", M.validarMazo(mazo, C));
let fin = 0, turnos = 0, bajadas = 0, errores = {};
for (let p = 0; p < 200; p++) {
  const g = M.crearPartida({ modo: "1v1", jugadores: [{ id: 1, mazo }, { id: 2, mazo }] }, C);
  M.jugar(g, 0, { tipo: "mano_inicial", de_recursos: 2 }); M.jugar(g, 1, { tipo: "mano_inicial", de_recursos: 2 });
  let n = 0;
  const resp = () => { let k = 0; while (g.ataque && k++ < 10) M.jugar(g, g.ataque.defensores[0], { tipo: "responder" }); };
  while (g.fase !== "terminada" && n++ < 400) {
    resp();
    const s = g.actual, j = g.jugadores[s];
    if (!M.jugar(g, s, { tipo: "robar", mazo: "principal" }).ok) M.jugar(g, s, { tipo: "robar", mazo: "recursos" });
    for (const c of [...j.mano]) M.jugar(g, s, { tipo: "jugar_recurso", uid: c.uid });
    for (const c of [...j.mano, ...j.sobrenatural]) for (let k = 0; k < 5; k++) {
      const r = M.jugar(g, s, { tipo: "bajar", uid: c.uid, desde: j.sobrenatural.includes(c) ? "sobrenatural" : "mano", casilla: k });
      if (r.ok) { bajadas++; break; } errores[r.error] = (errores[r.error] || 0) + 1; if (r.error !== "casilla_ocupada") break;
    }
    M.jugar(g, s, { tipo: "ir_batalla" });
    for (const c of j.batalla.filter(Boolean)) {
      resp(); const r = g.jugadores.find((o) => o.equipo !== j.equipo); const o = [...r.batalla, ...r.defensa].find(Boolean);
      M.jugar(g, s, o ? { tipo: "atacar", uid: c.uid, objetivo: o.uid } : { tipo: "atacar", uid: c.uid, jugador: r.asiento });
    }
    resp();
    M.jugar(g, s, { tipo: "ir_nucleo2" });
    for (let k = 0; k < 20 && j.mano.length > 10; k++) M.jugar(g, s, { tipo: "descartar", uid: j.mano[0].uid });
    M.jugar(g, s, { tipo: "terminar_turno" });
  }
  if (g.fase === "terminada") fin++; turnos += g.turno;
}
console.log("partidas terminadas", fin, "/200 · turnos promedio", (turnos / 200).toFixed(1), "· bajadas", bajadas);
console.log("jugadas rechazadas (normal que haya):", errores);
