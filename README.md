# Operacions combinades · 1r ESO

Web estàtica (HTML + CSS + JS, sense dependències ni build) que genera fulls d'operacions combinades
i els lliura com a `exN.tex` (només el cos: el teu `main.tex` fa `\input{ex1.tex}`) o com a PDF d'impressió del navegador.

## Ús
Obre `index.html` amb doble clic. Tria operacions (1–10), espai, conjunt (ℕ/ℤ/ℚ) i opcions.
Cada ↻ regenera un exercici; «Genera-ho tot» en fa un full nou.

**L'adreça (`#…`) guarda el full.** Desa l'enllaç i tornaràs a tenir els mateixos exercicis, també si l'obres
en una pestanya on ja tens l'eina oberta. El `.tex` porta l'adreça escrita a la tercera línia:

```
% per refer aquest full: index.html#n=5&esp=mitja&…&seed=k3x9q&r=0,1,0,0,0
```

Per refer aquest full, obre l'eina i posa al final de l'adreça del navegador el tros que comença per `#`.

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

El PDF de la web és el d'impressió del navegador, **no** un PDF compilat amb LaTeX.
Per al PDF compilat, baixa el `.tex` i compila'l amb el teu `main.tex`. Al diàleg d'impressió del navegador,
desmarca *Capçaleres i peus de pàgina*. Una fórmula que no cabria a l'amplada del paper s'imprimeix una mica
més petita (només aquella): abans es partia en dues línies.

## Proves

```
node tests/prova.js       # la lògica: uns 11.500 exercicis, cap dependència (uns 6 s)
node tests/compila.js     # compila fulls de debò amb el main.tex (cal pdflatex)
node tests/navegador.js   # l'eina en un navegador de debò (cal Playwright)
```

Totes tres acaben amb codi 1 si alguna cosa falla, i GitHub les passa soles a cada push (vegeu més avall).

`tests/prova.js` torna a llegir el TeX de cada exercici amb un analitzador independent i en recalcula el valor.
Comprova els conjunts (ℕ/ℤ/ℚ, intermedis i resultat), «força que apareguin», que hi surti cada operació demanada
(també la resta i l'oposat), que la previsualització digui el mateix que el TeX i que cada parèntesi sigui més gran
que els que té a dins. Ho fa per a totes les combinacions d'opcions possibles, també les graduals.

**Empremtes.** `tests/empremtes.json` fixa quins exercicis surten per a cada combinació d'opcions. Si un canvi al
codi canvia els exercicis, els fulls desats a l'adreça ja no tornarien a sortir iguals, i la prova ho diu. Si el
canvi és a propòsit (una versió nova del generador), refés-les amb `node tests/prova.js --actualitza-empremtes`.

`tests/navegador.js` necessita Playwright: `npm install --no-save playwright` i `npx playwright install chromium`.
No deixa cap fitxer a l'arbre.

## GitHub: proves automàtiques i pujades per ZIP

- **`.github/workflows/proves.yml`** passa les tres proves a cada push a `main` i a cada pull request. No escriu res al
  repositori (cap commit), o sigui que no afecta Cloudflare Pages. Es veu a la pestanya **Actions**: verd, tot bé;
  vermell, clica-hi i surt quina comprovació ha fallat.
- **`.github/workflows/unzip-upload.yml`**: un ZIP pujat a `_uploads/` (sense carpeta contenidora) es descomprimeix
  a l'arrel, s'esborra i se'n fa un commit; després es passa `tests/prova.js`. El commit **no** porta «[skip ci]»,
  perquè Cloudflare no el publicaria.
- Els fitxers de `.github/workflows/` no poden arribar dins d'un ZIP: el bot no hi té permís. Es creen i s'editen
  des de la web de GitHub.

## Estructura
```
index.html           pàgina única
assets/motor.js      model, generador, validador, renderitzadors (sense DOM)
assets/app.js        interfície
assets/style.css     estil (clar/fosc/impressió)
assets/entorn.js     GENERAT: main/headers/defs incrustats
tex/                 main.tex, headers.tex, defs.tex (font única)
eines/entorn.py      regenera assets/entorn.js
tests/prova.js       proves de la lògica (Node)
tests/empremtes.json els exercicis de cada combinació, fixats
tests/compila.js     compilació de debò (pdflatex)
tests/navegador.js   proves amb navegador (Playwright)
todo.md              estat, revisió i feina pendent
```
