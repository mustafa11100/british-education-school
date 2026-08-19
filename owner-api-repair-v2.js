const Module = require('module');
const Database = require('better-sqlite3');
const path = require('path');

// Owner API repair: inject the canonical owner routes immediately AFTER the
// application's /api/owner auth middleware and BEFORE server.js registers the
// old owner routes / final 404 handler.
const originalLoad = Module._load;
const db = new Database(path.join(__dirname, 'school.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function tableExists(name) {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
}
function ensureSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      logo TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      check_in TEXT,
      check_out TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      term TEXT,
      score REAL,
      max_score REAL DEFAULT 100,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
function owner(req) {
  return ['مبرمج', 'مبرمج النظام', 'مالك المنصة', 'owner'].includes(req.user?.role);
}
function fail(res, e) {
  console.error('OWNER_API_REPAIR_V3:', e?.stack || e);
  return res.status(500).json({
    success: false,
    message: 'حدث خطأ داخلي في الخادم',
    error: String(e?.message || e || 'Unknown error')
  });
}
function count(table) {
  return tableExists(table) ? db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c : 0;
}

try { ensureSchema(); } catch (e) { console.error('OWNER_API_SCHEMA:', e?.stack || e); }

Module._load = function(request, ...args) {
  const express = originalLoad.call(this, request, ...args);
  if (request !== 'express') return express;

  const wrapped = function(...expressArgs) {
    const app = express(...expressArgs);
    if (app.__ownerRepairV3) return app;
    app.__ownerRepairV3 = true;

    const originalUse = app.use.bind(app);
    const originalGet = app.get.bind(app);
    const originalPost = app.post.bind(app);

    let installed = false;
    function installOwnerRoutes() {
      if (installed) return;
      installed = true;

      // IMPORTANT: this is registered after /api/owner auth middleware.
      originalGet('/api/owner/full-overview', (req, res) => {
        if (!owner(req)) return res.status(403).json({ success:false, message:'هذه المنطقة مخصصة لمالك المنصة' });
        try {
          const teachers = tableExists('users') ? db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='معلم'").get().c : 0;
          const pendingRequests = tableExists('admin_requests')
            ? db.prepare("SELECT COUNT(*) AS c FROM admin_requests WHERE status IN ('new','review','pending')").get().c : 0;
          return res.json({ success:true, counts:{
            schools:count('schools'), users:count('users'), students:count('students'), teachers,
            parents:count('parents'), employees:count('employees'), classes:count('classes'), subjects:count('subjects'),
            attendance:count('attendance'), results:count('results'), announcements:count('announcements'),
            subscriptions:count('subscriptions'), pendingRequests
          }, recent:{
            schools:tableExists('schools') ? db.prepare('SELECT * FROM schools ORDER BY id DESC LIMIT 5').all() : [],
            activity:tableExists('audit_logs') ? db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 10').all() : []
          }});
        } catch (e) { return fail(res, e); }
      });

      originalGet('/api/owner/schools', (req, res) => {
        if (!owner(req)) return res.status(403).json({ success:false, message:'هذه المنطقة مخصصة لمالك المنصة' });
        try { return res.json({ success:true, schools:db.prepare('SELECT * FROM schools ORDER BY id DESC').all() }); }
        catch (e) { return fail(res, e); }
      });

      originalPost('/api/owner/schools', (req, res) => {
        if (!owner(req)) return res.status(403).json({ success:false, message:'هذه المنطقة مخصصة لمالك المنصة' });
        try {
          const b = req.body || {};
          const name = String(b.name || '').trim();
          if (!name) return res.status(400).json({ success:false, message:'اسم المدرسة مطلوب' });
          const r = db.prepare('INSERT INTO schools(name,description,logo,active) VALUES(?,?,?,1)')
            .run(name, String(b.description || ''), String(b.logo || ''));
          if (tableExists('audit_logs') && req.user?.id) {
            try { db.prepare('INSERT INTO audit_logs(user_id,action,details) VALUES(?,?,?)').run(req.user.id,'create_school',`school_id=${r.lastInsertRowid}`); } catch (_) {}
          }
          return res.status(201).json({ success:true, id:Number(r.lastInsertRowid), school:db.prepare('SELECT * FROM schools WHERE id=?').get(r.lastInsertRowid) });
        } catch (e) { return fail(res, e); }
      });
    }

    // Intercept the exact owner auth mount used by server.js. The repair routes
    // are then inserted immediately after that middleware and before the old routes.
    app.use = function(pathOrMiddleware, ...handlers) {
      const result = originalUse(pathOrMiddleware, ...handlers);
      if (pathOrMiddleware === '/api/owner') installOwnerRoutes();
      return result;
    };

    // server.js may use app.use('/api/owner', auth) exactly once; if another
    // preload has already mounted it, install on the first matching mount.
    return app;
  };

  Object.setPrototypeOf(wrapped, express);
  wrapped.prototype = express.prototype;
  for (const key of Object.keys(express)) wrapped[key] = express[key];
  return wrapped;
};
