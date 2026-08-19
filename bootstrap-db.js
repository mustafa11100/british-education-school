const path = require('path');
const Database = require('better-sqlite3');

// Runs before proxy2/server modules so legacy databases always have the
// core tables required by the SaaS middleware.
const db = new Database(path.join(__dirname, 'school.db'));
db.pragma('journal_mode = WAL');

function addColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(x => x.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

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

// Existing installations may have been created before multi-school support.
addColumn('users', 'school_id', 'INTEGER');
addColumn('students', 'school_id', 'INTEGER');
addColumn('parents', 'school_id', 'INTEGER');

db.close();
console.log('✅ Core database bootstrap completed');
