// motor.js — model, generador i renderitzadors. Sense DOM (navegador i Node).
var Motor=(function(){
const VERSIO='v0.1';
const CFG={OPERAND:[2,9],EXP:[2,3],FRAC_DEN:[2,6],MAX:200,INTENTS:2000};
const ESPAIS={minim:'0.5cm',petit:'1.5cm',mitja:'3cm',gran:'5cm',extragran:'8cm'};
const PREC={'+':1,'-':1,'*':2,':':2};
// PRNG
function hash(s){let h=1779033703^s.length;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),3432918353);h=h<<13|h>>>19}return h>>>0}
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function rng(seed){const f=mulberry(hash(seed));return{f,
 int:(a,b)=>a+Math.floor(f()*(b-a+1)),pick:a=>a[Math.floor(f()*a.length)],
 shuf(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(f()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}}}
// Racionals exactes
const g=(a,b)=>b?g(b,a%b):Math.abs(a);
const R=(n,d)=>{if(d<0){n=-n;d=-d}const k=g(n,d)||1;return{n:n/k,d:d/k}};
const triv=v=>v.d===1&&(v.n===0||v.n===1);
function ev(n,vals){let v;switch(n.t){
 case 'num':v=R(n.v,1);break;
 case 'frac':v=R(n.p,n.q);break;
 case 'neg':{const a=ev(n.a,vals);v=R(-a.n,a.d);break}
 case 'pow':{const a=ev(n.a,vals);v=R(a.n**n.k,a.d**n.k);break}
 case 'bin':{const a=ev(n.l,vals),b=ev(n.r,vals);
  if(n.op==='+')v=R(a.n*b.d+b.n*a.d,a.d*b.d);
  else if(n.op==='-')v=R(a.n*b.d-b.n*a.d,a.d*b.d);
  else if(n.op==='*'){if(triv(a)||triv(b))throw 0;v=R(a.n*b.n,a.d*b.d)}
  else{if(triv(b))throw 0;v=R(a.n*b.d,a.d*b.n)}}}
 if(Math.abs(v.n)>CFG.MAX||v.d>CFG.MAX)throw 0;vals.push(v);return v}
// Renderitzat: UN sol recorregut, dos emissors (regla de parèntesis de l'especificació §4.3)
const TEX={num:v=>''+v,frac:(p,q)=>`\\frac{${p}}{${q}}`,
 op:o=>({'+':'+','-':'-','*':'\\cdot ',':':':'})[o],
 grp:s=>`\\left(${s}\\right)`,note:s=>s.includes('\\frac')?`\\left(${s}\\right)`:`(${s})`,
 pow:(b,k)=>`${b}^{${k}}`,neg:s=>'-'+s};
const pH=s=>s.includes('class="fr"')?`<span class="pg"><span class="pb">(</span>${s}<span class="pb">)</span></span>`:`(${s})`;
const HTML={num:v=>''+v,frac:(p,q)=>`<span class="fr"><span>${p}</span><span>${q}</span></span>`,
 op:o=>({'+':' + ','-':' − ','*':' · ',':':' : '})[o],
 grp:pH,note:pH,pow:(b,k)=>`${b}<sup>${k}</sup>`,neg:s=>'−'+s};
function rend(n,E,st,start){switch(n.t){
 case 'num':return E.num(n.v);
 case 'frac':return E.frac(n.p,n.q);
 case 'neg':{st.neg++;let inner;
  if(n.a.t==='bin'){st.g++;inner=E.grp(rend(n.a,E,st,true))}else inner=rend(n.a,E,st,false);
  const s=E.neg(inner);return start?s:E.note(s)}
 case 'pow':{st.pow++;const b=n.a;let bs;
  if(b.t==='num')bs=E.num(b.v);
  else if(b.t==='bin'){st.g++;bs=E.grp(rend(b,E,st,true))}
  else bs=E.note(rend(b,E,st,true));
  return E.pow(bs,n.k)}
 case 'bin':{st.ops[n.op]=(st.ops[n.op]||0)+1;
  const side=(c,s)=>{const need=c.t==='bin'&&(PREC[c.op]<PREC[n.op]||(PREC[c.op]===PREC[n.op]&&s==='r'));
   if(need){st.g++;return E.grp(rend(c,E,st,true))}return rend(c,E,st,s==='l'?start:false)};
  const l=side(n.l,'l');return l+E.op(n.op)+side(n.r,'r')}}}
const nouSt=()=>({g:0,pow:0,neg:0,ops:{}});
// Construcció de l'arbre
function chain(o,ops){const out=[o[0]],s=[];
 const red=()=>{const op=s.pop(),r=out.pop(),l=out.pop();out.push({t:'bin',op,l,r})};
 ops.forEach((op,i)=>{while(s.length&&PREC[s[s.length-1]]>=PREC[op])red();s.push(op);out.push(o[i+1])});
 while(s.length)red();return out[0]}
function rt(o,ops,rg){if(!ops.length)return o[0];const k=rg.int(0,ops.length-1);
 return{t:'bin',op:ops[k],l:rt(o.slice(0,k+1),ops.slice(0,k),rg),r:rt(o.slice(k+1),ops.slice(k+1),rg)}}
const all=n=>[n].concat(n.t==='bin'?all(n.l).concat(all(n.r)):n.a?all(n.a):[]);
function wrap(n,t,extra){const c=Object.assign({},n);Object.keys(n).forEach(k=>delete n[k]);n.t=t;n.a=c;Object.assign(n,extra)}
function decora(t,p,rg){
 if(p.set==='Q'&&p.int)all(t).filter(x=>x.t==='num'&&rg.f()<.35).forEach(x=>{
  const q=rg.int(...CFG.FRAC_DEN),c=[];for(let a=1;a<q;a++)if(g(a,q)===1)c.push(a);
  x.t='frac';x.p=rg.pick(c);x.q=q;delete x.v});
 const cand=()=>rg.shuf(all(t).filter(x=>x.t==='num'||x.t==='frac'||(p.par&&x.t==='bin')));
 if(p.pot)cand().slice(0,rg.int(1,2)).forEach(x=>wrap(x,'pow',{k:rg.int(...CFG.EXP)}));
 if(p.opo)cand().slice(0,rg.int(1,2)).forEach(x=>wrap(x,'neg',{}));
}
// Acceptació (especificació §4.5)
function acc(t,p,ant){
 const vals=[];try{ev(t,vals)}catch(e){return null}
 const root=vals[vals.length-1],mid=vals.slice(0,-1);
 const lv=f=>p.set==='N'||!f?'N':p.set;
 const ok=(l,v)=>l==='Q'||(v.d===1&&(l==='Z'||v.n>=0));
 const li=lv(p.int),lf=lv(p.fin);
 if(!mid.every(v=>ok(li,v))||!ok(lf,root))return null;
 const st=nouSt(),tex=rend(t,TEX,st,true);
 if(!(st.ops['*']&&st.ops['+']&&st.ops['-']))return null;
 if(p.div&&!st.ops[':'])return null;
 if(p.pot&&!st.pow)return null;
 if(p.opo&&!st.neg)return null;
 if(p.par?st.g<1:st.g>0)return null;
 if(p.forca){const w=(l,v)=>l==='Z'?v.n<0:l==='Q'?v.d>1:true;
  if(li!=='N'&&!mid.some(v=>w(li,v)))return null;
  if(lf!=='N'&&!w(lf,root))return null}
 if(ant.has(tex))return null;
 return{tex,html:rend(t,HTML,nouSt(),true),valor:root,arbre:t}}
function genera(p,rg,ant){
 for(let k=0;k<CFG.INTENTS;k++){
  const nb=rg.int(3+(+!!p.div),5+(+!!p.div)),ops=['*','+','-'];if(p.div)ops.push(':');
  const hab=ops.slice();while(ops.length<nb)ops.push(rg.pick(hab));rg.shuf(ops);
  const o=[];for(let i=0;i<=nb;i++)o.push({t:'num',v:rg.int(...CFG.OPERAND)});
  const t=p.par?rt(o,ops,rg):chain(o,ops);
  decora(t,p,rg);
  const r=acc(t,p,ant);if(r)return r}
 return null}
function valida(p){
 if(p.opo&&p.set==='N')return{ok:false,motiu:"L'oposat no es pot fer servir amb ℕ."};
 if(p.opo&&!p.int)return{ok:false,motiu:"L'oposat crea intermedis negatius: marca «intermedis»."};
 if(p.set==='Q'&&p.fin&&!p.int&&!(p.div&&p.par))return{ok:false,motiu:'Amb ℚ només al resultat final calen divisions i parèntesis (l\'última operació ha de ser una divisió).'};
 return{ok:true}}
// Progressió gradual dels extres: l'exercici i (0..n-1) inclou cada extre marcat amb
// probabilitat ((i+1)/(n-1))^2; els 2 últims, tots. El sorteig depèn de la llavor mestra
// i de i (no de ↻): «un altre» canvia l'exercici, però no el seu nivell.
const EXTRES=['div','par','pot','opo'];   // ordre de reparació: div i par primer (ℚ només final)
function gradual(p,mestra,i){
 const on=EXTRES.filter(k=>p[k]);if(!p.grad||!on.length)return p;
 const n=p.n||1,pr=i>=n-2?1:Math.min(1,((i+1)/(n-1))**2);
 const rg=rng(`${mestra}:${i}:grad`),q=Object.assign({},p);
 on.forEach(k=>{q[k]=rg.f()<pr?1:0});
 for(const k of on){if(valida(q).ok)break;q[k]=1}   // si treure un extre fa impossible el conjunt, es torna a posar
 return q}
function exercici(p,mestra,i,r,ant){
 const q=gradual(p,mestra,i),x=genera(q,rng(`${mestra}:${i}:${r}`),ant||new Set());
 if(!x)return{error:"No he pogut generar aquest exercici amb aquestes opcions.",params:q};
 x.params=q;x.extres=EXTRES.filter(k=>q[k]);return x}
function fitxerTex(exs,p,m){
 const conj=p.set==='N'?'N':`${p.set}(${[p.int&&'int',p.fin&&'fin'].filter(Boolean).join(',')})`;
 const opts=['div','pot','par','opo','vs','grad'].filter(k=>p[k]).map(k=>k==='grad'?'gradual':k).join(' ');
 let s=`% ex${m.num}.tex — generat per «Operacions combinades 1r ESO» ${VERSIO}\n% llavor=${m.seed} · n=${p.n} · espai=${p.esp} · conjunt=${conj}${opts?' · '+opts:''}\n`
  +`\\begin{enumerate}\n\\renewcommand{\\labelenumi}{\\textbf{\\arabic{enumi})}}\n\\setlength{\\itemsep}{0pt}\n`;
 exs.forEach(e=>{s+=`\\item $\\displaystyle ${e.tex}$\n\\par\\vspace${p.vs?'*':''}{${ESPAIS[p.esp]}}\n`});
 return s+'\\end{enumerate}\n'}
const M={VERSIO,ESPAIS,EXTRES,valida,exercici,fitxerTex};
if(typeof module!=='undefined')module.exports=M;
return M})();
