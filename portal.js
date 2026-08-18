(() => {
  'use strict';

  const roleGroups = {
    'الإدارة العليا':['مبرمج النظام','مدير المدرسة','نائب مدير المدرسة','المدير الأكاديمي','المدير الإداري'],
    'الإشراف والإدارة التعليمية':['مشرف أكاديمي','مشرف تربوي','مشرف إداري','رئيس قسم','منسق أكاديمي'],
    'التدريس':['معلم','معلم أول','معلم مساعد','مدرس بديل'],
    'شؤون الطلاب':['مسؤول شؤون الطلاب','مسؤول التسجيل والقبول','مسؤول الحضور والغياب','مسؤول الأنشطة الطلابية','مرشد طلابي'],
    'المالية':['مدير مالي','محاسب','مسؤول الرسوم الدراسية','أمين صندوق'],
    'الجودة':['مدير الجودة','مسؤول الجودة','مسؤول التقييم والمتابعة'],
    'العمليات والخدمات':['مسؤول العمليات','مسؤول الموارد البشرية','مسؤول تقنية المعلومات','مسؤول المرافق','أمين مكتبة','مسؤول النقل المدرسي','مسؤول الأمن والسلامة'],
    'أولياء الأمور والطلاب':['ولي أمر','طالب']
  };

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const token = () => localStorage.getItem('school_token') || window.AppState?.token;
  async function api(url, options={}) {
    const h={ 'Content-Type':'application/json', ...(options.headers||{}) };
    if(token()) h.Authorization='Bearer '+token();
    const r=await fetch('/api'+url,{...options,headers:h});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.message||'حدث خطأ');
    return d;
  }

  window.login = async function(username,password){
    try{
      const d=await api('/auth/login',{method:'POST',body:JSON.stringify({username,password})});
      localStorage.setItem('school_token',d.token);
      localStorage.setItem('school_user',JSON.stringify(d.user));
      if(window.AppState){AppState.token=d.token;AppState.user=d.user;}
      if(typeof window.showAppScreen==='function') showAppScreen();
      if(typeof window.updateUserInterface==='function') updateUserInterface();
      if(typeof window.loadDashboard==='function') await loadDashboard();
      if(d.user.role==='ولي أمر') setTimeout(renderParentPortal,150);
      return true;
    }catch(e){
      if(typeof window.notify==='function') notify(e.message,'error');
      return false;
    }
  };

  window.checkSession = async function(){
    if(!token()){ if(typeof showLoginScreen==='function')showLoginScreen(); return false; }
    try{
      const d=await api('/auth/me');
      localStorage.setItem('school_user',JSON.stringify(d.user));
      if(window.AppState){AppState.user=d.user;AppState.token=token();}
      if(typeof showAppScreen==='function')showAppScreen();
      if(typeof updateUserInterface==='function')updateUserInterface();
      if(typeof loadDashboard==='function')await loadDashboard();
      if(d.user.role==='ولي أمر') setTimeout(renderParentPortal,150);
      return true;
    }catch(e){localStorage.removeItem('school_token');localStorage.removeItem('school_user');if(typeof showLoginScreen==='function')showLoginScreen();return false;}
  };

  function style(){
    if(document.getElementById('portal-enhanced-style'))return;
    const s=document.createElement('style');s.id='portal-enhanced-style';s.textContent=`
      #parentPortal{padding:20px;background:#f4f7fb;min-height:calc(100vh - 68px)}
      .pp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:15px}
      .pp-card{background:#fff;border:1px solid #e5eaf1;border-radius:15px;padding:18px;box-shadow:0 4px 15px rgba(0,0,0,.04)}
      .pp-card h3{margin:0 0 12px;color:#173b70}.pp-num{font-size:24px;font-weight:bold;color:#173b70}
      .pp-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:15px 0}.pp-tab{border:0;border-radius:9px;padding:9px 13px;background:#edf2f7}.pp-tab.active{background:#173b70;color:#fff}
      .pp-child{cursor:pointer}.pp-child:hover{border-color:#24579b}.pp-muted{color:#718096;font-size:13px}.pp-table{width:100%;border-collapse:collapse}.pp-table th,.pp-table td{padding:9px;border-bottom:1px solid #e5eaf1;text-align:right}.pp-table th{background:#f8fafc}
      #roleManager{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:none;align-items:center;justify-content:center;padding:20px}.rm-box{background:#fff;border-radius:18px;width:min(900px,96vw);max-height:90vh;overflow:auto;padding:22px}.rm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.rm-role{border:1px solid #e5eaf1;padding:12px;border-radius:10px}.rm-role button{margin-top:7px}
    `;document.head.appendChild(s);
  }

  async function renderParentPortal(){
    if(!window.AppState?.user || AppState.user.role!=='ولي أمر')return;
    style();
    let root=document.getElementById('parentPortal');
    if(!root){root=document.createElement('section');root.id='parentPortal';document.body.appendChild(root);}
    root.innerHTML='<div class="page-header"><div><h2>بوابة ولي الأمر</h2><p>أبناؤك ونتائجهم ورسومهم وملاحظات المدرسة والمعلمين</p></div></div><div id="ppContent">جاري تحميل بيانات الأبناء...</div>';
    try{
      const d=await api('/parent/dashboard');
      const students=d.students||[];
      if(!students.length){root.querySelector('#ppContent').innerHTML='<div class="pp-card">لا يوجد أبناء مرتبطون بحساب ولي الأمر حتى الآن.</div>';return;}
      root.querySelector('#ppContent').innerHTML=`<div class="pp-grid">${students.map((s,i)=>`<div class="pp-card pp-child" data-child="${s.id}"><h3>${esc(s.full_name)}</h3><div class="pp-muted">${esc(s.grade||'')} ${esc(s.class_name||'')}</div><p>الرسوم المتبقية</p><div class="pp-num">${Number(s.financial?.remaining||0).toFixed(2)}</div><p class="pp-muted">نتائج: ${(s.results||[]).length} · ملاحظات: ${(s.notes||[]).length} · سجلات حضور: ${(s.attendance||[]).length}</p></div>`).join('')}</div><div id="ppDetail" style="margin-top:18px"></div>`;
      root.querySelectorAll('[data-child]').forEach(el=>el.onclick=()=>showChildDetail(el.dataset.child,students));
      showChildDetail(students[0].id,students);
    }catch(e){root.querySelector('#ppContent').innerHTML=`<div class="pp-card">${esc(e.message)}</div>`;}
  }

  function showChildDetail(id,students){
    const s=students.find(x=>String(x.id)===String(id));if(!s)return;
    const detail=document.getElementById('ppDetail');if(!detail)return;
    detail.innerHTML=`<div class="pp-card"><h3>${esc(s.full_name)} — الملف الدراسي</h3><div class="pp-grid"><div><b>الرسوم</b><table class="pp-table"><tr><th>البند</th><th>المبلغ</th><th>المدفوع</th><th>الحالة</th></tr>${(s.fees||[]).map(f=>`<tr><td>${esc(f.description)}</td><td>${f.amount}</td><td>${f.paid||0}</td><td>${esc(f.status)}</td></tr>`).join('')||'<tr><td colspan="4">لا توجد رسوم</td></tr>'}</table></div><div><b>النتائج</b><table class="pp-table"><tr><th>المادة</th><th>الاختبار</th><th>الدرجة</th></tr>${(s.results||[]).map(g=>`<tr><td>${esc(g.subject_name||'-')}</td><td>${esc(g.assessment||'-')}</td><td>${g.score}/${g.max_score}</td></tr>`).join('')||'<tr><td colspan="3">لا توجد نتائج</td></tr>'}</table></div><div><b>ملاحظات المعلمين والإدارة</b>${(s.notes||[]).map(n=>`<div style="padding:10px;border-bottom:1px solid #eee"><b>${esc(n.title||'ملاحظة')}</b><div>${esc(n.content)}</div><small class="pp-muted">${esc(n.teacher_name||n.creator_name||'المدرسة')}</small></div>`).join('')||'<p class="pp-muted">لا توجد ملاحظات</p>'}</div><div><b>الحضور والغياب</b><table class="pp-table"><tr><th>التاريخ</th><th>الحالة</th><th>السبب</th></tr>${(s.attendance||[]).slice(0,30).map(a=>`<tr><td>${esc(a.attendance_date)}</td><td>${esc(a.status)}</td><td>${esc(a.reason)}</td></tr>`).join('')||'<tr><td colspan="3">لا توجد سجلات</td></tr>'}</table></div></div></div>`;
  }

  async function populateRoleSelects(){
    if(!window.AppState?.user || !['مبرمج النظام','مدير المدرسة','مدير'].includes(AppState.user.role))return;
    let d;try{d=await api('/roles')}catch{return;}
    const roles=d.roles||Object.values(roleGroups).flat();
    document.querySelectorAll('select').forEach(sel=>{
      const text=(sel.id+' '+sel.name+' '+sel.innerHTML).toLowerCase();
      if(!/role|وظيف|صلاح/.test(text))return;
      const current=sel.value;sel.innerHTML='';
      Object.entries(d.groups||roleGroups).forEach(([group,list])=>{const og=document.createElement('optgroup');og.label=group;list.forEach(r=>{const o=document.createElement('option');o.value=r;o.textContent=r;og.appendChild(o)});sel.appendChild(og)});
      if(current)sel.value=current;
    });
  }

  function addRoleManager(){
    if(document.getElementById('roleManager'))return;
    const modal=document.createElement('div');modal.id='roleManager';modal.innerHTML='<div class="rm-box"><div style="display:flex;justify-content:space-between;align-items:center"><h2>الوظائف والصلاحيات</h2><button class="btn btn-light" id="rmClose">إغلاق</button></div><p>المبرمج يستطيع التحكم في صلاحيات كل وظيفة.</p><div id="rmBody" class="rm-grid">جاري التحميل...</div></div>';document.body.appendChild(modal);document.getElementById('rmClose').onclick=()=>modal.style.display='none';
    api('/roles').then(d=>{const body=document.getElementById('rmBody');body.innerHTML=(d.roles||[]).map(r=>`<div class="rm-role"><b>${esc(r)}</b><br><button class="btn btn-primary" data-role-open="${esc(r)}">تعديل الصلاحيات</button></div>`).join('');body.querySelectorAll('[data-role-open]').forEach(b=>b.onclick=()=>editRole(b.dataset.roleOpen));}).catch(e=>document.getElementById('rmBody').textContent=e.message);
  }
  async function editRole(role){
    const d=await api('/roles/'+encodeURIComponent(role)+'/permissions');
    const all=['dashboard','users','roles','students','parents','attendance','grades','notes','fees','reports','quality','settings'];
    const body=document.getElementById('rmBody');body.innerHTML=`<h3 style="grid-column:1/-1">صلاحيات: ${esc(role)}</h3>`+all.map(p=>{const on=d.permissions?.find(x=>x.permission===p)?.allowed;return `<label class="rm-role"><input type="checkbox" data-perm="${p}" ${on?'checked':''}> ${p}</label>`}).join('')+`<button class="btn btn-success" id="rmSave" style="grid-column:1/-1">حفظ</button>`;
    document.getElementById('rmSave').onclick=async()=>{const permissions={};body.querySelectorAll('[data-perm]').forEach(x=>permissions[x.dataset.perm]=x.checked);await api('/roles/'+encodeURIComponent(role)+'/permissions',{method:'PUT',body:JSON.stringify({permissions})});alert('تم حفظ الصلاحيات');addRoleManager();document.getElementById('roleManager').style.display='flex';};
  }

  function addRoleButton(){
    if(!window.AppState?.user || !['مبرمج النظام','مدير المدرسة','مدير'].includes(AppState.user.role))return;
    if(document.getElementById('roleManagerBtn'))return;
    const b=document.createElement('button');b.id='roleManagerBtn';b.className='btn btn-primary';b.textContent='⚙ الوظائف والصلاحيات';b.style.position='fixed';b.style.left='20px';b.style.bottom='20px';b.style.zIndex='9998';b.onclick=()=>{addRoleManager();document.getElementById('roleManager').style.display='flex';};document.body.appendChild(b);
  }

  setInterval(()=>{if(window.AppState?.user){populateRoleSelects();addRoleButton();if(AppState.user.role==='ولي أمر'&&!document.getElementById('parentPortal'))renderParentPortal();}},1500);
  window.renderParentPortal=renderParentPortal;
  window.addEventListener('load',()=>{style();setTimeout(()=>{if(window.AppState?.user?.role==='ولي أمر')renderParentPortal();populateRoleSelects();addRoleButton();},500);});
})();
