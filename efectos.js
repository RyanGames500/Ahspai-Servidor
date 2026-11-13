// =====================================================================
// AHSPAI - Efectos de cada carta
// Cada carta puede tener:
//   alBajar, alActivar, alDerrotar : pasos (o función que devuelve pasos)
//   aura(g, fuente, jugFuente, objetivo, jugObjetivo) -> { ataque, defensa }  (efectos "(En tablero)")
//   equipa: { objetivo: filtro, mods: [{ataque, defensa, dura}] }   (objetos que se equipan)
//   equipable: { objetivo: filtro }                                (unidades que se equipan a otra)
//   usar: { etapas, pasos(g, ctx, inst) }                          (efecto que activas 1 vez por turno)
//   permanente: true                                               (se queda en la zona de sucesos)
//   inmune(g, inst, ctx) -> true si no puede ser elegida por ese efecto
// Pasos: { op: "elegir" | "opcion" | "mover" | "fn" } (ver motor.js)
// =====================================================================
"use strict";
module.exports = function (M) {
  const { carta } = M;
  // ---------- Ayudas para escribir efectos ----------
  const Y = (zona) => ({ j: "yo", zona }), R = (zona) => ({ j: "rival", zona }), T = (zona) => ({ j: "todos", zona });
  const elegir = (de, filtro, o = {}) => ({ op: "elegir", de: Array.isArray(de) ? de : [de], filtro, min: o.min, max: o.max, titulo: o.titulo, guardar: o.guardar });
  const mover = (a, que = "sel", extra = {}) => ({ op: "mover", a, que, ...extra });
  const fn = (f) => ({ op: "fn", f });
  const opcion = (titulo, ops) => ({ op: "opcion", titulo, opciones: ops.map((o) => o[0]), ramas: ops.map((o) => o[1]) });
  const sel = (ctx, k = "sel") => ctx.vars[k] || [];
  const ganar = (rec) => fn((g, ctx, ev, yo) => {
    const r = g.equipos[yo.equipo].recursos;
    for (const k of Object.keys(rec)) r[k] = (r[k] || 0) + rec[k];
    ev.push({ tipo: "genera", equipo: yo.equipo, recursos: rec });
  });
  const cadaSel = (f, k = "sel") => fn((g, ctx, ev, yo) => { for (const inst of sel(ctx, k)) f(g, inst, ev, yo, ctx); });
  const herirSel = (n) => cadaSel((g, inst, ev) => { M.herir(inst, n); ev.push({ tipo: "herida", uid: inst.uid, cantidad: n }); });
  const contSel = (n) => cadaSel((g, inst, ev) => { M.contusionar(inst, n); ev.push({ tipo: "contusion", uid: inst.uid, cantidad: n }); });
  const enviarSel = (a, k = "sel") => cadaSel((g, inst, ev, yo) => M.mover(g, inst, a, a === "mano" ? yo : null, ev), k);
  // Bajar una carta gratis (genera recursos y dispara su "Al bajar")
  const bajarGratis = (k = "sel") => cadaSel((g, inst, ev, yo) => {
    const c = carta(g, inst);
    if (c.tipo === "suceso" || c.tipo === "objeto") { const l = M.ubicar(g, inst.uid); M.activarCarta(g, yo, inst, l, ev, "gratis"); return; }
    if (!M.mover(g, inst, "colocar", yo, ev)) return;
    if (c.genera) { const r = g.equipos[yo.equipo].recursos; for (const x of M.RECURSOS) r[x] += c.genera[x] || 0; }
    M.disparar(g, inst, "alBajar", yo.asiento);
  }, k);
  const activarGratis = (k = "sel") => cadaSel((g, inst, ev, yo) => { const l = M.ubicar(g, inst.uid); if (l) M.activarCarta(g, yo, inst, l, ev, "gratis"); }, k);
  const tomarTope = (mazo, n) => fn((g, ctx, ev, yo) => { for (let i = 0; i < n; i++) M.robar(g, yo, mazo, ev); });
  const mismoTablero = (g, a, b) => M.cartasEnTablero(a).includes(b);
  const enZona = (j, inst, zona) => j[zona].includes(inst);
  const es = (g, inst, f) => M.filtro(f)(g, inst);
  const HUM = { tipo: "unidad", especie: "humano" };
  const HUM_ANI = { tipo: "unidad", especie: ["humano", "animal"] };
  const COM_ESP = ["comun", "especial"];

  const cartas = {
    // ================= AHAHO =================
    "AHA-28": { // Aclla de Hampatu (Honor lo calcula el motor)
      alBajar: [elegir(Y("principal"), { nombre: "Hampatu" }, { titulo: "Busca una carta con Hampatu y bájala o actívala gratis" }), bajarGratis()],
      aura: (g, f, jf, o, jo) => (jf === jo && enZona(jf, f, "batalla") && es(g, o, { tipo: "unidad", especie: "animal", clase: "comun", elemento: "agua" }) ? { ataque: 1, defensa: 1 } : null),
    },
    "AHA-25": { // Ama Sua, Ama Llulla, Ama Quella
      alActivar: [opcion("Ama Sua: elige un efecto", [
        ["Baja una unidad humana comun/especial gratis", [elegir(Y("mano"), { ...HUM, clase: COM_ESP }, { min: 1, titulo: "Elige la unidad a bajar gratis" }), bajarGratis()]],
        ["Anula el efecto de un suceso simple", [fn((g, ctx, ev) => ev.push({ tipo: "anulado", carta: ctx.carta, nota: "sin_efecto_que_anular" }))]],
        ["Ambos revelan sus cartas", [fn((g, ctx, ev) => { for (const j of g.jugadores) ev.push({ tipo: "mano_revelada", jugador: j.asiento, cartas: j.mano.map((c) => c.carta) }); })]],
      ])],
    },
    "AHA-15": { alBajar: [elegir(Y("reciclaje"), null, { min: 1, titulo: "Toma una carta del reciclaje" }), mover("mano")] }, // Ayni
    "AHA-27": { // Coca
      alActivar: [opcion("Coca: a tus Unidades Humanas este turno", [
        ["+3 de defensa", [fn((g, ctx, ev, yo) => { for (const c of M.cartasEnTablero(yo)) if (es(g, c, HUM)) M.modificar(c, 0, 3, "turno", "Coca"); })]],
        ["+2 de ataque", [fn((g, ctx, ev, yo) => { for (const c of M.cartasEnTablero(yo)) if (es(g, c, HUM)) M.modificar(c, 2, 0, "turno", "Coca"); })]],
      ])],
    },
    "AHA-04": { // Cóndor Andino
      alBajar: [elegir(T("campo"), { tipo: "unidad", especie: "animal", clase: COM_ESP, maxDefensa: 3, si: (g, i) => true }, { titulo: "Puedes elegir 1 Unidad Animal (DEF 3 o menos)" }),
        fn((g, ctx) => { if (!sel(ctx).length) ctx.pasos.length = 0; }),
        opcion("Cóndor Andino: ¿qué le haces?", [
          ["Enviarla a su mazo", [enviarSel("mazo")]],
          ["Cambiarla de posición", [cadaSel((g, inst, ev) => { inst.pos = inst.pos === "atk" ? "def" : "atk"; ev.push({ tipo: "cambio", uid: inst.uid, pos: inst.pos }); })]],
          ["Tomar su control", [cadaSel((g, inst, ev, yo) => { if (M.mover(g, inst, "colocar", yo, ev)) inst.controla = yo.asiento; })]],
        ])],
    },
    "AHA-22": { // Guallcanga del Supay
      alActivar: [elegir(T("campo"), HUM, { min: 1, titulo: "Equipa Guallcanga a una Unidad Humana" }),
        fn((g, ctx, ev) => { const o = sel(ctx)[0]; const yo = g.jugadores[ctx.jugador]; const obj = yo.reciclaje.find((c) => c.uid === ctx.fuente); if (!o || !obj) return; M.equiparA(g, obj, o, ev, [{ defensa: 5 }]); o.pos = "def"; o.soloDefensa = true; })],
      equipa: { objetivo: HUM, mods: [{ defensa: 5 }] },
    },
    "AHA-34": { // Furufurhue
      inmune: (g, inst) => inst.pos === "def",
      usar: { etapas: ["batalla"], pasos: (g, ctx, inst) => {
        const yo = g.jugadores[ctx.jugador]; const cre = g.equipos[yo.equipo].recursos.creencia;
        const ops = []; for (let x = 1; x <= Math.min(cre, 6); x++) ops.push([`Pagar ${x} de Creencia: +${x} DEF`, [fn((gg, c, ev, y) => { gg.equipos[y.equipo].recursos.creencia -= x; M.modificar(inst, 0, x, "turno", "Furufurhue"); })]]);
        return ops.length ? [opcion("Furufurhue: ¿cuánta Creencia pagas?", ops)] : [];
      } },
    },
    "AHA-30": { // Golpe Zonda
      alActivar: (g, ctx) => {
        const pasos = [
          elegir(Y("campo"), { tipo: "estructura" }, { min: 1, titulo: "Golpe Zonda: destruye una estructura TUYA", guardar: "mia" }),
          elegir(R("campo"), { tipo: "estructura" }, { min: 1, titulo: "Golpe Zonda: destruye una estructura del OPONENTE", guardar: "suya" }),
          fn((gg, c, ev) => { for (const i of [...sel(c, "mia"), ...sel(c, "suya")]) M.derrotar(gg, i, ev); }),
          elegir(Y("campo"), HUM, { min: 1, titulo: "Envía una carta humana de tu tablero a tu mazo" }), enviarSel("mazo"),
          fn((gg, c, ev) => { // cada oponente manda una humana suya a su mazo (elige él)
            const yo = gg.jugadores[c.jugador];
            for (const r of M.rivales(gg, yo)) M.encolar(gg, r.asiento, { uid: c.fuente, carta: c.carta }, [elegir(Y("campo"), HUM, { min: 1, titulo: "Golpe Zonda: envía una carta humana de tu tablero a tu mazo" }), enviarSel("mazo"), tomarTope("principal", 1)], "golpe_zonda");
          }),
          tomarTope("principal", 1),
        ];
        return pasos;
      },
    },
    "AHA-23": { // Hacha Arrojadiza
      alActivar: [elegir(T("campo"), { tipo: "unidad", alineamiento: "belico" }, { min: 1, titulo: "Equipa el Hacha a una Unidad Bélica" }),
        fn((g, ctx, ev) => { const o = sel(ctx)[0]; const obj = g.jugadores[ctx.jugador].reciclaje.find((c) => c.uid === ctx.fuente); if (o && obj) M.equiparA(g, obj, o, ev, [{ ataque: 2, dura: "hasta_atacar" }]); })],
      equipa: { objetivo: { tipo: "unidad", alineamiento: "belico" }, mods: [{ ataque: 2, dura: "hasta_atacar" }] },
      descartarAlAtacar: true,
    },
    "AHA-31": { alActivar: [elegir([Y("principal"), Y("mausoleo")], { tipo: "unidad", especie: "humano", clase: "imperial", naturaleza: "masculino" }, { min: 1, titulo: "Busca una humana imperial masculina" }), mover("mano")] }, // Huevo de Oro
    "AHA-32": { // Hurkaway
      alActivar: [
        elegir(Y("mausoleo"), null, { max: 3, titulo: "Hasta 3 cartas de TU Mausoleo al Abismo", guardar: "a" }), enviarSel("abismo", "a"),
        elegir(R("mausoleo"), null, { max: 3, titulo: "Hasta 3 cartas del Mausoleo oponente al Abismo", guardar: "b" }), enviarSel("abismo", "b"),
        opcion("Toma hasta 3 cartas del tope", [["3 del Principal", [tomarTope("principal", 3)]], ["2 del Principal y 1 de Recursos", [tomarTope("principal", 2), tomarTope("recursos", 1)]], ["1 del Principal y 2 de Recursos", [tomarTope("principal", 1), tomarTope("recursos", 2)]], ["3 de Recursos", [tomarTope("recursos", 3)]]]),
        fn((g, ctx) => {
          const yo = g.jugadores[ctx.jugador];
          for (const r of M.rivales(g, yo)) {
            const uno = opcion("Hurkaway: genera 1 recurso", [["Alimento", [ganar({ alimento: 1 })]], ["Capital", [ganar({ capital: 1 })]], ["Creencia", [ganar({ creencia: 1 })]]]);
            M.encolar(g, r.asiento, { uid: ctx.fuente, carta: ctx.carta }, [uno, uno, uno], "hurkaway");
          }
        }),
      ],
    },
    "AHA-05": { // Kalla de los Cerros
      usar: { etapas: ["nucleo1", "nucleo2", "batalla"], pasos: (g, ctx) => {
        const yo = g.jugadores[ctx.jugador];
        if (g.equipos[yo.equipo].recursos.capital < 1) return [];
        return [elegir(T("tablero"), null, { titulo: "Paga 1 Capital: 1 de Contusión a una carta" }), fn((gg, c) => { if (sel(c).length) gg.equipos[yo.equipo].recursos.capital -= 1; }), contSel(1)];
      } },
    },
    "AHA-16": { alBajar: [elegir(Y("mausoleo"), { tipo: "estructura" }, { titulo: "Puedes mandar una estructura del Mausoleo al mazo de Recursos" }), mover("recursos")] }, // Minka
    "AHA-17": { alBajar: [elegir(Y("principal"), { ...HUM, clase: "comun" }, { max: 2, titulo: "Hasta 2 humanas comunes a tu mano" }), mover("mano")] }, // Mita
    "AHA-37": { // Pillán
      alBajar: [elegir(T("campo"), HUM_ANI, { min: 1, titulo: "Esa unidad no podrá atacar el siguiente turno" }), cadaSel((g, inst, ev) => { inst.noAtacaHasta = g.turno + g.jugadores.length; ev.push({ tipo: "no_ataca", uid: inst.uid }); })],
    },
    "AHA-18": { // Pirca
      alBajar: (g, ctx, inst) => [elegir(Y("campo"), { tipo: "unidad", si: (gg, u) => u !== inst }, { max: 3, titulo: "Puedes acuartelar hasta 3 unidades en Pirca" }),
        cadaSel((gg, u, ev, yo) => { const l = M.ubicar(gg, u.uid); if (!l || (inst.acuartelados || []).length >= 3) return; l.quitar(); u.bonoCuartel = "def"; u.acuarteloTurno = gg.turno; if (!inst.acuartelados) inst.acuartelados = []; inst.acuartelados.push(u); ev.push({ tipo: "acuartelada", jugador: yo.asiento, uid: u.uid, carta: u.carta, estructura: inst.uid, desde: "campo", bono: "def" }); })],
      alDesacuartelar: (g, u) => { if (!u.bonoPirca) { u.bonoPirca = true; M.modificar(u, 1, 1, "siempre", "Pirca"); } },
    },
    "AHA-33": { alActivar: [ganar({ alimento: 3, capital: 3 }), elegir(Y("principal"), { tipo: "suceso", elemento: "luz" }, { min: 1, titulo: "Busca un Suceso de LUZ" }), mover("mano")] }, // Primera Estrella
    "AHA-40": { alBajar: [ganar({ alimento: 3 })] }, // Sachayoj (falta: reemplazar a una estructura TIERRA)
    "AHA-19": { alBajar: [elegir(Y("principal"), { elemento: "luz" }, { min: 1, titulo: "Agrega una carta de LUZ a tu mano" }), mover("mano")] }, // Templo del Sol
    "AHA-06": { // Willak Uma
      alBajar: (g, ctx) => {
        const yo = g.jugadores[ctx.jugador];
        const rec = g.equipos[yo.equipo].recursos;
        const pagable = (gg, i) => { const c = carta(gg, i).costo || {}; return (rec.alimento >= (c.alimento || 0)) && (rec.capital >= (c.capital || 0)) && (rec.creencia >= Math.max(0, (c.creencia || 0) - 2)); };
        return [elegir([Y("sobrenatural"), Y("mano")], { tipo: "unidad", sobrenatural: true, noElemento: "oscuridad", si: pagable }, { titulo: "Puedes bajar una Sobrenatural (no OSCURIDAD) con -2 de Creencia" }),
          cadaSel((gg, i, ev, y) => { const c = carta(gg, i).costo || {}; const r = gg.equipos[y.equipo].recursos; r.alimento -= c.alimento || 0; r.capital -= c.capital || 0; r.creencia -= Math.max(0, (c.creencia || 0) - 2); }), bajarGratis()];
      },
      inmune: (g, inst, ctx) => { const c = g.cartas[ctx.carta] || {}; return (c.tipo === "suceso" || c.tipo === "objeto") && (c.elemento || []).includes("oscuridad"); },
    },

    // ================= ENCUENTRO =================
    "ENC-03": { alBajar: [elegir(T("campo"), { ...HUM_ANI, clase: COM_ESP, maxDefensa: 4 }, { min: 1, titulo: "Envía al Mausoleo una Humana o Animal (DEF 4 o menos)" }), enviarSel("mausoleo")] }, // Arcabucero
    "ENC-37": { // Arcángel Uriel
      alBajar: [opcion("Arcángel Uriel: elige un efecto", [
        ["Mira el mazo rival y manda una OSCURIDAD al Abismo", [elegir(R("principal"), { elemento: "oscuridad" }, { min: 1, titulo: "Elige una carta de OSCURIDAD" }), enviarSel("abismo")]],
        ["Pon 1 carta de tu Principal y 1 de Recursos en el tope", [
          elegir(Y("principal"), { noElemento: "oscuridad" }, { min: 1, titulo: "Carta del Principal para el tope", guardar: "p" }),
          elegir(Y("recursos"), { noElemento: "oscuridad" }, { min: 1, titulo: "Carta de Recursos para el tope", guardar: "r" }),
          fn((g, ctx, ev, yo) => { for (const [k, m] of [["p", "principal"], ["r", "recursos"]]) { M.barajar(yo[m]); for (const i of sel(ctx, k)) { const n = yo[m].indexOf(i); if (n >= 0) { yo[m].splice(n, 1); yo[m].unshift(i); } } } })]],
      ])],
    },
    "ENC-04": { // Ballestero
      usar: { etapas: ["nucleo1", "nucleo2", "batalla"], pasos: (g, ctx) => {
        const yo = g.jugadores[ctx.jugador]; const cap = g.equipos[yo.equipo].recursos.capital;
        const ops = []; for (let x = 1; x <= Math.min(cap, 3); x++) ops.push([`Pagar ${x} de Capital`, [fn((gg, c, ev, y) => { gg.equipos[y.equipo].recursos.capital -= x; }), elegir(T("campo"), HUM_ANI, { min: 1, max: x, titulo: `Reparte ${x} de Herida` }), herirSel(1)]]);
        return ops.length ? [opcion("Ballestero: ¿cuánto Capital pagas?", ops)] : [];
      } },
    },
    "ENC-05": { // Nuño: al ser derrotada, disminuye 6 puntos repartidos
      alDerrotar: () => {
        const pasos = [];
        for (let i = 0; i < 6; i++) pasos.push(
          elegir(T("tablero"), null, { titulo: `Nuño: disminuye 1 punto (${i + 1} de 6)`, guardar: "n" }),
          fn((g, ctx) => { if (!sel(ctx, "n").length) ctx.pasos.length = 0; }),
          opcion("¿Ataque o defensa?", [["-1 de ataque", [cadaSel((g, x) => M.modificar(x, -1, 0, "siempre", "Nuño"), "n")]], ["-1 de defensa", [cadaSel((g, x) => M.modificar(x, 0, -1, "siempre", "Nuño"), "n")]]]));
        return pasos;
      },
    },
    "ENC-07": { equipable: { objetivo: HUM } }, // Caballo Andaluz
    "ENC-35": { equipable: { objetivo: { ...HUM, clase: "comun", maxAtaque: 3 } } }, // Demonio Legión
    "ENC-012": { alBajar: [opcion("Hombre de Fe: elige", [["Genera 2 de Creencia", [ganar({ creencia: 2 })]], ["Gana 1 punto de victoria", [fn((g, ctx, ev, yo) => M.darPuntos(g, yo.equipo, 1, ev, "hombre_de_fe"))]]])] },
    "ENC-017": { alActivar: [elegir(Y("principal"), { ...HUM, clase: "especial" }, { max: 2, titulo: "Hasta 2 Humanas Especial: colócalas" }), mover("colocar")] }, // Hoy te Convertís en Héroe
    "ENC-014": { // La Sorgina
      alBajar: [opcion("La Sorgina", [
        ["Manda al Mausoleo una carta al azar de la mano rival", [fn((g, ctx, ev, yo) => { for (const r of M.rivales(g, yo).slice(0, 1)) { if (!r.mano.length) return; const i = r.mano[Math.floor(Math.random() * r.mano.length)]; M.mover(g, i, "mausoleo", null, ev); } })]],
        ["No hacer nada", []]])],
      alDerrotar: [elegir(Y("principal"), { elemento: "oscuridad" }, { min: 1, titulo: "La Sorgina: una carta de OSCURIDAD a tu mano" }), mover("mano")],
    },
    "ENC-34": { alBajar: [elegir(Y("principal"), { tipo: "unidad", elemento: "luz", maxAtaque: 3 }, { max: 2, titulo: "Hasta 2 Unidades de LUZ (ATK 3 o menos): bájalas gratis" }), bajarGratis()] }, // León de San Marcos
    "ENC-032": { // Monumento a los Caídos
      aura: (g, f, jf, o, jo) => (jf === jo && es(g, o, { ...HUM, alineamiento: ["belico", "peon"] }) ? { ataque: 1, defensa: 1 } : null),
    },
    "ENC-019": { // Refuerzo
      alActivar: [fn((g, ctx, ev, yo) => { for (const c of [...yo.batalla, ...yo.defensa]) if (c && c.ataco && M.ataqueDe(g, c) <= 5) { c.ataco = false; M.modificar(c, 1, 0, "hasta_atacar", "Refuerzo"); ev.push({ tipo: "puede_atacar_otra_vez", uid: c.uid }); } })],
    },
    "ENC-33": { // San Jorge: +1 DEF a humanas de LUZ (todas las humanas que no sean OSCURIDAD cuentan como LUZ)
      aura: (g, f, jf, o) => (es(g, o, { ...HUM, noElemento: "oscuridad" }) ? { defensa: 1 } : null),
    },
    "ENC-040": { // Santa Cruz Divina
      permanente: true,
      alActivar: [elegir(Y("mausoleo"), { tipo: ["objeto", "suceso"], elemento: "luz", excluir: "ENC-040" }, { min: 1, titulo: "Un Objeto o Suceso de LUZ del Mausoleo a tu mano" }), mover("mano")],
      aura: (g, f, jf, o) => (es(g, o, { tipo: "unidad", sobrenatural: true, noElemento: "luz" }) ? { ataque: -1, defensa: -1 } : null),
    },
    "ENC-026": { // Santo Grial
      alActivar: [opcion("Santo Grial: elige un efecto", [
        ["Anula un ataque enemigo", [fn((g, ctx, ev) => { if (g.ataque) { g.ataque.anulado = true; ev.push({ tipo: "ataque_anulado", motivo: "santo_grial" }); } })]],
        ["Anula el efecto de una carta de OSCURIDAD", [fn((g, ctx, ev) => ev.push({ tipo: "anulado", carta: ctx.carta, nota: "sin_efecto_que_anular" }))]],
        ["Coloca una Humana Común/Especial del Mausoleo", [elegir(Y("mausoleo"), { ...HUM, clase: COM_ESP }, { min: 1, titulo: "Elige la unidad a colocar" }), mover("colocar")]],
      ])],
    },

    // ================= GUARANÍ / LITORAL =================
    "GL-19": { // Andamio Agrícola
      alBajar: [elegir(Y("recursos"), null, { min: 1, titulo: "Toma 1 carta de tu mazo de Recursos" }),
        opcion("Andamio Agrícola: esa carta…", [["Colocarla", [mover("colocar")]], ["Jugarla como Recurso", [cadaSel((g, inst, ev, yo) => { const c = carta(g, inst); M.mover(g, inst, "reciclaje", null, ev); const r = g.equipos[yo.equipo].recursos; for (const x of M.RECURSOS) r[x] += (c.genera || {})[x] || 0; ev.push({ tipo: "genera", equipo: yo.equipo, recursos: c.genera || {} }); })]]])],
      alDerrotar: [elegir(Y("principal"), { tipo: "suceso", elemento: "tierra" }, { titulo: "Puedes activar gratis un Suceso de TIERRA" }), activarGratis()],
    },
    "GL-18": { // Apacheta Santa
      alBajar: (g, ctx) => {
        const yo = g.jugadores[ctx.jugador]; const cre = g.equipos[yo.equipo].recursos.creencia;
        const ops = [["No pagar", []]];
        for (let x = 1; x <= Math.min(cre, 5); x++) ops.push([`Pagar ${x} de Creencia`, [opcion(`Generar ${x} de…`, [["Alimento", [fn((gg, c, ev, y) => { gg.equipos[y.equipo].recursos.creencia -= x; }), ganar({ alimento: x })]], ["Capital", [fn((gg, c, ev, y) => { gg.equipos[y.equipo].recursos.creencia -= x; }), ganar({ capital: x })]]])]]);
        return [opcion("Apacheta Santa", ops)];
      },
      aura: (g, f, jf, o, jo) => (jf === jo && es(g, o, { ...HUM, clase: "comun" }) ? (o.pos === "def" ? { defensa: 1 } : { ataque: 1 }) : null),
    },
    "GL-10": { // Báculo del Poder
      alActivar: [elegir(T("campo"), { ...HUM, alineamiento: "espiritista" }, { min: 1, titulo: "Equipa el Báculo a una Humana Espiritista" }),
        fn((g, ctx, ev) => { const o = sel(ctx)[0]; const obj = g.jugadores[ctx.jugador].reciclaje.find((c) => c.uid === ctx.fuente); if (o && obj) { M.equiparA(g, obj, o, ev, [{ ataque: 2, defensa: 1 }]); o.inbloqueable = true; } })],
      equipa: { objetivo: { ...HUM, alineamiento: "espiritista" }, mods: [{ ataque: 2, defensa: 1 }] },
    },
    "GL-02": { // Beata Benefactora
      alBajar: [opcion("Beata: elige un efecto", [
        ["Sin cartas en mano: toma 2 del tope", [fn((g, ctx, ev, yo) => { if (yo.mano.length) { ev.push({ tipo: "efecto_no_cumple", carta: ctx.carta }); ctx.pasos.length = 0; } }), opcion("¿De qué mazo?", [["Principal", [tomarTope("principal", 2)]], ["Recursos", [tomarTope("recursos", 2)]]])]],
        ["Con 2 o menos cartas en tu tablero: toma 1 del Principal", [fn((g, ctx, ev, yo) => {
          if (M.cartasEnTablero(yo).length > 3) { ev.push({ tipo: "efecto_no_cumple", carta: ctx.carta }); return; } // la Beata cuenta
          const top = yo.principal[0]; if (!top) return;
          if (es(g, top, { tipo: "unidad", clase: "comun" }) && M.casillaLibre(yo, "batalla") >= 0) M.mover(g, top, "colocar", yo, ev); else M.robar(g, yo, "principal", ev);
        })]],
      ])],
    },
    "GL-17": { // Capilla Jesuita
      alBajar: (g, ctx) => {
        const yo = g.jugadores[ctx.jugador];
        if (!M.cartasEnTablero(yo).some((c) => es(g, c, { tipo: "unidad", alineamiento: "espiritista" }))) return [];
        return [opcion("Capilla Jesuita: genera 1 recurso", [["Alimento", [ganar({ alimento: 1 })]], ["Capital", [ganar({ capital: 1 })]], ["Creencia", [ganar({ creencia: 1 })]]])];
      },
      aura: (g, f, jf, o) => (es(g, o, { tipo: "unidad", elemento: "oscuridad" }) ? { ataque: -1 } : null),
    },
    "GL-03": { // Illa
      alBajar: [opcion("Illa: elige un efecto", [
        ["Quita 3 de Herida/Contusión a una Humana de TIERRA", [elegir(T("tablero"), { ...HUM, elemento: "tierra" }, { min: 1 }), cadaSel((g, i) => { let n = 3; const h = Math.min(n, i.herida || 0); i.herida -= h; n -= h; i.contusion = Math.max(0, (i.contusion || 0) - n); })]],
        ["2 de Herida o Contusión a una Humana Común/Especial", [elegir(T("campo"), { ...HUM, clase: COM_ESP }, { min: 1 }), opcion("¿Herida o contusión?", [["2 de Herida", [herirSel(2)]], ["2 de Contusión", [contSel(2)]]])]],
      ])],
    },
    "GL-12": { // Infiltración Destructiva
      alActivar: (g, ctx) => {
        const yo = g.jugadores[ctx.jugador];
        const quitar = (j) => fn((gg, c, ev) => { const r = gg.equipos[j.equipo].recursos; for (const x of M.RECURSOS) r[x] = Math.max(0, r[x] - 1); ev.push({ tipo: "pierde_recursos", jugador: j.asiento }); });
        return [elegir(T("campo"), { tipo: "estructura" }, { min: 1, titulo: "Manda al Mausoleo una Estructura" }), enviarSel("mausoleo"),
          opcion("¿Qué jugador pierde 1 de cada recurso?", g.jugadores.filter((j) => !j.eliminado).map((j) => [j === yo ? "Yo" : `Jugador ${j.asiento + 1}`, [quitar(j)]])),
          elegir(Y("mano"), null, { min: 1, titulo: "Manda al Mausoleo una carta de tu mano" }), enviarSel("mausoleo")];
      },
    },
    "GL-16": { // Pombero
      alBajar: [elegir(T("tablero"), { tipo: "unidad", maxAtkODef: 3, si: (g, i) => { const l = M.ubicar(g, i.uid); return l && l.zona === "cuartel"; } }, { max: 2, titulo: "Hasta 2 acuarteladas (ATK o DEF 3 o menos) al Mausoleo" }), enviarSel("mausoleo")],
    },
    "GL-04": { // Okañyva
      alBajar: [opcion("Okañyva: elige un efecto", [
        ["Mira la mano rival y manda una al Mausoleo", [elegir(R("mano"), { ...HUM_ANI, clase: COM_ESP }, { min: 1, titulo: "Humana o Animal de la mano rival" }), enviarSel("mausoleo")]],
        ["Busca una Humana o Animal de tu Principal", [elegir(Y("principal"), { ...HUM_ANI, clase: COM_ESP }, { min: 1 }), mover("mano")]],
      ])],
    },
    "GL-06": { // Gran Rococó
      alBajar: [elegir(Y("principal"), { tipo: "unidad", nombre: "Hampatu" }, { max: 3, titulo: "Coloca hasta 3 cartas Hampatu" }), mover("colocar")],
      alDerrotar: [opcion("Gran Rococó: toma una carta del tope", [["Principal", [tomarTope("principal", 1)]], ["Recursos", [tomarTope("recursos", 1)]]])],
    },
    "GL-08": { alBajar: [elegir(T("campo"), HUM_ANI, { min: 1, titulo: "Inflige 2 de Herida" }), herirSel(2)] }, // Yaguareté
    "GL-14": { alBajar: [elegir(R("reserva"), { ...HUM, maxAtaque: 4 }, { max: 2, titulo: "Hasta 2 humanas de la reserva rival al Abismo" }), enviarSel("abismo")] }, // Yasy Yateré

    // ================= VALLE PATAGÓNICO =================
    "VP-16": { // Círculo del Hain
      alBajar: (g, ctx, inst) => [elegir(Y("sobrenatural"), { tipo: "unidad", sobrenatural: true, clase: "comun" }, { min: 1, titulo: "Coloca una Sobrenatural Común y acuartélala aquí" }),
        cadaSel((gg, u, ev, yo) => { const l = M.ubicar(gg, u.uid); if (!l) return; l.quitar(); u.pos = "atk"; u.bonoCuartel = "def"; u.acuarteloTurno = gg.turno; if (!inst.acuartelados) inst.acuartelados = []; inst.acuartelados.push(u); ev.push({ tipo: "acuartelada", jugador: yo.asiento, uid: u.uid, carta: u.carta, estructura: inst.uid, desde: "sobrenatural", bono: "def" }); })],
      alDerrotar: (g, ctx) => {
        const yo = g.jugadores[ctx.jugador]; const rec = g.equipos[yo.equipo].recursos;
        const pagable = (gg, i) => { const c = carta(gg, i).costo || {}; return M.RECURSOS.every((x) => rec[x] >= Math.max(0, (c[x] || 0) - 2)); };
        return [elegir([Y("sobrenatural"), Y("mano")], { tipo: "unidad", sobrenatural: true, si: pagable }, { titulo: "Puedes bajar una Sobrenatural con -2 de cada recurso" }),
          cadaSel((gg, i, ev, y) => { const c = carta(gg, i).costo || {}; const r = gg.equipos[y.equipo].recursos; for (const x of M.RECURSOS) r[x] -= Math.max(0, (c[x] || 0) - 2); }), bajarGratis()];
      },
    },
    "VP-18": { alBajar: [elegir(Y("principal"), { elemento: "viento" }, { min: 1, titulo: "Una carta de VIENTO: bájala o actívala gratis" }), bajarGratis()] }, // Cueva de las Manos
    "VP-05": { // Gaucho Errante
      alBajar: [elegir(T("campo"), HUM, { min: 1, titulo: "Inflige 2 de Herida a una Humana" }), herirSel(2)],
      usar: { etapas: ["batalla"], pasos: () => [elegir(T("campo"), { ...HUM_ANI, maxAtkODef: 4 }, { min: 1, titulo: "Esa carta no podrá atacar el siguiente turno" }), cadaSel((g, i, ev) => { i.noAtacaHasta = g.turno + g.jugadores.length; ev.push({ tipo: "no_ataca", uid: i.uid }); })] },
    },
    "VP-02": { // Niña del Fuego: +1 ATK por cada carta de FUEGO en el tablero
      aura: (g, f, jf, o) => {
        if (o !== f) return null;
        let n = 0; for (const j of g.jugadores) for (const c of M.cartasEnTablero(j)) if (c !== f && (carta(g, c).elemento || []).includes("fuego")) n++;
        return { ataque: n };
      },
    },
    "VP-14": { // Walichu
      alBajar: [elegir(T("campo"), { tipo: "estructura" }, { min: 1, titulo: "Derrota una Estructura" }), cadaSel((g, i, ev) => M.derrotar(g, i, ev))],
      aura: (g, f, jf, o) => (es(g, o, { ...HUM, naturaleza: "masculino", clase: COM_ESP }) ? { ataque: -2 } : null),
    },
    "VP-10": { alBajar: [elegir(T("campo"), { tipo: "unidad", especie: "animal", maxDefensa: 3 }, { min: 1, titulo: "Envía al Mausoleo una Unidad Animal (DEF 3 o menos)" }), enviarSel("mausoleo")] }, // Zorro Gris

    // ================= COSTOS EXTRA =================
    "AHA-39": { // Xalpen la Insaciable
      costoExtra: { // 2 Unidades Humanas de tu tablero al Mausoleo
        puede: (g, j, inst) => M.cartasEnTablero(j).filter((c) => c !== inst && es(g, c, HUM)).length >= 2,
        pasos: (g, ctx, inst) => [elegir(Y("campo"), { ...HUM, si: (gg, c) => c !== inst }, { min: 2, max: 2, titulo: "Costo de Xalpen: sacrifica 2 Unidades Humanas" }), enviarSel("mausoleo")],
      },
      alBajar: [fn((g, ctx, ev) => { for (const j of g.jugadores) for (const c of [...M.cartasEnTablero(j)]) if (es(g, c, { ...HUM, clase: COM_ESP })) M.mover(g, c, "abismo", null, ev); })],
      usar: { etapas: ["batalla"], pasos: (g, ctx, inst) => [
        elegir([Y("campo"), Y("reserva")], { ...HUM, si: (gg, c) => c !== inst }, { max: 2, titulo: "Xalpen: hasta 2 Humanas tuyas (+1 ATK por cada una)" }),
        fn((gg, c) => { const n = sel(c).length; if (n) M.modificar(inst, n, 0, "turno", "Xalpen"); else c.pasos.length = 0; }),
        opcion("¿A dónde las mandas?", [["Al Abismo", [enviarSel("abismo")]], ["Al Mausoleo", [enviarSel("mausoleo")]]]),
      ] },
    },
    "ENC-020": { // Tentación Lujuriosa
      costoExtra: { // 1 Humana Espiritista y 1 Humana Femenina de tu mazo al Mausoleo
        puede: (g, j) => {
          const esp = j.principal.filter((c) => es(g, c, { ...HUM, alineamiento: "espiritista" }));
          const fem = j.principal.filter((c) => es(g, c, { ...HUM, naturaleza: "femenino" }));
          return esp.length >= 1 && fem.length >= 1 && new Set([...esp, ...fem]).size >= 2;
        },
        pasos: [
          elegir(Y("principal"), { ...HUM, alineamiento: "espiritista" }, { min: 1, max: 1, titulo: "Costo: una Humana Espiritista de tu mazo al Mausoleo", guardar: "e" }), enviarSel("mausoleo", "e"),
          elegir(Y("principal"), { ...HUM, naturaleza: "femenino" }, { min: 1, max: 1, titulo: "Costo: una Humana Femenina de tu mazo al Mausoleo", guardar: "f" }), enviarSel("mausoleo", "f"),
        ],
      },
      alActivar: [opcion("Tentación Lujuriosa: elige un efecto", [
        ["Coloca una Sobrenatural de OSCURIDAD (ATK 6 o menos)", [elegir(Y("sobrenatural"), { tipo: "unidad", sobrenatural: true, elemento: "oscuridad", maxAtaque: 6 }, { min: 1 }), mover("colocar")]],
        ["Abismo a una Espiritista rival y -2 Creencia al oponente", [
          elegir([R("campo"), R("mano")], { ...HUM, alineamiento: "espiritista" }, { max: 1, titulo: "Hasta 1 Humana Espiritista del oponente al Abismo" }), enviarSel("abismo"),
          fn((g, ctx, ev, yo) => { for (const r of M.rivales(g, yo).slice(0, 1)) { const rec = g.equipos[r.equipo].recursos; rec.creencia = Math.max(0, rec.creencia - 2); ev.push({ tipo: "pierde_recursos", jugador: r.asiento, recursos: { creencia: 2 } }); } })]],
      ])],
    },
    "GL-07": { // San Muerte
      costoExtra: { puede: (g, j) => j.mausoleo.some((c) => es(g, c, { tipo: "unidad", alineamiento: "espiritista" })) }, // requisito, no se gasta
      alBajar: [fn((g, ctx, ev) => { for (const eq of Object.keys(g.equipos)) { const r = g.equipos[eq].recursos; r.alimento += 1; r.capital += 1; } ev.push({ tipo: "genera", todos: true, recursos: { alimento: 1, capital: 1 } }); })],
      usar: { etapas: ["batalla"], pasos: (g, ctx, inst) => [opcion("San Muerte: ¿se va al Mausoleo para anular la próxima fase de batalla del oponente?", [
        ["Sí", [fn((gg, c, ev, yo) => { M.mover(gg, inst, "mausoleo", null, ev); for (const r of M.rivales(gg, yo)) r.sinBatallaHasta = gg.turno + gg.jugadores.length; ev.push({ tipo: "batalla_anulada", por: yo.asiento }); })]],
        ["No", []]])] },
    },
  };
  return { cartas };
};
