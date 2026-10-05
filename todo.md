# todo.md — estat i feina pendent

Projecte: generador d'operacions combinades de 1r d'ESO (web estàtica vanilla). Especificació original:
`instruccions-operacions-combinades-1eso.md`. Aquest fitxer és el punt de partida per a qui continuï la feina
(persona o IA): **llegeix-lo sencer abans de tocar res**, i respecta les regles de la secció 4.

---

## 1. Estat actual

**Versió:** v0.2 (revisió d'octubre de 2026: vegeu la secció 6).
**Proves:** `node tests/prova.js` → 82 combinacions × 100 exercicis, més les 328 combinacions possibles (també sense
«força» i graduals) × 10: 11.480 exercicis, 0 errors. Re-lectura independent del TeX, empremtes dels exercicis
(`tests/empremtes.json`), testimonis de «força», − binària i oposat, previsualització = TeX, mides dels parèntesis.
**LaTeX:** `node tests/compila.js` compila 40 exercicis de ℕ, de ℤ i de ℚ amb totes les opcions i símbols «gran»:
sense errors ni «Overfull», i la fórmula més ampla fa el 58 % de la línia. (També compilat pel professor amb el
seu `capsalera.tex`.)
**Interfície:** `node tests/navegador.js` (Chromium, 22 comprovacions: adreça, ↻, baixades, impressió, mòbil).
Falta mirar-la a Firefox, a Safari i en un mòbil de debò.

Fet:
- Controls: 1–10 operacions; espai entre operacions (petit/mitjà/gran); espai entre símbols (petit/mitjà/gran);
  ℕ/ℤ/ℚ amb «intermedis/resultat final»; divisions, oposat, potències, parèntesis; «força que apareguin»;
  progressió dels extres **immediata/gradual**; `\vspace*` opcional.
- Generació determinista amb llavors; ↻ per exercici (no canvia el nivell en mode gradual); «Genera-ho tot»;
  estat a l'adreça (`#…`) + `localStorage`.
- Sortida `exN.tex` (només el cos: LaTeX estàndard + `amsmath`), «Copia el TeX», codi visible, PDF d'impressió.
- Entorn: `tex/main.tex`, `tex/headers.tex`, `tex/defs.tex` (font única) → `assets/entorn.js` (generat amb
  `python3 eines/entorn.py`; la prova en comprova la paritat). `headers.tex` carrega `array`, `tabularx`,
  `xcolor[table]` i `graphicx` perquè ho necessita el `capsalera.tex` del professor (el d'`exam2bat`).
- Parèntesis: cada un més gran que els que té a dins, tant els d'agrupació com els de notació `(−3)`. Sense fraccions,
  mides fixes `(`, `\bigl(`, `\Bigl(`, `\biggl(`, `\Biggl(`; amb fraccions, `\left(…\right)` amb una alçada
  invisible dins de `\mathopen` (vegeu §6.1).
- Previsualització HTML sense llibreries, amb xifres alineades (`lining-nums`) i potències que no desquadren la línia.
- El `.tex` porta a la tercera línia l'adreça que el refà (`% per refer aquest full: index.html#…`).

---

## 2. PROPERA TASCA: solucionari pas a pas

### 2.1 Què vol el professor

Poder triar, per a cada full, entre:

| Mode | Per a què | Què surt |
|---|---|---|
| **Cap** (per defecte) | full normal | com ara |
| **Guiades** | guiar l'alumnat: alguns exercicis del mateix full surten **resolts pas a pas**, com a model | al mateix `exN.tex`, els exercicis triats porten la resolució a sota; la resta, sense |
| **Solucionari** | donar-lo a l'alumnat **després** que hagin fet el full | un fitxer a part, `exN-sol.tex`, amb **tots** els exercicis resolts pas a pas |

En mode **Guiades**, el professor tria quins exercicis surten resolts:
- una casella **«resolt»** a cada targeta;
- i una drecera **«resol els k primers»** (k = 1, 2, 3), que és el cas habitual (els primers fan de model).

En mode **Solucionari**, el full de l'alumnat (`exN.tex`) **no canvia**, i a la barra inferior apareix un
segon botó: **«Baixa exN-sol.tex»**. Al `main.tex` el professor fa `\input{ex3-sol.tex}`.

### 2.2 Algorisme dels passos (a `motor.js`, funció pura)

```js
Motor.passos(arbre, opcions) // → [arbre0, arbre1, …, arbreFinal]  (arbre0 = l'enunciat; arbreFinal = un sol valor)
```

- Cada pas **clona** l'arbre i substitueix un o diversos nodes reductibles pel seu valor.
  Nou tipus de fulla: `{t:'val', n, d}` (valor exacte, irreductible).
- **Node reductible:** un `bin`, `pow` o `neg` tots els fills del qual ja són `num`, `frac` o `val`.
- **Ordre (el de l'aula de 1r d'ESO), dins del «focus»:**
  1. **Focus** = el grup entre parèntesis més interior (i, si n'hi ha diversos, el de més a l'esquerra) que encara
     no és un valor. Sense grups pendents, el focus és tota l'expressió.
  2. Dins del focus: primer els **oposats** d'un valor (`−(−3)` → `3`), després les **potències**,
     després **· i :** d'esquerra a dreta, i finalment **+ i −** d'esquerra a dreta.
- **Granularitat** (opció de l'usuari, per defecte **per prioritat**):
  - *per prioritat*: en un pas es fan **totes** les operacions reductibles del mateix nivell dins del focus
    (`2·3 + 4·5` → `6 + 20`);
  - *una operació per pas*: només la de més a l'esquerra (per als exemples guiats més lents).
- **Fraccions (ℚ):** el resultat d'una operació es mostra primer tal com surt i, si és reductible,
  un pas més «= simplificada» (`\frac{6}{8}` → `\frac{3}{4}`). Opció per desactivar-ho.
- **Parèntesis que desapareixen:** no cal cap regla especial. Un `bin` reduït a `val` deixa de ser `bin`,
  i la regla de §4.3 de l'especificació ja no hi posa parèntesis: `(2+3)·4` → `5·4`.
- **Renderitzat d'un `val`:** enter ≥ 0 → com `num`; negatiu → com `neg` (amb la regla de notació:
  sense parèntesi només si és el primer símbol del grup, si no `(−7)`); fracció → `\frac`, amb signe si cal.
  Com a base d'una potència, un `val` negatiu o fraccionari va entre parèntesis (ja ho fa la regla de `pow`).
- **Determinista:** els passos depenen només de l'arbre; no fan servir el PRNG.

### 2.3 Format TeX

Exercici resolt (al full en mode Guiades, o a `exN-sol.tex`):

```latex
\item $\displaystyle 3\cdot (5-2)+4^{2}:8$
\begin{align*}
&= 3\cdot 3+16:8\\
&= 9+2\\
&= 11
\end{align*}
\par\vspace{3cm}
```

- Només `amsmath` (`align*`): l'`exN.tex` **no pot dependre de `defs.tex`** (regla D4).
- Afegir `\allowdisplaybreaks` dins de l'`enumerate` (és local) perquè una resolució llarga pugui partir de pàgina.
- Opcional (casella **«destaca l'operació»**): a cada línia, la part que es calcularà al pas següent,
  amb `\underbrace{…}_{}` (LaTeX bàsic, sense colors).
- En mode Guiades, el `\vspace` d'un exercici resolt pot ser **petit** (no cal espai per escriure-hi).
- `exN-sol.tex`: mateixa numeració que `exN.tex`, capçalera de comentari amb `solucionari de exN`,
  i abans de l'`enumerate` una línia `\noindent\textbf{Solucions}\par\medskip`. Espai entre exercicis: petit.
- Opció **«només resultats»** al solucionari: una línia per exercici, `= 11`, sense passos.

### 2.4 Web

- Selector **«Solucions»**: cap · guiades · solucionari. Opcions: granularitat, simplifica fraccions,
  destaca l'operació, només resultats.
- Targeta: casella **«resolt»** (només en mode Guiades) i un desplegable **«Veure els passos»** a qualsevol mode
  (útil per al professor). Els passos, en HTML, amb el mateix emissor que l'enunciat.
- **PDF d'impressió:** en mode Guiades, com el `.tex`; en mode Solucionari, un segon botó «PDF solucions».
- Adreça: `sol=cap|guiades|solucionari`, `res=0,2` (índexs resolts), `gra=prio|op`, `simp=1`, `dest=0`, `nomes=0`.
  Valors desconeguts → valor per defecte. `localStorage` com la resta.

### 2.5 Proves que cal afegir a `tests/prova.js` (obligatòries)

Per a totes les combinacions vàlides i les dues granularitats:
1. **Cada pas té el mateix valor** que l'enunciat (analitzador independent sobre el **text TeX** de cada línia).
2. El **primer** pas és l'enunciat, l'**últim** és un sol valor igual a `e.valor`, i dos passos seguits **no són iguals**.
3. Nombre de passos ≤ nombre de nodes; granularitat «una operació» ≥ «per prioritat».
4. **Ordre:** cap pas no redueix un `+`/`−` mentre al mateix focus hi ha un `·`, `:` o potència pendents,
   ni res de fora d'un grup mentre el grup té operacions pendents.
5. Cap valor que aparegui als passos no surt del conjunt permès (ℕ/ℤ/ℚ).
6. `exN.tex` en mode Cap és **byte a byte igual** que abans de la feina (no trencar els fulls ja fets).
7. Els fitxers compilen: si hi ha `pdflatex` a l'entorn, compilar un full Guiades i un solucionari amb el `main.tex`.

### 2.6 Casos que cal mirar amb cura

- `−(−3)`, `5−(−3)`, `(−2)^3`, `−(4+6):2` (oposat d'un grup: primer el grup, després l'oposat).
- Divisió amb fraccions: `\frac{1}{2}:\frac{3}{4}` → `\frac{2}{3}` (amb el pas de simplificació si cal).
- Potència d'un grup: `(3+1)^2` → `4^2` → `16`.
- Un sol exercici molt llarg (N = 10, totes les opcions, granularitat «una operació»): ha de cabre o partir bé.

### 2.7 Notes de la revisió (resoldre-les abans de programar)

1. **L'oposat d'un nombre no és una operació.** `−3` (un `neg` damunt d'un `num` o d'una `frac`) s'ha de tractar com
   un nombre des del principi. Si fos «reductible», el primer pas canviaria `(−3)` per `(−3)`: el mateix text, i la
   prova 2.5.2 («dos passos seguits no són iguals») fallaria.
2. **`−` d'un valor positiu tampoc canvia el text.** `−(4+6):2` → `−10:2`: després de reduir el grup, el node és
   `neg(val 10)`, que s'escriu `−10`, igual que `val(−10)`. Només `−(−3)` → `3` canvia el text. Aquests passos s'han
   de fondre amb l'anterior (sense línia nova).
3. **Grups germans.** Amb el focus «el més interior i el de més a l'esquerra», `(2+3)·(4+5)` fa tres passos
   (`5·(4+5)`, `5·9`, `45`). A l'aula sovint es resolen tots els parèntesis del mateix nivell alhora (`5·9`).
   Decidir-ho (potser: «per prioritat» → tots alhora; «una operació» → d'un en un).
4. **Fraccions «tal com surt».** Cal definir-ho per a + i −: comú denominador amb el m.c.m. o amb el producte? I, a
   1r d'ESO, potser un pas intermedi amb els denominadors ja igualats: `1/2 + 1/3 = 3/6 + 2/6 = 5/6`.
5. **Mida dels parèntesis a cada línia.** Es recalcula sola: quan un grup de dins es redueix, el de fora es fa
   més petit a la línia següent. És el que fa `escriu()`; només cal saber-ho.
6. **On encaixa el tipus nou `val`.** A `escriu()` (motor.js) n'hi ha prou amb un `case 'val'` (com `num` si és ≥ 0;
   com un oposat, amb la regla de notació, si és negatiu; `\frac` si és fracció). `calParentesi()` serveix igual.
7. **El valor `−0`.** `−(3−3)` dona `−0` en JavaScript. `String(-0)` és `"0"`, o sigui que s'escriu bé, però una
   comparació amb `Object.is` el distingiria de `0`. (O s'eviten aquests exercicis: vegeu §6.2.)
8. Per a la prova 2.5.1, l'analitzador independent de `tests/prova.js` (`llegeix`) ja llegeix el TeX de cada línia
   i en valida la sintaxi (parelles i mides de parèntesis, el `−` unari).

---

## 3. Altres tasques pendents (per ordre d'importància)

1. **Provar la interfície** a Firefox, Safari i un mòbil de debò (Chromium ja es prova sol: `tests/navegador.js`).
2. ~~Proves: comprovar també la presència de la `−` binària i els testimonis de «força».~~ Fet (v0.2).
3. ~~**Combinacions impossibles** (`Motor.valida`): revisar si en falta cap.~~ Fet (v0.2): no en falta cap. Les 3
   regles (oposat amb ℕ; oposat sense «intermedis»; ℚ només «final» sense divisions i parèntesis) deixen 328
   combinacions possibles, i totes generen fulls sencers (`tests/prova.js` les prova totes cada vegada).
4. **Oposat damunt de potència:** `neg(pow)` està exclòs (evita `−2^2`, ambigu). Decidir si es vol `−(2^3)`.
5. **Longitud** de cada operació: ara fixa (3–5 operadors binaris, +1 amb divisions). Control opcional.
6. Espai entre símbols: ara només als operadors; decidir si també als parèntesis.
7. ~~Infraestructura~~ Fet: els workflows `proves.yml` i `unzip-upload.yml` hi són (v0.2), i Cloudflare Pages ja
   publica el repositori (projecte `combinades`; cada pull request en té una vista prèvia).
8. Ampliacions: «Tot en un» (preàmbul incrustat), «Obre a Overleaf», versió de 2n d'ESO.
9. Decidir les preguntes de la secció 6.2 (profunditat dels parèntesis i operacions trivials).

---

## 4. Regles que no es poden trencar

- **Web estàtica vanilla:** cap llibreria, cap pas de build, scripts clàssics (no mòduls), funciona amb doble clic.
- **`motor.js` és pur** (sense DOM) i s'exporta a Node. Tota la lògica nova (passos inclosos) hi va i es prova amb Node.
- **Un sol recorregut, dos emissors** (TeX i HTML): la previsualització i el `.tex` no poden divergir.
- **Determinisme:** mateix estat → mateix fitxer, byte a byte. Les adreces desades no es poden trencar: els exercicis
  de cada combinació els vigila `tests/empremtes.json`. Un canvi que els alteri necessita una versió nova del
  generador a l'adreça (vegeu §6.3); no n'hi ha prou de refer les empremtes.
- `exN.tex` i `exN-sol.tex` només depenen de LaTeX estàndard + `amsmath`.
- `tex/*.tex` és la font única de l'entorn; `assets/entorn.js` és generat (`python3 eines/entorn.py`).
- Cap canvi es dona per bo sense `node tests/prova.js` amb 0 errors (i, si toca la interfície o el TeX,
  `node tests/navegador.js` i `node tests/compila.js`). A GitHub, les tres passen soles a cada push.
- Lliurament per ZIP sense carpeta contenidora, a `_uploads/`. **Mai** `[skip ci]`, `[ci skip]` ni `[cf-pages-skip]` als commits.

## 5. Decisions ja preses (no canviar sense preguntar)

- El PDF de la web és el d'impressió del navegador, **no** un PDF compilat amb LaTeX.
- Carpeta d'extracció: `_uploads` (amb «s»), com el workflow d'`exam2bat`.

---

## 6. Revisió de la v0.2 (octubre de 2026)

Revisió completa del codi de la v0.1. Els **exercicis no han canviat**: els 10.356 d'un corpus de referència
(totes les combinacions, diverses llavors i ↻) tenen el mateix arbre, el mateix valor i les mateixes opcions abans
i després, i les empremtes calculades amb el codi de la v0.1 coincideixen amb `tests/empremtes.json`. El que ha
canviat és com s'escriuen els parèntesis al TeX i a l'HTML.

### 6.1 Errors corregits

- **TeX: un oposat sortia com una resta.** `\left(\vphantom{\big|}-7:…` es componia «( − 7 : …»: el `\vphantom`
  és un àtom ordinari i el `−` que el segueix passava a ser binari. Passava a tots els grups que tenien
  parèntesis a dins i començaven per un negatiu (també amb fraccions).
- **TeX: espais de més.** `\left(…\right)` és un àtom «interior»: TeX hi deixava un espai fi després d'un `−`
  («− (4+6)») i entre dos parèntesis seguits («( (6+3)»).
- **Parèntesis de notació que no creixien.** `(−(2+3))`: el de fora (notació) era de mida normal i el de dins
  (agrupació) més gran, al revés de la regla. Ara tots dos segueixen la mateixa regla de mida (TeX i HTML).
- **La impressió mostrava les etiquetes del mode gradual** («sense extres», «÷ · ( ) · xⁿ · −a») al full de l'alumne.
- **Un enllaç desat obert a la mateixa pestanya no es carregava** (el navegador no recarrega la pàgina si només
  canvia el `#`), i el clic següent sobreescrivia l'enllaç amb el full d'abans.
- **Adreces mal formades:** `#esp=constructor` escrivia `\vspace{function Object() { [native code] }}` al `.tex`.
- **Mòbil:** una fórmula llarga eixamplava tota la pàgina (que es desplaçava de costat), les fórmules es partien
  en dues línies (amb un `−` sol al final) i la barra de baix tapava el final de la pàgina.
- **Impressió:** les fórmules més amples (símbols «gran», ℚ) es partien en dues línies (amb l'exponent sol a la
  línia de sota); ara s'encongeixen una mica, només elles. El número de l'exercici queda alineat amb la fórmula i
  l'exponent d'un parèntesi alt va a dalt del parèntesi.
- **Proves:** la de l'oposat no provava res (`e.tex.includes('-')` sempre és cert: la resta és obligatòria); no es
  comprovaven la − binària ni «força que apareguin»; no es provaven les combinacions sense «força» ni graduals.

També: `motor.js`, `app.js` i `style.css` reescrits llegibles (noms en català, comentaris), sense canviar cap crida a
l'atzar; l'avaluador ja no s'empassa errors de programació (només descarta els arbres que ha de descartar); el `.tex`
porta l'adreça que el refà; workflows de GitHub; proves de compilació i de navegador.

### 6.2 Preguntes per al professor (canviarien els exercicis)

Dades de 16.400 exercicis (totes les combinacions; «força» marcada):

1. **Quants nivells de parèntesis?** Amb «parèntesis», el 18,6 % dels exercicis en tenen 3 nivells o més (comptant
   els de notació, com `(−3)`), el 4 % en tenen 4 o més i n'hi ha fins a 6. Per a 1r d'ESO, limitar-ho a 2 (o 3)?
2. **Operacions trivials?** El 12,6 % dels exercicis amb parèntesis (i el 4,2 % dels que no en tenen) porten alguna
   operació sense gaire sentit: una suma o resta que dona 0 (`7+(−7)`, `5−5`: 6,2 %), sumar o restar 0 (4,7 %), una potència
   de 0 o de ±1 (`(3−2)^3`: 4,5 %), multiplicar o dividir per −1 (3,7 %), dividir 0 (1,7 %) o l'oposat de 0 (`−(3−3)`:
   0,6 %). Ja s'eviten multiplicar per 0 o per 1 i dividir per 1. Evitar-ne alguna més?

### 6.3 Com canviar el generador sense trencar els enllaços desats

Les adreces d'ara no porten cap versió del generador. Quan calgui canviar-lo (p. ex. per les preguntes de 6.2):

1. afegir un paràmetre `g` a l'adreça; si no hi és, val 1 (totes les adreces d'ara);
2. el codi nou només s'aplica amb `g ≥ 2`, i els fulls nous es desen amb `g=2`;
3. `tests/empremtes.json` continua vigilant `g=1` sense tocar-lo, i s'hi afegeixen les empremtes de `g=2`.
