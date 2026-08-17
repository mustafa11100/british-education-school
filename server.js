const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const db = new Database("school.db");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

/* =====================================================
   HELPERS
===================================================== */

function nowISO() {
  return new Date().toISOString();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function logAction(userId, action, details = "") {
  db.prepare(`
    INSERT INTO audit_logs
    (user_id, action, details, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    userId || null,
    action,
    details,
    nowISO()
  );
}

/* =====================================================
   DATABASE
===================================================== */

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  name TEXT NOT NULL,
  job_title TEXT DEFAULT '',
  department TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  last_seen TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT NOT NULL,
  class_name TEXT DEFAULT '',
  parent_phone TEXT DEFAULT '',
  parent_user_id INTEGER,
  status TEXT DEFAULT 'حاضر',
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT,
  parent_seen INTEGER DEFAULT 0,
  parent_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  file_name TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_by INTEGER,
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
  job_title TEXT DEFAULT '',
  department TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  hire_date TEXT DEFAULT '',
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
  id INTEGER PRIMARY KEY CHECK(id = 1),
  absence_deduction REAL DEFAULT 300,
  late_deduction REAL DEFAULT 50,
  allowed_late_minutes INTEGER DEFAULT 15
);

CREATE TABLE IF NOT EXISTS employee_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  employee_id INTEGER,
  request_type TEXT NOT NULL,
  amount REAL DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  reason TEXT DEFAULT '',
  status TEXT DEFAULT 'قيد المراجعة',
  admin_note TEXT DEFAULT '',
  created_at TEXT,
  reviewed_at TEXT,
  reviewed_by INTEGER
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_type TEXT DEFAULT 'all',
  target_role TEXT DEFAULT '',
  created_by INTEGER,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS employee_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER,
  user_id INTEGER,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  read_at TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS platform_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  institution_name TEXT DEFAULT 'نظام إدارة المدرسة',
  subtitle TEXT DEFAULT 'School Management System',
  logo TEXT DEFAULT '🎓',
  primary_color TEXT DEFAULT '#173b70',
  secondary_color TEXT DEFAULT '#f4f7fb',
  accent_color TEXT DEFAULT '#2563eb',
  welcome_message TEXT DEFAULT 'مرحباً بك في نظام إدارة المدرسة'
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  details TEXT DEFAULT '',
  created_at TEXT
);
`);

/* =====================================================
   MIGRATION FOR OLD DATABASES
===================================================== */

const userColumns = db.prepare(`PRAGMA table_info(users)`).all();
const userColumnNames = userColumns.map(x => x.name);

if (!userColumnNames.includes("job_title")) {
  db.exec(`ALTER TABLE users ADD COLUMN job_title TEXT DEFAULT ''`);
}

if (!userColumnNames.includes("department")) {
  db.exec(`ALTER TABLE users ADD COLUMN department TEXT DEFAULT ''`);
}

if (!userColumnNames.includes("phone")) {
  db.exec(`ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''`);
}

if (!userColumnNames.includes("avatar")) {
  db.exec(`ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''`);
}

if (!userColumnNames.includes("created_at")) {
  db.exec(`ALTER TABLE users ADD COLUMN created_at TEXT`);
}

const noteColumns = db.prepare(`PRAGMA table_info(notes)`).all();
const noteColumnNames = noteColumns.map(x => x.name);

if (!noteColumnNames.includes("created_by")) {
  db.exec(`ALTER TABLE notes ADD COLUMN created_by INTEGER`);
}

if (!noteColumnNames.includes("parent_seen")) {
  db.exec(`ALTER TABLE notes ADD COLUMN parent_seen INTEGER DEFAULT 0`);
}

if (!noteColumnNames.includes("parent_seen_at")) {
  db.exec(`ALTER TABLE notes ADD COLUMN parent_seen_at TEXT`);
}

const videoColumns = db.prepare(`PRAGMA table_info(videos)`).all();
const videoColumnNames = videoColumns.map(x => x.name);

if (!videoColumnNames.includes("description")) {
  db.exec(`ALTER TABLE videos ADD COLUMN description TEXT DEFAULT ''`);
}

if (!videoColumnNames.includes("created_by")) {
  db.exec(`ALTER TABLE videos ADD COLUMN created_by INTEGER`);
}

/* =====================================================
   DEFAULT SETTINGS
===================================================== */

if (!db.prepare(`
  SELECT id FROM payroll_settings WHERE id = 1
`).get()) {
  db.prepare(`
    INSERT INTO payroll_settings
    (id, absence_deduction, late_deduction, allowed_late_minutes)
    VALUES (1, 300, 50, 15)
  `).run();
}

if (!db.prepare(`
  SELECT id FROM platform_settings WHERE id = 1
`).get()) {
  db.prepare(`
    INSERT INTO platform_settings
    (
      id,
      institution_name,
      subtitle,
      logo,
      primary_color,
      secondary_color,
      accent_color,
      welcome_message
    )
    VALUES
    (
      1,
      'نظام إدارة المدرسة',
      'School Management System',
      '🎓',
      '#173b70',
      '#f4f7fb',
      '#2563eb',
      'مرحباً بك في نظام إدارة المدرسة'
    )
  `).run();
}

/* =====================================================
   DEFAULT ADMIN ONLY
===================================================== */

const countUsers = db.prepare(`
  SELECT COUNT(*) AS count FROM users
`).get().count;

if (countUsers === 0) {
  db.prepare(`
    INSERT INTO users
    (
      username,
      password,
      role,
      name,
      job_title,
      department,
      active,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    "admin",
    "1234",
    "admin",
    "مدير المؤسسة",
    "مدير المؤسسة",
    "الإدارة",
    nowISO()
  );
}

/* =====================================================
   ROLE DEFINITIONS
===================================================== */

const roles = [
  "admin",
  "teacher",
  "student",
  "parent",
  "hr",
  "accountant",
  "worker",
  "reviewer",
  "employee",
  "manager",
  "supervisor"
];

const roleNames = {
  admin: "مدير المؤسسة",
  teacher: "معلم",
  student: "طالب",
  parent: "ولي أمر",
  hr: "موارد بشرية",
  accountant: "محاسب",
  worker: "عامل",
  reviewer: "مراجع",
  employee: "موظف",
  manager: "مدير",
  supervisor: "مشرف"
};

/* =====================================================
   HEALTH
===================================================== */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "School portal is running",
    time: nowISO()
  });
});

/* =====================================================
   PLATFORM SETTINGS
===================================================== */

app.get("/api/settings", (req, res) => {
  try {
    const settings = db.prepare(`
      SELECT * FROM platform_settings
      WHERE id = 1
    `).get();

    res.json(settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "تعذر جلب إعدادات المنصة"
    });
  }
});

app.patch("/api/settings", (req, res) => {
  try {
    const {
      institution_name,
      subtitle,
      logo,
      primary_color,
      secondary_color,
      accent_color,
      welcome_message
    } = req.body || {};

    db.prepare(`
      UPDATE platform_settings
      SET
        institution_name = COALESCE(?, institution_name),
        subtitle = COALESCE(?, subtitle),
        logo = COALESCE(?, logo),
        primary_color = COALESCE(?, primary_color),
        secondary_color = COALESCE(?, secondary_color),
        accent_color = COALESCE(?, accent_color),
        welcome_message = COALESCE(?, welcome_message)
      WHERE id = 1
    `).run(
      institution_name,
      subtitle,
      logo,
      primary_color,
      secondary_color,
      accent_color,
      welcome_message
    );

    logAction(
      null,
      "UPDATE_PLATFORM_SETTINGS",
      "تعديل إعدادات وشكل المنصة"
    );

    res.json({
      success: true,
      message: "تم حفظ إعدادات المنصة"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "تعذر حفظ إعدادات المنصة"
    });
  }
});

/* =====================================================
   LOGIN
===================================================== */

app.post("/api/login", (req, res) => {
  try {
    const {
      username,
      password
    } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        error: "أدخل اسم المستخدم وكلمة المرور"
      });
    }

    const user = db.prepare(`
      SELECT *
      FROM users
      WHERE username = ?
      AND password = ?
    `).get(username, password);

    if (!user) {
      return res.status(401).json({
        error: "بيانات الدخول غير صحيحة"
      });
    }

    if (!user.active) {
      return res.status(403).json({
        error: "هذا الحساب موقوف من الإدارة"
      });
    }

    const now = nowISO();

    db.prepare(`
      UPDATE users
      SET last_seen = ?
      WHERE id = ?
    `).run(now, user.id);

    logAction(
      user.id,
      "LOGIN",
      `دخول ${user.name}`
    );

    delete user.password;

    res.json({
      ...user,
      role_name: roleNames[user.role] || user.role
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "حدث خطأ أثناء تسجيل الدخول"
    });
  }
});

/* =====================================================
   ACTIVITY
===================================================== */

app.post("/api/activity", (req, res) => {
  try {
    const { user_id } = req.body || {};

    if (!user_id) {
      return res.status(400).json({
        error: "user_id مطلوب"
      });
    }

    const user = db.prepare(`
      SELECT id, active
      FROM users
      WHERE id = ?
    `).get(user_id);

    if (!user) {
      return res.status(404).json({
        error: "المستخدم غير موجود"
      });
    }

    if (!user.active) {
      return res.status(403).json({
        error: "الحساب موقوف"
      });
    }

    const time = nowISO();

    db.prepare(`
      UPDATE users
      SET last_seen = ?
      WHERE id = ?
    `).run(time, user_id);

    res.json({
      success: true,
      last_seen: time
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر تحديث النشاط"
    });
  }
});

/* =====================================================
   CURRENT USER
===================================================== */

app.get("/api/users/:id", (req, res) => {
  try {
    const user = db.prepare(`
      SELECT
        id,
        username,
        role,
        name,
        job_title,
        department,
        phone,
        avatar,
        active,
        last_seen,
        created_at
      FROM users
      WHERE id = ?
    `).get(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: "المستخدم غير موجود"
      });
    }

    user.role_name = roleNames[user.role] || user.role;

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "تعذر جلب بيانات المستخدم"
    });
  }
});

/* =====================================================
   UPDATE USER PROFILE
===================================================== */

app.patch("/api/users/:id/profile", (req, res) => {
  try {
    const {
      name,
      job_title,
      department,
      phone,
      avatar
    } = req.body || {};

    const user = db.prepare(`
      SELECT id FROM users WHERE id = ?
    `).get(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: "المستخدم غير موجود"
      });
    }

    db.prepare(`
      UPDATE users
      SET
        name = COALESCE(?, name),
        job_title = COALESCE(?, job_title),
        department = COALESCE(?, department),
        phone = COALESCE(?, phone),
        avatar = COALESCE(?, avatar)
      WHERE id = ?
    `).run(
      name,
      job_title,
      department,
      phone,
      avatar,
      user.id
    );

    logAction(
      user.id,
      "UPDATE_PROFILE",
      `تعديل الملف الشخصي`
    );

    res.json({
      success: true,
      message: "تم تحديث الملف الشخصي"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "تعذر تحديث الملف الشخصي"
    });
  }
});

/* =====================================================
   USERS
===================================================== */

app.get("/api/users", (req, res) => {
  try {
    const users = db.prepare(`
      SELECT
        id,
        username,
        role,
        name,
        job_title,
        department,
        phone,
        avatar,
        active,
        last_seen,
        created_at
      FROM users
      ORDER BY id DESC
    `).all();

    const now = Date.now();

    const result = users.map(user => {
      const online =
        user.active === 1 &&
        user.last_seen &&
        now - new Date(user.last_seen).getTime() <= 60000;

      return {
        ...user,
        role_name: roleNames[user.role] || user.role,
        online: Boolean(online)
      };
    });

    res.json({
      users: result,
      total: result.length,
      online_count: result.filter(x => x.online).length,
      active_count: result.filter(x => x.active === 1).length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "تعذر جلب المستخدمين"
    });
  }
});

/* =====================================================
   ADD USER
===================================================== */

app.post("/api/users", (req, res) => {
  try {
    const {
      username,
      password,
      role,
      name,
      job_title,
      department,
      phone
    } = req.body || {};

    if (!username || !password || !name) {
      return res.status(400).json({
        error: "اسم المستخدم وكلمة المرور والاسم مطلوبة"
      });
    }

    const selectedRole = role || "employee";

    if (!roles.includes(selectedRole)) {
      return res.status(400).json({
        error: "نوع المستخدم غير صحيح"
      });
    }

    const result = db.prepare(`
      INSERT INTO users
      (
        username,
        password,
        role,
        name,
        job_title,
        department,
        phone,
        active,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      username,
      password,
      selectedRole,
      name,
      job_title || roleNames[selectedRole] || "",
      department || "",
      phone || "",
      nowISO()
    );

    logAction(
      null,
      "ADD_USER",
      `إضافة ${name} - ${roleNames[selectedRole]}`
    );

    res.json({
      success: true,
      id: result.lastInsertRowid,
      message: "تم إنشاء الحساب"
    });
  } catch (error) {
    console.error(error);

    if (String(error.message).includes("UNIQUE")) {
      return res.status(400).json({
        error: "اسم المستخدم موجود بالفعل"
      });
    }

    res.status(500).json({
      error: "تعذر إنشاء الحساب"
    });
  }
});

/* =====================================================
   ENABLE / DISABLE USER
===================================================== */

app.patch("/api/users/:id/disable", (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, username, role
      FROM users
      WHERE id = ?
    `).get(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: "المستخدم غير موجود"
      });
    }

    if (user.role === "admin") {
      return res.status(400).json({
        error: "لا يمكن إيقاف مدير المؤسسة الرئيسي"
      });
    }

    db.prepare(`
      UPDATE users
      SET active = 0
      WHERE id = ?
    `).run(user.id);

    logAction(
      null,
      "DISABLE_USER",
      `إيقاف ${user.username}`
    );

    res.json({
      success: true,
      message: "تم إيقاف الحساب"
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر إيقاف الحساب"
    });
  }
});

app.patch("/api/users/:id/enable", (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, username
      FROM users
      WHERE id = ?
    `).get(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: "المستخدم غير موجود"
      });
    }

    db.prepare(`
      UPDATE users
      SET active = 1
      WHERE id = ?
    `).run(user.id);

    logAction(
      null,
      "ENABLE_USER",
      `تفعيل ${user.username}`
    );

    res.json({
      success: true,
      message: "تم تفعيل الحساب"
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر تفعيل الحساب"
    });
  }
});

/* =====================================================
   CHANGE PASSWORD
===================================================== */

app.patch("/api/users/:id/password", (req, res) => {
  try {
    const {
      current_password,
      new_password
    } = req.body || {};

    if (!new_password || String(new_password).length < 4) {
      return res.status(400).json({
        error: "كلمة المرور الجديدة يجب أن تكون 4 أحرف أو أكثر"
      });
    }

    const user = db.prepare(`
      SELECT *
      FROM users
      WHERE id = ?
    `).get(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: "المستخدم غير موجود"
      });
    }

    if (
      current_password !== undefined &&
      current_password !== user.password
    ) {
      return res.status(400).json({
        error: "كلمة المرور الحالية غير صحيحة"
      });
    }

    db.prepare(`
      UPDATE users
      SET password = ?
      WHERE id = ?
    `).run(
      new_password,
      user.id
    );

    logAction(
      user.id,
      "CHANGE_PASSWORD",
      "تغيير كلمة المرور"
    );

    res.json({
      success: true,
      message: "تم تغيير كلمة المرور"
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر تغيير كلمة المرور"
    });
  }
});

/* =====================================================
   DELETE USER
===================================================== */

app.delete("/api/users/:id", (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, username, role
      FROM users
      WHERE id = ?
    `).get(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: "المستخدم غير موجود"
      });
    }

    if (user.role === "admin") {
      return res.status(400).json({
        error: "لا يمكن حذف مدير المؤسسة الرئيسي"
      });
    }

    db.prepare(`
      DELETE FROM users
      WHERE id = ?
    `).run(user.id);

    logAction(
      null,
      "DELETE_USER",
      `حذف ${user.username}`
    );

    res.json({
      success: true,
      message: "تم حذف المستخدم"
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر حذف المستخدم"
    });
  }
});

/* =====================================================
   STUDENTS
===================================================== */

app.get("/api/students", (req, res) => {
  try {
    const students = db.prepare(`
      SELECT
        s.*,
        u.username AS username,
        u.name AS account_name
      FROM students s
      LEFT JOIN users u
        ON u.id = s.user_id
      ORDER BY s.id DESC
    `).all();

    res.json(students);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب الطلاب"
    });
  }
});

app.post("/api/students", (req, res) => {
  try {
    const {
      name,
      class_name,
      parent_phone,
      parent_user_id,
      user_id
    } = req.body || {};

    if (!name) {
      return res.status(400).json({
        error: "اسم الطالب مطلوب"
      });
    }

    const result = db.prepare(`
      INSERT INTO students
      (
        user_id,
        name,
        class_name,
        parent_phone,
        parent_user_id,
        status,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, 'حاضر', ?)
    `).run(
      user_id || null,
      name,
      class_name || "",
      parent_phone || "",
      parent_user_id || null,
      nowISO()
    );

    logAction(
      null,
      "ADD_STUDENT",
      `إضافة الطالب ${name}`
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر إضافة الطالب"
    });
  }
});

/* =====================================================
   STUDENT ATTENDANCE
===================================================== */

app.get("/api/students/:id/attendance", (req, res) => {
  try {
    const records = db.prepare(`
      SELECT *
      FROM student_attendance
      WHERE student_id = ?
      ORDER BY date DESC
    `).all(req.params.id);

    const present = records.filter(
      x => x.status === "حاضر"
    ).length;

    const absent = records.filter(
      x => x.status === "غائب"
    ).length;

    const total = records.length;

    res.json({
      records,
      present,
      absent,
      total,
      percentage:
        total
          ? Math.round((present / total) * 100)
          : 0
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب حضور الطالب"
    });
  }
});

app.patch("/api/students/:id/status", (req, res) => {
  try {
    const student = db.prepare(`
      SELECT *
      FROM students
      WHERE id = ?
    `).get(req.params.id);

    if (!student) {
      return res.status(404).json({
        error: "الطالب غير موجود"
      });
    }

    const status =
      student.status === "حاضر"
        ? "غائب"
        : "حاضر";

    db.prepare(`
      UPDATE students
      SET status = ?
      WHERE id = ?
    `).run(
      status,
      student.id
    );

    db.prepare(`
      INSERT INTO student_attendance
      (student_id, date, status, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(student_id, date)
      DO UPDATE SET
        status = excluded.status,
        created_at = excluded.created_at
    `).run(
      student.id,
      today(),
      status,
      nowISO()
    );

    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر تحديث الحضور"
    });
  }
});

app.patch("/api/students/:id/attendance", (req, res) => {
  try {
    const {
      date,
      status
    } = req.body || {};

    if (!date || !["حاضر", "غائب"].includes(status)) {
      return res.status(400).json({
        error: "التاريخ والحالة مطلوبان"
      });
    }

    const student = db.prepare(`
      SELECT id
      FROM students
      WHERE id = ?
    `).get(req.params.id);

    if (!student) {
      return res.status(404).json({
        error: "الطالب غير موجود"
      });
    }

    db.prepare(`
      INSERT INTO student_attendance
      (student_id, date, status, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(student_id, date)
      DO UPDATE SET
        status = excluded.status,
        created_at = excluded.created_at
    `).run(
      student.id,
      date,
      status,
      nowISO()
    );

    if (date === today()) {
      db.prepare(`
        UPDATE students
        SET status = ?
        WHERE id = ?
      `).run(
        status,
        student.id
      );
    }

    res.json({
      success: true,
      message: "تم تحديث الحضور"
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر تحديث الحضور"
    });
  }
});

/* =====================================================
   EMPLOYEES
===================================================== */

app.get("/api/employees", (req, res) => {
  try {
    const employees = db.prepare(`
      SELECT
        e.*,
        u.username,
        u.role,
        u.active AS account_active,
        u.last_seen
      FROM employees e
      LEFT JOIN users u
        ON u.id = e.user_id
      ORDER BY e.id DESC
    `).all();

    res.json(employees);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب الموظفين"
    });
  }
});

app.post("/api/employees", (req, res) => {
  try {
    const {
      employee_number,
      name,
      job_title,
      department,
      phone,
      hire_date,
      basic_salary,
      allowance,
      user_id
    } = req.body || {};

    if (!name) {
      return res.status(400).json({
        error: "اسم الموظف مطلوب"
      });
    }

    const result = db.prepare(`
      INSERT INTO employees
      (
        user_id,
        employee_number,
        name,
        job_title,
        department,
        phone,
        hire_date,
        basic_salary,
        allowance,
        active,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      user_id || null,
      employee_number || null,
      name,
      job_title || "",
      department || "",
      phone || "",
      hire_date || "",
      safeNumber(basic_salary),
      safeNumber(allowance),
      nowISO()
    );

    logAction(
      null,
      "ADD_EMPLOYEE",
      `إضافة الموظف ${name}`
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });
  } catch (error) {
    console.error(error);

    res.status(400).json({
      error: "تعذر إضافة الموظف. تأكد من رقم الموظف."
    });
  }
});

/* =====================================================
   EMPLOYEE ATTENDANCE
===================================================== */

app.post("/api/employees/:id/attendance", (req, res) => {
  try {
    const employee = db.prepare(`
      SELECT *
      FROM employees
      WHERE id = ?
    `).get(req.params.id);

    if (!employee) {
      return res.status(404).json({
        error: "الموظف غير موجود"
      });
    }

    const {
      date,
      check_in,
      check_out,
      status
    } = req.body || {};

    const attendanceDate = date || today();
    let finalStatus = status || "حاضر";
    let lateMinutes = 0;

    const settings = db.prepare(`
      SELECT *
      FROM payroll_settings
      WHERE id = 1
    `).get();

    if (check_in) {
      const [h, m] =
        String(check_in)
          .split(":")
          .map(Number);

      const arrival =
        (h || 0) * 60 +
        (m || 0);

      const start = 8 * 60;

      lateMinutes =
        Math.max(0, arrival - start);

      if (
        lateMinutes >
        settings.allowed_late_minutes
      ) {
        finalStatus = "متأخر";
      }
    }

    db.prepare(`
      INSERT INTO employee_attendance
      (
        employee_id,
        date,
        check_in,
        check_out,
        status,
        late_minutes,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(employee_id, date)
      DO UPDATE SET
        check_in = excluded.check_in,
        check_out = excluded.check_out,
        status = excluded.status,
        late_minutes = excluded.late_minutes
    `).run(
      employee.id,
      attendanceDate,
      check_in || null,
      check_out || null,
      finalStatus,
      lateMinutes,
      nowISO()
    );

    res.json({
      success: true,
      status: finalStatus,
      late_minutes: lateMinutes
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر تسجيل حضور الموظف"
    });
  }
});

app.get("/api/employees/:id/attendance", (req, res) => {
  try {
    const records = db.prepare(`
      SELECT *
      FROM employee_attendance
      WHERE employee_id = ?
      ORDER BY date DESC
    `).all(req.params.id);

    res.json({
      records,
      present: records.filter(
        x =>
          x.status === "حاضر" ||
          x.status === "متأخر"
      ).length,
      absent: records.filter(
        x => x.status === "غائب"
      ).length,
      late: records.filter(
        x => x.status === "متأخر"
      ).length,
      total: records.length
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب حضور الموظف"
    });
  }
});

/* =====================================================
   EMPLOYEE REQUESTS
   إجازة - سلفة - طلبات أخرى
===================================================== */

app.get("/api/requests", (req, res) => {
  try {
    const requests = db.prepare(`
      SELECT
        r.*,
        u.name AS user_name,
        u.username,
        e.employee_number
      FROM employee_requests r
      LEFT JOIN users u
        ON u.id = r.user_id
      LEFT JOIN employees e
        ON e.id = r.employee_id
      ORDER BY r.id DESC
    `).all();

    res.json(requests);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب الطلبات"
    });
  }
});

app.get("/api/users/:id/requests", (req, res) => {
  try {
    const requests = db.prepare(`
      SELECT *
      FROM employee_requests
      WHERE user_id = ?
      ORDER BY id DESC
    `).all(req.params.id);

    res.json(requests);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب الطلبات"
    });
  }
});

app.post("/api/requests", (req, res) => {
  try {
    const {
      user_id,
      employee_id,
      request_type,
      amount,
      start_date,
      end_date,
      reason
    } = req.body || {};

    if (!user_id || !request_type) {
      return res.status(400).json({
        error: "المستخدم ونوع الطلب مطلوبان"
      });
    }

    const result = db.prepare(`
      INSERT INTO employee_requests
      (
        user_id,
        employee_id,
        request_type,
        amount,
        start_date,
        end_date,
        reason,
        status,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'قيد المراجعة', ?)
    `).run(
      user_id,
      employee_id || null,
      request_type,
      safeNumber(amount),
      start_date || "",
      end_date || "",
      reason || "",
      nowISO()
    );

    logAction(
      user_id,
      "CREATE_REQUEST",
      `${request_type}`
    );

    res.json({
      success: true,
      id: result.lastInsertRowid,
      message: "تم إرسال الطلب للإدارة"
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر إرسال الطلب"
    });
  }
});

app.patch("/api/requests/:id", (req, res) => {
  try {
    const {
      status,
      admin_note,
      reviewed_by
    } = req.body || {};

    const allowed = [
      "قيد المراجعة",
      "مقبول",
      "مرفوض",
      "مكتمل"
    ];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: "حالة الطلب غير صحيحة"
      });
    }

    const request = db.prepare(`
      SELECT *
      FROM employee_requests
      WHERE id = ?
    `).get(req.params.id);

    if (!request) {
      return res.status(404).json({
        error: "الطلب غير موجود"
      });
    }

    db.prepare(`
      UPDATE employee_requests
      SET
        status = ?,
        admin_note = ?,
        reviewed_at = ?,
        reviewed_by = ?
      WHERE id = ?
    `).run(
      status,
      admin_note || "",
      nowISO(),
      reviewed_by || null,
      request.id
    );

    res.json({
      success: true,
      message: "تم تحديث الطلب"
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر تحديث الطلب"
    });
  }
});

/* =====================================================
   ANNOUNCEMENTS
===================================================== */

app.get("/api/announcements", (req, res) => {
  try {
    const announcements = db.prepare(`
      SELECT
        a.*,
        u.name AS creator_name
      FROM announcements a
      LEFT JOIN users u
        ON u.id = a.created_by
      ORDER BY a.id DESC
    `).all();

    res.json(announcements);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب الإعلانات"
    });
  }
});

app.post("/api/announcements", (req, res) => {
  try {
    const {
      title,
      message,
      target_type,
      target_role,
      created_by
    } = req.body || {};

    if (!title || !message) {
      return res.status(400).json({
        error: "العنوان والرسالة مطلوبان"
      });
    }

    const result = db.prepare(`
      INSERT INTO announcements
      (
        title,
        message,
        target_type,
        target_role,
        created_by,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      title,
      message,
      target_type || "all",
      target_role || "",
      created_by || null,
      nowISO()
    );

    logAction(
      created_by,
      "CREATE_ANNOUNCEMENT",
      title
    );

    res.json({
      success: true,
      id: result.lastInsertRowid,
      message: "تم نشر الإعلان"
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر نشر الإعلان"
    });
  }
});

/* =====================================================
   EMPLOYEE MESSAGES
===================================================== */

app.get("/api/messages/:userId", (req, res) => {
  try {
    const messages = db.prepare(`
      SELECT *
      FROM employee_messages
      WHERE user_id = ?
      ORDER BY id DESC
    `).all(req.params.userId);

    res.json(messages);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب الرسائل"
    });
  }
});

app.post("/api/messages", (req, res) => {
  try {
    const {
      employee_id,
      user_id,
      title,
      message
    } = req.body || {};

    if (!user_id || !title || !message) {
      return res.status(400).json({
        error: "المستخدم والعنوان والرسالة مطلوبة"
      });
    }

    const result = db.prepare(`
      INSERT INTO employee_messages
      (
        employee_id,
        user_id,
        title,
        message,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(
      employee_id || null,
      user_id,
      title,
      message,
      nowISO()
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر إرسال الرسالة"
    });
  }
});

app.patch("/api/messages/:id/read", (req, res) => {
  try {
    db.prepare(`
      UPDATE employee_messages
      SET
        is_read = 1,
        read_at = ?
      WHERE id = ?
    `).run(
      nowISO(),
      req.params.id
    );

    res.json({
      success: true
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر تحديث الرسالة"
    });
  }
});

/* =====================================================
   STUDENT NOTES
   + ولي الأمر شاف / ما شاف
===================================================== */

app.post("/api/notes", (req, res) => {
  try {
    const {
      student_id,
      text,
      created_by
    } = req.body || {};

    if (!student_id || !text) {
      return res.status(400).json({
        error: "الطالب والملاحظة مطلوبان"
      });
    }

    const student = db.prepare(`
      SELECT *
      FROM students
      WHERE id = ?
    `).get(student_id);

    if (!student) {
      return res.status(404).json({
        error: "الطالب غير موجود"
      });
    }

    const result = db.prepare(`
      INSERT INTO notes
      (
        student_id,
        text,
        created_by,
        created_at,
        parent_seen
      )
      VALUES (?, ?, ?, ?, 0)
    `).run(
      student_id,
      text,
      created_by || null,
      nowISO()
    );

    logAction(
      created_by,
      "ADD_NOTE",
      `ملاحظة للطالب ${student.name}`
    );

    res.json({
      success: true,
      id: result.lastInsertRowid,
      parent_seen: false,
      message: "تم حفظ الملاحظة"
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر حفظ الملاحظة"
    });
  }
});

app.get("/api/notes/:studentId", (req, res) => {
  try {
    const notes = db.prepare(`
      SELECT
        n.*,
        u.name AS created_by_name
      FROM notes n
      LEFT JOIN users u
        ON u.id = n.created_by
      WHERE n.student_id = ?
      ORDER BY n.id DESC
    `).all(req.params.studentId);

    res.json(notes);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب الملاحظات"
    });
  }
});

/* ولي الأمر يفتح الملاحظة */

app.patch("/api/notes/:id/seen", (req, res) => {
  try {
    const note = db.prepare(`
      SELECT *
      FROM notes
      WHERE id = ?
    `).get(req.params.id);

    if (!note) {
      return res.status(404).json({
        error: "الملاحظة غير موجودة"
      });
    }

    db.prepare(`
      UPDATE notes
      SET
        parent_seen = 1,
        parent_seen_at = ?
      WHERE id = ?
    `).run(
      nowISO(),
      note.id
    );

    res.json({
      success: true,
      parent_seen: true,
      parent_seen_at: nowISO()
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر تسجيل مشاهدة الملاحظة"
    });
  }
});

/* معرفة حالة مشاهدة الملاحظات */

app.get("/api/notes/status/all", (req, res) => {
  try {
    const result = db.prepare(`
      SELECT
        n.id,
        n.student_id,
        n.text,
        n.created_at,
        n.parent_seen,
        n.parent_seen_at,
        s.name AS student_name
      FROM notes n
      LEFT JOIN students s
        ON s.id = n.student_id
      ORDER BY n.id DESC
    `).all();

    res.json(result);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب حالة الملاحظات"
    });
  }
});

app.delete("/api/notes/:id", (req, res) => {
  try {
    const note = db.prepare(`
      SELECT id FROM notes WHERE id = ?
    `).get(req.params.id);

    if (!note) {
      return res.status(404).json({
        error: "الملاحظة غير موجودة"
      });
    }

    db.prepare(`
      DELETE FROM notes
      WHERE id = ?
    `).run(req.params.id);

    res.json({
      success: true,
      message: "تم حذف الملاحظة"
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر حذف الملاحظة"
    });
  }
});

/* =====================================================
   VIDEOS
===================================================== */

app.get("/api/videos", (req, res) => {
  try {
    const videos = db.prepare(`
      SELECT
        v.*,
        u.name AS creator_name
      FROM videos v
      LEFT JOIN users u
        ON u.id = v.created_by
      ORDER BY v.id DESC
    `).all();

    res.json(videos);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب الحصص"
    });
  }
});

app.post("/api/videos", (req, res) => {
  try {
    const {
      title,
      file_name,
      description,
      created_by
    } = req.body || {};

    if (!title) {
      return res.status(400).json({
        error: "اسم الحصة مطلوب"
      });
    }

    const result = db.prepare(`
      INSERT INTO videos
      (
        title,
        file_name,
        description,
        created_by,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(
      title,
      file_name || "",
      description || "",
      created_by || null,
      nowISO()
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر إضافة الحصة"
    });
  }
});

/* =====================================================
   DEDUCTIONS
===================================================== */

app.get("/api/employees/:id/deductions", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT *
      FROM deductions
      WHERE employee_id = ?
      ORDER BY date DESC, id DESC
    `).all(req.params.id);

    res.json(rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب الخصومات"
    });
  }
});

app.post("/api/employees/:id/deductions", (req, res) => {
  try {
    const {
      amount,
      reason,
      month,
      created_by
    } = req.body || {};

    if (safeNumber(amount) <= 0 || !reason) {
      return res.status(400).json({
        error: "قيمة الخصم وسببه مطلوبان"
      });
    }

    const employee = db.prepare(`
      SELECT *
      FROM employees
      WHERE id = ?
    `).get(req.params.id);

    if (!employee) {
      return res.status(404).json({
        error: "الموظف غير موجود"
      });
    }

    const result = db.prepare(`
      INSERT INTO deductions
      (
        employee_id,
        amount,
        reason,
        date,
        month,
        automatic,
        created_by,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      employee.id,
      safeNumber(amount),
      reason,
      today(),
      month || currentMonth(),
      created_by || null,
      nowISO()
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر إضافة الخصم"
    });
  }
});

app.delete("/api/deductions/:id", (req, res) => {
  try {
    db.prepare(`
      DELETE FROM deductions
      WHERE id = ?
    `).run(req.params.id);

    res.json({
      success: true,
      message: "تم حذف الخصم"
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر حذف الخصم"
    });
  }
});

/* =====================================================
   BONUSES
===================================================== */

app.get("/api/employees/:id/bonuses", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT *
      FROM bonuses
      WHERE employee_id = ?
      ORDER BY date DESC, id DESC
    `).all(req.params.id);

    res.json(rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب المكافآت"
    });
  }
});

app.post("/api/employees/:id/bonuses", (req, res) => {
  try {
    const {
      amount,
      reason,
      month,
      created_by
    } = req.body || {};

    if (safeNumber(amount) <= 0 || !reason) {
      return res.status(400).json({
        error: "قيمة المكافأة وسببها مطلوبان"
      });
    }

    const employee = db.prepare(`
      SELECT *
      FROM employees
      WHERE id = ?
    `).get(req.params.id);

    if (!employee) {
      return res.status(404).json({
        error: "الموظف غير موجود"
      });
    }

    const result = db.prepare(`
      INSERT INTO bonuses
      (
        employee_id,
        amount,
        reason,
        date,
        month,
        created_by,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      employee.id,
      safeNumber(amount),
      reason,
      today(),
      month || currentMonth(),
      created_by || null,
      nowISO()
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر إضافة المكافأة"
    });
  }
});

app.delete("/api/bonuses/:id", (req, res) => {
  try {
    db.prepare(`
      DELETE FROM bonuses
      WHERE id = ?
    `).run(req.params.id);

    res.json({
      success: true,
      message: "تم حذف المكافأة"
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر حذف المكافأة"
    });
  }
});

/* =====================================================
   PAYROLL
===================================================== */

app.get("/api/employees/:id/payroll", (req, res) => {
  try {
    const month =
      req.query.month || currentMonth();

    const employee = db.prepare(`
      SELECT *
      FROM employees
      WHERE id = ?
    `).get(req.params.id);

    if (!employee) {
      return res.status(404).json({
        error: "الموظف غير موجود"
      });
    }

    const bonuses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM bonuses
      WHERE employee_id = ?
      AND month = ?
    `).get(
      employee.id,
      month
    ).total;

    const deductions = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM deductions
      WHERE employee_id = ?
      AND month = ?
    `).get(
      employee.id,
      month
    ).total;

    const basic =
      safeNumber(employee.basic_salary);

    const allowance =
      safeNumber(employee.allowance);

    const bonus =
      safeNumber(bonuses);

    const deduction =
      safeNumber(deductions);

    const gross =
      basic +
      allowance +
      bonus;

    const net =
      gross -
      deduction;

    res.json({
      month,
      employee,
      basic_salary: basic,
      allowance,
      bonuses: bonus,
      deductions: deduction,
      gross,
      net
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر حساب الراتب"
    });
  }
});

/* =====================================================
   PAYROLL SETTINGS
===================================================== */

app.get("/api/payroll-settings", (req, res) => {
  try {
    const settings = db.prepare(`
      SELECT *
      FROM payroll_settings
      WHERE id = 1
    `).get();

    res.json(settings);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب إعدادات الرواتب"
    });
  }
});

app.patch("/api/payroll-settings", (req, res) => {
  try {
    const {
      absence_deduction,
      late_deduction,
      allowed_late_minutes
    } = req.body || {};

    db.prepare(`
      UPDATE payroll_settings
      SET
        absence_deduction = ?,
        late_deduction = ?,
        allowed_late_minutes = ?
      WHERE id = 1
    `).run(
      safeNumber(absence_deduction),
      safeNumber(late_deduction),
      safeNumber(allowed_late_minutes)
    );

    res.json({
      success: true,
      message: "تم تحديث إعدادات الرواتب"
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر تحديث إعدادات الرواتب"
    });
  }
});

/* =====================================================
   AUDIT LOGS
===================================================== */

app.get("/api/audit-logs", (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT
        a.*,
        u.name AS user_name,
        u.username
      FROM audit_logs a
      LEFT JOIN users u
        ON u.id = a.user_id
      ORDER BY a.id DESC
      LIMIT 500
    `).all();

    res.json(logs);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب سجل العمليات"
    });
  }
});

/* =====================================================
   DASHBOARD
===================================================== */

app.get("/api/dashboard", (req, res) => {
  try {
    const users = db.prepare(`
      SELECT *
      FROM users
    `).all();

    const students =
      db.prepare(`
        SELECT COUNT(*) AS count
        FROM students
      `).get().count;

    const employees =
      db.prepare(`
        SELECT COUNT(*) AS count
        FROM employees
        WHERE active = 1
      `).get().count;

    const now = Date.now();

    const onlineUsers = users.filter(user => {
      return (
        user.active === 1 &&
        user.last_seen &&
        now - new Date(user.last_seen).getTime() <= 60000
      );
    });

    res.json({
      users_total: users.length,
      users_online: onlineUsers.length,
      students,
      employees,
      online_users: onlineUsers.map(user => ({
        id: user.id,
        name: user.name,
        role: user.role,
        role_name:
          roleNames[user.role] || user.role
      }))
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر تحميل لوحة التحكم"
    });
  }
});

/* =====================================================
   ROLE LIST
===================================================== */

app.get("/api/roles", (req, res) => {
  res.json(
    roles.map(role => ({
      value: role,
      name: roleNames[role] || role
    }))
  );
});

/* =====================================================
   ROOT
===================================================== */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

/* =====================================================
   START SERVER
===================================================== */

const PORT =
  process.env.PORT || 3000;

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `School portal running on port ${PORT}`
    );
  }
);
