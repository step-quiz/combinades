/* ===========================================================================
   app.js — La interfície: llegeix els controls, pinta el full i respon als
   clics. Tota la lògica dels exercicis és a motor.js; aquí només hi ha DOM.

   Dues activitats (S.act): «Operacions combinades» (comb, motor.js) i
   «Completa la igualtat» (igu, igualtats.js). L'estat és S (el que diuen els
   controls), més la llavor del full (seed), la versió del generador amb què
   s'ha fet (g; ig a «Completa la igualtat»), quants cops s'ha premut ↻ a cada
   exercici (R; RI a «Completa la igualtat») i, en mode «guiades», quins
   exercicis surten resolts (RES). Amb «destaca», els dos colors que s'alternen
   (c1 i c2, claus de Motor.COLORS).
   Tot plegat va a l'adreça (#n=5&…&seed=…&g=2&r=0,1,0&res=0): l'enllaç desat
   torna a donar el mateix full, i el .tex el porta escrit al principi. Els
   controls (sense la llavor) es desen també al navegador: la pròxima vegada
   l'eina s'obre com la vas deixar.
   =========================================================================== */
(function () {
  'use strict';

  const PER_DEFECTE = Comu.PER_DEFECTE, CASELLES = Comu.CASELLES;
  const teClau = (obj, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(obj, k);
  const NOM_EXTRE = { div: '÷', par: '( )', pot: 'xⁿ', opo: '−a' };
  const MEMORIA = 'combinades';                               // la clau de localStorage
  const $ = id => document.getElementById(id);
  const novaLlavor = () => Math.random().toString(36).slice(2, 8);

  let S = Object.assign({}, PER_DEFECTE), seed = novaLlavor(), g = Motor.GENERADOR, R = [], RES = [], EX = [];
  let ig = Igualtats.GENERADOR, RI = [];                       // «Completa la igualtat»
  // L'últim exN.tex baixat: el seu solucionari ha de portar el mateix número,
  // encara que després de baixar-lo el «Fitxer núm.» ja hagi passat al següent.
  let fullBaixat = null;

  /* ------------------------------------------------- llegir i desar l'estat
     L'adreça (#…) mana; sense, els controls desats al navegador (comu.js). */
  function llegeix() {
    let q = {};
    try { Object.assign(q, JSON.parse(localStorage.getItem(MEMORIA) || '{}')); } catch (e) { /* sense memòria */ }
    if (location.hash.length > 1) q = Comu.deLAdreca(location.hash);
    const e = Comu.llegeix(q);
    S = e.S;
    if (e.seed) ({ seed, g, ig } = e);
    ({ R, RI, RES } = e);
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
  const solucions = () => Comu.solucions(S, RES);

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
    // «Només el resultat»: sense colors, com a exN-sol.tex
    const op = solucions(), r = Motor.resolucio(e.arbre, solucionari && S.nomes ? Object.assign({}, op, { dest: 0 }) : op);
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
    // Com al .tex: en dues columnes, separades per una línia discontínua (style.css)
    h += `<div class="igualtats">${f.items.map(cartaIgualtat).join('')}</div>`;
    return { h, f, ok: f.items.every(x => !x.error) };
  }

  /* -------------------------------------------------------------- el panell
     Tres passos (Exercicis, Aspecte del full, Solucions), cadascun dins d'un
     <details>: plegat, en diu el resum. Les opcions que depenen d'una altra
     només surten quan serveixen, i els textos d'ajuda diuen què fa la tria. */
  const SET = { N: 'ℕ', Z: 'ℤ', Q: 'ℚ' };
  const ESPAI = { petit: 'petit', mitja: 'mitjà', gran: 'gran' };
  /** Quants exercicis del principi hi ha resolts (RES = 0…k−1), o −1 si és una altra tria. */
  const primers = () => (RES.length && RES.every((x, i) => x === i) ? RES.length : -1);
  /** Quin dels dos colors de «destaca» es tria a la paleta (1 o 2), o 0 si és plegada. */
  let tria = 0;

  function pintaPanell() {
    // 1 · Exercicis
    const neg = S.set === 'Z';
    mostra('onviuen', S.set !== 'N');
    $('onviuen-que').textContent = neg ? 'On hi pot haver nombres negatius?' : 'On hi pot haver fraccions (i negatius)?';
    $('forca-que').textContent = neg ? 'que n\'hi hagi sempre algun' : 'que n\'hi hagi sempre alguna';
    $('opo').disabled = S.set === 'N';
    $('opo').parentNode.title = S.set === 'N' ? "L'oposat necessita ℤ o ℚ" : '';
    $('grad-que').textContent = S.grad
      ? 'Els primers exercicis porten poques operacions de les marcades (o cap); els 2 últims, totes.'
      : 'Tots els exercicis porten totes les operacions marcades.';
    const extres = Motor.EXTRES.filter(k => S[k] && !(k === 'opo' && S.set === 'N')).map(k => NOM_EXTRE[k]).join(' ');
    $('resum-ex').textContent = [S.n, SET[S.set], extres || 'només + − ·', S.grad ? 'de fàcil a difícil' : ''].filter(Boolean).join(' · ');
    // 2 · Aspecte del full
    $('resum-asp').textContent = `espai ${ESPAI[S.esp]} · signes: ${ESPAI[S.sim]}`;
    // 3 · Solucions
    mostra('primers', S.sol === 'guiades');
    marca('k', primers());
    mostra('nomes-l', S.sol === 'solucionari');
    mostra('opsol', S.sol !== 'cap' && !(S.sol === 'solucionari' && S.nomes));
    mostra('simp-l', S.set === 'Q');
    // Els colors de «destaca»: un botó per a cadascun i, sota, la paleta del que es tria
    if (!S.dest) tria = 0;
    mostra('colors', S.dest);
    mostra('paleta', tria);
    document.querySelectorAll('[data-tria]').forEach(b => {
      const k = +b.dataset.tria, c = Motor.COLORS[S['c' + k]];
      b.firstChild.style.background = '#' + c.hex;
      b.title = `${k === 1 ? '1r' : '2n'} color: ${c.nom}`;
      b.setAttribute('aria-label', b.title);
      b.setAttribute('aria-expanded', String(k === tria));
    });
    marca('color', tria ? S['c' + tria] : '');
    $('gra-que').innerHTML = S.gra === 'op'
      ? 'Ex.: 2·3 + 4·5 = 6 + 4·5 = 6 + 20 = 26'
      : 'Ex.: 2·3 + 4·5 = 6 + 20 = 26';
    const com = S.sol === 'cap' || (S.sol === 'solucionari' && S.nomes) ? [] : [S.gra === 'op' ? 'una per línia' : '', S.cen ? 'en columna' : '', S.dest ? 'destacada' : ''];
    const que = { cap: 'cap', guiades: `ajuda parcial: ${RES.length} ${RES.length === 1 ? 'resolt' : 'resolts'}`, solucionari: S.nomes ? 'solucionari, només resultats' : 'solucionari' }[S.sol];
    $('resum-sol').textContent = [que, ...com].filter(Boolean).join(' · ');
    // «Completa la igualtat»
    const simbols = [S.ipar && '( )', S.ipot && '²', S.iarr && '√', S.idiv && ':'].filter(Boolean).join(' ');
    $('resum-iex').textContent = `${S.in} · ${S.inom} nombres · + − · ${simbols}`.trim();
    $('resum-iasp').textContent = `espai ${ESPAI[S.iesp]}`;
    $('resum-isol').textContent = S.isol;
  }

  const ajustaMarcs = () => Comu.ajustaMarcs($('full'));

  /** Quins passos del panell són oberts: es desen al navegador (com els controls). */
  const PASSOS = 'combinades-passos';
  function obrePassos() {
    let oberts = null;
    try { oberts = JSON.parse(localStorage.getItem(PASSOS) || 'null'); } catch (e) { /* sense memòria */ }
    document.querySelectorAll('aside details').forEach(d => {
      if (oberts && teClau(oberts, d.id)) d.open = !!oberts[d.id];
      d.addEventListener('toggle', () => {
        const ara = {};
        document.querySelectorAll('aside details').forEach(x => { ara[x.id] = x.open; });
        try { localStorage.setItem(PASSOS, JSON.stringify(ara)); } catch (e) { /* sense memòria */ }
      });
    });
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
    pintaPanell();

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
      ajustaMarcs();
      Comu.posaColors(full, S);       // els colors de «destaca» (i més clars per al fons fosc)
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
    mostra('pdf', S.act === 'comb'); $('pdf').disabled = !ok;     // els fulls A4, només de les operacions combinades
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
    else if (b.dataset.sol) {
      S.sol = b.dataset.sol;
      // «Ajuda parcial» sense cap exercici triat no canviaria res: en resol el primer
      if (S.sol === 'guiades' && !RES.length) RES = [0];
    }
    else if (b.dataset.gra) S.gra = b.dataset.gra;
    else if (b.dataset.tria) tria = tria === +b.dataset.tria ? 0 : +b.dataset.tria;   // obre (o plega) la paleta
    else if (b.dataset.color) { if (tria) S['c' + tria] = b.dataset.color; tria = 0; }
    else if (b.dataset.k !== undefined) RES = Array.from({ length: +b.dataset.k }, (_, i) => i);
    else if (b.dataset.r !== undefined) R[+b.dataset.r]++;
    else if (b.id === 'tot') { seed = novaLlavor(); g = Motor.GENERADOR; ig = Igualtats.GENERADOR; R = []; RI = []; }
    else if (b.id === 'baixa') {
      baixa(`ex${S.fit}.tex`, $('codi').textContent);
      fullBaixat = { firma: firma(), num: S.fit, adreca: adreca() };
      S.fit = Math.min(99, S.fit + 1);
    }
    else if (b.id === 'baixa-sol') { baixa($('baixa-sol').textContent.replace(/^Baixa /, ''), $('codi-sol').textContent); return; }
    else if (b.id === 'pdf') { window.open('imprimir.html' + adreca(), '_blank'); return; }   // els fulls A4, en una pestanya
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
  // Els marcs de «centrat» es tornen a mesurar si canvia la mida de la lletra o de la finestra, o si s'obre un
  // «Veure els passos» (toggle no puja: es capta en baixar)
  window.addEventListener('resize', ajustaMarcs);
  document.addEventListener('toggle', e => { if (e.target.closest('#full')) ajustaMarcs(); }, true);
  if (document.fonts) document.fonts.ready.then(ajustaMarcs);

  // La paleta dels colors de «destaca»: els de Motor.COLORS
  $('paleta').innerHTML = Object.entries(Motor.COLORS)
    .map(([k, c]) => `<button data-color="${k}" title="${c.nom}" aria-label="${c.nom}" style="--c:#${c.hex}"></button>`).join('');
  obrePassos();
  llegeix();
  pinta();
})();
