const Module = require('module');
const Database = require('better-sqlite3');
const path = require('path');

const originalLoad = Module._load;
const db = new Database(path.join(__dirname, 'school.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
}
function migrateSchools() {
  db.exec(`CREATE TABLE IF NOT EXISTS schools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    logo TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );`);
  for (const [column, sql] of [
    ['description', 'ALTER TABLE schools ADD COLUMN description TEXT'],
    ['logo', 'ALTER TABLE schools ADD COLUMN logo TEXT'],
    ['active', 'ALTER TABLE schools ADD COLUMN active INTEGER DEFAULT 1'],
    ['created_at', 'ALTER TABLE schools ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP']
  ]) {
    if (!hasColumn('schools', column)) db.exec(sql);
  }
  db.exec(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, date TEXT NOT NULL,
    status TEXT NOT NULL, check_in TEXT, check_out TEXT, notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, subject TEXT NOT NULL,
    term TEXT, score REAL, max_score REAL DEFAULT 100, notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );`);
}
try { migrateSchools(); } catch (e) { console.error('OWNER_RUNTIME_MIGRATION:', e.stack || e); }

function isOwner(req) {
  return ['مبرمج', 'مبرمج النظام', 'مالك المنصة', 'owner'].includes(req.user?.role);
}
function install(app) {
  if (app.__ownerRuntimeFixInstalled) return;
  app.__ownerRuntimeFixInstalled = true;
  const originalUse = app.use.bind(app);
  const originalGet = app.get.bind(app);
  const originalPost = app.post.bind(app);
  let installed = false;
  const installRoutes = () => {
    if (installed) return;
    installed = true;
    originalGet('/api/owner/full-overview', (req, res) => {
      if (!isOwner(req)) return res.status(403).json({success:false, message:'هذه المنطقة مخصصة لمالك المنصة'});
      try {
        const count = t => db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
        const pending = db.prepare("SELECT COUNT(*) AS c FROM admin_requests WHERE status IN ('new','review','pending')").get().c;
        res.json({success:true, counts:{
          schools:count('schools'), users:count('users'), students:count('students'),
          teachers:db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='معلم'").get().c,
          parents:count('parents'), employees:count('employees'), classes:count('classes'), subjects:count('subjects'),
          attendance:count('attendance'), results:count('results'), announcements:count('announcements'),
          subscriptions:count('subscriptions'), pendingRequests:pending
        }, recent:{
          schools:db.prepare('SELECT * FROM schools ORDER BY id DESC LIMIT 5').all(),
          activity:db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 10').all()
        }});
      } catch (e) {
        console.error('OWNER_FULL_OVERVIEW:', e.stack || e);
        res.status(500).json({success:false, message:'حدث خطأ داخلي في الخادم', error:String(e.message || e)});
      }
    });
    originalGet('/api/owner/schools', (req, res) => {
      if (!isOwner(req)) return res.status(403).json({success:false, message:'هذه المنطقة مخصصة لمالك المنصة'});
      try { res.json({success:true, schools:db.prepare('SELECT * FROM schools ORDER BY id DESC').all()}); }
      catch (e) { console.error('OWNER_SCHOOLS_GET:', e.stack || e); res.status(500).json({success:false,message:'حدث خطأ داخلي في الخادم',error:String(e.message || e)}); }
    });
    originalPost('/api/owner/schools', (req, res) => {
      if (!isOwner(req)) return res.status(403).json({success:false, message:'هذه المنطقة مخصصة لمالك المنصة'});
      try {
        const b = req.body || {};
        const name = String(b.name || '').trim();
        if (!name) return res.status(400).json({success:false,message:'اسم المدرسة مطلوب'});
        const result = db.prepare('INSERT INTO schools(name,description,logo,active) VALUES(?,?,?,1)').run(
          name, String(b.description || ''), String(b.logo || '')
        );
        if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='audit_logs'").get() && req.user?.id) {
          try { db.prepare('INSERT INTO audit_logs(user_id,action,details) VALUES(?,?,?)').run(req.user.id,'create_school',`school_id=${result.lastInsertRowid}`); } catch (_) {}
        }
        res.status(201).json({success:true,id:Number(result.lastInsertRowid),school:db.prepare('SELECT * FROM schools WHERE id=?').get(result.lastInsertRowid)});
      } catch (e) {
        console.error('OWNER_SCHOOLS_POST:', e.stack || e);
        res.status(500).json({success:false,message:'تعذر إضافة المدرسة',error:String(e.message || e)});
      }
    });
  };
  app.use = function(pathOrMiddleware, ...handlers) {
    const result = originalUse(pathOrMiddleware, ...handlers);
    if (pathOrMiddleware === '/api/owner') installRoutes();
    return result;
  };
}

Module._load = function(request, ...args) {
  const loaded = originalLoad.call(this, request, ...args);
  if (request !== 'express') return loaded;
  const wrapped = function(...args2) {
    const app = loaded(...args2);
    install(app);
    return app;
  };
  Object.setPrototypeOf(wrapped, loaded);
  wrapped.prototype = loaded.prototype;
  for (const key of Object.keys(loaded)) wrapped[key] = loaded[key];
  return wrapped;
};
