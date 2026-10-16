var out = document.getElementById("out"), t0 = Date.now();
function l(s, c) { var d = document.createElement("div"); d.className = "l " + (c || ""); d.textContent = ((Date.now() - t0) / 1000).toFixed(1) + "s  " + s; out.appendChild(d); }
function ok(s) { l("OK  " + s, "ok"); } function ko(s) { l("FALLO  " + s, "ko"); } function w(s) { l("AVISO  " + s, "w"); }
(async function () {
  l("navegador: " + navigator.userAgent);
  l("memoria (deviceMemory): " + navigator.deviceMemory + " GB · núcleos: " + navigator.hardwareConcurrency + " · plataforma: " + navigator.platform);
  l("aislamiento de origen (SharedArrayBuffer): " + (typeof SharedArrayBuffer !== "undefined") + " · crossOriginIsolated: " + self.crossOriginIsolated);
  if (typeof WebAssembly === "undefined") { ko("WebAssembly no existe en este navegador (¿modo de seguridad mejorada de Edge / política?)"); return; }
  ok("WebAssembly disponible");
  try { var c = document.createElement("canvas"), gl = c.getContext("webgl2") || c.getContext("webgl"); if (gl) { var dbg = gl.getExtension("WEBGL_debug_renderer_info"); ok("WebGL: " + (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "sí")); } else ko("WebGL no disponible"); } catch (e) { ko("WebGL: " + e.message); }
  try { var ac = new (window.AudioContext || window.webkitAudioContext)(); ok("AudioContext: " + ac.state + " · " + ac.sampleRate + " Hz"); } catch (e) { ko("AudioContext: " + e.message); }
  try { var root = await navigator.storage.getDirectory(); var d = await root.getDirectoryHandle("pcf-diag", { create: true }); var h = await d.getFileHandle("p.bin", { create: true }); ok("almacén local (OPFS): disponible · createWritable: " + (typeof h.createWritable) + " · createSyncAccessHandle: " + (typeof h.createSyncAccessHandle)); if (navigator.storage.estimate) { var est = await navigator.storage.estimate(); l("cuota: " + (est.quota / 1048576 | 0) + " MB · usado: " + (est.usage / 1048576 | 0) + " MB"); } await root.removeEntry("pcf-diag", { recursive: true }); } catch (e) { ko("almacén local (OPFS): " + e.message); }
  // descarga y compilación del motor
  try {
    var r = await fetch("scummvm/scummvm-" + window.HM_CONFIG.engineVersion + ".wasm"); l("motor: HTTP " + r.status + " · " + r.headers.get("content-type") + " · " + (r.headers.get("content-length") || "?") + " bytes");
    var reader = r.body.getReader(), chunks = [], got = 0, last = 0;
    while (true) { var x = await reader.read(); if (x.done) break; chunks.push(x.value); got += x.value.length; if (got - last > 3000000) { l("  descargados " + (got / 1048576 | 0) + " MB"); last = got; } }
    var buf = new Uint8Array(got), o = 0; chunks.forEach(function (c) { buf.set(c, o); o += c.length; }); ok("motor descargado: " + (got / 1048576 | 0) + " MB");
    var t1 = Date.now(); var mod = await WebAssembly.compile(buf); ok("motor compilado en " + ((Date.now() - t1) / 1000).toFixed(1) + " s");
    var imports = WebAssembly.Module.imports(mod); l("importa " + imports.length + " funciones; exporta " + WebAssembly.Module.exports(mod).length);
  } catch (e) { ko("motor: " + (e && e.message || e)); }
  l("— fin del diagnóstico: haz una captura de esta pantalla —");
})();

// ---- integridad de la copia local del juego (hollywood): tamaño y SHA-256 de cada fichero frente a los originales ----
(async function () {
  var out = document.getElementById("out"), t0 = Date.now();
  function l(s, c) { var d = document.createElement("div"); d.className = "l " + (c || ""); d.textContent = ((Date.now() - t0) / 1000).toFixed(1) + "s  " + s; out.appendChild(d); }
  await new Promise(function (r) { setTimeout(r, 3000); });
  try {
    var ref = await (await fetch(window.HM_CONFIG.dataBase + "/hashes.json")).json();
    var root = await navigator.storage.getDirectory(), dir;
    try { dir = await root.getDirectoryHandle(window.HM_CONFIG.storageDir); } catch (e) { l("integridad: no hay copia local del juego todavía (carpeta " + window.HM_CONFIG.storageDir + ")", "w"); return; }
    var names = Object.keys(ref), mal = 0, faltan = 0, bien = 0;
    l("integridad: comprobando " + names.length + " ficheros de la copia local…");
    for (var i = 0; i < names.length; i++) {
      var n = names[i], f;
      try { f = await (await dir.getFileHandle(window.HM_CONFIG.target + "_" + n)).getFile(); } catch (e) { faltan++; l("  falta " + n, "w"); continue; }
      if (f.size !== ref[n].size) { mal++; l("  TAMAÑO MAL " + n + ": " + f.size + " ≠ " + ref[n].size, "ko"); continue; }
      var hb = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
      var hex = Array.from(new Uint8Array(hb)).map(function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
      if (hex !== ref[n].sha256) { mal++; l("  CONTENIDO CORRUPTO " + n, "ko"); } else bien++;
    }
    l("integridad: " + bien + " correctos · " + mal + " corruptos · " + faltan + " faltan", mal ? "ko" : "ok");
    if (mal) l("→ abre index.html?svmfresh=1 para borrar la copia y volver a descargarla", "w");
  } catch (e) { l("integridad: " + (e && e.message || e), "ko"); }
})();
