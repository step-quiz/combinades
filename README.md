# Operacions combinades · 1r ESO

Web estàtica (HTML + CSS + JS, sense dependències ni build) que genera fulls d'operacions combinades
i els lliura com a `exN.tex` (només el cos: el teu `main.tex` fa `\input{ex1.tex}`) o com a PDF d'impressió del navegador.

## Ús
Obre `index.html` amb doble clic. Tria operacions (1–10), espai, conjunt (ℕ/ℤ/ℚ) i opcions.
Cada ↻ regenera un exercici; «Genera-ho tot» en fa un full nou. L'adreça (`#…`) guarda el full.

## La carpeta de fulls

Es prepara un sol cop. A la columna de configuració, l'apartat **Entorn** baixa els tres fitxers:

```
fulls/
  main.tex            \input del full que vulguis compilar
  headers.tex         paquets i format de pàgina
  defs.tex            macros (aspecte del full)
  capsalera.tex       la capçalera del teu centre (opcional, la poses tu)
  ex1.tex  ex2.tex …  baixats del lloc
```

Per fer un full: genera'l, baixa `exN.tex`, posa'l a la carpeta, canvia `\input{ex1.tex}` del `main.tex`
i compila amb `pdflatex main.tex` (o puja la carpeta a Overleaf).

**Font única:** `tex/main.tex`, `tex/headers.tex` i `tex/defs.tex`. El lloc els porta incrustats a
`assets/entorn.js` (perquè funcioni amb doble clic), que és un fitxer **generat**. Si edites un `.tex`:

```
python3 eines/entorn.py
node tests/prova.js
```

La prova falla si `entorn.js` no coincideix amb els `.tex`.

## Proves
```
node tests/prova.js
```

## Estructura
```
index.html        pàgina única
assets/motor.js   model, generador, validador, renderitzadors (sense DOM)
assets/app.js     interfície
assets/style.css  estil (clar/fosc/impressió)
assets/entorn.js  GENERAT: main/headers/defs incrustats
tex/              main.tex, headers.tex, defs.tex (font única)
eines/entorn.py   regenera assets/entorn.js
tests/prova.js    proves amb Node
todo.md           feina pendent
```

El PDF de la web és el d'impressió del navegador, **no** un PDF compilat amb LaTeX.
Per al PDF compilat, baixa el `.tex` i compila'l amb el teu `main.tex`.
