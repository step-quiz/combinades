/* ===========================================================================
   tests/prova.js — Proves de la lògica (assets/motor.js). Només Node, cap
   dependència:

       node tests/prova.js

   Acaba amb codi 1 si alguna comprovació falla. La interfície es prova a
   tests/navegador.js (Playwright) i la compilació, a tests/compila.js (pdflatex).

   Les EMPREMTES (tests/empremtes.json) fixen quins exercicis surten per a cada
   combinació d'opcions i cada versió del generador (g). Si canvien, els fulls
   desats a l'adreça (#…) ja no tornaran a sortir iguals. Les d'un generador
   antic no es poden refer mai (cal un generador nou: todo.md §6.3); les de
   l'últim, només mentre encara no s'ha publicat:

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
  // grups: d'agrupació (contenen una operació). parells: tots els que es veuen menys els d'un sol
  // nombre o fracció, (−3) i (2/3)²; (−(2+3)) en té dos. És el «quants parèntesis» del generador 2.
  const compte = { oposats: 0, potencies: 0, grups: 0, parells: 0, '+': 0, '-': 0, '*': 0, ':': 0 };
  let tipus;           // el de l'últim àtom llegit: 'fulla' (nombre o fracció), 'parentesi' o 'potencia'
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
    if (!e.sol) compte.parells++;
    return e.v;
  }
  function atom() {
    let v;
    if (tk[i] === '\\frac') {
      i++; eat('{'); const p = num(); eat('}'); eat('{'); const q = num(); eat('}');
      v = pas(Q(p, q));
      oberts.forEach((c) => { c.fraccio = true; });
      tipus = 'fulla';
    } else if (tk[i] in MIDA) { v = parentesi(); tipus = 'parentesi'; }
    else { v = pas(Q(num(), 1n)); tipus = 'fulla'; }
    if (tk[i] === '^') { i++; eat('{'); const k = num(); eat('}'); compte.potencies++; v = pas(Q(v[0] ** k, v[1] ** k)); tipus = 'potencia'; }
    return v;
  }
  function term(neg) {
    let v = atom(), ops = 0;
    const fulla = tipus === 'fulla';
    if (neg) v = pas(Q(-v[0], v[1]));
    while (tk[i] === '\\cdot' || tk[i] === ':') {
      const op = tk[i++] === ':' ? ':' : '*'; compte[op]++; ops++;
      const w = atom();
      v = pas(op === ':' ? Q(v[0] * w[1], v[1] * w[0]) : Q(v[0] * w[0], v[1] * w[1]));
    }
    return { v, ops, fulla };
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
    return { v, ops, unari, sol: !ops && t.fulla };   // sol: un sol nombre o fracció, amb signe o sense
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
  if (q.parentesis !== undefined) {
    if (compte.parells !== q.parentesis) falla(`${etq}: ${compte.parells} parèntesis i n'hi havien de ser ${q.parentesis} a ${e.tex}`);
  } else if (q.par ? compte.grups < 1 : compte.grups > 0) falla(`${etq}: grups=${compte.grups} a ${e.tex}`);
  if (p.g >= 2 && compte.parells > 3) falla(`${etq}: més de 3 parèntesis a ${e.tex}`);
  // El TeX té exactament les operacions de l'arbre, i la previsualització diu el mateix
  const t = recompteArbre(e.arbre);
  if (t.neg !== compte.oposats || t.pow !== compte.potencies || ['+', '-', '*', ':'].some((o) => t[o] !== compte[o]))
    falla(`${etq}: el TeX no té les operacions de l'arbre a ${e.tex}`);
  if (linealHtml(e.html) !== linealTex(e.tex)) falla(`${etq}: la previsualització no diu el mateix que el TeX a ${e.tex}`);
  return r;
}

/* ── El solucionari: tot el que ha de complir la resolució d'un exercici ──────
   Cada línia es torna a llegir amb el lector independent (mateix valor que
   l'enunciat, valors dins del conjunt), i l'ordre dels passos es comprova
   amb les regles del professor (todo.md §5) escrites aquí pel seu compte. */
const PREC_PROVA = { '+': 1, '-': 1, '*': 2, ':': 2 };
const totsNodes = (n) => [n].concat(n.t === 'bin' ? totsNodes(n.l).concat(totsNodes(n.r)) : n.a ? totsNodes(n.a) : []);
/** El focus: el primer grup (en ordre de lectura) que no en té cap altre a dins. */
function focusProva(T) {
  const grups = [];
  (function recorre(n, pare, costat) {
    if (n.t === 'bin') {
      if (pare && (pare.t !== 'bin' || PREC_PROVA[n.op] < PREC_PROVA[pare.op] || (PREC_PROVA[n.op] === PREC_PROVA[pare.op] && costat === 'r'))) grups.push(n);
      recorre(n.l, n, 'l'); recorre(n.r, n, 'r');
    } else if (n.a) recorre(n.a, n);
  })(T, null);
  return grups.find((g) => !grups.some((h) => h !== g && totsNodes(g).includes(h))) || T;
}
/** El que toca fer a T: simplificar; i, dins del focus, −(−a), potències, · i :, la regla dels signes, + i −. */
function esperat(T, unaOp) {
  const bruts = totsNodes(T).filter((n) => n.t === 'val' && n.brut);
  if (bruts.length) return { tipus: 'simplifica', nodes: bruts };
  const F = totsNodes(focusProva(T)), v = (n) => n.t === 'val';
  const nivells = [
    ['signes', F.filter((n) => n.t === 'neg' && v(n.a)), true],
    ['potencia', F.filter((n) => n.t === 'pow' && v(n.a)), true],
    ['producte', F.filter((n) => n.t === 'bin' && (n.op === '*' || n.op === ':') && v(n.l) && v(n.r)), true],
    ['signes', F.filter((n) => n.t === 'bin' && (n.op === '+' || n.op === '-') && v(n.r) && n.r.n < 0).map((n) => n.r), false]
  ];
  for (const [tipus, nodes, unaSola] of nivells) if (nodes.length) return { tipus, nodes: unaOp && unaSola ? nodes.slice(0, 1) : nodes };
  const s = F.find((n) => n.t === 'bin' && v(n.l) && v(n.r));
  return { tipus: s.l.d !== s.r.d ? 'mcm' : 'suma', nodes: [s] };
}
/** «Destaca la següent operació»: a la línia k de la resolució (0, l'enunciat), el que es calcula a la següent va
    dins d'una caixa del color k % 2 + 1, {\color{destacaK}\boxed{…}}; i el que surt de les caixes de la línia
    d'abans, del color d'aquelles, {\color{destacaK}…}. Torna el text sense les marques i, per ordre, les caixes i
    els resultats: [{s, k}], el text (sense marques) i el color; i marques, tots dos per ordre ('c1', 'r2'…). */
function destacats(tex) {
  const caixes = [], res = [], marques = [];
  const desfa = (t) => {
    let out = '';
    for (let i = 0; i < t.length;) {
      const m = /^\{\\color\{destaca([12])\}(\\boxed\{)?/.exec(t.slice(i));
      if (!m) { out += t[i++]; continue; }
      let j = i + m[0].length, d = m[2] ? 2 : 1;
      const ini = j;
      for (; d && j < t.length; j++) { if (t[j] === '{') d++; else if (t[j] === '}') d--; }
      if (d) throw new Error('destacat mal tancat');
      if (m[2] && t[j - 2] !== '}') throw new Error('caixa mal tancada');
      const x = { k: +m[1] };
      (m[2] ? caixes : res).push(x);
      marques.push((m[2] ? 'c' : 'r') + m[1]);
      x.s = desfa(t.slice(ini, j - (m[2] ? 2 : 1)));
      out += x.s;
      i = j;
    }
    return out;
  };
  return { net: desfa(tex), caixes, res, marques };
}
const sensDestacats = (tex) => destacats(tex).net;
/** L'HTML sense les marques de «destaca»: les caixes (<span class="dest caixa kK">…</span>; a «centrat», <span
    class="caixa kK">) i els resultats (<span class="kK">…</span>), que poden tenir altres span a dins. */
function sensCaixesHtml(html) {
  const OBRE = /<span class="(?:dest )?(?:caixa )?k[12]">/;
  for (let m; (m = OBRE.exec(html));) {
    const i = m.index;
    let j = i + m[0].length, d = 1;
    while (d) {
      const o = html.indexOf('<span', j), c = html.indexOf('</span>', j);
      if (c < 0) throw new Error('caixa mal tancada');
      if (o >= 0 && o < c) { d++; j = o + 5; } else { d--; j = c + 7; }
    }
    html = html.slice(0, i) + html.slice(i + m[0].length, j - 7) + html.slice(j);
  }
  return html;
}
/** Els colors de les marques d'una línia HTML, per ordre: caixes (c) i resultats (r). */
const colorsHtml = (html) => [...html.matchAll(/<span class="(dest caixa |caixa )?k([12])">/g)].map(([, cx, k]) => (cx ? 'c' : 'r') + k).join(' ');
/** Els valors d'un tros de TeX (el contingut d'una caixa o un resultat), en valor absolut: −(2·3) dona −6, i la
    regla dels signes, 5 − (−3) → 5 + 3, canvia el signe del que hi havia a la caixa. */
const absolut = (tex) => {
  const [n, d] = llegeix(tex.replace(/-(?=\\left\()/g, '-\\mathopen{}')).valor;   // −{…\left(…} ja no el necessita
  return `${n < 0n ? -n : n}/${d}`;
};
/** «Destaca», línia a línia (tex, de resolucio amb dest): les caixes de la línia k, del color k % 2 + 1 (totes les
    línies en tenen, menys l'última); els resultats, del de la línia d'abans: un per caixa, i amb el seu valor. */
function revisaColors(nom, tex) {
  const ls = tex.map(destacats);
  ls.forEach((l, k) => {
    const ultima = k === ls.length - 1, abans = k ? ls[k - 1] : null;
    if (ultima === !!l.caixes.length) falla(`${nom}: la línia ${k} ${ultima ? 'és l\'última i té' : 'no té'} res destacat`);
    if (l.caixes.some((x) => x.k !== k % 2 + 1)) falla(`${nom}: a la línia ${k}, una caixa que no és del color ${k % 2 + 1}: ${tex[k]}`);
    if (l.res.some((x) => x.k !== (k + 1) % 2 + 1)) falla(`${nom}: a la línia ${k}, un resultat que no és del color de la línia d'abans: ${tex[k]}`);
    if (!abans) { if (l.res.length) falla(`${nom}: un resultat a l'enunciat`); return; }
    let parells;
    try { parells = l.res.map((x, i) => [absolut(x.s), abans.caixes[i] && absolut(abans.caixes[i].s)]); } catch (x) { falla(`${nom}: ${x.message} a «${tex[k]}»`); return; }
    if (l.res.length !== abans.caixes.length || parells.some(([a, b]) => a !== b))
      falla(`${nom}: a la línia ${k}, els resultats no són els de les caixes d'abans: «${tex[k - 1]}» → «${tex[k]}»`);
  });
}
/* «Centrat»: l'array del .tex i la taula de l'HTML, llegits pel seu compte.
   Cada fila: [{a, b, s}], el text s a les columnes [a, b); l'última cel·la de
   cada fila menys de l'última és el «=». Amb «destaca», una cel·la pot ser una
   caixa (caixa: el color, 1 o 2): a dins, els seus trossos (trossos: [{a, b,
   s}], cadascun a la seva columna), les files invisibles de l'array de dins
   (fantasmes) i les mesures del primer tros i de l'últim, per al marc. */
function treuVphantoms(s) {                         // \vphantom{…}, amb claus dins
  for (let i; (i = s.indexOf('\\vphantom{')) >= 0;) {
    let j = i + 10, d = 1;
    for (; d && j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}') d--; }
    s = s.slice(0, i) + s.slice(j);
  }
  return s;
}
/** El grup entre claus que comença a s[i]: el que hi ha a dins, i on acaba (just després de la clau que tanca). */
function entreClaus(s, i) {
  if (s[i] !== '{') throw new Error(`esperava «{» a «${s.slice(i, i + 40)}»`);
  let d = 0, j = i;
  for (; j < s.length; j++) if (s[j] === '{') d++; else if (s[j] === '}' && !--d) break;
  if (j >= s.length) throw new Error('una clau sense tancar');
  return { dins: s.slice(i + 1, j), fi: j + 1 };
}
/** s partit per sep, fora de les claus. */
function parteix(s, sep) {
  const out = [];
  let d = 0, ini = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') d++;
    else if (s[i] === '}') d--;
    else if (!d && s.startsWith(sep, i)) { out.push(s.slice(ini, i)); ini = i + sep.length; i += sep.length - 1; }
  }
  return out.concat(s.slice(ini));
}
/** Les cel·les d'una fila d'un array, des de la columna a0: \multicolumn{n} i \multispan{n} en ocupen n. */
function cellesFila(fila, a0, sep) {
  let a = a0;
  return parteix(fila, sep).map((c) => {
    const mc = /^\\multicolumn\{(\d+)\}\{@\{\}c@\{\}\}\{([\s\S]*)\}$/.exec(c) || /^\\multispan\{(\d+)\}\$(?:\\displaystyle)?\\hphantom\{([\s\S]*)\}\$$/.exec(c);
    const cel = { a, b: a + (mc ? +mc[1] : 1), s: mc ? mc[2] : c };
    a = cel.b;
    return cel;
  });
}
/** El marc d'una caixa de «centrat», del primer tros (l) a l'últim (r), 1,2 pt cap endins; 2,5 pt per sobre i per
    sota del contingut (\box0), i el gruix del \boxed. */
const MARC = (l, r) => `\\rlap{\\kern\\dimexpr${l}+1.2pt\\relax\\lower\\dimexpr\\dp0+2.5pt\\relax\\vbox{\\hrule height.4pt\\hbox to\\dimexpr\\wd0-${l}-${r}-2.4pt\\relax`
  + '{\\vrule width.4pt height\\dimexpr\\ht0+2.1pt\\relax depth\\dimexpr\\dp0+2.1pt\\relax\\hfil\\vrule width.4pt}\\hrule height.4pt}}\\box0';
const ARRAY = /^\\def\\arraystretch\{0\}\$\\begin\{array\}\[b\]\{@\{\}\*\{(\d+)\}\{c@\{\}\}\}([\s\S]*)\\end\{array\}\$$/;
/** Un array de dins d'una caixa, des de la columna a0: les seves files invisibles (i la de la vista, si n'hi ha). */
function arrayDeDins(x, a0, b0) {
  const ar = ARRAY.exec(x);
  if (!ar || +ar[1] !== b0 - a0) throw new Error(`un array de dins que no té les columnes ${a0}–${b0}`);
  const files = ar[2].split('\\cr'), vista = files.pop();
  return { fantasmes: files.map((f) => cellesFila(f, a0, '&')), vista: vista ? cellesFila(vista, a0, '&') : [] };
}
/** Una caixa (o null si la cel·la no ho és). */
function llegeixCaixa(s, a0, b0) {
  const m = /^\\color\{destaca([12])\}\\setbox0\\hbox/.exec(s);
  if (!m) return null;
  const h0 = entreClaus(s, m[0].length), resta = s.slice(h0.fi);
  if (!ARRAY.test(h0.dins)) {                                     // d'un sol tros
    const u = /^\$([\s\S]*)\$$/.exec(h0.dins);
    if (!u || resta !== MARC('0pt', '0pt')) throw new Error(`una caixa d'un tros incorrecta: ${s.slice(0, 120)}`);
    return { caixa: +m[1], trossos: [{ a: a0, b: b0, s: u[1] }], fantasmes: [] };
  }
  const dins = arrayDeDins(h0.dins, a0, b0), trossos = dins.vista, u = trossos[0], z = trossos[trossos.length - 1];
  if (z.b !== b0) throw new Error('els trossos de la caixa no n\'omplen les columnes');
  // Les mesures: les columnes del primer tros (\box2) i el tros (\box4); les de l'últim (\box6) i el tros (\box8)
  let r = resta;
  const mesures = [2, 4, 6, 8].map((n) => {
    const pre = `\\setbox${n}\\hbox`;
    if (!r.startsWith(pre)) throw new Error(`falta \\setbox${n} a la caixa`);
    const g = entreClaus(r, pre.length);
    r = r.slice(g.fi);
    return g.dins;
  });
  if (r !== MARC('(\\wd2-\\wd4)/2', '(\\wd6-\\wd8)/2')) throw new Error(`el marc de la caixa: ${r.slice(0, 120)}`);
  const tros = (x) => { const t = /^\$([\s\S]*)\$$/.exec(x); if (!t) throw new Error('una mesura que no és un tros'); return t[1]; };
  return {
    caixa: +m[1], trossos, fantasmes: dins.fantasmes,
    primer: { fantasmes: arrayDeDins(mesures[0], u.a, u.b).fantasmes, tros: tros(mesures[1]) },
    ultim: { fantasmes: arrayDeDins(mesures[2], z.a, z.b).fantasmes, tros: tros(mesures[3]) }
  };
}
function llegeixBloc(tex) {
  const m = /^\\begin\{array\}\[t\]\{@\{\}\*\{(\d+)\}\{c@\{\}\}\}\n([\s\S]*)\n\\end\{array\}$/.exec(tex);
  if (!m) throw new Error('no és un array «centrat»');
  const files = [], fantasmes = [];
  for (const l of m[2].split('\n')) {
    if (/^\\multispan\{\d+\}\$/.test(l)) fantasmes.push(cellesFila(l.replace(/\\cr$/, ''), 0, '&'));   // d'un altre bloc
    else if (l.startsWith('\\multispan{')) throw new Error(`una fila de ratlles: ${l}`);             // (el subratllat d'abans)
    else {
      files.push(cellesFila(l.replace(/ \\\\(\\noalign\{\\vskip \d+pt\})?$/, ''), 0, ' & ').map((cel) => {
        const cx = llegeixCaixa(cel.s, cel.a, cel.b);
        return cx ? Object.assign(cel, cx) : cel;
      }));
    }
  }
  return { columnes: +m[1], files, fantasmes };
}
/** Una fila, amb les caixes desplegades: tots els trossos, cadascun a les seves columnes. */
const plana = (f) => f.flatMap((x) => x.trossos || [x]);
/** Una resolució llarga va en blocs (un array cadascun, l'un sota l'altre); cadascun porta, invisibles, les
    línies dels altres, perquè les columnes facin el mateix ample: les mateixes columnes i el mateix text. */
function llegeixArray(tex) {
  const blocs = tex.split(/\$\\\\\[\d+pt\]\n\$/).map(llegeixBloc);
  const clau = (f) => f.map((x) => `${x.a}:${x.b}:${celTex(x.s)}`).join('|');
  blocs.forEach((b, j) => {
    const altres = blocs.filter((x, i) => i !== j).flatMap((x) => x.files.map(plana));
    if (b.columnes !== blocs[0].columnes || b.fantasmes.map(clau).join('\n') !== altres.map(clau).join('\n'))
      throw new Error(`el bloc ${j + 1} no porta, invisibles, les línies dels altres`);
  });
  return { columnes: blocs[0].columnes, files: blocs.flatMap((b) => b.files), blocs };
}
/** La taula de l'HTML: [{a, b, s, cl}] (cl: les classes de la cel·la). */
function llegeixTaula(html) {
  const m = /^<table class="centrat">((?:<tr>.*?<\/tr>)*)<\/table>$/.exec(html);
  if (!m) throw new Error('no és una taula «centrat»');
  return [...m[1].matchAll(/<tr>(.*?)<\/tr>/g)].map(([, tr]) => {
    let a = 0;
    return [...tr.matchAll(/<td(?: class="([^"]*)")?(?: colspan="(\d+)")?>(.*?)<\/td>/g)].map(([, cl, k, s]) => {
      const cel = { a, b: a + (+k || 1), cl: (cl || '').split(' ').filter(Boolean) };
      cel.s = cel.cl.includes('igual') ? '=' : s;
      a = cel.b;
      return cel;
    });
  });
}
/** El text lineal d'una cel·la del .tex: sense l'aire dels nombres (\kern3pt), ni \displaystyle, ni el color i la
    caixa de «destaca», ni els {} dels operadors, ni el \vphantom d'una meitat de parèntesi. */
const desfaCaixa = (s) => {                         // tots els \boxed{…} (el d'una potència, a dins d'una cel·la)
  for (let i; (i = s.indexOf('\\boxed{')) >= 0;) { const g = entreClaus(s, i + 6); s = s.slice(0, i) + g.dins + s.slice(g.fi); }
  return s;
};
const celTex = (s) => treuVphantoms(sensDestacats(desfaCaixa(s.replace(/\\kern3pt ?/g, '').replace(/\\displaystyle /g, '').replace(/^\\color\{destaca[12]\}(?=\\boxed\{)/, '')))
  .replace(/(?<!\\mathopen)\{\}/g, '').replace(/^\\displaystyle /, ''))
  .replace(/\\right\.\\kern-\\nulldelimiterspace|\\kern-\\nulldelimiterspace\\left\./g, '');
/** I el d'una cel·la de l'HTML: les dues meitats d'un parèntesi gran, com si fossin un sol grup. */
const celHtml = (s) => s.replace(/^<span class="pg">(<span class="pb"[^>]*>\(<\/span>)<\/span>/, '<span class="pg">$1')
  .replace(/^<span class="pg">(<span class="pb"[^>]*>\)<\/span><\/span>)/, '$1');
const esOperador = (s) => /^\{\}(\+|-|\\cdot |:)\{\}$/.test(s) || s === '-';
function revisaCentrat(nom, e, gra, r) {
  let c, t, files;
  try { c = Motor.centrada(e.arbre, { gra }); t = llegeixArray(c.tex); files = llegeixTaula(c.html); } catch (x) { falla(`${nom} centrat: ${x.message}`); return; }
  const N = t.columnes - 1;
  if (t.files.length !== r.tex.length || files.length !== r.tex.length) { falla(`${nom} centrat: ${t.files.length} files i ${r.tex.length} línies`); return; }
  // Més de 12 línies: en blocs de 12 com a molt (un array no es parteix entre pàgines)
  if (t.blocs.length !== Math.ceil(t.files.length / 12) || t.blocs.some((b) => b.files.length > 12)) falla(`${nom} centrat: ${t.files.length} línies en ${t.blocs.length} blocs`);
  t.files.forEach((f, k) => {
    const ultima = k === t.files.length - 1, igual = f[f.length - 1], h = files[k];
    // Cada fila cobreix les N columnes (més la del «=», menys a l'última)
    if (f[f.length - 1].b !== (ultima ? N : N + 1) || h[h.length - 1].b !== f[f.length - 1].b) falla(`${nom} centrat: la fila ${k} no fa ${N} columnes`);
    if (!ultima && (igual.s !== '{}={}' || igual.a !== N || h[h.length - 1].s !== '=')) falla(`${nom} centrat: la fila ${k} no acaba amb =`);
    const cos = ultima ? f : f.slice(0, -1), cosH = ultima ? h : h.slice(0, -1);
    // I diu el mateix que la línia de la resolució
    if (linealTex(cos.map((x) => celTex(x.s)).join('')) !== linealTex(r.tex[k])) falla(`${nom} centrat: la fila «${c.tex.split('\n')[k + 1]}» no és «${r.tex[k]}»`);
    if (linealHtml(cosH.map((x) => celHtml(x.s)).join('')) !== linealHtml(r.html[k])) falla(`${nom} centrat: la fila HTML ${k} no és la línia ${r.html[k]}`);
    if (cosH.map((x) => x.a + ':' + x.b).join() !== cos.map((x) => x.a + ':' + x.b).join()) falla(`${nom} centrat: l'HTML i el TeX no tenen les mateixes columnes a la fila ${k}`);
    if (!k) return;
    // Un resultat ocupa les columnes del que substitueix: les vores de cada fila també ho són de l'anterior
    const vores = new Set(t.files[k - 1].map((x) => x.a));
    if (cos.some((x) => !vores.has(x.a))) falla(`${nom} centrat: la fila ${k} té una columna nova`);
    // Un signe no canvia mai de columna: cada operador d'una fila ja era a la mateixa columna de l'anterior
    if (cos.some((x) => esOperador(x.s) && !t.files[k - 1].some((y) => y.a === x.a && y.b === x.b && esOperador(y.s)))) falla(`${nom} centrat: un signe ha canviat de columna a la fila ${k}`);
  });
}

/* «Destaca» amb «centrat». Cada tros es queda a la seva columna, també dins d'una caixa: la fila, desplegada, té les
   mateixes cel·les que sense destacar (el que va demanar el professor: el 3 de «3 + 6» sota el 3 de «3 + (12 − 6)»).
   Cada caixa, del color de la fila, és el que es destaca a la línia normal, en el mateix ordre (la base d'una
   potència que es simplifica, (−4/4)², es destaca dins de la seva cel·la, com a la línia normal). A dins de la
   caixa, invisibles, els trossos que tenen en aquelles columnes totes les altres línies (perquè les columnes de dins
   facin el mateix ample que les de fora), i les mesures del primer tros i de l'últim (per al marc), igual. Els
   resultats, els de la línia normal, del color de la línia d'abans. I a l'HTML, les mateixes cel·les, amb el marc
   a les cel·les de cada caixa. d: la resolució normal amb «destaca». */
function revisaCentratDest(nom, e, d) {
  let t0, t, h0, h;
  try {
    const c0 = Motor.centrada(e.arbre, { gra: 'prio' }), c = Motor.centrada(e.arbre, { gra: 'prio', dest: 1 });
    t0 = llegeixArray(c0.tex); h0 = llegeixTaula(c0.html);
    t = llegeixArray(c.tex); h = llegeixTaula(c.html);
  } catch (x) { falla(`${nom} centrat destacat: ${x.message}`); return; }
  const net = (x) => linealTex(celTex(x));
  const clau = (cs) => cs.map((x) => `${x.a}:${x.b}:${net(x.s)}`).join('|');
  // Les files que hi ha a les columnes [a, b) a les línies (menys la k), si les omplen
  const esperades = (a, b, k) => [...new Set(t0.files.map((g, j) => {
    const rang = g.filter((y) => y.a >= a && y.b <= b);
    return j !== k && rang.reduce((x, y) => x + y.b - y.a, 0) === b - a ? clau(rang) : null;
  }).filter((x) => x !== null))].sort().join('\n');
  const fetes = (fs) => [...new Set(fs.map(clau))].sort().join('\n');
  t.files.forEach((f, k) => {
    const color = k % 2 + 1, caixes = f.filter((x) => x.caixa), tot = [], linia = destacats(d.tex[k]);
    if (clau(plana(f)) !== clau(t0.files[k]))
      falla(`${nom} centrat destacat: a la fila ${k}, els trossos no són a les columnes de sense destacar (${clau(plana(f))} / ${clau(t0.files[k])})`);
    if (caixes.some((x) => x.caixa !== color)) falla(`${nom} centrat destacat: a la fila ${k}, una caixa que no és del color ${color}`);
    caixes.forEach((x) => {
      if (x.trossos.length === 1) return;
      const u = x.trossos[0], z = x.trossos[x.trossos.length - 1];
      if (fetes(x.fantasmes) !== esperades(x.a, x.b, k)) falla(`${nom} centrat destacat: a la fila ${k}, les files invisibles de la caixa ${x.a}–${x.b}`);
      if (fetes(x.primer.fantasmes) !== esperades(u.a, u.b, -1) || net(x.primer.tros) !== net(u.s) ||
          fetes(x.ultim.fantasmes) !== esperades(z.a, z.b, -1) || net(x.ultim.tros) !== net(z.s))
        falla(`${nom} centrat destacat: a la fila ${k}, les mesures del marc de la caixa ${x.a}–${x.b}`);
    });
    // El destacat, per ordre: les caixes i, dins d'una cel·la que no ho és (una potència), la base que es simplifica
    f.forEach((x) => { if (x.caixa) tot.push(x.trossos.map((y) => y.s).join('')); else destacats(x.s).caixes.forEach((g) => tot.push(g.s)); });
    if (tot.map(net).join('|') !== linia.caixes.map((g) => net(g.s)).join('|'))
      falla(`${nom} centrat destacat: a la fila ${k}, destacat «${tot.map(net).join('|')}» i a la línia «${linia.caixes.map((g) => net(g.s)).join('|')}»`);
    // Els resultats (un de dues fraccions passades a comú denominador va en tres trossos): els de la línia normal, i
    // del color de la línia d'abans
    const res = plana(f).flatMap((x) => destacats(x.s).res);
    if (res.some((r) => r.k !== (k + 1) % 2 + 1) || net(res.map((r) => r.s).join('')) !== net(linia.res.map((r) => r.s).join('')))
      falla(`${nom} centrat destacat: a la fila ${k}, els resultats no són els de la línia normal`);
    if ((k === t.files.length - 1) === !!tot.length) falla(`${nom} centrat destacat: la fila ${k} ${tot.length ? 'és l\'última i té' : 'no té'} res destacat`);
    // L'HTML: les mateixes cel·les que sense destacar, i el mateix text; el marc, a les cel·les de cada caixa del .tex
    // (ini, la primera; fi, l'última), del color de la fila; els nombres, amb aire (n), com al .tex; les marques
    // de dins de les cel·les (resultats i caixes d'una potència), les del .tex
    const hk = h[k];
    if (hk.map((x) => `${x.a}:${x.b}`).join() !== h0[k].map((x) => `${x.a}:${x.b}`).join() ||
        hk.map((x) => sensCaixesHtml(x.s)).join('') !== h0[k].map((x) => x.s).join(''))
      falla(`${nom} centrat destacat: a la fila ${k}, l'HTML no té les cel·les de sense destacar`);
    const marcs = [];
    hk.forEach((x) => {
      if (!x.cl.includes('marc')) return;
      if (x.cl.includes('ini')) marcs.push({ a: x.a, b: x.b, k: x.cl.find((c) => /^k[12]$/.test(c)), fi: false });
      const g = marcs[marcs.length - 1];
      if (!g || g.fi || g.k !== x.cl.find((c) => /^k[12]$/.test(c))) { marcs.push({ a: -1 }); return; }
      g.b = x.b;
      g.fi = x.cl.includes('fi');
    });
    if (marcs.map((g) => `${g.a}-${g.b}:${g.k}:${g.fi}`).join() !== caixes.map((x) => `${x.a}-${x.b}:k${color}:true`).join())
      falla(`${nom} centrat destacat: a la fila ${k}, els marcs de l'HTML no són les caixes del .tex`);
    const ambAire = (x) => (x.cl ? x.cl.includes('n') : /^\\kern3pt /.test(x.s));
    if (hk.filter((x) => !x.cl.includes('igual')).map(ambAire).join() !== plana(f).filter((x) => x.s !== '{}={}').map(ambAire).join())
      falla(`${nom} centrat destacat: a la fila ${k}, l'aire dels nombres no és el mateix a l'HTML i al .tex`);
    if (hk.map((x) => colorsHtml(x.s)).filter(Boolean).join(' ') !== plana(f).map((x) => destacats(x.s).marques.join(' ')).filter(Boolean).join(' '))
      falla(`${nom} centrat destacat: a la fila ${k}, l'HTML no té les marques del TeX`);
  });
}

function revisaResolucio(etq, p, e) {
  const li = p.set === 'N' || !p.int ? 'N' : p.set;
  const linies = {};
  for (const gra of ['prio', 'op']) {
    const r = Motor.resolucio(e.arbre, { gra }), ps = r.passos, nom = `${etq} [${gra}]`;
    linies[gra] = r.tex.length;
    if (r.tex[0] !== e.tex) falla(`${nom}: la primera línia no és l'enunciat`);
    for (let k = 0; k < r.tex.length; k++) {
      if (k && r.tex[k] === r.tex[k - 1]) falla(`${nom}: dues línies iguals, ${r.tex[k]}`);
      if (linealHtml(r.html[k]) !== linealTex(r.tex[k])) falla(`${nom}: l'HTML no diu el mateix que el TeX a ${r.tex[k]}`);
      let l;
      try { l = llegeix(r.tex[k]); } catch (x) { falla(`${nom}: línia incorrecta «${r.tex[k]}» (${x.message})`); continue; }
      if (l.valor[0] !== BigInt(e.valor.n) || l.valor[1] !== BigInt(e.valor.d)) falla(`${nom}: «${r.tex[k]}» val ${l.valor} i l'enunciat ${e.valor.n}/${e.valor.d}`);
      if (!l.passos.slice(0, -1).every((x) => enConjunt(li, x))) falla(`${nom}: un valor fora del conjunt a «${r.tex[k]}»`);
      if (k === r.tex.length - 1 && (['+', '-', '*', ':'].some((o) => l.compte[o]) || l.compte.potencies)) falla(`${nom}: l'última línia no és un sol valor: ${r.tex[k]}`);
      if (k < ps.length - 1) {
        const x = esperat(ps[k].arbre, gra === 'op'), m = ps[k].marques;
        if (ps[k + 1].tipus !== x.tipus || m.size !== x.nodes.length || !x.nodes.every((n) => m.has(n)))
          falla(`${nom}: després de «${r.tex[k]}» tocava ${x.tipus} (${x.nodes.length}) i s'ha fet ${ps[k + 1].tipus} (${m.size})`);
      }
    }
    if (r.tex.length > 4 * totsNodes(e.arbre).length) falla(`${nom}: massa línies (${r.tex.length})`);
    revisaCentrat(nom, e, gra, r);
    // «Destaca l'operació»: les mateixes línies, amb les caixes i els resultats dels dos colors, alternats
    const d = Motor.resolucio(e.arbre, { gra, dest: 1 });
    // (\mathopen{} només és espai: davant d'una part destacada, entre claus, ja no cal)
    const net = (t) => t.replace(/\\mathopen\{\}/g, '');
    const tex = d.tex.map((t) => net(sensDestacats(t))), html = d.html.map(sensCaixesHtml);
    if (tex.join('|') !== r.tex.map(net).join('|') || html.join('|') !== r.html.join('|')) falla(`${nom}: destacar canvia les línies`);
    revisaColors(nom, d.tex);
    if (d.html.some((x, k) => colorsHtml(x) !== destacats(d.tex[k]).marques.join(' '))) falla(`${nom}: l'HTML no té les marques del TeX`);
    if (gra === 'prio') revisaCentratDest(nom, e, d);
  }
  if (linies.op < linies.prio) falla(`${etq}: «una operació» té menys línies que «per prioritat»`);
}


/* ── «Completa la igualtat»: el lector i el cercador de la prova, pel seu compte ──
   Una solució s'escriu «(1 + 2) · 5», «3 + 3 + 3²», «√9 · 2». El lector la torna a
   calcular i comprova les regles: els nombres en ordre i tots, d'una xifra; cap valor,
   ni pel camí, negatiu ni de més de 100; divisions exactes; √ només d'un quadrat
   perfecte; ² i √ només damunt d'un nombre; i només els símbols permesos. El cercador
   prova totes les cadenes possibles per saber què NECESSITA cada igualtat. */
const Igualtats = require('../assets/igualtats.js');
function llegeixIgualtat(text) {
  const net = text.replace(/\s+/g, ''), tk = net.match(/\d|[-+−·:()²√]/g) || [];
  if (tk.join('') !== net) throw new Error(`símbols desconeguts a «${text}»`);
  let i = 0;
  const nombres = [], usats = new Set();
  const dins = (v) => { if (!(Number.isInteger(v) && v >= 0 && v <= 100)) throw new Error(`un valor de ${v} a «${text}»`); return v; };
  function atom() {
    if (tk[i] === '(') { usats.add('('); i++; const v = expr(); if (tk[i++] !== ')') throw new Error(`falta un ) a «${text}»`); return v; }
    const arrel = tk[i] === '√';
    if (arrel) { usats.add('√'); i++; }
    if (!/^\d$/.test(tk[i] || '')) throw new Error(`esperava un nombre a «${text}»`);
    const x = +tk[i++];
    nombres.push(x);
    let v = x;
    if (arrel) { v = Math.round(Math.sqrt(x)); if (v * v !== x) throw new Error(`√${x} a «${text}»`); }
    if (tk[i] === '²') { if (arrel) throw new Error(`√ i ² junts a «${text}»`); usats.add('²'); i++; v = x * x; }
    return dins(v);
  }
  function terme() {
    let v = atom();
    while (tk[i] === '·' || tk[i] === ':') {
      const op = tk[i++], w = atom();
      usats.add(op);
      if (op === '·') v = dins(v * w);
      else { if (!w || v % w) throw new Error(`una divisió no exacta a «${text}»`); v = v / w; }
    }
    return v;
  }
  function expr() {
    let v = terme();
    while (tk[i] === '+' || tk[i] === '−') { const op = tk[i++], w = terme(); v = dins(op === '+' ? v + w : v - w); }
    return v;
  }
  const v = expr();
  if (i !== tk.length) throw new Error(`text sobrant a «${text}»`);
  return { v, nombres, usats };
}
/** Tots els valors que s'aconsegueixen amb ns: sense parèntesis (les cadenes, llegides amb la prioritat de
    sempre) o amb parèntesis (tots els arbres, escrits amb tots els parèntesis), i amb ² i √ o sense. */
function valorsProva(ns, p, ambParentesis, ambPot) {
  const ops = ['+', '−', '·'].concat(p.div ? [':'] : []);
  const fulles = (x) => [String(x)].concat(ambPot && p.pot && x >= 2 && x * x <= 100 ? [x + '²'] : [],
    ambPot && p.arr && x >= 4 && Number.isInteger(Math.sqrt(x)) ? ['√' + x] : []);
  const cadenes = (a, b) => {
    if (b - a === 1) return fulles(ns[a]);
    const out = [];
    if (!ambParentesis) { for (const f of fulles(ns[a])) for (const resta of cadenes(a + 1, b)) for (const op of ops) out.push(`${f} ${op} ${resta}`); }
    else for (let m = a + 1; m < b; m++) for (const l of cadenes(a, m)) for (const r of cadenes(m, b)) for (const op of ops) out.push(`(${l} ${op} ${r})`);
    return out;
  };
  const valors = new Set();
  for (const c of cadenes(0, ns.length)) { try { valors.add(llegeixIgualtat(c).v); } catch (e) { /* no compleix les regles */ } }
  return valors;
}
/** El que necessita la igualtat ns = t: 0, només + − · :; 1, parèntesis; 2, ² o √ (null: impossible). */
function nivellProva(ns, t, p) {
  if (valorsProva(ns, p, false, false).has(t)) return 0;
  if (p.par && valorsProva(ns, p, true, false).has(t)) return 1;
  return valorsProva(ns, p, !!p.par, true).has(t) ? 2 : null;
}
/** Una igualtat: la solució, tornada a llegir; el nivell, tornat a buscar; i el TeX i l'HTML, que diuen el mateix. */
function revisaIgualtat(etq, p, x, nivell) {
  if (x.error) { falla(`${etq}: ${x.error}`); return; }
  if (x.ns.length !== p.nombres || x.ns.some((n) => !Number.isInteger(n) || n < 0 || n > 9) || !(x.t >= 0 && x.t <= 100)) falla(`${etq}: ${x.ns} = ${x.t} fora de les regles`);
  let l;
  try { l = llegeixIgualtat(x.solucio.text); } catch (e) { falla(`${etq}: ${e.message}`); return; }
  if (l.v !== x.t || l.nombres.join() !== x.ns.join()) falla(`${etq}: «${x.solucio.text}» no és ${x.ns.join(' ')} = ${x.t}`);
  const prohibits = [['(', p.par], ['²', p.pot], ['√', p.arr], [':', p.div]].filter(([sim, si]) => !si && l.usats.has(sim));
  if (prohibits.length) falla(`${etq}: «${x.solucio.text}» fa servir ${prohibits.map(([sim]) => sim).join(' ')}`);
  if (x.nivell !== nivell) falla(`${etq}: la igualtat ${x.ns.join(' ')} = ${x.t} és de nivell ${x.nivell} i en tocava ${nivell}`);
  const n = nivellProva(x.ns, x.t, p);
  if (n !== x.nivell) falla(`${etq}: ${x.ns.join(' ')} = ${x.t} necessita el nivell ${n} i el motor diu ${x.nivell} (${x.solucio.text})`);
  const deTex = x.solucio.tex.replace(/\\cdot /g, '·').replace(/-/g, '−').replace(/\^\{2\}/g, '²').replace(/\\sqrt\{(\d)\}/g, '√$1');
  const deHtml = x.solucio.html.replace(/<span class="op">(.)<\/span>/g, '$1').replace(/<sup>2<\/sup>/g, '²').replace(/<span class="arrel">√<span>(\d)<\/span><\/span>/g, '√$1');
  const pla = x.solucio.text.replace(/\s+/g, '');
  if (deTex !== pla || deHtml !== pla) falla(`${etq}: el TeX (${x.solucio.tex}) o l'HTML (${x.solucio.html}) no diuen «${x.solucio.text}»`);
}
/** Un full sencer: cada igualtat, la del nivell que li toca al pla, cap de repetida, i l'exemple. */
function revisaFullIgualtats(etq, q, llavor) {
  const f = Igualtats.full(q, llavor, []), p = f.p, pla = Igualtats.pla(p, llavor);
  f.items.forEach((x, i) => revisaIgualtat(`${etq} (${i + 1})`, p, x, pla[i]));
  revisaIgualtat(`${etq} (exemple)`, p, f.exemple, p.par ? 1 : p.pot || p.arr ? 2 : 0);
  const claus = f.items.concat(f.exemple).map((x) => `${x.ns}=${x.t}`);
  if (new Set(claus).size !== claus.length) falla(`${etq}: dues igualtats iguals`);
  return f;
}
const etiquetaIgualtats = (q) => `igualtats nombres=${q.nombres} par=${q.par} pot=${q.pot} arr=${q.arr} div=${q.div} ig=${Igualtats.GENERADOR}`;

const base = { n: 5, esp: 'mitja', sim: 'petit', set: 'N', int: 1, fin: 1, div: 0, opo: 0, pot: 0, par: 0, forca: 1 };
const etiqueta = (p) => `${p.set} int=${p.int} fin=${p.fin} div=${p.div} pot=${p.pot} par=${p.par} opo=${p.opo} forca=${p.forca} grad=${p.grad || 0}` +
  (p.g >= 2 ? ` g=${p.g}` : '');

/* ── 1. Cada combinació, 100 exercicis (immediata, força), amb cada generador.
   g=1: 100 exercicis seguits d'un sol full. g=2: el nombre de parèntesis depèn
   del lloc que ocupa l'exercici al full, o sigui que són 10 fulls de 10. ─── */
let combos = 0, total = 0;
for (const g of [1, 2])
  for (const set of ['N', 'Z', 'Q'])
    for (const [int, fin] of set === 'N' ? [[1, 1]] : [[1, 0], [0, 1], [1, 1]])
      for (let m = 0; m < 16; m++) {
        const p = { ...base, n: g === 1 ? 5 : 10, g, set, int, fin, div: m & 1, pot: (m >> 1) & 1, par: (m >> 2) & 1, opo: (m >> 3) & 1 };
        if (!Motor.valida(p).ok) continue;
        combos++;
        const etq = etiqueta(p);
        let mal = 0;
        for (let s = 0; s < (g === 1 ? 1 : 10); s++) {
          const llavor = 'prova' + m + (g === 1 ? '' : '-' + s), ant = new Set(), full = [];
          for (let i = 0; i < (g === 1 ? 100 : 10); i++) {
            const e = Motor.exercici(p, llavor, i, 0, ant); total++;
            if (e.error) { mal++; continue; }
            ant.add(e.tex); full.push({ i, e });
            revisa(etq, p, e);
          }
          const a2 = new Set();                                                   // determinisme
          full.forEach(({ i, e }) => { const x = Motor.exercici(p, llavor, i, 0, a2); a2.add(x.tex); if (x.tex !== e.tex) falla(`${etq}: no determinista (${i})`); });
          if (new Set(full.map(({ e }) => e.tex)).size !== full.length) falla(`${etq}: repetits`);
        }
        if (mal > 1) falla(`${etq}: ${mal}/100 sense generar (< 99 %)`);          // taxa d'èxit
      }

/* ── 2. TOTES les combinacions (també sense força i graduals): un full de 10
   cadascuna, que es revisa sencer i en dona l'empremta ───────────────────── */
const canonic = (x) => (Array.isArray(x) ? '[' + x.map(canonic).join(',') + ']'
  : x && typeof x === 'object' ? '{' + Object.keys(x).sort().map((k) => JSON.stringify(k) + ':' + canonic(x[k])).join(',') + '}'
  : JSON.stringify(x));
const empremtes = {};
let combosTotes = 0;
for (let g = 1; g <= Motor.GENERADOR; g++)
  for (const set of ['N', 'Z', 'Q'])
    for (const [int, fin] of set === 'N' ? [[1, 1]] : [[1, 0], [0, 1], [1, 1]])
      for (let m = 0; m < 64; m++) {
        const p = { ...base, n: 10, g, set, int, fin, div: m & 1, pot: (m >> 1) & 1, par: (m >> 2) & 1, opo: (m >> 3) & 1, forca: (m >> 4) & 1, grad: (m >> 5) & 1 };
        if (!Motor.valida(p).ok) continue;
        combosTotes++;
        const etq = etiqueta(p), ant = new Set(), h = crypto.createHash('sha256');
        for (let i = 0; i < p.n; i++) {
          const e = Motor.exercici(p, 'empremta', i, 0, ant); total++;
          if (e.error) { falla(`${etq}: l'exercici ${i + 1} no surt`); h.update('error|'); continue; }
          ant.add(e.tex); h.update(canonic(e.arbre) + '|');
          revisa(etq, p, e);
          revisaResolucio(etq, p, e);
        }
        empremtes[etq] = h.digest('hex').slice(0, 16);
      }
let combosIgualtats = 0;
for (const nombres of [3, 4]) for (let m = 0; m < 16; m++) {
  const q = { n: 9, nombres, par: m & 1, pot: (m >> 1) & 1, arr: (m >> 2) & 1, div: (m >> 3) & 1 }, etq = etiquetaIgualtats(q);
  const f = revisaFullIgualtats(etq, q, 'empremta');
  combosIgualtats++; total += f.items.length;
  empremtes[etq] = crypto.createHash('sha256').update(f.items.map((x) => `${x.ns.join(' ')}=${x.t}`).join('|')).digest('hex').slice(0, 16);
}
const fitxerEmpremtes = path.join(__dirname, 'empremtes.json');
let desades = {};
try { desades = JSON.parse(fs.readFileSync(fitxerEmpremtes, 'utf8')); } catch (e) { /* encara no n'hi ha */ }
const canviades = Object.keys(empremtes).filter((k) => desades[k] !== empremtes[k]);
const delUltim = (k) => (k.startsWith('igualtats ') ? k.endsWith(' ig=' + Igualtats.GENERADOR)
  : Motor.GENERADOR >= 2 ? k.endsWith(' g=' + Motor.GENERADOR) : !/ g=\d+$/.test(k));
if (process.argv.includes('--actualitza-empremtes')) {
  // Les d'un generador antic no es poden refer: són els fulls que ja hi ha desats.
  const antigues = canviades.filter((k) => !delUltim(k) && desades[k] !== undefined);
  if (antigues.length) falla(`no es poden refer les empremtes d'un generador antic (${antigues.length}, p. ex. ${antigues[0]}): ` +
    'són els fulls que ja hi ha desats. Cal un generador nou (todo.md §6.3).');
  else {
    fs.writeFileSync(fitxerEmpremtes, JSON.stringify(empremtes, null, 1) + '\n');
    console.log(`tests/empremtes.json refet (${Object.keys(empremtes).length} combinacions)`);
  }
} else if (canviades.length || Object.keys(desades).length !== Object.keys(empremtes).length) {
  falla(`els exercicis han canviat en ${canviades.length} combinacions (p. ex. ${canviades[0]}): els fulls desats ja no sortirien iguals. ` +
    'Si és el generador nou, encara sense publicar, i és a propòsit: node tests/prova.js --actualitza-empremtes');
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

/* ── 8. Generador 2: quants parèntesis porta cada exercici ─────────────────
   El pla del professor: com a màxim 3, i el 3 improbable. Gradual: de cada
   10, 4 sense, 3 amb 1 i 3 amb 2, en ordre creixent; immediata: tots en
   tenen, 6 amb 1 i 4 amb 2; i en un 15 % dels fulls, un «2» passa a ser 3. */
{
  const plaDe = (p, llavor) => Array.from({ length: p.n }, (_, i) => Motor.opcions(p, llavor, i).parentesis);
  const ordena = (ks) => ks.slice().sort((a, b) => a - b).join(' ');
  for (const grad of [1, 0]) {
    const p = { ...base, n: 10, g: 2, set: 'Z', div: 1, pot: 1, par: 1, opo: 1, grad }, nom = grad ? 'gradual' : 'immediata';
    const esperat = grad ? '0 0 0 0 1 1 1 2 2 ' : '1 1 1 1 1 1 2 2 2 ';
    let tres = 0;
    for (let s = 0; s < 2000; s++) {                  // el pla: només sortejos, sense generar exercicis
      const ks = plaDe(p, 'pla' + s), o = ordena(ks);
      if (o !== esperat + '2' && o !== esperat + '3') { falla(`g=2 ${nom}: el pla és ${ks.join(' ')}`); break; }
      if (grad && ks.join(' ') !== o) { falla(`g=2 gradual: no van en ordre creixent: ${ks.join(' ')}`); break; }
      if (ks.includes(3)) tres++;
    }
    const pc = tres / 20;
    if (pc < 13 || pc > 17) falla(`g=2 ${nom}: ${pc} % dels fulls tenen un exercici amb 3 parèntesis (ha de ser ~15 %)`);
    console.log(`generador 2, ${nom}: ${pc.toFixed(1)} % dels fulls tenen un exercici amb 3 parèntesis`);
    for (let s = 0; s < 40; s++) {                    // i els exercicis en tenen exactament els del pla
      const ant = new Set(), ks = plaDe(p, 'pla' + s);
      for (let i = 0; i < 10; i++) {
        const e = Motor.exercici(p, 'pla' + s, i, 0, ant); total++;
        if (e.error) { falla(`g=2 ${nom}: l'exercici ${i + 1} no surt`); continue; }
        ant.add(e.tex);
        const r = revisa(`g=2 ${nom}`, p, e);
        if (r && r.compte.parells !== ks[i]) falla(`g=2 ${nom}: ${r.compte.parells} parèntesis i el pla en deia ${ks[i]}`);
        if (Motor.exercici(p, 'pla' + s, i, 3).params.parentesis !== ks[i]) falla(`g=2 ${nom}: ↻ canvia el nombre de parèntesis`);
      }
    }
  }
  // Qualsevol mida de full: mai més de 3 ni més d'un 3; a «gradual», creixent i els dos últims amb parèntesis
  for (let n = 1; n <= 10; n++) for (const grad of [0, 1]) for (let s = 0; s < 50; s++) {
    const ks = plaDe({ ...base, n, g: 2, set: 'Z', par: 1, grad }, 'n' + s);
    if (Math.max(...ks) > 3 || ks.filter((k) => k === 3).length > 1) { falla(`g=2 n=${n}: ${ks.join(' ')}`); break; }
    if (grad ? ks.join(' ') !== ordena(ks) || ks.slice(-2).some((k) => !k) : ks.some((k) => !k)) { falla(`g=2 n=${n} grad=${grad}: ${ks.join(' ')}`); break; }
  }
  // ℚ només final: sense parèntesis no hi ha exercici possible, o sigui que tots en tenen
  if (plaDe({ ...base, n: 10, g: 2, set: 'Q', int: 0, fin: 1, div: 1, par: 1, grad: 1 }, 'q').some((k) => !k)) falla('g=2 ℚ només final: un exercici sense parèntesis');
  // Sense «parèntesis», el generador 2 no en posa cap
  if (Motor.opcions({ ...base, n: 10, g: 2, set: 'Z', par: 0 }, 'x', 0).parentesis !== undefined) falla('g=2 sense parèntesis: hi ha un pla');
  // Una adreça sense g (de la v0.1) és el generador 1
  const v1 = { ...base, n: 10, set: 'Z', div: 1, pot: 1, par: 1, opo: 1 };
  if ([0, 5, 9].some((i) => Motor.exercici(v1, 'v1', i, 0).tex !== Motor.exercici({ ...v1, g: 1 }, 'v1', i, 0).tex)) falla('sense g no és el generador 1');
}

/* ── 9. valida(): les tres combinacions impossibles ───────────────────────── */
if (Motor.valida({ ...base, set: 'N', opo: 1 }).ok) falla('oposat amb ℕ hauria de ser impossible');
if (Motor.valida({ ...base, set: 'Z', int: 0, fin: 1, opo: 1 }).ok) falla('oposat sense «intermedis» hauria de ser impossible');
if (Motor.valida({ ...base, set: 'Q', int: 0, fin: 1, div: 1, par: 0 }).ok) falla('ℚ només final sense parèntesis hauria de ser impossible');
if (!Motor.valida({ ...base, set: 'Q', int: 0, fin: 1, div: 1, par: 1 }).ok) falla('ℚ només final amb divisions i parèntesis és possible');

/* ── 10. Solucionari: les decisions del professor, exemple a exemple ────────
   Estricte (primer els parèntesis, d'un en un); + i − d'una en una; la línia
   de la regla dels signes; amb fraccions, el comú denominador (m.c.m.). */
{
  const N = (v) => ({ t: 'num', v }), F = (p, q) => ({ t: 'frac', p, q }), O = (a) => ({ t: 'neg', a }),
    P = (a, k) => ({ t: 'pow', a, k }), B = (op, l, r) => ({ t: 'bin', op, l, r });
  const casos = [
    [B('+', B('*', N(3), B('-', N(5), N(2))), B(':', P(N(4), 2), N(8))), {}, '3·(5-2)+4^{2}:8 | 3·3+4^{2}:8 | 3·3+16:8 | 9+2 | 11'],
    [B('*', B('+', N(2), N(3)), B('+', N(4), N(5))), {}, '(2+3)·(4+5) | 5·(4+5) | 5·9 | 45'],
    [B('+', B('-', B('+', O(N(3)), N(5)), N(8)), N(4)), {}, '-3+5-8+4 | 2-8+4 | -6+4 | -2'],
    [B('+', B('-', N(5), O(N(3))), O(N(8))), {}, '5-(-3)+(-8) | 5+3-8 | 8-8 | 0'],
    [B('+', F(1, 2), F(1, 3)), {}, '\\frac{1}{2}+\\frac{1}{3} | \\frac{3}{6}+\\frac{2}{6} | \\frac{5}{6}'],
    [B('+', F(1, 6), F(1, 3)), {}, '\\frac{1}{6}+\\frac{1}{3} | \\frac{1}{6}+\\frac{2}{6} | \\frac{3}{6} | \\frac{1}{2}'],
    [B('+', F(1, 6), F(1, 3)), { simp: 0 }, '\\frac{1}{6}+\\frac{1}{3} | \\frac{1}{6}+\\frac{2}{6} | \\frac{1}{2}'],
    [B('+', N(3), F(1, 2)), {}, '3+\\frac{1}{2} | \\frac{6}{2}+\\frac{1}{2} | \\frac{7}{2}'],
    [B(':', F(1, 2), F(3, 4)), {}, '\\frac{1}{2}:\\frac{3}{4} | \\frac{4}{6} | \\frac{2}{3}'],
    [B(':', O(B('+', N(4), N(6))), N(2)), {}, '-(4+6):2 | -10:2 | -5'],
    [B('*', O(B('-', N(2), N(5))), N(4)), {}, '-(2-5)·4 | -(-3)·4 | 3·4 | 12'],
    [P(O(N(2)), 3), {}, '(-2)^{3} | -8'],
    [P(B('+', N(3), N(1)), 2), {}, '(3+1)^{2} | 4^{2} | 16'],
    [B('+', B('*', N(2), N(3)), B('*', N(4), N(5))), {}, '2·3+4·5 | 6+20 | 26'],
    [B('+', B('*', N(2), N(3)), B('*', N(4), N(5))), { gra: 'op' }, '2·3+4·5 | 6+4·5 | 6+20 | 26']
  ];
  for (const [arbre, op, esperades] of casos) {
    const linies = Motor.resolucio(arbre, op).tex.map((l) => l.replace(/\\cdot /g, '·').replace(/\s+/g, '')).join(' | ');
    if (linies !== esperades) falla(`solucionari ${JSON.stringify(op)}: ${linies}  (esperat: ${esperades})`);
  }
}

/* ── 11. Els fitxers de solucions ─────────────────────────────────────────── */
{
  // Amb les solucions, exN.tex (mode «Cap») no canvia ni un byte: el de referència és d'abans del solucionari.
  const versio = (t) => t.replace(/(«Operacions combinades 1r ESO») v[\d.]+/g, '$1 VERSIO');
  const ESTATS = [
    { n: 5, esp: 'mitja', sim: 'petit', set: 'N', int: 1, fin: 1, div: 0, opo: 0, pot: 0, par: 0, forca: 1, vs: 0, grad: 0, g: 1 },
    { n: 10, esp: 'petit', sim: 'gran', set: 'Z', int: 1, fin: 1, div: 1, opo: 1, pot: 1, par: 1, forca: 1, vs: 1, grad: 1, g: 2 },
    { n: 8, esp: 'gran', sim: 'mitja', set: 'Q', int: 1, fin: 1, div: 1, opo: 1, pot: 1, par: 1, forca: 0, vs: 0, grad: 0, g: 2 },
    { n: 6, esp: 'mitja', sim: 'petit', set: 'Q', int: 0, fin: 1, div: 1, opo: 0, pot: 1, par: 1, forca: 1, vs: 0, grad: 0 }
  ];
  let ref = '', ambSol = '';
  const fulls = ESTATS.map((p, k) => {
    const ant = new Set(), ex = [];
    for (let i = 0; i < p.n; i++) { const e = Motor.exercici(p, 'referencia' + k, i, k % 2, ant); ant.add(e.tex); ex.push(e); }
    const m = { num: k + 1, seed: 'referencia' + k, adreca: '#referencia' + k };
    ref += Motor.fitxerTex(ex, p, m);
    ambSol += Motor.fitxerTex(ex, p, m, { mode: 'solucionari', resolts: [0, 1] });
    return { p, ex, m };
  });
  if (versio(ref) !== versio(fs.readFileSync(path.join(__dirname, 'referencia-cap.tex'), 'utf8'))) falla('exN.tex (mode Cap) ha canviat respecte de tests/referencia-cap.tex');
  if (ambSol !== ref) falla('amb el mode «solucionari», exN.tex ha de ser el de sempre');
  // Guiades: només els exercicis triats porten la resolució, amb poc espai; la resta, igual que sempre
  const { p, ex, m } = fulls[2];                         // espai «gran»: els resolts, «petit»
  const g = Motor.fitxerTex(ex, p, m, { mode: 'guiades', resolts: [2, 0] });
  const compta = (t, re) => (t.match(re) || []).length;
  if (compta(g, /\\begin\{flalign\*\}/g) !== 2 || !g.includes('\\allowdisplaybreaks') || !g.includes(' · resolts: 1, 3\n')) falla('guiades: resolucions');
  if (compta(g, /\\item /g) !== p.n || compta(g, /\\vspace\{1\.5cm\}/g) !== 2 || compta(g, /\\vspace\{5cm\}/g) !== p.n - 2) falla('guiades: espais o ítems');
  const sense = (t) => t.split('\n').filter((l) => !/^(&=|\\begin\{flalign|\\end\{flalign|\\allowdisplaybreaks|% llavor|\\par\\vspace)/.test(l)).join('\n');
  if (sense(g) !== sense(Motor.fitxerTex(ex, p, m))) falla('guiades: els enunciats han de ser els mateixos');
  // El solucionari: tots resolts, amb la mateixa numeració; «només resultats», una línia per exercici
  const s = Motor.fitxerSolucionari(ex, p, m, {});
  if (!s.startsWith(`% ex${m.num}-sol.tex — solucionari de ex${m.num}.tex`) || !s.includes('\\textbf{Solucions}') ||
      compta(s, /\\item /g) !== p.n || compta(s, /\\begin\{flalign\*\}/g) !== p.n) falla('solucionari: format');
  const r = Motor.fitxerSolucionari(ex, p, m, { nomes: 1, dest: 1 });
  if (compta(r, /\\item /g) !== p.n || r.includes('flalign') || r.includes('destaca') ||
      !ex.every((e) => r.includes(`\\item $\\displaystyle ${e.tex}=`))) falla('solucionari: només resultats');
  // «Centrat»: cada exercici resolt és un array, amb l'enunciat a la primera fila; «destaca», amb els dos colors
  const enunciats = (t) => t.match(/^\\item \$\\displaystyle .*\$$/gm) || [];
  const gc = Motor.fitxerTex(ex, p, m, { mode: 'guiades', resolts: [2, 0], cen: 1, dest: 1 });
  if (compta(gc, /^\\item \$\\begin\{array\}\[t\]/gm) !== 2 || compta(gc, /^\\end\{array\}\$$/gm) !== 2 || compta(gc, /\\item /g) !== p.n ||
      gc.includes('flalign') || !gc.includes(' · resolts: 1, 3\n') || !gc.includes('\\color{destaca1}\\setbox0') || !gc.includes('\\color{destaca2}\\setbox0') || gc.includes('\\leaders') || gc.includes('\\underline')) falla('guiades centrat: resolucions');
  if (enunciats(gc).join('\n') !== enunciats(Motor.fitxerTex(ex, p, m)).filter((x, i) => i !== 0 && i !== 2).join('\n')) falla('guiades centrat: els altres enunciats');
  const sc = Motor.fitxerSolucionari(ex, p, m, { cen: 1, dest: 1, gra: 'op' });
  if (compta(sc, /^\\item \$\\begin\{array\}\[t\]/gm) !== p.n || sc.includes('flalign') || !sc.includes('\\color{destaca2}')) falla('solucionari centrat');
  // Els colors de «destaca» els defineix el fitxer mateix (cal xcolor, que carrega headers.tex), i només quan cal: els
  // triats (c1, c2) o, si no n'hi ha o no són de la paleta, els de per defecte (blau fosc i vermell)
  const colors = (t) => (t.match(/^\\definecolor\{destaca1\}\{HTML\}\{([0-9A-F]{6})\}\\definecolor\{destaca2\}\{HTML\}\{([0-9A-F]{6})\}% «destaca»/gm) || [])
    .map((l) => l.replace(/^.*\{([0-9A-F]{6})\}.*\{([0-9A-F]{6})\}.*$/, '$1 $2'));
  if (colors(gc).join() !== '00008B D32F2F' || colors(sc).join() !== '00008B D32F2F' || colors(Motor.fitxerSolucionari(ex, p, m, { dest: 1 })).join() !== '00008B D32F2F')
    falla(`«destaca»: el fitxer no defineix els colors (${colors(gc)})`);
  if (colors(Motor.fitxerTex(ex, p, m, { mode: 'guiades', resolts: [0] })).length || colors(r).length || colors(Motor.fitxerTex(ex, p, m, { mode: 'cap', dest: 1 })).length ||
      colors(Motor.fitxerTex(ex, p, m, { mode: 'guiades', resolts: [], dest: 1 })).length) falla('«destaca»: els colors, en un fitxer que no destaca res');
  const triats = (c1, c2) => colors(Motor.fitxerTex(ex, p, m, { mode: 'guiades', resolts: [0], dest: 1, c1, c2 })).join();
  if (triats('verd', 'taronja') !== '2E7D32 E65100' || triats('negre', 'blaufosc') !== '000000 00008B' || triats('constructor', 'xyz') !== '00008B D32F2F' ||
      triats('__proto__', 'toString') !== '00008B D32F2F') falla(`«destaca»: els colors triats (${triats('verd', 'taronja')} / ${triats('constructor', 'xyz')})`);
  // La paleta: 16 colors diferents, en hexadecimal, amb un nom; la clau, en minúscules (va a l'adreça)
  const paleta = Object.entries(Motor.COLORS);
  if (paleta.length !== 16 || new Set(paleta.map(([, c]) => c.hex)).size !== 16 || paleta.some(([k, c]) => !/^[a-z]+$/.test(k) || !/^[0-9A-F]{6}$/.test(c.hex) || !c.nom) ||
      !Motor.COLORS_PER_DEFECTE.every((k) => paleta.some(([q]) => q === k))) falla('«destaca»: la paleta de colors');
}

/* ── 12. «Centrat», exemple a exemple: cada signe es queda a la seva columna i
   cada resultat va a les columnes del que substitueix ([k]: ocupa k columnes).
   El primer, el del professor:
       2 + 3 · (5 − 2)² + 8 =
       2 + 3 ·    3²    + 8 =
       2 + 3 ·    9     + 8 =
       2 +     27       + 8 =
            29          + 8 =
                  37                                                          */
{
  const N = (v) => ({ t: 'num', v }), F = (p, q) => ({ t: 'frac', p, q }), O = (a) => ({ t: 'neg', a }),
    P = (a, k) => ({ t: 'pow', a, k }), B = (op, l, r) => ({ t: 'bin', op, l, r });
  const curt = (c) => (c.b - c.a > 1 ? `[${c.b - c.a}]` : '') + celTex(c.s).replace(/\\cdot /, '·').replace(/\^\{(\d+)\}/, '^$1')
    .replace(/\\left\(/, '(').replace(/\\right\)/, ')');
  const casos = [
    [B('+', B('+', N(2), B('*', N(3), P(B('-', N(5), N(2)), 2))), N(8)), {},
      '2 + 3 · ( 5 - 2 )^2 + 8 = | 2 + 3 · [5]3^2 + 8 = | 2 + 3 · [5]9 + 8 = | 2 + [7]27 + 8 = | [9]29 + 8 = | [11]37'],
    [B('+', B('+', N(2), B('*', N(3), P(B('-', N(5), N(2)), 2))), N(8)), { gra: 'op' },
      '2 + 3 · ( 5 - 2 )^2 + 8 = | 2 + 3 · [5]3^2 + 8 = | 2 + 3 · [5]9 + 8 = | 2 + [7]27 + 8 = | [9]29 + 8 = | [11]37'],
    [B('*', O(B('-', N(2), N(5))), N(4)), {}, '- ( 2 - 5 ) · 4 = | - [5](-3) · 4 = | [6]3 · 4 = | [8]12'],
    [B('+', B('-', N(5), O(N(3))), O(N(8))), {}, '5 - (-3) + (-8) = | 5 + 3 - 8 = | [3]8 - 8 = | [5]0'],
    [B('*', N(5), O(B('+', N(2), N(3)))), {}, '5 · \\bigl( - ( 2 + 3 ) \\bigr) = | 5 · [8](-5) = | [10]-25'],
    [B('+', B('*', N(2), N(3)), B('*', N(4), N(5))), { gra: 'op' }, '2 · 3 + 4 · 5 = | [3]6 + 4 · 5 = | [3]6 + [3]20 = | [7]26'],
    [B('*', N(3), B('+', F(1, 2), F(1, 4))), {},
      '3 · ( \\frac{1}{2} + \\frac{1}{4} ) = | 3 · ( \\frac{2}{4} + \\frac{1}{4} ) = | 3 · [5]\\frac{3}{4} = | [7]\\frac{9}{4}']
  ];
  for (const [arbre, op, esperades] of casos) {
    const files = llegeixArray(Motor.centrada(arbre, op).tex).files.map((f) => f.map(curt).join(' ')).join(' | ');
    if (files !== esperades) falla(`centrat ${JSON.stringify(op)}: ${files}  (esperat: ${esperades})`);
  }
  // «Destaca»: el que es calcula a la línia següent, en una sola cel·la amb una caixa (les columnes que ocupa), del
  // color de la fila (1, 2, 1…). El 5 − 2, sense els parèntesis, com a la línia normal. I el resultat de cada caixa,
  // a la fila següent, del color de la caixa.
  const cd = llegeixArray(Motor.centrada(casos[0][0], { dest: 1 }).tex);
  const caixes = cd.files.map((f) => f.filter((x) => x.caixa).map((x) => `${x.a}-${x.b}:${x.caixa}:${celTex(x.trossos.map((y) => y.s).join(''))}`).join(','));
  const esperat = ['5-8:1:5-2', '4-9:2:3^{2}', '2-9:1:3\\cdot 9', '0-9:2:2+27', '0-11:1:29+8', ''];
  if (caixes.join(' | ') !== esperat.join(' | ')) falla(`centrat destacat: ${caixes.join(' | ')}  (esperat: ${esperat.join(' | ')})`);
  const resultats = cd.files.map((f) => plana(f).flatMap((x) => destacats(x.s).res.map((r) => `${r.k}:${r.s}`)).join(','));
  if (resultats.join(' | ') !== ' | 1:3 | 2:9 | 1:27 | 2:29 | 1:37') falla(`centrat destacat, els resultats: ${resultats.join(' | ')}`);
  // L'exemple del professor, 4·3·3: la caixa de 4·3 del color 1 i la de 12·3 del 2; el 12, de l'1, i el 36, del 2
  const P433 = B('*', B('*', N(4), N(3)), N(3)), r433 = Motor.resolucio(P433, { dest: 1 });
  if (r433.tex.join(' | ') !== '{\\color{destaca1}\\boxed{4\\cdot 3}}\\cdot 3 | {\\color{destaca2}\\boxed{{\\color{destaca1}12}\\cdot 3}} | {\\color{destaca2}36}' ||
      r433.html.join(' | ') !== '<span class="dest caixa k1">4<span class="op">·</span>3</span><span class="op">·</span>3 | ' +
        '<span class="dest caixa k2"><span class="k1">12</span><span class="op">·</span>3</span> | <span class="k2">36</span>') falla(`4·3·3 destacat: ${r433.tex.join(' | ')}`);
  // I amb «centrat»: cada tros a la seva columna (el 12 a les del 4·3, sota; el 3 sota el 3), i les caixes al voltant
  const c433 = Motor.centrada(P433, { dest: 1 }), a433 = llegeixArray(c433.tex);
  const t433 = (x) => `${x.a}-${x.b}:${linealTex(celTex(x.s))}`;
  const f433 = a433.files.map((f) => f.map((x) => (x.caixa ? `[${x.caixa}:${x.trossos.map(t433).join(' ')}]` : t433(x))).join(' '));
  if (f433.join(' | ') !== '[1:0-1:4 1-2:\\cdot 2-3:3] 3-4:\\cdot 4-5:3 5-6:= | [2:0-3:12 3-4:\\cdot 4-5:3] 5-6:= | 0-5:36' ||
      !c433.html.startsWith('<table class="centrat"><tr><td class="n dest marc k1 ini">4</td><td class="dest marc k1"><span class="op">·</span></td><td class="n dest marc k1 fi">3</td>') ||
      !c433.html.includes('<td class="n dest marc k2 ini" colspan="3"><span class="k1">12</span></td>') || !c433.html.includes('<td class="n" colspan="5"><span class="k2">36</span></td>'))
    falla(`4·3·3 centrat destacat: ${f433.join(' | ')}`);
  // Sense «destaca», cap color
  if (/destaca|k[12]/.test(Motor.resolucio(P433, {}).tex.join() + Motor.resolucio(P433, {}).html.join() + Motor.centrada(P433, {}).tex + Motor.centrada(P433, {}).html))
    falla('sense «destaca», hi ha colors');
}

/* ── 13. «Completa la igualtat» ─────────────────────────────────────────────
   Les igualtats del professor; el pla de cada full (com el seu: de cada 9, 5
   només amb + − · :, 3 amb parèntesis i 1 amb ² o √); molts fulls de cada
   mena, revisats sencers; el determinisme i ↻; i els fitxers. */
{
  const tot = { par: 1, pot: 1, arr: 1, div: 1 };
  // Les del full del professor: què necessita cadascuna, segons el motor i segons la prova
  for (const [ns, t, nivell] of [[[1, 2, 5], 15, 1], [[1, 1, 1], 3, 0], [[3, 3, 3], 3, 0], [[4, 5, 6], 15, 0], [[9, 0, 9], 81, 1],
    [[1, 4, 6], 30, 1], [[0, 0, 7], 0, 0], [[5, 3, 4], 32, 1], [[3, 3, 3], 15, 2], [[1, 1, 1], 2, 0]]) {
    const x = Igualtats.resol(ns, Igualtats.opcions(tot)).get(t);
    if (!x || x.nivell !== nivell || nivellProva(ns, t, tot) !== nivell) falla(`igualtats: ${ns.join(' ')} = ${t} hauria de ser de nivell ${nivell} (${x && x.nivell})`);
  }
  if (Igualtats.escriuText(Igualtats.resol([1, 2, 5], Igualtats.opcions(tot)).get(15).millor.a) !== '(1 + 2) · 5') falla('igualtats: la solució de 1 2 5 = 15');
  // El pla: quantes de cada nivell, per a cada mida de full i cada combinació de símbols
  for (let n = 3; n <= 15; n++) for (let m = 0; m < 16; m++) {
    const p = Igualtats.opcions({ n, par: m & 1, pot: (m >> 1) & 1, arr: (m >> 2) & 1, div: (m >> 3) & 1 });
    const pla = Igualtats.pla(p, 'pla' + m), compte = [0, 1, 2].map((k) => pla.filter((x) => x === k).length);
    const n2 = p.pot || p.arr ? Math.max(1, Math.round(n / 9)) : 0, n1 = p.par ? Math.round(n / 3) : 0;
    if (compte.join() !== [n - n1 - n2, n1, n2].join()) { falla(`igualtats: el pla de ${n} (${JSON.stringify(p)}) és ${compte}`); break; }
  }
  const p9 = Igualtats.pla(Igualtats.opcions(tot), 'x');
  if ([0, 1, 2].map((k) => p9.filter((x) => x === k).length).join() !== '5,3,1') falla(`igualtats: el pla de 9 no és com el full del professor: ${p9}`);
  // Molts fulls de cada mena, sencers (també amb 4 nombres i amb 15 igualtats)
  let fulls = 0;
  for (const nombres of [3, 4]) for (let m = 0; m < 16; m++) for (let s = 0; s < (nombres === 3 ? 6 : 2); s++) {
    const q = { n: s % 2 ? 15 : 9, nombres, par: m & 1, pot: (m >> 1) & 1, arr: (m >> 2) & 1, div: (m >> 3) & 1 };
    const f = revisaFullIgualtats(etiquetaIgualtats(q), q, `fulls${m}-${s}`);
    fulls++; total += f.items.length;
  }
  // Determinisme i ↻: el mateix full, cada cop; ↻ canvia la igualtat, però no el nivell
  const q = { n: 9, nombres: 3, ...tot }, a = Igualtats.full(q, 'det', []), b = Igualtats.full(q, 'det', []);
  if (JSON.stringify(a) !== JSON.stringify(b)) falla('igualtats: no determinista');
  const c = Igualtats.full(q, 'det', [0, 0, 1]);
  if (`${c.items[2].ns}=${c.items[2].t}` === `${a.items[2].ns}=${a.items[2].t}` || c.items[2].nivell !== a.items[2].nivell ||
      c.items.some((x, i) => i !== 2 && `${x.ns}=${x.t}` !== `${a.items[i].ns}=${a.items[i].t}`)) falla('igualtats: ↻ ha de canviar només la seva igualtat, i no el nivell');
  // Els fitxers
  const m = { num: 4, seed: 'det', adreca: '#act=igu&seed=det', versio: 'vX' };
  // Dues columnes (al full i al solucionari), separades per una línia discontínua: a cada fila, un tros de línia
  // que fa l'alçada de la fila (el puntal de la taula més l'espai de sota); si en surt un nombre senar, l'última
  // fila porta la segona cel·la buida, perquè la línia també hi passi
  if (Igualtats.COLUMNES !== 2) falla(`igualtats: ${Igualtats.COLUMNES} columnes`);
  const graella = (x, fila, n) => {
    const g = /\\noindent\\begin\{tabular\}\{(.*)\}\n([\s\S]*?)\n\\end\{tabular\}\n$/.exec(x);
    if (!g) return 'no hi ha la taula';
    const col = 'p{\\dimexpr(\\linewidth-6mm-.4pt)/2\\relax}', puntal = '\\csname @arstrutbox\\endcsname';
    const ratlla = `@{\\hspace{3mm}\\lower\\dimexpr\\dp${puntal}+${fila}mm\\relax\\vbox to\\dimexpr\\ht${puntal}+\\dp${puntal}+${fila}mm\\relax`
      + '{\\xleaders\\vbox to 6pt{\\hrule width .4pt height 3pt\\vfil}\\vfill}\\hspace{3mm}}';
    if (g[1] !== `@{}${col}${ratlla}${col}@{}`) return `la capçalera de la taula: ${g[1]}`;
    const files = g[2].split(` \\\\[${fila}mm]\n`);
    if (files.length !== Math.ceil(n / 2) || files.some((f) => f.split(' & ').length !== 2)) return `les files: ${g[2]}`;
    return '';
  };
  for (const opts of [{ nombres: 3, esp: 'mitja' }, { nombres: 4, esp: 'gran' }, { nombres: 3, esp: 'gran' }, { nombres: 4, esp: 'petit' }]) {
    const qq = { n: 9, ...tot, ...opts, ...(opts.nombres === 4 ? { div: 0 } : {}) }, f = Igualtats.full(qq, 'fitxer', []);
    const t = Igualtats.fitxerTex(f, m), sol = Igualtats.fitxerSolucionari(f, m), compta = (x, re) => (x.match(re) || []).length;
    const g = graella(t, Igualtats.ESPAIS[f.p.esp].fila, 9), gs = graella(sol, 4, 9);
    if (g || gs) falla(`igualtats: ${JSON.stringify(opts)}, ${g ? 'el full' : 'el solucionari'} en dues columnes: ${g || gs}`);
    if (!t.startsWith('% ex4.tex — «Completa la igualtat»') || !t.includes('% per refer aquest full: index.html#act=igu&seed=det\n')) falla('igualtats: la capçalera de exN.tex');
    if (compta(t, /\$\\hspace\{[\d.]+mm\}\d/g) !== 9) falla(`igualtats: les igualtats de exN.tex (${JSON.stringify(opts)})`);
    if (!t.includes('\\colorbox{gray!25}') || !t.includes(`$${f.exemple.solucio.tex}=${f.exemple.t}$`)) falla('igualtats: l\'exemple');
    if (t.includes('$:$') !== !!qq.div || t.includes('$($') !== !!qq.par || t.includes('{}^{2}') !== !!qq.pot || t.includes('\\sqrt{\\ }') !== !!qq.arr)
      falla(`igualtats: l'enunciat ha de dir només els símbols permesos (${JSON.stringify(qq)})`);
    if (!sol.startsWith('% ex4-sol.tex — solucionari de ex4.tex — «Completa la igualtat»') || !f.items.every((x) => sol.includes(`$${x.solucio.tex}=${x.t}$`)))
      falla('igualtats: el solucionari');
  }
}

/* ── 14. index.html i imprimir.html: cada fitxer de assets/, amb la versió (?v=0.9 a la v0.9). Amb una versió nova, el navegador
   els baixa de nou: si no, podia barrejar la pàgina nova amb l'estil o el JavaScript d'abans, que tenia desats. ── */
{
  const v = `?v=${Motor.VERSIO.slice(1)}`, refs = new Set();
  for (const pagina of ['index.html', 'imprimir.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', pagina), 'utf8');
    const seves = [...html.matchAll(/(?:href|src)="(assets\/[^"]*)"/g)].map((m) => m[1]);
    if (!seves.length || seves.some((r) => !r.endsWith(v))) falla(`${pagina}: els fitxers de assets/ han de portar ${v} (${seves.join(', ')})`);
    seves.forEach((r) => refs.add(r.replace(/\?.*/, '')));
  }
  const fitxers = fs.readdirSync(path.join(__dirname, '..', 'assets')).filter((f) => /\.(js|css)$/.test(f));
  if (refs.size !== fitxers.length || !fitxers.every((f) => refs.has(`assets/${f}`)))
    falla(`index.html i imprimir.html: entre les dues, hi han de ser tots els fitxers de assets/ (${[...refs].join(', ')})`);
}

console.log(`${combos} combinacions (i ${combosTotes} amb força i gradual), ${combosIgualtats} de «Completa la igualtat», ${total} exercicis, ${errors} errors`);
process.exit(errors ? 1 : 0);
