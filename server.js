const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();

// ===============================
// إعداد قاعدة البيانات
// ===============================

const db = new Database("school.db");

// ===============================
// إعداد Express
// ===============================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname));

// ===============================
// إنشاء الجداول
// ===============================

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    last_seen TEXT
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    class_name TEXT,
    parent_phone TEXT,
    status TEXT DEFAULT 'حاضر'
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    file_name TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS student_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT,
    UNIQUE(student_id, date)
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    employee_number TEXT UNIQUE,
    name TEXT NOT NULL,
    job_title TEXT,
    department TEXT,
    phone TEXT,
    hire_date TEXT,
    basic_salary REAL DEFAULT 0,
    allowance REAL DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS employee_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    check_in TEXT,
    check_out TEXT,
    status TEXT NOT NULL,
    late_minutes INTEGER DEFAULT 0,
    created_at TEXT,
    UNIQUE(employee_id, date)
  );

  CREATE TABLE IF NOT EXISTS deductions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    reason TEXT NOT NULL,
    date TEXT NOT NULL,
    month TEXT NOT NULL,
    automatic INTEGER DEFAULT 0,
    created_by INTEGER,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS bonuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    reason TEXT NOT NULL,
    date TEXT NOT NULL,
    month TEXT NOT NULL,
    created_by INTEGER,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS payroll_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    absence_deduction REAL DEFAULT 300,
    late_deduction REAL DEFAULT 50,
    allowed_late_minutes INTEGER DEFAULT 15
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT
  );
`);

// ===============================
// إعدادات الرواتب الافتراضية
// ===============================

const payrollSettings = db
  .prepare("SELECT * FROM payroll_settings WHERE id = 1")
  .get();

if (!payrollSettings) {
  db.prepare(`
    INSERT INTO payroll_settings (
      id,
      absence_deduction,
      late_deduction,
      allowed_late_minutes
    )
    VALUES (?, ?, ?, ?)
  `).run(
    1,
    300,
    50,
    15
  );
}

// ===============================
// وظائف مساعدة
// ===============================

function nowISO() {
  return new Date().toISOString();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function logAction(userId, action, details = "") {
  db.prepare(`
    INSERT INTO audit_logs (
      user_id,
      action,
      details,
      created_at
    )
    VALUES (?, ?, ?, ?)
  `).run(
    userId || null,
    action,
    details,
    nowISO()
  );
}

// ===============================
// اختبار السيرفر
// ===============================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "School portal is running"
  });
});

// ===============================
// تشغيل السيرفر
// ===============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`School portal running on port ${PORT}`);
});
