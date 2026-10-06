/* ===========================================================================
   igualtats.js — L'activitat «Completa la igualtat»: uns nombres en ordre i
   un resultat, 1 2 5 = 15, i l'alumnat hi posa els símbols que falten:
   (1 + 2) · 5 = 15.

   No toca el DOM (com motor.js): el carrega el navegador i també Node, i la
   lògica es prova amb `node tests/prova.js`.

   Les regles (decisions del professor, todo.md §5):
     - els nombres, de 0 a 9, en l'ordre donat, tots i una sola vegada, sense
       ajuntar xifres (1 i 2 no fan 12) i sense cap − davant del primer;
     - + − · i, si es trien, : (divisions exactes), parèntesis, ² i √: ² i √
       només damunt d'un nombre, i √ només d'un quadrat perfecte (√9 = 3);
     - cap valor, ni pel camí, és negatiu ni passa de 100.

   El CERCADOR prova totes les maneres de posar-hi els símbols. Així se sap
   què necessita cada igualtat (només + − · :, parèntesis, o ² o √) i quina
   és la solució més senzilla, la que es dona al solucionari (qualsevol altra
   de correcta també val).

   DETERMINISME: com a motor.js, el mateix estat (opcions + llavor + ↻) dona
   sempre el mateix full, i tests/empremtes.json ho vigila (ig=…).
   =========================================================================== */
var Igualtats = (function () {
  'use strict';

  const atzar = (typeof Motor !== 'undefined' ? Motor : require('./motor.js')).atzar;

  /* La versió del generador va a l'adreça (ig=…), com g a l'altra activitat:
     un full desat es refà sempre amb el generador amb què es va fer. */
  const GENERADOR = 1;

  const CFG = {
    XIFRES: [0, 9],   // els nombres de les igualtats
    MAX: 100,         // cap valor, ni pel camí, no passa de 100
    INTENTS: 500      // intents per igualtat abans de rendir-se
  };

  /* L'espai per escriure-hi els símbols, en mm: entre dos nombres (i davant
     del primer i del «=», on poden anar un «(» o un «√», un «)» o un «²»), i
     entre dues files del full. */
  const ESPAIS = {
    petit: { buit: 7, fila: 7 },
    mitja: { buit: 10, fila: 11 },
    gran: { buit: 13, fila: 15 }
  };

  const PREC = { '+': 1, '-': 1, '*': 2, ':': 2 };
  const OPS = ['+', '-', '*', ':'];   // en aquest ordre: a igual cost, la solució «més natural»

  /* ------------------------------------------------------------ el cercador
     Un arbre és {t: 'num', v, u} (u: '²', '√' o res) o {t: 'bin', op, l, r}.
     S'escriu amb la prioritat de sempre i els parèntesis que calen: un fill que
     opera amb menys prioritat, o amb la mateixa i és a la dreta, a − (b + c),
     a : (b · c), a + (b + c). Així el text es calcula igual que l'arbre. */
  const cal = (fill, op, costat) => fill.t === 'bin' &&
    (PREC[fill.op] < PREC[op] || (PREC[fill.op] === PREC[op] && costat === 'r'));

  /** El valor de a op b, o null si no és natural, no és exacte o passa de MAX. */
  function opera(op, a, b) {
    let v;
    if (op === '+') v = a + b;
    else if (op === '-') v = a - b;
    else if (op === '*') v = a * b;
    else if (b && a % b === 0) v = a / b;
    else return null;
    return v >= 0 && v <= CFG.MAX ? v : null;
  }

  const arrel = v => { const r = Math.round(Math.sqrt(v)); return r * r === v ? r : null; };

  /** Totes les expressions dels nombres ns, en ordre, amb els símbols de p ({par, pot, arr, div}):
      [{v, a, par, pot}]. par: parèntesis que cal escriure; pot: quants ² i √. */
  function expressions(ns, p) {
    const memo = new Map();
    const fulla = x => {
      const r = [{ v: x, a: { t: 'num', v: x }, par: 0, pot: 0 }];
      // ² i √ que no canvien res (0², 1², √0, √1) no compten
      if (p.pot && x >= 2 && x * x <= CFG.MAX) r.push({ v: x * x, a: { t: 'num', v: x, u: '²' }, par: 0, pot: 1 });
      if (p.arr && x >= 4 && arrel(x) !== null) r.push({ v: arrel(x), a: { t: 'num', v: x, u: '√' }, par: 0, pot: 1 });
      return r;
    };
    const tram = (i, j) => {                    // les expressions de ns[i] … ns[j − 1]
      const k = `${i}-${j}`;
      if (memo.has(k)) return memo.get(k);
      let out = [];
      if (j - i === 1) out = fulla(ns[i]);
      else {
        for (let m = i + 1; m < j; m++) {
          const esq = tram(i, m), dre = tram(m, j);
          for (const op of OPS) {
            if (op === ':' && !p.div) continue;
            for (const a of esq) for (const b of dre) {
              const pa = cal(a.a, op, 'l') ? 1 : 0, pb = cal(b.a, op, 'r') ? 1 : 0;
              if ((pa || pb) && !p.par) continue;
              const v = opera(op, a.v, b.v);
              if (v !== null) out.push({ v, a: { t: 'bin', op, l: a.a, r: b.a }, par: a.par + b.par + pa + pb, pot: a.pot + b.pot });
            }
          }
        }
      }
      memo.set(k, out);
      return out;
    };
    return tram(0, ns.length);
  }

  /** Què necessita una solució: 0, només + − · :; 1, parèntesis; 2, ² o √. */
  const nivellDe = e => (e.pot ? 2 : e.par ? 1 : 0);

  /** Els resultats possibles de ns: Map valor → {v, millor, nivell, n}. millor: la solució més
      senzilla (la de menys nivell i, després, la de menys parèntesis, ² i √); nivell: el que
      necessita la igualtat; n: quantes solucions té (cada una s'escriu diferent). */
  function resol(ns, p) {
    const valors = new Map();
    for (const e of expressions(ns, p)) {
      const nivell = nivellDe(e), cost = e.par + e.pot, x = valors.get(e.v);
      if (!x) valors.set(e.v, { v: e.v, millor: e, nivell, cost, n: 1 });
      else {
        x.n++;
        if (nivell < x.nivell || (nivell === x.nivell && cost < x.cost)) Object.assign(x, { millor: e, nivell, cost });
      }
    }
    return valors;
  }

  /* ------------------------------------------------------------- emissors */
  const SIGNE = { '+': '+', '-': '−', '*': '·', ':': ':' };
  const TEXT = {
    nombre: v => String(v), quadrat: s => s + '²', arrel: s => '√' + s, parentesi: s => `(${s})`,
    operador: op => ` ${SIGNE[op]} `
  };
  const TEX = {
    nombre: v => String(v), quadrat: s => `${s}^{2}`, arrel: s => `\\sqrt{${s}}`, parentesi: s => `(${s})`,
    operador: op => ({ '+': '+', '-': '-', '*': '\\cdot ', ':': ':' })[op]
  };
  const HTML = {
    nombre: v => String(v), quadrat: s => `${s}<sup>2</sup>`, arrel: s => `<span class="arrel">√<span>${s}</span></span>`,
    parentesi: s => `(${s})`, operador: op => `<span class="op">${SIGNE[op]}</span>`
  };

  function escriu(a, E) {
    if (a.t === 'num') return a.u === '²' ? E.quadrat(E.nombre(a.v)) : a.u === '√' ? E.arrel(E.nombre(a.v)) : E.nombre(a.v);
    const costat = (f, c) => { const s = escriu(f, E); return cal(f, a.op, c) ? E.parentesi(s) : s; };
    return costat(a.l, 'l') + E.operador(a.op) + costat(a.r, 'r');
  }

  /* ------------------------------------------------------------ el full */

  /** Les opcions, sempre completes: n (3–15), nombres (3 o 4), par, pot, arr, div, esp. */
  function opcions(q) {
    q = q || {};
    const enter = (v, a, b, d) => { v = parseInt(v, 10); return v >= a && v <= b ? v : d; };
    const casella = (v, d) => (v === undefined ? d : +v ? 1 : 0);
    return {
      n: enter(q.n, 3, 15, 9), nombres: enter(q.nombres, 3, 4, 3),
      par: casella(q.par, 1), pot: casella(q.pot, 1), arr: casella(q.arr, 1), div: casella(q.div, 1),
      esp: Object.prototype.hasOwnProperty.call(ESPAIS, q.esp) ? q.esp : 'mitja'
    };
  }

  /** El nivell de cada igualtat del full, barrejats. Com el full del professor:
      de cada 9, 3 amb parèntesis i 1 amb ² o √; les altres, només amb + − · :.
      Si no hi ha parèntesis, o ni ² ni √, aquesta part passa a les altres. Només
      depèn de la llavor i de les opcions: ↻ canvia la igualtat, no el nivell. */
  function pla(p, mestra) {
    const n2 = p.pot || p.arr ? Math.max(1, Math.round(p.n / 9)) : 0;
    const n1 = p.par ? Math.round(p.n / 3) : 0;
    const nivells = [];
    for (let i = 0; i < p.n; i++) nivells.push(i < n2 ? 2 : i < n2 + n1 ? 1 : 0);
    return atzar(`${mestra}:pla`).barreja(nivells);
  }

  const clau = (ns, t) => `${ns.join(' ')}=${t}`;

  /** Una igualtat del nivell demanat, que no sigui cap de les anteriors. */
  function busca(p, rg, nivell, anteriors) {
    for (let k = 0; k < CFG.INTENTS; k++) {
      const ns = [];
      for (let j = 0; j < p.nombres; j++) ns.push(rg.entre(...CFG.XIFRES));
      const cands = [...resol(ns, p).values()].filter(x => x.nivell === nivell && !anteriors.has(clau(ns, x.v)));
      if (!cands.length) continue;
      const x = rg.tria(cands);
      return {
        ns, t: x.v, nivell, n: x.n, arbre: x.millor.a,
        solucio: { text: escriu(x.millor.a, TEXT), tex: escriu(x.millor.a, TEX), html: escriu(x.millor.a, HTML) }
      };
    }
    return { error: "No he pogut fer aquesta igualtat amb aquestes opcions.", nivell };
  }

  /** La igualtat i del full de llavor `mestra`, després de r ↻. */
  function igualtat(p, mestra, i, r, anteriors) {
    return busca(p, atzar(`${mestra}:${i}:${r}`), pla(p, mestra)[i], anteriors || new Set());
  }

  /** L'exemple resolt de l'enunciat: amb parèntesis, com el del professor (si n'hi ha). */
  function exemple(p, mestra) {
    return busca(p, atzar(`${mestra}:exemple`), p.par ? 1 : p.pot || p.arr ? 2 : 0, new Set());
  }

  /** El full: {exemple, items}. R: quants ↻ s'han fet a cada igualtat. */
  function full(q, mestra, R) {
    const p = opcions(q), ex = exemple(p, mestra), anteriors = new Set();
    if (!ex.error) anteriors.add(clau(ex.ns, ex.t));
    const items = [];
    for (let i = 0; i < p.n; i++) {
      const x = igualtat(p, mestra, i, (R && R[i]) || 0, anteriors);
      if (!x.error) anteriors.add(clau(x.ns, x.t));
      items.push(x);
    }
    return { p, exemple: ex, items };
  }

  /* -------------------------------------------------------------- el .tex
     Com els exN.tex de l'altra activitat: només el cos (el main.tex del
     professor fa \input{exN.tex}). LaTeX estàndard; l'exemple, ombrejat amb
     \colorbox (xcolor, que carrega headers.tex). */

  /** Els símbols que es poden fer servir, en l'ordre de l'enunciat del professor. */
  const simbols = p => [p.par && '(', p.par && ')', '+', '-', '*', p.div && ':', p.pot && '²', p.arr && '√'].filter(Boolean);
  const SIMBOL_TEX = { '(': '(', ')': ')', '+': '+', '-': '-', '*': '\\cdot', ':': ':', '²': '{}^{2}', '√': '\\sqrt{\\ }' };
  const SIMBOL_HTML = { '(': '(', ')': ')', '+': '+', '-': '−', '*': '·', ':': ':', '²': '<sup>2</sup>', '√': '<span class="arrel">√<span>&nbsp;</span></span>' };

  /** Les igualtats van en 2 columnes (en 3, el full quedava massa atapeït), separades per una línia
      vertical discontínua. També les solucions, cadascuna al mateix lloc que la seva igualtat. */
  const COLUMNES = 2;

  /** Una igualtat per completar: els nombres amb un buit entre cada dos (i davant del primer i del «=»). */
  const perCompletarTex = (x, p) => {
    const b = ESPAIS[p.esp].buit;
    return `$\\hspace{${(.6 * b).toFixed(1)}mm}${x.ns.join(`\\hspace{${b}mm}`)}\\hspace{${b}mm}=\\ ${x.t}$`;
  };

  function capcalera(nom, p, m, sol) {
    const desc = `% llavor=${m.seed} · igualtats=${p.n} · nombres=${p.nombres} · símbols=${simbols(p).map(s => SIGNE[s] || s).join(' ')} · espai=${p.esp}`;
    return `% ${nom} — ${sol ? `solucionari de ex${m.num}.tex — ` : ''}«Completa la igualtat», generat per «Operacions combinades 1r ESO» ${m.versio}\n`
      + desc + '\n' + (m.adreca ? `% per refer aquest full: index.html${m.adreca}\n` : '');
  }

  /** Una graella de 2 columnes amb les cel·les (text TeX), una fila darrere l'altra (fila: l'espai de sota
      cada fila, en mm), i entre les dues columnes una línia vertical discontínua. Sense cap paquet de més:
      a cada fila, la línia és un tros de l'alçada de la fila (el puntal de la taula, que defs.tex pot
      allargar amb \arraystretch, més l'espai de sota), i els trossos de totes les files fan una sola línia.
      Si en surt un nombre senar, l'última fila porta la segona cel·la buida: també hi passa la línia. */
  function graella(cels, fila) {
    const files = [];
    for (let i = 0; i < cels.length; i += COLUMNES) files.push(`${cels[i]} & ${cels[i + 1] || ''}`);
    const puntal = '\\csname @arstrutbox\\endcsname';
    const ratlla = `\\lower\\dimexpr\\dp${puntal}+${fila}mm\\relax`
      + `\\vbox to\\dimexpr\\ht${puntal}+\\dp${puntal}+${fila}mm\\relax`
      + '{\\xleaders\\vbox to 6pt{\\hrule width .4pt height 3pt\\vfil}\\vfill}';
    const ample = '\\dimexpr(\\linewidth-6mm-.4pt)/2\\relax';
    return `\\noindent\\begin{tabular}{@{}p{${ample}}@{\\hspace{3mm}${ratlla}\\hspace{3mm}}p{${ample}}@{}}\n`
      + files.join(` \\\\[${fila}mm]\n`) + '\n\\end{tabular}\n';
  }

  /** exN.tex: l'enunciat, l'exemple resolt i les igualtats per completar. m = {num, seed, adreca, versio}. */
  function fitxerTex(f, m) {
    const p = f.p, ex = f.exemple;
    let s = capcalera(`ex${m.num}.tex`, p, m, false)
      + `\\noindent Completa escrivint ${simbols(p).map(x => `$${SIMBOL_TEX[x]}$`).join(', ')} per aconseguir que les igualtats siguin certes.\\par\\medskip\n`;
    if (!ex.error) {
      s += `\\noindent\\textit{Exemple:}\\quad\\colorbox{gray!25}{$${ex.ns.join('\\hspace{4mm}')}\\hspace{4mm}=\\ ${ex.t}$}`
        + `\\quad$\\rightarrow$\\quad$${ex.solucio.tex}=${ex.t}$\\par\\bigskip\n`;
    }
    return s + graella(f.items.map(x => (x.error ? '' : perCompletarTex(x, p))), ESPAIS[p.esp].fila);
  }

  /** exN-sol.tex: cada igualtat, amb la solució més senzilla. */
  function fitxerSolucionari(f, m) {
    const p = f.p;
    return capcalera(`ex${m.num}-sol.tex`, p, m, true)
      + '\\noindent\\textbf{Solucions}\\par\\medskip\n'
      + graella(f.items.map(x => (x.error ? '' : `$${x.solucio.tex}=${x.t}$`)), 4);
  }

  /* ---------------------------------------------------------------- la web */

  /** L'enunciat, en HTML. */
  const enunciatHtml = p => `Completa escrivint ${simbols(p).map(x => `<span class="simb">${SIMBOL_HTML[x]}</span>`).join(', ')} per aconseguir que les igualtats siguin certes.`;

  /** Una igualtat per completar, en HTML: els buits són caixes de l'amplada de l'espai triat. */
  const perCompletarHtml = x => `<span class="buit"></span>${x.ns.join('<span class="buit"></span>')}<span class="buit"></span>= ${x.t}`;

  /** La solució, en HTML. */
  const solucioHtml = x => `${x.solucio.html} = ${x.t}`;

  const M = {
    GENERADOR, CFG, ESPAIS, COLUMNES, opcions, resol, pla, igualtat, exemple, full, simbols,
    escriuText: a => escriu(a, TEXT), fitxerTex, fitxerSolucionari, enunciatHtml, perCompletarHtml, solucioHtml
  };
  if (typeof module !== 'undefined') module.exports = M;
  return M;
})();
