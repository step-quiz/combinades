(function(){
const D={n:5,esp:'mitja',set:'N',int:1,fin:1,div:0,opo:0,pot:0,par:0,forca:1,fit:1,vs:0};
const B=['int','fin','div','opo','pot','par','forca','vs'],$=id=>document.getElementById(id);
let S=Object.assign({},D),seed=Math.random().toString(36).slice(2,8),R=[],EX=[];
function llegeix(){
 let q={};try{Object.assign(q,JSON.parse(localStorage.getItem('combinades')||'{}'))}catch(e){}
 const h=new URLSearchParams(location.hash.slice(1));
 if(h.toString()){q={};h.forEach((v,k)=>q[k]=v)}
 const num=(v,a,b,d)=>{v=parseInt(v,10);return v>=a&&v<=b?v:d};
 S.n=num(q.n,1,10,D.n);S.fit=num(q.fit,1,99,D.fit);
 S.esp=Motor.ESPAIS[q.esp]?q.esp:D.esp;S.set=['N','Z','Q'].includes(q.set)?q.set:D.set;
 B.forEach(k=>S[k]=q[k]===undefined?D[k]:(+q[k]?1:0));
 if(q.seed&&/^[a-z0-9]{1,12}$/.test(q.seed))seed=q.seed;
 R=(q.r?String(q.r).split(','):[]).map(x=>parseInt(x,10)||0)}
function desa(){
 const q=Object.assign({},S,{seed,r:R.join(',')}),u=new URLSearchParams(q).toString();
 try{history.replaceState(null,'','#'+u)}catch(e){}
 try{localStorage.setItem('combinades',JSON.stringify(S))}catch(e){}}
function baixa(nom,txt){
 const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([txt],{type:'text/plain;charset=utf-8'})),download:nom});
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function render(){
 if(S.set==='N')S.opo=0;
 if(!S.int&&!S.fin)S.int=1;
 while(R.length<S.n)R.push(0);R.length=S.n;
 $('n').value=S.n;$('fit').value=S.fit;
 document.querySelectorAll('[data-esp]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.esp===S.esp));
 document.querySelectorAll('[data-set]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.set===S.set));
 B.forEach(k=>$(k).checked=!!S[k]);
 $('onviuen').style.display=S.set==='N'?'none':'';
 $('opo').disabled=S.set==='N';$('opo').parentNode.title=S.set==='N'?"L'oposat necessita ℤ o ℚ":'';
 const v=Motor.valida(S);let h='';EX=[];
 if(!v.ok)h=`<p class="err">${v.motiu}</p>`;
 else{const ant=new Set();
  for(let i=0;i<S.n;i++){const e=Motor.exercici(S,seed,i,R[i],ant);
   h+=`<div class="carta"><div class="cap"><span class="num">${i+1}</span><button data-r="${i}" title="Un altre">↻</button><small>${seed}:${i}:${R[i]}</small></div>`
    +(e.error?`<p class="err">${e.error}</p>`:`<div class="math">${e.html}</div>`)+`</div>`;
   if(!e.error){ant.add(e.tex);EX.push(e)}}}
 $('full').innerHTML=h;$('full').style.setProperty('--esp',Motor.ESPAIS[S.esp]);
 const ok=v.ok&&EX.length===S.n;
 $('codi').textContent=ok?Motor.fitxerTex(EX,S,{num:S.fit,seed}):'';
 $('baixa').textContent=`Baixa ex${S.fit}.tex`;$('baixa').disabled=$('copia').disabled=$('pdf').disabled=!ok;
 $('recompte').textContent=`${S.n} operacions · espai ${S.esp} · ${S.set}`;
 $('segell').textContent=Motor.VERSIO;desa()}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.esp)S.esp=b.dataset.esp;
 else if(b.dataset.set)S.set=b.dataset.set;
 else if(b.dataset.r!==undefined)R[+b.dataset.r]++;
 else if(b.id==='tot'){seed=Math.random().toString(36).slice(2,8);R=[]}
 else if(b.id==='pdf'){window.print();return}
 else if(b.id==='copia'){const txt=$('codi').textContent,fet=()=>{b.textContent='Copiat ✓';setTimeout(()=>b.textContent='Copia el TeX',1500)};
  const alt=()=>{const t=document.createElement('textarea');t.value=txt;document.body.appendChild(t);t.select();try{document.execCommand('copy');fet()}catch(x){}t.remove()};
  if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(txt).then(fet,alt);else alt();return}
 else if(b.id==='baixa'){
  baixa(`ex${S.fit}.tex`,$('codi').textContent);S.fit=Math.min(99,S.fit+1)}
 else if(b.dataset.entorn){baixa(b.dataset.entorn+'.tex',Entorn[b.dataset.entorn]);return}
 else return;
 render()});
document.addEventListener('change',e=>{const t=e.target;
 if(t.id==='n')S.n=Math.max(1,Math.min(10,parseInt(t.value,10)||D.n));
 else if(t.id==='fit')S.fit=Math.max(1,Math.min(99,parseInt(t.value,10)||1));
 else if(B.includes(t.id)){S[t.id]=t.checked?1:0;if(t.id==='int'&&!S.int&&!S.fin)S.fin=1;if(t.id==='fin'&&!S.fin&&!S.int)S.int=1}
 else return;
 render()});
llegeix();render();
})();
