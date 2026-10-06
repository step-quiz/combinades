/* ===========================================================================
   tests/compila.js — Compila fulls de debò amb LaTeX (cal pdflatex):

       node tests/compila.js

   Per a ℕ, ℤ i ℚ, amb totes les opcions i els símbols «gran» (el cas més
   ample), fa 40 exercicis, els compila amb tex/main.tex com ho faria el
   professor (el full normal, un full amb exercicis resolts com a model, el
   solucionari amb l'operació destacada, el de «només resultats» i, amb la
   disposició «centrat», el full i el solucionari) i comprova:
     - compila sense cap error ni cap «Overfull \hbox» o «\vbox»;
     - cap fórmula, ni cap línia d'una resolució, és més ampla que la línia
       del full (LaTeX la partiria en dues o sortiria del marge);
     - cap resolució «centrat» (un array, que no es pot partir) és més ampla
       que la línia o més alta que la pàgina.
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

/* El principi de l'enumerate d'un exN.tex (amb l'espai entre símbols del full). */
const principiDeLlista = p => Motor.fitxerTex([], p, { num: 1, seed: '' }).split('\n').filter(l => !l.startsWith('%') && !l.startsWith('\\end')).join('\n') + '\n';

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
      'el full amb resolts (guiades)': Motor.fitxerTex(exs, q, m0, { mode: 'guiades', resolts: [0, 1, 2, 3, 4], dest: 1 }),
      'el full amb resolts, centrat': Motor.fitxerTex(exs, q, m0, { mode: 'guiades', resolts: [0, 1, 2, 3, 4], cen: 1 }),
      'el solucionari (destacat)': Motor.fitxerSolucionari(exs, q, m0, { dest: 1 }),
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

    // I cada resolució «centrat»: un array, que no es pot partir ni de costat ni de pàgina.
    const arrays = [];
    for (const e of exs) for (const gra of ['prio', 'op']) arrays.push(Motor.centrada(e.arbre, { gra }).tex);
    const cc = principiDeLlista(p) + '\\item ' + arrays.map(a => `\\setbox0\\hbox{$${a}$}` +
      '\\typeout{AMPLE=\\the\\wd0;ALT=\\the\\dimexpr\\ht0+\\dp0\\relax;LINIA=\\the\\linewidth;PAGINA=\\the\\textheight}').join('\n') + '\n\\end{enumerate}\n';
    const mc = compila(carpeta, cc);
    const ac = [...mc.log.matchAll(/AMPLE=([\d.]+)pt;ALT=([\d.]+)pt;LINIA=([\d.]+)pt;PAGINA=([\d.]+)pt/g)].map(x => x.slice(1).map(parseFloat));
    const maxim = i => ac.reduce((a, x) => Math.max(a, x[i] / x[i + 2]), 0);
    comprova(`les ${arrays.length} resolucions «centrat» caben a la línia i a la pàgina`,
      mc.estat === 0 && ac.length === arrays.length && ac.every(([a, h, l, pg]) => a <= l && h <= pg),
      `${ac.length} mesures; la més ampla, el ${Math.round(100 * maxim(0))} %; la més alta, el ${Math.round(100 * maxim(1))} % de la pàgina`);
    console.log(`        la més ampla fa el ${Math.round(100 * maxim(0))} % de la línia; la més alta, el ${Math.round(100 * maxim(1))} % de la pàgina`);
  }
} finally {
  fs.rmSync(carpeta, { recursive: true, force: true });
}
console.log(`\n${ok} correctes, ${ko} errors`);
process.exit(ko ? 1 : 0);
