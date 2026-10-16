/* Descarga de los datos de un juego ScummVM al almacén local (OPFS) desde un Web Worker, con
 * FileSystemSyncAccessHandle (Chrome, Firefox y Safari lo tienen; createWritable falta o falla en Safari). Mensaje de
 * entrada: {base, suffix, dir, prefix, index}; salida: {tipo:"progreso", got, total} … {tipo:"fin"} | {tipo:"error", msg}. */
self.onmessage = async function (e) {
  var m = e.data, names = Object.keys(m.index).filter(function (n) { return typeof m.index[n] === "number"; }).sort();
  var total = names.reduce(function (a, n) { return a + m.index[n]; }, 0), got = 0, estado = {};
  function progreso() { self.postMessage({ tipo: "progreso", got: got, total: total, estado: estado }); }
  try {
    var root = await navigator.storage.getDirectory();
    var dir = await root.getDirectoryHandle(m.dir, { create: true });
    async function one(name) {
      var size = m.index[name], cname = m.prefix + name;
      estado[name] = "comprobando";
      try { var f = await (await dir.getFileHandle(cname)).getFile(); if (f.size === size) { got += size; delete estado[name]; progreso(); return; } } catch (err) {}
      estado[name] = "descargando";
      var r = await fetch(m.base + "/" + name + m.suffix);
      if (!r.ok) throw new Error("No se pudo descargar " + name + " (" + r.status + ")");
      var h = await dir.getFileHandle(cname, { create: true });
      var acc = await h.createSyncAccessHandle();
      try {
        acc.truncate(0);
        var reader = r.body.getReader(), off = 0;
        while (true) {
          var x = await reader.read(); if (x.done) break;
          acc.write(x.value, { at: off }); off += x.value.length; got += x.value.length; progreso();
        }
        acc.flush();
      } finally { acc.close(); }
      if (off !== size) throw new Error("descarga incompleta de " + name + " (" + off + " de " + size + ")");
      delete estado[name];
    }
    var queue = names.slice(), workers = [];
    for (var i = 0; i < 3; i++) workers.push((async function () { var n; while ((n = queue.shift()) !== undefined) await one(n); })());
    await Promise.all(workers);
    self.postMessage({ tipo: "fin", names: names, total: total });
  } catch (err) {
    self.postMessage({ tipo: "error", msg: String(err && err.message || err) });
  }
};
