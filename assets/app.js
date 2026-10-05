/* ===========================================================================
   app.js — La interfície: llegeix els controls, pinta el full i respon als
   clics. Tota la lògica dels exercicis és a motor.js; aquí només hi ha DOM.

   L'estat és S (el que diuen els controls), més la llavor del full (seed), la
   versió del generador amb què s'ha fet (g) i quants cops s'ha premut ↻ a cada
   exercici (R). Tot plegat va a l'adreça (#n=5&…&seed=…&g=2&r=0,1,0): l'enllaç
   desat torna a donar el mateix full, i el .tex el porta escrit al principi. Els controls (sense la llavor) es desen
   també al navegador: la pròxima vegada l'eina s'obre com la vas deixar.
   =========================================================================== */
(function () {
  'use strict';

  const PER_DEFECTE = { n: 5, esp: 'mitja', sim: 'petit', set: 'N', int: 1, fin: 1, div: 0, opo: 0, pot: 0, par: 0, forca: 1, fit: 1, vs: 0, grad: 0 };
  const CASELLES = ['int', 'fin', 'div', 'opo', 'pot', 'par', 'forca', 'vs'];
  const NOM_EXTRE = { div: '÷', par: '( )', pot: 'xⁿ', opo: '−a' };
  const MEMORIA = 'combinades';                               // la clau de localStorage
  const $ = id => document.getElementById(id);
  const novaLlavor = () => Math.random().toString(36).slice(2, 8);
  const teClau = (obj, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(obj, k);

  let S = Object.assign({}, PER_DEFECTE), seed = novaLlavor(), g = Motor.GENERADOR, R = [], EX = [];

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
    S.n = enter(q.n, 1, 10, PER_DEFECTE.n);
    S.fit = enter(q.fit, 1, 99, PER_DEFECTE.fit);
    S.esp = teClau(Motor.ESPAIS, q.esp) ? q.esp : PER_DEFECTE.esp;
    S.sim = teClau(Motor.SIMBOLS, q.sim) ? q.sim : PER_DEFECTE.sim;
    S.set = ['N', 'Z', 'Q'].includes(q.set) ? q.set : PER_DEFECTE.set;
    CASELLES.forEach(k => { S[k] = q[k] === undefined ? PER_DEFECTE[k] : (+q[k] ? 1 : 0); });
    S.grad = +q.grad ? 1 : 0;
    if (q.seed && /^[a-z0-9]{1,12}$/.test(q.seed)) {
      seed = q.seed;
      // Un full desat es refà amb el seu generador. Sense g, és de la v0.1: g=1.
      g = Math.min(Motor.GENERADOR, enter(q.g, 1, 99, 1));
    }
    R = (q.r ? String(q.r).split(',') : []).map(x => parseInt(x, 10) || 0);
  }

  /** L'adreça d'aquest full (#…). Les comes de r, sense codificar: es llegeix millor. */
  function adreca() {
    const q = Object.assign({}, S, { seed, g, r: R.join(',') });
    return '#' + new URLSearchParams(q).toString().replace(/%2C/g, ',');
  }

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
    full.querySelectorAll('.math').forEach(m => {
      const r = document.createRange();
      r.selectNodeContents(m);
      const ample = r.getBoundingClientRect().width;
      if (ample > AMPLE_PAPER) m.style.setProperty('--encaix', (AMPLE_PAPER / ample).toFixed(3));
    });
  }

  const marca =(atribut, valor) => document.querySelectorAll(`[data-${atribut}]`)
    .forEach(b => b.setAttribute('aria-pressed', String(b.dataset[atribut] === String(valor))));

  function pinta() {
    if (S.set === 'N') S.opo = 0;               // l'oposat necessita ℤ o ℚ
    if (!S.int && !S.fin) S.int = 1;
    while (R.length < S.n) R.push(0);
    R.length = S.n;

    // Els controls
    $('n').value = S.n;
    $('fit').value = S.fit;
    marca('esp', S.esp); marca('sim', S.sim); marca('set', S.set); marca('grad', S.grad);
    CASELLES.forEach(k => { $(k).checked = !!S[k]; });
    $('onviuen').style.display = S.set === 'N' ? 'none' : '';
    $('opo').disabled = S.set === 'N';
    $('opo').parentNode.title = S.set === 'N' ? "L'oposat necessita ℤ o ℚ" : '';

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
        const nom = k => k === 'par' && e.params.parentesis > 1 ? `${NOM_EXTRE.par}×${e.params.parentesis}` : NOM_EXTRE[k];
        const extres = S.grad && e.params
          ? `<span class="ext">${Motor.EXTRES.filter(k => e.params[k]).map(nom).join(' · ') || 'sense extres'}</span>`
          : '';
        h += `<div class="carta"><div class="cap"><span class="num">${i + 1}</span>`
          + `<button data-r="${i}" title="Un altre" aria-label="Un altre exercici ${i + 1}">↻</button>${extres}<small>${seed}:${i}:${R[i]}</small></div>`
          + (e.error ? `<p class="err">${e.error}</p>` : `<div class="math">${e.html}</div>`) + '</div>';
        if (!e.error) { anteriors.add(e.tex); EX.push(e); }
      }
    }
    const full = $('full');
    full.innerHTML = h;
    full.style.setProperty('--esp', Motor.ESPAIS[S.esp]);
    full.style.setProperty('--sop', Motor.SIMBOLS[S.sim].css);
    encaixaAlPaper(full);

    // El .tex i la barra de baix
    const ok = v.ok && EX.length === S.n;
    $('codi').textContent = ok ? Motor.fitxerTex(EX, P, { num: S.fit, seed, adreca: adreca() }) : '';
    $('baixa').textContent = `Baixa ex${S.fit}.tex`;
    $('baixa').disabled = $('copia').disabled = $('pdf').disabled = !ok;
    $('recompte').textContent = `${S.n} operacions · espai ${S.esp} · símbols ${S.sim} · ${S.set}${S.grad ? ' · gradual' : ''}`;
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
    else if (b.dataset.r !== undefined) R[+b.dataset.r]++;
    else if (b.id === 'tot') { seed = novaLlavor(); g = Motor.GENERADOR; R = []; }
    else if (b.id === 'pdf') { window.print(); return; }
    else if (b.id === 'copia') { copia(b); return; }
    else if (b.id === 'baixa') { baixa(`ex${S.fit}.tex`, $('codi').textContent); S.fit = Math.min(99, S.fit + 1); }
    else if (b.dataset.entorn) { baixa(b.dataset.entorn + '.tex', Entorn[b.dataset.entorn]); return; }
    else return;
    pinta();
  });

  document.addEventListener('change', e => {
    const t = e.target, v = parseInt(t.value, 10);
    if (t.id === 'n') S.n = isNaN(v) ? PER_DEFECTE.n : Math.max(1, Math.min(10, v));
    else if (t.id === 'fit') S.fit = isNaN(v) ? 1 : Math.max(1, Math.min(99, v));
    else if (CASELLES.includes(t.id)) {
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
