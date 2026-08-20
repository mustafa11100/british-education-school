(()=>{
  'use strict';
  if(window.__EDUCORE_LANDING_UI__) return;
  window.__EDUCORE_LANDING_UI__=true;

  const css=`
    .ec-public-actions{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 18px;padding:12px;background:#fff;border:1px solid #e3dfd2;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.06)}
    .ec-public-actions button{border:1px solid #c9a227;background:#080808;color:#e3c65b;border-radius:10px;padding:11px 18px;font-weight:800;cursor:pointer;transition:.2s}
    .ec-public-actions button:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(0,0,0,.12)}
    .ec-public-actions button.secondary{background:#fff;color:#171717;border-color:#d9d2bf}
    .ec-public-actions button.rules{background:#f7f1df;color:#6f5608}
    .ec-rules{margin-top:22px;background:#fff;border:1px solid #e3dfd2;border-radius:20px;padding:30px;box-shadow:0 18px 45px rgba(0,0,0,.07)}
    .ec-rules h2{margin:0 0 8px;font-size:26px;color:#111}
    .ec-rules .lead{margin:0 0 20px;color:#707070;line-height:1.9;font-size:13px}
    .ec-rules-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .ec-rule{padding:16px;border:1px solid #eee9dc;border-radius:13px;background:#fbfaf7;line-height:1.8;color:#3f3f3f;font-size:13px}
    .ec-rule strong{display:block;color:#111;margin-bottom:4px}
    .ec-about{margin-top:22px;display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .ec-about-card{padding:22px;border-radius:16px;background:#111;color:#fff;border:1px solid #c9a227}
    .ec-about-card h3{margin:0 0 8px;color:#e3c65b;font-size:19px}
    .ec-about-card p{margin:0;color:#e5e5e5;line-height:2;font-size:13px}
    .lang-menu .lang-item>span:first-child{display:none!important}
    @media(max-width:700px){.ec-public-actions{display:grid;grid-template-columns:1fr}.ec-public-actions button{width:100%}.ec-rules-grid,.ec-about{grid-template-columns:1fr}.ec-rules{padding:22px}}
  `;
  const style=document.createElement('style');style.id='educore-public-landing-style';style.textContent=css;document.head.appendChild(style);

  const t={
    ar:{login:'تسجيل الدخول',register:'تسجيل جديد',rules:'قواعد المنصة',rulesTitle:'قواعد المنصة',rulesLead:'قواعد واضحة لحماية المستخدمين وتنظيم استخدام خدمات EduCore.',
      items:[['الاستخدام المسؤول','تُستخدم المنصة للأغراض التعليمية والإدارية المشروعة فقط.'],['حماية الحساب','يلتزم كل مستخدم بالمحافظة على سرية اسم المستخدم وكلمة المرور وعدم مشاركتهما.'],['الصلاحيات','تختلف صلاحيات المستخدم حسب دوره الوظيفي وحالة الحساب والمدرسة المرتبطة به.'],['دقة البيانات','يتحمل المستخدم مسؤولية صحة البيانات التي يدخلها أو يعتمدها داخل النظام.'],['احترام الخصوصية','يُمنع الاطلاع على بيانات الآخرين أو استخدامها خارج نطاق الصلاحيات الممنوحة.'],['الطلبات والموافقات','تخضع طلبات التسجيل والموظفين للمراجعة والاعتماد وفق الصلاحيات الإدارية.']],
      vision:'رؤيتنا',visionText:'تقديم نظام تعليمي رقمي حديث يسهّل إدارة المؤسسات التعليمية، ويجمع جميع العمليات الإدارية والتعليمية في منصة واحدة آمنة ومنظمة وسهلة الاستخدام.',mission:'رسالتنا',missionText:'تمكين المدارس والمؤسسات التعليمية من إدارة أعمالها بكفاءة، وتحسين تجربة الطلاب والمعلمين والإداريين وأولياء الأمور من خلال حلول رقمية متكاملة.'},
    en:{login:'Sign in',register:'Register',rules:'Platform rules',rulesTitle:'Platform rules',rulesLead:'Clear rules that protect users and organize the use of EduCore services.',
      items:[['Responsible use','The platform is intended for legitimate educational and administrative purposes only.'],['Account security','Users must keep their username and password confidential and must not share them.'],['Permissions','Access is determined by the user role, account status and associated school.'],['Data accuracy','Users are responsible for the accuracy of information they enter or approve.'],['Privacy','Accessing or using other users’ data outside granted permissions is prohibited.'],['Requests and approvals','Registration and staff requests are reviewed and approved according to administrative permissions.']],
      vision:'Our vision',visionText:'To provide a modern digital education system that simplifies institutional management and brings administrative and educational operations into one secure, organized platform.',mission:'Our mission',missionText:'To empower schools and educational institutions to manage their work efficiently and improve the experience of students, teachers, administrators and parents through integrated digital solutions.'}
  };

  function currentLang(){return document.documentElement.lang==='en'?'en':'ar'}
  function scrollToId(id){const el=document.getElementById(id);if(el)el.scrollIntoView({behavior:'smooth',block:'start'})}
  function showLogin(){if(typeof window.showView==='function')window.showView('login');else scrollToId('loginView');scrollToId('loginView')}
  function showRegister(){if(typeof window.showView==='function')window.showView('register');else scrollToId('registerView');scrollToId('registerView')}

  function buildActions(){
    const hero=document.querySelector('.hero');
    if(!hero || document.getElementById('educorePublicActions')) return;
    const bar=document.createElement('div');bar.id='educorePublicActions';bar.className='ec-public-actions';
    bar.innerHTML='<button id="ecLoginBtn" type="button"></button><button id="ecRegisterBtn" class="secondary" type="button"></button><button id="ecRulesBtn" class="rules" type="button"></button>';
    hero.parentNode.insertBefore(bar,hero);
    document.getElementById('ecLoginBtn').onclick=showLogin;
    document.getElementById('ecRegisterBtn').onclick=showRegister;
    document.getElementById('ecRulesBtn').onclick=()=>scrollToId('educoreRules');
  }

  function buildRules(){
    if(document.getElementById('educoreRules')) return;
    const shell=document.querySelector('.shell');if(!shell)return;
    const section=document.createElement('section');section.id='educoreRules';section.className='ec-rules';
    section.innerHTML='<h2 id="ecRulesTitle"></h2><p id="ecRulesLead" class="lead"></p><div id="ecRulesGrid" class="ec-rules-grid"></div><div class="ec-about"><article class="ec-about-card"><h3 id="ecVision"></h3><p id="ecVisionText"></p></article><article class="ec-about-card"><h3 id="ecMission"></h3><p id="ecMissionText"></p></article></div>';
    shell.appendChild(section);
  }

  function render(){
    buildActions();buildRules();
    const x=t[currentLang()];
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
    set('ecLoginBtn',x.login);set('ecRegisterBtn',x.register);set('ecRulesBtn',x.rules);set('ecRulesTitle',x.rulesTitle);set('ecRulesLead',x.rulesLead);set('ecVision',x.vision);set('ecVisionText',x.visionText);set('ecMission',x.mission);set('ecMissionText',x.missionText);
    const grid=document.getElementById('ecRulesGrid');
    if(grid)grid.innerHTML=x.items.map((i)=>'<article class="ec-rule"><strong>'+i[0]+'</strong><span>'+i[1]+'</span></article>').join('');
    const langBtn=document.querySelector('.lang');if(langBtn)langBtn.textContent=currentLang()==='en'?'Language':'اللغة';
  }

  document.addEventListener('educore:language-change',render);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
})();