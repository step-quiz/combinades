# Operacions combinades · 1r ESO

Web estàtica (HTML + CSS + JS, sense dependències ni build) que genera fulls de dues activitats,
**Operacions combinades** i **Completa la igualtat**, i els lliura com a `exN.tex` (només el cos: el teu
`main.tex` fa `\input{ex1.tex}`). El PDF, el fas tu compilant-lo amb LaTeX, o el
treus directament del navegador amb **Crea el PDF** (vegeu més avall).

## Ús
Obre `index.html` amb doble clic. A dalt del panell tries l'activitat. La configuració va en tres passos, en
l'ordre en què es fa un full; cadascun es plega i, plegat, en diu el resum (el navegador recorda quins tens oberts):

1. **Exercicis:** quantes operacions (1–10), els nombres (ℕ, ℤ o ℚ; amb ℤ i ℚ, on hi pot haver negatius o
   fraccions i si n'hi ha d'haver sempre), les operacions que hi surten a més de + − · (divisions, parèntesis,
   potències, oposats) i la dificultat: *totes iguals* o *de fàcil a difícil*.
2. **Aspecte del full:** l'espai per resoldre cada operació, l'espai entre els signes i si l'espai es manté a dalt
   d'una pàgina (`\vspace*`).
3. **Solucions:** *cap*, *ajuda parcial* (alguns exercicis resolts dins del mateix full) o un *solucionari* a part
   (vegeu més avall).

Les opcions que depenen d'una altra només surten quan serveixen: «on hi pot haver negatius», amb ℤ o ℚ;
«simplifica fraccions a banda», amb ℚ; com es veu la resolució, només si n'hi ha; els colors, només amb «destaca».
«Entorn» (els fitxers de la carpeta) va plegat a baix: es baixa un sol cop. Els botons diuen només el nom curt
(ℕ, *Ajuda parcial*…); en passar-hi el ratolí, surt què fan.
Cada ↻ regenera un exercici; **↻ Full nou**, al costat del títol del full, el fa tot de nou.

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

Al panell, el pas **Solucions** té tres opcions (a l'adreça, `sol=cap|guiades|solucionari`):

- **Cap**: el full de sempre.
- **Ajuda parcial** (`guiades`): alguns exercicis del full surten resolts pas a pas, com a model. Per defecte,
  el primer; es trien amb «Resolts: els primers 1, 2, 3» o amb la casella «resolt» de cada targeta. A la web i a
  l'`exN.tex`, els resolts porten la resolució a sota (i poc espai); la resta, com sempre.
- **Solucionari**: l'`exN.tex` no canvia, i a la barra de baix apareix **Baixa exN-sol.tex** (tots els
  exercicis resolts, amb la mateixa numeració; al `main.tex`, `\input{exN-sol.tex}`). A la web, cada exercici
  surt resolt, tal com al solucionari.

La resolució segueix l'ordre de l'aula:
- primer els parèntesis, d'un en un: el més interior i, si n'hi ha diversos, el de més a l'esquerra;
- dins de cada un, i després a tota l'expressió: les potències, després · i :, i després + i −, d'una en una;
- abans de les sumes i restes, una línia amb la regla dels signes: `5 − (−3) + (−8) = 5 + 3 − 8`;
- amb fraccions, una línia amb el comú denominador (el m.c.m.), `1/2 + 1/3 = 3/6 + 2/6 = 5/6`, i, si el resultat
  es pot simplificar, una més: `= 3/6 = 1/2`.

Opcions: a cada línia, *totes les del mateix nivell* (`gra=prio`: totes les potències, o totes les · i : que es
poden fer, en una línia; `2·3 + 4·5 = 6 + 20 = 26`) o *una sola operació* (`gra=op`: `= 6 + 4·5 = 6 + 20 = 26`);
*simplifica fraccions a banda* (un resultat que es pot simplificar, se simplifica a la línia següent); **destaca
l'operació següent**; i, al solucionari, *només el resultat de cada exercici*. Els exercicis que no surten resolts
tenen **Veure els passos**.

**Destaca l'operació següent:** a cada línia, el que es calcula a la següent va dins d'una caixa, i el resultat,
a la línia següent, és del color de la seva caixa. Hi ha dos colors, que s'alternen línia a línia:

```
[4 · 3] · 3        la caixa, del 1r color
[12 · 3]           la caixa, del 2n color; el 12 (el resultat de 4 · 3), del 1r
36                 del 2n (el resultat de 12 · 3)
```

Els dos colors es trien sota la casella (**Colors**: un botó per a cadascun obre una paleta de 16); per defecte,
blau fosc i vermell. Van a l'adreça (`c1=blaufosc&c2=vermell`). Al `.tex`, la caixa és
`{\color{destaca1}\boxed{…}}` i el resultat, `{\color{destaca1}…}`; el fitxer mateix defineix els dos colors al
principi (`\definecolor{destaca1}{HTML}{00008B}\definecolor{destaca2}{HTML}{D32F2F}`): només cal el paquet
`xcolor`, que ja carrega el `headers.tex` de l'Entorn. Amb el fons fosc de la pantalla, a la web són més clars.

**Centrat seguint els símbols matemàtics** canvia la disposició: els signes d'operació queden alineats en
columna, cada resultat va centrat sota el que substitueix i el «=» és al final de cada línia (menys de l'última):

```
2 + 3 · (5 − 2)² + 8 =
2 + 3 ·    3²    + 8 =
2 + 3 ·    9     + 8 =
2 +     27       + 8 =
     29          + 8 =
           37
```

Es veu igual a la web (una taula) i al `.tex`, on cada resolució és un `array` (LaTeX estàndard): una columna
per a cada nombre, operador i parèntesi de l'enunciat, i `\multicolumn` per als resultats. Amb *destaca*, cada
nombre i cada signe es queden a la seva columna, també dins d'una caixa: la caixa és un marc del color de la línia,
que va del primer tros del que es calcula a l'últim, i el resultat de la línia següent, del mateix color, va centrat
sota el que substitueix. Perquè el marc no toqui res, amb *destaca* els nombres porten una mica d'aire a banda i
banda (a totes les línies). Al `.tex`, cada caixa és una cel·la que ocupa les seves columnes, amb un `array` a dins
que té les mateixes columnes (i, invisibles, els trossos de les altres línies, perquè facin el mateix ample) i el
marc dibuixat al voltant; a la web, cada tros és a la seva cel·la, i el marc, a les cel·les de la caixa.

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

## Crea el PDF

El botó **Crea el PDF**, a la barra de baix, obre una pestanya nova (`imprimir.html`, amb la mateixa adreça `#…`)
amb el mateix full en fulls A4, com fa *inaba*:

- al primer full, la capçalera `Nom: ______  Curs: ____  Data: _____`;
- cada exercici, numerat, amb l'espai per resoldre'l a sota (el mateix que al `.tex`: petit 1,5 cm, mitjà 3 cm,
  gran 5 cm); un exercici no es parteix mai entre dos fulls: si no hi cap, passa al següent;
- amb *ajuda parcial*, els exercicis resolts surten resolts; amb *solucionari*, les solucions van després, en fulls
  a part que comencen amb «Solucions»;
- a **Completa la igualtat**: l'enunciat, l'exemple i les igualtats en dues columnes, separades per una línia
  discontínua (amb l'alçada de fila del `.tex`); amb *solucionari*, les solucions en un full a part;
- cada full porta el número de pàgina («1 / 3»).

A la pestanya nova, prem **Imprimeix o desa com a PDF** i, al diàleg del navegador: *Destinació* → **Desa com a
PDF**, i desmarca **Capçaleres i peus de pàgina** (si no, el navegador hi afegeix la data i l'adreça). Els marges ja
són els del full: no cal tocar-los.

## Proves

```
node tests/prova.js       # la lògica i el solucionari: uns 25.000 exercicis, cap dependència (uns 2 min)
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
Amb «destaca», que les caixes de cada línia siguin del seu color i que cada resultat sigui el de la seva caixa, del
mateix color.

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
index.html           l'eina
imprimir.html        els fulls A4 per imprimir o desar com a PDF («Crea el PDF»)
assets/motor.js      operacions combinades: model, generador, validador, renderitzadors (sense DOM)
assets/igualtats.js  completa la igualtat: cercador, generador i .tex (sense DOM)
assets/comu.js       el que comparteixen app.js i imprimir.js (llegir l'adreça, colors, marcs)
assets/app.js        interfície
assets/imprimir.js   paginació dels fulls A4 (imprimir.html)
assets/imprimir.css  estil dels fulls A4
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

**Versió.** `VERSIO`, a `assets/motor.js` (surt a dalt a la dreta de l'eina i al principi de cada `.tex`), i el
`?v=` de cada fitxer de `assets/` a `index.html` i a `imprimir.html` han de dir el mateix: `tests/prova.js` ho comprova. Així, quan es
publica una versió nova, el navegador baixa de nou l'estil i el JavaScript, i no fa servir els d'abans, que tenia
desats (amb els d'abans, la pàgina nova es veia sense format i alguns botons no anaven).
