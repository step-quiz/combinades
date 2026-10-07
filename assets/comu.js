/* ===========================================================================
   comu.js — El que fan servir tant l'eina (app.js) com la pàgina dels fulls
   per imprimir (imprimir.js): llegir l'estat d'una adreça (#…) i ajustar els
   marcs de «destaca» amb «centrat» un cop pintada una taula.
   =========================================================================== */
var Comu = (function () {
  'use strict';

  const PER_DEFECTE = {
    act: 'comb',                                                            // l'activitat
    n: 5, esp: 'mitja', sim: 'petit', set: 'N', int: 1, fin: 1, div: 0, opo: 0, pot: 0, par: 0, forca: 1, fit: 1, vs: 0, grad: 0,
    sol: 'cap', gra: 'prio', simp: 1, dest: 0, nomes: 0, cen: 0,            // les solucions
    c1: Motor.COLORS_PER_DEFECTE[0], c2: Motor.COLORS_PER_DEFECTE[1],      // els colors de «destaca»
    in: 9, inom: 3, ipar: 1, ipot: 1, iarr: 1, idiv: 1, iesp: 'mitja', isol: 'cap'   // «Completa la igualtat»
  };
  const CASELLES = ['int', 'fin', 'div', 'opo', 'pot', 'par', 'forca', 'vs', 'simp', 'dest', 'nomes', 'cen', 'ipar', 'ipot', 'iarr', 'idiv'];
  const teClau = (obj, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(obj, k);

  /** L'estat que diu q (els valors d'una adreça o dels desats): {S, seed, g, ig, R, RI, RES}; seed és null si
      q no en porta cap de bona. Una adreça pot arribar retallada, editada a mà o d'una versió anterior: el que
      no s'entén es queda amb el valor per defecte. Mai no pot deixar a l'estat un valor que després trenqui el
      .tex (abans, #esp=constructor escrivia «\vspace{function Object() …}»). */
  function llegeix(q) {
    const S = Object.assign({}, PER_DEFECTE);
    const enter = (v, a, b, d) => { v = parseInt(v, 10); return v >= a && v <= b ? v : d; };
    const llista = (v, opcions) => (opcions.includes(v) ? v : opcions[0]);
    S.n = enter(q.n, 1, 10, PER_DEFECTE.n);
    S.fit = enter(q.fit, 1, 99, PER_DEFECTE.fit);
    S.esp = teClau(Motor.ESPAIS, q.esp) ? q.esp : PER_DEFECTE.esp;
    S.sim = teClau(Motor.SIMBOLS, q.sim) ? q.sim : PER_DEFECTE.sim;
    S.set = ['N', 'Z', 'Q'].includes(q.set) ? q.set : PER_DEFECTE.set;
    CASELLES.forEach(k => { S[k] = q[k] === undefined ? PER_DEFECTE[k] : (+q[k] ? 1 : 0); });
    S.grad = +q.grad ? 1 : 0;
    S.sol = llista(q.sol, ['cap', 'guiades', 'solucionari']);
    S.gra = llista(q.gra, ['prio', 'op']);
    S.c1 = teClau(Motor.COLORS, q.c1) ? q.c1 : PER_DEFECTE.c1;
    S.c2 = teClau(Motor.COLORS, q.c2) ? q.c2 : PER_DEFECTE.c2;
    S.act = llista(q.act, ['comb', 'igu']);
    S.in = enter(q.in, 3, 15, PER_DEFECTE.in);
    S.inom = enter(q.inom, 3, 4, PER_DEFECTE.inom);
    S.iesp = typeof Igualtats !== 'undefined' && teClau(Igualtats.ESPAIS, q.iesp) ? q.iesp : PER_DEFECTE.iesp;
    S.isol = llista(q.isol, ['cap', 'solucionari']);
    const e = { S, seed: null, g: Motor.GENERADOR, ig: typeof Igualtats !== 'undefined' ? Igualtats.GENERADOR : 1 };
    if (q.seed && /^[a-z0-9]{1,12}$/.test(q.seed)) {
      e.seed = q.seed;
      // Un full desat es refà amb el seu generador. Sense g, és de la v0.1: g=1.
      e.g = Math.min(Motor.GENERADOR, enter(q.g, 1, 99, 1));
      e.ig = Math.min(e.ig, enter(q.ig, 1, 99, 1));
    }
    e.R = (q.r ? String(q.r).split(',') : []).map(x => parseInt(x, 10) || 0);
    e.RI = (q.ri ? String(q.ri).split(',') : []).map(x => parseInt(x, 10) || 0);
    e.RES = (q.res ? String(q.res).split(',') : []).map(x => parseInt(x, 10)).filter(i => i >= 0 && i < 10);
    return e;
  }

  /** Els valors d'una adreça (#…), com a objet. */
  function deLAdreca(hash) {
    const q = {};
    new URLSearchParams(String(hash || '').replace(/^#/, '')).forEach((v, k) => { q[k] = v; });
    return q;
  }

  /** Les opcions de les solucions, per al motor. */
  const solucions = (S, RES) => ({ mode: S.sol, resolts: RES, gra: S.gra, simp: S.simp, dest: S.dest, nomes: S.nomes, cen: S.cen, c1: S.c1, c2: S.c2 });

  /** Els colors de «destaca» a l'element el (style.css: .k1, .k2), i més clars per al fons fosc (o, per als fulls
      per imprimir, fosc = 0: els mateixos). */
  function posaColors(el, S, fosc) {
    const clar = hex => '#' + [0, 2, 4].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * .45 + 255 * .55).toString(16).padStart(2, '0')).join('');
    ['c1', 'c2'].forEach((c, i) => {
      const hex = Motor.COLORS[S[c]].hex;
      el.style.setProperty(`--k${i + 1}`, '#' + hex);
      el.style.setProperty(`--k${i + 1}c`, fosc === false ? '#' + hex : clar(hex));
    });
  }

  /** «Destaca» amb «centrat»: el marc d'una caixa va del principi del seu primer tros (ini) al final de l'últim
      (fi), i de dalt a baix del que hi ha a dins, com al .tex. Cada tros és centrat a la seva cel·la: un cop
      pintada la taula, es mesura on és (style.css: --l, --r, --t, --b). Una taula que no es veu (dins d'un «Veure
      els passos» tancat) no es pot mesurar: s'ha de tornar a cridar quan es veu. */
  function ajustaMarcs(arrel) {
    const caixa = r => { const x = document.createRange(); x.selectNodeContents(r); return x.getBoundingClientRect(); };
    arrel.querySelectorAll('table.centrat tr').forEach(tr => {
      let grup = [];
      tr.querySelectorAll('td.marc').forEach(td => {
        grup.push(td);
        if (!td.classList.contains('fi')) return;
        const cs = grup.map(caixa), ts = grup.map(x => x.getBoundingClientRect()), u = grup.length - 1;
        if (ts[0].width) {
          const em = parseFloat(getComputedStyle(td).fontSize), aire = .18 * em;     // el marc, una mica fora
          const dalt = Math.min(...cs.map(c => c.top)) - .1 * em, baix = Math.max(...cs.map(c => c.bottom)) + .1 * em;
          grup.forEach((x, i) => { x.style.setProperty('--t', `${dalt - ts[i].top}px`); x.style.setProperty('--b', `${ts[i].bottom - baix}px`); });
          grup[0].style.setProperty('--l', `${cs[0].left - ts[0].left - aire}px`);
          grup[u].style.setProperty('--r', `${ts[u].right - cs[u].right - aire}px`);
        }
        grup = [];
      });
    });
  }

  return { PER_DEFECTE, CASELLES, llegeix, deLAdreca, solucions, posaColors, ajustaMarcs };
})();
