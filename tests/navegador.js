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
  comprova("l'adreça guarda el full, amb les comes llegibles", /seed=[a-z0-9]+/.test(e.hash) && /&r=0,0,0,0,0(&|$)/.test(e.hash), e.hash);
  comprova('un full nou es fa amb l\'últim generador', e.hash.includes(`&g=${Motor.GENERADOR}&`), e.hash);
  comprova('el .tex porta l\'adreça per refer el full', e.codi.includes('% per refer aquest full: index.html' + e.hash), e.codi.split('\n')[2]);

  console.log('Adreça');
  const enllac = '#n=4&esp=gran&sim=mitja&set=Z&int=1&fin=1&div=1&opo=1&pot=1&par=1&forca=1&fit=7&vs=0&grad=0&seed=prova1&r=0,2,0,1';
  await pag.goto(EINA + enllac);
  e = await estat();
  comprova("un enllaç obert a la mateixa pestanya es carrega (hashchange)", e.cartes === 4 && /seed=prova1&g=1&r=0,2,0,1(&|$)/.test(e.hash), `${e.cartes} ${e.hash}`);
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
  comprova('↻ queda a l\'adreça', /&r=0,0,1,0,0(&|$)/.test(e2.hash), e2.hash);
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

  console.log('Solucions');
  await mob.close();
  await pag.setViewportSize({ width: 1280, height: 900 });
  await pag.goto(EINA + '#n=5&set=Z&div=1&opo=1&pot=1&par=1&seed=sol1&g=2&fit=3');
  e = await estat();
  comprova('cada exercici té «Veure els passos», i en mode «cap» cap casella «resolt»',
    await pag.locator('#full details.veure').count() === 5 && await pag.locator('[data-res]').count() === 0 && !e.codi.includes('flalign'));
  await pag.click('[data-sol="guiades"]');
  await pag.click('[data-k="2"]');
  e = await estat();
  const g = await pag.evaluate(() => ({
    resolts: [...document.querySelectorAll('#full .carta')].map(c => c.classList.contains('resolt')),
    linies: document.querySelectorAll('#full .carta.resolt .passos .linia').length,
    caselles: document.querySelectorAll('[data-res]').length
  }));
  comprova('guiades: «resol els 2 primers» els resol (al full i al .tex)',
    g.resolts.join() === 'true,true,false,false,false' && g.linies > 2 && g.caselles === 5 &&
    (e.codi.match(/\\begin\{flalign\*\}/g) || []).length === 2 && /&sol=guiades&.*&res=0,1(&|$)/.test(e.hash), JSON.stringify(g));
  await pag.click('#full .carta:nth-child(4) [data-res]');
  e = await estat();
  comprova('guiades: la casella «resolt» d\'una targeta l\'afegeix', /&res=0,1,3(&|$)/.test(e.hash) && (e.codi.match(/flalign\*\}/g) || []).length === 6, e.hash);
  await pag.emulateMedia({ media: 'print' });
  const imp2 = await pag.evaluate(() => [...document.querySelectorAll('#full .carta')].map(c =>
    [...c.querySelectorAll('.passos')].some(x => x.offsetParent !== null) ? 1 : 0).join(''));
  comprova('guiades: a la impressió, només els resolts porten la resolució', imp2 === '11010', imp2);
  await pag.emulateMedia({ media: 'screen' });
  await pag.click('[data-sol="solucionari"]');
  e = await estat();
  const vis = id => pag.evaluate(i => getComputedStyle(document.getElementById(i)).display !== 'none', id);
  comprova('solucionari: hi ha «Baixa ex3-sol.tex» i «PDF solucions», i exN.tex és el de sempre',
    await vis('baixa-sol') && await vis('pdf-sol') && await pag.textContent('#baixa-sol') === 'Baixa ex3-sol.tex' && !e.codi.includes('flalign'));
  const ex3 = await llegeixBaixada(pag, '#baixa');
  comprova('després de baixar ex3.tex, el solucionari continua sent el del 3', ex3.nom === 'ex3.tex' &&
    await pag.textContent('#baixa') === 'Baixa ex4.tex' && await pag.textContent('#baixa-sol') === 'Baixa ex3-sol.tex');
  const sol = await llegeixBaixada(pag, '#baixa-sol');
  comprova('«Baixa ex3-sol.tex» dona el solucionari sencer', sol.nom === 'ex3-sol.tex' && sol.text.startsWith('% ex3-sol.tex') &&
    sol.text.includes('\\textbf{Solucions}') && (sol.text.match(/\\begin\{flalign\*\}/g) || []).length === 5 &&
    sol.text.includes('% per refer aquest full: index.html#') && sol.text.includes('&fit=3&'), sol.text.slice(0, 200));
  await pag.check('#nomes');
  comprova('«només els resultats»: una línia per exercici', !(await pag.textContent('#codi-sol')).includes('flalign'));
  await pag.uncheck('#nomes');
  await pag.evaluate(() => document.body.classList.add('imprimeix-solucions'));
  await pag.emulateMedia({ media: 'print' });
  const imp3 = await pag.evaluate(() => ({
    sol: [...document.querySelectorAll('#full .sol-imp')].filter(x => x.offsetParent !== null).length,
    titol: getComputedStyle(document.getElementById('full'), '::before').content
  }));
  comprova('«PDF solucions»: cada exercici amb la resolució, i el títol', imp3.sol === 5 && imp3.titol.includes('Solucions'), JSON.stringify(imp3));
  await pag.evaluate(() => document.body.classList.remove('imprimeix-solucions'));
  await pag.emulateMedia({ media: 'screen' });
  const imp4 = await pag.evaluate(() => [...document.querySelectorAll('#full .sol-imp')].filter(x => x.offsetParent !== null).length);
  comprova('sense «PDF solucions», la resolució del solucionari no surt a la pantalla', imp4 === 0, imp4);

  console.log('Centrat');
  const pz = { n: 5, esp: 'mitja', sim: 'petit', set: 'Z', int: 1, fin: 1, div: 1, opo: 1, pot: 1, par: 1, forca: 1, vs: 0, grad: 0, g: 2 };
  const exz = [], antz = new Set();
  for (let i = 0; i < 5; i++) { const x = Motor.exercici(pz, 'sol1', i, 0, antz); antz.add(x.tex); exz.push(x); }
  await pag.goto(EINA + '#n=5&set=Z&div=1&opo=1&pot=1&par=1&seed=sol1&g=2&sol=guiades&res=0,1');
  await pag.check('#cen');
  e = await estat();
  const cz = await pag.evaluate(() => ({
    resolts: [...document.querySelectorAll('#full .carta.resolt')].map(c => [c.querySelectorAll('.math').length,
      ((c.querySelector('.passos table.centrat') || {}).outerHTML || '').replace(/<\/?tbody>/g, '')]),   // (el navegador hi afegeix el tbody)
    veure: document.querySelectorAll('#full details.veure table.centrat').length,
    dest: document.getElementById('dest').disabled
  }));
  comprova('centrat: cada resolt és una taula (la del motor, amb l\'enunciat a dalt) i «destaca» es desactiva',
    cz.resolts.length === 2 && cz.resolts.every(([m, t], i) => m === 0 && t === Motor.centrada(exz[i].arbre, { gra: 'prio', simp: 1, dest: 0 }).html) &&
    cz.veure === 3 && cz.dest, JSON.stringify(cz).slice(0, 300));
  comprova('centrat: el .tex porta un array per exercici resolt, i l\'adreça ho recorda',
    (e.codi.match(/^\\item \$\\begin\{array\}\[t\]/gm) || []).length === 2 && !e.codi.includes('flalign') && /&cen=1(&|$)/.test(e.hash), e.hash);
  await pag.uncheck('#cen');
  comprova('sense centrat, «destaca» torna a funcionar', !(await pag.isDisabled('#dest')) && (await estat()).codi.includes('flalign'));
  // El «PDF solucions» d'un solucionari centrat: la taula substitueix l'enunciat, i cap no surt del paper
  await pag.setViewportSize({ width: 658, height: 900 });
  let maxTaula = 0, malament = '';
  for (const s of [0, 1, 2, 18]) {
    await pag.goto(EINA + `#n=10&esp=petit&sim=gran&set=Q&div=1&opo=1&pot=1&par=1&seed=ample${s}&g=2&sol=solucionari&cen=1`);
    await pag.evaluate(() => document.body.classList.add('imprimeix-solucions'));
    await pag.emulateMedia({ media: 'print' });
    const r = await pag.evaluate(() => ({
      enunciats: [...document.querySelectorAll('#full .math')].filter(x => x.offsetParent !== null).length,
      taules: [...document.querySelectorAll('#full .sol-imp table.centrat')].filter(x => x.offsetParent !== null).map(t => t.getBoundingClientRect().right)
    }));
    if (r.enunciats || r.taules.length !== 10) malament = JSON.stringify(r);
    maxTaula = Math.max(maxTaula, ...r.taules);
    await pag.evaluate(() => document.body.classList.remove('imprimeix-solucions'));
    await pag.emulateMedia({ media: 'screen' });
  }
  comprova('centrat, «PDF solucions»: una taula per exercici, sense l\'enunciat repetit', !malament, malament);
  comprova('centrat, «PDF solucions»: les taules més amples (ℚ, símbols «gran») caben al paper', maxTaula <= 658, Math.round(maxTaula) + ' px');
  // I el mecanisme, sigui quina sigui la lletra del sistema: amb la lletra a 24 px, moltes taules passen de 600 px, i
  // les del «PDF solucions» (que no es veuen a la pantalla) també s'han d'encongir, just el que cal
  await pag.addStyleTag({ content: 'html { font-size: 24px }' });
  await pag.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange')));      // l'eina es torna a pintar
  const enc = await pag.evaluate(() => [...document.querySelectorAll('#full .sol-imp')].map(x => {
    x.style.display = 'block';
    const t = x.querySelector('table.centrat'), r = document.createRange();
    r.selectNodeContents(t);
    const ample = r.getBoundingClientRect().width;
    x.style.display = '';
    return [Math.round(ample), parseFloat(t.style.getPropertyValue('--encaix')) || 1];
  }));
  comprova('centrat, «PDF solucions»: una taula que no cap al paper s\'encongeix, encara que no es vegi a la pantalla',
    enc.some(([a]) => a > 600) && enc.every(([a, k]) => Math.abs(Math.min(a, 600) - a * k) < 2), JSON.stringify(enc));
  await pag.setViewportSize({ width: 390, height: 844 });
  await pag.goto(EINA + '#n=4&esp=petit&sim=gran&set=Q&div=1&opo=1&pot=1&par=1&seed=ample18&g=2&sol=guiades&res=0,1,2,3&cen=1');
  const mc = await pag.evaluate(() => ({ ample: document.documentElement.scrollWidth, finestra: document.documentElement.clientWidth }));
  comprova('centrat, al mòbil: una taula ampla es desplaça ella sola, no la pàgina', mc.ample <= mc.finestra, `${mc.ample} > ${mc.finestra}`);
  await pag.setViewportSize({ width: 1280, height: 900 });

  comprova('cap error a la consola', !errors.length, errors.join(' | '));
  await nav.close();
  console.log(`\n${ok} correctes, ${ko} errors`);
  process.exit(ko ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
