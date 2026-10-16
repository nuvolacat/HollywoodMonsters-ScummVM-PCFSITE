/* Reproductor web de Hollywood Monsters con ScummVM (WebAssembly).
 *
 * Flujo (ver docs/REPRODUCTOR.md para el porqué de cada decisión):
 *  1. El usuario pulsa «Jugar» (gesto necesario para que el navegador deje sonar el audio).
 *  2. Se lee la partida guardada de IndexedDB (si «Continuar» está marcado).
 *  3. Se carga el motor: /scummvm/scummvm-<N>.js + .wasm (pareja con la versión EN EL NOMBRE).
 *  4. preRun: se escribe /scummvm.ini, se restauran las partidas en /saves y se BLOQUEA el arranque
 *     (addRunDependency) mientras un Web Worker descarga los ficheros del juego DIRECTAMENTE al almacén
 *     privado del navegador (OPFS) con FileSystemSyncAccessHandle. La pestaña no retiene los ~490 MB.
 *  5. Se abren esos ficheros como File y se desbloquea el arranque.
 *  6. ScummVM lee los datos por trozos de 1 MB con su sistema de ficheros HTTP (parcheado: HTTPRangeStream).
 *     Cada lectura pregunta a window.svmRangeUrl(url, inicio, longitud), que devuelve un blob: del trozo
 *     ya recortado de la copia local; el motor lo lee con un XMLHttpRequest SÍNCRONO (sin Asyncify).
 *  7. Partidas: ScummVM guarda en /saves (memoria); cada 10 s se empaqueta /saves (formato PCFSVM01) y se
 *     guarda en IndexedDB si ha cambiado. Se puede descargar/restaurar como fichero .hmsave.
 *
 * Opciones por URL (pruebas): ?boot=<escena> · ?svmgfx=soft (render SDL sin WebGL) · ?svmfresh=1 (borra la copia
 * local del juego y la carpeta persistente de ScummVM) · ?svmmode=mem|slice (datos en memoria o por trozos).
 */
(function () {
  "use strict";
  var C = window.HM_CONFIG, $ = function (s) { return document.querySelector(s); };
  var qs = new URLSearchParams(location.search);
  var ov = $("#overlay"), cv = $("#canvas");
  var phase = "idle", overlayHidden = false, persistOn = true, lastSig = "", svmFS = null;
  var svmFiles = {}, svmEstado = {};

  // ---------- interfaz ----------
  function setMsg(m, h) { $("#msg").textContent = m; if (h !== undefined) $("#hint").textContent = h; }
  function setPct(p) { $("#bar>i").style.width = Math.max(0, Math.min(100, p)) + "%"; }
  function flash(t) { var e = $("#saved"); e.textContent = t; clearTimeout(flash.t); flash.t = setTimeout(function () { e.textContent = ""; }, 4000); }
  function hideOverlay() { if (overlayHidden) return; overlayHidden = true; setPct(100); setTimeout(function () { ov.classList.add("hidden"); }, 400); }

  // ---------- partidas: IndexedDB del navegador ----------
  var idb = {
    open: function () { return new Promise(function (res, rej) { var r = indexedDB.open("hm-scummvm-saves", 1); r.onupgradeneeded = function () { r.result.createObjectStore("saves"); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); },
    get: function (k) { return idb.open().then(function (db) { return new Promise(function (res) { var r = db.transaction("saves").objectStore("saves").get(k); r.onsuccess = function () { res(r.result || null); }; r.onerror = function () { res(null); }; }); }); },
    put: function (k, v) { return idb.open().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction("saves", "readwrite"); t.objectStore("saves").put(v, k); t.oncomplete = function () { res(); }; t.onerror = function () { rej(t.error); }; }); }); },
    del: function (k) { return idb.open().then(function (db) { return new Promise(function (res) { var t = db.transaction("saves", "readwrite"); t.objectStore("saves").delete(k); t.oncomplete = t.onerror = function () { res(); }; }); }); },
  };
  // Formato PCFSVM01: "PCFSVM01" + u32 n + n × (u16 longitud del nombre, nombre UTF-8, u32 longitud, datos)
  function pack(parts) {
    var enc = new TextEncoder(), items = parts.map(function (p) { return { n: enc.encode(p.n), d: p.d }; });
    var size = 12 + items.reduce(function (a, i) { return a + 2 + i.n.length + 4 + i.d.length; }, 0);
    var out = new Uint8Array(size), dv = new DataView(out.buffer), o = 12;
    out.set(enc.encode("PCFSVM01"), 0); dv.setUint32(8, items.length, true);
    items.forEach(function (i) { dv.setUint16(o, i.n.length, true); o += 2; out.set(i.n, o); o += i.n.length; dv.setUint32(o, i.d.length, true); o += 4; out.set(i.d, o); o += i.d.length; });
    return out;
  }
  function unpack(buf) {
    var dec = new TextDecoder(), dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), parts = [];
    if (buf.length < 12 || dec.decode(buf.subarray(0, 8)) !== "PCFSVM01") return parts;
    var n = dv.getUint32(8, true), o = 12;
    for (var i = 0; i < n && o + 6 <= buf.length; i++) {
      var nl = dv.getUint16(o, true); o += 2; var name = dec.decode(buf.subarray(o, o + nl)); o += nl;
      var dl = dv.getUint32(o, true); o += 4; parts.push({ n: name, d: buf.slice(o, o + dl) }); o += dl;
    }
    return parts;
  }
  function sig(d) { var s = d.length + ":"; for (var i = 0; i < d.length; i += 4099) s += d[i].toString(36); return s; }
  function snapshot() {
    if (!svmFS) return null;
    var names; try { names = svmFS.readdir("/saves"); } catch (e) { return null; }
    names = names.filter(function (n) { return n !== "." && n !== ".." && !/\.tmp$/i.test(n); }).sort();
    return names.map(function (n) { return { n: n, d: svmFS.readFile("/saves/" + n) }; });
  }
  function saveNow(label) {
    if (!persistOn || phase !== "game") return Promise.resolve(false);
    var parts = snapshot(); if (!parts || !parts.length) return Promise.resolve(false);
    var blob = pack(parts), s = sig(blob); if (s === lastSig) return Promise.resolve(false);
    return idb.put(C.saveKey, blob).then(function () { lastSig = s; flash((label || "Partidas guardadas") + " · " + parts.length + " fichero(s)"); return true; })
      .catch(function (e) { flash("⚠ No se pudo guardar en el navegador: " + e.message); return false; });
  }

  // ---------- almacén local (OPFS) y descarga en un Web Worker ----------
  function svmDir() {
    if (!(navigator.storage && navigator.storage.getDirectory)) return Promise.reject(new Error("sin OPFS"));
    return navigator.storage.getDirectory().then(function (r) { return r.getDirectoryHandle(C.storageDir, { create: true }); });
  }
  function fetchAll(base, index, onProgress) {
    var t0 = Date.now();
    return new Promise(function (res, rej) {
      if (!window.Worker || !(navigator.storage && navigator.storage.getDirectory)) return rej(new Error("este navegador no tiene almacén local (OPFS) para el juego"));
      var w = new Worker("svm-worker.js");
      var vig = setTimeout(function () { rej(new Error("la descarga no ha empezado (almacén local no disponible)")); }, 20000);
      w.onerror = function (e) { clearTimeout(vig); rej(new Error("fallo en la descarga: " + (e.message || "worker"))); };
      w.onmessage = function (e) {
        var m = e.data;
        if (m.tipo === "progreso") { clearTimeout(vig); svmEstado = m.estado || {}; onProgress(m.got, m.total, t0); }
        else if (m.tipo === "fin") { w.terminate(); res(m); }
        else if (m.tipo === "error") { w.terminate(); clearTimeout(vig); rej(new Error(m.msg)); }
      };
      w.postMessage({ base: base, suffix: C.dataSuffix || "", dir: C.storageDir, prefix: C.target + "_", index: index });
    }).then(function (r) {
      return svmDir().then(function (dir) {
        return Promise.all(r.names.map(function (n) { return dir.getFileHandle(C.target + "_" + n).then(function (h) { return h.getFile(); }).then(function (f) { svmFiles[n] = f; }); }));
      }).then(function () { svmEstado = {}; return r; });
    });
  }
  // El motor (http-fs.cpp parcheado) pide cada trozo con un XHR síncrono a la URL que devuelva esta función.
  // Devolver {url} = trozo ya recortado (blob: de File.slice); devolver una URL normal = se pide con cabecera Range.
  window.svmRangeUrl = function (url, start, len) {
    var name = url.split("/").pop();
    if (C.dataSuffix && name.slice(-C.dataSuffix.length) === C.dataSuffix) name = name.slice(0, -C.dataSuffix.length);
    var f = svmFiles[name];
    if (!f) return url;
    return { url: URL.createObjectURL(f.slice(start, start + len)) };
  };
  window.svmRangeDone = function (r) { try { URL.revokeObjectURL(r.url); } catch (e) {} };

  // ---------- arranque ----------
  function start() {
    $("#play").style.display = "none"; document.querySelector(".chk").style.display = "none"; $("#bar").style.display = "block";
    persistOn = $("#persist").checked;
    var pre = persistOn ? idb.get(C.saveKey).then(function (d) { if (d) lastSig = sig(d); return d; }) : idb.del(C.saveKey).then(function () { return null; });
    var saved = null;
    var ini = ["[scummvm]", "enable_unsupported_game_warning=false", "fullscreen=false", "confirm_exit=false", "savepath=/saves",
      "autosave_period=120", "gui_theme=scummmodern",
      "[" + C.target + "]", "gameid=" + C.target, "engineid=" + C.target, "path=/scummvm/data/games/" + C.target, "language=es", "platform=windows", ""].join("\n");
    window.Module = {
      canvas: cv, arguments: [],
      locateFile: function (p) { return "scummvm/" + p.replace(/^scummvm\./, "scummvm-" + C.engineVersion + "."); },
      print: function (t) {
        console.log(t);
        if (/^Running /.test(t) && phase !== "game") {
          // el motor tarda en montar la primera escena (pantalla negra): la portada sigue hasta que el lienzo pinta algo
          phase = "game"; setPct(96); setMsg("Cargando Hollywood Monsters…", "el juego tarda unos segundos en arrancar: empieza con la intro");
          var t0 = Date.now(), probe = document.createElement("canvas"); probe.width = 32; probe.height = 24;
          var pctx = probe.getContext("2d", { willReadFrequently: true });
          var chk = setInterval(function () {
            var el = (Date.now() - t0) / 1000, pintado = false;
            try { pctx.drawImage(cv, 0, 0, 32, 24); var d = pctx.getImageData(0, 0, 32, 24).data; for (var i = 0; i < d.length; i += 4) { if (d[i] + d[i + 1] + d[i + 2] > 60) { pintado = true; break; } } } catch (e) {}
            // con WebGL, drawImage del lienzo puede devolver negro aunque se vea (preserveDrawingBuffer=false): tope de 25 s
            if (pintado || el > 25) { clearInterval(chk); hideOverlay(); }
          }, 2000);
        }
      },
      printErr: function (t) { console.warn(t); },
      onExit: function () { phase = "exit"; ov.classList.remove("hidden"); overlayHidden = false; setMsg("El juego se ha cerrado", "recarga la página para volver a jugar"); },
      preRun: [function () {
        svmFS = window.FS;
        if (qs.get("svmgfx") === "soft") window.svmSoftRender = true;   // el backend (emscripten.cpp parcheado) fija SDL_HINT_RENDER_DRIVER=software
        svmFS.writeFile("/scummvm.ini", ini);
        svmFS.mkdir("/saves");
        if (saved) unpack(saved).forEach(function (p) { svmFS.writeFile("/saves/" + p.n, p.d); });
        Module.addRunDependency("hm-datos");
        setPct(12); setMsg("Preparando entorno…", "");
        var lastGot = -1, lastT = Date.now(), vig = setInterval(function () {   // aviso si la descarga se para
          if (phase === "game" || phase === "exit") { clearInterval(vig); return; }
          if (window.__svmGot !== lastGot) { lastGot = window.__svmGot; lastT = Date.now(); return; }
          if (Date.now() - lastT > 45000) {
            var pend = Object.keys(svmEstado).map(function (n) { return n + " (" + svmEstado[n] + ")"; }).join(", ");
            setMsg($("#msg").textContent.replace(/ \(sin avance.*$/, "") + " (sin avance desde hace " + Math.round((Date.now() - lastT) / 1000) + " s)", pend ? "esperando: " + pend : "");
          }
        }, 5000);
        var limpiar = qs.get("svmfresh") === "1"
          ? navigator.storage.getDirectory().then(function (r) { return r.removeEntry(C.storageDir, { recursive: true }); }).catch(function () {})
              .then(function () { return new Promise(function (res) { try { var q = indexedDB.deleteDatabase("/home/web_user"); q.onsuccess = q.onerror = q.onblocked = function () { res(); }; } catch (e) { res(); } }); })
          : Promise.resolve();
        limpiar.then(function () { return fetch(C.dataBase + "/index.json"); })
          .then(function (r) { if (!r.ok) throw new Error("No se encuentra el índice del juego (" + r.status + "): revisa dataBase en config.js y docs/DATOS.md"); return r.json(); })
          .then(function (index) {
            return fetchAll(C.dataBase, index, function (got, total, t0) {
              window.__svmGot = got;
              var pct = total ? got / total : 0, mbs = (got / 1048576) / Math.max(0.5, (Date.now() - t0) / 1000);
              setPct(12 + 80 * pct); setMsg("Preparando entorno… " + Math.round(pct * 100) + "%", (got / 1048576 | 0) + " de " + (total / 1048576 | 0) + " MB · " + mbs.toFixed(1) + " MB/s");
            });
          })
          .then(function (r) {
            // modo «mem» (memoria de sobra): ficheros enteros al sistema de ficheros de ScummVM; «slice»: trozos desde OPFS
            var modo = qs.get("svmmode") || ((navigator.deviceMemory || 8) >= 8 ? "mem" : "slice");
            console.log("datos del juego:", r.names.length, "ficheros · modo", modo);
            if (modo !== "mem") return r;
            var cacheDir = "/.cache/scummvm/data/games/" + C.target;
            svmFS.mkdirTree(cacheDir); setPct(93); setMsg("Cargando datos en memoria…", "");
            return r.names.reduce(function (pr, n) {
              return pr.then(function () { return svmFiles[n].arrayBuffer().then(function (b) { svmFS.createDataFile(cacheDir, n, new Uint8Array(b), true, false, true); }); });
            }, Promise.resolve()).then(function () { return r; });
          })
          .then(function () { setPct(94); setMsg("Iniciando ScummVM…", ""); Module.removeRunDependency("hm-datos"); })
          .catch(function (e) { console.error(e); setMsg("Error: " + e.message, ""); });
      }],
    };
    pre.then(function (d) {
      saved = d; phase = "boot"; setPct(5); setMsg("Cargando ScummVM…", "");
      cv.hidden = false;
      var sc = document.createElement("script"); sc.src = "scummvm/scummvm-" + C.engineVersion + ".js";
      var boot = qs.get("boot");
      // el pre-js de ScummVM crea Module.arguments=[] al cargar y el runtime usa ESE array: hay que rellenarlo, no sustituirlo
      sc.onload = function () { Module.arguments.push("-c", "/scummvm.ini"); if (boot && /^\d+$/.test(boot)) Module.arguments.push("-b", boot); Module.arguments.push(C.target); };
      sc.onerror = function () { setMsg("Error: no se pudo cargar el motor (scummvm/scummvm-" + C.engineVersion + ".js)", ""); };
      document.body.appendChild(sc);
      setInterval(function () { if (phase === "game") saveNow(); }, 10000);
    });
  }

  // ---------- botones ----------
  $("#play").onclick = start;
  $("#savenow").onclick = function () { saveNow("Guardado").then(function (ok) { if (!ok) flash("Nada nuevo que guardar"); }); };
  $("#export").onclick = function () {
    idb.get(C.saveKey).then(function (d) {
      if (!d) { flash("No hay partidas guardadas en este navegador"); return; }
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([d])); a.download = C.saveKey + ".hmsave"; a.click();
    });
  };
  $("#import").onchange = function (e) {
    var f = e.target.files[0]; if (!f) return;
    f.arrayBuffer().then(function (b) {
      var u = new Uint8Array(b);
      if (!unpack(u).length) { alert("Ese fichero no es una copia de partidas válida."); return; }
      if (!confirm("¿Restaurar esta copia? Sustituye las partidas guardadas en este navegador.")) return;
      return idb.put(C.saveKey, u).then(function () { alert("Restaurada. Recarga la página y pulsa Jugar."); });
    });
  };
  $("#fs").onclick = function () { var s = $("#stage"); if (document.fullscreenElement) document.exitFullscreen(); else if (s.requestFullscreen) s.requestFullscreen(); };
  document.addEventListener("visibilitychange", function () { if (document.hidden) saveNow("Guardado automático"); });
  window.addEventListener("pagehide", function () { saveNow("Guardado al salir"); });
})();
