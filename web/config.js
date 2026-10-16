/* Configuración del reproductor. Cámbiala según dónde sirvas los ficheros. */
window.HM_CONFIG = {
  target: "hollywood",                 // target / engineid de ScummVM
  engineVersion: 6,                    // usa /scummvm/scummvm-<engineVersion>.js y .wasm (pareja inseparable)
  dataBase: "/scummvm/data/games/hollywood",   // carpeta (URL) con los ficheros del juego + index.json (tools/make-index.py)
  dataSuffix: "",                      // sufijo añadido a cada fichero al descargarlo (p. ej. ".bin" si tu CDN solo cachea esa extensión)
  storageDir: "hm-scummvm",            // carpeta en el almacén privado del navegador (OPFS) para la copia local del juego
  saveKey: "hollywood",                // clave de las partidas en IndexedDB
};
