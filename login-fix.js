(() => {
  'use strict';

  const TOKEN_KEY = 'school_token';
  const USER_KEY = 'school_user';
  const $ = (s) => document.querySelector(s);

  async function request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(path, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `خطأ في الخادم (${response.status})`);
    return data;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  }

  function styles() {
    if ($('#login-fix-style')) return;
    const s = document.createElement('style');
    s.id = 'login-fix-style';
    s.textContent = `
      #educore-app{min-height:100vh;background:#f5f7fb;font-family:Tahoma,"Segoe UI",Arial,sans-serif;color:#14233d}
      #educore-app .top{height:70px;background:linear-gradient(135deg,#082d67,#1769d2);color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 28px;box-shadow:0 4px 18px rgba(0,0,0,.08)}
      #educore-app .brand{font-size:20px;font-weight:900}.fix-user{font-size:12px;opacity:.95}.fix-logout{border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;border-radius:8px;padding:9px 14px;cursor:pointer;margin-right:12px}
      #educore-app .wrap{max-width:1200px;margin:0 auto;padding:28px}.fix-title{font-size:25px;font-weight:900;margin:0}.fix-sub{color:#72809a;font-size:13px;margin:7px 0 25px}.fix-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.fix-card{background:#fff;border:1px solid #e4e9f1;border-radius:14px;padding:20px;box-shadow:0 8px 25px rgba(30,55,90,.06)}.fix-num{font-size:30px;font-weight:900;color:#1457c7}.fix-label{font-size:12px;color:#718098;margin-top:5px}.fix-panel{margin-top:20px}.fix-panel h3{margin:0 0 14px;font-size:17px}.fix-actions{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:20px}.fix-actions button{border:0;background:#1457c7;color:#fff;border-radius:8px;padding:10px 15px;cursor:pointer;font-weight:700}.fix-table{width:100%;border-collapse:collapse;font-size:12px;background:#fff}.fix-table th,.fix-table td{padding:11px;border-bottom:1px solid #edf0f5;text-align:right}.fix-table th{background:#f7f9fc}.fix-msg{padding:12px;border-radius:9px;background:#fff7ed;color:#9a3412;margin-bottom:15px;display:none}.fix-msg.show{display:block}@media(max-width:800px){#educore-app .top{padding:0 14px}.fix-grid{grid-template-columns:1fr}.fix-user{display:none}#educore-app .wrap{padding:18px}}
    `;
    document.head.appendChild(s);
  }

  async function loadData() {
    const [dash, users, students, parents] = await Promise.all([
      request('/api/dashboard'),
      request('/api/users'),
      request('/api/students'),
      request('/api/parents')
    ]);
    return { dash: dash.dashboard || {}, users: users.users || [], students: students.students || [], parents: parents.parents || [] };
  }

  function render(data, user) {
    const app = document.createElement('div');
    app.id = 'educore-app';
    app.innerHTML = `
      <header class="top">
        <div class="brand">EduCore Platform</div>
        <div><span class="fix-user">${esc(user.full_name || user.username)} — ${esc(user.role)}</span><button class="fix-logout" id="fix-logout">تسجيل الخروج</button></div>
      </header>
      <main class="wrap">
        <h1 class="fix-title">لوحة تحكم مالك المنصة</h1>
        <p class="fix-sub">تم تسجيل الدخول بنجاح. الخادم وقاعدة البيانات يعملان بصورة طبيعية.</p>
        <div id="fix-msg" class="fix-msg"></div>
        <section class="fix-grid">
          <div class="fix-card"><div class="fix-num">${Number(data.dash.students || 0)}</div><div class="fix-label">الطلاب</div></div>
          <div class="fix-card"><div class="fix-num">${Number(data.dash.teachers || 0)}</div><div class="fix-label">المعلمون</div></div>
          <div class="fix-card"><div class="fix-num">${Number(data.dash.parents || 0)}</div><div class="fix-label">أولياء الأمور</div></div>
        </section>
        <section class="fix-card fix-panel">
          <h3>إدارة المنصة</h3>
          <div class="fix-actions">
            <button data-view="users">المستخدمون (${data.users.length})</button>
            <button data-view="students">الطلاب (${data.students.length})</button>
            <button data-view="parents">أولياء الأمور (${data.parents.length})</button>
            <button id="fix-refresh">تحديث البيانات</button>
          </div>
          <div id="fix-content"><p class="fix-sub">اختر قسمًا من الأزرار أعلاه.</p></div>
        </section>
      </main>`;

    document.body.innerHTML = '';
    document.body.appendChild(app);

    $('#fix-logout').onclick = async () => {
      try { await request('/api/auth/logout', { method: 'POST' }); } catch (_) {}
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      location.reload();
    };

    function table(type) {
      const rows = type === 'users' ? data.users : type === 'students' ? data.students : data.parents;
      const headers = type === 'users' ? ['اسم المستخدم','الاسم','الدور','الحالة'] : type === 'students' ? ['الاسم','رقم الطالب','الصف','الفصل'] : ['الاسم','البريد','الهاتف'];
      const body = rows.map(x => type === 'users'
        ? `<tr><td>${esc(x.username)}</td><td>${esc(x.full_name)}</td><td>${esc(x.role)}</td><td>${x.active ? 'نشط' : 'غير نشط'}</td></tr>`
        : type === 'students'
          ? `<tr><td>${esc(x.full_name)}</td><td>${esc(x.student_number)}</td><td>${esc(x.grade)}</td><td>${esc(x.class_name)}</td></tr>`
          : `<tr><td>${esc(x.full_name)}</td><td>${esc(x.email)}</td><td>${esc(x.phone)}</td></tr>`).join('');
      $('#fix-content').innerHTML = `<table class="fix-table"><thead><tr>${headers.map(esc).map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${body || `<tr><td colspan="${headers.length}">لا توجد بيانات حتى الآن.</td></tr>`}</tbody></table>`;
    }

    app.querySelectorAll('[data-view]').forEach(btn => btn.onclick = () => table(btn.dataset.view));
    $('#fix-refresh').onclick = () => location.reload();
  }

  async function start() {
    styles();
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
      const me = await request('/api/auth/me');
      const user = me.user;
      if (!user) return;
      const data = await loadData();
      render(data, user);
    } catch (e) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      console.warn('Login session could not be restored:', e.message);
    }
  }

  const originalLogin = window.loginNow;
  window.loginNow = async function() {
    try {
      const username = $('#username')?.value.trim();
      const password = $('#password')?.value || '';
      if (!username || !password) throw new Error('أدخل اسم المستخدم وكلمة المرور');
      const d = await request('/api/auth/login', { method:'POST', body:JSON.stringify({ username, password }) });
      localStorage.setItem(TOKEN_KEY, d.token);
      localStorage.setItem(USER_KEY, JSON.stringify(d.user || {}));
      const data = await loadData();
      render(data, d.user);
    } catch (e) {
      const m = $('#msg');
      if (m) { m.textContent = e.message || 'تعذر تسجيل الدخول'; m.className = 'msg show err'; }
      console.error('LOGIN FIX:', e);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
