const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const db = new Database("school.db");

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(express.static(__dirname));

/* =========================================================
   أدوات عامة
========================================================= */

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

function logAction(userId, action, details = "", schoolId = null) {
  try {
    db.prepare(`
      INSERT INTO audit_logs
      (user_id, school_id, action, details, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      userId || null,
      schoolId || null,
      action,
      details,
      nowISO()
    );
  } catch (error) {
    console.error("AUDIT ERROR:", error.message);
  }
}

/* =========================================================
   إنشاء قاعدة البيانات
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
    phone TEXT,
    active INTEGER DEFAULT 1,
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
    photo TEXT,
    status TEXT DEFAULT 'حاضر',
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS student_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER,
    student_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    check_in TEXT,
    created_at TEXT,
    UNIQUE(student_id, date)
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER,
    user_id INTEGER,
    employee_number TEXT,
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
    school_id INTEGER,
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
    school_id INTEGER,
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
    school_id INTEGER,
    employee_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    reason TEXT NOT NULL,
    date TEXT NOT NULL,
    month TEXT NOT NULL,
    created_by INTEGER,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS payroll_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER UNIQUE,
    absence_deduction REAL DEFAULT 300,
    late_deduction REAL DEFAULT 50,
    allowed_late_minutes INTEGER DEFAULT 15
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER,
    student_id INTEGER NOT NULL,
    user_id INTEGER,
    type TEXT DEFAULT 'عام',
    text TEXT NOT NULL,
    attachment TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER,
    title TEXT NOT NULL,
    subject TEXT,
    teacher_id INTEGER,
    class_name TEXT,
    file_name TEXT,
    video_url TEXT,
    pdf_url TEXT,
    homework TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    created_by INTEGER,
    target_role TEXT DEFAULT 'all',
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT,
    description TEXT,
    amount REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    manager_note TEXT,
    approved_by INTEGER,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    read_at TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    school_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS platform_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER UNIQUE,
    platform_name TEXT DEFAULT 'إدارة المدرسة',
    school_name TEXT DEFAULT '',
    logo TEXT DEFAULT '',
    primary_color TEXT DEFAULT '#173b70',
    secondary_color TEXT DEFAULT '#2563eb',
    accent_color TEXT DEFAULT '#10b981',
    background_color TEXT DEFAULT '#f4f7fb',
    sidebar_color TEXT DEFAULT '#173b70',
    dark_mode INTEGER DEFAULT 0,
    compact_sidebar INTEGER DEFAULT 0,
    show_logo INTEGER DEFAULT 1,
    show_school_name INTEGER DEFAULT 1,
    created_at TEXT,
    updated_at TEXT
  );
`);

/* =========================================================
   ترقيات قاعدة البيانات القديمة
========================================================= */

function addColumn(table, column, definition) {
  try {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();

    if (!columns.some(c => c.name === column)) {
      db.exec(
        `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`
      );
    }
  } catch (error) {
    console.error(
      `COLUMN ${table}.${column}:`,
      error.message
    );
  }
}

addColumn("users", "school_id", "INTEGER");
addColumn("users", "email", "TEXT");
addColumn("users", "job_title", "TEXT");
addColumn("users", "phone", "TEXT");
addColumn("users", "active", "INTEGER DEFAULT 1");
addColumn("users", "last_seen", "TEXT");
addColumn("users", "created_at", "TEXT");

addColumn("students", "school_id", "INTEGER");
addColumn("students", "student_number", "TEXT");
addColumn("students", "birth_date", "TEXT");
addColumn("students", "parent_phone", "TEXT");
addColumn("students", "photo", "TEXT");
addColumn("students", "status", "TEXT DEFAULT 'حاضر'");
addColumn("students", "created_at", "TEXT");

addColumn("employees", "school_id", "INTEGER");
addColumn("employees", "user_id", "INTEGER");
addColumn("employees", "employee_number", "TEXT");
addColumn("employees", "name", "TEXT");
addColumn("employees", "job_title", "TEXT");
addColumn("employees", "department", "TEXT");
addColumn("employees", "phone", "TEXT");
addColumn("employees", "hire_date", "TEXT");
addColumn("employees", "basic_salary", "REAL DEFAULT 0");
addColumn("employees", "allowance", "REAL DEFAULT 0");
addColumn("employees", "active", "INTEGER DEFAULT 1");
addColumn("employees", "created_at", "TEXT");

addColumn("employee_attendance", "school_id", "INTEGER");

addColumn("deductions", "school_id", "INTEGER");
addColumn("bonuses", "school_id", "INTEGER");

addColumn("payroll_settings", "school_id", "INTEGER");

addColumn("notes", "school_id", "INTEGER");
addColumn("notes", "user_id", "INTEGER");
addColumn("notes", "type", "TEXT");
addColumn("notes", "attachment", "TEXT");

addColumn("videos", "school_id", "INTEGER");
addColumn("videos", "subject", "TEXT");
addColumn("videos", "teacher_id", "INTEGER");
addColumn("videos", "class_name", "TEXT");
addColumn("videos", "file_name", "TEXT");
addColumn("videos", "video_url", "TEXT");
addColumn("videos", "pdf_url", "TEXT");
addColumn("videos", "homework", "TEXT");

addColumn("audit_logs", "school_id", "INTEGER");

/* =========================================================
   المدرسة الافتراضية
========================================================= */

let defaultSchool = db.prepare(`
  SELECT *
  FROM schools
  ORDER BY id
  LIMIT 1
`).get();

if (!defaultSchool) {
  const result = db.prepare(`
    INSERT INTO schools
    (
      name,
      code,
      email,
      status,
      subscription_status,
      subscription_start,
      created_at
    )
    VALUES (?, ?, ?, 'active', 'active', ?, ?)
  `).run(
    "British Education School",
    "BES-001",
    "",
    today(),
    nowISO()
  );

  defaultSchool = db.prepare(`
    SELECT *
    FROM schools
    WHERE id = ?
  `).get(result.lastInsertRowid);
}

/* =========================================================
   إعدادات المنصة
========================================================= */

function createPlatformSettings(schoolId, schoolName) {
  const exists = db.prepare(`
    SELECT *
    FROM platform_settings
    WHERE school_id = ?
  `).get(schoolId);

  if (!exists) {
    db.prepare(`
      INSERT INTO platform_settings
      (
        school_id,
        platform_name,
        school_name,
        logo,
        primary_color,
        secondary_color,
        accent_color,
        background_color,
        sidebar_color,
        dark_mode,
        compact_sidebar,
        show_logo,
        show_school_name,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, 0, 0, 1, 1, ?, ?)
    `).run(
      schoolId,
      "إدارة المدرسة",
      schoolName || "المدرسة",
      "#173b70",
      "#2563eb",
      "#10b981",
      "#f4f7fb",
      "#173b70",
      nowISO(),
      nowISO()
    );
  }
}

createPlatformSettings(
  defaultSchool.id,
  defaultSchool.name
);

/* =========================================================
   المستخدم الافتراضي
========================================================= */

const userCount = db.prepare(`
  SELECT COUNT(*) AS count
  FROM users
`).get().count;

if (userCount === 0) {
  const insert = db.prepare(`
    INSERT INTO users
    (
      school_id,
      username,
      password,
      role,
      name,
      email,
      job_title,
      active,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);

  insert.run(
    null,
    "owner",
    "1234",
    "owner",
    "مالك النظام",
    "",
    "System Owner",
    nowISO()
  );

  insert.run(
    defaultSchool.id,
    "admin",
    "1234",
    "admin",
    "مدير المدرسة",
    "",
    "مدير المدرسة",
    nowISO()
  );

  insert.run(
    defaultSchool.id,
    "teacher",
    "1234",
    "teacher",
    "الأستاذ أحمد",
    "",
    "معلم",
    nowISO()
  );

  insert.run(
    defaultSchool.id,
    "parent",
    "1234",
    "parent",
    "ولي أمر محمد",
    "",
    "ولي أمر",
    nowISO()
  );

  insert.run(
    defaultSchool.id,
    "student",
    "1234",
    "student",
    "محمد أحمد",
    "",
    "طالب",
    nowISO()
  );
}

/* =========================================================
   طالب تجريبي
========================================================= */

const studentCount = db.prepare(`
  SELECT COUNT(*) AS count
  FROM students
`).get().count;

if (studentCount === 0) {
  db.prepare(`
    INSERT INTO students
    (
      school_id,
      student_number,
      name,
      class_name,
      parent_phone,
      status,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    defaultSchool.id,
    "ST-001",
    "محمد أحمد",
    "الصف السادس",
    "",
    "حاضر",
    nowISO()
  );
}

/* =========================================================
   صلاحيات
========================================================= */

const permissions = {
  owner: ["all"],

  admin: [
    "dashboard",
    "users",
    "students",
    "attendance",
    "employees",
    "payroll",
    "notes",
    "videos",
    "announcements",
    "requests",
    "messages",
    "reports"
  ],

  hr: [
    "dashboard",
    "employees",
    "attendance",
    "requests",
    "messages"
  ],

  accountant: [
    "dashboard",
    "employees",
    "payroll",
    "requests",
    "messages"
  ],

  teacher: [
    "dashboard",
    "students",
    "attendance",
    "notes",
    "videos",
    "announcements",
    "messages"
  ],

  worker: [
    "dashboard",
    "requests",
    "messages",
    "announcements"
  ],

  reviewer: [
    "dashboard",
    "students",
    "employees",
    "attendance",
    "payroll",
    "reports"
  ],

  parent: [
    "dashboard",
    "students",
    "attendance",
    "notes",
    "videos",
    "announcements",
    "messages"
  ],

  student: [
    "dashboard",
    "attendance",
    "notes",
    "videos",
    "announcements",
    "messages"
  ]
};

function hasPermission(user, permission) {
  if (!user) return false;

  if (user.role === "owner") {
    return true;
  }

  return (
    permissions[user.role] &&
    permissions[user.role].includes(permission)
  );
}

function getUser(req) {
  const id =
    req.body?.user_id ||
    req.query?.user_id ||
    req.headers["x-user-id"];

  if (!id) return null;

  return db.prepare(`
    SELECT *
    FROM users
    WHERE id = ?
  `).get(id);
}

function sameSchool(user, schoolId) {
  if (!user) return false;

  if (user.role === "owner") {
    return true;
  }

  return Number(user.school_id) === Number(schoolId);
}

/* =========================================================
   تسجيل الدخول
========================================================= */

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
        error: "هذا الحساب موقوف"
      });
    }

    if (user.school_id) {
      const school = db.prepare(`
        SELECT *
        FROM schools
        WHERE id = ?
      `).get(user.school_id);

      if (!school) {
        return res.status(403).json({
          error: "المدرسة غير موجودة"
        });
      }

      if (school.status !== "active") {
        return res.status(403).json({
          error: "المدرسة موقوفة"
        });
      }

      if (school.subscription_status === "expired") {
        return res.status(403).json({
          error: "اشتراك المدرسة منتهي"
        });
      }
    }

    const now = nowISO();

    db.prepare(`
      UPDATE users
      SET last_seen = ?
      WHERE id = ?
    `).run(now, user.id);

    const school = user.school_id
      ? db.prepare(`
          SELECT *
          FROM schools
          WHERE id = ?
        `).get(user.school_id)
      : null;

    const settings = user.school_id
      ? db.prepare(`
          SELECT *
          FROM platform_settings
          WHERE school_id = ?
        `).get(user.school_id)
      : null;

    logAction(
      user.id,
      "LOGIN",
      `تسجيل دخول ${user.username}`,
      user.school_id
    );

    res.json({
      success: true,

      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        job_title: user.job_title,
        phone: user.phone,
        school_id: user.school_id,
        active: user.active,
        last_seen: now
      },

      school,

      settings,

      permissions:
        user.role === "owner"
          ? ["all"]
          : permissions[user.role] || []
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "حدث خطأ أثناء تسجيل الدخول"
    });
  }
});

/* =========================================================
   تسجيل جديد
========================================================= */

app.post("/api/register", (req, res) => {
  try {
    const {
      name,
      username,
      password,
      role,
      school_name,
      email,
      phone
    } = req.body || {};

    if (
      !name ||
      !username ||
      !password
    ) {
      return res.status(400).json({
        error: "الاسم واسم المستخدم وكلمة المرور مطلوبة"
      });
    }

    const existing = db.prepare(`
      SELECT id
      FROM users
      WHERE username = ?
    `).get(username);

    if (existing) {
      return res.status(400).json({
        error: "اسم المستخدم مستخدم بالفعل"
      });
    }

    const finalRole =
      ["teacher", "parent", "student"].includes(role)
        ? role
        : "teacher";

    let schoolId = null;

    if (school_name) {
      const existingSchool = db.prepare(`
        SELECT *
        FROM schools
        WHERE name = ?
      `).get(school_name);

      if (existingSchool) {
        schoolId = existingSchool.id;
      } else {
        const schoolResult = db.prepare(`
          INSERT INTO schools
          (
            name,
            code,
            email,
            phone,
            status,
            subscription_status,
            subscription_start,
            created_at
          )
          VALUES (?, ?, ?, ?, 'active', 'active', ?, ?)
        `).run(
          school_name,
          `SCH-${Date.now()}`,
          email || "",
          phone || "",
          today(),
          nowISO()
        );

        schoolId = schoolResult.lastInsertRowid;

        createPlatformSettings(
          schoolId,
          school_name
        );
      }
    } else {
      schoolId = defaultSchool.id;
    }

    const result = db.prepare(`
      INSERT INTO users
      (
        school_id,
        username,
        password,
        role,
        name,
        email,
        phone,
        active,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      schoolId,
      username,
      password,
      finalRole,
      name,
      email || "",
      phone || "",
      nowISO()
    );

    logAction(
      result.lastInsertRowid,
      "REGISTER",
      `تسجيل مستخدم جديد ${username}`,
      schoolId
    );

    res.json({
      success: true,
      message: "تم إنشاء الحساب بنجاح",
      id: result.lastInsertRowid
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);

    res.status(500).json({
      error: "تعذر إنشاء الحساب"
    });
  }
});

/* =========================================================
   النشاط
========================================================= */

app.post("/api/activity", (req, res) => {
  try {
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({
        error: "المستخدم غير موجود"
      });
    }

    if (!user.active) {
      return res.status(403).json({
        error: "الحساب موقوف"
      });
    }

    const now = nowISO();

    db.prepare(`
      UPDATE users
      SET last_seen = ?
      WHERE id = ?
    `).run(now, user.id);

    res.json({
      success: true,
      last_seen: now
    });

  } catch (error) {
    res.status(500).json({
      error: "حدث خطأ"
    });
  }
});

/* =========================================================
   المستخدم الحالي
========================================================= */

app.get("/api/me", (req, res) => {
  try {
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({
        error: "المستخدم غير موجود"
      });
    }

    const school = user.school_id
      ? db.prepare(`
          SELECT *
          FROM schools
          WHERE id = ?
        `).get(user.school_id)
      : null;

    const settings = user.school_id
      ? db.prepare(`
          SELECT *
          FROM platform_settings
          WHERE school_id = ?
        `).get(user.school_id)
      : null;

    res.json({
      user,
      school,
      settings,
      permissions:
        user.role === "owner"
          ? ["all"]
          : permissions[user.role] || []
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب بيانات المستخدم"
    });
  }
});

/* =========================================================
   إعدادات المنصة
========================================================= */

app.get("/api/platform-settings", (req, res) => {
  try {
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({
        error: "يجب تسجيل الدخول"
      });
    }

    if (!user.school_id) {
      return res.json({
        platform_name: "إدارة المدرسة",
        school_name: "",
        logo: "",
        primary_color: "#173b70",
        secondary_color: "#2563eb",
        accent_color: "#10b981",
        background_color: "#f4f7fb",
        sidebar_color: "#173b70",
        dark_mode: 0,
        compact_sidebar: 0,
        show_logo: 1,
        show_school_name: 1
      });
    }

    let settings = db.prepare(`
      SELECT *
      FROM platform_settings
      WHERE school_id = ?
    `).get(user.school_id);

    if (!settings) {
      createPlatformSettings(
        user.school_id,
        "المدرسة"
      );

      settings = db.prepare(`
        SELECT *
        FROM platform_settings
        WHERE school_id = ?
      `).get(user.school_id);
    }

    res.json(settings);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب إعدادات المنصة"
    });
  }
});

app.patch("/api/platform-settings", (req, res) => {
  try {
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({
        error: "يجب تسجيل الدخول"
      });
    }

    if (user.role !== "owner") {
      return res.status(403).json({
        error: "إعدادات المنصة للمالك فقط"
      });
    }

    if (!user.school_id) {
      return res.status(400).json({
        error: "الحساب غير مرتبط بمدرسة"
      });
    }

    const old = db.prepare(`
      SELECT *
      FROM platform_settings
      WHERE school_id = ?
    `).get(user.school_id);

    const body = req.body || {};

    const data = {
      platform_name:
        body.platform_name ?? old?.platform_name ?? "إدارة المدرسة",

      school_name:
        body.school_name ?? old?.school_name ?? "",

      logo:
        body.logo ?? old?.logo ?? "",

      primary_color:
        body.primary_color ?? old?.primary_color ?? "#173b70",

      secondary_color:
        body.secondary_color ?? old?.secondary_color ?? "#2563eb",

      accent_color:
        body.accent_color ?? old?.accent_color ?? "#10b981",

      background_color:
        body.background_color ?? old?.background_color ?? "#f4f7fb",

      sidebar_color:
        body.sidebar_color ?? old?.sidebar_color ?? "#173b70",

      dark_mode:
        body.dark_mode ? 1 : 0,

      compact_sidebar:
        body.compact_sidebar ? 1 : 0,

      show_logo:
        body.show_logo === false ? 0 : 1,

      show_school_name:
        body.show_school_name === false ? 0 : 1
    };

    if (old) {
      db.prepare(`
        UPDATE platform_settings
        SET
          platform_name = ?,
          school_name = ?,
          logo = ?,
          primary_color = ?,
          secondary_color = ?,
          accent_color = ?,
          background_color = ?,
          sidebar_color = ?,
          dark_mode = ?,
          compact_sidebar = ?,
          show_logo = ?,
          show_school_name = ?,
          updated_at = ?
        WHERE school_id = ?
      `).run(
        data.platform_name,
        data.school_name,
        data.logo,
        data.primary_color,
        data.secondary_color,
        data.accent_color,
        data.background_color,
        data.sidebar_color,
        data.dark_mode,
        data.compact_sidebar,
        data.show_logo,
        data.show_school_name,
        nowISO(),
        user.school_id
      );
    } else {
      createPlatformSettings(
        user.school_id,
        data.school_name
      );
    }

    const settings = db.prepare(`
      SELECT *
      FROM platform_settings
      WHERE school_id = ?
    `).get(user.school_id);

    logAction(
      user.id,
      "UPDATE_PLATFORM_SETTINGS",
      "تعديل شكل وإعدادات المنصة",
      user.school_id
    );

    res.json({
      success: true,
      message: "تم حفظ إعدادات المنصة",
      settings
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر حفظ إعدادات المنصة"
    });
  }
});

/* =========================================================
   المستخدمون
========================================================= */

app.get("/api/users", (req, res) => {
  try {
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({
        error: "يجب تسجيل الدخول"
      });
    }

    let users;

    if (user.role === "owner") {
      users = db.prepare(`
        SELECT
          u.id,
          u.school_id,
          u.username,
          u.role,
          u.name,
          u.email,
          u.job_title,
          u.phone,
          u.active,
          u.last_seen,
          u.created_at,
          s.name AS school_name
        FROM users u
        LEFT JOIN schools s
          ON s.id = u.school_id
        ORDER BY u.id DESC
      `).all();
    } else {
      users = db.prepare(`
        SELECT
          u.id,
          u.school_id,
          u.username,
          u.role,
          u.name,
          u.email,
          u.job_title,
          u.phone,
          u.active,
          u.last_seen,
          u.created_at,
          s.name AS school_name
        FROM users u
        LEFT JOIN schools s
          ON s.id = u.school_id
        WHERE u.school_id = ?
        ORDER BY u.id DESC
      `).all(user.school_id);
    }

    const now = Date.now();

    users = users.map(u => ({
      ...u,
      online:
        !!u.last_seen &&
        u.active === 1 &&
        now - new Date(u.last_seen).getTime() <= 60000
    }));

    res.json({
      users,
      total: users.length,
      online_count: users.filter(x => x.online).length,
      active_count: users.filter(x => x.active === 1).length
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب المستخدمين"
    });
  }
});

app.post("/api/users", (req, res) => {
  try {
    const current = getUser(req);

    if (!current) {
      return res.status(401).json({
        error: "يجب تسجيل الدخول"
      });
    }

    if (
      current.role !== "owner" &&
      !hasPermission(current, "users")
    ) {
      return res.status(403).json({
        error: "ليس لديك صلاحية"
      });
    }

    const {
      school_id,
      username,
      password,
      role,
      name,
      email,
      job_title,
      phone
    } = req.body || {};

    if (
      !username ||
      !password ||
      !role ||
      !name
    ) {
      return res.status(400).json({
        error: "أكمل بيانات المستخدم"
      });
    }

    const roles = [
      "owner",
      "admin",
      "hr",
      "accountant",
      "teacher",
      "worker",
      "reviewer",
      "parent",
      "student"
    ];

    if (!roles.includes(role)) {
      return res.status(400).json({
        error: "الصلاحية غير صحيحة"
      });
    }

    if (
      role === "owner" &&
      current.role !== "owner"
    ) {
      return res.status(403).json({
        error: "لا يمكن إنشاء مالك"
      });
    }

    const finalSchoolId =
      current.role === "owner"
        ? (school_id || null)
        : current.school_id;

    if (
      role !== "owner" &&
      !finalSchoolId
    ) {
      return res.status(400).json({
        error: "المدرسة مطلوبة"
      });
    }

    const result = db.prepare(`
      INSERT INTO users
      (
        school_id,
        username,
        password,
        role,
        name,
        email,
        job_title,
        phone,
        active,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      finalSchoolId,
      username,
      password,
      role,
      name,
      email || "",
      job_title || "",
      phone || "",
      nowISO()
    );

    logAction(
      current.id,
      "ADD_USER",
      `إضافة المستخدم ${username}`,
      finalSchoolId
    );

    res.json({
      success: true,
      id: result.lastInsertRowid,
      message: "تم إضافة المستخدم"
    });

  } catch (error) {
    if (String(error.message).includes("UNIQUE")) {
      return res.status(400).json({
        error: "اسم المستخدم موجود بالفعل"
      });
    }

    res.status(500).json({
      error: "تعذر إضافة المستخدم"
    });
  }
});

app.patch("/api/users/:id", (req, res) => {
  try {
    const current = getUser(req);

    if (!current) {
      return res.status(401).json({
        error: "يجب تسجيل الدخول"
      });
    }

    const target = db.prepare(`
      SELECT *
      FROM users
      WHERE id = ?
    `).get(req.params.id);

    if (!target) {
      return res.status(404).json({
        error: "المستخدم غير موجود"
      });
    }

    if (
      current.role !== "owner" &&
      target.school_id !== current.school_id
    ) {
      return res.status(403).json({
        error: "لا يمكنك تعديل هذا المستخدم"
      });
    }

    if (
      current.role !== "owner" &&
      !hasPermission(current, "users")
    ) {
      return res.status(403).json({
        error: "ليس لديك صلاحية"
      });
    }

    const {
      name,
      email,
      job_title,
      phone,
      role,
      password,
      active
    } = req.body || {};

    if (
      role === "owner" &&
      current.role !== "owner"
    ) {
      return res.status(403).json({
        error: "غير مسموح"
      });
    }

    db.prepare(`
      UPDATE users
      SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        job_title = COALESCE(?, job_title),
        phone = COALESCE(?, phone),
        role = COALESCE(?, role),
        password = COALESCE(?, password),
        active = COALESCE(?, active)
      WHERE id = ?
    `).run(
      name ?? null,
      email ?? null,
      job_title ?? null,
      phone ?? null,
      role ?? null,
      password || null,
      active === undefined
        ? null
        : active ? 1 : 0,
      target.id
    );

    logAction(
      current.id,
      "UPDATE_USER",
      `تعديل المستخدم ${target.username}`,
      target.school_id
    );

    res.json({
      success: true,
      message: "تم تعديل المستخدم"
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر تعديل المستخدم"
    });
  }
});

app.patch("/api/users/:id/status", (req, res) => {
  try {
    const current = getUser(req);

    if (!current) {
      return res.status(401).json({
        error: "يجب تسجيل الدخول"
      });
    }

    const target = db.prepare(`
      SELECT *
      FROM users
      WHERE id = ?
    `).get(req.params.id);

    if (!target) {
      return res.status(404).json({
        error: "المستخدم غير موجود"
      });
    }

    if (
      current.role !== "owner" &&
      target.school_id !== current.school_id
    ) {
      return res.status(403).json({
        error: "غير مسموح"
      });
    }

    if (
      current.role !== "owner" &&
      !hasPermission(current, "users")
    ) {
      return res.status(403).json({
        error: "ليس لديك صلاحية"
      });
    }

    if (
      target.id === current.id
    ) {
      return res.status(400).json({
        error: "لا يمكنك إيقاف حسابك"
      });
    }

    const active =
      req.body?.active === false ||
      req.body?.status === "inactive"
        ? 0
        : 1;

    db.prepare(`
      UPDATE users
      SET active = ?
      WHERE id = ?
    `).run(
      active,
      target.id
    );

    logAction(
      current.id,
      active ? "ENABLE_USER" : "DISABLE_USER",
      target.username,
      target.school_id
    );

    res.json({
      success: true,
      active
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر تغيير حالة المستخدم"
    });
  }
});

/* =========================================================
   المدارس
========================================================= */

app.get("/api/schools", (req, res) => {
  try {
    const user = getUser(req);

    if (!user || user.role !== "owner") {
      return res.status(403).json({
        error: "هذه العملية للمالك فقط"
      });
    }

    const schools = db.prepare(`
      SELECT
        s.*,
        (
          SELECT COUNT(*)
          FROM users u
          WHERE u.school_id = s.id
        ) AS users_count,
        (
          SELECT COUNT(*)
          FROM students st
          WHERE st.school_id = s.id
        ) AS students_count
      FROM schools s
      ORDER BY s.id DESC
    `).all();

    res.json({
      schools
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب المدارس"
    });
  }
});

app.post("/api/schools", (req, res) => {
  try {
    const user = getUser(req);

    if (!user || user.role !== "owner") {
      return res.status(403).json({
        error: "إضافة المدارس للمالك فقط"
      });
    }

    const {
      name,
      code,
      email,
      phone,
      address,
      subscription_start,
      subscription_end
    } = req.body || {};

    if (!name) {
      return res.status(400).json({
        error: "اسم المدرسة مطلوب"
      });
    }

    const result = db.prepare(`
      INSERT INTO schools
      (
        name,
        code,
        email,
        phone,
        address,
        status,
        subscription_status,
        subscription_start,
        subscription_end,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, 'active', 'active', ?, ?, ?)
    `).run(
      name,
      code || `SCH-${Date.now()}`,
      email || "",
      phone || "",
      address || "",
      subscription_start || today(),
      subscription_end || "",
      nowISO()
    );

    createPlatformSettings(
      result.lastInsertRowid,
      name
    );

    logAction(
      user.id,
      "ADD_SCHOOL",
      name,
      result.lastInsertRowid
    );

    res.json({
      success: true,
      id: result.lastInsertRowid,
      message: "تم إنشاء المدرسة"
    });

  } catch (error) {
    res.status(400).json({
      error: "تعذر إنشاء المدرسة. تأكد أن الكود غير مكرر."
    });
  }
});

app.patch("/api/schools/:id/status", (req, res) => {
  try {
    const user = getUser(req);

    if (!user || user.role !== "owner") {
      return res.status(403).json({
        error: "هذه العملية للمالك فقط"
      });
    }

    const school = db.prepare(`
      SELECT *
      FROM schools
      WHERE id = ?
    `).get(req.params.id);

    if (!school) {
      return res.status(404).json({
        error: "المدرسة غير موجودة"
      });
    }

    const status =
      req.body?.status === "inactive"
        ? "inactive"
        : "active";

    db.prepare(`
      UPDATE schools
      SET status = ?
      WHERE id = ?
    `).run(
      status,
      school.id
    );

    res.json({
      success: true,
      status
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر تغيير حالة المدرسة"
    });
  }
});

/* =========================================================
   الطلاب
========================================================= */

app.get("/api/students", (req, res) => {
  try {
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({
        error: "يجب تسجيل الدخول"
      });
    }

    const students = db.prepare(`
      SELECT *
      FROM students
      WHERE school_id = ?
      ORDER BY id DESC
    `).all(user.school_id);

    res.json({
      students
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب الطلاب"
    });
  }
});

app.post("/api/students", (req, res) => {
  try {
    const user = getUser(req);

    if (!user || !hasPermission(user, "students")) {
      return res.status(403).json({
        error: "ليس لديك صلاحية"
      });
    }

    const {
      student_number,
      name,
      class_name,
      birth_date,
      parent_phone,
      photo
    } = req.body || {};

    if (!name) {
      return res.status(400).json({
        error: "اسم الطالب مطلوب"
      });
    }

    const result = db.prepare(`
      INSERT INTO students
      (
        school_id,
        student_number,
        name,
        class_name,
        birth_date,
        parent_phone,
        photo,
        status,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'حاضر', ?)
    `).run(
      user.school_id,
      student_number || "",
      name,
      class_name || "",
      birth_date || "",
      parent_phone || "",
      photo || "",
      nowISO()
    );

    logAction(
      user.id,
      "ADD_STUDENT",
      name,
      user.school_id
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر إضافة الطالب"
    });
  }
});

app.delete("/api/students/:id", (req, res) => {
  try {
    const user = getUser(req);

    if (!user || !hasPermission(user, "students")) {
      return res.status(403).json({
        error: "ليس لديك صلاحية"
      });
    }

    const student = db.prepare(`
      SELECT *
      FROM students
      WHERE id = ?
    `).get(req.params.id);

    if (
      !student ||
      !sameSchool(user, student.school_id)
    ) {
      return res.status(404).json({
        error: "الطالب غير موجود"
      });
    }

    db.prepare(`
      DELETE FROM students
      WHERE id = ?
    `).run(student.id);

    res.json({
      success: true
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر حذف الطالب"
    });
  }
});

/* =========================================================
   الحضور
========================================================= */

app.post("/api/attendance", (req, res) => {
  try {
    const user = getUser(req);

    if (!user || !hasPermission(user, "attendance")) {
      return res.status(403).json({
        error: "ليس لديك صلاحية"
      });
    }

    const {
      student_id,
      date,
      status,
      check_in
    } = req.body || {};

    const student = db.prepare(`
      SELECT *
      FROM students
      WHERE id = ?
    `).get(student_id);

    if (
      !student ||
      !sameSchool(user, student.school_id)
    ) {
      return res.status(404).json({
        error: "الطالب غير موجود"
      });
    }

    if (!status) {
      return res.status(400).json({
        error: "حالة الحضور مطلوبة"
      });
    }

    db.prepare(`
      INSERT INTO student_attendance
      (
        school_id,
        student_id,
        date,
        status,
        check_in,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(student_id, date)
      DO UPDATE SET
        status = excluded.status,
        check_in = excluded.check_in
    `).run(
      student.school_id,
      student.id,
      date || today(),
      status,
      check_in || "",
      nowISO()
    );

    res.json({
      success: true
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر حفظ الحضور"
    });
  }
});

app.get("/api/attendance", (req, res) => {
  try {
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({
        error: "يجب تسجيل الدخول"
      });
    }

    const date =
      req.query.date || today();

    const rows = db.prepare(`
      SELECT
        a.*,
        s.name AS student_name,
        s.student_number,
        s.class_name
      FROM student_attendance a
      LEFT JOIN students s
        ON s.id = a.student_id
      WHERE a.school_id = ?
      AND a.date = ?
      ORDER BY a.id DESC
    `).all(
      user.school_id,
      date
    );

    res.json(rows);

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب الحضور"
    });
  }
});

/* =========================================================
   الموظفون
========================================================= */

app.get("/api/employees", (req, res) => {
  try {
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({
        error: "يجب تسجيل الدخول"
      });
    }

    const employees = db.prepare(`
      SELECT *
      FROM employees
      WHERE school_id = ?
      ORDER BY id DESC
    `).all(user.school_id);

    res.json({
      employees
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب الموظفين"
    });
  }
});

app.post("/api/employees", (req, res) => {
  try {
    const user = getUser(req);

    if (!user || !hasPermission(user, "employees")) {
      return res.status(403).json({
        error: "ليس لديك صلاحية"
      });
    }

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
        school_id,
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      user.school_id,
      user_id || null,
      employee_number || "",
      name,
      job_title || "",
      department || "",
      phone || "",
      hire_date || "",
      safeNumber(basic_salary),
      safeNumber(allowance),
      nowISO()
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر إضافة الموظف"
    });
  }
});

/* =========================================================
   المكافآت
========================================================= */

app.get("/api/employees/:id/bonuses", (req, res) => {
  try {
    const user = getUser(req);

    const employee = db.prepare(`
      SELECT *
      FROM employees
      WHERE id = ?
    `).get(req.params.id);

    if (
      !user ||
      !employee ||
      !sameSchool(user, employee.school_id)
    ) {
      return res.status(404).json({
        error: "الموظف غير موجود"
      });
    }

    const bonuses = db.prepare(`
      SELECT *
      FROM bonuses
      WHERE employee_id = ?
      ORDER BY date DESC, id DESC
    `).all(employee.id);

    res.json(bonuses);

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب المكافآت"
    });
  }
});

app.post("/api/employees/:id/bonuses", (req, res) => {
  try {
    const user = getUser(req);

    if (!user || !hasPermission(user, "payroll")) {
      return res.status(403).json({
        error: "ليس لديك صلاحية"
      });
    }

    const employee = db.prepare(`
      SELECT *
      FROM employees
      WHERE id = ?
    `).get(req.params.id);

    if (
      !employee ||
      !sameSchool(user, employee.school_id)
    ) {
      return res.status(404).json({
        error: "الموظف غير موجود"
      });
    }

    const {
      amount,
      reason,
      month
    } = req.body || {};

    if (
      safeNumber(amount) <= 0 ||
      !reason
    ) {
      return res.status(400).json({
        error: "قيمة المكافأة والسبب مطلوبان"
      });
    }

    const result = db.prepare(`
      INSERT INTO bonuses
      (
        school_id,
        employee_id,
        amount,
        reason,
        date,
        month,
        created_by,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      employee.school_id,
      employee.id,
      safeNumber(amount),
      reason,
      today(),
      month || currentMonth(),
      user.id,
      nowISO()
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر إضافة المكافأة"
    });
  }
});

app.delete("/api/bonuses/:id", (req, res) => {
  try {
    const user = getUser(req);

    if (!user || !hasPermission(user, "payroll")) {
      return res.status(403).json({
        error: "ليس لديك صلاحية"
      });
    }

    const bonus = db.prepare(`
      SELECT *
      FROM bonuses
      WHERE id = ?
    `).get(req.params.id);

    if (
      !bonus ||
      !sameSchool(user, bonus.school_id)
    ) {
      return res.status(404).json({
        error: "المكافأة غير موجودة"
      });
    }

    db.prepare(`
      DELETE FROM bonuses
      WHERE id = ?
    `).run(bonus.id);

    res.json({
      success: true
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر حذف المكافأة"
    });
  }
});

/* =========================================================
   الرواتب
========================================================= */

app.get("/api/employees/:id/payroll", (req, res) => {
  try {
    const user = getUser(req);

    if (!user || !hasPermission(user, "payroll")) {
      return res.status(403).json({
        error: "ليس لديك صلاحية"
      });
    }

    const employee = db.prepare(`
      SELECT *
      FROM employees
      WHERE id = ?
    `).get(req.params.id);

    if (
      !employee ||
      !sameSchool(user, employee.school_id)
    ) {
      return res.status(404).json({
        error: "الموظف غير موجود"
      });
    }

    const month =
      req.query.month || currentMonth();

    const bonuses = safeNumber(
      db.prepare(`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM bonuses
        WHERE employee_id = ?
        AND month = ?
      `).get(employee.id, month).total
    );

    const deductions = safeNumber(
      db.prepare(`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM deductions
        WHERE employee_id = ?
        AND month = ?
      `).get(employee.id, month).total
    );

    const basicSalary =
      safeNumber(employee.basic_salary);

    const allowance =
      safeNumber(employee.allowance);

    const gross =
      basicSalary +
      allowance +
      bonuses;

    const net =
      gross -
      deductions;

    res.json({
      month,
      employee,
      basic_salary: basicSalary,
      allowance,
      bonuses,
      deductions,
      gross,
      net
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر حساب الراتب"
    });
  }
});

/* =========================================================
   إعدادات الرواتب
========================================================= */

app.get("/api/payroll-settings", (req, res) => {
  try {
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({
        error: "يجب تسجيل الدخول"
      });
    }

    let settings = db.prepare(`
      SELECT *
      FROM payroll_settings
      WHERE school_id = ?
    `).get(user.school_id);

    if (!settings) {
      db.prepare(`
        INSERT INTO payroll_settings
        (
          school_id,
          absence_deduction,
          late_deduction,
          allowed_late_minutes
        )
        VALUES (?, 300, 50, 15)
      `).run(user.school_id);

      settings = db.prepare(`
        SELECT *
        FROM payroll_settings
        WHERE school_id = ?
      `).get(user.school_id);
    }

    res.json(settings);

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب إعدادات الرواتب"
    });
  }
});

app.patch("/api/payroll-settings", (req, res) => {
  try {
    const user = getUser(req);

    if (!user || !hasPermission(user, "payroll")) {
      return res.status(403).json({
        error: "ليس لديك صلاحية"
      });
    }

    db.prepare(`
      INSERT INTO payroll_settings
      (
        school_id,
        absence_deduction,
        late_deduction,
        allowed_late_minutes
      )
      VALUES (?, ?, ?, ?)
      ON CONFLICT(school_id)
      DO UPDATE SET
        absence_deduction = excluded.absence_deduction,
        late_deduction = excluded.late_deduction,
        allowed_late_minutes = excluded.allowed_late_minutes
    `).run(
      user.school_id,
      safeNumber(req.body?.absence_deduction, 300),
      safeNumber(req.body?.late_deduction, 50),
      safeNumber(req.body?.allowed_late_minutes, 15)
    );

    res.json({
      success: true,
      message: "تم تحديث إعدادات الرواتب"
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر تحديث إعدادات الرواتب"
    });
  }
});

/* =========================================================
   الملاحظات
========================================================= */

app.post("/api/notes", (req, res) => {
  try {
    const user = getUser(req);

    if (!user || !hasPermission(user, "notes")) {
      return res.status(403).json({
        error: "ليس لديك صلاحية"
      });
    }

    const {
      student_id,
      text,
      type,
      attachment
    } = req.body || {};

    const student = db.prepare(`
      SELECT *
      FROM students
      WHERE id = ?
    `).get(student_id);

    if (
      !student ||
      !sameSchool(user, student.school_id)
    ) {
      return res.status(404).json({
        error: "الطالب غير موجود"
      });
    }

    if (!text) {
      return res.status(400).json({
        error: "الملاحظة مطلوبة"
      });
    }

    const result = db.prepare(`
      INSERT INTO notes
      (
        school_id,
        student_id,
        user_id,
        type,
        text,
        attachment,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      student.school_id,
      student.id,
      user.id,
      type || "عام",
      text,
      attachment || "",
      nowISO()
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر حفظ الملاحظة"
    });
  }
});

app.get("/api/notes/:studentId", (req, res) => {
  try {
    const user = getUser(req);

    const student = db.prepare(`
      SELECT *
      FROM students
      WHERE id = ?
    `).get(req.params.studentId);

    if (
      !user ||
      !student ||
      !sameSchool(user, student.school_id)
    ) {
      return res.status(404).json({
        error: "الطالب غير موجود"
      });
    }

    const notes = db.prepare(`
      SELECT
        n.*,
        u.name AS user_name
      FROM notes n
      LEFT JOIN users u
        ON u.id = n.user_id
      WHERE n.student_id = ?
      ORDER BY n.id DESC
    `).all(student.id);

    res.json(notes);

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب الملاحظات"
    });
  }
});

/* =========================================================
   الفيديوهات
========================================================= */

app.post("/api/videos", (req, res) => {
  try {
    const user = getUser(req);

    if (!user || !hasPermission(user, "videos")) {
      return res.status(403).json({
        error: "ليس لديك صلاحية"
      });
    }

    const {
      title,
      subject,
      teacher_id,
      class_name,
      file_name,
      video_url,
      pdf_url,
      homework
    } = req.body || {};

    if (!title) {
      return res.status(400).json({
        error: "اسم الحصة مطلوب"
      });
    }

    const result = db.prepare(`
      INSERT INTO videos
      (
        school_id,
        title,
        subject,
        teacher_id,
        class_name,
        file_name,
        video_url,
        pdf_url,
        homework,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.school_id,
      title,
      subject || "",
      teacher_id || user.id,
      class_name || "",
      file_name || "",
      video_url || "",
      pdf_url || "",
      homework || "",
      nowISO()
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر حفظ الحصة"
    });
  }
});

app.get("/api/videos", (req, res) => {
  try {
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({
        error: "يجب تسجيل الدخول"
      });
    }

    const videos = db.prepare(`
      SELECT
        v.*,
        u.name AS teacher_name
      FROM videos v
      LEFT JOIN users u
        ON u.id = v.teacher_id
      WHERE v.school_id = ?
      ORDER BY v.id DESC
    `).all(user.school_id);

    res.json(videos);

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب الحصص"
    });
  }
});

/* =========================================================
   التعاميم
========================================================= */

app.get("/api/announcements", (req, res) => {
  try {
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({
        error: "يجب تسجيل الدخول"
      });
    }

    const announcements = db.prepare(`
      SELECT
        a.*,
        u.name AS creator_name
      FROM announcements a
      LEFT JOIN users u
        ON u.id = a.created_by
      WHERE a.school_id = ?
      AND (
        a.target_role = 'all'
        OR a.target_role = ?
      )
      ORDER BY a.id DESC
    `).all(
      user.school_id,
      user.role
    );

    res.json(announcements);

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب التعاميم"
    });
  }
});

app.post("/api/announcements", (req, res) => {
  try {
    const user = getUser(req);

    if (
      !user ||
      !hasPermission(user, "announcements")
    ) {
      return res.status(403).json({
        error: "ليس لديك صلاحية"
      });
    }

    const {
      title,
      message,
      target_role
    } = req.body || {};

    if (!title || !message) {
      return res.status(400).json({
        error: "العنوان والرسالة مطلوبان"
      });
    }

    const result = db.prepare(`
      INSERT INTO announcements
      (
        school_id,
        title,
        message,
        created_by,
        target_role,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      user.school_id,
      title,
      message,
      user.id,
      target_role || "all",
      nowISO()
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر نشر التعميم"
    });
  }
});

/* =========================================================
   الطلبات
========================================================= */

app.get("/api/requests", (req, res) => {
  try {
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({
        error: "يجب تسجيل الدخول"
      });
    }

    let requests;

    if (
      ["owner", "admin", "hr"].includes(user.role)
    ) {
      requests = db.prepare(`
        SELECT
          r.*,
          u.name AS user_name,
          u.username,
          a.name AS approved_by_name
        FROM requests r
        LEFT JOIN users u
          ON u.id = r.user_id
        LEFT JOIN users a
          ON a.id = r.approved_by
        WHERE r.school_id = ?
        ORDER BY r.id DESC
      `).all(user.school_id);
    } else {
      requests = db.prepare(`
        SELECT *
        FROM requests
        WHERE school_id = ?
        AND user_id = ?
        ORDER BY id DESC
      `).all(
        user.school_id,
        user.id
      );
    }

    res.json(requests);

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب الطلبات"
    });
  }
});

app.post("/api/requests", (req, res) => {
  try {
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({
        error: "يجب تسجيل الدخول"
      });
    }

    const {
      type,
      title,
      description,
      amount
    } = req.body || {};

    if (!type) {
      return res.status(400).json({
        error: "نوع الطلب مطلوب"
      });
    }

    const result = db.prepare(`
      INSERT INTO requests
      (
        school_id,
        user_id,
        type,
        title,
        description,
        amount,
        status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      user.school_id,
      user.id,
      type,
      title || "",
      description || "",
      safeNumber(amount),
      nowISO(),
      nowISO()
    );

    res.json({
      success: true,
      id: result.lastInsertRowid,
      message: "تم إرسال الطلب"
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر إرسال الطلب"
    });
  }
});

app.patch("/api/requests/:id/status", (req, res) => {
  try {
    const user = getUser(req);

    if (
      !user ||
      !["owner", "admin", "hr"].includes(user.role)
    ) {
      return res.status(403).json({
        error: "ليس لديك صلاحية"
      });
    }

    const request = db.prepare(`
      SELECT *
      FROM requests
      WHERE id = ?
    `).get(req.params.id);

    if (
      !request ||
      !sameSchool(user, request.school_id)
    ) {
      return res.status(404).json({
        error: "الطلب غير موجود"
      });
    }

    const status =
      ["approved", "rejected", "pending"]
        .includes(req.body?.status)
        ? req.body.status
        : "pending";

    db.prepare(`
      UPDATE requests
      SET
        status = ?,
        manager_note = ?,
        approved_by = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      status,
      req.body?.manager_note || "",
      user.id,
      nowISO(),
      request.id
    );

    res.json({
      success: true,
      status
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر تحديث الطلب"
    });
  }
});

/* =========================================================
   الرسائل
========================================================= */

app.get("/api/messages", (req, res) => {
  try {
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({
        error: "يجب تسجيل الدخول"
      });
    }

    const messages = db.prepare(`
      SELECT
        m.*,
        s.name AS sender_name,
        r.name AS receiver_name
      FROM messages m
      LEFT JOIN users s
        ON s.id = m.sender_id
      LEFT JOIN users r
        ON r.id = m.receiver_id
      WHERE m.school_id = ?
      AND (
        m.sender_id = ?
        OR m.receiver_id = ?
      )
      ORDER BY m.id DESC
    `).all(
      user.school_id,
      user.id,
      user.id
    );

    res.json(messages);

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب الرسائل"
    });
  }
});

app.post("/api/messages", (req, res) => {
  try {
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({
        error: "يجب تسجيل الدخول"
      });
    }

    const {
      receiver_id,
      subject,
      message
    } = req.body || {};

    if (!receiver_id || !message) {
      return res.status(400).json({
        error: "المستلم والرسالة مطلوبان"
      });
    }

    const receiver = db.prepare(`
      SELECT *
      FROM users
      WHERE id = ?
    `).get(receiver_id);

    if (
      !receiver ||
      !sameSchool(user, receiver.school_id)
    ) {
      return res.status(404).json({
        error: "المستخدم غير موجود"
      });
    }

    const result = db.prepare(`
      INSERT INTO messages
      (
        school_id,
        sender_id,
        receiver_id,
        subject,
        message,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      user.school_id,
      user.id,
      receiver.id,
      subject || "",
      message,
      nowISO()
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر إرسال الرسالة"
    });
  }
});

app.patch("/api/messages/:id/read", (req, res) => {
  try {
    const user = getUser(req);

    const message = db.prepare(`
      SELECT *
      FROM messages
      WHERE id = ?
    `).get(req.params.id);

    if (
      !user ||
      !message ||
      message.receiver_id !== user.id
    ) {
      return res.status(404).json({
        error: "الرسالة غير موجودة"
      });
    }

    db.prepare(`
      UPDATE messages
      SET read_at = ?
      WHERE id = ?
    `).run(
      nowISO(),
      message.id
    );

    res.json({
      success: true
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر تحديث الرسالة"
    });
  }
});

/* =========================================================
   لوحة التحكم
========================================================= */

app.get("/api/dashboard", (req, res) => {
  try {
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({
        error: "يجب تسجيل الدخول"
      });
    }

    if (user.role === "owner") {
      const schools = db.prepare(`
        SELECT COUNT(*) AS count
        FROM schools
      `).get().count;

      const users = db.prepare(`
        SELECT COUNT(*) AS count
        FROM users
      `).get().count;

      const students = db.prepare(`
        SELECT COUNT(*) AS count
        FROM students
      `).get().count;

      const online = db.prepare(`
        SELECT COUNT(*) AS count
        FROM users
        WHERE active = 1
        AND last_seen IS NOT NULL
        AND datetime(last_seen)
          >= datetime('now', '-1 minute')
      `).get().count;

      return res.json({
        role: "owner",
        schools,
        users,
        students,
        online_users: online
      });
    }

    const schoolId = user.school_id;

    const students = db.prepare(`
      SELECT COUNT(*) AS count
      FROM students
      WHERE school_id = ?
    `).get(schoolId).count;

    const employees = db.prepare(`
      SELECT COUNT(*) AS count
      FROM employees
      WHERE school_id = ?
    `).get(schoolId).count;

    const users = db.prepare(`
      SELECT COUNT(*) AS count
      FROM users
      WHERE school_id = ?
    `).get(schoolId).count;

    const onlineUsers = db.prepare(`
      SELECT COUNT(*) AS count
      FROM users
      WHERE school_id = ?
      AND active = 1
      AND last_seen IS NOT NULL
      AND datetime(last_seen)
        >= datetime('now', '-1 minute')
    `).get(schoolId).count;

    const attendance = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(
          CASE
            WHEN status = 'حاضر'
            THEN 1 ELSE 0
          END
        ) AS present,
        SUM(
          CASE
            WHEN status = 'غائب'
            THEN 1 ELSE 0
          END
        ) AS absent,
        SUM(
          CASE
            WHEN status = 'متأخر'
            THEN 1 ELSE 0
          END
        ) AS late
      FROM student_attendance
      WHERE school_id = ?
      AND date = ?
    `).get(
      schoolId,
      today()
    );

    const pendingRequests = db.prepare(`
      SELECT COUNT(*) AS count
      FROM requests
      WHERE school_id = ?
      AND status = 'pending'
    `).get(schoolId).count;

    const unreadMessages = db.prepare(`
      SELECT COUNT(*) AS count
      FROM messages
      WHERE school_id = ?
      AND receiver_id = ?
      AND read_at IS NULL
    `).get(
      schoolId,
      user.id
    ).count;

    res.json({
      role: user.role,
      school_id: schoolId,
      students,
      employees,
      users,
      online_users: onlineUsers,

      attendance: {
        total: attendance.total || 0,
        present: attendance.present || 0,
        absent: attendance.absent || 0,
        late: attendance.late || 0
      },

      pending_requests: pendingRequests,
      unread_messages: unreadMessages
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر تحميل لوحة التحكم"
    });
  }
});

/* =========================================================
   سجل العمليات
========================================================= */

app.get("/api/audit-logs", (req, res) => {
  try {
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({
        error: "يجب تسجيل الدخول"
      });
    }

    let logs;

    if (user.role === "owner") {
      logs = db.prepare(`
        SELECT
          a.*,
          u.name AS user_name,
          u.username,
          s.name AS school_name
        FROM audit_logs a
        LEFT JOIN users u
          ON u.id = a.user_id
        LEFT JOIN schools s
          ON s.id = a.school_id
        ORDER BY a.id DESC
        LIMIT 500
      `).all();
    } else {
      logs = db.prepare(`
        SELECT
          a.*,
          u.name AS user_name,
          u.username
        FROM audit_logs a
        LEFT JOIN users u
          ON u.id = a.user_id
        WHERE a.school_id = ?
        ORDER BY a.id DESC
        LIMIT 500
      `).all(user.school_id);
    }

    res.json(logs);

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب سجل العمليات"
    });
  }
});

/* =========================================================
   تقرير الحضور
========================================================= */

app.get("/api/reports/attendance", (req, res) => {
  try {
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({
        error: "يجب تسجيل الدخول"
      });
    }

    const schoolId =
      user.role === "owner"
        ? req.query.school_id
        : user.school_id;

    if (!schoolId) {
      return res.status(400).json({
        error: "حدد المدرسة"
      });
    }

    const rows = db.prepare(`
      SELECT
        date,
        COUNT(*) AS total,
        SUM(
          CASE
            WHEN status = 'حاضر'
            THEN 1 ELSE 0
          END
        ) AS present,
        SUM(
          CASE
            WHEN status = 'غائب'
            THEN 1 ELSE 0
          END
        ) AS absent,
        SUM(
          CASE
            WHEN status = 'متأخر'
            THEN 1 ELSE 0
          END
        ) AS late
      FROM student_attendance
      WHERE school_id = ?
      GROUP BY date
      ORDER BY date DESC
      LIMIT 90
    `).all(schoolId);

    res.json(rows);

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب التقرير"
    });
  }
});

/* =========================================================
   Health
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "School portal is running",
    version: "3.0.0",
    time: nowISO()
  });
});

/* =========================================================
   الصفحة الرئيسية
========================================================= */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

/* =========================================================
   أي مسار غير API
========================================================= */

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }

  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

/* =========================================================
   معالجة الأخطاء
========================================================= */

app.use((err, req, res, next) => {
  console.error(
    "EXPRESS ERROR:",
    err
  );

  res.status(500).json({
    error: "حدث خطأ داخلي في السيرفر"
  });
});

/* =========================================================
   تشغيل السيرفر
========================================================= */

const PORT =
  Number(process.env.PORT) || 3000;

const server = app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `School portal running on port ${PORT}`
    );
  }
);

server.on("error", error => {
  console.error(
    "SERVER ERROR:",
    error
  );
});

process.on(
  "uncaughtException",
  error => {
    console.error(
      "UNCAUGHT EXCEPTION:",
      error
    );
  }
);

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "UNHANDLED REJECTION:",
      error
    );
  }
);
