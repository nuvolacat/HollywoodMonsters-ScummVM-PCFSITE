#!/usr/bin/env python3
"""make-index.py <carpeta MONSTERS del CD> <carpeta de salida>

Genera, a partir de la carpeta MONSTERS del CD de Hollywood Monsters (2ª edición, español):
  - index.json   {nombre: tamaño}  → lo que necesita el reproductor web y el sistema de ficheros HTTP de ScummVM
  - hashes.json  {nombre: {size, md5, sha256}}  → para comprobar que la copia del usuario es la buena (diag.html)
No copia ningún fichero del juego: los datos los aporta cada uno desde su CD original.
"""
import hashlib, json, os, sys

def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src, dst = sys.argv[1], sys.argv[2]
    os.makedirs(dst, exist_ok=True)
    index, hashes = {}, {}
    for n in sorted(os.listdir(src)):
        p = os.path.join(src, n)
        if n.startswith(".") or not os.path.isfile(p) or n in ("index.json", "hashes.json", "LEEME.txt"):
            continue
        b = open(p, "rb").read()
        index[n] = len(b)
        hashes[n] = {"size": len(b), "md5": hashlib.md5(b).hexdigest(), "sha256": hashlib.sha256(b).hexdigest()}
    json.dump(index, open(os.path.join(dst, "index.json"), "w"), indent=0, sort_keys=True)
    json.dump(hashes, open(os.path.join(dst, "hashes.json"), "w"), indent=1, sort_keys=True)
    print(f"{len(index)} ficheros, {sum(index.values()) / 1048576:.1f} MB → {dst}/index.json y hashes.json")

if __name__ == "__main__":
    main()
