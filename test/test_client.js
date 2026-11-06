// Prueba la LÓGICA DEL CLIENTE (espejo del GML) contra el servidor real.
const { spawn } = require("child_process");
const path = require("path"), fs = require("fs"), os = require("os");
const Orb = require("./client_mirror");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 3996;
let pass = 0, fail = 0;
const ok = (c, msg) => { c ? pass++ : fail++; console.log((c ? "  OK   " : "  FALLA") + "  " + msg); };
const startServer = () => spawn(process.execPath, [path.join(__dirname, "..", "server.js")],
  { env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir }, stdio: "ignore" });
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "orbita-c-"));

(async () => {
  let srv = startServer(); await sleep(700);
  try {
    console.log("\nFlujo del juego de demo");
    const A = new Orb(PORT), B = new Orb(PORT);
    let joinedCb = null;
    A.join("demo", 0, (okv, d) => (joinedCb = [okv, d]));   // antes de conectar (como obj_demo)
    A.connect(); B.connect(); B.join("demo");
    await sleep(400);
    ok(A.room === "demo" && B.room === "demo", "orb_join_room antes de conectar: entra sola al conectar");
    ok(joinedCb && joinedCb[0] === true && joinedCb[1] === "demo", "y el callback llega con ok=true cuando de verdad entra");
    ok(A.slot !== B.slot && [A.slot, B.slot].sort().join() === "0,1", "puestos 0 y 1");

    A.orb_state = { x: 100, y: 50, name: "Ana", color: 255 };
    A.localEntities.push({ kind: "obj_demo_bullet", x: 10, y: 10, orb_sync: ["x", "y"], orb_props: { color: 65535 } });
    A.sendState(); await sleep(100);
    const pa = B.players[String(A.my_id)];
    ok(pa && pa.s.name === "Ana" && pa.s.x === 100, "B ve el estado de A");
    const ek = Object.keys(pa.e)[0];
    ok(ek && pa.e[ek].kind === "obj_demo_bullet" && pa.e[ek].props.color === 65535, "B ve la bala de A con sus props");

    const before = A.sent.length;
    A.sendState(); A.sendState(); A.sendState(); await sleep(60);
    ok(A.sent.length === before, "si nada cambió, no se manda nada (ahorra internet)");

    A.localEntities[0].x = 40; A.sendState(); await sleep(80);
    const lastSent = JSON.parse(A.sent[A.sent.length - 1]);
    ok(!lastSent.s && lastSent.e && pa.e[ek].x === 40, "solo se manda la entidad que cambió (no el estado)");

    A.localEntities = []; A.sendState(); await sleep(80);
    ok(Object.keys(B.players[String(A.my_id)].e).length === 0, "bala destruida desaparece en B");

    console.log("\nQuien entra tarde");
    A.orb_state.x = 300; A.sendState();
    A.localEntities.push({ kind: "obj_demo_bullet", x: 1, y: 1 }); A.sendState();
    let wid = null; A.worldCreate({ x: 5, y: 6, color: 1 }, (okv, id) => (wid = id));
    await sleep(150);
    const C = new Orb(PORT); C.connect(); C.join("demo"); await sleep(400);
    const pc = C.players[String(A.my_id)];
    ok(pc && pc.s.x === 300 && Object.keys(pc.e).length === 1, "C (entra tarde) ve estado y bala de A");
    ok(wid && C.world[String(wid)]?.p.x === 5, "C ve la bandera del mundo");
    ok(C.players[String(B.my_id)] && !C.players[String(C.my_id)], "C ve a B y no se ve a sí mismo");

    console.log("\nEventos y peticiones");
    let got = null; B.on("saludo", (d, from) => (got = [d, from]));
    A.sendRoom("saludo", { nombre: "Ana" }); await sleep(80);
    ok(got && got[0].nombre === "Ana" && got[1] === A.my_id, "orb_on recibe data y from");
    let r1 = null; A.dbGet("demo", "visitas", (okv, v) => (r1 = [okv, v])); await sleep(80);
    ok(r1 && r1[0] === false && r1[1] === "not_found", "orb_db_get de algo que no existe -> (false, not_found)");
    let r2 = null; A.dbSet("demo", "visitas", 1, () => A.dbGet("demo", "visitas", (okv, v) => (r2 = v))); await sleep(150);
    ok(r2 === 1, "guardar y leer (callback dentro de callback, como la demo)");

    console.log("\nIr y volver de sala");
    A.leave(); await sleep(100);
    ok(A.room === "" && !B.players[String(A.my_id)] && Object.keys(A.players).length === 0, "orb_leave_room: A sale y B deja de verlo");
    A.join("demo"); await sleep(100);
    A.sendState(); await sleep(100);
    ok(B.players[String(A.my_id)]?.s.x === 300 && Object.keys(B.players[String(A.my_id)].e).length === 1, "al volver se reenvía todo (estado y entidades)");

    console.log("\nPartida rápida");
    const Q1 = new Orb(PORT), Q2 = new Orb(PORT); Q1.connect(); Q2.connect(); await sleep(300);
    Q1.matchmake(2, "demo"); await sleep(80);
    ok(Q1.in_queue && Q1.queue_count === 1, "en cola 1/2");
    Q2.matchmake(2, "demo"); await sleep(150);
    ok(Q1.room && Q1.room === Q2.room && !Q1.in_queue, "emparejados y fuera de la cola");

    console.log("\nCaída del servidor y reconexión");
    let disc = false, reconnected = false;
    B.on("orb:disconnected", () => (disc = true));
    B.on("orb:connected", () => (reconnected = true));
    const roomBefore = B.room;
    srv.kill(); await sleep(400);
    ok(disc && B.status === "off" && Object.keys(B.players).length === 0, "si se cae: orb:disconnected y se limpian los jugadores");
    let pendingResult = "sin respuesta";
    B.dbGet("x", "y", (okv, d) => (pendingResult = d));
    ok(pendingResult === "not_connected", "petición sin conexión responde al instante con not_connected");
    srv = startServer(); await sleep(800);
    B.connect(); await sleep(500);   // en GML esto lo hace solo __orb_manager_step con retry_at
    ok(reconnected && B.status === "connected" && B.room === roomBefore, "al reconectar vuelve sola a su sala");
    const D = new Orb(PORT); D.connect(); D.join("demo"); await sleep(300);
    ok(D.players[String(B.my_id)], "los demás la ven de nuevo");
    ok(fs.existsSync(path.join(dataDir, "world.json")), "la bandera del mundo quedó guardada en disco");
  } catch (e) { fail++; console.log("  FALLA  excepción:", e); }
  srv.kill();
  console.log(`\n${pass} pruebas del cliente OK, ${fail} fallas\n`);
  process.exit(fail ? 1 : 0);
})();
