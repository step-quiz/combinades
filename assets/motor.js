/* ===========================================================================
   motor.js — Model, generador i renderitzadors de les operacions combinades.

   No toca el DOM: el carrega el navegador (amb <script>) i també Node (amb
   require). Per això tota la lògica es prova amb `node tests/prova.js`.

   Un exercici és un ARBRE. Cada node és un d'aquests:
     {t:'num', v}          un natural de l'enunciat (2…9)
     {t:'frac', p, q}      la fracció p/q (pròpia i irreductible)
     {t:'neg', a}          l'oposat de a
     {t:'pow', a, k}       a elevat a k
     {t:'bin', op, l, r}   l op r, amb op = '+', '-', '*' o ':'

   DETERMINISME. El mateix estat (opcions + llavor + ↻) dona sempre el mateix
   exercici: és el que permet desar un full a l'adreça (#…) i refer-lo mesos
   després. Per això l'atzar té llavor i, sobretot, l'ORDRE de les crides a
   l'atzar i els criteris d'acceptació no es poden tocar: una crida de més o
   de menys canvia tots els fulls desats. tests/empremtes.json ho vigila.
   =========================================================================== */
var Motor = (function () {
  'use strict';

  const VERSIO = 'v0.2';

  const CFG = {
    OPERAND: [2, 9],    // els naturals de l'enunciat
    EXP: [2, 3],        // els exponents
    FRAC_DEN: [2, 6],   // els denominadors de les fraccions (ℚ)
    MAX: 200,           // cap valor, ni intermedi, té numerador o denominador més gran (en valor absolut)
    INTENTS: 2000       // intents per exercici abans de rendir-se
  };

  /* Espai entre operacions: el \vspace del .tex i el marge de la impressió. */
  const ESPAIS = { petit: '1.5cm', mitja: '3cm', gran: '5cm' };

  /* Espai entre els símbols d'una operació. Al TeX, \medmuskip (+ − ·) i
     \thickmuskip (:, que TeX tracta com una relació); «petit» són els valors
     per defecte de TeX. css = marge a cada costat de l'operador a la
     previsualització. */
  const SIMBOLS = {
    petit: { med: '4mu', thick: '5mu', css: '.22em' },
    mitja: { med: '8mu', thick: '8mu', css: '.45em' },
    gran: { med: '13mu', thick: '13mu', css: '.75em' }
  };

  const PREC = { '+': 1, '-': 1, '*': 2, ':': 2 };

  /* ------------------------------------------------------ atzar amb llavor
     Un hash de 32 bits del text de la llavor i mulberry32. No és
     criptografia, és repetibilitat. NO es pot tocar: canviaria tots els fulls. */
  function hash32(text) {
    let h = 1779033703 ^ text.length;
    for (let i = 0; i < text.length; i++) {
      h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
      h = h << 13 | h >>> 19;
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /** L'atzar d'una llavor (text). */
  function atzar(llavor) {
    const seguent = mulberry32(hash32(llavor));   // un real de [0, 1)
    return {
      seguent,
      /** Un enter de [a, b], tots dos inclosos. */
      entre: (a, b) => a + Math.floor(seguent() * (b - a + 1)),
      /** Un element qualsevol de la llista. */
      tria: llista => llista[Math.floor(seguent() * llista.length)],
      /** Fisher–Yates sobre la mateixa llista, que també retorna. */
      barreja(llista) {
        for (let i = llista.length - 1; i > 0; i--) {
          const j = Math.floor(seguent() * (i + 1));
          [llista[i], llista[j]] = [llista[j], llista[i]];
        }
        return llista;
      }
    };
  }

  /* ----------------------------------------------------- racionals exactes
     Cada valor és una fracció {n, d} irreductible, amb d > 0: res de
     decimals, res d'arrodoniments. */
  const mcd = (a, b) => b ? mcd(b, a % b) : Math.abs(a);

  function racional(n, d) {
    if (d < 0) { n = -n; d = -d; }
    const k = mcd(n, d) || 1;
    return { n: n / k, d: d / k };
  }

  /** 0 o 1: multiplicar-hi o dividir-hi no és cap exercici. */
  const trivial = v => v.d === 1 && (v.n === 0 || v.n === 1);

  /* Un arbre amb una operació trivial o amb un valor massa gran es descarta
     llançant aquest objecte. Qualsevol altra excepció és un error de
     programació, i no s'ha d'amagar. */
  const DESCARTAT = { descartat: true };

  /** El valor exacte de l'arbre. Deixa a `valors` el de cada node en
      postordre (els fills abans que el pare): l'últim és el de l'arrel. */
  function avalua(node, valors) {
    let v;
    switch (node.t) {
      case 'num': v = racional(node.v, 1); break;
      case 'frac': v = racional(node.p, node.q); break;
      case 'neg': { const a = avalua(node.a, valors); v = racional(-a.n, a.d); break; }
      case 'pow': { const a = avalua(node.a, valors); v = racional(a.n ** node.k, a.d ** node.k); break; }
      case 'bin': {
        const a = avalua(node.l, valors), b = avalua(node.r, valors);
        if (node.op === '+') v = racional(a.n * b.d + b.n * a.d, a.d * b.d);
        else if (node.op === '-') v = racional(a.n * b.d - b.n * a.d, a.d * b.d);
        else if (node.op === '*') {
          if (trivial(a) || trivial(b)) throw DESCARTAT;
          v = racional(a.n * b.n, a.d * b.d);
        } else {
          if (trivial(b)) throw DESCARTAT;
          v = racional(a.n * b.d, a.d * b.n);
        }
      }
    }
    if (Math.abs(v.n) > CFG.MAX || v.d > CFG.MAX) throw DESCARTAT;
    valors.push(v);
    return v;
  }

  /* ------------------------------------------------------------ parèntesis
     N'hi ha de dues menes, i les dues segueixen la mateixa regla de mida:
       - d'AGRUPACIÓ, els que demana l'arbre: 3·(5−2), (2+3)², −(4+6);
       - de NOTACIÓ, els d'un negatiu que no és el primer símbol: 5·(−3).
     Cada parèntesi és més gran que tots els que té a dins: amb 0 nivells a
     dins, la mida normal; amb 1, \bigl( ; amb 2, \Bigl( ; … fins a \Biggl(.

     Són delimitadors de mida fixa i no \left…\right perquè així TeX hi posa
     els mateixos espais que a uns parèntesis normals. Amb \left (fins a la
     v0.1), −(…) sortia amb un espai de més i un − just després del
     \vphantom que feia créixer el parèntesi es llegia com una resta: «( − 7».

     Amb fraccions la mida no es pot fixar: \left…\right s'adapta sol i, si a
     dins hi ha parèntesis, una alçada invisible (simètrica respecte de l'eix,
     de semialçada 1,25 + 0,4·h em) el fa créixer un nivell més. L'alçada va
     dins de \mathopen perquè TeX la tracti com un parèntesi obert i no com un
     nombre: si no, el − que la segueix tornaria a sortir com una resta.

     La profunditat es compta sobre el text ja escrit: tant al TeX (\bigl(,
     \left() com a l'HTML, cada parèntesi porta un ( o un ) literal. */
  function profunditat(s) {
    let d = 0, max = 0;
    for (const c of s) {
      if (c === '(') max = Math.max(max, ++d);
      else if (c === ')') d--;
    }
    return max;
  }

  const OBRE_TEX = ['(', '\\bigl(', '\\Bigl(', '\\biggl(', '\\Biggl('];
  const TANCA_TEX = [')', '\\bigr)', '\\Bigr)', '\\biggr)', '\\Biggr)'];

  function parentesiTex(s) {
    const h = profunditat(s);
    if (!s.includes('\\frac')) {
      const nivell = Math.min(4, h);
      return OBRE_TEX[nivell] + s + TANCA_TEX[nivell];
    }
    let alcada = '';
    if (h) {
      const r = 1.25 + .4 * h;
      alcada = `\\mathopen{\\vphantom{\\rule[-${(r - .25).toFixed(2)}em]{0pt}{${(2 * r).toFixed(2)}em}}}`;
    }
    return `\\left(${alcada}${s}\\right)`;
  }

  /* A la previsualització, el mateix criteri: cada nivell, un 22 % més gran;
     amb fraccions, de partida gairebé el doble. */
  function parentesiHtml(s) {
    const h = profunditat(s), fraccio = s.includes('class="fr"');
    if (!h && !fraccio) return `(${s})`;
    const mida = (fraccio ? 1.9 : 1) * (1 + .22 * h);
    const obre = `<span class="pb" style="font-size:${mida.toFixed(2)}em">`;
    return `<span class="pg">${obre}(</span>${s}${obre})</span></span>`;
  }

  /* L'exponent d'un parèntesi allargat s'enlaira segons la mida del parèntesi
     (si no, darrere d'un parèntesi alt quedava a mitja alçada i semblava un
     subíndex). top és en em de l'exponent, que fa 0,62 em de la fórmula. */
  function potenciaHtml(base, k) {
    const m = /^<span class="pg"><span class="pb" style="font-size:([\d.]+)em">/.exec(base);
    if (!m) return `${base}<sup>${k}</sup>`;
    const puja = (.05 + .5 * parseFloat(m[1])) / .62;
    return `${base}<sup style="top:-${puja.toFixed(2)}em">${k}</sup>`;
  }

  /* ------------------------------------------------------------- emissors
     Un sol recorregut de l'arbre (escriu) i dos emissors: el del .tex i el
     de la previsualització. Així no poden dir coses diferents. */
  const TEX = {
    nombre: v => String(v),
    fraccio: (p, q) => `\\frac{${p}}{${q}}`,
    operador: op => ({ '+': '+', '-': '-', '*': '\\cdot ', ':': ':' })[op],
    parentesi: parentesiTex,
    potencia: (base, k) => `${base}^{${k}}`,
    // Davant d'un \left( cal \mathopen{}: si no, TeX hi deixa un espai fi, «− (».
    oposat: s => '-' + (s.startsWith('\\left(') ? '\\mathopen{}' : '') + s
  };

  const HTML = {
    nombre: v => String(v),
    fraccio: (p, q) => `<span class="fr"><span>${p}</span><span>${q}</span></span>`,
    operador: op => `<span class="op">${({ '+': '+', '-': '−', '*': '·', ':': ':' })[op]}</span>`,
    parentesi: parentesiHtml,
    potencia: potenciaHtml,
    oposat: s => '−' + s
  };

  /** Cal un parèntesi al voltant de `fill`, que és el costat 'l' o 'r' de
      `pare`? Sí quan opera amb menys prioritat, o amb la mateixa i és a la
      dreta: a−(b+c), a:(b·c). */
  function calParentesi(fill, pare, costat) {
    return fill.t === 'bin' &&
      (PREC[fill.op] < PREC[pare.op] || (PREC[fill.op] === PREC[pare.op] && costat === 'r'));
  }

  const nousComptadors = () => ({ grups: 0, pow: 0, neg: 0, ops: {} });

  /** Escriu l'arbre amb l'emissor E i compta a `c` el que hi surt.
      `alPrincipi`: el node és el primer símbol de l'expressió o d'un grup.
      Només allà un negatiu va sense parèntesi: −3+5, però 5·(−3). */
  function escriu(node, E, c, alPrincipi) {
    switch (node.t) {
      case 'num': return E.nombre(node.v);
      case 'frac': return E.fraccio(node.p, node.q);
      case 'neg': {
        c.neg++;
        let dins;
        if (node.a.t === 'bin') { c.grups++; dins = E.parentesi(escriu(node.a, E, c, true)); }
        else dins = escriu(node.a, E, c, false);
        const s = E.oposat(dins);
        return alPrincipi ? s : E.parentesi(s);
      }
      case 'pow': {
        c.pow++;
        const b = node.a;
        let base;
        if (b.t === 'num') base = E.nombre(b.v);
        else if (b.t === 'bin') { c.grups++; base = E.parentesi(escriu(b, E, c, true)); }
        else base = E.parentesi(escriu(b, E, c, true));       // (−3)², (2/3)²
        return E.potencia(base, node.k);
      }
      case 'bin': {
        c.ops[node.op] = (c.ops[node.op] || 0) + 1;
        const costat = (fill, quin) => {
          if (calParentesi(fill, node, quin)) { c.grups++; return E.parentesi(escriu(fill, E, c, true)); }
          return escriu(fill, E, c, quin === 'l' ? alPrincipi : false);
        };
        const l = costat(node.l, 'l');
        return l + E.operador(node.op) + costat(node.r, 'r');
      }
    }
  }

  /* -------------------------------------------------------------- l'arbre */

  /** Sense parèntesis: les operacions en fila, amb la prioritat de sempre
      (· i : abans que + i −; a igual prioritat, d'esquerra a dreta). */
  function cadena(nombres, ops) {
    const sortida = [nombres[0]], pila = [];
    const redueix = () => {
      const op = pila.pop(), r = sortida.pop(), l = sortida.pop();
      sortida.push({ t: 'bin', op, l, r });
    };
    ops.forEach((op, i) => {
      while (pila.length && PREC[pila[pila.length - 1]] >= PREC[op]) redueix();
      pila.push(op);
      sortida.push(nombres[i + 1]);
    });
    while (pila.length) redueix();
    return sortida[0];
  }

  /** Amb parèntesis: un arbre qualsevol sobre la mateixa fila de nombres i
      operacions. L'arrel és una operació a l'atzar i cada costat, un arbre
      fet igual. Els parèntesis surten sols en escriure'l. */
  function arbreAtzar(nombres, ops, rg) {
    if (!ops.length) return nombres[0];
    const k = rg.entre(0, ops.length - 1);
    return {
      t: 'bin', op: ops[k],
      l: arbreAtzar(nombres.slice(0, k + 1), ops.slice(0, k), rg),
      r: arbreAtzar(nombres.slice(k + 1), ops.slice(k + 1), rg)
    };
  }

  /** Tots els nodes, en preordre (el pare abans que els fills; l abans que r). */
  const nodes = n => [n].concat(n.t === 'bin' ? nodes(n.l).concat(nodes(n.r)) : n.a ? nodes(n.a) : []);

  /** Converteix `node`, al seu lloc, en {t: tipus, a: <el node d'abans>, ...extra}.
      «Al seu lloc»: el pare continua apuntant al mateix objecte. */
  function embolcalla(node, tipus, extra) {
    const abans = Object.assign({}, node);
    Object.keys(node).forEach(k => delete node[k]);
    node.t = tipus;
    node.a = abans;
    Object.assign(node, extra);
  }

  /** Hi posa els extres: fraccions (ℚ), potències i oposats. */
  function decora(arbre, p, rg) {
    // ℚ als intermedis: cada natural passa a ser una fracció pròpia amb
    // probabilitat 0,35. Primer se sorteja quins i després, per ordre, quina.
    if (p.set === 'Q' && p.int) {
      nodes(arbre).filter(x => x.t === 'num' && rg.seguent() < .35).forEach(x => {
        const q = rg.entre(...CFG.FRAC_DEN), numeradors = [];
        for (let a = 1; a < q; a++) if (mcd(a, q) === 1) numeradors.push(a);
        x.t = 'frac'; x.p = rg.tria(numeradors); x.q = q; delete x.v;
      });
    }
    // Una potència o un oposat van damunt d'un nombre, d'una fracció o (si hi
    // ha parèntesis) d'un grup. Mai damunt d'una potència: −2² seria ambigu.
    const candidats = () => rg.barreja(nodes(arbre).filter(x =>
      x.t === 'num' || x.t === 'frac' || (p.par && x.t === 'bin')));
    if (p.pot) candidats().slice(0, rg.entre(1, 2)).forEach(x => embolcalla(x, 'pow', { k: rg.entre(...CFG.EXP) }));
    if (p.opo) candidats().slice(0, rg.entre(1, 2)).forEach(x => embolcalla(x, 'neg', {}));
  }

  /* ----------------------------------------------------------- acceptació
     Un arbre es queda només si compleix tot el que s'ha demanat. */

  /** On han de viure els valors: ℕ si no s'hi ha marcat res. */
  const conjunt = (p, marcat) => p.set === 'N' || !marcat ? 'N' : p.set;
  /** v és del conjunt c (ℕ, ℤ o ℚ)? */
  const dins = (c, v) => c === 'Q' || (v.d === 1 && (c === 'Z' || v.n >= 0));
  /** El que demana «força que apareguin»: un negatiu a ℤ, una fracció a ℚ. */
  const testimoni = (c, v) => c === 'Z' ? v.n < 0 : c === 'Q' ? v.d > 1 : true;

  function accepta(arbre, p, anteriors) {
    const valors = [];
    try { avalua(arbre, valors); } catch (e) { if (e === DESCARTAT) return null; throw e; }
    const final = valors[valors.length - 1], intermedis = valors.slice(0, -1);
    const ci = conjunt(p, p.int), cf = conjunt(p, p.fin);
    if (!intermedis.every(v => dins(ci, v)) || !dins(cf, final)) return null;

    const c = nousComptadors(), tex = escriu(arbre, TEX, c, true);
    if (!(c.ops['*'] && c.ops['+'] && c.ops['-'])) return null;
    if (p.div && !c.ops[':']) return null;
    if (p.pot && !c.pow) return null;
    if (p.opo && !c.neg) return null;
    if (p.par ? c.grups < 1 : c.grups > 0) return null;
    if (p.forca) {
      if (ci !== 'N' && !intermedis.some(v => testimoni(ci, v))) return null;
      if (cf !== 'N' && !testimoni(cf, final)) return null;
    }
    if (anteriors.has(tex)) return null;
    return { tex, html: escriu(arbre, HTML, nousComptadors(), true), valor: final, arbre };
  }

  /** Un exercici amb les opcions p, o null si cap dels CFG.INTENTS no és bo. */
  function genera(p, rg, anteriors) {
    for (let intent = 0; intent < CFG.INTENTS; intent++) {
      // De 3 a 5 operacions (de 4 a 6 amb divisions), sempre amb ·, + i − (i :).
      const div = p.div ? 1 : 0;
      const quantes = rg.entre(3 + div, 5 + div);
      const ops = ['*', '+', '-'];
      if (p.div) ops.push(':');
      const permeses = ops.slice();
      while (ops.length < quantes) ops.push(rg.tria(permeses));
      rg.barreja(ops);
      const nombres = [];
      for (let i = 0; i <= quantes; i++) nombres.push({ t: 'num', v: rg.entre(...CFG.OPERAND) });
      const arbre = p.par ? arbreAtzar(nombres, ops, rg) : cadena(nombres, ops);
      decora(arbre, p, rg);
      const r = accepta(arbre, p, anteriors);
      if (r) return r;
    }
    return null;
  }

  /** Les opcions permeten algun exercici? Si no, per què. */
  function valida(p) {
    if (p.opo && p.set === 'N') return { ok: false, motiu: "L'oposat no es pot fer servir amb ℕ." };
    if (p.opo && !p.int) return { ok: false, motiu: "L'oposat crea intermedis negatius: marca «intermedis»." };
    if (p.set === 'Q' && p.fin && !p.int && !(p.div && p.par))
      return { ok: false, motiu: "Amb ℚ només al resultat final calen divisions i parèntesis (l'última operació ha de ser una divisió)." };
    return { ok: true };
  }

  /* --------------------------------------------------- progressió gradual
     L'exercici i (0…n−1) porta cada extre marcat amb probabilitat
     ((i+1)/(n−1))²; els dos últims, tots. El sorteig depèn de la llavor
     mestra i de i, no de ↻: «un altre» canvia l'exercici, però no el nivell. */
  const EXTRES = ['div', 'par', 'pot', 'opo'];   // ordre de reparació: div i par primer (ℚ només final)

  function gradual(p, mestra, i) {
    const marcats = EXTRES.filter(k => p[k]);
    if (!p.grad || !marcats.length) return p;
    const n = p.n || 1;
    const prob = i >= n - 2 ? 1 : Math.min(1, ((i + 1) / (n - 1)) ** 2);
    const rg = atzar(`${mestra}:${i}:grad`), q = Object.assign({}, p);
    marcats.forEach(k => { q[k] = rg.seguent() < prob ? 1 : 0; });
    // Si treure un extre fa impossible el conjunt (ℚ només final), es torna a posar.
    for (const k of marcats) { if (valida(q).ok) break; q[k] = 1; }
    return q;
  }

  /** L'exercici i del full de llavor `mestra`, després de r ↻. `anteriors`:
      el TeX dels exercicis que ja són al full, perquè no es repeteixin. */
  function exercici(p, mestra, i, r, anteriors) {
    const q = gradual(p, mestra, i);
    const x = genera(q, atzar(`${mestra}:${i}:${r}`), anteriors || new Set());
    if (!x) return { error: 'No he pogut generar aquest exercici amb aquestes opcions.', params: q };
    x.params = q;
    x.extres = EXTRES.filter(k => q[k]);
    return x;
  }

  /* --------------------------------------------------------------- el .tex
     Només el cos: el main.tex del professor fa \input{exN.tex}. Només LaTeX
     estàndard + amsmath: cap macro de defs.tex. m = {num, seed, adreca}; amb
     l'adreça (#…), el comentari del principi diu com refer el full. */
  function fitxerTex(exs, p, m) {
    const conj = p.set === 'N' ? 'N' : `${p.set}(${[p.int && 'int', p.fin && 'fin'].filter(Boolean).join(',')})`;
    const opts = ['div', 'pot', 'par', 'opo', 'vs', 'grad'].filter(k => p[k]).map(k => k === 'grad' ? 'gradual' : k).join(' ');
    let s = `% ex${m.num}.tex — generat per «Operacions combinades 1r ESO» ${VERSIO}\n`
      + `% llavor=${m.seed} · n=${p.n} · espai=${p.esp} · simbols=${p.sim} · conjunt=${conj}${opts ? ' · ' + opts : ''}\n`
      + (m.adreca ? `% per refer aquest full: index.html${m.adreca}\n` : '')
      + '\\begin{enumerate}\n'
      + '\\renewcommand{\\labelenumi}{\\textbf{\\arabic{enumi})}}\n'
      + '\\setlength{\\itemsep}{0pt}\n'
      + `\\medmuskip=${SIMBOLS[p.sim].med}\\thickmuskip=${SIMBOLS[p.sim].thick}\n`;
    exs.forEach(e => { s += `\\item $\\displaystyle ${e.tex}$\n\\par\\vspace${p.vs ? '*' : ''}{${ESPAIS[p.esp]}}\n`; });
    return s + '\\end{enumerate}\n';
  }

  const M = { VERSIO, ESPAIS, SIMBOLS, EXTRES, valida, exercici, fitxerTex };
  if (typeof module !== 'undefined') module.exports = M;
  return M;
})();
