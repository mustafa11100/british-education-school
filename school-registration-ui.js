(()=>{
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
async function loadOptions(){
  const role=$('regRole'), school=$('regSchool');
  if(!role||!school)return;
  try{
    const r=await fetch('/api/public/registration-options',{cache:'no-store'});
    const d=await r.json();
    if(!r.ok||!d.success)throw new Error(d.message||'تعذر تحميل خيارات التسجيل');
    role.innerHTML='<option value="">اختر نوع الحساب *</option>'+(d.roles||[]).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    school.innerHTML='<option value="">اختر المدرسة *</option>'+(d.schools||[]).map(s=>`<option value="${Number(s.id)}">${esc(s.name)}</option>`).join('');
  }catch(e){
    role.innerHTML='<option value="">تعذر تحميل الوظائف</option>';
    school.innerHTML='<option value="">تعذر تحميل المدارس</option>';
    showMsg(e.message,'err');
  }
}
function showMsg(text,type){const m=$('regMsg');if(!m)return;m.textContent=text||'';m.className=`msg show ${type||''}`;}
function ensureUsernameBox(){
  let box=$('usernameResult');
  if(box)return box;
  const button=document.querySelector('#registerView button.btn');
  if(!button)return null;
  box=document.createElement('div');
  box.id='usernameResult';
  box.style.cssText='display:none;margin-top:14px;padding:14px;border:1px solid #d6c58e;border-radius:10px;background:#faf5e4;font-weight:800;line-height:1.9;word-break:break-word';
  button.insertAdjacentElement('afterend',box);
  return box;
}
function showUsername(d){
  const box=ensureUsernameBox();
  if(!box)return;
  const username=d.username||d.school_username||d.suggested_username||'';
  if(!username){box.style.display='block';box.textContent='تم إرسال الطلب بنجاح. سيتم تزويدك باسم المستخدم بعد إنشاء الحساب.';return;}
  box.innerHTML=`تم إرسال طلب التسجيل بنجاح.<br>اسم المستخدم الخاص بك: <strong>${esc(username)}</strong><br><small>احتفظ به لاستخدامه بعد اعتماد الحساب من الإدارة.</small>`;
  box.style.display='block';
}
async function registerAccount(){
  const full=$('regName')?.value.trim()||'';
  const email=$('regEmail')?.value.trim()||'';
  const phone=$('regPhone')?.value.trim()||'';
  const role=$('regRole')?.value||'';
  const school_id=Number($('regSchool')?.value||0);
  const password=$('regPassword')?.value||'';
  const password2=$('regPassword2')?.value||'';
  showMsg('','');
  if(!full||!email||!role||!school_id||!password||!password2){showMsg('أكمل جميع الحقول المطلوبة.','err');return;}
  if(password!==password2){showMsg('كلمتا المرور غير متطابقتين.','err');return;}
  if(password.length<8){showMsg('كلمة المرور يجب أن تكون 8 أحرف على الأقل.','err');return;}
  try{
    const r=await fetch('/api/public/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({full_name:full,email,phone,role,password,school_id})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.success)throw new Error(d.message||'تعذر إرسال طلب التسجيل');
    showUsername(d);
    showMsg('تم التسجيل بنجاح. انتظر اعتماد الإدارة.','ok');
  }catch(e){showMsg(e.message||'حدث خطأ أثناء التسجيل','err');}
}
window.registerAccount=registerAccount;
window.addEventListener('DOMContentLoaded',()=>{loadOptions();ensureUsernameBox();});
})();