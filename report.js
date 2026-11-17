// Progress report — shared by the student app (index.html) and the admin page (admin.html).
// Needs data.js loaded first. buildReport(progress) -> HTML string.
(function(){
const css=`.rp-sum{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
.rp-box{background:#fff;border:1px solid #e6e2d9;border-radius:14px;padding:14px}
.rp-n{font:800 28px Inter,sans-serif}.rp-l{color:#6b6878;font-size:13.5px}
.rp-bar{height:8px;background:#ece8df;border-radius:8px;overflow:hidden;margin-top:6px}.rp-bar i{display:block;height:100%;background:linear-gradient(90deg,#4c3bcf,#ff6b35)}
.rp-t{width:100%;border-collapse:collapse;font-size:14px;background:#fff}.rp-t td,.rp-t th{padding:8px;border-bottom:1px solid #e6e2d9;text-align:start;vertical-align:middle}
.rp-t th{background:#faf8f3;color:#6b6878;font-size:12.5px}.rp-u td{background:#f8f6ff;font-weight:800}
.rp-s{display:inline-block;padding:2px 9px;border-radius:99px;font-size:12px;font-weight:700}
.rp-done{background:#ebfbee;color:#2b8a3e}.rp-prog{background:#fff4e6;color:#e8590c}.rp-none{background:#f1f0ec;color:#8a8796}
.rp-h{margin:20px 0 8px;font-size:18px}.rp-list{margin:0;padding-inline-start:20px}.rp-list li{margin:4px 0}
.rp-wrap{overflow-x:auto;border:1px solid #e6e2d9;border-radius:14px}`;
function injectCss(){if(document.getElementById('rp-css'))return;const s=document.createElement('style');s.id='rp-css';s.textContent=css;document.head.appendChild(s)}
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct=(a,b)=>b?Math.round(a/b*100):0;
const fmt=t=>{if(!t)return '—';try{return new Date(t).toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'})}catch(e){return ''}};
const WHERE={home:'الخطة',units:'الدروس',unit:'درس',flash:'البطاقات',exam:'امتحان',build:'ترتيب الجمل',speak:'المحادثة',story:'قصة الأزمنة',mistakes:'الأخطاء',progress:'تقدمي'};

window.lessonStats=function(st){
  st=st||{};const known=st.known||{},exams=st.exams||[],spoken=st.spoken||{};
  const res={};
  UNITS.forEach(u=>u.lessons.forEach(l=>{
    const ids=[];PHRASES.forEach((p,i)=>{if(p[3]===l.id)ids.push(i)});
    const k=ids.filter(i=>known[i]).length;
    const ex=exams.filter(e=>e.sc===l.id);const best=ex.length?Math.max(...ex.map(e=>pct(e.s,e.n))):null;
    const sp=[];SPEAK.forEach((s,i)=>{if(s.l===l.id)sp.push(i)});const spk=sp.filter(i=>spoken[i]).length;
    let status='none';
    const ph=ids.length?k/ids.length:1, spr=sp.length?spk/sp.length:1;
    if(k||ex.length||spk)status='prog';
    if(ph>=0.9&&(best!=null&&best>=70)&&spr>=0.5)status='done';
    res[l.id]={id:l.id,ar:l.ar,unit:u.id,n:ids.length,k,best,tries:ex.length,spN:sp.length,spK:spk,status};
  }));
  return res;
};

window.buildReport=function(st,opts){
  injectCss();st=st||{};opts=opts||{};
  const known=Object.keys(st.known||{}).length,totP=PHRASES.length;
  const tasks=PLAN.reduce((s,d)=>s+d.tasks.length,0),done=Object.keys(st.plan||{}).length;
  const exams=st.exams||[];const best=exams.length?Math.max(...exams.map(e=>pct(e.s,e.n))):null;
  const avg=exams.length?Math.round(exams.reduce((s,e)=>s+pct(e.s,e.n),0)/exams.length):null;
  const LS=lessonStats(st);const lessons=Object.values(LS);
  const lDone=lessons.filter(l=>l.status==='done').length;
  const overall=Math.round((known/totP*0.5+done/tasks*0.5)*100);
  const curDay=PLAN.find(d=>d.tasks.some((t,i)=>!(st.plan||{})[d.d+'-'+i]));
  const daysDone=PLAN.filter(d=>d.tasks.every((t,i)=>(st.plan||{})[d.d+'-'+i])).length;
  const last=st.last;
  let h=`<div class="rp-sum">
   <div class="rp-box"><div class="rp-l">التقدم الكلي</div><div class="rp-n">${overall}%</div><div class="rp-bar"><i style="width:${overall}%"></i></div></div>
   <div class="rp-box"><div class="rp-l">العبارات المحفوظة</div><div class="rp-n">${known}<small style="font-size:14px">/${totP}</small></div><div class="rp-bar"><i style="width:${pct(known,totP)}%"></i></div></div>
   <div class="rp-box"><div class="rp-l">أيام الخطة المكتملة</div><div class="rp-n">${daysDone}<small style="font-size:14px">/${PLAN.length}</small></div><div class="rp-bar"><i style="width:${pct(done,tasks)}%"></i></div><div class="rp-l">${done}/${tasks} مهمة</div></div>
   <div class="rp-box"><div class="rp-l">الدروس المكتملة</div><div class="rp-n">${lDone}<small style="font-size:14px">/${lessons.length}</small></div></div>
   <div class="rp-box"><div class="rp-l">الامتحانات</div><div class="rp-n">${exams.length}</div><div class="rp-l">أفضل: ${best??'—'}% · متوسط: ${avg??'—'}%</div></div>
   <div class="rp-box"><div class="rp-l">آخر نشاط</div><div style="font-weight:800;margin-top:4px">${last?esc(WHERE[last.v]||last.v)+(last.l?' · '+esc(last.l):''):'—'}</div><div class="rp-l">${fmt(last&&last.at||st.updatedAt)}</div></div>
  </div>`;

  // where now / what's left
  h+=`<h3 class="rp-h">📍 وصل فين؟ وباقي إيه؟</h3><div class="rp-box">`;
  if(curDay){const left=curDay.tasks.map((t,i)=>({t,i})).filter(x=>!(st.plan||{})[curDay.d+'-'+x.i]);
    h+=`<div><b>اليوم الحالي في الخطة: ${curDay.d} من ${PLAN.length}</b> — <span class="en" dir="ltr">${esc(curDay.t)}</span></div>
    <div class="rp-l" style="margin-top:6px">مهام باقية في اليوم ده:</div><ul class="rp-list">${left.map(x=>`<li>${esc(x.t[2])}</li>`).join('')}</ul>`;
    const rest=PLAN.filter(d=>d.d>curDay.d);if(rest.length)h+=`<div class="rp-l" style="margin-top:8px">أيام باقية بعده: ${rest.map(d=>d.d).join('، ')}</div>`;
  }else h+=`<b>🎉 خلّص الخطة كلها (12 يوم)!</b>`;
  const notDone=lessons.filter(l=>l.status!=='done');
  if(notDone.length)h+=`<div class="rp-l" style="margin-top:10px">دروس لسه مكتملتش (${notDone.length}): ${notDone.map(l=>`<b class="en">${l.id}</b>`).join(' · ')}</div>`;
  h+=`<div class="rp-l" style="margin-top:6px">أخطاء محتاجة مراجعة: <b>${(st.mist||[]).length}</b> · جمل رتّبها صح: <b>${st.built||0}</b></div></div>`;

  // per lesson table
  h+=`<h3 class="rp-h">📚 التقدم في كل درس</h3><div class="rp-wrap"><table class="rp-t"><tr><th>الدرس</th><th>العبارات</th><th>أفضل امتحان</th><th>محادثة</th><th>الحالة</th></tr>`;
  UNITS.forEach(u=>{
    const ue=exams.filter(e=>e.sc===u.id);const ub=ue.length?Math.max(...ue.map(e=>pct(e.s,e.n))):null;
    h+=`<tr class="rp-u"><td colspan="5">${esc(u.ar)} ${ub!=null?`<span class="rp-l" style="font-weight:600"> — امتحان الوحدة: ${ub}%</span>`:''}</td></tr>`;
    u.lessons.forEach(l=>{const s=LS[l.id];
      h+=`<tr><td><b class="en">${l.id}</b> ${esc(l.ar)}</td>
      <td>${s.n?`<span class="en">${s.k}/${s.n}</span><div class="rp-bar" style="max-width:110px"><i style="width:${pct(s.k,s.n)}%"></i></div>`:'—'}</td>
      <td class="en">${s.best!=null?s.best+'% <span class="rp-l">('+s.tries+'×)</span>':'—'}</td>
      <td class="en">${s.spN?s.spK+'/'+s.spN:'—'}</td>
      <td><span class="rp-s rp-${s.status}">${s.status==='done'?'✓ مكتمل':s.status==='prog'?'جاري':'لم يبدأ'}</span></td></tr>`});
  });
  h+=`</table></div><div class="rp-l" style="margin-top:6px">الدرس يعتبر مكتمل لما: 90% من عباراته محفوظة + امتحان الدرس 70% أو أكثر + نص أسئلة المحادثة على الأقل.</div>`;

  // exam history
  if(exams.length){h+=`<h3 class="rp-h">📝 سجل الامتحانات</h3><div class="rp-wrap"><table class="rp-t"><tr><th>التاريخ</th><th>النطاق</th><th>النتيجة</th></tr>`+
    exams.slice(-15).reverse().map(e=>`<tr><td>${fmt(e.t)}</td><td>${esc(scopeLabel(e.sc))}</td><td class="en"><b>${pct(e.s,e.n)}%</b> <span class="rp-l">(${e.s}/${e.n})</span></td></tr>`).join('')+`</table></div>`}
  return h;
};
function scopeLabel(s){if(!s||s==='all')return 'كل المنهج';if(s==='mistakes')return 'الأخطاء';const u=UNITS.find(x=>x.id===s);if(u)return u.ar;for(const x of UNITS)for(const l of x.lessons)if(l.id===s)return s+' — '+l.ar;return s}
})();
