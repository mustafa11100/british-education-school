const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database("school.db");

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(express.static(__dirname));

/* =========================================================
   معدّات وإعدادات البريد الإلكتروني (SMTP)
========================================================= */

let mailTransporter = null;

function initMailer() {
  const host = process.env.SMTP_HOST;
  const port = safeNumber(process.env.SMTP_PORT, 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    mailTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
    console.log("✅ Mailer Configured Successfully.");
  } else {
    console.log("⚠️ Mailer Notice: SMTP Environment variables missing. Emails will be logged locally.");
  }
}

async function sendNotificationEmail(toEmail, subject, htmlContent) {
  if (!toEmail) return false;
  if (mailTransporter) {
    try {
      await mailTransporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || 'نظام إدارة المدرسة'}" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: subject,
        html: htmlContent
      });
      return true;
    } catch (err) {
      console.error("📧 Email Send Error:", err.message);
      return false;
    }
  } else {
    console.log(`[SIMULATED EMAIL] To: ${toEmail} | Subject: ${subject}`);
    return true;
  }
}

/* =========================================================
   أدوات عامة
========================================================= */

function nowISO() { return new Date().toISOString(); }
function today() { return new Date().toISOString().slice(0, 10); }
function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function logAction(userId, action, details = "", schoolId = null) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, school_id, action, details, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId || null, schoolId || null, action, details, nowISO());
  } catch (error) { me Error: error.message; }
}

function addNotification(schoolId, userId, title, message, type = "info") {
  try {
    db.prepare(`
      INSERT INTO notifications (school_id, user_id, title, message, type, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(schoolId, userId, title, message, type, nowISO());
  } catch (err) {
    console.error("NOTIF ERROR:", err.message);
  }
}

/* =========================================================
   إنشاء وترقية قاعدة البيانات
========================================================= */

db.exec(`
  CREATE TABLE IF NOT EXISTS schools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    email TEXT,
    phone TEXT,
    address TEXT,
    status TEXT DEFAULT 'active',
    subscription_status TEXT DEFAULT 'active',
    subscription_start TEXT,
    subscription_end TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    job_title TEXT,
    department TEXT,
    phone TEXT,
    photo TEXT,
    active INTEGER DEFAULT 0,
    last_seen TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER,
    student_number TEXT,
    name TEXT NOT NULL,
    class_name TEXT,
    birth_date TEXT,
    parent_phone TEXT,
    parent_email TEXT,
    parent_user_id INTEGER,
    photo TEXT,
    status TEXT DEFAULT 'حاضر',
    total_tuition REAL DEFAULT 0,
    payment_type TEXT DEFAULT 'full',
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS student_installments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER,
    student_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    amount REAL NOT NULL,
    due_date TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    paid_amount REAL DEFAULT 0,
    paid_date TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER,
    user_id INTEGER,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read INTEGER DEFAULT 0,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS platform_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER UNIQUE,
    platform_name TEXT DEFAULT 'إدارة المدرسة',
    school_name TEXT DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    currency TEXT DEFAULT 'USD',
    academic_year TEXT DEFAULT '2026-2027',
    logo TEXT DEFAULT '',
    primary_color TEXT DEFAULT '#173b70',
    secondary_color TEXT DEFAULT '#245ca8',
    notify_before_days INTEGER DEFAULT 7,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    school_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT
  );
`);

/* ترقية أيا جدول قديم */
function addColumn(table, column, definition) {
  try {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some(c => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  } catch (e) {}
}

addColumn("users", "department", "TEXT");
addColumn("users", "photo", "TEXT");
addColumn("students", "parent_email", "TEXT");
addColumn("students", "parent_user_id", "INTEGER");
addColumn("students", "total_tuition", "REAL DEFAULT 0");
addColumn("students", "payment_type", "TEXT DEFAULT 'full'");

/* =========================================================
   التهيئة الأولية (المدرسة والمدير)
========================================================= */

let defaultSchool = db.prepare(`SELECT * FROM schools LIMIT 1`).get();
if (!defaultSchool) {
  const res = db.prepare(`
    INSERT INTO schools (name, code, email, status, subscription_status, subscription_start, created_at)
    VALUES ('British Education School', 'BES-001', 'info@beschool.com', 'active', 'active', ?, ?)
  `).run(today(), nowISO());
  defaultSchool = db.prepare(`SELECT * FROM schools WHERE id = ?`).get(res.lastInsertRowid);
}

const adminCount = db.prepare(`SELECT COUNT(*) as cnt FROM users WHERE role = 'admin' OR role = 'owner'`).get().cnt;
if (adminCount === 0) {
  db.prepare(`
    INSERT INTO users (school_id, username, password, role, name, email, active, created_at)
    VALUES (?, 'admin', '1234', 'admin', 'مدير النظام', 'admin@beschool.com', 1, ?)
  `).run(defaultSchool.id, nowISO());
}

/* =========================================================
   الصلاحيات والمصادقة
========================================================= */

const permissions = {
  owner: ["all"],
  admin: ["all"],
  hr: ["dashboard", "users", "employees", "attendance", "requests", "messages", "notifications", "settings"],
  accountant: ["dashboard", "students", "fees", "payroll", "requests", "messages", "notifications", "settings"],
  teacher: ["dashboard", "students", "attendance", "notes", "videos", "announcements", "messages", "notifications"],
  parent: ["dashboard", "fees", "attendance", "notes", "announcements", "messages", "notifications"],
  student: ["dashboard", "attendance", "notes", "videos", "announcements", "messages", "notifications"]
};

function getUser(req) {
  const id = req.body?.user_id || req.query?.user_id || req.headers["x-user-id"];
  if (!id) return null;
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
}

/* =========================================================
   مسارات الـ API
========================================================= */

// 1. تسجيل الدخول
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare(`SELECT * FROM users WHERE username = ? AND password = ?`).get(username, password);

  if (!user) return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
  if (!user.active) return res.status(403).json({ error: "الحساب معلق وفي انتظار موافقة الإدارة" });

  const school = user.school_id ? db.prepare(`SELECT * FROM schools WHERE id = ?`).get(user.school_id) : defaultSchool;
  const settings = db.prepare(`SELECT * FROM platform_settings WHERE school_id = ?`).get(school.id);

  db.prepare(`UPDATE users SET last_seen = ? WHERE id = ?`).run(nowISO(), user.id);
  logAction(user.id, "LOGIN", `تسجيل دخول: ${user.username}`, school.id);

  res.json({
    success: true,
    user: { id: user.id, username: user.username, name: user.name, role: user.role, email: user.email, school_id: user.school_id },
    school,
    settings,
    permissions: user.role === "admin" || user.role === "owner" ? ["all"] : (permissions[user.role] || [])
  });
});

// 2. التسجيل الجديد الموسّع
app.post("/api/register", (req, res) => {
  const { name, username, password, email, phone, role, department, photo } = req.body || {};

  if (!name || !username || !password) {
    return res.status(400).json({ error: "الرجاء تعبئة جميع الحقول المطلوبة" });
  }

  const exists = db.prepare(`SELECT id FROM users WHERE username = ?`).get(username);
  if (exists) return res.status(400).json({ error: "اسم المستخدم مستخدم بالفعل" });

  try {
    const resInsert = db.prepare(`
      INSERT INTO users (school_id, username, password, role, name, email, phone, department, photo, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(defaultSchool.id, username, password, role || "student", name, email || "", phone || "", department || "", photo || "", nowISO());

    // إشعار للإدارة بالحساب الجديد
    addNotification(defaultSchool.id, null, "تسجيل جديد", `المستخدم ${name} قام بالتسجيل وهو بانتظار التفعيل.`, "warning");

    res.json({ success: true, message: "تم إنشاء الحساب بنجاح، الحساب الآن بانتظار موافقة الإدارة." });
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ أثناء إنشاء الحساب" });
  }
});

// 3. جلب بيانات المستخدم الحالي
app.get("/api/me", (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "غير مصرح" });
  const school = db.prepare(`SELECT * FROM schools WHERE id = ?`).get(user.school_id || defaultSchool.id);
  const settings = db.prepare(`SELECT * FROM platform_settings WHERE school_id = ?`).get(school.id);

  res.json({ user, school, settings, permissions: permissions[user.role] || ["all"] });
});

// 4. لوحة التحكم والبيانات الإحصائية
app.get("/api/dashboard", (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "غير مصرح" });

  const sId = user.school_id || defaultSchool.id;

  const totalStudents = db.prepare(`SELECT COUNT(*) as cnt FROM students WHERE school_id = ?`).get(sId).cnt;
  const totalUsers = db.prepare(`SELECT COUNT(*) as cnt FROM users WHERE school_id = ?`).get(sId).cnt;
  const pendingUsers = db.prepare(`SELECT COUNT(*) as cnt FROM users WHERE school_id = ? AND active = 0`).get(sId).cnt;

  const totalTuition = db.prepare(`SELECT SUM(total_tuition) as total FROM students WHERE school_id = ?`).get(sId).total || 0;
  const paidTuition = db.prepare(`SELECT SUM(paid_amount) as total FROM student_installments WHERE school_id = ? AND status = 'paid'`).get(sId).total || 0;
  
  const dueInstallments = db.prepare(`
    SELECT COUNT(*) as cnt FROM student_installments 
    WHERE school_id = ? AND status = 'pending' AND due_date <= ?
  `).get(sId, today()).cnt;

  res.json({
    stats: {
      students: totalStudents,
      users: totalUsers,
      pendingUsers,
      totalTuition,
      paidTuition,
      remainingTuition: totalTuition - paidTuition,
      dueInstallments
    }
  });
});

// 5. إدارة الطلاب والرسوم والأقساط
app.get("/api/students", (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "غير مصرح" });

  const students = db.prepare(`SELECT * FROM students WHERE school_id = ? ORDER BY id DESC`).all(user.school_id || defaultSchool.id);
  
  const updatedStudents = students.map(st => {
    const installments = db.prepare(`SELECT * FROM student_installments WHERE student_id = ?`).all(st.id);
    const totalPaid = installments.reduce((acc, curr) => acc + (curr.status === 'paid' ? curr.amount : 0), 0);
    return {
      ...st,
      installments,
      paid_amount: totalPaid,
      remaining_amount: st.total_tuition - totalPaid
    };
  });

  res.json(updatedStudents);
});

app.post("/api/students", (req, res) => {
  const user = getUser(req);
  if (!user || (user.role !== 'admin' && user.role !== 'accountant')) return res.status(403).json({ error: "ليس لديك صلاحية" });

  const { name, class_name, parent_phone, parent_email, total_tuition, payment_type, installments } = req.body;

  const sId = user.school_id || defaultSchool.id;
  const resSt = db.prepare(`
    INSERT INTO students (school_id, student_number, name, class_name, parent_phone, parent_email, total_tuition, payment_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(sId, `ST-${Date.now().toString().slice(-4)}`, name, class_name, parent_phone, parent_email, total_tuition, payment_type, nowISO());

  const studentId = resSt.lastInsertRowid;

  if (payment_type === 'installments' && Array.isArray(installments)) {
    const insertInst = db.prepare(`
      INSERT INTO student_installments (school_id, student_id, title, amount, due_date, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `);
    installments.forEach(inst => {
      insertInst.run(sId, studentId, inst.title, inst.amount, inst.due_date, nowISO());
    });
  } else {
    // دفعة واحدة
    db.prepare(`
      INSERT INTO student_installments (school_id, student_id, title, amount, due_date, status, created_at)
      VALUES (?, ?, 'الرسوم كاملة', ?, ?, 'pending', ?)
    `).run(sId, studentId, total_tuition, today(), nowISO());
  }

  res.json({ success: true, message: "تم إضافة الطالب بنجاح" });
});

// 6. الإشعارات والتنبيهات
app.get("/api/notifications", (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "غير مصرح" });

  const notifs = db.prepare(`
    SELECT * FROM notifications 
    WHERE school_id = ? AND (user_id = ? OR user_id IS NULL) 
    ORDER BY id DESC LIMIT 50
  `).all(user.school_id || defaultSchool.id, user.id);

  res.json(notifs);
});

// 7. صفحة الإعدادات الفعالة
app.get("/api/settings", (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "غير مصرح" });

  let settings = db.prepare(`SELECT * FROM platform_settings WHERE school_id = ?`).get(user.school_id || defaultSchool.id);
  if (!settings) {
    db.prepare(`INSERT INTO platform_settings (school_id, platform_name, school_name, created_at) VALUES (?, 'إدارة المدرسة', 'British Education School', ?)`).run(defaultSchool.id, nowISO());
    settings = db.prepare(`SELECT * FROM platform_settings WHERE school_id = ?`).get(defaultSchool.id);
  }
  res.json(settings);
});

app.post("/api/settings", (req, res) => {
  const user = getUser(req);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: "صلاحيات غير كافية" });

  const { platform_name, school_name, email, phone, currency, academic_year, notify_before_days } = req.body;
  const sId = user.school_id || defaultSchool.id;

  db.prepare(`
    UPDATE platform_settings
    SET platform_name = ?, school_name = ?, email = ?, phone = ?, currency = ?, academic_year = ?, notify_before_days = ?, updated_at = ?
    WHERE school_id = ?
  `).run(platform_name, school_name, email, phone, currency, academic_year, notify_before_days, nowISO(), sId);

  res.json({ success: true, message: "تم حفظ الإعدادات بنجاح" });
});

/* =========================================================
   تشغيل السيرفر
========================================================= */

initMailer();
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
