// Prueba de extremo a extremo con Playwright.
//
//   cd web && python3 -m http.server 8000      (en otra terminal, con los datos del juego ya colocados)
//   npm i playwright && npx playwright install chromium
//   node tools/e2e.mjs                         (o BASE=http://localhost:8000 node tools/e2e.mjs)
//
// Arranca el juego en la escena 1010, guarda una partida desde el menú del juego,
// recarga la página y comprueba que la partida sigue en /saves.
// Las coordenadas de los clics son del juego (640×480) y corresponden a la 2ª edición española.
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:8000";
const URL = `${BASE}/index.html?boot=1010`;
const fallo = (m) => { console.error("FALLO:", m); process.exitCode = 1; };

const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await b.newContext({ viewport: { width: 1100, height: 1000 } });
const p = await ctx.newPage();
const logs = [];
p.on("console", (m) => logs.push(m.text()));
p.on("pageerror", (e) => logs.push("ERR " + e.message));

await p.goto(URL);
await p.click("#play");
await p.waitForFunction(() => window.FS && FS.analyzePath("/saves").exists, null, { timeout: 180000 });
await p.waitForTimeout(20000);
const corriendo = logs.find((l) => /Running Hollywood Monsters/.test(l));
console.log("arranque:", corriendo || "(no visto)");
if (!corriendo) fallo("el motor no llegó a arrancar el juego");
const errores = logs.filter((l) => /^ERR /.test(l) && !/Web MIDI/.test(l)); // el permiso de MIDI es inofensivo
if (errores.length) fallo(errores.join("\n"));

const rect = await p.evaluate(() => { const r = document.querySelector("#canvas").getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
const g = (gx, gy) => [rect[0] + gx / 640 * rect[2], rect[1] + gy / 480 * rect[3]];
const click = async (gx, gy) => { const q = g(gx, gy); await p.mouse.move(q[0], q[1]); await p.waitForTimeout(400); await p.mouse.click(q[0], q[1]); };

// Abrir el inventario (borde inferior), menú de opciones → Guardar → ranura → nombre → Aceptar.
const q = g(320, 479);
await p.mouse.move(q[0], q[1]); await p.waitForTimeout(800); await p.mouse.move(q[0] + 2, q[1] + 1); await p.waitForTimeout(800);
await click(22, 404); await p.waitForTimeout(1500);
await click(80, 225); await p.waitForTimeout(2000);
await click(70, 70); await p.waitForTimeout(1500);
await p.keyboard.type("Prueba e2e");
await click(390, 260); await p.waitForTimeout(2000);

const antes = await p.evaluate(() => FS.readdir("/saves").filter((f) => f[0] !== "."));
console.log("/saves tras guardar:", antes);
if (!antes.some((f) => /^hollywood\.\d{3}$/.test(f))) fallo("no se creó ninguna partida (¿cambió el menú o la edición?)");
await p.waitForTimeout(12000); // el reproductor guarda en IndexedDB cada 10 s
await p.close();

const p2 = await ctx.newPage();
await p2.goto(URL);
await p2.click("#play");
await p2.waitForFunction(() => window.FS && FS.analyzePath("/saves").exists, null, { timeout: 180000 });
await p2.waitForTimeout(5000);
const despues = await p2.evaluate(() => FS.readdir("/saves").filter((f) => f[0] !== "."));
console.log("/saves tras recargar:", despues);
if (!antes.every((f) => despues.includes(f))) fallo("la partida no se recuperó al recargar");

await b.close();
console.log(process.exitCode ? "RESULTADO: FALLO" : "RESULTADO: OK");
