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

  const VERSIO = 'v0.11';

  /* La versió del GENERADOR va a l'adreça (g=…), perquè un full desat surti
     sempre amb el generador amb què es va fer. Les adreces sense g són de la
     v0.1: g=1. Els fulls nous es fan amb l'última, GENERADOR.
       g=1  el de la v0.1.
       g=2  amb «parèntesis», el nombre de parèntesis de cada exercici segueix
            el pla de `parentesis()`: com a màxim 3, i el 3 és improbable. */
  const GENERADOR = 2;

  const CFG = {
    OPERAND: [2, 9],    // els naturals de l'enunciat
    EXP: [2, 3],        // els exponents
    FRAC_DEN: [2, 6],   // els denominadors de les fraccions (ℚ)
    MAX: 200,           // cap valor, ni intermedi, té numerador o denominador més gran (en valor absolut)
    INTENTS: 2000,      // intents per exercici abans de rendir-se
    INTENTS_EXACTES: 20000   // amb un nombre exacte de parèntesis (g ≥ 2): calen més intents
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

  /* Els colors de «destaca», a triar: la caixa de cada línia és d'un color i
     el de la línia següent, de l'altre (s'alternen). Colors que es llegeixen
     bé sobre el paper blanc. La clau va a l'adreça (c1=…&c2=…); al .tex, el
     color de la clau, en hexadecimal. */
  const COLORS = {
    blaufosc: { nom: 'blau fosc', hex: '00008B' },
    blau: { nom: 'blau', hex: '1565C0' },
    cel: { nom: 'blau cel', hex: '0288D1' },
    turquesa: { nom: 'turquesa', hex: '00897B' },
    verd: { nom: 'verd', hex: '2E7D32' },
    oliva: { nom: 'verd oliva', hex: '6B8E23' },
    mostassa: { nom: 'mostassa', hex: 'B8860B' },
    taronja: { nom: 'taronja', hex: 'E65100' },
    vermell: { nom: 'vermell', hex: 'D32F2F' },
    granat: { nom: 'granat', hex: '8B1A1A' },
    rosa: { nom: 'rosa', hex: 'D81B60' },
    lila: { nom: 'lila', hex: '8E24AA' },
    violeta: { nom: 'violeta', hex: '5E35B1' },
    marro: { nom: 'marró', hex: '795548' },
    gris: { nom: 'gris', hex: '616161' },
    negre: { nom: 'negre', hex: '000000' }
  };
  const COLORS_PER_DEFECTE = ['blaufosc', 'vermell'];

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

  /** L'alçada invisible d'un \left( amb fraccions i parèntesis a dins. */
  function alcadaTex(s) {
    const h = profunditat(s);
    if (!h) return '';
    const r = 1.25 + .4 * h;
    return `\\mathopen{\\vphantom{\\rule[-${(r - .25).toFixed(2)}em]{0pt}{${(2 * r).toFixed(2)}em}}}`;
  }

  function parentesiTex(s) {
    if (s.includes('\\frac')) return `\\left(${alcadaTex(s)}${s}\\right)`;
    const nivell = Math.min(4, profunditat(s));
    return OBRE_TEX[nivell] + s + TANCA_TEX[nivell];
  }

  /** Els dos parèntesis de s, cadascun sol (la disposició «centrat» els posa
      en columnes diferents). Amb fraccions, cada meitat és un \left…\right amb
      un \vphantom de tot el contingut: fa la mateixa alçada que tot el grup. */
  function meitatsTex(s) {
    if (s.includes('\\frac')) {
      const alt = `${alcadaTex(s)}\\vphantom{${s}}`, sense = '\\kern-\\nulldelimiterspace';
      return [`\\left(${alt}\\right.${sense}`, `${sense}\\left.${alt}\\right)`];
    }
    const nivell = Math.min(4, profunditat(s));
    return [OBRE_TEX[nivell], TANCA_TEX[nivell]];
  }

  /* A la previsualització, el mateix criteri: cada nivell, un 22 % més gran;
     amb fraccions, de partida gairebé el doble. */
  function obreHtml(s) {
    const h = profunditat(s), fraccio = s.includes('class="fr"');
    if (!h && !fraccio) return '';
    return `<span class="pb" style="font-size:${((fraccio ? 1.9 : 1) * (1 + .22 * h)).toFixed(2)}em">`;
  }

  function parentesiHtml(s) {
    const obre = obreHtml(s);
    return obre ? `<span class="pg">${obre}(</span>${s}${obre})</span></span>` : `(${s})`;
  }

  function meitatsHtml(s) {
    const obre = obreHtml(s);
    return obre ? [`<span class="pg">${obre}(</span></span>`, `<span class="pg">${obre})</span></span>`] : ['(', ')'];
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
    oposat: s => '-' + (s.startsWith('\\left(') ? '\\mathopen{}' : '') + s,
    // La part que es calcula a la línia següent: dins d'una caixa (\boxed, d'amsmath) del
    // color k de la línia (destaca1 o destaca2, que defineix el fitxer: colorsTex). Entre
    // claus, perquè TeX la tracti com un sol nombre: el − o el + que la segueix és una resta.
    destaca: (s, k) => `{\\color{destaca${k}}\\boxed{${s}}}`,
    // El resultat del que estava destacat a la línia d'abans, del color de la seva caixa.
    resultat: (s, k) => `{\\color{destaca${k}}${s}}`,
    // «Centrat»: cada parèntesi, cada operador i cada − d'un oposat, sols a la seva columna.
    // Entre {} perquè TeX hi posi els mateixos espais que dins de la fórmula.
    meitats: meitatsTex,
    operadorSol: op => `{}${TEX.operador(op)}{}`,
    menys: '-'
  };

  const HTML = {
    nombre: v => String(v),
    fraccio: (p, q) => `<span class="fr"><span>${p}</span><span>${q}</span></span>`,
    operador: op => `<span class="op">${({ '+': '+', '-': '−', '*': '·', ':': ':' })[op]}</span>`,
    parentesi: parentesiHtml,
    potencia: potenciaHtml,
    oposat: s => '−' + s,
    destaca: (s, k) => `<span class="dest caixa k${k}">${s}</span>`,
    resultat: (s, k) => `<span class="k${k}">${s}</span>`,
    meitats: meitatsHtml,
    operadorSol: op => HTML.operador(op),
    menys: '−'
  };

  /** Cal un parèntesi al voltant de `fill`, que és el costat 'l' o 'r' de
      `pare`? Sí quan opera amb menys prioritat, o amb la mateixa i és a la
      dreta: a−(b+c), a:(b·c). */
  function calParentesi(fill, pare, costat) {
    return fill.t === 'bin' &&
      (PREC[fill.op] < PREC[pare.op] || (PREC[fill.op] === PREC[pare.op] && costat === 'r'));
  }

  /* grups: els parèntesis d'agrupació (els que demana l'arbre). parentesis:
     tots els que es veuen menys els que envolten un sol nombre o una sola
     fracció, (−3) i (2/3)²: també compta el de fora de (−(2+3)). És el que un
     professor diria «quants parèntesis té» (generador 2). */
  const nousComptadors = () => ({ grups: 0, parentesis: 0, pow: 0, neg: 0, ops: {} });

  /** Escriu l'arbre amb l'emissor E i compta a `c` el que hi surt.
      `alPrincipi`: el node és el primer símbol de l'expressió o d'un grup.
      Només allà un negatiu va sense parèntesi: −3+5, però 5·(−3).
      «Destaca» (si c.color, el color de la línia: 1 o 2): els nodes de
      `c.marcats`, dins d'una caixa del color de la línia; els de
      `c.resultats`, els que surten de la caixa de la línia d'abans, de l'altre. */
  function escriu(node, E, c, alPrincipi) {
    let s = escriuNode(node, E, c, alPrincipi);
    if (c.resultats && c.resultats.has(node)) s = E.resultat(s, 3 - c.color);
    return c.marcats && c.marcats.has(node) ? E.destaca(s, c.color) : s;
  }

  function escriuNode(node, E, c, alPrincipi) {
    switch (node.t) {
      case 'num': return E.nombre(node.v);
      case 'frac': return E.fraccio(node.p, node.q);
      case 'val': {           // un valor del solucionari: com el nombre, la fracció o l'oposat que seria
        const s = node.d === 1 ? E.nombre(Math.abs(node.n)) : E.fraccio(Math.abs(node.n), node.d);
        if (!(node.n < 0)) return s;
        const negatiu = E.oposat(s);
        return alPrincipi ? negatiu : E.parentesi(negatiu);
      }
      case 'neg': {
        c.neg++;
        let dins;
        if (node.a.t === 'bin') { c.grups++; c.parentesis++; dins = E.parentesi(escriu(node.a, E, c, true)); }
        else dins = escriu(node.a, E, c, false);
        const s = E.oposat(dins);
        if (alPrincipi) return s;
        if (node.a.t === 'bin') c.parentesis++;            // (−(2+3)) en té dos; (−3), cap
        return E.parentesi(s);
      }
      case 'pow': {
        c.pow++;
        const b = node.a;
        let base;
        if (b.t === 'num') base = E.nombre(b.v);
        else if (b.t === 'val' && b.d === 1 && b.n >= 0) base = escriu(b, E, c, true);   // el nombre (o el resultat, 3²)
        else if (b.t === 'bin') { c.grups++; c.parentesis++; base = E.parentesi(escriu(b, E, c, true)); }
        else {                                                 // (−3)², (2/3)², (−(2+3))²
          if (b.t === 'neg' && b.a.t === 'bin') c.parentesis++;
          base = E.parentesi(escriu(b, E, c, true));
        }
        return E.potencia(base, node.k);
      }
      case 'bin': {
        c.ops[node.op] = (c.ops[node.op] || 0) + 1;
        const costat = (fill, quin) => {
          if (calParentesi(fill, node, quin)) { c.grups++; c.parentesis++; return E.parentesi(escriu(fill, E, c, true)); }
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
    if (p.parentesis !== undefined ? c.parentesis !== p.parentesis : p.par ? c.grups < 1 : c.grups > 0) return null;
    if (p.forca) {
      if (ci !== 'N' && !intermedis.some(v => testimoni(ci, v))) return null;
      if (cf !== 'N' && !testimoni(cf, final)) return null;
    }
    if (anteriors.has(tex)) return null;
    return { tex, html: escriu(arbre, HTML, nousComptadors(), true), valor: final, arbre };
  }

  /** Un exercici amb les opcions p, o null si cap dels intents no és bo. */
  function genera(p, rg, anteriors) {
    const intents = p.parentesis !== undefined ? CFG.INTENTS_EXACTES : CFG.INTENTS;
    for (let intent = 0; intent < intents; intent++) {
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

  /* ------------------------------------------- quants parèntesis (g ≥ 2)
     Quants parèntesis porta l'exercici i (parelles, comptades com a
     `nousComptadors`: els de (−3) no compten), segons el pla del professor:
       - gradual: de cada 10, 4 sense, 3 amb 1 i 3 amb 2, en ordre creixent;
       - immediata: tots en tenen, 6 de cada 10 amb 1 i 4 amb 2, barrejats;
       - en un full de cada 7 (15 %), l'últim «2» del pla en porta 3.
     Mai n'hi ha més de 3, i el 3 és improbable. El pla es fa per quantils, de
     manera que surt igual amb qualsevol n: l'exercici j cau a (j+½)/n. Només
     depèn de la llavor mestra, de n i de i: ↻ canvia l'exercici, però no
     quants parèntesis té. */
  function parentesis(p, mestra, i) {
    const n = Math.max(1, p.n || 1), pla = [];
    for (let j = 0; j < n; j++) {
      const u = 5 * (2 * j + 1);              // (j+½)/n < x  ⇔  u < 10·x·n
      if (!p.grad) pla.push(u < 6 * n ? 1 : 2);
      else if (u >= 7 * n) pla.push(2);
      else pla.push(u < 4 * n && j < n - 2 ? 0 : 1);   // els 2 últims porten tots els extres
    }
    if (pla[n - 1] === 2 && atzar(`${mestra}:par3`).seguent() < .15) pla[n - 1] = 3;
    if (!p.grad) atzar(`${mestra}:parOrdre`).barreja(pla);
    return pla[Math.min(i, n - 1)];
  }

  /** Les opcions de l'exercici i: les del full, amb la progressió gradual i,
      amb g ≥ 2, el nombre exacte de parèntesis (q.parentesis). */
  function opcions(p, mestra, i) {
    const q = Object.assign({}, gradual(p, mestra, i));
    if (p.g >= 2 && p.par) {
      q.parentesis = parentesis(p, mestra, i);
      q.par = q.parentesis ? 1 : 0;
      // ℚ només final no té cap exercici possible sense parèntesis: com a mínim 1.
      if (!valida(q).ok) { q.par = 1; q.parentesis = Math.max(1, q.parentesis); }
    }
    return q;
  }

  /** L'exercici i del full de llavor `mestra`, després de r ↻. `anteriors`:
      el TeX dels exercicis que ja són al full, perquè no es repeteixin. */
  function exercici(p, mestra, i, r, anteriors) {
    const q = opcions(p, mestra, i);
    const x = genera(q, atzar(`${mestra}:${i}:${r}`), anteriors || new Set());
    if (!x) return { error: 'No he pogut generar aquest exercici amb aquestes opcions.', params: q };
    x.params = q;
    x.extres = EXTRES.filter(k => q[k]);
    return x;
  }

  /* ======================================================== el solucionari
     La resolució pas a pas d'un exercici, com es fa a l'aula (decisions del
     professor, todo.md §5):
       - primer els parèntesis, d'un en un: el grup més interior i, si n'hi ha
         diversos, el de més a l'esquerra (el FOCUS). Sense grups pendents, el
         focus és tota l'expressió;
       - dins del focus: −(−a); després les potències; després · i :; i
         després + i −: primer una línia amb la regla dels signes, 5−(−3) →
         5+3, i després d'una en una, d'esquerra a dreta;
       - amb fraccions, una suma o una resta es passa primer a comú
         denominador (el m.c.m.), i un resultat que es pot simplificar se
         simplifica a la línia següent (si `simp`).
     Granularitat: «prio» fa en una línia totes les operacions del mateix
     nivell del focus (2·3+4·5 → 6+20); «op», només la de més a l'esquerra.

     Els passos són arbres amb un tipus de fulla nou, {t:'val', n, d}: un
     valor exacte (d > 0) que pot estar sense simplificar (6/8, o 6/2 quan es
     passa a comú denominador). S'escriu com el nombre, la fracció o l'oposat
     que seria, o sigui que l'enunciat passat a valors s'escriu igual. Els
     passos no fan servir l'atzar. */

  /** L'enunciat amb valors. L'oposat d'un nombre, −3, també és un valor: és
      un nombre i no una operació (si no, (−3) → (−3) seria un pas buit). */
  function ambValors(n) {
    switch (n.t) {
      case 'num': return { t: 'val', n: n.v, d: 1 };
      case 'frac': return { t: 'val', n: n.p, d: n.q };
      case 'val': return Object.assign({}, n);
      case 'neg':
        if (n.a.t === 'num' || n.a.t === 'frac') { const v = ambValors(n.a); v.n = -v.n; return v; }
        return { t: 'neg', a: ambValors(n.a) };
      case 'pow': return { t: 'pow', a: ambValors(n.a), k: n.k };
      case 'bin': return { t: 'bin', op: n.op, l: ambValors(n.l), r: ambValors(n.r) };
    }
  }

  /** El resultat d'una operació tal com surt, n/d. Si es pot simplificar i es
      vol el pas de simplificar, queda marcat (brut) per a la línia següent. */
  function resultat(n, d, simp) {
    if (d < 0) { n = -n; d = -d; }
    if (n === 0) return { t: 'val', n: 0, d: 1 };
    const k = mcd(n, d);
    return k > 1 && simp ? { t: 'val', n, d, brut: true } : { t: 'val', n: n / k, d: d / k };
  }

  /** Una potència o una operació amb dos valors. Les sumes i les restes ja
      arriben amb el mateix denominador. */
  function calcula(node, simp) {
    if (node.t === 'pow') return resultat(node.a.n ** node.k, node.a.d ** node.k, simp);
    const a = node.l, b = node.r;
    switch (node.op) {
      case '*': return resultat(a.n * b.n, a.d * b.d, simp);
      case ':':   // dos enters que es divideixen exactament: l'enter (12:4 = 3, no 12/4)
        if (a.d === 1 && b.d === 1 && a.n % b.n === 0) return { t: 'val', n: a.n / b.n, d: 1 };
        return resultat(a.n * b.d, a.d * b.n, simp);
      case '+': return resultat(a.n + b.n, a.d, simp);
      case '-': return resultat(a.n - b.n, a.d, simp);
    }
  }

  /** a ± b, amb denominadors diferents, passat a comú denominador (m.c.m.). */
  function comuDenominador(node) {
    const a = node.l, b = node.r, m = a.d / mcd(a.d, b.d) * b.d;
    return { t: 'bin', op: node.op,
             l: { t: 'val', n: a.n * (m / a.d), d: m, id: a.id }, r: { t: 'val', n: b.n * (m / b.d), d: m, id: b.id } };
  }

  /** La regla dels signes: a − (−b) → a + b; a + (−b) → a − b. */
  function canviaSigne(node) {
    return { t: 'bin', op: node.op === '+' ? '-' : '+', l: node.l, r: Object.assign({}, node.r, { n: -node.r.n }) };
  }

  /** El focus: el primer grup pendent (en ordre de lectura) que no en té cap
      altre a dins. Un grup és una operació que s'escriu entre parèntesis:
      la que en demana el pare, la d'un oposat, −(…), o la base d'una potència. */
  function focus(T) {
    const grups = [];
    (function recorre(n, pare, costat) {
      if (n.t === 'bin') {
        if (pare && (pare.t !== 'bin' || calParentesi(n, pare, costat))) grups.push(n);
        recorre(n.l, n, 'l');
        recorre(n.r, n, 'r');
      } else if (n.a) recorre(n.a, n, null);
    })(T, null, null);
    return grups.find(g => !grups.some(h => h !== g && nodes(g).includes(h))) || T;
  }

  /** Una còpia de l'arbre T on cada node de `canvien` passa per f (amb els
      fills ja copiats). L'oposat d'un valor positiu passa a ser el valor
      negatiu sense cap línia: −10 s'escriu igual. Cada node conserva l'id
      del de l'enunciat que substitueix (la disposició «centrat» el fa servir).
      marques: els nodes de T que canvien (si no, els de `canvien`); resultats:
      els nodes de la còpia que en surten (els de la mateixa id, o el valor
      negatiu en què s'ha convertit l'oposat d'un d'ells: −(2·3) → −6). */
  function transforma(T, canvien, f, tipus, marques) {
    const marcats = new Set(marques || canvien), ids = new Set([...marcats].map(n => n.id)), fosos = new Set();
    const copia = n => {
      let c;
      if (n.t === 'bin') c = { t: 'bin', op: n.op, l: copia(n.l), r: copia(n.r), id: n.id };
      else if (n.t === 'neg') c = { t: 'neg', a: copia(n.a), id: n.id };
      else if (n.t === 'pow') c = { t: 'pow', a: copia(n.a), k: n.k, id: n.id };
      else c = Object.assign({}, n);
      if (canvien.includes(n)) c = Object.assign(f(c), { id: n.id });
      if (c.t === 'neg' && c.a.t === 'val' && c.a.n >= 0) {
        if (ids.has(c.a.id)) fosos.add(c.id);
        c = Object.assign({}, c.a, { n: -c.a.n, id: c.id });
      }
      return c;
    };
    const nou = copia(T);
    return { nou, tipus, marques: marcats, resultats: new Set(nodes(nou).filter(n => ids.has(n.id) || fosos.has(n.id))) };
  }

  /** La línia següent de la resolució de T. */
  function pas(T, unaOperacio, simp) {
    const tria = llista => (unaOperacio ? llista.slice(0, 1) : llista);
    // Un resultat que es pot simplificar, se simplifica abans de res
    const bruts = nodes(T).filter(n => n.t === 'val' && n.brut);
    if (bruts.length) return transforma(T, bruts, n => resultat(n.n, n.d, false), 'simplifica');
    const dins = nodes(focus(T)), val = n => n.t === 'val';
    // −(−a)
    let cands = dins.filter(n => n.t === 'neg' && val(n.a));
    if (cands.length) return transforma(T, tria(cands), n => ({ t: 'val', n: -n.a.n, d: n.a.d }), 'signes');
    // potències
    cands = dins.filter(n => n.t === 'pow' && val(n.a));
    if (cands.length) return transforma(T, tria(cands), n => calcula(n, simp), 'potencia');
    // · i :
    cands = dins.filter(n => n.t === 'bin' && (n.op === '*' || n.op === ':') && val(n.l) && val(n.r));
    if (cands.length) return transforma(T, tria(cands), n => calcula(n, simp), 'producte');
    // + i −: primer la regla dels signes, tota en una línia
    cands = dins.filter(n => n.t === 'bin' && (n.op === '+' || n.op === '-') && val(n.r) && n.r.n < 0);
    if (cands.length) return transforma(T, cands, canviaSigne, 'signes', cands.map(n => n.r));
    // i després d'una en una (amb el focus pla, només n'hi ha una de llesta: la de més a l'esquerra)
    const s = dins.find(n => n.t === 'bin' && val(n.l) && val(n.r));
    if (!s) throw new Error('solucionari: cap operació a fer');
    if (s.l.d !== s.r.d) return transforma(T, [s], comuDenominador, 'mcm');
    return transforma(T, [s], n => calcula(n, simp), 'suma');
  }

  /** Els passos de la resolució: [{arbre, tipus, marques, resultats}]. El
      primer és l'enunciat; l'últim, el resultat (un sol valor). `tipus`: com
      s'ha arribat a aquest pas; `marques`: els nodes que canvien al següent;
      `resultats`: els que surten de les marques del pas d'abans.
      op = {gra: 'prio'|'op', simp: true|false}. */
  function passos(arbre, op) {
    op = op || {};
    const unaOperacio = op.gra === 'op', simp = op.simp === undefined ? true : !!+op.simp;
    let T = ambValors(arbre);
    nodes(T).forEach((n, i) => { n.id = i; });       // cada node de l'enunciat, el seu id
    const llista = [{ arbre: T }];
    while (T.t !== 'val' || T.brut) {
      if (llista.length > 300) throw new Error('solucionari: no acaba');
      const p = pas(T, unaOperacio, simp);
      llista[llista.length - 1].marques = p.marques;
      T = p.nou;
      llista.push({ arbre: T, tipus: p.tipus, resultats: p.resultats });
    }
    return llista;
  }

  /** El color de «destaca» de la línia k de la resolució (0, l'enunciat): 1, 2, 1, 2… Les caixes de la línia
      són d'aquest color, i els resultats que en surten, a la línia següent, també. */
  const colorLinia = k => k % 2 + 1;

  /** Les línies de la resolució, en TeX i en HTML; la primera és l'enunciat.
      Amb op.dest, cada línia destaca el que es calcula a la següent, dins d'una
      caixa del seu color, i el que surt de la caixa de la línia d'abans, del
      color d'aquella caixa: 4·3·3, [4·3]·3 (1), [12·3] (2, amb el 12 de l'1), 36 (2). */
  function resolucio(arbre, op) {
    op = op || {};
    const ps = passos(arbre, op);
    const linia = (p, E, k) => {
      const c = nousComptadors();
      if (+op.dest) Object.assign(c, { marcats: p.marques, resultats: p.resultats, color: colorLinia(k) });
      return escriu(p.arbre, E, c, true);
    };
    return { tex: ps.map((p, k) => linia(p, TEX, k)), html: ps.map((p, k) => linia(p, HTML, k)), passos: ps };
  }

  /* ------------------------------------------------ la disposició «centrat»
     Totes les línies en una taula (un array, al .tex): cada nombre, cada
     operador, cada − d'un oposat i cada parèntesi de l'enunciat té la seva
     columna, i el resultat d'un càlcul ocupa les columnes del que substitueix,
     centrat a sota. Així un signe que encara hi és no canvia mai de columna.
     El «=» va al final de cada línia, menys de l'última:

         2 + 3 · (5 − 2)² + 8 =
         2 + 3 ·    3²    + 8 =
         2 + 3 ·    9     + 8 =
         2 +     27       + 8 =
              29          + 8 =
                    37

     Cada node d'un pas porta l'id del node de l'enunciat que substitueix
     (passos i transforma el conserven): és el que diu a quines columnes va. */

  /** Un node que s'escriu d'una peça: un valor o la potència d'un valor. */
  const compacte = n => n.t === 'val' || (n.t === 'pow' && n.a.t === 'val');

  /** Té parèntesis propis? Els que li posa el pare (embolcallat) o, si és un
      oposat que no és al principi, els de notació: (−(2+3)). */
  const ambParentesis = (n, alPrincipi, embolcallat) => embolcallat || (n.t === 'neg' && !alPrincipi);

  /** Les columnes de l'enunciat. Deixa a col.span l'interval [a, b) de cada
      node, amb els seus parèntesis. alPrincipi, com a escriu; embolcallat: el
      pare l'escriu entre parèntesis (una operació o la base d'una potència). */
  function columnes(n, alPrincipi, embolcallat, col) {
    if (compacte(n)) { col.span.set(n.id, [col.n, ++col.n]); return; }
    const a = col.n, par = ambParentesis(n, alPrincipi, embolcallat);
    if (par) col.n++;
    if (n.t === 'bin') {
      const pl = calParentesi(n.l, n, 'l'), pr = calParentesi(n.r, n, 'r');
      columnes(n.l, pl || alPrincipi, pl, col);
      col.n++;                                                // l'operador
      columnes(n.r, pr, pr, col);
    } else if (n.t === 'neg') {
      col.n++;                                                // el −
      columnes(n.a, n.a.t === 'bin', n.a.t === 'bin', col);
    } else columnes(n.a, true, true, col);                    // la base d'una potència
    if (par) col.n++;
    col.span.set(n.id, [a, col.n]);
  }

  /** Una línia de la taula: els trossos [{a, b, s, dest, caixa, nombre}] de
      l'arbre n (un pas), cada text s a les columnes [a, b) del node de
      l'enunciat que substitueix. nombre: és un nombre, una fracció o una
      potència (no un signe ni un parèntesi). d: «destaca», {marques,
      resultats, color} de la línia (o null). dest: el tros és d'un node de
      `marques`, el que es calcula a la línia següent; caixa, l'id d'aquest
      node (els trossos d'una mateixa caixa). Els de `resultats` porten el
      color de la caixa de la línia d'abans. */
  function trossos(n, E, alPrincipi, embolcallat, span, d) {
    const [a, b] = span.get(n.id), dest = !!d && !!d.marques && d.marques.has(n);
    if (compacte(n)) {
      // Si el que es destaca és la base d'una potència, (−4/4)² (es simplifica), la cel·la és tota la
      // potència: la base es destaca a dins, com a la línia normal
      const c = nousComptadors();
      if (d) Object.assign(c, { marcats: dest ? null : d.marques, resultats: d.resultats, color: d.color });
      const s = escriu(n, E, c, alPrincipi);
      return [{ a, b, s: embolcallat ? E.parentesi(s) : s, dest, nombre: true, caixa: dest ? n.id : undefined }];
    }
    let t;
    if (n.t === 'bin') {
      const pl = calParentesi(n.l, n, 'l'), pr = calParentesi(n.r, n, 'r'), o = span.get(n.l.id)[1];
      t = trossos(n.l, E, pl || alPrincipi, pl, span, d)
        .concat({ a: o, b: o + 1, s: E.operadorSol(n.op) }, trossos(n.r, E, pr, pr, span, d));
    } else if (n.t === 'neg') {
      const grup = n.a.t === 'bin', o = span.get(n.a.id)[0] - 1;
      t = [{ a: o, b: o + 1, s: E.menys }].concat(trossos(n.a, E, grup, grup, span, d));
    } else {                                                  // l'exponent, a l'últim tros de la base: (5−2)²
      t = trossos(n.a, E, true, true, span, d);
      const u = t[t.length - 1];
      t[t.length - 1] = Object.assign({}, u, { s: E.potencia(u.s, n.k) });
    }
    // Un resultat que no és d'una peça (dues fraccions passades a comú denominador): tots els seus trossos
    if (d && d.resultats && d.resultats.has(n)) t = t.map(x => Object.assign({}, x, { s: E.resultat(x.s, 3 - d.color) }));
    if (dest) t.forEach(x => { x.dest = true; x.caixa = n.id; });
    if (!ambParentesis(n, alPrincipi, embolcallat)) return t;
    // Els parèntesis que li posa el pare no són seus: com a escriu, no es destaquen. Els de notació, sí.
    const [obre, tanca] = E.meitats(escriu(n, E, nousComptadors(), true)), seus = dest && !embolcallat;
    const caixa = seus ? n.id : undefined;
    return [{ a, b: a + 1, s: obre, dest: seus, caixa, par: true }].concat(t, { a: b - 1, b, s: tanca, dest: seus, caixa, par: true });
  }

  /** La resolució en disposició «centrat»: tex, un array de LaTeX (o uns quants,
      un sota l'altre: blocs); html, una taula; files, els trossos de cada línia
      ({tex, html}). Amb op.dest, el que es calcula a la línia següent surt dins
      d'una caixa del color de la línia, i el resultat, a sota, del mateix color
      (com a resolucio). Cada tros es queda a la seva columna, també dins d'una
      caixa: la caixa és un marc al voltant de les seves columnes. */
  function centrada(arbre, op) {
    op = op || {};
    const ps = passos(arbre, op), col = { n: 0, span: new Map() }, dest = !!+op.dest;
    columnes(ps[0].arbre, true, false, col);
    const N = col.n;
    const files = ps.map((p, k) => {
      const d = dest ? { marques: p.marques, resultats: p.resultats, color: colorLinia(k) } : null;
      const tex = trossos(p.arbre, TEX, true, false, col.span, d), html = trossos(p.arbre, HTML, true, false, col.span, d);
      // Els trossos cobreixen les N columnes, en ordre i sense encavalcar-se
      if (tex.some((t, i) => t.a !== (i ? tex[i - 1].b : 0) || t.b <= t.a) || tex[tex.length - 1].b !== N)
        throw new Error('centrat: les columnes no quadren');
      return { tex, html };
    });
    const ultima = k => k === files.length - 1;
    // El contingut d'un tros. \displaystyle, com a la fórmula sencera: fraccions, exponents i \left( de la mateixa
    // mida. Amb «destaca», els nombres porten 3 pt d'aire a banda i banda, a totes les línies: el marc d'una caixa
    // hi passa per dins (a 1,2 pt de la vora del tros) i no toca ni el nombre ni el que hi ha al costat.
    const dins = ({ s, nombre }) => {
      const x = /\\frac|\^|\\left/.test(s) ? '\\displaystyle ' + s : s;
      return dest && nombre ? `\\kern3pt ${x}\\kern3pt` : x;
    };
    const multi = (t, s) => (t.b - t.a > 1 ? `\\multicolumn{${t.b - t.a}}{@{}c@{}}{${s}}` : s);
    // Les caixes d'una línia: cada grup de trossos seguits d'un mateix node marcat, {a, b, caixa, trossos}
    const grups = ts => ts.reduce((out, t) => {
      const u = out[out.length - 1];
      if (t.caixa !== undefined && u && u.caixa === t.caixa) { u.trossos.push(t); u.b = t.b; }
      else out.push(t.caixa !== undefined ? { a: t.a, b: t.b, caixa: t.caixa, trossos: [t] } : t);
      return out;
    }, []);
    // Els trossos que tenen a les columnes [a, b) totes les línies menys la k, si les omplen (si no, un tros
    // d'aquella línia les conté), com a files invisibles i sense alçada d'un array, sense repetir-ne cap. I un
    // array amb les columnes [a, b) i unes files: fa el mateix ample que aquestes columnes a fora.
    const fantasmes = (a, b, k) => {
      const out = [];
      files.forEach((f, j) => {
        const rang = f.tex.filter(t => t.a >= a && t.b <= b);
        if (j === k || rang.reduce((x, t) => x + t.b - t.a, 0) !== b - a) return;
        const fila = rang.map(t => `\\multispan{${t.b - t.a}}$\\hphantom{${sensColors(dins(t))}}$`).join('&') + '\\cr';
        if (!out.includes(fila)) out.push(fila);
      });
      return out.join('');
    };
    // (sense els colors de «destaca», {\\color{destacaK}…}, que no canvien l'amplada: així es repeteixen menys files)
    const sensColors = x => {
      for (let i; (i = x.indexOf('{\\color{destaca')) >= 0;) {
        let j = i + 1, d = 1;
        for (; d && j < x.length; j++) if (x[j] === '{') d++; else if (x[j] === '}') d--;
        x = x.slice(0, i) + x.slice(i + '{\\color{destaca1}'.length, j - 1) + x.slice(j);
      }
      return x;
    };
    const columnesDe = (a, b, f) => `\\hbox{\\def\\arraystretch{0}$\\begin{array}[b]{@{}*{${b - a}}{c@{}}}${f}\\end{array}$}`;
    // El marc al voltant de \box0, del primer tros (l, des de l'esquerra) a l'últim (r, des de la dreta), 1,2 pt
    // cap endins: 2,5 pt per sobre i per sota del contingut, i el gruix del \boxed (0,4 pt). No ocupa lloc.
    const marc = (l = '0pt', r = '0pt') => `\\rlap{\\kern\\dimexpr${l}+1.2pt\\relax\\lower\\dimexpr\\dp0+2.5pt\\relax\\vbox{\\hrule height.4pt`
      + `\\hbox to\\dimexpr\\wd0-${l}-${r}-2.4pt\\relax{\\vrule width.4pt height\\dimexpr\\ht0+2.1pt\\relax depth\\dimexpr\\dp0+2.1pt\\relax`
      + '\\hfil\\vrule width.4pt}\\hrule height.4pt}}\\box0';
    // Una caixa de la línia k, en una sola cel·la que ocupa les seves columnes. D'un sol tros, el marc al voltant
    // del tros. De més d'un, a dins, un array amb les mateixes columnes i, a la vista, els seus trossos, cadascun a
    // la seva columna; a sobre, invisibles, els de les altres línies: així les columnes de dins fan el mateix ample
    // que les de fora, i cada tros queda alineat amb els de sobre i de sota. El marc va del principi del primer tros
    // (centrat a les seves columnes: \box2 i \box4) al final de l'últim (\box6 i \box8).
    const caixa = (g, k) => {
      const color = `\\color{destaca${colorLinia(k)}}`, u = g.trossos[0], z = g.trossos[g.trossos.length - 1];
      if (u === z) return `${color}\\setbox0\\hbox{$${dins(u)}$}${marc()}`;
      const vista = g.trossos.map(t => multi(t, dins(t))).join('&');
      return `${color}\\setbox0${columnesDe(g.a, g.b, fantasmes(g.a, g.b, k) + vista)}`
        + `\\setbox2${columnesDe(u.a, u.b, fantasmes(u.a, u.b, -1))}\\setbox4\\hbox{$${dins(u)}$}`
        + `\\setbox6${columnesDe(z.a, z.b, fantasmes(z.a, z.b, -1))}\\setbox8\\hbox{$${dins(z)}$}`
        + marc('(\\wd2-\\wd4)/2', '(\\wd6-\\wd8)/2');
    };
    const cel = (g, k) => multi(g, g.trossos ? caixa(g, k) : dins(g));
    // Entre dues línies, un espai fix (\noalign): així una línia amb fraccions no toca mai la del costat
    const fr = k => files[k].tex.some(t => t.s.includes('\\frac'));
    const espai = k => (fr(k) || fr(k + 1) ? 6 : 3);
    const linia = k => grups(files[k].tex).map(g => cel(g, k)).join(' & ') + (ultima(k) ? '' : ' & {}={}');
    // Una línia invisible i sense alçada: només hi compta l'amplada de cada cel·la. Amb \multispan (sense la
    // plantilla de l'array, que hi posaria el puntal), la fila no ocupa gens d'alçada.
    const fantasma = k => files[k].tex.concat(ultima(k) ? [] : [{ a: N, b: N + 1, s: '{}={}' }])
      .map(c => `\\multispan{${c.b - c.a}}$\\hphantom{${dins(c)}}$`).join('&') + '\\cr\n';
    // Un array no es parteix entre pàgines, i una resolució llarga de ℚ pot passar d'una pàgina: amb més de 12
    // línies, va en blocs, un array sota l'altre, i la pàgina es pot partir entre dos blocs. Perquè les columnes
    // facin el mateix ample a tots els blocs, cadascun porta, invisibles, les línies dels altres.
    const nb = Math.ceil(files.length / 12), mida = Math.ceil(files.length / nb), blocs = [];
    for (let p = 0; p < files.length; p += mida) {
      const q = Math.min(files.length, p + mida);
      let b = `\\begin{array}[t]{@{}*{${N + 1}}{c@{}}}\n`;
      for (let k = p; k < q; k++) {
        b += linia(k);
        if (k < q - 1) b += ` \\\\\\noalign{\\vskip ${espai(k)}pt}\n`;
        else if (nb > 1) b += ' \\\\\n' + files.map((f, j) => (j < p || j >= q ? fantasma(j) : '')).join('');
        else b += '\n';
      }
      blocs.push(b + '\\end{array}');
    }
    // Entre dos blocs, el mateix espai que entre dues línies (menys l'1 pt de \lineskip que hi posa TeX)
    const tex = blocs.map((b, j) => (j ? `$\\\\[${espai(j * mida - 1) - 1}pt]\n$` : '') + b).join('');
    // A la web, el mateix: cada tros a la seva cel·la; els nombres, amb aire (n), i els parèntesis, amb una mica
    // (p); les cel·les d'una caixa, amb el marc (marc, del color de la línia; ini, la primera, i fi, l'última)
    const td = (ts, k) => ts.map((t, i) => {
      const cl = dest && t.nombre ? ['n'] : dest && t.par ? ['p'] : [];
      if (t.caixa !== undefined) {
        cl.push('dest', 'marc', `k${colorLinia(k)}`);
        if (!i || ts[i - 1].caixa !== t.caixa) cl.push('ini');
        if (i === ts.length - 1 || ts[i + 1].caixa !== t.caixa) cl.push('fi');
      }
      return `<td${cl.length ? ` class="${cl.join(' ')}"` : ''}${t.b - t.a > 1 ? ` colspan="${t.b - t.a}"` : ''}>${t.s}</td>`;
    }).join('');
    const html = '<table class="centrat">'
      + files.map((f, k) => `<tr>${td(f.html, k)}${ultima(k) ? '' : '<td class="igual">=</td>'}</tr>`).join('')
      + '</table>';
    return { tex, html, files, blocs };
  }

  /* --------------------------------------------------------------- el .tex
     Només el cos: el main.tex del professor fa \input{exN.tex}. Només LaTeX
     estàndard + amsmath: cap macro de defs.tex. L'única excepció és «destaca»,
     que pinta amb dos colors: necessita xcolor (el carrega headers.tex), i el
     fitxer mateix els defineix (colorsTex). m = {num, seed, adreca}; amb
     l'adreça (#…), el comentari del principi diu com refer el full.
     sol = {mode, resolts, gra, simp, dest, nomes, cen, c1, c2}, les solucions. Amb el mode
     «guiades», els exercicis de `resolts` (índexs) porten la resolució a sota;
     amb qualsevol altre mode, exN.tex és el de sempre, byte a byte. */

  /** Els dos colors de «destaca» triats (sol.c1 i sol.c2, claus de COLORS): una que no hi és, el de per defecte. */
  const colorsDe = sol => ['c1', 'c2'].map((k, i) => COLORS[Object.prototype.hasOwnProperty.call(COLORS, sol[k]) ? sol[k] : COLORS_PER_DEFECTE[i]]);

  /** Els colors de «destaca», destaca1 i destaca2, definits al fitxer mateix (cal xcolor, que carrega headers.tex).
      \definecolor i no \providecolor: cada fitxer pot portar uns altres colors. */
  const colorsTex = sol => colorsDe(sol).map((c, i) => `\\definecolor{destaca${i + 1}}{HTML}{${c.hex}}`).join('')
    + '% «destaca»: cal xcolor (headers.tex)\n';

  /** La segona línia del comentari: les opcions del full. */
  function descripcio(p, m) {
    const conj = p.set === 'N' ? 'N' : `${p.set}(${[p.int && 'int', p.fin && 'fin'].filter(Boolean).join(',')})`;
    const opts = ['div', 'pot', 'par', 'opo', 'vs', 'grad'].filter(k => p[k]).map(k => k === 'grad' ? 'gradual' : k).join(' ');
    return `% llavor=${m.seed} · n=${p.n} · espai=${p.esp} · simbols=${p.sim} · conjunt=${conj}${opts ? ' · ' + opts : ''}`;
  }

  /** El principi de la llista: números en negreta i l'espai entre símbols. */
  function principiLlista(p) {
    return '\\begin{enumerate}\n'
      + '\\renewcommand{\\labelenumi}{\\textbf{\\arabic{enumi})}}\n'
      + '\\setlength{\\itemsep}{0pt}\n'
      + `\\medmuskip=${SIMBOLS[p.sim].med}\\thickmuskip=${SIMBOLS[p.sim].thick}\n`;
  }

  /** Un exercici resolt: l'enunciat a l'\item i, a sota, una línia per pas.
      flalign* (amsmath) i no align*: align* centrava les línies al mig del
      full, lluny de l'enunciat; així comencen just a sota. Amb sol.cen
      («centrat»), un array que té l'enunciat a la primera fila. */
  function itemResolt(arbre, sol) {
    if (+sol.cen) return `\\item $${centrada(arbre, sol).tex}$\n`;
    const r = resolucio(arbre, sol);
    return `\\item $\\displaystyle ${r.tex[0]}$\n\\begin{flalign*}\n`
      + r.tex.slice(1).map(l => `&= ${l} &&`).join('\\\\\n') + '\n\\end{flalign*}\n';
  }

  function fitxerTex(exs, p, m, sol) {
    const resolts = sol && sol.mode === 'guiades'
      ? new Set((sol.resolts || []).filter(i => i >= 0 && i < exs.length)) : new Set();
    const vs = `\\par\\vspace${p.vs ? '*' : ''}`;
    let s = `% ex${m.num}.tex — generat per «Operacions combinades 1r ESO» ${VERSIO}\n`
      + descripcio(p, m)
      + (resolts.size ? ` · resolts: ${[...resolts].sort((a, b) => a - b).map(i => i + 1).join(', ')}` : '') + '\n'
      + (m.adreca ? `% per refer aquest full: index.html${m.adreca}\n` : '')
      + (resolts.size && +sol.dest ? colorsTex(sol) : '')
      + principiLlista(p)
      + (resolts.size ? '\\allowdisplaybreaks\n' : '');      // una resolució llarga pot partir de pàgina
    exs.forEach((e, i) => {
      // Un exercici resolt no necessita espai per escriure-hi: el petit.
      if (resolts.has(i)) s += itemResolt(e.arbre, sol) + `${vs}{${ESPAIS.petit}}\n`;
      else s += `\\item $\\displaystyle ${e.tex}$\n${vs}{${ESPAIS[p.esp]}}\n`;
    });
    return s + '\\end{enumerate}\n';
  }

  /** exN-sol.tex: tots els exercicis resolts (o, amb sol.nomes, el resultat), amb la mateixa numeració. */
  function fitxerSolucionari(exs, p, m, sol) {
    sol = sol || {};
    let s = `% ex${m.num}-sol.tex — solucionari de ex${m.num}.tex — generat per «Operacions combinades 1r ESO» ${VERSIO}\n`
      + descripcio(p, m) + '\n'
      + (m.adreca ? `% per refer aquest full: index.html${m.adreca}\n` : '')
      + (+sol.dest && !+sol.nomes ? colorsTex(sol) : '')
      + '\\noindent\\textbf{Solucions}\\par\\medskip\n'
      + principiLlista(p)
      + '\\allowdisplaybreaks\n';
    exs.forEach(e => {
      if (+sol.nomes) {
        const r = resolucio(e.arbre, Object.assign({}, sol, { dest: 0 }));
        s += `\\item $\\displaystyle ${e.tex}=${r.tex[r.tex.length - 1]}$\n\\par\\medskip\n`;
      } else s += itemResolt(e.arbre, sol) + `\\par\\vspace{${ESPAIS.petit}}\n`;
    });
    return s + '\\end{enumerate}\n';
  }

  const M = { VERSIO, GENERADOR, ESPAIS, SIMBOLS, COLORS, COLORS_PER_DEFECTE, EXTRES, atzar, valida, opcions, exercici, passos, resolucio, centrada,
    fitxerTex, fitxerSolucionari };
  if (typeof module !== 'undefined') module.exports = M;
  return M;
})();
