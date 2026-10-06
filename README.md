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

**Parèntesis.** Amb «parèntesis» marcat, cada exercici en porta com a molt 3, i el 3 és improbable. Compten tots
els que es veuen menys els d'un sol nombre: `(−3)` i `(½)²` no compten, i `(−(2+3))` en té dos.
- *Gradual:* de cada 10 exercicis, 4 sense parèntesis, 3 amb 1 i 3 amb 2, en aquest ordre.
- *Immediata:* tots en porten, 6 amb 1 i 4 amb 2, barrejats.
- En un full de cada 7 (15 %), un dels de 2 en porta 3 (a «gradual», l'últim).

És el *generador 2* (`g=2` a l'adreça). Els enllaços d'abans, sense `g`, es continuen fent amb el generador 1 i
donen exactament el mateix full que quan els vas desar.

## Solucions

Al panell, **Solucions** té tres modes:

- **cap**: el full de sempre.
- **guiades**: alguns exercicis del full surten resolts pas a pas, com a model. Es trien amb la casella
  «resolt» de cada targeta o amb «Resol els primers 1, 2, 3». A l'`exN.tex` i a la impressió, els resolts porten
  la resolució a sota (i poc espai); la resta, com sempre.
- **solucionari**: l'`exN.tex` no canvia, i a la barra de baix apareixen **Baixa exN-sol.tex** (tots els
  exercicis resolts, amb la mateixa numeració; al `main.tex`, `\input{exN-sol.tex}`) i **PDF solucions**.

La resolució segueix l'ordre de l'aula:
- primer els parèntesis, d'un en un: el més interior i, si n'hi ha diversos, el de més a l'esquerra;
- dins de cada un, i després a tota l'expressió: les potències, després · i :, i després + i −, d'una en una;
- abans de les sumes i restes, una línia amb la regla dels signes: `5 − (−3) + (−8) = 5 + 3 − 8`;
- amb fraccions, una línia amb el comú denominador (el m.c.m.), `1/2 + 1/3 = 3/6 + 2/6 = 5/6`, i, si el resultat
  es pot simplificar, una més: `= 3/6 = 1/2`.

Opcions: *per prioritat* (totes les operacions del mateix nivell en una línia) o *una operació per pas*;
*simplifica les fraccions en una línia a part*; *destaca l'operació de la línia següent* (`\underbrace`); i, al
solucionari, *només els resultats*. Cada targeta té **Veure els passos**, en qualsevol mode.

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
node tests/prova.js       # la lògica i el solucionari: uns 24.000 exercicis, cap dependència (uns 35 s)
node tests/compila.js     # compila fulls de debò amb el main.tex (cal pdflatex)
node tests/navegador.js   # l'eina en un navegador de debò (cal Playwright)
```

Totes tres acaben amb codi 1 si alguna cosa falla, i GitHub les passa soles a cada push (vegeu més avall).

`tests/prova.js` torna a llegir el TeX de cada exercici amb un analitzador independent i en recalcula el valor.
Comprova els conjunts (ℕ/ℤ/ℚ, intermedis i resultat), «força que apareguin», que hi surti cada operació demanada
(també la resta i l'oposat), que la previsualització digui el mateix que el TeX i que cada parèntesi sigui més gran
que els que té a dins. Ho fa per a totes les combinacions d'opcions possibles, també les graduals. De cada
resolució, comprova que cada línia valgui el mateix que l'enunciat, que l'ordre dels passos sigui el de l'aula
(escrit a la prova pel seu compte) i que l'`exN.tex` normal no canviï ni un byte (`tests/referencia-cap.tex`).

**Empremtes.** `tests/empremtes.json` fixa quins exercicis surten per a cada combinació d'opcions i cada generador.
Si un canvi al codi canvia els exercicis, els fulls desats a l'adreça ja no tornarien a sortir iguals, i la prova ho
diu. Per canviar els exercicis cal un generador nou (`todo.md`, §6.3); les empremtes del generador nou, mentre encara
no s'ha publicat, es refan amb `node tests/prova.js --actualitza-empremtes` (les dels antics, no es deixen tocar).

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
tests/referencia-cap.tex  un exN.tex de cada mena: el mode «cap» no ha de canviar
tests/compila.js     compilació de debò (pdflatex)
tests/navegador.js   proves amb navegador (Playwright)
todo.md              estat, revisió i feina pendent
```
