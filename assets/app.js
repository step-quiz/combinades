/* ===========================================================================
   app.js — La interfície: llegeix els controls, pinta el full i respon als
   clics. Tota la lògica dels exercicis és a motor.js; aquí només hi ha DOM.

   L'estat és S (el que diuen els controls), més la llavor del full (seed), la
   versió del generador amb què s'ha fet (g), quants cops s'ha premut ↻ a cada
   exercici (R) i, en mode «guiades», quins exercicis surten resolts (RES).
   Tot plegat va a l'adreça (#n=5&…&seed=…&g=2&r=0,1,0&res=0): l'enllaç desat
   torna a donar el mateix full, i el .tex el porta escrit al principi. Els
   controls (sense la llavor) es desen també al navegador: la pròxima vegada
   l'eina s'obre com la vas deixar.
   =========================================================================== */
(function () {
  'use strict';

  const PER_DEFECTE = {
    n: 5, esp: 'mitja', sim: 'petit', set: 'N', int: 1, fin: 1, div: 0, opo: 0, pot: 0, par: 0, forca: 1, fit: 1, vs: 0, grad: 0,
    sol: 'cap', gra: 'prio', simp: 1, dest: 0, nomes: 0, cen: 0             // les solucions
  };
  const CASELLES = ['int', 'fin', 'div', 'opo', 'pot', 'par', 'forca', 'vs', 'simp', 'dest', 'nomes', 'cen'];
  const NOM_EXTRE = { div: '÷', par: '( )', pot: 'xⁿ', opo: '−a' };
  const MEMORIA = 'combinades';                               // la clau de localStorage
  const $ = id => document.getElementById(id);
  const novaLlavor = () => Math.random().toString(36).slice(2, 8);
  const teClau = (obj, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(obj, k);

  let S = Object.assign({}, PER_DEFECTE), seed = novaLlavor(), g = Motor.GENERADOR, R = [], RES = [], EX = [];
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
    if (q.seed && /^[a-z0-9]{1,12}$/.test(q.seed)) {
      seed = q.seed;
      // Un full desat es refà amb el seu generador. Sense g, és de la v0.1: g=1.
      g = Math.min(Motor.GENERADOR, enter(q.g, 1, 99, 1));
    }
    R = (q.r ? String(q.r).split(',') : []).map(x => parseInt(x, 10) || 0);
    RES = (q.res ? String(q.res).split(',') : []).map(x => parseInt(x, 10)).filter(i => i >= 0 && i < 10);
  }

  /** L'adreça d'aquest full (#…). Les comes de r i res, sense codificar: es llegeix millor. */
  function adreca() {
    const q = Object.assign({}, S, { seed, g, r: R.join(','), res: RES.join(',') });
    return '#' + new URLSearchParams(q).toString().replace(/%2C/g, ',');
  }

  /** Què fa que el full sigui aquest: els exercicis (no la numeració ni les solucions). */
  const firma = () => JSON.stringify([seed, g, R, S.n, S.set, S.int, S.fin, S.div, S.opo, S.pot, S.par, S.forca, S.grad]);

  function desa() {
    try { history.replaceState(null, '', adreca()); } catch (e) { /* l'eina segueix igual */ }
    try { localStorage.setItem(MEMORIA, JSON.stringify(S)); } catch (e) { /* sense memòria */ }
  }

  /* ---------------------------------------------- baixar i copiar el .tex */
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

  function copia(boto) {
    const text = $('codi').textContent;
    const fet = () => { boto.textContent = 'Copiat ✓'; setTimeout(() => { boto.textContent = 'Copia el TeX'; }, 1500); };
    const ambTextarea = () => {          // sense l'API del porta-retalls (p. ex. alguns file://)
      const t = document.createElement('textarea');
      t.value = text;
      document.body.appendChild(t);
      t.select();
      try { document.execCommand('copy'); fet(); } catch (x) { /* res */ }
      t.remove();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(fet, ambTextarea);
    else ambTextarea();
  }

  /* ---------------------------------------------------------------- pintar */

  /* A paper hi caben unes AMPLE_PAPER px de fórmula: l'A4 menys els marges de
     @page (174 mm ≈ 658 px) i menys el número de l'exercici, amb marge. Una
     fórmula més ampla (passa amb «símbols gran» i ℚ) s'encongeix a la
     impressió, només ella i només el que cal: abans es partia en dues línies.
     La mida de la lletra és la mateixa a la pantalla i al paper, o sigui que
     l'amplada es pot mesurar aquí. */
  const AMPLE_PAPER = 600;
  function encaixaAlPaper(full) {
    // La resolució del «PDF solucions» no es veu a la pantalla: per mesurar-la, es mostra un moment.
    document.body.classList.add('mesura');
    full.querySelectorAll('.math, .linia, table.centrat').forEach(m => {
      const r = document.createRange();
      r.selectNodeContents(m);
      const ample = r.getBoundingClientRect().width;
      if (ample > AMPLE_PAPER) m.style.setProperty('--encaix', (AMPLE_PAPER / ample).toFixed(3));
    });
    document.body.classList.remove('mesura');
  }

  const marca = (atribut, valor) => document.querySelectorAll(`[data-${atribut}]`)
    .forEach(b => b.setAttribute('aria-pressed', String(b.dataset[atribut] === String(valor))));
  const mostra = (id, si) => { $(id).style.display = si ? '' : 'none'; };

  /** Les opcions de les solucions, per al motor. */
  const solucions = () => ({ mode: S.sol, resolts: RES, gra: S.gra, simp: S.simp, dest: S.dest, nomes: S.nomes, cen: S.cen });

  /** Les línies «= …» d'una resolució (sense l'enunciat). */
  const linies = r => r.html.slice(1).map(l => `<div class="linia">= ${l}</div>`).join('');

  /** Una targeta del full: l'enunciat i, segons el mode, la resolució. */
  function carta(e, i) {
    const guiades = S.sol === 'guiades', resolt = guiades && RES.includes(i);
    // «Centrat»: la resolució és una taula que comença amb l'enunciat (també la del «PDF solucions»,
    // si no és «només els resultats»: llavors, a la impressió, la taula substitueix l'enunciat)
    const taula = S.cen && !(S.sol === 'solucionari' && S.nomes);
    const nom = k => k === 'par' && e.params.parentesis > 1 ? `${NOM_EXTRE.par}×${e.params.parentesis}` : NOM_EXTRE[k];
    const extres = S.grad && e.params
      ? `<span class="ext">${Motor.EXTRES.filter(k => e.params[k]).map(nom).join(' · ') || 'sense extres'}</span>` : '';
    let h = `<div class="carta${resolt ? ' resolt' : ''}${taula ? ' centrat' : ''}"><div class="cap"><span class="num">${i + 1}</span>`
      + `<button data-r="${i}" title="Un altre" aria-label="Un altre exercici ${i + 1}">↻</button>${extres}`
      + (guiades ? `<label class="res"><input type="checkbox" data-res="${i}"${resolt ? ' checked' : ''}> resolt</label>` : '')
      + `<small>${seed}:${i}:${R[i]}</small></div>`;
    if (e.error) return h + `<p class="err">${e.error}</p></div>`;
    const op = solucions(), r = Motor.resolucio(e.arbre, op);
    const passos = S.cen ? `<div class="taula">${Motor.centrada(e.arbre, op).html}</div>` : linies(r);
    h += '<div class="cos">';
    if (!(resolt && S.cen)) h += `<div class="math">${resolt ? r.html[0] : e.html}</div>`;   // centrat: ja és a la taula
    // Resolt (guiades): la resolució surt al full i s'imprimeix. Si no, es pot mirar, però no s'imprimeix.
    if (resolt) h += `<div class="passos">${passos}</div>`;
    else h += `<details class="veure"><summary>Veure els passos</summary><div class="passos">${passos}</div></details>`;
    // Solucionari: el que surt al «PDF solucions»
    if (S.sol === 'solucionari') {
      h += `<div class="passos sol-imp">${+S.nomes ? `<div class="linia">= ${r.html[r.html.length - 1]}</div>` : passos}</div>`;
    }
    return h + '</div></div>';
  }

  function pinta() {
    if (S.set === 'N') S.opo = 0;               // l'oposat necessita ℤ o ℚ
    if (!S.int && !S.fin) S.int = 1;
    while (R.length < S.n) R.push(0);
    R.length = S.n;
    RES = RES.filter((i, k) => i < S.n && RES.indexOf(i) === k).sort((a, b) => a - b);

    // Els controls
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
    // Amb «centrat», cada resultat ja surt sota el que substitueix: «destaca» no hi té sentit
    $('dest').disabled = !!S.cen;
    $('dest').parentNode.title = S.cen ? 'Amb «centrat», cada resultat ja surt sota el que substitueix' : '';

    // El full
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
    const full = $('full');
    full.innerHTML = h;
    full.style.setProperty('--esp', Motor.ESPAIS[S.esp]);
    full.style.setProperty('--sop', Motor.SIMBOLS[S.sim].css);
    encaixaAlPaper(full);

    // Els .tex i la barra de baix
    const ok = v.ok && EX.length === S.n, solucionari = S.sol === 'solucionari';
    $('codi').textContent = ok ? Motor.fitxerTex(EX, P, { num: S.fit, seed, adreca: adreca() }, solucions()) : '';
    const deAquest = fullBaixat && fullBaixat.firma === firma();
    const numSol = deAquest ? fullBaixat.num : S.fit;
    $('codi-sol').textContent = ok && solucionari
      ? Motor.fitxerSolucionari(EX, P, { num: numSol, seed, adreca: deAquest ? fullBaixat.adreca : adreca() }, solucions()) : '';
    $('baixa').textContent = `Baixa ex${S.fit}.tex`;
    $('baixa-sol').textContent = `Baixa ex${numSol}-sol.tex`;
    $('baixa').disabled = $('baixa-sol').disabled = $('copia').disabled = $('pdf').disabled = $('pdf-sol').disabled = !ok;
    mostra('baixa-sol', solucionari); mostra('pdf-sol', solucionari); mostra('codi-sol-d', solucionari);
    $('recompte').textContent = `${S.n} operacions · espai ${S.esp} · símbols ${S.sim} · ${S.set}${S.grad ? ' · gradual' : ''}`
      + (S.sol === 'cap' ? '' : ` · ${S.sol}`);
    $('segell').textContent = Motor.VERSIO;
    desa();
  }

  /* ---------------------------------------------------------- esdeveniments */
  document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.esp) S.esp = b.dataset.esp;
    else if (b.dataset.set) S.set = b.dataset.set;
    else if (b.dataset.sim) S.sim = b.dataset.sim;
    else if (b.dataset.grad !== undefined) S.grad = +b.dataset.grad;
    else if (b.dataset.sol) S.sol = b.dataset.sol;
    else if (b.dataset.gra) S.gra = b.dataset.gra;
    else if (b.dataset.k !== undefined) RES = Array.from({ length: +b.dataset.k }, (_, i) => i);
    else if (b.dataset.r !== undefined) R[+b.dataset.r]++;
    else if (b.id === 'tot') { seed = novaLlavor(); g = Motor.GENERADOR; R = []; }
    else if (b.id === 'pdf') { window.print(); return; }
    else if (b.id === 'pdf-sol') {
      // El mateix full, però amb les solucions: el CSS d'impressió mira aquesta classe.
      document.body.classList.add('imprimeix-solucions');
      window.print();
      return;
    }
    else if (b.id === 'copia') { copia(b); return; }
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

  window.addEventListener('afterprint', () => document.body.classList.remove('imprimeix-solucions'));

  // Un enllaç desat obert a la mateixa pestanya només canvia el # i la pàgina
  // no es recarrega: sense això, s'hi quedava el full d'abans (i el següent
  // clic sobreescrivia l'enllaç).
  window.addEventListener('hashchange', () => { llegeix(); pinta(); });

  llegeix();
  pinta();
})();
