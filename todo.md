# todo.md — estat i feina pendent

Projecte: generador d'operacions combinades de 1r d'ESO (web estàtica vanilla). Especificació original:
`instruccions-operacions-combinades-1eso.md`. Aquest fitxer és el punt de partida per a qui continuï la feina
(persona o IA): **llegeix-lo sencer abans de tocar res**, i respecta les regles de la secció 4.

---

## 1. Estat actual

**Proves:** `node tests/prova.js` → 82 combinacions, 8.200 exercicis, 0 errors (amb re-lectura independent del TeX).
**LaTeX:** compilat de debò amb el `main.tex` i el `capsalera.tex` del professor: sense errors.
**Interfície:** no s'ha provat sistemàticament en navegadors (només l'ha mirat el professor).

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
- Parèntesis d'agrupació sempre `\left(…\right)`, i cada nivell niuat més gran que el de dins (`\vphantom`).
- Previsualització HTML sense llibreries, amb xifres alineades (`lining-nums`) i potències que no desquadren la línia.

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
\item $\displaystyle 3\cdot\left(5-2\right)+4^{2}:8$
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

---

## 3. Altres tasques pendents (per ordre d'importància)

1. **Provar la interfície** a Chrome, Firefox i mòbil.
2. Proves: comprovar també la presència de la `−` binària i els testimonis de «força».
3. **Combinacions impossibles** (`Motor.valida`): ara n'hi ha 3 (oposat amb ℕ; oposat sense «intermedis»;
   ℚ només «final» sense divisions i parèntesis). Revisar si en falta cap.
4. **Oposat damunt de potència:** `neg(pow)` està exclòs (evita `−2^2`, ambigu). Decidir si es vol `−(2^3)`.
5. **Longitud** de cada operació: ara fixa (3–5 operadors binaris, +1 amb divisions). Control opcional.
6. Espai entre símbols: ara només als operadors; decidir si també als parèntesis.
7. Infraestructura (no pot arribar per ZIP): workflow `unzip-upload.yml` creat des de la web de GitHub, i
   Cloudflare Pages connectat com a `exam2bat`.
8. Ampliacions: «Tot en un» (preàmbul incrustat), «Obre a Overleaf», versió de 2n d'ESO.

---

## 4. Regles que no es poden trencar

- **Web estàtica vanilla:** cap llibreria, cap pas de build, scripts clàssics (no mòduls), funciona amb doble clic.
- **`motor.js` és pur** (sense DOM) i s'exporta a Node. Tota la lògica nova (passos inclosos) hi va i es prova amb Node.
- **Un sol recorregut, dos emissors** (TeX i HTML): la previsualització i el `.tex` no poden divergir.
- **Determinisme:** mateix estat → mateix fitxer, byte a byte. Les adreces desades no es poden trencar.
- `exN.tex` i `exN-sol.tex` només depenen de LaTeX estàndard + `amsmath`.
- `tex/*.tex` és la font única de l'entorn; `assets/entorn.js` és generat (`python3 eines/entorn.py`).
- Cap canvi es dona per bo sense `node tests/prova.js` amb 0 errors.
- Lliurament per ZIP sense carpeta contenidora, a `_uploads/`. **Mai** `[skip ci]`, `[ci skip]` ni `[cf-pages-skip]` als commits.

## 5. Decisions ja preses (no canviar sense preguntar)

- El PDF de la web és el d'impressió del navegador, **no** un PDF compilat amb LaTeX.
- Carpeta d'extracció: `_uploads` (amb «s»), com el workflow d'`exam2bat`.
