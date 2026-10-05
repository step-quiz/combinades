/* ===========================================================================
   tests/navegador.js — Prova amb un navegador de debò (Chromium):

       node tests/navegador.js

   Obre index.html amb doble clic (file://), la fa servir com un professor i
   comprova el que surt a la pantalla, als fitxers baixats i a la impressió.
   Acaba amb codi 1 si alguna comprovació falla. Necessita Playwright:
       npm install --no-save playwright && npx playwright install chromium
   =========================================================================== */
'use strict';
const fs = require('fs'), path = require('path');

/* Playwright pot ser al projecte o instal·lat globalment: es busca als dos llocs. */
function carregaPlaywright() {
  try { return require('playwright'); } catch (e) { /* no és al projecte */ }
  try {
    const global = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim();
    return require(path.join(global, 'playwright'));
  } catch (e) {
    console.error('Cal Playwright: npm install --no-save playwright && npx playwright install chromium');
    process.exit(1);
  }
}
const { chromium } = carregaPlaywright();
const Motor = require('../assets/motor.js');
const arrel = path.resolve(__dirname, '..');
const EINA = 'file://' + path.join(arrel, 'index.html');

let ok = 0, ko = 0;
function comprova(nom, cond, extra) {
  if (cond) { ok++; console.log('  ok    ' + nom); }
  else { ko++; console.log('  FALLA ' + nom + (extra !== undefined ? '  ' + extra : '')); }
}
const llegeixBaixada = async (pag, selector) => {
  const [d] = await Promise.all([pag.waitForEvent('download'), pag.click(selector)]);
  return { nom: d.suggestedFilename(), text: fs.readFileSync(await d.path(), 'utf8') };
};

(async () => {
  const nav = await chromium.launch();
  const errors = [];
  const nova = async (opts) => {
    const p = await nav.newPage(opts);
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    p.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
    return p;
  };
  const pag = await nova({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const estat = () => pag.evaluate(() => ({
    hash: location.hash,
    cartes: document.querySelectorAll('#full .carta').length,
    primer: (document.querySelector('#full .math') || {}).textContent,
    formules: [...document.querySelectorAll('#full .math')].map(m => m.textContent),
    codi: document.querySelector('#codi').textContent,
    baixa: document.querySelector('#baixa').textContent,
    desactivat: document.querySelector('#baixa').disabled,
    error: (document.querySelector('#full .err') || {}).textContent
  }));

  console.log('Arrencada');
  await pag.goto(EINA);
  let e = await estat();
  comprova('surt un full de 5 exercicis', e.cartes === 5, e.cartes);
  comprova('el segell diu la versió del motor', await pag.textContent('#segell') === Motor.VERSIO);
  comprova("l'adreça guarda el full, amb les comes llegibles", /seed=[a-z0-9]+/.test(e.hash) && /&r=0,0,0,0,0$/.test(e.hash), e.hash);
  comprova('un full nou es fa amb l\'últim generador', e.hash.includes(`&g=${Motor.GENERADOR}&`), e.hash);
  comprova('el .tex porta l\'adreça per refer el full', e.codi.includes('% per refer aquest full: index.html' + e.hash), e.codi.split('\n')[2]);

  console.log('Adreça');
  const enllac = '#n=4&esp=gran&sim=mitja&set=Z&int=1&fin=1&div=1&opo=1&pot=1&par=1&forca=1&fit=7&vs=0&grad=0&seed=prova1&r=0,2,0,1';
  await pag.goto(EINA + enllac);
  e = await estat();
  comprova("un enllaç obert a la mateixa pestanya es carrega (hashchange)", e.cartes === 4 && /seed=prova1&g=1&r=0,2,0,1$/.test(e.hash), `${e.cartes} ${e.hash}`);
  const esperat = [0, 1, 2, 3].map(i => Motor.exercici({ n: 4, esp: 'gran', sim: 'mitja', set: 'Z', int: 1, fin: 1, div: 1, opo: 1, pot: 1, par: 1, forca: 1, vs: 0, grad: 0 }, 'prova1', i, [0, 2, 0, 1][i]));
  comprova("un enllaç de la v0.1 (sense g) torna el mateix full, amb el generador 1",
    e.codi.includes(esperat.map(x => x.tex).join('$\n\\par\\vspace{5cm}\n\\item $\\displaystyle ')), e.codi.slice(0, 300));
  await pag.reload();
  comprova('recarregar la pàgina dona el mateix full', JSON.stringify((await estat()).formules) === JSON.stringify(e.formules));
  await pag.click('#tot');
  comprova('«Genera-ho tot» fa un full nou amb l\'últim generador', (await estat()).hash.includes(`&g=${Motor.GENERADOR}&`));
  const p2 = { n: 10, esp: 'mitja', sim: 'petit', set: 'Z', int: 1, fin: 1, div: 1, opo: 1, pot: 1, par: 1, forca: 1, vs: 0, grad: 1, g: 2 };
  await pag.goto(EINA + '#n=10&set=Z&div=1&opo=1&pot=1&par=1&grad=1&seed=prova2&g=2');
  e = await estat();
  const esperat2 = [], ant2 = new Set();
  for (let i = 0; i < 10; i++) { const x = Motor.exercici(p2, 'prova2', i, 0, ant2); ant2.add(x.tex); esperat2.push(x); }
  comprova('un enllaç amb g=2 dona el full del generador 2', esperat2.every(x => e.codi.includes(x.tex)), e.codi.slice(0, 300));
  const etiquetes = await pag.evaluate(() => [...document.querySelectorAll('.ext')].map(x => x.textContent));
  comprova('a «gradual», l\'etiqueta diu quants parèntesis porta l\'exercici',
    etiquetes.every((t, i) => esperat2[i].params.parentesis > 1 ? t.includes('( )×' + esperat2[i].params.parentesis) : esperat2[i].params.parentesis ? /\( \)(?!×)/.test(t) : !t.includes('( )')),
    etiquetes.join(' | '));
  await pag.goto(EINA + '#n=99&esp=constructor&sim=toString&set=X&div=hola&seed=../x&r=a,b');
  e = await estat();
  comprova('una adreça mal formada no trenca res (valors per defecte)',
    e.cartes === 5 && e.codi.includes('\\vspace{3cm}') && e.codi.includes('\\medmuskip=4mu') && !/function|undefined|NaN/.test(e.codi), e.codi.slice(0, 400));

  console.log('Controls');
  await pag.goto(EINA + '#n=5&set=N&seed=ctrl');
  e = await estat();
  await pag.click('#full .carta:nth-child(3) [data-r]');
  const e2 = await estat();
  comprova('↻ canvia només el seu exercici',
    e2.formules[2] !== e.formules[2] && e2.formules.filter((f, i) => i !== 2).join() === e.formules.filter((f, i) => i !== 2).join());
  comprova('↻ queda a l\'adreça', /&r=0,0,1,0,0$/.test(e2.hash), e2.hash);
  const tex = await llegeixBaixada(pag, '#baixa');
  comprova('«Baixa» dona exN.tex amb el codi que es veu', tex.nom === 'ex1.tex' && tex.text === e2.codi, tex.nom);
  comprova('després de baixar-lo, el número passa al següent', (await estat()).baixa === 'Baixa ex2.tex');
  const main = await llegeixBaixada(pag, '[data-entorn="main"]');
  comprova("«Entorn» baixa el main.tex de la carpeta tex/", main.nom === 'main.tex' && main.text === fs.readFileSync(path.join(arrel, 'tex/main.tex'), 'utf8'));
  await pag.click('[data-set="Z"]');
  await pag.check('#opo');
  await pag.uncheck('#int');
  e = await estat();
  comprova('una combinació impossible ho diu i no deixa baixar res', !!e.error && e.cartes === 0 && e.desactivat, e.error);

  console.log('Impressió');
  await pag.goto(EINA + '#n=6&set=Z&div=1&opo=1&pot=1&par=1&grad=1&seed=imp');
  await pag.emulateMedia({ media: 'print' });
  const imp = await pag.evaluate(() => ({
    ext: [...document.querySelectorAll('.ext')].map(x => getComputedStyle(x).display),
    amagats: ['header', 'aside', 'footer', 'details'].map(s => getComputedStyle(document.querySelector(s)).display)
  }));
  comprova('les etiquetes del mode gradual no s\'imprimeixen', imp.ext.length === 6 && imp.ext.every(d => d === 'none'), imp.ext.join());
  comprova('capçalera, panell, barra i codi no s\'imprimeixen', imp.amagats.every(d => d === 'none'), imp.amagats.join());
  const pdf = await pag.pdf({ format: 'A4' });
  comprova('el PDF d\'impressió es genera', pdf.length > 1000 && pdf.slice(0, 4).toString() === '%PDF');
  /* Cap fórmula no surt del paper: A4 menys els marges de @page = 174 mm ≈ 658 px. */
  await pag.setViewportSize({ width: 658, height: 900 });
  let maxAmple = 0;
  for (const set of ['Z', 'Q']) for (let s = 0; s < 8; s++) {
    await pag.goto(EINA + `#n=10&esp=petit&sim=gran&set=${set}&div=1&opo=1&pot=1&par=1&seed=ample${s}`);
    maxAmple = Math.max(maxAmple, await pag.evaluate(() => Math.max(...[...document.querySelectorAll('.math')].map(m => m.getBoundingClientRect().left + m.scrollWidth))));
  }
  comprova('a la impressió, les fórmules més amples (símbols «gran») hi caben', maxAmple <= 658, Math.round(maxAmple) + ' px');
  await pag.emulateMedia({ media: 'screen' });

  console.log('Mòbil');
  const mob = await nova({ viewport: { width: 390, height: 844 } });
  await mob.goto(EINA + '#n=4&esp=petit&sim=gran&set=Q&div=1&opo=1&pot=1&par=1&seed=mob');
  const m = await mob.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
    const avis = document.querySelectorAll('section .avis'), ultim = avis[avis.length - 1].getBoundingClientRect();
    return {
      ample: document.documentElement.scrollWidth, finestra: document.documentElement.clientWidth,
      linies: [...document.querySelectorAll('.math')].map(x => Math.round(x.getBoundingClientRect().height)),
      tapat: ultim.bottom > document.querySelector('footer').getBoundingClientRect().top + 1
    };
  });
  comprova('al mòbil, la pàgina no es desplaça de costat', m.ample <= m.finestra, `${m.ample} > ${m.finestra}`);
  comprova('al mòbil, cap fórmula es parteix en dues línies', m.linies.every(h => h < 110), m.linies.join());
  comprova('la barra de baix no tapa el final de la pàgina', !m.tapat);

  comprova('cap error a la consola', !errors.length, errors.join(' | '));
  await nav.close();
  console.log(`\n${ok} correctes, ${ko} errors`);
  process.exit(ko ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
