/* ===========================================================================
   tests/compila.js — Compila fulls de debò amb LaTeX (cal pdflatex):

       node tests/compila.js

   Per a ℕ, ℤ i ℚ, amb totes les opcions i els símbols «gran» (el cas més
   ample), fa 40 exercicis, els compila amb tex/main.tex com ho faria el
   professor (el full normal, un full amb exercicis resolts com a model, el
   solucionari amb l'operació destacada, el de «només resultats» i, amb la
   disposició «centrat», el full destacat i el solucionari; els destacats, amb
   colors diferents, i un full amb els 16 colors de la paleta) i comprova:
     - compila sense cap error ni cap «Overfull \hbox» o «\vbox»;
     - cap fórmula, ni cap línia d'una resolució, és més ampla que la línia
       del full (LaTeX la partiria en dues o sortiria del marge);
     - cap resolució «centrat» (un array, que no es pot partir; una de llarga
       va en blocs) és més ampla que la línia, cap bloc és més alt que la
       pàgina, i els blocs d'una resolució fan el mateix ample.
   I «Completa la igualtat»: el full i el solucionari, amb 3 i 4 nombres i
   cada espai (amb 4 nombres i espai gran, el cas més ample), en dues
   columnes separades per la línia discontínua, sense errors ni «Overfull»:
   cada igualtat cap a la seva columna.
   Treballa en una carpeta temporal: no deixa res a l'arbre. Acaba amb codi 1
   si alguna cosa falla.
   =========================================================================== */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');
const Motor = require('../assets/motor.js');

if (spawnSync('pdflatex', ['--version']).status !== 0) {
  console.error('Cal pdflatex (TeX Live o MiKTeX) per compilar els fulls.');
  process.exit(1);
}
const arrel = path.resolve(__dirname, '..');
let ok = 0, ko = 0;
function comprova(nom, cond, extra) {
  if (cond) { ok++; console.log('  ok    ' + nom); }
  else { ko++; console.log('  FALLA ' + nom + (extra !== undefined ? '  ' + extra : '')); }
}

/* Els dos colors de «destaca» (els de per defecte), com els defineix un exN.tex. */
const colorsDestaca = Motor.COLORS_PER_DEFECTE.map((c, i) => `\\definecolor{destaca${i + 1}}{HTML}{${Motor.COLORS[c].hex}}`).join('') + '\n';
/* El principi de l'enumerate d'un exN.tex (amb l'espai entre símbols del full), i els colors de «destaca». */
const principiDeLlista = p => colorsDestaca
  + Motor.fitxerTex([], p, { num: 1, seed: '' }).split('\n').filter(l => !l.startsWith('%') && !l.startsWith('\\end')).join('\n') + '\n';

/* Compila ex1.tex amb el main.tex del projecte i torna el .log. */
function compila(carpeta, cos) {
  fs.writeFileSync(path.join(carpeta, 'ex1.tex'), cos);
  const r = spawnSync('pdflatex', ['-interaction=nonstopmode', '-halt-on-error', 'main.tex'], { cwd: carpeta, encoding: 'utf8' });
  return { estat: r.status, log: fs.readFileSync(path.join(carpeta, 'main.log'), 'latin1') };
}

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'combinades-'));
try {
  for (const k of ['main', 'headers', 'defs']) fs.copyFileSync(path.join(arrel, 'tex', k + '.tex'), path.join(carpeta, k + '.tex'));
  for (const set of ['N', 'Z', 'Q']) {
    const p = { n: 10, g: Motor.GENERADOR, esp: 'petit', sim: 'gran', set, int: 1, fin: 1, div: 1, opo: set === 'N' ? 0 : 1, pot: 1, par: 1, forca: 1, vs: 0, grad: 0 };
    const exs = [];
    for (let s = 0; s < 4; s++) {
      const ant = new Set();
      for (let i = 0; i < p.n; i++) { const e = Motor.exercici(p, 'compila' + s, i, 0, ant); ant.add(e.tex); exs.push(e); }
    }
    const tex = Motor.fitxerTex(exs, { ...p, n: exs.length }, { num: 1, seed: 'compila', adreca: '#prova' });
    console.log(`${set}: ${exs.length} exercicis`);

    const q = { ...p, n: exs.length }, m0 = { num: 1, seed: 'compila', adreca: '#prova' };
    const fitxers = {
      'el full': tex,
      'el full amb resolts (ajuda parcial, destacat en verd i taronja)': Motor.fitxerTex(exs, q, m0, { mode: 'guiades', resolts: [0, 1, 2, 3, 4], dest: 1, c1: 'verd', c2: 'taronja' }),
      'el full amb resolts, centrat i destacat': Motor.fitxerTex(exs, q, m0, { mode: 'guiades', resolts: [0, 1, 2, 3, 4], cen: 1, dest: 1 }),
      'el solucionari (destacat)': Motor.fitxerSolucionari(exs, q, m0, { dest: 1 }),
      'el solucionari centrat (destacat, una operació per pas, en negre i granat)': Motor.fitxerSolucionari(exs, q, m0, { cen: 1, dest: 1, gra: 'op', c1: 'negre', c2: 'granat' }),
      'el solucionari (una operació per pas)': Motor.fitxerSolucionari(exs, q, m0, { gra: 'op' }),
      'el solucionari centrat (una operació per pas)': Motor.fitxerSolucionari(exs, q, m0, { cen: 1, gra: 'op' }),
      'el solucionari (només resultats)': Motor.fitxerSolucionari(exs, q, m0, { nomes: 1 })
    };
    for (const [nom, cos] of Object.entries(fitxers)) {
      const r = compila(carpeta, cos);
      comprova(`${nom}: compila sense errors ni «Overfull»`, r.estat === 0 && !/Overfull \\[hv]box/.test(r.log),
        (r.log.match(/^!.*$/m) || r.log.match(/Overfull \\[hv]box.*/) || [''])[0]);
    }

    // Amplada de cada fórmula, mesurada amb el mateix espai entre símbols, contra l'amplada de la línia.
    const mesura = tex.replace(/^\\item \$(\\displaystyle .*)\$$/gm,
      '\\item \\settowidth{\\dimen0}{$$$1$$}\\typeout{AMPLE=\\the\\dimen0;LINIA=\\the\\linewidth}$$$1$$');
    const m = compila(carpeta, mesura);
    const amples = [...m.log.matchAll(/AMPLE=([\d.]+)pt;LINIA=([\d.]+)pt/g)].map(x => [parseFloat(x[1]), parseFloat(x[2])]);
    const pitjor = amples.reduce((a, x) => (x[0] / x[1] > a[0] / a[1] ? x : a), [0, 1]);
    comprova('totes les fórmules caben a la línia', amples.length === exs.length && amples.every(([a, l]) => a <= l),
      `${amples.length} mesures; la més ampla: ${pitjor[0]}pt de ${pitjor[1]}pt`);
    console.log(`        la més ampla fa el ${Math.round(100 * pitjor[0] / pitjor[1])} % de la línia`);

    // I cada línia de les resolucions, amb el «= » del davant, en totes dues granularitats.
    const linies = [];
    for (const e of exs) for (const gra of ['prio', 'op']) Motor.resolucio(e.arbre, { gra, dest: 1 }).tex.slice(1).forEach(l => linies.push(l));
    const cos = principiDeLlista(p) + '\\item ' + linies.map(l =>
      `\\settowidth{\\dimen0}{$\\displaystyle =${l}$}\\typeout{AMPLE=\\the\\dimen0;LINIA=\\the\\linewidth}`).join('\n') + '\n\\end{enumerate}\n';
    const ml = compila(carpeta, cos);
    const al = [...ml.log.matchAll(/AMPLE=([\d.]+)pt;LINIA=([\d.]+)pt/g)].map(x => [parseFloat(x[1]), parseFloat(x[2])]);
    const pl = al.reduce((a, x) => (x[0] / x[1] > a[0] / a[1] ? x : a), [0, 1]);
    comprova(`les ${linies.length} línies de les resolucions caben a la línia`, ml.estat === 0 && al.length === linies.length && al.every(([a, l]) => a <= l),
      `${al.length} mesures; la més ampla: ${pl[0]}pt de ${pl[1]}pt`);
    console.log(`        la més ampla fa el ${Math.round(100 * pl[0] / pl[1])} % de la línia`);

    // I cada resolució «centrat» (destacada: les ratlles la fan una mica més alta). Un array no es pot partir
    // ni de costat ni de pàgina: una resolució llarga va en blocs, i cada bloc ha de cabre a la línia i a la
    // pàgina. I els blocs d'una resolució, amb les columnes iguals, han de fer el mateix ample.
    const blocs = [];
    exs.forEach((e, i) => { for (const gra of ['prio', 'op']) Motor.centrada(e.arbre, { gra, dest: 1 }).blocs.forEach(b => blocs.push([`${i}${gra}`, b])); });
    const cc = principiDeLlista(p) + '\\item ' + blocs.map(([, b]) => `\\setbox0\\hbox{$${b}$}` +
      '\\typeout{AMPLE=\\the\\wd0;ALT=\\the\\dimexpr\\ht0+\\dp0\\relax;LINIA=\\the\\linewidth;PAGINA=\\the\\textheight}').join('\n') + '\n\\end{enumerate}\n';
    const mc = compila(carpeta, cc);
    const ac = [...mc.log.matchAll(/AMPLE=([\d.]+)pt;ALT=([\d.]+)pt;LINIA=([\d.]+)pt;PAGINA=([\d.]+)pt/g)].map(x => x.slice(1).map(parseFloat));
    const maxim = i => ac.reduce((a, x) => Math.max(a, x[i] / x[i + 2]), 0);
    const llargues = new Set(blocs.filter(([q], k) => k && blocs[k - 1][0] === q).map(([q]) => q));
    const amplesBlocs = {};
    blocs.forEach(([q], k) => { if (ac[k]) (amplesBlocs[q] = amplesBlocs[q] || []).push(ac[k][0]); });
    comprova(`les ${2 * exs.length} resolucions «centrat» (${llargues.size} de llargues, en blocs) caben a la línia i a la pàgina`,
      mc.estat === 0 && ac.length === blocs.length && ac.every(([a, h, l, pg]) => a <= l && h <= pg),
      `${ac.length} mesures; la més ampla, el ${Math.round(100 * maxim(0))} %; la més alta, el ${Math.round(100 * maxim(1))} % de la pàgina`);
    comprova('els blocs d\'una resolució llarga fan el mateix ample (les columnes, alineades)',
      Object.values(amplesBlocs).every(w => Math.max(...w) - Math.min(...w) < .01), JSON.stringify(Object.entries(amplesBlocs).filter(([, w]) => w.length > 1)));
    console.log(`        la més ampla fa el ${Math.round(100 * maxim(0))} % de la línia; el bloc més alt, el ${Math.round(100 * maxim(1))} % de la pàgina`);
  }
  // Els 16 colors de la paleta de «destaca»: cada exercici del full, destacat amb un parell de colors diferent
  {
    const claus = Object.keys(Motor.COLORS), p = { n: 8, g: Motor.GENERADOR, esp: 'petit', sim: 'petit', set: 'Z', int: 1, fin: 1, div: 1, opo: 1, pot: 1, par: 1, forca: 1, vs: 0, grad: 0 };
    const ant = new Set(), exs = [];
    for (let i = 0; i < p.n; i++) { const e = Motor.exercici(p, 'paleta', i, 0, ant); ant.add(e.tex); exs.push(e); }
    const cos = claus.filter((c, i) => i % 2 === 0).map((c, i) => Motor.fitxerTex([exs[i]], { ...p, n: 1 }, { num: 1, seed: 'paleta' },
      { mode: 'guiades', resolts: [0], dest: 1, c1: c, c2: claus[2 * i + 1] })).join('');
    const r = compila(carpeta, cos);
    comprova(`la paleta de «destaca» (${claus.length} colors): compila sense errors ni «Overfull»`, r.estat === 0 && !/Overfull \\[hv]box/.test(r.log),
      (r.log.match(/^!.*$/m) || r.log.match(/Overfull \\[hv]box.*/) || [''])[0]);
  }
  console.log('Completa la igualtat');
  const Igualtats = require('../assets/igualtats.js');
  for (const nombres of [3, 4]) for (const esp of ['petit', 'mitja', 'gran']) {
    const f = Igualtats.full({ n: 15, nombres, esp }, `compila-${nombres}-${esp}`, []);
    const m = { num: 1, seed: 'compila', adreca: '#prova', versio: Motor.VERSIO };
    for (const [nom, cos] of [['el full', Igualtats.fitxerTex(f, m)], ['el solucionari', Igualtats.fitxerSolucionari(f, m)]]) {
      const r = compila(carpeta, cos);
      comprova(`${nombres} nombres, espai ${esp}, ${Igualtats.COLUMNES} columnes: ${nom} compila sense errors ni «Overfull»`,
        r.estat === 0 && !/Overfull \\[hv]box/.test(r.log), (r.log.match(/^!.*$/m) || r.log.match(/Overfull \\[hv]box.*/) || [''])[0]);
    }
  }
} finally {
  fs.rmSync(carpeta, { recursive: true, force: true });
}
console.log(`\n${ok} correctes, ${ko} errors`);
process.exit(ko ? 1 : 0);
