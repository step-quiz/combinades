/* ===========================================================================
   tests/navegador.js — Prova amb un navegador de debò (Chromium):

       node tests/navegador.js

   Obre index.html amb doble clic (file://), la fa servir com un professor i
   comprova el que surt a la pantalla i als fitxers baixats.
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
const Motor = require('../assets/motor.js'), Igualtats = require('../assets/igualtats.js');
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
  // Els passos del panell es pleguen: per fer servir tots els controls, s'obren (el navegador ho recorda)
  const obreTot = async (p) => { await p.evaluate(() => document.querySelectorAll('aside details').forEach(d => { d.open = true; })); await p.waitForTimeout(50); };
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
  await obreTot(pag);
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

  console.log('Barra');
  const botons = await pag.evaluate(() => [...document.querySelectorAll('footer button')].map(b => b.id).join());
  comprova('a la barra de baix només hi ha «Baixa exN.tex» i «Baixa exN-sol.tex» (ni «Copia el TeX» ni PDF)', botons === 'baixa,baixa-sol', botons);

  console.log('Mòbil');
  const mob = await nova({ viewport: { width: 390, height: 844 } });
  await mob.goto(EINA + '#n=4&esp=petit&sim=gran&set=Q&div=1&opo=1&pot=1&par=1&seed=mob');
  const m = await mob.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
    const finals = [...document.querySelectorAll('section > *')].filter(x => x.offsetParent !== null), ultim = finals[finals.length - 1].getBoundingClientRect();
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
  const aLaVista = () => pag.evaluate(() => [...document.querySelectorAll('#full .carta')].map(c =>     // (no dins d'un «Veure els passos» tancat)
    [...c.querySelectorAll('.passos')].some(x => !x.closest('details:not([open])')) ? 1 : 0).join(''));
  const vista2 = await aLaVista();
  comprova('guiades: a la web, només els resolts porten la resolució a la vista (els altres, «Veure els passos»)', vista2 === '11010', vista2);
  await pag.click('[data-sol="solucionari"]');
  e = await estat();
  const vis = id => pag.evaluate(i => getComputedStyle(document.getElementById(i)).display !== 'none', id);
  comprova('solucionari: hi ha «Baixa ex3-sol.tex», i exN.tex és el de sempre',
    await vis('baixa-sol') && await pag.textContent('#baixa-sol') === 'Baixa ex3-sol.tex' && !e.codi.includes('flalign'));
  const vista3 = await aLaVista();
  comprova('solucionari: a la web, tots els exercicis surten resolts, com a exN-sol.tex',
    vista3 === '11111' && await pag.locator('#full details.veure').count() === 0 && await pag.locator('#full .carta.resolt').count() === 5, vista3);
  const ex3 = await llegeixBaixada(pag, '#baixa');
  comprova('després de baixar ex3.tex, el solucionari continua sent el del 3', ex3.nom === 'ex3.tex' &&
    await pag.textContent('#baixa') === 'Baixa ex4.tex' && await pag.textContent('#baixa-sol') === 'Baixa ex3-sol.tex');
  const sol = await llegeixBaixada(pag, '#baixa-sol');
  comprova('«Baixa ex3-sol.tex» dona el solucionari sencer', sol.nom === 'ex3-sol.tex' && sol.text.startsWith('% ex3-sol.tex') &&
    sol.text.includes('\\textbf{Solucions}') && (sol.text.match(/\\begin\{flalign\*\}/g) || []).length === 5 &&
    sol.text.includes('% per refer aquest full: index.html#') && sol.text.includes('&fit=3&'), sol.text.slice(0, 200));
  await pag.check('#nomes');
  const nomes = await pag.evaluate(() => [...document.querySelectorAll('#full .carta')].map(c => c.querySelectorAll('.passos').length + ':' + (c.querySelector('.math').textContent.includes('=') ? 1 : 0)).join());
  comprova('«només els resultats»: una línia per exercici, al .tex i a la web («enunciat = resultat»)',
    !(await pag.textContent('#codi-sol')).includes('flalign') && nomes === '0:1,0:1,0:1,0:1,0:1', nomes);
  // Amb «destaca» marcat d'abans (amb «només el resultat», la casella no hi és): ni caixes ni colors
  await pag.uncheck('#nomes');
  await pag.check('#dest');
  await pag.check('#nomes');
  comprova('«només els resultats», amb «destaca»: sense caixes ni colors (a la web i al .tex)',
    await pag.locator('#full .k1, #full .k2').count() === 0 && !(await pag.textContent('#codi-sol')).includes('destaca'));
  await pag.uncheck('#nomes');
  await pag.uncheck('#dest');
  await pag.uncheck('#nomes');

  console.log('Centrat');
  const pz = { n: 5, esp: 'mitja', sim: 'petit', set: 'Z', int: 1, fin: 1, div: 1, opo: 1, pot: 1, par: 1, forca: 1, vs: 0, grad: 0, g: 2 };
  const exz = [], antz = new Set();
  for (let i = 0; i < 5; i++) { const x = Motor.exercici(pz, 'sol1', i, 0, antz); antz.add(x.tex); exz.push(x); }
  await pag.goto(EINA + '#n=5&set=Z&div=1&opo=1&pot=1&par=1&seed=sol1&g=2&sol=guiades&res=0,1');
  await pag.check('#cen');
  e = await estat();
  const taules = () => pag.evaluate(() => [...document.querySelectorAll('#full .carta.resolt')].map(c => [c.querySelectorAll('.math').length,
    ((c.querySelector('.passos table.centrat') || {}).outerHTML || '').replace(/<\/?tbody>/g, '').replace(/(<td[^>]*?) style="[^"]*"/g, '$1')]));   // (el navegador hi afegeix el tbody; app.js, la mida dels marcs)
  const cz = await taules(), veure = await pag.locator('#full details.veure table.centrat').count();
  comprova('centrat: cada resolt és una taula (la del motor, amb l\'enunciat a dalt), i «Veure els passos» també',
    cz.length === 2 && cz.every(([m, t], i) => m === 0 && t === Motor.centrada(exz[i].arbre, { gra: 'prio', simp: 1, dest: 0 }).html) && veure === 3,
    JSON.stringify(cz).slice(0, 300));
  comprova('centrat: el .tex porta un array per exercici resolt, i l\'adreça ho recorda',
    (e.codi.match(/^\\item \$\\begin\{array\}\[t\]/gm) || []).length === 2 && !e.codi.includes('flalign') && /&cen=1(&|$)/.test(e.hash), e.hash);
  // «Destaca la següent operació», també amb «centrat»: dins d'una caixa dels dos colors (per defecte, blau fosc i
  // vermell) alternats; el resultat, a la línia següent, del color de la seva caixa. Amb «centrat», cada tros a la
  // seva columna, com sense destacar, i el marc al voltant de les cel·les de la caixa, del primer tros a l'últim
  await pag.check('#dest');
  e = await estat();
  const BLAU = 'rgb(0, 0, 139)', VERMELL = 'rgb(211, 47, 47)', VERD = 'rgb(46, 125, 50)';
  // Les caixes: la classe (k1, k2), el color del text i les quatre vores, del mateix color que el text
  const caixes = (sel) => pag.evaluate((s) => [...document.querySelectorAll(s)].map((el) => {
    const c = getComputedStyle(el);
    return `${el.classList.contains('k1') ? 'k1' : el.classList.contains('k2') ? 'k2' : '?'}|${c.color}|${[c.borderTopStyle, c.borderRightStyle, c.borderBottomStyle, c.borderLeftStyle].join(',')}|${c.borderTopColor === c.color}`;
  }), sel);
  const colorDe = { k1: BLAU, k2: VERMELL }, bona = x => { const [k, c, v, igual] = x.split('|'); return c === colorDe[k] && v === 'solid,solid,solid,solid' && igual === 'true'; };
  // Els resultats, a la web: del color de la seva classe
  const resultats = () => pag.evaluate(() => [...document.querySelectorAll('#full .carta.resolt span.k1:not(.caixa), #full .carta.resolt span.k2:not(.caixa)')]
    .map(el => `${el.classList[0]}|${getComputedStyle(el).color}`));
  // Els marcs de «centrat» (el ::before de les cel·les td.marc de cada caixa): del color de la cel·la, amb la vora de
  // dalt i la de baix, la de l'esquerra a la primera (ini) i la de la dreta a l'última (fi). Van del principi del
  // primer tros al final de l'últim, una mica per fora, i de dalt a baix del que hi ha a dins (els mesura app.js).
  const marcs = () => pag.evaluate(() => {
    const caixa = r => { const x = document.createRange(); x.selectNodeContents(r); return x.getBoundingClientRect(); };
    const out = [];
    document.querySelectorAll('#full .carta.resolt table.centrat tr').forEach(tr => {
      let grup = [];
      tr.querySelectorAll('td.marc').forEach(td => {
        grup.push(td);
        if (!td.classList.contains('fi')) return;
        const b = grup.map(x => getComputedStyle(x, '::before')), c = grup.map(caixa), t = grup.map(x => x.getBoundingClientRect());
        const em = parseFloat(getComputedStyle(td).fontSize), u = grup.length - 1;
        const esq = t[0].left + parseFloat(b[0].left), dre = t[u].right - parseFloat(b[u].right);
        const dalt = t[0].top + parseFloat(b[0].top), baix = t[0].bottom - parseFloat(b[0].bottom);
        out.push({
          k: td.classList.contains('k1') ? 'k1' : 'k2', text: getComputedStyle(td).color,
          vores: b.every((x, i) => x.borderTopStyle === 'solid' && x.borderBottomStyle === 'solid' && x.borderTopColor === getComputedStyle(grup[i]).color) &&
            b[0].borderLeftStyle === 'solid' && b[u].borderRightStyle === 'solid' &&
            b.slice(1).every(x => x.borderLeftStyle === 'none') && b.slice(0, -1).every(x => x.borderRightStyle === 'none'),
          lloc: esq < c[0].left && c[0].left - esq < .5 * em && dre > c[u].right && dre - c[u].right < .5 * em &&
            dalt < Math.min(...c.map(x => x.top)) && baix > Math.max(...c.map(x => x.bottom))
        });
        grup = [];
      });
    });
    return out;
  });
  const czd = await taules(), mcs = await marcs(), rc = await resultats();
  comprova('centrat i destaca: les taules del motor (cada tros a la seva columna) i un marc de blau fosc o de vermell al voltant de cada caixa, del primer tros a l\'últim; els resultats, del seu color',
    czd.every(([m, t], i) => t === Motor.centrada(exz[i].arbre, { gra: 'prio', simp: 1, dest: 1 }).html) &&
    mcs.length > 0 && mcs.every(x => x.text === colorDe[x.k] && x.vores && x.lloc) && mcs.some(x => x.k === 'k1') && mcs.some(x => x.k === 'k2') &&
    rc.length > 0 && rc.every(x => x.split('|')[1] === colorDe[x.split('|')[0]]), JSON.stringify(mcs.slice(0, 3)) + ' / ' + rc.slice(0, 3).join(' '));
  comprova('centrat i destaca: el .tex defineix els dos colors i fa cada caixa al voltant de les seves columnes (cap subratllat)',
    e.codi.includes('\\definecolor{destaca1}{HTML}{00008B}\\definecolor{destaca2}{HTML}{D32F2F}% «destaca»') && e.codi.includes('\\color{destaca1}\\setbox0') &&
    e.codi.includes('\\color{destaca2}\\setbox0') && !e.codi.includes('\\leaders') && !e.codi.includes('\\underline'), e.codi.slice(0, 400));
  // L'exemple del professor, 3 + (4²·3:4 − 6): a «3 + 6», el 3 i el + són just sota els de «3 + (12 − 6)»
  const alineat = await pag.evaluate((html) => {
    const d = document.createElement('div');
    d.className = 'carta resolt';
    d.innerHTML = `<div class="passos"><div class="taula">${html}</div></div>`;
    document.getElementById('full').prepend(d);
    window.dispatchEvent(new Event('resize'));
    const files = d.querySelectorAll('tr'), x = (f, i) => { const r = document.createRange(); r.selectNodeContents(files[f].children[i]); return Math.round(r.getBoundingClientRect().left); };
    const res = [x(3, 0), x(4, 0), x(3, 1), x(4, 1)];
    d.remove();
    return res;
  }, Motor.centrada({ t: 'bin', op: '+', l: { t: 'num', v: 3 }, r: { t: 'bin', op: '-', l: { t: 'bin', op: ':', l: { t: 'bin', op: '*', l: { t: 'pow', a: { t: 'num', v: 4 }, k: 2 }, r: { t: 'num', v: 3 } }, r: { t: 'num', v: 4 } }, r: { t: 'num', v: 6 } } }, { dest: 1 }).html);
  comprova('centrat i destaca: a «3 + 6», el 3 i el + són just sota els de «3 + (12 − 6)»', alineat[0] === alineat[1] && alineat[2] === alineat[3], alineat.join());
  await pag.uncheck('#cen');
  const linia = await caixes('#full .carta.resolt .dest.caixa');
  e = await estat();
  comprova('destaca, sense centrat: dins d\'una caixa dels dos colors, a la web i al .tex ({\\color{destaca1}\\boxed{…}})',
    linia.length > 0 && linia.every(bona) && e.codi.includes('{\\color{destaca1}\\boxed{') && e.codi.includes('{\\color{destaca2}\\boxed{') &&
    !e.codi.includes('\\underline') && e.codi.includes('flalign'),
    linia.slice(0, 3).join(' '));
  // Els colors es trien: un botó per a cadascun obre la paleta (16 colors), i el triat va al full, a l'adreça i al .tex
  const vis2 = id => pag.evaluate(i => getComputedStyle(document.getElementById(i)).display !== 'none', id);
  await obreTot(pag);
  const tancada = !(await vis2('paleta')) && await vis2('colors');
  await pag.click('[data-tria="2"]');
  const paleta = await pag.evaluate(() => ({
    mostres: document.querySelectorAll('#paleta [data-color]').length,
    triat: [...document.querySelectorAll('#paleta [aria-pressed=true]')].map(b => b.dataset.color).join(),
    oberta: document.querySelector('[data-tria="2"]').getAttribute('aria-expanded')
  }));
  comprova('colors: el 2n color obre la paleta de 16, amb el vermell triat', tancada && await vis2('paleta') && paleta.mostres === 16 && paleta.triat === 'vermell' && paleta.oberta === 'true', JSON.stringify(paleta));
  await pag.click('#paleta [data-color="verd"]');
  e = await estat();
  const verds = (await caixes('#full .carta.resolt .dest.caixa.k2')).map(x => x.split('|')[1]);
  comprova('colors: triar el verd tanca la paleta i el 2n color passa a ser verd (al full, a l\'adreça i al .tex)',
    !(await vis2('paleta')) && verds.length > 0 && verds.every(c => c === VERD) && /&c2=verd(&|$)/.test(e.hash) &&
    e.codi.includes('\\definecolor{destaca1}{HTML}{00008B}\\definecolor{destaca2}{HTML}{2E7D32}'), `${verds.slice(0, 2)} ${e.hash}`);
  await pag.reload();
  comprova('colors: l\'enllaç (i recarregar la pàgina) els recorda', (await estat()).codi.includes('{HTML}{2E7D32}'));
  await pag.goto(EINA + '#n=5&set=Z&div=1&opo=1&pot=1&par=1&seed=sol1&g=2&sol=guiades&res=0,1&dest=1&c1=constructor&c2=toString');
  e = await estat();
  comprova('colors: un enllaç sense colors, o amb uns que no són de la paleta, fa servir els de per defecte',
    e.codi.includes('\\definecolor{destaca1}{HTML}{00008B}\\definecolor{destaca2}{HTML}{D32F2F}') && /&c1=blaufosc&c2=vermell(&|$)/.test(e.hash), e.hash);
  await pag.uncheck('#dest');
  comprova('colors: sense «destaca», ni els colors ni cap color al full', !(await vis2('colors')) &&
    await pag.locator('#full .k1, #full .k2').count() === 0 && !(await estat()).codi.includes('destaca'));
  const fosc = await nova({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
  await fosc.goto(EINA + '#n=5&set=Z&div=1&opo=1&pot=1&par=1&seed=sol1&g=2&sol=guiades&res=0,1&dest=1');
  const blauFosc = await fosc.evaluate(() => getComputedStyle(document.querySelector('#full .dest.caixa.k1')).color);
  comprova('destaca, amb el fons fosc: el color, més clar (es llegeix)', blauFosc === 'rgb(140, 140, 203)', blauFosc);
  await fosc.close();
  // Al solucionari, amb «centrat», cada exercici és una taula a la web
  await pag.goto(EINA + '#n=10&esp=petit&sim=gran&set=Q&div=1&opo=1&pot=1&par=1&seed=ample0&g=2&sol=solucionari&cen=1&dest=1');
  const sc = await pag.evaluate(() => ({
    taules: [...document.querySelectorAll('#full .carta table.centrat')].filter(t => t.offsetParent !== null).length,
    enunciats: document.querySelectorAll('#full .math').length
  }));
  comprova('centrat, al solucionari: a la web, cada exercici és una taula (que ja comença amb l\'enunciat)', sc.taules === 10 && sc.enunciats === 0, JSON.stringify(sc));
  await pag.setViewportSize({ width: 390, height: 844 });
  await pag.goto(EINA + '#n=4&esp=petit&sim=gran&set=Q&div=1&opo=1&pot=1&par=1&seed=ample18&g=2&sol=guiades&res=0,1,2,3&cen=1');
  const mc = await pag.evaluate(() => ({ ample: document.documentElement.scrollWidth, finestra: document.documentElement.clientWidth }));
  comprova('centrat, al mòbil: una taula ampla es desplaça ella sola, no la pàgina', mc.ample <= mc.finestra, `${mc.ample} > ${mc.finestra}`);
  await pag.setViewportSize({ width: 1280, height: 900 });

  console.log('Completa la igualtat');
  await pag.setViewportSize({ width: 1280, height: 900 });
  await pag.goto(EINA + '#n=5&seed=igu1&fit=2');
  const comb = (await estat()).formules;
  await pag.click('[data-act="igu"]');
  e = await estat();
  const fi = Igualtats.full({ n: 9, nombres: 3, par: 1, pot: 1, arr: 1, div: 1, esp: 'mitja' }, 'ig:igu1', []);
  const web = () => pag.evaluate(() => ({
    cartes: document.querySelectorAll('#full .igualtat').length,
    enunciat: document.querySelector('#full .enunciat').textContent,
    enunciatHtml: document.querySelector('#full .enunciat').innerHTML,
    exemple: document.querySelector('#full .exemple').textContent.replace(/\s+/g, ' '),
    igualtats: [...document.querySelectorAll('#full .igualtat .math')].map(m => m.textContent.replace(/\s+/g, '')),
    veure: document.querySelectorAll('#full .igualtat details.veure').length,
    solucions: [...document.querySelectorAll('#full .igualtat .passos .linia')].filter(l => !l.closest('details:not([open])')).length,
    panell: getComputedStyle(document.getElementById('op-igu')).display !== 'none' && getComputedStyle(document.getElementById('op-comb')).display === 'none'
  }));
  let w = await web();
  comprova('«Completa la igualtat»: el full del motor, amb l\'enunciat, l\'exemple i «Veure la solució» a cada igualtat',
    w.panell && w.cartes === 9 && w.veure === 9 && w.solucions === 0 && w.enunciat.startsWith('Completa escrivint (, ), +, −, ·, :, 2, √') && w.enunciatHtml.includes('<sup>2</sup>') &&
    w.exemple.includes(`${fi.exemple.t} → `) && w.igualtats.join('|') === fi.items.map(x => `${x.ns.join('')}=${x.t}`).join('|'), JSON.stringify(w).slice(0, 300));
  comprova('«Completa la igualtat»: el .tex és el del motor, i l\'adreça ho recorda',
    e.codi === Igualtats.fitxerTex(fi, { num: 2, seed: 'igu1', adreca: e.hash, versio: Motor.VERSIO }) &&
    /[#&]act=igu(&|$)/.test(e.hash) && /&ig=1(&|$)/.test(e.hash) && /&ri=0,0,0,0,0,0,0,0,0(&|$)/.test(e.hash), e.hash);
  await pag.click('#full .igualtat:nth-child(3) [data-ri]');
  const w2 = await web();
  comprova('«Completa la igualtat»: ↻ canvia només la seva igualtat',
    w2.igualtats[2] !== w.igualtats[2] && w2.igualtats.filter((x, i) => i !== 2).join() === w.igualtats.filter((x, i) => i !== 2).join() &&
    /&ri=0,0,1,0,0,0,0,0,0(&|$)/.test((await estat()).hash));
  await pag.click('[data-isol="solucionari"]');
  w = await web();
  const solIg = await llegeixBaixada(pag, '#baixa-sol');
  comprova('«Completa la igualtat», solucionari: les solucions a la vista i exN-sol.tex',
    w.veure === 0 && w.solucions === 9 && solIg.nom === 'ex2-sol.tex' && solIg.text.startsWith('% ex2-sol.tex — solucionari de ex2.tex — «Completa la igualtat»') &&
    (solIg.text.match(/\$[^$]*=\d+\$/g) || []).length === 9, solIg.text.slice(0, 200));
  await pag.uncheck('#ipar');
  await pag.uncheck('#iarr');
  w = await web();
  e = await estat();
  comprova('«Completa la igualtat»: sense parèntesis ni arrels, l\'enunciat no els diu', !w.enunciat.includes('(') && !w.enunciat.includes('√') &&
    w.enunciatHtml.includes('<sup>2</sup>') && /&ipar=0&/.test(e.hash) && !e.codi.includes('$($') && !e.codi.includes('\\sqrt{\\ }'), w.enunciat);
  await pag.click('[data-inom="4"]');
  await pag.click('[data-iesp="gran"]');
  const cols = await pag.evaluate(() => getComputedStyle(document.querySelector('#full .igualtats')).gridTemplateColumns.split(' ').length);
  e = await estat();
  const ratlla = await pag.evaluate(() => getComputedStyle(document.querySelector('#full .igualtats')).backgroundImage);
  comprova('«Completa la igualtat»: 4 nombres i espai gran, en 2 columnes separades per una línia discontínua (a la web i al .tex)',
    cols === 2 && /linear-gradient/.test(ratlla) && e.codi.includes('\\begin{tabular}{@{}p{\\dimexpr(\\linewidth-6mm-.4pt)/2\\relax}@{\\hspace{3mm}\\lower') &&
    e.codi.includes('\\xleaders'), `${cols} ${ratlla}`);
  await pag.click('[data-act="comb"]');
  comprova('tornant a «Operacions combinades», hi ha el seu full, igual que abans', JSON.stringify((await estat()).formules) === JSON.stringify(comb));
  const mi = await nova({ viewport: { width: 390, height: 844 } });
  await mi.goto(EINA + '#act=igu&inom=4&iesp=gran&seed=igu2');
  const mm = await mi.evaluate(() => ({ ample: document.documentElement.scrollWidth, finestra: document.documentElement.clientWidth }));
  comprova('«Completa la igualtat», al mòbil: la pàgina no es desplaça de costat', mm.ample <= mm.finestra, `${mm.ample} > ${mm.finestra}`);
  await mi.close();

  console.log('Panell');
  // Una pestanya nova (sense res desat): tres passos; plegats, en diuen el resum
  const pn = await nova({ viewport: { width: 1280, height: 900 } });
  await pn.goto(EINA + '#n=5&set=N&seed=panell&g=2');
  const panell = () => pn.evaluate(() => {
    const vis = id => getComputedStyle(document.getElementById(id)).display !== 'none';
    const txt = id => document.getElementById(id).textContent;
    return {
      oberts: [...document.querySelectorAll('#op-comb details, #entorn')].map(d => `${d.id}:${d.open ? 1 : 0}`).join(','),
      resums: ['resum-ex', 'resum-asp', 'resum-sol'].map(txt),
      onviuen: vis('onviuen') && txt('onviuen-que'), simp: vis('simp-l'), primers: vis('primers'), nomes: vis('nomes-l'), opsol: vis('opsol'),
      k: [...document.querySelectorAll('[data-k][aria-pressed=true]')].map(b => b.dataset.k).join(),
      resolts: document.querySelectorAll('#full .carta.resolt').length
    };
  });
  let pl = await panell();
  comprova('panell: «Exercicis» obert; «Aspecte», «Solucions» i «Entorn», plegats', pl.oberts === 'pas-ex:1,pas-asp:0,pas-sol:0,entorn:0', pl.oberts);
  comprova('panell: el resum dels passos plegats', pl.resums[0] === '5 · ℕ · només + − ·' && pl.resums[1] === 'espai mitjà · signes: petit' && pl.resums[2] === 'cap', pl.resums.join(' | '));
  comprova('panell: amb ℕ, ni «on hi pot haver negatius» ni «simplifica»; sense solucions, cap opció de la resolució',
    pl.onviuen === false && !pl.simp && !pl.primers && !pl.nomes && !pl.opsol, JSON.stringify(pl));
  await pn.click('[data-set="Z"]');
  pl = await panell();
  comprova('panell: amb ℤ, «on hi pot haver nombres negatius» (i el resum ho diu)', /negatius/.test(pl.onviuen) && !pl.simp && pl.resums[0].includes('ℤ'), JSON.stringify(pl));
  await pn.click('[data-set="Q"]');
  pl = await panell();
  comprova('panell: amb ℚ, fraccions i «simplifica fraccions a banda»', /fraccions/.test(pl.onviuen) && pl.simp, JSON.stringify(pl));
  await pn.click('#pas-sol > summary');
  await pn.click('[data-sol="guiades"]');
  pl = await panell();
  comprova('panell: «Ajuda parcial» en resol el primer, i en surt quants', pl.primers && pl.k === '1' && pl.resolts === 1 && pl.opsol && pl.resums[2].startsWith('ajuda parcial: 1 resolt'), JSON.stringify(pl));
  await pn.click('[data-sol="solucionari"]');
  await pn.check('#nomes');
  pl = await panell();
  comprova('panell: solucionari amb «només el resultat», sense les opcions de la resolució', pl.nomes && !pl.opsol && !pl.primers && pl.resums[2] === 'solucionari, només resultats', JSON.stringify(pl));
  await pn.reload();
  pl = await panell();
  comprova('panell: recorda quins passos tens oberts', pl.oberts === 'pas-ex:1,pas-asp:0,pas-sol:1,entorn:0', pl.oberts);
  comprova('panell: «↻ Full nou», al costat del títol del full', await pn.evaluate(() => !!document.querySelector('section .cap-full #tot')));
  // Els textos, curts (com els va demanar el professor)
  const textos = await pn.evaluate(() => ({
    nombres: [...document.querySelectorAll('[data-set]')].map(b => b.textContent).join(' '),
    sol: [...document.querySelectorAll('[data-sol]')].map(b => b.textContent).join(' | '),
    isol: [...document.querySelectorAll('[data-isol]')].map(b => b.textContent).join(' | '),
    caselles: ['cen', 'dest', 'simp'].map(id => document.getElementById(id).parentNode.textContent.trim()).join(' | '),
    entorn: document.querySelector('#entorn > summary').textContent,
    titols: [...document.querySelectorAll('aside h3')].map(h => h.textContent),
    sempre: document.querySelector('aside').textContent.includes('Sempre hi ha')
  }));
  comprova('panell: ℕ ℤ ℚ, només el símbol; «Cap», «Ajuda parcial» i «Solucionari», sense descripció; «Entorn», sol',
    textos.nombres === 'ℕ ℤ ℚ' && textos.sol === 'Cap | Ajuda parcial | Solucionari' && textos.isol === 'Cap | Solucionari' && textos.entorn === 'Entorn', JSON.stringify(textos));
  comprova('panell: «centrat seguint els símbols matemàtics», «destaca l\'operació següent» i «simplifica fraccions a banda»',
    textos.caselles === 'centrat seguint els símbols matemàtics | destaca l\'operació següent | simplifica fraccions a banda', textos.caselles);
  comprova('panell: ni «Sempre hi ha +, − i ·» ni el títol «Operacions»', !textos.sempre && !textos.titols.includes('Operacions'), textos.titols.join());
  // Entre els passos, plegats, hi ha espai
  await pn.evaluate(() => document.querySelectorAll('aside details').forEach(d => { d.open = false; }));
  const separacio = await pn.evaluate(() => {
    const s = ['pas-ex', 'pas-asp', 'pas-sol', 'entorn'].map(id => document.querySelector(`#${id} > summary`).getBoundingClientRect());
    return s.slice(1).map((x, i) => Math.round(x.top - s[i].bottom));
  });
  comprova('panell: entre dos passos hi ha espai (com a mínim 24 px)', separacio.every(x => x >= 24), separacio.join());
  // Cap opció perduda: hi són tots els controls d'abans
  const controls = ['#n', '#int', '#fin', '#forca', '#div', '#opo', '#pot', '#par', '#vs', '#cen', '#simp', '#dest', '#nomes', '#in', '#ipar', '#ipot', '#iarr', '#idiv', '#tot',
    ...['petit', 'mitja', 'gran'].flatMap(v => [`[data-esp="${v}"]`, `[data-sim="${v}"]`, `[data-iesp="${v}"]`]), ...['N', 'Z', 'Q'].map(v => `[data-set="${v}"]`),
    '[data-grad="0"]', '[data-grad="1"]', ...['cap', 'guiades', 'solucionari'].map(v => `[data-sol="${v}"]`), '[data-k="1"]', '[data-k="2"]', '[data-k="3"]',
    '[data-gra="prio"]', '[data-gra="op"]', '[data-inom="3"]', '[data-inom="4"]', '[data-isol="cap"]', '[data-isol="solucionari"]',
    '[data-entorn="main"]', '[data-entorn="headers"]', '[data-entorn="defs"]',
    '[data-tria="1"]', '[data-tria="2"]', ...Object.keys(Motor.COLORS).map(c => `[data-color="${c}"]`)];
  const falten = await pn.evaluate(cs => cs.filter(c => !document.querySelector(c)), controls);
  comprova(`panell: hi són tots els controls d'abans (${controls.length})`, !falten.length, falten.join(' '));
  await pn.close();

  comprova('cap error a la consola', !errors.length, errors.join(' | '));
  await nav.close();
  console.log(`\n${ok} correctes, ${ko} errors`);
  process.exit(ko ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
