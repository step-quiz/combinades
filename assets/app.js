/* ===========================================================================
   app.js — La interfície: llegeix els controls, pinta el full i respon als
   clics. Tota la lògica dels exercicis és a motor.js; aquí només hi ha DOM.

   Dues activitats (S.act): «Operacions combinades» (comb, motor.js) i
   «Completa la igualtat» (igu, igualtats.js). L'estat és S (el que diuen els
   controls), més la llavor del full (seed), la versió del generador amb què
   s'ha fet (g; ig a «Completa la igualtat»), quants cops s'ha premut ↻ a cada
   exercici (R; RI a «Completa la igualtat») i, en mode «guiades», quins
   exercicis surten resolts (RES).
   Tot plegat va a l'adreça (#n=5&…&seed=…&g=2&r=0,1,0&res=0): l'enllaç desat
   torna a donar el mateix full, i el .tex el porta escrit al principi. Els
   controls (sense la llavor) es desen també al navegador: la pròxima vegada
   l'eina s'obre com la vas deixar.
   =========================================================================== */
(function () {
  'use strict';

  const PER_DEFECTE = {
    act: 'comb',                                                            // l'activitat
    n: 5, esp: 'mitja', sim: 'petit', set: 'N', int: 1, fin: 1, div: 0, opo: 0, pot: 0, par: 0, forca: 1, fit: 1, vs: 0, grad: 0,
    sol: 'cap', gra: 'prio', simp: 1, dest: 0, nomes: 0, cen: 0,            // les solucions
    in: 9, inom: 3, ipar: 1, ipot: 1, iarr: 1, idiv: 1, iesp: 'mitja', isol: 'cap'   // «Completa la igualtat»
  };
  const CASELLES = ['int', 'fin', 'div', 'opo', 'pot', 'par', 'forca', 'vs', 'simp', 'dest', 'nomes', 'cen', 'ipar', 'ipot', 'iarr', 'idiv'];
  const NOM_EXTRE = { div: '÷', par: '( )', pot: 'xⁿ', opo: '−a' };
  const MEMORIA = 'combinades';                               // la clau de localStorage
  const $ = id => document.getElementById(id);
  const novaLlavor = () => Math.random().toString(36).slice(2, 8);
  const teClau = (obj, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(obj, k);

  let S = Object.assign({}, PER_DEFECTE), seed = novaLlavor(), g = Motor.GENERADOR, R = [], RES = [], EX = [];
  let ig = Igualtats.GENERADOR, RI = [];                       // «Completa la igualtat»
  // L'últim exN.tex baixat: el seu solucionari ha de portar el mateix número,
  // encara que després de baixar-lo el «Fitxer núm.» ja hagi passat al següent.
  let fullBaixat = null;

  /* ------------------------------------------------- llegir i desar l'estat
     Una adreça pot arribar retallada, editada a mà o d'una versió anterior:
     el que no s'entén es queda amb el valor per defecte. Mai no pot deixar a
     l'estat un valor que després trenqui el .tex (abans, #esp=constructor
     escrivia «\vspace{function Object() …}»). */
  function llegeix() {
    let q = {};
    try { Object.assign(q, JSON.parse(localStorage.getItem(MEMORIA) || '{}')); } catch (e) { /* sense memòria */ }
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.toString()) { q = {}; h.forEach((v, k) => { q[k] = v; }); }
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
    S.act = llista(q.act, ['comb', 'igu']);
    S.in = enter(q.in, 3, 15, PER_DEFECTE.in);
    S.inom = enter(q.inom, 3, 4, PER_DEFECTE.inom);
    S.iesp = teClau(Igualtats.ESPAIS, q.iesp) ? q.iesp : PER_DEFECTE.iesp;
    S.isol = llista(q.isol, ['cap', 'solucionari']);
    if (q.seed && /^[a-z0-9]{1,12}$/.test(q.seed)) {
      seed = q.seed;
      // Un full desat es refà amb el seu generador. Sense g, és de la v0.1: g=1.
      g = Math.min(Motor.GENERADOR, enter(q.g, 1, 99, 1));
      ig = Math.min(Igualtats.GENERADOR, enter(q.ig, 1, 99, 1));
    }
    R = (q.r ? String(q.r).split(',') : []).map(x => parseInt(x, 10) || 0);
    RI = (q.ri ? String(q.ri).split(',') : []).map(x => parseInt(x, 10) || 0);
    RES = (q.res ? String(q.res).split(',') : []).map(x => parseInt(x, 10)).filter(i => i >= 0 && i < 10);
  }

  /** L'adreça d'aquest full (#…). Les comes de r, ri i res, sense codificar: es llegeix millor. */
  function adreca() {
    const q = Object.assign({}, S, { seed, g, r: R.join(','), res: RES.join(','), ig, ri: RI.join(',') });
    return '#' + new URLSearchParams(q).toString().replace(/%2C/g, ',');
  }

  /** Què fa que el full sigui aquest: els exercicis (no la numeració ni les solucions). */
  const firma = () => JSON.stringify(S.act === 'igu'
    ? ['igu', seed, ig, RI, S.in, S.inom, S.ipar, S.ipot, S.iarr, S.idiv]
    : [seed, g, R, S.n, S.set, S.int, S.fin, S.div, S.opo, S.pot, S.par, S.forca, S.grad]);

  /** Les opcions de «Completa la igualtat», per a igualtats.js. */
  const opcionsIgualtats = () => ({ n: S.in, nombres: S.inom, par: S.ipar, pot: S.ipot, arr: S.iarr, div: S.idiv, esp: S.iesp });

  function desa() {
    try { history.replaceState(null, '', adreca()); } catch (e) { /* l'eina segueix igual */ }
    try { localStorage.setItem(MEMORIA, JSON.stringify(S)); } catch (e) { /* sense memòria */ }
  }

  /* ------------------------------------------------------- baixar el .tex */
  function baixa(nom, text) {
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })),
      download: nom
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------------------------------------------------------------- pintar */

  const marca = (atribut, valor) => document.querySelectorAll(`[data-${atribut}]`)
    .forEach(b => b.setAttribute('aria-pressed', String(b.dataset[atribut] === String(valor))));
  const mostra = (id, si) => { $(id).style.display = si ? '' : 'none'; };

  /** Les opcions de les solucions, per al motor. */
  const solucions = () => ({ mode: S.sol, resolts: RES, gra: S.gra, simp: S.simp, dest: S.dest, nomes: S.nomes, cen: S.cen });

  /** Les línies «= …» d'una resolució (sense l'enunciat). */
  const linies = r => r.html.slice(1).map(l => `<div class="linia">= ${l}</div>`).join('');

  /** Una targeta del full: l'enunciat i, segons el mode, la resolució. A «guiades», els
      exercicis triats surten resolts; al solucionari, tots (com a exN-sol.tex). */
  function carta(e, i) {
    const guiades = S.sol === 'guiades', solucionari = S.sol === 'solucionari', triat = guiades && RES.includes(i);
    const resolt = triat || solucionari;
    const nom = k => k === 'par' && e.params.parentesis > 1 ? `${NOM_EXTRE.par}×${e.params.parentesis}` : NOM_EXTRE[k];
    const extres = S.grad && e.params
      ? `<span class="ext">${Motor.EXTRES.filter(k => e.params[k]).map(nom).join(' · ') || 'sense extres'}</span>` : '';
    let h = `<div class="carta${resolt ? ' resolt' : ''}"><div class="cap"><span class="num">${i + 1}</span>`
      + `<button data-r="${i}" title="Un altre" aria-label="Un altre exercici ${i + 1}">↻</button>${extres}`
      + (guiades ? `<label class="res"><input type="checkbox" data-res="${i}"${triat ? ' checked' : ''}> resolt</label>` : '')
      + `<small>${seed}:${i}:${R[i]}</small></div>`;
    if (e.error) return h + `<p class="err">${e.error}</p></div>`;
    const op = solucions(), r = Motor.resolucio(e.arbre, op);
    // «Centrat»: una taula que ja comença amb l'enunciat. Si no, l'enunciat i, a sota, les línies «= …».
    const passos = S.cen ? `<div class="taula">${Motor.centrada(e.arbre, op).html}</div>` : linies(r);
    h += '<div class="cos">';
    if (solucionari && S.nomes) h += `<div class="math">${e.html}<span class="op">=</span>${r.html[r.html.length - 1]}</div>`;
    else if (resolt) h += `${S.cen ? '' : `<div class="math">${r.html[0]}</div>`}<div class="passos">${passos}</div>`;
    else h += `<div class="math">${e.html}</div><details class="veure"><summary>Veure els passos</summary><div class="passos">${passos}</div></details>`;
    return h + '</div></div>';
  }

  /** «Completa la igualtat»: una targeta amb els nombres, els buits i el resultat, i la solució
      (al solucionari, a la vista; si no, a «Veure la solució»). */
  function cartaIgualtat(x, i) {
    let h = `<div class="carta igualtat"><div class="cap"><span class="num">${i + 1}</span>`
      + `<button data-ri="${i}" title="Una altra" aria-label="Una altra igualtat ${i + 1}">↻</button>`
      + `<small>${seed}:${i}:${RI[i]}</small></div>`;
    if (x.error) return h + `<p class="err">${x.error}</p></div>`;
    const sol = `<div class="linia">${Igualtats.solucioHtml(x)}</div>`;
    h += `<div class="cos"><div class="math">${Igualtats.perCompletarHtml(x)}</div>`;
    h += S.isol === 'solucionari' ? `<div class="passos">${sol}</div>` : `<details class="veure"><summary>Veure la solució</summary><div class="passos">${sol}</div></details>`;
    return h + '</div></div>';
  }

  /** El full de «Completa la igualtat»: l'enunciat, l'exemple i les igualtats. */
  function pintaIgualtats() {
    while (RI.length < S.in) RI.push(0);
    RI.length = S.in;
    const f = Igualtats.full(opcionsIgualtats(), `ig:${seed}`, RI), ex = f.exemple;
    let h = `<p class="enunciat">${Igualtats.enunciatHtml(f.p)}</p>`;
    if (!ex.error) {
      h += `<p class="exemple"><i>Exemple:</i> <span class="ombra">${ex.ns.join('<span class="buit"></span>')}<span class="buit"></span>= ${ex.t}</span>`
        + ` → ${Igualtats.solucioHtml(ex)}</p>`;
    }
    // Les mateixes columnes que al .tex: 3 o, si no hi caben (4 nombres i molt d'espai), 2
    h += `<div class="igualtats" style="--cols:${Igualtats.columnes(f.p)}">${f.items.map(cartaIgualtat).join('')}</div>`;
    return { h, f, ok: f.items.every(x => !x.error) };
  }

  function pinta() {
    if (S.set === 'N') S.opo = 0;               // l'oposat necessita ℤ o ℚ
    if (!S.int && !S.fin) S.int = 1;
    while (R.length < S.n) R.push(0);
    R.length = S.n;
    RES = RES.filter((i, k) => i < S.n && RES.indexOf(i) === k).sort((a, b) => a - b);

    // Els controls
    marca('act', S.act);
    mostra('op-comb', S.act === 'comb');
    mostra('op-igu', S.act === 'igu');
    $('in').value = S.in;
    marca('inom', S.inom); marca('iesp', S.iesp); marca('isol', S.isol);
    $('n').value = S.n;
    $('fit').value = S.fit;
    marca('esp', S.esp); marca('sim', S.sim); marca('set', S.set); marca('grad', S.grad);
    marca('sol', S.sol); marca('gra', S.gra);
    CASELLES.forEach(k => { $(k).checked = !!S[k]; });
    $('onviuen').style.display = S.set === 'N' ? 'none' : '';
    $('opo').disabled = S.set === 'N';
    $('opo').parentNode.title = S.set === 'N' ? "L'oposat necessita ℤ o ℚ" : '';
    mostra('opsol', S.sol !== 'cap');
    mostra('primers', S.sol === 'guiades');
    mostra('nomes-l', S.sol === 'solucionari');

    // El full
    const full = $('full'), deAquest = fullBaixat && fullBaixat.firma === firma();
    const numSol = deAquest ? fullBaixat.num : S.fit, mSol = { num: numSol, seed, adreca: deAquest ? fullBaixat.adreca : adreca() };
    let ok, solucionari;
    if (S.act === 'igu') {
      const r = pintaIgualtats(), m = { num: S.fit, seed, adreca: adreca(), versio: Motor.VERSIO };
      full.innerHTML = r.h;
      full.style.setProperty('--buit', `${Igualtats.ESPAIS[S.iesp].buit}mm`);
      ok = r.ok;
      solucionari = S.isol === 'solucionari';
      $('codi').textContent = ok ? Igualtats.fitxerTex(r.f, m) : '';
      $('codi-sol').textContent = ok && solucionari ? Igualtats.fitxerSolucionari(r.f, Object.assign({}, mSol, { versio: Motor.VERSIO })) : '';
      $('recompte').textContent = `${S.in} igualtats · ${S.inom} nombres · espai ${S.iesp}${solucionari ? ' · solucionari' : ''}`;
    } else {
      const P = Object.assign({}, S, { g });          // les opcions per al motor
      const v = Motor.valida(P);
      let h = '';
      EX = [];
      if (!v.ok) h = `<p class="err">${v.motiu}</p>`;
      else {
        const anteriors = new Set();
        for (let i = 0; i < S.n; i++) {
          const e = Motor.exercici(P, seed, i, R[i], anteriors);
          h += carta(e, i);
          if (!e.error) { anteriors.add(e.tex); EX.push(e); }
        }
      }
      full.innerHTML = h;
      full.style.setProperty('--sop', Motor.SIMBOLS[S.sim].css);
      ok = v.ok && EX.length === S.n;
      solucionari = S.sol === 'solucionari';
      $('codi').textContent = ok ? Motor.fitxerTex(EX, P, { num: S.fit, seed, adreca: adreca() }, solucions()) : '';
      $('codi-sol').textContent = ok && solucionari ? Motor.fitxerSolucionari(EX, P, mSol, solucions()) : '';
      $('recompte').textContent = `${S.n} operacions · espai ${S.esp} · símbols ${S.sim} · ${S.set}${S.grad ? ' · gradual' : ''}`
        + (S.sol === 'cap' ? '' : ` · ${S.sol}`);
    }

    // La barra de baix
    $('baixa').textContent = `Baixa ex${S.fit}.tex`;
    $('baixa-sol').textContent = `Baixa ex${numSol}-sol.tex`;
    $('baixa').disabled = $('baixa-sol').disabled = !ok;
    mostra('baixa-sol', solucionari); mostra('codi-sol-d', solucionari);
    $('segell').textContent = Motor.VERSIO;
    desa();
  }

  /* ---------------------------------------------------------- esdeveniments */
  document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act) S.act = b.dataset.act;
    else if (b.dataset.inom) S.inom = +b.dataset.inom;
    else if (b.dataset.iesp) S.iesp = b.dataset.iesp;
    else if (b.dataset.isol) S.isol = b.dataset.isol;
    else if (b.dataset.ri !== undefined) RI[+b.dataset.ri]++;
    else if (b.dataset.esp) S.esp = b.dataset.esp;
    else if (b.dataset.set) S.set = b.dataset.set;
    else if (b.dataset.sim) S.sim = b.dataset.sim;
    else if (b.dataset.grad !== undefined) S.grad = +b.dataset.grad;
    else if (b.dataset.sol) S.sol = b.dataset.sol;
    else if (b.dataset.gra) S.gra = b.dataset.gra;
    else if (b.dataset.k !== undefined) RES = Array.from({ length: +b.dataset.k }, (_, i) => i);
    else if (b.dataset.r !== undefined) R[+b.dataset.r]++;
    else if (b.id === 'tot') { seed = novaLlavor(); g = Motor.GENERADOR; ig = Igualtats.GENERADOR; R = []; RI = []; }
    else if (b.id === 'baixa') {
      baixa(`ex${S.fit}.tex`, $('codi').textContent);
      fullBaixat = { firma: firma(), num: S.fit, adreca: adreca() };
      S.fit = Math.min(99, S.fit + 1);
    }
    else if (b.id === 'baixa-sol') { baixa($('baixa-sol').textContent.replace(/^Baixa /, ''), $('codi-sol').textContent); return; }
    else if (b.dataset.entorn) { baixa(b.dataset.entorn + '.tex', Entorn[b.dataset.entorn]); return; }
    else return;
    pinta();
  });

  document.addEventListener('change', e => {
    const t = e.target, v = parseInt(t.value, 10);
    if (t.id === 'n') S.n = isNaN(v) ? PER_DEFECTE.n : Math.max(1, Math.min(10, v));
    else if (t.id === 'in') S.in = isNaN(v) ? PER_DEFECTE.in : Math.max(3, Math.min(15, v));
    else if (t.id === 'fit') S.fit = isNaN(v) ? 1 : Math.max(1, Math.min(99, v));
    else if (t.dataset.res !== undefined) {                 // la casella «resolt» d'una targeta
      const i = +t.dataset.res;
      RES = t.checked ? RES.concat(i) : RES.filter(x => x !== i);
    } else if (CASELLES.includes(t.id)) {
      S[t.id] = t.checked ? 1 : 0;
      // «intermedis» i «resultat final» no poden quedar tots dos desmarcats
      if (t.id === 'int' && !S.int && !S.fin) S.fin = 1;
      if (t.id === 'fin' && !S.fin && !S.int) S.int = 1;
    } else return;
    pinta();
  });

  // Un enllaç desat obert a la mateixa pestanya només canvia el # i la pàgina
  // no es recarrega: sense això, s'hi quedava el full d'abans (i el següent
  // clic sobreescrivia l'enllaç).
  window.addEventListener('hashchange', () => { llegeix(); pinta(); });

  llegeix();
  pinta();
})();
