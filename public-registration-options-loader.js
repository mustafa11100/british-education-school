const Module = require('module');
const Database = require('better-sqlite3');
const path = require('path');
const originalLoad = Module._load;

// Propagate this preload into the backend child process created by proxy2.js.
const preloadPath = path.join(__dirname, 'public-registration-options-loader.js');
const existingNodeOptions = process.env.NODE_OPTIONS || '';
if (!existingNodeOptions.includes(preloadPath)) {
  process.env.NODE_OPTIONS = `${existingNodeOptions} --require=${preloadPath}`.trim();
}

let installed = false;
Module._load = function(request, parent, isMain) {
  const loaded = originalLoad.apply(this, arguments);
  if (request !== 'express' || installed || typeof loaded !== 'function') return loaded;
  const wrapped = function(...args) {
    const app = loaded(...args);
    if (!app || typeof app.get !== 'function' || app.__publicRegistrationOptionsRoute) return app;
    app.__publicRegistrationOptionsRoute = true;
    app.get('/api/public/registration-options', (req, res) => {
      const roles = ['معلم','معلم أول','معلم مساعد','ولي أمر','طالب','مسؤول شؤون الطلاب','مسؤول التسجيل والقبول','مسؤول الحضور والغياب','مرشد طلابي','محاسب','مسؤول الرسوم الدراسية','أمين صندوق','مسؤول الجودة','مسؤول العمليات','مسؤول الموارد البشرية','مسؤول تقنية المعلومات','مسؤول المرافق','أمين مكتبة'];
      let db; let schools = [];
      try {
        db = new Database(path.join(__dirname, 'school.db'), { readonly: true });
        try { schools = db.prepare("SELECT id,name FROM schools WHERE status='active' ORDER BY name").all(); }
        catch (_) { schools = db.prepare('SELECT id,name FROM schools WHERE active=1 ORDER BY name').all(); }
      } catch (_) {
        return res.status(500).json({ success:false, error:'تعذر تحميل بيانات التسجيل' });
      } finally { if (db) db.close(); }
      return res.json({ success:true, roles, schools });
    });
    return app;
  };
  Object.setPrototypeOf(wrapped, loaded);
  for (const key of Object.keys(loaded)) wrapped[key] = loaded[key];
  installed = true;
  return wrapped;
};
