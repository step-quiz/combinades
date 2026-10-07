/* ===========================================================================
   imprimir.js — Els fulls A4 de les dues activitats per imprimir o desar
   com a PDF (imprimir.html), com els de inaba: el mateix full que l'eina (la
   mateixa adreça, #…), paginat aquí mateix.

   Primer els exercicis: al primer full, la capçalera «Nom, Curs, Data»; cada
   exercici, amb el seu número, l'enunciat (i, si està resolt, la resolució) i,
   a sota, l'espai per resoldre'l (el del .tex: petit, mitjà o gran). Un
   exercici no es parteix mai entre dos fulls: si no hi cap, passa al següent.
   Després, si n'hi ha, el solucionari, en fulls a part. Cada full porta el
   número de pàgina.

   «Completa la igualtat», igual: la capçalera, l'enunciat, l'exemple i les igualtats en dues columnes (com el .tex),
   i el solucionari en fulls a part.
   =========================================================================== */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const e = Comu.llegeix(Comu.deLAdreca(location.hash)), S = e.S, fulls = $('fulls');
  $('torna').href = 'index.html' + location.hash;
  document.querySelectorAll('[data-imprimeix]').forEach(b => b.addEventListener('click', () => window.print()));

  function element(etiqueta, classe, html) {
    const el = document.createElement(etiqueta);
    if (classe) el.className = classe;
    if (html !== undefined) el.innerHTML = html;
    return el;
  }
  const avis = text => {
    fulls.appendChild(element('p', 'avis', text)).style.cssText = 'color:#fff;text-align:center';
    document.body.dataset.llest = '1';
  };

  if (!e.seed) { avis('Obre els fulls per imprimir des de l\'eina, amb el botó «Crea el PDF».'); return; }
  const igu = S.act === 'igu', P = Object.assign({}, S, { g: e.g }), v = igu ? { ok: true } : Motor.valida(P);
  if (!v.ok) { avis(v.motiu); return; }
  const R = e.R.slice(0, S.n), RES = e.RES, EX = [], anteriors = new Set();
  while (!igu && R.length < S.n) R.push(0);
  for (let i = 0; !igu && i < S.n; i++) {
    const x = Motor.exercici(P, e.seed, i, R[i], anteriors);
    if (x.error) { avis(`L'exercici ${i + 1}: ${x.error}`); return; }
    anteriors.add(x.tex);
    EX.push(x);
  }
  // «Completa la igualtat»: el full del motor (el mateix que l'eina)
  let FI = null;
  if (igu) {
    const RI = e.RI.slice(0, S.in);
    while (RI.length < S.in) RI.push(0);
    FI = Igualtats.full({ n: S.in, nombres: S.inom, par: S.ipar, pot: S.ipot, arr: S.iarr, div: S.idiv, esp: S.iesp }, `ig:${e.seed}`, RI);
    const dolenta = FI.items.findIndex(x => x.error);
    if (dolenta >= 0) { avis(`La igualtat ${dolenta + 1}: ${FI.items[dolenta].error}`); return; }
  }
  const op = Comu.solucions(S, RES), cm = parseFloat(Motor.ESPAIS[S.esp]), petit = parseFloat(Motor.ESPAIS.petit);

  /* La resolució d'un exercici: una taula («centrat», que ja comença amb l'enunciat) o l'enunciat i les línies
     «= …». Com a la web, sense colors amb «només el resultat». */
  function resolucio(x) {
    if (+S.cen) return `<div class="taula">${Motor.centrada(x.arbre, op).html}</div>`;
    const r = Motor.resolucio(x.arbre, op);
    return `<div class="math">${r.html[0]}</div>` + r.html.slice(1).map(l => `<div class="linia">= ${l}</div>`).join('');
  }
  const exercici = (i, cos) => element('div', 'exercici', `<span class="num">${i + 1})</span><div class="cos">${cos}</div>`);

  /* ------------------------------------------------------------- paginar */
  let full = null;
  function nouFull() {
    full = element('section', 'full', '<div class="contingut"></div><div class="peu"></div>');
    fulls.appendChild(full);
    Comu.posaColors(full, S, false);          // els colors de «destaca», els del paper (també amb el fons fosc)
    full.style.setProperty('--sop', Motor.SIMBOLS[S.sim].css);
    return full.firstChild;
  }
  const lliure = c => c.clientHeight - (c.lastChild ? c.lastChild.offsetTop + c.lastChild.offsetHeight - c.offsetTop : 0);
  /** Hi posa un bloc (un exercici) i, a sota, l'espai per resoldre'l (cm). Si no hi cap, en un full nou. */
  function posa(bloc, espai) {
    let c = full.firstChild;
    c.appendChild(bloc);
    Comu.ajustaMarcs(bloc);
    if (lliure(c) < 0 && c.firstChild !== bloc) {
      c = nouFull();
      c.appendChild(bloc);
      Comu.ajustaMarcs(bloc);
    }
    const px = espai * 96 / 2.54, queda = lliure(c);
    if (queda > 0 && px > 0) c.appendChild(element('div', 'espai')).style.height = `${Math.min(px, queda)}px`;
  }

  // Els exercicis: al primer full, la capçalera
  nouFull().appendChild(element('div', 'capcalera',
    '<span class="nom">Nom: <span class="ratlla"></span></span><span>Curs: <span class="ratlla" style="width:22mm"></span></span>'
    + '<span>Data: <span class="ratlla" style="width:28mm"></span></span>'));
  if (igu) {
    // L'enunciat, l'exemple i les igualtats de dues en dues (una fila), separades per una línia discontínua, amb
    // l'alçada de fila del .tex. Una fila no es parteix mai.
    const IE = Igualtats.ESPAIS[S.iesp], ex = FI.exemple;
    full.style.setProperty('--buit', `${IE.buit}mm`);
    full.firstChild.appendChild(element('p', 'enunciat', Igualtats.enunciatHtml(FI.p)));
    if (!ex.error) full.firstChild.appendChild(element('p', 'exemple', `<i>Exemple:</i> <span class="ombra">`
      + `${ex.ns.join('<span class="buit"></span>')}<span class="buit"></span>= ${ex.t}</span> → ${Igualtats.solucioHtml(ex)}`));
    const files = (cel, alt) => {
      for (let i = 0; i < FI.items.length; i += 2) {
        const f = element('div', 'fila-ig', [i, i + 1].map(j => FI.items[j]
          ? `<div class="ig"><span class="num">${j + 1})</span>${cel(FI.items[j])}</div>` : '<div class="ig"></div>').join(''));
        f.style.minHeight = alt;
        posa(f, 0);
      }
    };
    files(x => `<span class="math">${Igualtats.perCompletarHtml(x)}</span>`, `${IE.fila}mm`);
    if (S.isol === 'solucionari') {
      nouFull().appendChild(element('p', 'titol', 'Solucions'));
      full.style.setProperty('--buit', `${IE.buit}mm`);
      files(x => `<span class="math">${Igualtats.solucioHtml(x)}</span>`, '10mm');
    }
  } else EX.forEach((x, i) => {
    const resolt = S.sol === 'guiades' && RES.includes(i);
    // Un exercici resolt (ajuda parcial) no necessita espai per escriure-hi: el petit, com al .tex
    posa(exercici(i, resolt ? resolucio(x) : `<div class="math">${x.html}</div>`), resolt ? petit : cm);
  });
  // El solucionari, en fulls a part
  if (!igu && S.sol === 'solucionari') {
    nouFull().appendChild(element('p', 'titol', 'Solucions'));
    EX.forEach((x, i) => {
      if (+S.nomes) {
        const r = Motor.resolucio(x.arbre, Object.assign({}, op, { dest: 0 }));
        posa(exercici(i, `<div class="math">${x.html}<span class="op">=</span>${r.html[r.html.length - 1]}</div>`), .4);
      } else posa(exercici(i, resolucio(x)), petit);
    });
  }
  // El número de cada pàgina
  const tots = fulls.querySelectorAll('.full');
  tots.forEach((f, k) => { f.lastChild.textContent = `${k + 1} / ${tots.length}`; });
  document.body.dataset.llest = '1';
})();
