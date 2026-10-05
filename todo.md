# todo.md — què falta (v0.1 mínima)

Implementació mínima de `instruccions-operacions-combinades-1eso.md`. **Estat:** el generador (`motor.js`)
s'ha provat amb `node tests/prova.js` (82 combinacions, 8.200 exercicis, 0 errors, amb re-lectura independent del TeX).
**La interfície (`index.html`, `app.js`, `style.css`) NO s'ha provat en un navegador**: obre-la i prova-la abans de donar-la per bona.

## Fet
- Controls: 1–10 operacions, 5 espais, ℕ/ℤ/ℚ amb «intermedis/final», divisions, oposat, potències, parèntesis, «força».
- Generació determinista amb llavors; ↻ per exercici; «Genera-ho tot»; estat a l'adreça (`#…`) + `localStorage`.
- Sortida `exN.tex` (només cos, `amsmath`), «Copia el TeX», codi TeX visible, PDF d'impressió del navegador.
- Clar/fosc, mòbil, `@media print` amb l'espai de cada exercici.

## Pendent (per ordre d'importància)
1. **Provar a mà a Chrome/Firefox/mòbil** i compilar 3–4 `exN.tex` amb el teu `main.tex` (que surtin igual que a la previsualització).
2. ~~`tests/prova.js`~~ **fet** (re-lectura independent, conjunts, presència, determinisme, repetits, format). Ja comprova també cada valor intermedi. Falta: la presència de la `−` binària i els testimonis de «força».
3. **Combinacions impossibles** (`Motor.valida`): ara hi ha 3 regles (oposat amb ℕ; oposat sense «intermedis»; ℚ només «final» sense divisions+parèntesis). Revisa si te'n falta cap i si els missatges et semblen clars.
4. **Oposat damunt de potència**: `neg(pow)` està exclòs (evita `−2^2` ambigu). Sí que surt `(−2)^3`. Decideix si vols `−(2^3)`.
5. **Longitud** de cada operació: ara fixa (3–5 operadors binaris, +1 amb divisions). Control opcional.
6. ~~Espai `\vspace*`~~ **fet** (casella «conserva l'espai a dalt de pàgina»).
7. ~~Parèntesis allargats a la previsualització~~ **fet** (aproximació amb CSS: revisa'n l'aspecte al navegador).
8. ~~`README.md` i `.gitignore`~~ **fet**.
9. **Workflow `unzip-upload.yml`**: NO és al ZIP (no pot arribar per ZIP). Crea'l des de la web de GitHub amb el text de §10.1 de l'especificació.
10. **Cloudflare Pages**: connecta el repositori igual que `exam2bat` (sense comanda de build). Cap commit amb `[skip ci]`.
11. Ampliacions (§11): solucions, pas a pas, «Tot en un», Overleaf, motor TeX en WebAssembly, versió de 2n d'ESO.

## Fet en aquesta versió
- `tex/main.tex`, `tex/headers.tex`, `tex/defs.tex` (inspirats en `exam2bat`), apartat **Entorn** per baixar-los, i prova de paritat amb `assets/entorn.js`.
- Compilat de debò un full de 10 exercicis amb totes les opcions (ℚ, divisions, oposats, potències, parèntesis, `\vspace*`): sense errors ni avisos.

- Progressió **immediata / gradual** dels extres: amb «gradual», l'exercici *i* inclou cada extre amb probabilitat ((i+1)/(N−1))²; els 2 últims, tots. ↻ no canvia el nivell de l'exercici. Cada targeta mostra quins extres té.

- Espai entre operacions: només petit / mitjà / gran. Nou: **espai entre símbols** petit / mitjà / gran (`\medmuskip` i `\thickmuskip` dins l'`enumerate`; a la web, marge CSS de cada operador). Ara només s'espaien els operadors (+ − · :), no els parèntesis.

- Parèntesis niuats: tots els d'agrupació són `\left(…\right)` i cada nivell és més gran que el de dins (un `\vphantom` invisible; amb fraccions, una alçada calculada). La previsualització fa el mateix amb CSS.

## Decisions que cal confirmar
- El PDF de la web és el d'impressió del navegador, **no** un PDF compilat amb LaTeX (§7).
- Carpeta d'extracció: `_uploads` (amb «s») segons el workflow d'`exam2bat`.
