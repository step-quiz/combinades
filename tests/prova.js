/* ===========================================================================
   tests/prova.js — Proves de la lògica (assets/motor.js). Només Node, cap
   dependència:

       node tests/prova.js

   Acaba amb codi 1 si alguna comprovació falla. La interfície es prova a
   tests/navegador.js (Playwright) i la compilació, a tests/compila.js (pdflatex).

   Les EMPREMTES (tests/empremtes.json) fixen quins exercicis surten per a cada
   combinació d'opcions. Si canvien, els fulls desats a l'adreça (#…) ja no
   tornaran a sortir iguals. Si ho has fet A PROPÒSIT, refés-les:

       node tests/prova.js --actualitza-empremtes
   =========================================================================== */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const Motor = require('../assets/motor.js');

let errors = 0;
const falla = (m) => { errors++; if (errors <= 20) console.log('FALLA:', m); };

/* ── Lector INDEPENDENT del TeX ───────────────────────────────────────────────
   Torna a calcular el valor a partir del text (amb BigInt, sense cap línia en
   comú amb motor.js) i, de passada, comprova que el TeX és el que ha de ser:
   - cada parèntesi es tanca amb la seva parella (\bigl( amb \bigr), …);
   - cada parèntesi és més gran que els de dins: sense fraccions, ( \bigl(
     \Bigl( \biggl( \Biggl( segons els nivells que té a dins; amb fraccions,
     \left…\right, i una alçada invisible més gran que la de dins si a dins hi
     ha més parèntesis;
   - el − d'un oposat no pot quedar darrere d'una cosa que el faci llegir com
     una resta: l'alçada invisible va dins de \mathopen, i davant d'un \left(
     hi ha \mathopen{} (els dos errors de la v0.1). */
const gcd = (a, b) => (b ? gcd(b, a % b) : a < 0n ? -a : a);
const Q = (n, d) => { if (d < 0n) { n = -n; d = -d; } const k = gcd(n, d) || 1n; return [n / k, d / k]; };
const TOKENS = /\\mathopen\{\\vphantom\{\\rule\[-[\d.]+em\]\{0pt\}\{[\d.]+em\}\}\}|\\mathopen\{\}|\\left\(|\\right\)|\\[bB]igg?l\(|\\[bB]igg?r\)|\\frac|\\cdot|\d+|[-+:()^{}]/g;
const MIDA = { '(': 0, '\\bigl(': 1, '\\Bigl(': 2, '\\biggl(': 3, '\\Biggl(': 4, '\\left(': 5 };
const tancament = (t) => (t === '(' ? ')' : t === '\\left(' ? '\\right)' : t.slice(0, -2) + 'r)');

function llegeix(tex) {
  const net = tex.replace(/\s+/g, '');
  const tk = net.match(TOKENS) || [];
  if (tk.join('') !== net) throw new Error('símbols desconeguts');
  let i = 0;
  const passos = [];   // cada valor, com a motor.js: fulles, oposats, potències i operacions
  const compte = { oposats: 0, potencies: 0, grups: 0, '+': 0, '-': 0, '*': 0, ':': 0 };
  const oberts = [];   // els parèntesis oberts, de fora a dins
  const pas = (v) => (passos.push(v), v);
  const eat = (t) => { if (tk[i] !== t) throw new Error(`esperava ${t}, hi ha ${tk[i]}`); i++; };
  const num = () => { if (!/^\d+$/.test(tk[i] || '')) throw new Error('esperava número'); return BigInt(tk[i++]); };

  function parentesi() {
    const t = tk[i++], ctx = { mida: MIDA[t], prof: 0, fraccio: false, alcada: 0, alcadaDins: 0 };
    const a = /^\\mathopen\{\\vphantom\{\\rule\[-[\d.]+em\]\{0pt\}\{([\d.]+)em\}/.exec(tk[i] || '');
    if (a) {
      if (t !== '\\left(') throw new Error("alçada invisible fora d'un \\left(");
      ctx.alcada = parseFloat(a[1]); i++;
    }
    oberts.push(ctx);
    const e = expr();
    eat(tancament(t));
    oberts.pop();
    const pare = oberts[oberts.length - 1];
    if (pare) { pare.prof = Math.max(pare.prof, ctx.prof + 1); pare.alcadaDins = Math.max(pare.alcadaDins, ctx.alcada); }
    if (ctx.fraccio !== (ctx.mida === 5)) throw new Error(ctx.fraccio ? "fracció dins d'un parèntesi de mida fixa" : '\\left( sense cap fracció');
    if (ctx.mida < 5 && ctx.mida !== Math.min(4, ctx.prof)) throw new Error(`parèntesi de mida ${t} amb ${ctx.prof} nivells a dins`);
    if (ctx.mida === 5 && !!ctx.prof !== !!ctx.alcada) throw new Error(ctx.prof ? '\\left( amb parèntesis a dins i sense alçada' : 'alçada sobrera');
    if (ctx.alcada && ctx.alcada <= ctx.alcadaDins) throw new Error('un \\left( no és més alt que els de dins');
    if (e.ops) compte.grups++;                                        // d'agrupació
    else if (!e.unari && !(ctx.fraccio && tk[i] === '^')) throw new Error('parèntesi sobrer');   // de notació: (−3), (2/3)²
    return e.v;
  }
  function atom() {
    let v;
    if (tk[i] === '\\frac') {
      i++; eat('{'); const p = num(); eat('}'); eat('{'); const q = num(); eat('}');
      v = pas(Q(p, q));
      oberts.forEach((c) => { c.fraccio = true; });
    } else if (tk[i] in MIDA) v = parentesi();
    else v = pas(Q(num(), 1n));
    if (tk[i] === '^') { i++; eat('{'); const k = num(); eat('}'); compte.potencies++; v = pas(Q(v[0] ** k, v[1] ** k)); }
    return v;
  }
  function term(neg) {
    let v = atom(), ops = 0;
    if (neg) v = pas(Q(-v[0], v[1]));
    while (tk[i] === '\\cdot' || tk[i] === ':') {
      const op = tk[i++] === ':' ? ':' : '*'; compte[op]++; ops++;
      const w = atom();
      v = pas(op === ':' ? Q(v[0] * w[1], v[1] * w[0]) : Q(v[0] * w[0], v[1] * w[1]));
    }
    return { v, ops };
  }
  function expr() {   // l'únic oposat sense parèntesi: al principi d'un grup
    let unari = false;
    if (tk[i] === '-') {
      i++; unari = true; compte.oposats++;
      if (tk[i] === '\\mathopen{}') { i++; if (tk[i] !== '\\left(') throw new Error('\\mathopen{} fora de lloc'); }
      else if (tk[i] === '\\left(') throw new Error('−\\left( sense \\mathopen{}: TeX hi deixa un espai');
    }
    const t = term(unari);
    let v = t.v, ops = t.ops;
    while (tk[i] === '+' || tk[i] === '-') {
      const op = tk[i++]; compte[op]++; ops++;
      const w = term(false);
      ops += w.ops;
      v = pas(Q(op === '+' ? v[0] * w.v[1] + w.v[0] * v[1] : v[0] * w.v[1] - w.v[0] * v[1], v[1] * w.v[1]));
    }
    return { v, ops, unari };
  }
  const e = expr();
  if (i !== tk.length) throw new Error('text sobrant');
  return { valor: e.v, passos, compte };
}

/* La previsualització, passada a text lineal, ha de dir el mateix que el TeX. */
const linealTex = (tex) => tex.replace(/\\mathopen\{\\vphantom\{(?:[^{}]|\{[^{}]*\})*\}\}/g, '').replace(/\\mathopen\{\}/g, '')
  .replace(/\\(?:left|[bB]igg?l)\(/g, '(').replace(/\\(?:right|[bB]igg?r)\)/g, ')').replace(/\s+/g, '');
const linealHtml = (html) => html
  .replace(/<span class="fr"><span>(\d+)<\/span><span>(\d+)<\/span><\/span>/g, '\\frac{$1}{$2}')
  .replace(/<span class="pg"><span class="pb"[^>]*>\(<\/span>/g, '(').replace(/<span class="pb"[^>]*>\)<\/span><\/span>/g, ')')
  .replace(/<span class="op">(.)<\/span>/g, (_, o) => ({ '−': '-', '·': '\\cdot' })[o] || o)
  .replace(/<sup[^>]*>(\d+)<\/sup>/g, '^{$1}').replace(/−/g, '-');

const enConjunt = (l, [n, d]) => l === 'Q' || (d === 1n && (l === 'Z' || n >= 0n));
const testimoni = (l, [n, d]) => (l === 'Z' ? n < 0n : l === 'Q' ? d !== 1n : true);
function recompteArbre(n, c = { neg: 0, pow: 0, '+': 0, '-': 0, '*': 0, ':': 0 }) {
  if (n.t === 'neg') c.neg++;
  if (n.t === 'pow') c.pow++;
  if (n.t === 'bin') { c[n.op]++; recompteArbre(n.l, c); recompteArbre(n.r, c); }
  if (n.a) recompteArbre(n.a, c);
  return c;
}

/* Tot el que ha de complir un exercici. p: les opcions del full. */
function revisa(etq, p, e) {
  let r;
  try { r = llegeix(e.tex); } catch (x) { falla(`${etq}: TeX incorrecte «${e.tex}» (${x.message})`); return null; }
  const { valor, passos, compte } = r, ult = passos[passos.length - 1], intermedis = passos.slice(0, -1);
  if (valor[0] !== BigInt(e.valor.n) || valor[1] !== BigInt(e.valor.d)) falla(`${etq}: valor ${valor} ≠ ${e.valor.n}/${e.valor.d} a ${e.tex}`);
  if (ult[0] !== valor[0] || ult[1] !== valor[1]) falla(`${etq}: l'últim pas no és el resultat a ${e.tex}`);
  // Conjunts: on viuen els intermedis i el resultat
  const li = p.set === 'N' || !p.int ? 'N' : p.set, lf = p.set === 'N' || !p.fin ? 'N' : p.set;
  if (!enConjunt(lf, valor)) falla(`${etq}: resultat fora del conjunt a ${e.tex}`);
  if (!intermedis.every((x) => enConjunt(li, x))) falla(`${etq}: intermedi fora del conjunt a ${e.tex}`);
  // «Força que apareguin»: un negatiu (ℤ) o una fracció (ℚ) on s'ha demanat
  if (p.forca) {
    if (li !== 'N' && !intermedis.some((x) => testimoni(li, x))) falla(`${etq}: força: cap intermedi de ${li} a ${e.tex}`);
    if (lf !== 'N' && !testimoni(lf, valor)) falla(`${etq}: força: el resultat no és de ${lf} a ${e.tex}`);
  }
  // Presència (q: les opcions d'aquest exercici; en mode gradual, no són les del full)
  const q = e.params;
  if (!compte['*'] || !compte['+'] || !compte['-']) falla(`${etq}: falta ·, + o − (resta) a ${e.tex}`);
  if (q.div && !compte[':']) falla(`${etq}: falta : a ${e.tex}`);
  if (q.pot && !compte.potencies) falla(`${etq}: falta potència a ${e.tex}`);
  if (q.opo && !compte.oposats) falla(`${etq}: falta oposat a ${e.tex}`);
  if (q.par ? compte.grups < 1 : compte.grups > 0) falla(`${etq}: grups=${compte.grups} a ${e.tex}`);
  // El TeX té exactament les operacions de l'arbre, i la previsualització diu el mateix
  const t = recompteArbre(e.arbre);
  if (t.neg !== compte.oposats || t.pow !== compte.potencies || ['+', '-', '*', ':'].some((o) => t[o] !== compte[o]))
    falla(`${etq}: el TeX no té les operacions de l'arbre a ${e.tex}`);
  if (linealHtml(e.html) !== linealTex(e.tex)) falla(`${etq}: la previsualització no diu el mateix que el TeX a ${e.tex}`);
  return r;
}

const base = { n: 5, esp: 'mitja', sim: 'petit', set: 'N', int: 1, fin: 1, div: 0, opo: 0, pot: 0, par: 0, forca: 1 };
const etiqueta = (p) => `${p.set} int=${p.int} fin=${p.fin} div=${p.div} pot=${p.pot} par=${p.par} opo=${p.opo} forca=${p.forca} grad=${p.grad || 0}`;

/* ── 1. Cada combinació, 100 exercicis seguits (immediata, força) ─────────── */
let combos = 0, total = 0;
for (const set of ['N', 'Z', 'Q'])
  for (const [int, fin] of set === 'N' ? [[1, 1]] : [[1, 0], [0, 1], [1, 1]])
    for (let m = 0; m < 16; m++) {
      const p = { ...base, set, int, fin, div: m & 1, pot: (m >> 1) & 1, par: (m >> 2) & 1, opo: (m >> 3) & 1 };
      if (!Motor.valida(p).ok) continue;
      combos++;
      const etq = etiqueta(p), ant = new Set(), full = [];
      let mal = 0;
      for (let i = 0; i < 100; i++) {
        const e = Motor.exercici(p, 'prova' + m, i, 0, ant); total++;
        if (e.error) { mal++; continue; }
        ant.add(e.tex); full.push({ i, e });
        revisa(etq, p, e);
      }
      if (mal > 1) falla(`${etq}: ${mal}/100 sense generar (< 99 %)`);          // taxa d'èxit
      const a2 = new Set();                                                     // determinisme
      full.forEach(({ i, e }) => { const x = Motor.exercici(p, 'prova' + m, i, 0, a2); a2.add(x.tex); if (x.tex !== e.tex) falla(`${etq}: no determinista (${i})`); });
      if (new Set(full.map(({ e }) => e.tex)).size !== full.length) falla(`${etq}: repetits`);
    }

/* ── 2. TOTES les combinacions (també sense força i graduals): un full de 10
   cadascuna, que es revisa sencer i en dona l'empremta ───────────────────── */
const canonic = (x) => (Array.isArray(x) ? '[' + x.map(canonic).join(',') + ']'
  : x && typeof x === 'object' ? '{' + Object.keys(x).sort().map((k) => JSON.stringify(k) + ':' + canonic(x[k])).join(',') + '}'
  : JSON.stringify(x));
const empremtes = {};
let combosTotes = 0;
for (const set of ['N', 'Z', 'Q'])
  for (const [int, fin] of set === 'N' ? [[1, 1]] : [[1, 0], [0, 1], [1, 1]])
    for (let m = 0; m < 64; m++) {
      const p = { ...base, n: 10, set, int, fin, div: m & 1, pot: (m >> 1) & 1, par: (m >> 2) & 1, opo: (m >> 3) & 1, forca: (m >> 4) & 1, grad: (m >> 5) & 1 };
      if (!Motor.valida(p).ok) continue;
      combosTotes++;
      const etq = etiqueta(p), ant = new Set(), h = crypto.createHash('sha256');
      for (let i = 0; i < p.n; i++) {
        const e = Motor.exercici(p, 'empremta', i, 0, ant); total++;
        if (e.error) { falla(`${etq}: l'exercici ${i + 1} no surt`); h.update('error|'); continue; }
        ant.add(e.tex); h.update(canonic(e.arbre) + '|');
        revisa(etq, p, e);
      }
      empremtes[etq] = h.digest('hex').slice(0, 16);
    }
const fitxerEmpremtes = path.join(__dirname, 'empremtes.json');
if (process.argv.includes('--actualitza-empremtes')) {
  fs.writeFileSync(fitxerEmpremtes, JSON.stringify(empremtes, null, 1) + '\n');
  console.log(`tests/empremtes.json refet (${Object.keys(empremtes).length} combinacions)`);
} else {
  let desades = {};
  try { desades = JSON.parse(fs.readFileSync(fitxerEmpremtes, 'utf8')); } catch (e) { falla('no es pot llegir tests/empremtes.json'); }
  const canviades = Object.keys(empremtes).filter((k) => desades[k] !== empremtes[k]);
  if (canviades.length || Object.keys(desades).length !== Object.keys(empremtes).length)
    falla(`els exercicis han canviat en ${canviades.length} combinacions (p. ex. ${canviades[0]}): els fulls desats ja no sortiran iguals. ` +
      'Si és a propòsit: node tests/prova.js --actualitza-empremtes');
}

/* ── 3. Determinisme directe i ↻ ──────────────────────────────────────────── */
const pd = { ...base, set: 'Z', div: 1, pot: 1, par: 1, opo: 1 };
if (Motor.exercici(pd, 'x', 0, 0).tex !== Motor.exercici(pd, 'x', 0, 0).tex) falla('no determinista');
if (Motor.exercici(pd, 'x', 0, 0).tex === Motor.exercici(pd, 'x', 0, 1).tex) falla('↻ no canvia res');

/* ── 4. El fitxer .tex ────────────────────────────────────────────────────── */
const ex = [0, 1, 2].map((i) => Motor.exercici(pd, 'f', i, 0));
const f = Motor.fitxerTex(ex, { ...pd, n: 3 }, { num: 7, seed: 'f' });
const cnt = (re) => (f.match(re) || []).length;
if (cnt(/\\begin\{enumerate\}/g) !== 1 || cnt(/\\end\{enumerate\}/g) !== 1) falla('enumerate desequilibrat');
if (cnt(/\\item /g) !== 3) falla("nombre d'\\item incorrecte");
if (!f.startsWith('% ex7.tex')) falla('capçalera del fitxer');
if (f.includes('per refer')) falla("sense adreça, el .tex no ha de dir com refer-lo");
const fa = Motor.fitxerTex(ex, { ...pd, n: 3 }, { num: 7, seed: 'f', adreca: '#n=3&seed=f' });
if (!fa.includes('% per refer aquest full: index.html#n=3&seed=f\n')) falla("el .tex no porta l'adreça del full");
for (const sim of ['petit', 'mitja', 'gran']) {                                // espai entre símbols
  const fs_ = Motor.fitxerTex(ex, { ...pd, n: 3, sim }, { num: 1, seed: 'f' });
  if (!fs_.includes(`\\medmuskip=${Motor.SIMBOLS[sim].med}\\thickmuskip=${Motor.SIMBOLS[sim].thick}`)) falla(`espai entre símbols ${sim}`);
}
if (Object.keys(Motor.ESPAIS).join() !== 'petit,mitja,gran') falla('espais entre operacions');
const fv = Motor.fitxerTex(ex, { ...pd, n: 3, vs: 1 }, { num: 1, seed: 'f' });  // \vspace* opcional
if (!fv.includes('\\vspace*{') || f.includes('\\vspace*{')) falla('opció \\vspace*');

/* ── 5. Parèntesis: n'hi ha de niuats (la regla de mides es fa servir de debò) ─ */
{
  const pn = { ...base, set: 'Z', pot: 1, par: 1, div: 1, opo: 1 }, pq = { ...base, set: 'Q', div: 1, pot: 1, par: 1, opo: 1 };
  let big = 0, Big = 0, alcada = 0, allargats = 0;
  for (let i = 0; i < 300; i++) {
    const e = Motor.exercici(pn, 'niu', i, 0), g = Motor.exercici(pq, 'q', i, 0);
    if (!e.error && e.tex.includes('\\bigl(')) big++;
    if (!e.error && e.tex.includes('\\Bigl(')) Big++;
    if (!g.error && g.tex.includes('\\mathopen{\\vphantom')) alcada++;
    if (!g.error && g.html.includes('class="pg"')) allargats++;
  }
  if (!big || !Big) falla(`parèntesis niuats: \\bigl( ${big}, \\Bigl( ${Big}`);
  if (!alcada) falla('cap grup amb fraccions i parèntesis a dins (alçada invisible)');
  if (!allargats) falla('cap parèntesi allargat a la previsualització');
}

/* ── 6. Entorn: assets/entorn.js ha de ser idèntic a tex/*.tex ────────────── */
const Entorn = require('../assets/entorn.js');
for (const k of ['main', 'headers', 'defs']) {
  const font = fs.readFileSync(path.join(__dirname, '..', 'tex', k + '.tex'), 'utf8');
  if (Entorn[k] !== font) falla(`assets/entorn.js no coincideix amb tex/${k}.tex: executa python3 eines/entorn.py`);
}

/* ── 7. Progressió gradual ────────────────────────────────────────────────── */
{
  const pg = { ...base, n: 10, set: 'Z', div: 1, pot: 1, par: 1, opo: 1, grad: 1 };
  const suma = Array(10).fill(0);
  let fulls = 0, primersBuits = 0;
  for (let s = 0; s < 200; s++) {
    const ant = new Set();
    let buits = 0;
    for (let i = 0; i < 10; i++) {
      const e = Motor.exercici(pg, 'g' + s, i, 0, ant);
      if (e.error) { falla(`gradual: exercici ${i} sense generar`); continue; }
      ant.add(e.tex); suma[i] += e.extres.length;
      revisa('gradual', pg, e);                                  // presència segons els extres d'aquest exercici
      if (i >= 8 && e.extres.length !== 4) falla(`gradual: l'exercici ${i + 1} no té tots els extres`);
      if (i < 4 && !e.extres.length) buits++;
      if (Motor.exercici(pg, 'g' + s, i, 3).extres.join() !== e.extres.join()) falla('gradual: ↻ canvia el nivell');
    }
    fulls++; if (buits === 4) primersBuits++;
  }
  const mitja = (a, b) => suma.slice(a, b).reduce((x, y) => x + y, 0) / (b - a) / fulls;
  if (!(mitja(0, 4) < mitja(4, 8) && mitja(4, 8) < 4)) falla(`gradual: no creix (${mitja(0, 4)}, ${mitja(4, 8)})`);
  if (!primersBuits) falla('gradual: els 4 primers no surten mai sense extres');
  // ℚ només final: div i par no es poden treure mai
  const pq = { ...base, n: 10, set: 'Q', int: 0, fin: 1, div: 1, par: 1, pot: 1, grad: 1 };
  for (let i = 0; i < 10; i++) { const e = Motor.exercici(pq, 'q', i, 0); if (e.error || !e.params.div || !e.params.par) falla(`gradual ℚ final: ${i}`); }
  // immediata = tots els extres a tots els exercicis
  if (Motor.exercici({ ...pg, grad: 0 }, 'z', 0, 0).extres.length !== 4) falla('immediata: hauria de tenir tots els extres');
  console.log(`gradual: mitjana d'extres per exercici = ${suma.map((x) => (x / fulls).toFixed(2)).join(' ')}; fulls amb els 4 primers sense extres: ${primersBuits}/${fulls}`);
}

/* ── 8. valida(): les tres combinacions impossibles ───────────────────────── */
if (Motor.valida({ ...base, set: 'N', opo: 1 }).ok) falla('oposat amb ℕ hauria de ser impossible');
if (Motor.valida({ ...base, set: 'Z', int: 0, fin: 1, opo: 1 }).ok) falla('oposat sense «intermedis» hauria de ser impossible');
if (Motor.valida({ ...base, set: 'Q', int: 0, fin: 1, div: 1, par: 0 }).ok) falla('ℚ només final sense parèntesis hauria de ser impossible');
if (!Motor.valida({ ...base, set: 'Q', int: 0, fin: 1, div: 1, par: 1 }).ok) falla('ℚ només final amb divisions i parèntesis és possible');

console.log(`${combos} combinacions (i ${combosTotes} amb força i gradual), ${total} exercicis, ${errors} errors`);
process.exit(errors ? 1 : 0);
