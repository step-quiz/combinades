// tests/prova.js — node tests/prova.js  (cap dependència). Surt amb codi ≠ 0 si alguna cosa falla.
const Motor = require('../assets/motor.js');
let errors = 0;
const falla = (m) => { errors++; if (errors <= 20) console.log('FALLA:', m); };

// ── Analitzador INDEPENDENT del text TeX (BigInt), amb precedències habituals ──
const gcd = (a, b) => (b ? gcd(b, a % b) : a < 0n ? -a : a);
const Q = (n, d) => { if (d < 0n) { n = -n; d = -d; } const k = gcd(n, d) || 1n; return [n / k, d / k]; };
function llegeix(tex) {
  tex = tex.replace(/\\vphantom\{(?:[^{}]|\{[^{}]*\})*\}/g, '');   // la mida dels parèntesis no canvia el valor
  const tk = tex.replace(/\s+/g, '').match(/\\left\(|\\right\)|\\frac|\\cdot|\d+|[-+:()^{}]/g) || [];
  if (tk.join('').length !== tex.replace(/\s+/g, '').length) throw new Error('símbols desconeguts');
  let i = 0; const passos = [];
  const pas = (v) => (passos.push(v), v);
  const eat = (t) => { if (tk[i] !== t) throw new Error(`esperava ${t}, hi ha ${tk[i]}`); i++; };
  const num = () => { if (!/^\d+$/.test(tk[i] || '')) throw new Error('esperava número'); return BigInt(tk[i++]); };
  function atom() {
    let v;
    if (tk[i] === '\\frac') { i++; eat('{'); const p = num(); eat('}'); eat('{'); const q = num(); eat('}'); v = Q(p, q); }
    else if (tk[i] === '(' || tk[i] === '\\left(') { const cl = tk[i] === '(' ? ')' : '\\right)'; i++; v = expr(false); eat(cl); }
    else v = Q(num(), 1n);
    if (tk[i - 1] !== ')' && tk[i - 1] !== '\\right)') pas(v);           // fulla (un grup ja s'ha registrat a dins)
    if (tk[i] === '^') { i++; eat('{'); const k = num(); eat('}'); v = pas(Q(v[0] ** k, v[1] ** k)); }
    return v;
  }
  function term(neg) {
    let v = atom(); if (neg) v = pas(Q(-v[0], v[1]));
    while (tk[i] === '\\cdot' || tk[i] === ':') {
      const op = tk[i++], w = atom();
      v = pas(op === ':' ? Q(v[0] * w[1], v[1] * w[0]) : Q(v[0] * w[0], v[1] * w[1]));
    }
    return v;
  }
  function expr(topNivell) {
    let neg = false; if (tk[i] === '-') { i++; neg = true; }   // l'únic oposat sense parèntesi: al principi
    let v = term(neg);
    while (tk[i] === '+' || tk[i] === '-') {
      const op = tk[i++], w = term(false);
      v = pas(Q(op === '+' ? v[0] * w[1] + w[0] * v[1] : v[0] * w[1] - w[0] * v[1], v[1] * w[1]));
    }
    return v;
  }
  const v = expr(true);
  if (i !== tk.length) throw new Error('text sobrant');
  v.passos = passos; return v;
}

// Parèntesis d'agrupació: els que no envolten un sol nombre/fracció amb signe
function agrupacions(tex) {
  let s = tex.replace(/\\vphantom\{(?:[^{}]|\{[^{}]*\})*\}/g, '').replace(/\\left\(/g, '(').replace(/\\right\)/g, ')'), g = 0, m;
  const re = /\(([^()]*)\)/;
  while ((m = re.exec(s))) {
    if (!/^-?(\d+|\\frac\{\d+\}\{\d+\})$/.test(m[1])) g++;
    s = s.replace(re, '0');
  }
  return g;
}
const enConjunt = (l, [n, d]) => l === 'Q' || (d === 1n && (l === 'Z' || n >= 0n));

// ── Combinacions ──
const base = { n: 5, esp: 'mitja', sim: 'petit', set: 'N', int: 1, fin: 1, div: 0, opo: 0, pot: 0, par: 0, forca: 1 };
let combos = 0, total = 0;
for (const set of ['N', 'Z', 'Q'])
  for (const [int, fin] of set === 'N' ? [[1, 1]] : [[1, 0], [0, 1], [1, 1]])
    for (let m = 0; m < 16; m++) {
      const p = { ...base, set, int, fin, div: m & 1, pot: (m >> 1) & 1, par: (m >> 2) & 1, opo: (m >> 3) & 1 };
      if (!Motor.valida(p).ok) continue;
      combos++;
      const etq = `${set} int=${int} fin=${fin} div=${p.div} pot=${p.pot} par=${p.par} opo=${p.opo}`;
      const ant = new Set(); let mal = 0; const full = [];
      for (let i = 0; i < 100; i++) {
        const e = Motor.exercici(p, 'prova' + m, i, 0, ant); total++;
        if (e.error) { mal++; continue; }
        ant.add(e.tex); full.push({ i, e });
        try {
          const v = llegeix(e.tex);                                            // 2. re-lectura independent
          if (v[0] !== BigInt(e.valor.n) || v[1] !== BigInt(e.valor.d)) falla(`${etq}: valor ${v} ≠ ${e.valor.n}/${e.valor.d} a ${e.tex}`);
          const lf = set === 'N' || !p.fin ? 'N' : set;                        // 3. conjunt del resultat final
          if (!enConjunt(lf, v)) falla(`${etq}: resultat fora del conjunt a ${e.tex}`);
          const li = set === 'N' || !p.int ? 'N' : set, ps = v.passos, ult = ps[ps.length - 1];
          if (ult[0] !== v[0] || ult[1] !== v[1]) falla(`${etq}: l'últim pas no és el resultat a ${e.tex}`);
          if (!ps.slice(0, -1).every((x) => enConjunt(li, x))) falla(`${etq}: intermedi fora del conjunt a ${e.tex}`);
        } catch (x) { falla(`${etq}: no es pot llegir «${e.tex}» (${x.message})`); }
        if (!e.tex.includes('\\cdot') || !e.tex.includes('+')) falla(`${etq}: falten · o + a ${e.tex}`);   // 4. presència
        if (p.div && !e.tex.includes(':')) falla(`${etq}: falta : a ${e.tex}`);
        if (p.pot && !e.tex.includes('^')) falla(`${etq}: falta ^ a ${e.tex}`);
        if (p.opo && !e.tex.includes('-')) falla(`${etq}: falta oposat a ${e.tex}`);
        const g = agrupacions(e.tex);
        if (p.par ? g < 1 : g > 0) falla(`${etq}: agrupacions=${g} a ${e.tex}`);
      }
      if (mal > 1) falla(`${etq}: ${mal}/100 sense generar (< 99 %)`);          // 1. taxa d'èxit
      // 5. determinisme i 6. no repetits
      const a2 = new Set();
      full.forEach(({ i, e }) => { const x = Motor.exercici(p, 'prova' + m, i, 0, a2); a2.add(x.tex); if (x.tex !== e.tex) falla(`${etq}: no determinista (${i})`); });
      if (new Set(full.map(({ e }) => e.tex)).size !== full.length) falla(`${etq}: repetits`);
    }

// 5b. determinisme directe
const pd = { ...base, set: 'Z', div: 1, pot: 1, par: 1, opo: 1 };
if (Motor.exercici(pd, 'x', 0, 0).tex !== Motor.exercici(pd, 'x', 0, 0).tex) falla('no determinista');
if (Motor.exercici(pd, 'x', 0, 0).tex === Motor.exercici(pd, 'x', 0, 1).tex) falla('↻ no canvia res');

// 7. format del fitxer
const ex = [0, 1, 2].map((i) => Motor.exercici(pd, 'f', i, 0));
const f = Motor.fitxerTex(ex, { ...pd, n: 3 }, { num: 7, seed: 'f' });
const cnt = (re) => (f.match(re) || []).length;
if (cnt(/\\begin\{enumerate\}/g) !== 1 || cnt(/\\end\{enumerate\}/g) !== 1) falla('enumerate desequilibrat');
if (cnt(/\\item /g) !== 3) falla('nombre d\'\\item incorrecte');
if (!f.startsWith('% ex7.tex')) falla('capçalera del fitxer');

// parèntesis niuats: el de fora, més gran
{
  const t1 = Motor.exercici({ ...base, set: 'N', pot: 1, par: 1, div: 1 }, 'niu', 0, 0); // qualsevol
  let trobat = 0;
  for (let i = 0; i < 300 && !trobat; i++) {
    const e = Motor.exercici({ ...base, set: 'N', pot: 1, par: 1, div: 1 }, 'niu', i, 0);
    if (!e.error && /\\left\(\\vphantom\{\\big\|\}/.test(e.tex)) trobat++;
  }
  if (!trobat) falla('cap grup niuat amb \\vphantom{\\big|}');
}

// espai entre símbols
for (const sim of ['petit', 'mitja', 'gran']) {
  const fs_ = Motor.fitxerTex(ex, { ...pd, n: 3, sim }, { num: 1, seed: 'f' });
  if (!fs_.includes(`\\medmuskip=${Motor.SIMBOLS[sim].med}\\thickmuskip=${Motor.SIMBOLS[sim].thick}`)) falla(`espai entre símbols ${sim}`);
}
if (Object.keys(Motor.ESPAIS).join() !== 'petit,mitja,gran') falla('espais entre operacions');

// \vspace* opcional
const fv = Motor.fitxerTex(ex, { ...pd, n: 3, vs: 1 }, { num: 1, seed: 'f' });
if (!fv.includes('\\vspace*{') || f.includes('\\vspace*{')) falla('opció \\vspace*');
// previsualització: parèntesis allargats si hi ha fracció
const pf = { ...base, set: 'Q', int: 1, fin: 1, div: 1, pot: 1, par: 1 };
let allargats = 0;
for (let i = 0; i < 200; i++) { const e = Motor.exercici(pf, 'q', i, 0); if (!e.error && e.html.includes('class="pg"')) allargats++; }
if (!allargats) falla('cap parèntesi allargat a la previsualització');

// Entorn: assets/entorn.js ha de ser idèntic a tex/*.tex (paritat, com a exam2bat)
const fs = require('fs'), path = require('path'), Entorn = require('../assets/entorn.js');
for (const k of ['main', 'headers', 'defs']) {
  const font = fs.readFileSync(path.join(__dirname, '..', 'tex', k + '.tex'), 'utf8');
  if (Entorn[k] !== font) falla(`assets/entorn.js no coincideix amb tex/${k}.tex: executa python3 eines/entorn.py`);
}

// Progressió gradual
{
  const pg = { ...base, n: 10, set: 'Z', div: 1, pot: 1, par: 1, opo: 1, grad: 1 };
  const suma = Array(10).fill(0); let fulls = 0, primersBuits = 0;
  for (let s = 0; s < 200; s++) {
    const ant = new Set(); let buits = 0;
    for (let i = 0; i < 10; i++) {
      const e = Motor.exercici(pg, 'g' + s, i, 0, ant);
      if (e.error) { falla(`gradual: exercici ${i} sense generar`); continue; }
      ant.add(e.tex); suma[i] += e.extres.length;
      const q = e.params;                                        // presència segons els extres d'aquest exercici
      if (q.div && !e.tex.includes(':')) falla(`gradual: falta : a ${e.tex}`);
      if (q.pot && !e.tex.includes('^')) falla(`gradual: falta ^ a ${e.tex}`);
      if (q.par ? agrupacions(e.tex) < 1 : agrupacions(e.tex) > 0) falla(`gradual: parèntesis a ${e.tex}`);
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
  // immediata = comportament d'abans
  const pi = { ...pg, grad: 0 };
  if (Motor.exercici(pi, 'z', 0, 0).extres.length !== 4) falla('immediata: hauria de tenir tots els extres');
  console.log(`gradual: mitjana d'extres per exercici = ${suma.map((x) => (x / fulls).toFixed(2)).join(' ')}; fulls amb els 4 primers sense extres: ${primersBuits}/${fulls}`);
}

// valida(): casos impossibles
if (Motor.valida({ ...base, set: 'N', opo: 1 }).ok) falla('oposat amb ℕ hauria de ser impossible');

console.log(`${combos} combinacions, ${total} exercicis, ${errors} errors`);
process.exit(errors ? 1 : 0);
