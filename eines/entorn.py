#!/usr/bin/env python3
"""Regenera assets/entorn.js a partir de tex/main.tex, tex/headers.tex i tex/defs.tex.
La web s'obre també amb doble clic (file://), on no es poden llegir fitxers: per això
el text dels tres fitxers va incrustat en un .js. Font única: tex/*.tex. No editis entorn.js a mà.
Ús:  python3 eines/entorn.py"""
import json, pathlib
arrel = pathlib.Path(__file__).resolve().parent.parent
dades = {k: (arrel / 'tex' / f'{k}.tex').read_text(encoding='utf-8') for k in ('main', 'headers', 'defs')}
js = ('// entorn.js — GENERAT per eines/entorn.py a partir de tex/*.tex. No l\'editis a mà.\n'
      'var Entorn = ' + json.dumps(dades, ensure_ascii=False, indent=1) + ';\n'
      "if (typeof module !== 'undefined') module.exports = Entorn;\n")
(arrel / 'assets' / 'entorn.js').write_text(js, encoding='utf-8')
print('assets/entorn.js regenerat')
