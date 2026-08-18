(()=>{
  const byId=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const apply=()=>{
    document.documentElement.lang='ar';
    document.documentElement.dir='rtl';
    const style=document.createElement('style');
    style.textContent=`
      body{font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial,sans-serif!important}
      .login{background:radial-gradient(circle at 15% 15%,#3d6aa8 0,#173b70 38%,#081a35 100%)!important}
      .loginbox{border:1px solid rgba(255,255,255,.18);box-shadow:0 35px 110px rgba(0,0,0,.42)!important}
      .hero{position:relative;overflow:hidden;background:linear-gradient(145deg,#0b1f3c,#173b70 55%,#24579b)!important}
      .hero:after{content:"";position:absolute;width:280px;height:280px;border:1px solid rgba(255,255,255,.14);border-radius:50%;left:-100px;bottom:-120px}
      .hero .logo{background:linear-gradient(135deg,rgba(255,255,255,.25),rgba(255,255,255,.08));border:1px solid rgba(255,255,255,.2)}
      .hero h1{letter-spacing:.2px}
      .educore-footer{margin-top:28px;padding-top:18px;border-top:1px solid rgba(255,255,255,.16);font-size:12px;color:#dbeafe;line-height:1.9}
      .educore-footer b{color:#fff}
      .loginform .educore-meta{margin-top:22px;padding:14px 16px;border:1px solid #e6ebf2;border-radius:14px;background:#f8fafc;color:#667085;font-size:12px;line-height:1.9}
      .brandname{font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial,sans-serif!important}
    `;
    document.head.appendChild(style);
    const hero=document.querySelector('.hero');
    if(hero){
      const h=hero.querySelector('h1'); if(h) h.textContent='EduCore Platform';
      const p=hero.querySelector('p'); if(p) p.textContent='منصة مختصة بإدارة المدارس والمؤسسات التعليمية، تجمع الإدارة الأكاديمية والتشغيلية في منظومة واحدة آمنة وقابلة للتخصيص.';
      if(!hero.querySelector('.educore-footer')) hero.insertAdjacentHTML('beforeend','<div class="educore-footer"><div>إنتاج وتطوير <b>مصطفى عادل الحاج زيدان</b></div><div>الإصدار الأول · 2026</div></div>');
    }
    const title=document.querySelector('.loginform h2'); if(title) title.textContent='تسجيل الدخول إلى EduCore Platform';
    const sub=document.querySelector('.loginform .muted'); if(sub) sub.textContent='أدخل بيانات حسابك للوصول إلى بيئة مدرستك بأمان.';
    const form=document.querySelector('.loginform');
    if(form && !form.querySelector('.educore-meta')) form.insertAdjacentHTML('beforeend','<div class="educore-meta"><b>منصة مختصة بإدارة المدارس والمؤسسات التعليمية</b><br>هوية المنصة مستقلة عن هوية كل مدرسة، مع تخصيص آمن لكل مؤسسة.</div>');
    const brand=byId('brandName'); if(brand && (!window.S?.school?.name || window.S.school.name==='منصة إدارة المدارس')) brand.textContent='EduCore Platform';
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply); else apply();
})();