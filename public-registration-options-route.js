const Database = require('better-sqlite3');
const path = require('path');

const ROLES = [
  'معلم','معلم أول','معلم مساعد','ولي أمر','طالب',
  'مسؤول شؤون الطلاب','مسؤول التسجيل والقبول','مسؤول الحضور والغياب',
  'مرشد طلابي','محاسب','مسؤول الرسوم الدراسية','أمين صندوق',
  'مسؤول الجودة','مسؤول العمليات','مسؤول الموارد البشرية',
  'مسؤول تقنية المعلومات','مسؤول المرافق','أمين مكتبة'
];

function registerPublicRegistrationOptions(app) {
  if (!app || typeof app.get !== 'function' || app.__publicRegistrationOptionsRoute) return app;
  app.__publicRegistrationOptionsRoute = true;

  app.get('/api/public/registration-options', (req, res) => {
    let schools = [];
    let db;
    try {
      db = new Database(path.join(__dirname, 'school.db'), { readonly: true });
      try {
        schools = db.prepare("SELECT id, name FROM schools WHERE status='active' ORDER BY name").all();
      } catch (_) {
        schools = db.prepare('SELECT id, name FROM schools WHERE active=1 ORDER BY name').all();
      }
    } catch (error) {
      return res.status(500).json({ success: false, error: 'تعذر تحميل بيانات التسجيل' });
    } finally {
      if (db) db.close();
    }
    return res.json({ success: true, roles: ROLES, schools });
  });

  return app;
}

module.exports = { registerPublicRegistrationOptions, ROLES };
