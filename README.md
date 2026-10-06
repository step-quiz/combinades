# Operacions combinades · 1r ESO

Web estàtica (HTML + CSS + JS, sense dependències ni build) que genera fulls de dues activitats,
**Operacions combinades** i **Completa la igualtat**, i els lliura com a `exN.tex` (només el cos: el teu
`main.tex` fa `\input{ex1.tex}`). El PDF, el fas tu compilant-lo amb LaTeX.

## Ús
Obre `index.html` amb doble clic. A dalt del panell tries l'activitat. A «Operacions combinades», tria operacions
(1–10), espai, conjunt (ℕ/ℤ/ℚ) i opcions.
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
  «resolt» de cada targeta o amb «Resol els primers 1, 2, 3». A la web i a l'`exN.tex`, els resolts porten la
  resolució a sota (i poc espai); la resta, com sempre.
- **solucionari**: l'`exN.tex` no canvia, i a la barra de baix apareix **Baixa exN-sol.tex** (tots els
  exercicis resolts, amb la mateixa numeració; al `main.tex`, `\input{exN-sol.tex}`). A la web, cada exercici
  surt resolt, tal com al solucionari.

La resolució segueix l'ordre de l'aula:
- primer els parèntesis, d'un en un: el més interior i, si n'hi ha diversos, el de més a l'esquerra;
- dins de cada un, i després a tota l'expressió: les potències, després · i :, i després + i −, d'una en una;
- abans de les sumes i restes, una línia amb la regla dels signes: `5 − (−3) + (−8) = 5 + 3 − 8`;
- amb fraccions, una línia amb el comú denominador (el m.c.m.), `1/2 + 1/3 = 3/6 + 2/6 = 5/6`, i, si el resultat
  es pot simplificar, una més: `= 3/6 = 1/2`.

Opcions: *per prioritat* (totes les operacions del mateix nivell en una línia) o *una operació per pas*;
*simplifica les fraccions en una línia a part*; **destaca la següent operació**: a cada línia, el que es calcula
a la següent surt en blau fosc i dins d'una caixa (a la web i al `.tex`, `{\color{darkblue}\boxed{…}}`); i, al
solucionari, *només els resultats*. Els exercicis que no surten resolts tenen **Veure els passos**.

El blau, el `.tex` mateix el defineix (`\providecolor{darkblue}{RGB}{0,0,139}`): només cal el paquet `xcolor`,
que ja carrega el `headers.tex` de l'Entorn. Amb el fons fosc de la pantalla, a la web és un blau clar.

**centrat: els signes en columna** canvia la disposició: els signes d'operació queden alineats en columna,
cada resultat va centrat sota el que substitueix i el «=» és al final de cada línia (menys de l'última):

```
2 + 3 · (5 − 2)² + 8 =
2 + 3 ·    3²    + 8 =
2 + 3 ·    9     + 8 =
2 +     27       + 8 =
     29          + 8 =
           37
```

Es veu igual a la web (una taula) i al `.tex`, on cada resolució és un `array` (LaTeX estàndard): una columna
per a cada nombre, operador i parèntesi de l'enunciat, i `\multicolumn` per als resultats. Amb *destaca*, el que
es calcula surt en blau i dins d'una caixa (`\boxed`) que ocupa totes les seves columnes: el resultat de la línia
següent hi va centrat a sota.

Un `array` no es parteix entre pàgines, i una resolució llarga de ℚ pot fer més d'una pàgina. Per això, una
resolució de més de 12 línies va en blocs (un `array` sota l'altre, amb les mateixes columnes) i la pàgina es
pot partir entre dos blocs.

## Completa la igualtat

Uns nombres en ordre i un resultat, i l'alumnat hi posa els símbols que falten perquè la igualtat sigui certa:

```
1   2   5  = 15     →     (1 + 2) · 5 = 15
```

- **Regles:** els nombres (de 0 a 9) en l'ordre donat, tots i una sola vegada, sense ajuntar xifres (1 i 2 no fan
  12) i sense cap − davant del primer; cap valor, ni pel camí, negatiu ni de més de 100; divisions exactes; ² i √
  només damunt d'un nombre, i √ només d'un quadrat perfecte (√9 = 3).
- **Al panell:** quantes igualtats (de 3 a 15; per defecte 9), 3 o 4 nombres per igualtat, quins símbols es poden
  fer servir (+ − · sempre; parèntesis, ², √ i divisions, a triar), l'espai per escriure (petit / mitjà / gran) i
  les solucions (cap, amb «Veure la solució» a cada igualtat, o solucionari).
- **Dificultat, com el full del professor:** de cada 9, 5 surten només amb + − · :, 3 necessiten parèntesis i 1
  necessita ² o √, barrejades. El programa prova totes les maneres de posar-hi els símbols, o sigui que sap què
  necessita cadascuna; ↻ canvia la igualtat, però no la dificultat.
- **L'`exN.tex`:** l'enunciat (només amb els símbols triats), un exemple resolt (ombrejat, amb parèntesis) i les
  igualtats en 2 columnes, separades per una línia vertical discontínua (LaTeX estàndard: cap paquet de més).
  **`exN-sol.tex`:** la solució més senzilla de cada igualtat (la de menys parèntesis, ² i √), al mateix lloc que la
  seva igualtat; qualsevol altra de correcta també val.

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

La web no fa PDF: el PDF és sempre el de LaTeX, compilant el `.tex` amb el teu `main.tex`.

## Proves

```
node tests/prova.js       # la lògica i el solucionari: uns 24.000 exercicis, cap dependència (uns 40 s)
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
assets/motor.js      operacions combinades: model, generador, validador, renderitzadors (sense DOM)
assets/igualtats.js  completa la igualtat: cercador, generador i .tex (sense DOM)
assets/app.js        interfície
assets/style.css     estil (clar/fosc)
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
