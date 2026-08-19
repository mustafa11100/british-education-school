const Module = require('module');
const Database = require('better-sqlite3');
const path = require('path');

// This preload runs before server.js. It wraps Express so owner routes are
// registered synchronously (not with setImmediate), before the application's
// final 404 handler can ever catch them.
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
function isOwner(req) {
  return ['مبرمج', 'مبرمج النظام', 'مالك المنصة', 'owner'].includes(req.user?.role);
}
function error(res, err) {
  console.error('OWNER_API_REPAIR_V2:', err && err.stack ? err.stack : err);
  return res.status(500).json({
    success: false,
    message: 'تعذر تنفيذ العملية داخل الخادم',
    error: String(err?.message || err || 'Unknown server error')
  });
}
function count(table) {
  return tableExists(table) ? db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c : 0;
}

try { ensureSchema(); } catch (e) { console.error('OWNER_API_SCHEMA:', e); }

Module._load = function(request, ...args) {
  const express = originalLoad.call(this, request, ...args);
  if (request !== 'express') return express;

  const wrappedExpress = function(...expressArgs) {
    const app = express(...expressArgs);
    if (app.__ownerRepairV3) return app;
    app.__ownerRepairV3 = true;

    const originalGet = app.get.bind(app);
    const originalPost = app.post.bind(app);

    // Register immediately, while server.js is still building its route stack.
    originalGet('/api/owner/full-overview', (req, res) => {
      if (!isOwner(req)) return res.status(403).json({ success:false, message:'هذه المنطقة مخصصة لمالك المنصة' });
      try {
        const teachers = tableExists('users') ? db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='معلم'").get().c : 0;
        const pending = tableExists('admin_requests')
          ? db.prepare("SELECT COUNT(*) AS c FROM admin_requests WHERE status IN ('new','review','pending')").get().c
          : 0;
        return res.json({
          success: true,
          counts: {
            schools: count('schools'), users: count('users'), students: count('students'),
            teachers, parents: count('parents'), employees: count('employees'), classes: count('classes'),
            subjects: count('subjects'), attendance: count('attendance'), results: count('results'),
            announcements: count('announcements'), subscriptions: count('subscriptions'), pendingRequests: pending
          },
          recent: {
            schools: tableExists('schools') ? db.prepare('SELECT * FROM schools ORDER BY id DESC LIMIT 5').all() : [],
            activity: tableExists('audit_logs') ? db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 10').all() : []
          }
        });
      } catch (e) { return error(res, e); }
    });

    originalGet('/api/owner/schools', (req, res) => {
      if (!isOwner(req)) return res.status(403).json({ success:false, message:'هذه المنطقة مخصصة لمالك المنصة' });
      try {
        return res.json({ success:true, schools: db.prepare('SELECT * FROM schools ORDER BY id DESC').all() });
      } catch (e) { return error(res, e); }
    });

    originalPost('/api/owner/schools', (req, res) => {
      if (!isOwner(req)) return res.status(403).json({ success:false, message:'هذه المنطقة مخصصة لمالك المنصة' });
      try {
        const body = req.body || {};
        const name = String(body.name || '').trim();
        if (!name) return res.status(400).json({ success:false, message:'اسم المدرسة مطلوب' });
        const result = db.prepare('INSERT INTO schools (name, description, logo, active) VALUES (?, ?, ?, 1)')
          .run(name, String(body.description || ''), String(body.logo || ''));
        if (tableExists('audit_logs') && req.user?.id) {
          try { db.prepare('INSERT INTO audit_logs(user_id, action, details) VALUES(?,?,?)').run(req.user.id, 'create_school', `school_id=${result.lastInsertRowid}`); } catch (_) {}
        }
        return res.status(201).json({
          success:true,
          id:Number(result.lastInsertRowid),
          school:db.prepare('SELECT * FROM schools WHERE id=?').get(result.lastInsertRowid)
        });
      } catch (e) { return error(res, e); }
    });

    return app;
  };
  Object.setPrototypeOf(wrappedExpress, express);
  wrappedExpress.prototype = express.prototype;
  for (const key of Object.keys(express)) wrappedExpress[key] = express[key];
  return wrappedExpress;
};
