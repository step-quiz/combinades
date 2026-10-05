# Operacions combinades · 1r ESO

Web estàtica (HTML + CSS + JS, sense dependències ni build) que genera fulls d'operacions combinades
i els lliura com a `exN.tex` (només el cos: el teu `main.tex` fa `\input{ex1.tex}`) o com a PDF d'impressió del navegador.

## Ús
Obre `index.html` amb doble clic. Tria operacions (1–10), espai, conjunt (ℕ/ℤ/ℚ) i opcions.
Cada ↻ regenera un exercici; «Genera-ho tot» en fa un full nou. L'adreça (`#…`) guarda el full.

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
tests/prova.js    proves amb Node
todo.md           feina pendent
```

El PDF de la web és el d'impressió del navegador, **no** un PDF compilat amb LaTeX.
Per al PDF compilat, baixa el `.tex` i compila'l amb el teu `main.tex`.
