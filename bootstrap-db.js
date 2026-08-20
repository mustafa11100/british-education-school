const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

// Runs before the application so legacy production databases are migrated
// before any API route attempts to read or write them.
const db = new Database(path.join(__dirname, 'school.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function columns(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all();
}

function hasColumn(table, column) {
  return columns(table).some(item => item.name === column);
}

function addColumn(table, column, definition) {
  if (!hasColumn(table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

// Core tables. Keep these compatible with both the current EduCore API and
// legacy databases that were created by earlier releases.
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL,
  school_id INTEGER,
  active INTEGER DEFAULT 1,
  must_change_password INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  logo TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  code TEXT,
  status TEXT DEFAULT 'pending',
  active INTEGER DEFAULT 1,
  owner_approved INTEGER DEFAULT 0,
  primary_color TEXT DEFAULT '#173b70',
  secondary_color TEXT DEFAULT '#24579b',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  plan TEXT DEFAULT 'basic',
  subscription_status TEXT DEFAULT 'trial',
  subscription_start TEXT,
  subscription_end TEXT,
  max_students INTEGER DEFAULT 500,
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS school_access_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL,
  manager_user_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  owner_note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS registration_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_type TEXT NOT NULL DEFAULT 'user',
  user_id INTEGER,
  school_id INTEGER,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  owner_note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  student_number TEXT UNIQUE,
  full_name TEXT NOT NULL,
  grade TEXT,
  class_name TEXT,
  date_of_birth TEXT,
  gender TEXT,
  address TEXT,
  notes TEXT,
  school_id INTEGER,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS parents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  school_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// Migrate every known school field before server.js starts registering routes.
// This prevents the classic production failure where an older schools table
// exists but is missing columns required by a newer INSERT statement.
const schoolColumns = [
  ['slug', 'TEXT'],
  ['description', 'TEXT'],
  ['logo', "TEXT DEFAULT ''"],
  ['logo_url', "TEXT DEFAULT ''"],
  ['code', 'TEXT'],
  ['status', "TEXT DEFAULT 'pending'"],
  ['active', 'INTEGER DEFAULT 1'],
  ['owner_approved', 'INTEGER DEFAULT 0'],
  ['primary_color', "TEXT DEFAULT '#173b70'"],
  ['secondary_color', "TEXT DEFAULT '#24579b'"],
  ['phone', "TEXT DEFAULT ''"],
  ['email', "TEXT DEFAULT ''"],
  ['address', "TEXT DEFAULT ''"],
  ['plan', "TEXT DEFAULT 'basic'"],
  ['subscription_status', "TEXT DEFAULT 'trial'"],
  ['subscription_start', 'TEXT'],
  ['subscription_end', 'TEXT'],
  ['max_students', 'INTEGER DEFAULT 500'],
  ['notes', "TEXT DEFAULT ''"],
  ['created_at', 'TEXT DEFAULT CURRENT_TIMESTAMP'],
  ['updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP']
];
for (const [column, definition] of schoolColumns) addColumn('schools', column, definition);

// Legacy rows need safe values before unique-ish identifiers are generated.
if (hasColumn('schools', 'slug')) {
  const rows = db.prepare("SELECT id, name FROM schools WHERE slug IS NULL OR TRIM(slug) = '' ORDER BY id").all();
  const used = new Set(db.prepare("SELECT slug FROM schools WHERE slug IS NOT NULL AND TRIM(slug) <> ''").all().map(x => String(x.slug)));
  const update = db.prepare('UPDATE schools SET slug=? WHERE id=?');
  for (const row of rows) {
    const base = String(row.name || 'school').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || `school-${row.id}`;
    let slug = base;
    let n = 1;
    while (used.has(slug)) slug = `${base}-${n++}`;
    update.run(slug, row.id);
    used.add(slug);
  }
}

if (hasColumn('schools', 'code')) {
  const rows = db.prepare("SELECT id, name FROM schools WHERE code IS NULL OR TRIM(code) = '' ORDER BY id").all();
  const used = new Set(db.prepare("SELECT code FROM schools WHERE code IS NOT NULL AND TRIM(code) <> ''").all().map(x => String(x.code)));
  const update = db.prepare('UPDATE schools SET code=? WHERE id=?');
  for (const row of rows) {
    const base = (String(row.name || 'SCHOOL').replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 8).toUpperCase() || 'SCHOOL');
    let code = `${base}-${String(row.id).padStart(3, '0')}`;
    let n = 1;
    while (used.has(code)) code = `${base}-${String(row.id).padStart(3, '0')}-${n++}`;
    update.run(code, row.id);
    used.add(code);
  }
}

addColumn('users', 'school_id', 'INTEGER');
addColumn('students', 'school_id', 'INTEGER');
addColumn('parents', 'school_id', 'INTEGER');

// Ensure the production owner account exists. Password is supplied only
// through Railway environment variables and is never committed to GitHub.
const ownerUsername = String(process.env.OWNER_USERNAME || '').trim();
const ownerPassword = String(process.env.OWNER_PASSWORD || '');
if (ownerUsername && ownerPassword) {
  const existing = db.prepare('SELECT id FROM users WHERE username=?').get(ownerUsername);
  if (existing) {
    db.prepare(`UPDATE users SET password_hash=?, full_name=?, role=?, active=1, must_change_password=0, school_id=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(hashPassword(ownerPassword), 'مالك المنصة', 'مبرمج', existing.id);
  } else {
    db.prepare(`INSERT INTO users(username,password_hash,full_name,email,phone,role,school_id,active,must_change_password) VALUES(?,?,?,?,?,?,NULL,1,0)`)
      .run(ownerUsername, hashPassword(ownerPassword), 'مالك المنصة', '', '', 'مبرمج');
  }
  console.log(`Production owner account ready: ${ownerUsername}`);
} else {
  console.warn('OWNER_USERNAME/OWNER_PASSWORD are not set; owner bootstrap skipped.');
}

db.close();
console.log('Core multi-school database bootstrap completed');
