const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const db = new Database("school.db");

// =====================================================
// DATABASE
// =====================================================

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  job_title TEXT DEFAULT '',
  department TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  last_seen TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS note_reads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  read_at TEXT,
  UNIQUE(note_id, user_id)
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
  status TEXT DEFAULT 'حاضر',
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

CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  details TEXT DEFAULT '',
  amount REAL DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'قيد المراجعة',
  admin_note TEXT DEFAULT '',
  reviewed_by INTEGER,
  reviewed_at TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS institution_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  target_role TEXT DEFAULT 'all',
  created_by INTEGER,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS platform_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  school_name TEXT DEFAULT 'نظام إدارة المدرسة',
  logo_url TEXT DEFAULT '',
  primary_color TEXT DEFAULT '#173b70',
  secondary_color TEXT DEFAULT '#f4f7fb',
  welcome_text TEXT DEFAULT 'مرحباً بك في نظام إدارة المدرسة'
);

CREATE TABLE IF NOT EXISTS payroll_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  absence_deduction REAL DEFAULT 300,
  late_deduction REAL DEFAULT 50,
  allowed_late_minutes INTEGER DEFAULT 15
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  details TEXT DEFAULT '',
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  file_name TEXT DEFAULT '',
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
`);

// =====================================================
// MIGRATION FOR OLD DATABASES
// =====================================================

function addColumnIfMissing(table, column, definition) {
  try {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    const exists = columns.some(c => c.name === column);

    if (!exists) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  } catch (error) {
    console.error(`Migration error ${table}.${column}:`, error.message);
  }
}

addColumnIfMissing("users", "job_title", "TEXT DEFAULT ''");
addColumnIfMissing("users", "department", "TEXT DEFAULT ''");
addColumnIfMissing("users", "created_at", "TEXT");

addColumnIfMissing("students", "parent_user_id", "INTEGER");
addColumnIfMissing("students", "created_at", "TEXT");

addColumnIfMissing("notes", "created_by", "INTEGER");

addColumnIfMissing("requests", "amount", "REAL DEFAULT 0");
addColumnIfMissing("requests", "start_date", "TEXT");
addColumnIfMissing("requests", "end_date", "TEXT");
addColumnIfMissing("requests", "admin_note", "TEXT DEFAULT ''");
addColumnIfMissing("requests", "reviewed_by", "INTEGER");
addColumnIfMissing("requests", "reviewed_at", "TEXT");

// =====================================================
// HELPERS
// =====================================================

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
  try {
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
  } catch (error) {
    console.error("Audit error:", error.message);
  }
}

function getUser(id) {
  return db.prepare(`
    SELECT *
    FROM users
    WHERE id = ?
  `).get(id);
}

// =====================================================
// DEFAULT SETTINGS
// =====================================================

const settingsExists = db.prepare(`
  SELECT id FROM platform_settings WHERE id = 1
`).get();

if (!settingsExists) {
  db.prepare(`
    INSERT INTO platform_settings
    (id, school_name, logo_url, primary_color, secondary_color, welcome_text)
    VALUES
    (1, ?, '', '#173b70', '#f4f7fb', ?)
  `).run(
    "نظام إدارة المدرسة",
    "مرحباً بك في نظام إدارة المدرسة"
  );
}

const payrollExists = db.prepare(`
  SELECT id FROM payroll_settings WHERE id = 1
`).get();

if (!payrollExists) {
  db.prepare(`
    INSERT INTO payroll_settings
    (id, absence_deduction, late_deduction, allowed_late_minutes)
    VALUES (1, 300, 50, 15)
  `).run();
}

// =====================================================
// DEFAULT ADMIN ONLY
// =====================================================

const userCount = db.prepare(`
  SELECT COUNT(*) AS count FROM users
`).get().count;

if (userCount === 0) {
  db.prepare(`
    INSERT INTO users
    (username, password, name, role, job_title, department, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    "admin",
    "1234",
    "مدير المؤسسة",
    "admin",
    "مدير المؤسسة",
    "الإدارة",
    nowISO()
  );
}

// =====================================================
// LOGIN
// =====================================================

app.post("/api/login", (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        error: "أدخل اسم المستخدم وكلمة المرور"
      });
    }

    const user = db.prepare(`
      SELECT
        id,
        username,
        name,
        role,
        job_title,
        department,
        active,
        last_seen
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

    const time = nowISO();

    db.prepare(`
      UPDATE users
      SET last_seen = ?
      WHERE id = ?
    `).run(time, user.id);

    user.last_seen = time;

    logAction(
      user.id,
      "LOGIN",
      `تسجيل دخول ${user.name}`
    );

    res.json(user);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "حدث خطأ أثناء تسجيل الدخول"
    });
  }
});

// =====================================================
// USER ACTIVITY
// =====================================================

app.post("/api/activity", (req, res) => {
  try {
    const { user_id } = req.body || {};

    if (!user_id) {
      return res.status(400).json({
        error: "user_id مطلوب"
      });
    }

    const user = getUser(user_id);

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

// =====================================================
// USERS
// =====================================================

app.get("/api/users", (req, res) => {
  try {
    const users = db.prepare(`
      SELECT
        id,
        username,
        name,
        role,
        job_title,
        department,
        active,
        last_seen,
        created_at
      FROM users
      ORDER BY id DESC
    `).all();

    const currentTime = Date.now();

    const result = users.map(user => {
      let online = false;

      if (user.last_seen) {
        const last = new Date(user.last_seen).getTime();

        online =
          user.active === 1 &&
          currentTime - last <= 60000;
      }

      return {
        ...user,
        online
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

// =====================================================
// ADD USER
// =====================================================

app.post("/api/users", (req, res) => {
  try {
    const {
      username,
      password,
      name,
      role,
      job_title,
      department
    } = req.body || {};

    if (!username || !password || !name) {
      return res.status(400).json({
        error: "اسم المستخدم وكلمة المرور والاسم مطلوبة"
      });
    }

    const allowedRoles = [
      "admin",
      "teacher",
      "student",
      "parent",
      "hr",
      "accountant",
      "worker",
      "reviewer",
      "employee"
    ];

    const finalRole = role || "employee";

    if (!allowedRoles.includes(finalRole)) {
      return res.status(400).json({
        error: "نوع المستخدم غير صحيح"
      });
    }

    const result = db.prepare(`
      INSERT INTO users
      (username, password, name, role, job_title, department, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      username,
      password,
      name,
      finalRole,
      job_title || "",
      department || "",
      nowISO()
    );

    logAction(
      null,
      "ADD_USER",
      `إضافة المستخدم ${name}`
    );

    res.json({
      success: true,
      id: result.lastInsertRowid,
      message: "تم إنشاء المستخدم بنجاح"
    });

  } catch (error) {
    console.error(error);

    if (String(error.message).includes("UNIQUE")) {
      return res.status(400).json({
        error: "اسم المستخدم موجود بالفعل"
      });
    }

    res.status(500).json({
      error: "تعذر إنشاء المستخدم"
    });
  }
});

// =====================================================
// UPDATE USER PROFILE
// =====================================================

app.patch("/api/users/:id", (req, res) => {
  try {
    const user = getUser(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: "المستخدم غير موجود"
      });
    }

    const {
      name,
      role,
      job_title,
      department,
      username
    } = req.body || {};

    if (username && username !== user.username) {
      const duplicate = db.prepare(`
        SELECT id
        FROM users
        WHERE username = ?
        AND id != ?
      `).get(username, user.id);

      if (duplicate) {
        return res.status(400).json({
          error: "اسم المستخدم مستخدم بالفعل"
        });
      }
    }

    db.prepare(`
      UPDATE users
      SET
        username = ?,
        name = ?,
        role = ?,
        job_title = ?,
        department = ?
      WHERE id = ?
    `).run(
      username || user.username,
      name || user.name,
      role || user.role,
      job_title ?? user.job_title,
      department ?? user.department,
      user.id
    );

    logAction(
      null,
      "UPDATE_USER",
      `تعديل المستخدم ${user.name}`
    );

    res.json({
      success: true,
      message: "تم تحديث بيانات المستخدم"
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر تحديث المستخدم"
    });
  }
});

// =====================================================
// DISABLE USER
// =====================================================

app.patch("/api/users/:id/disable", (req, res) => {
  try {
    const user = getUser(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: "المستخدم غير موجود"
      });
    }

    if (user.username === "admin") {
      return res.status(400).json({
        error: "لا يمكن إيقاف المدير الرئيسي"
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
      `إيقاف ${user.name}`
    );

    res.json({
      success: true,
      message: "تم إيقاف المستخدم"
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر إيقاف المستخدم"
    });
  }
});

// =====================================================
// ENABLE USER
// =====================================================

app.patch("/api/users/:id/enable", (req, res) => {
  try {
    const user = getUser(req.params.id);

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
      `تفعيل ${user.name}`
    );

    res.json({
      success: true,
      message: "تم تفعيل المستخدم"
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر تفعيل المستخدم"
    });
  }
});

// =====================================================
// CHANGE PASSWORD
// =====================================================

app.patch("/api/users/:id/password", (req, res) => {
  try {
    const {
      current_password,
      new_password
    } = req.body || {};

    const user = getUser(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: "المستخدم غير موجود"
      });
    }

    if (!new_password || String(new_password).length < 4) {
      return res.status(400).json({
        error: "كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل"
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
      `تغيير كلمة مرور ${user.name}`
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

// =====================================================
// DELETE USER
// =====================================================

app.delete("/api/users/:id", (req, res) => {
  try {
    const user = getUser(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: "المستخدم غير موجود"
      });
    }

    if (user.username === "admin") {
      return res.status(400).json({
        error: "لا يمكن حذف المدير الرئيسي"
      });
    }

    db.prepare(`
      DELETE FROM users
      WHERE id = ?
    `).run(user.id);

    logAction(
      null,
      "DELETE_USER",
      `حذف ${user.name}`
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

// =====================================================
// STUDENTS
// =====================================================

app.get("/api/students", (req, res) => {
  try {
    const students = db.prepare(`
      SELECT *
      FROM students
      ORDER BY id DESC
    `).all();

    res.json(students);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب الطلاب"
    });
  }
});

// =====================================================
// ADD STUDENT
// =====================================================

app.post("/api/students", (req, res) => {
  try {
    const {
      name,
      class_name,
      parent_phone,
      parent_user_id
    } = req.body || {};

    if (!name) {
      return res.status(400).json({
        error: "اسم الطالب مطلوب"
      });
    }

    const result = db.prepare(`
      INSERT INTO students
      (name, class_name, parent_phone, parent_user_id, status, created_at)
      VALUES (?, ?, ?, ?, 'حاضر', ?)
    `).run(
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

// =====================================================
// STUDENT STATUS
// =====================================================

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

// =====================================================
// STUDENT ATTENDANCE
// =====================================================

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

    const percentage =
      total
        ? Math.round((present / total) * 100)
        : 0;

    res.json({
      records,
      present,
      absent,
      total,
      percentage
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب الحضور"
    });
  }
});

// =====================================================
// NOTES
// =====================================================

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
      (student_id, text, created_by, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      student_id,
      text,
      created_by || null,
      nowISO()
    );

    logAction(
      created_by || null,
      "ADD_NOTE",
      `ملاحظة للطالب ${student.name}`
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر حفظ الملاحظة"
    });
  }
});

// =====================================================
// GET NOTES + READ STATUS
// =====================================================

app.get("/api/notes/:studentId", (req, res) => {
  try {
    const userId = Number(req.query.user_id || 0);

    const notes = db.prepare(`
      SELECT
        n.id,
        n.student_id,
        n.text,
        n.created_by,
        n.created_at,
        u.name AS created_by_name
      FROM notes n
      LEFT JOIN users u
        ON u.id = n.created_by
      WHERE n.student_id = ?
      ORDER BY n.id DESC
    `).all(req.params.studentId);

    const result = notes.map(note => {
      let read = false;
      let read_at = null;

      if (userId) {
        const readRecord = db.prepare(`
          SELECT read_at
          FROM note_reads
          WHERE note_id = ?
          AND user_id = ?
        `).get(
          note.id,
          userId
        );

        if (readRecord) {
          read = true;
          read_at = readRecord.read_at;
        }
      }

      const totalReads = db.prepare(`
        SELECT COUNT(*) AS count
        FROM note_reads
        WHERE note_id = ?
      `).get(note.id).count;

      return {
        ...note,
        read,
        read_at,
        total_reads: totalReads
      };
    });

    res.json(result);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب الملاحظات"
    });
  }
});

// =====================================================
// MARK NOTE AS READ
// =====================================================

app.post("/api/notes/:id/read", (req, res) => {
  try {
    const {
      user_id
    } = req.body || {};

    if (!user_id) {
      return res.status(400).json({
        error: "user_id مطلوب"
      });
    }

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
      INSERT INTO note_reads
      (note_id, user_id, read_at)
      VALUES (?, ?, ?)
      ON CONFLICT(note_id, user_id)
      DO UPDATE SET
        read_at = excluded.read_at
    `).run(
      note.id,
      user_id,
      nowISO()
    );

    res.json({
      success: true,
      read: true,
      read_at: nowISO()
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر تسجيل قراءة الملاحظة"
    });
  }
});

// =====================================================
// NOTE READERS
// =====================================================

app.get("/api/notes/:id/readers", (req, res) => {
  try {
    const readers = db.prepare(`
      SELECT
        nr.id,
        nr.user_id,
        nr.read_at,
        u.name,
        u.role,
        u.job_title
      FROM note_reads nr
      LEFT JOIN users u
        ON u.id = nr.user_id
      WHERE nr.note_id = ?
      ORDER BY nr.read_at DESC
    `).all(req.params.id);

    res.json(readers);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب من شاهد الملاحظة"
    });
  }
});

// =====================================================
// DELETE NOTE
// =====================================================

app.delete("/api/notes/:id", (req, res) => {
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
      DELETE FROM note_reads
      WHERE note_id = ?
    `).run(note.id);

    db.prepare(`
      DELETE FROM notes
      WHERE id = ?
    `).run(note.id);

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

// =====================================================
// EMPLOYEES
// =====================================================

app.get("/api/employees", (req, res) => {
  try {
    const employees = db.prepare(`
      SELECT
        e.*,
        u.username,
        u.role,
        u.job_title AS account_job_title,
        u.department AS account_department,
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

// =====================================================
// ADD EMPLOYEE
// =====================================================

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
      Number(basic_salary || 0),
      Number(allowance || 0),
      nowISO()
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });

  } catch (error) {
    console.error(error);

    res.status(400).json({
      error: "تعذر إضافة الموظف"
    });
  }
});

// =====================================================
// EMPLOYEE ATTENDANCE
// =====================================================

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
      const parts = String(check_in)
        .split(":")
        .map(Number);

      const hour = parts[0] || 0;
      const minute = parts[1] || 0;

      const arrival =
        hour * 60 + minute;

      const workStart = 8 * 60;

      lateMinutes =
        Math.max(
          0,
          arrival - workStart
        );

      if (
        lateMinutes >
        Number(settings.allowed_late_minutes || 0)
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

// =====================================================
// EMPLOYEE ATTENDANCE HISTORY
// =====================================================

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
        x => x.status === "حاضر" ||
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
      error: "تعذر جلب الحضور"
    });
  }
});

// =====================================================
// REQUESTS
// =====================================================

// إنشاء طلب:
// إجازة / سلفة / شكوى / اقتراح / طلب إداري / أخرى

app.post("/api/requests", (req, res) => {
  try {
    const {
      user_id,
      type,
      title,
      details,
      amount,
      start_date,
      end_date
    } = req.body || {};

    if (!user_id || !type || !title) {
      return res.status(400).json({
        error: "المستخدم ونوع الطلب والعنوان مطلوبة"
      });
    }

    const user = getUser(user_id);

    if (!user) {
      return res.status(404).json({
        error: "المستخدم غير موجود"
      });
    }

    const result = db.prepare(`
      INSERT INTO requests
      (
        user_id,
        type,
        title,
        details,
        amount,
        start_date,
        end_date,
        status,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'قيد المراجعة', ?)
    `).run(
      user.id,
      type,
      title,
      details || "",
      Number(amount || 0),
      start_date || null,
      end_date || null,
      nowISO()
    );

    logAction(
      user.id,
      "CREATE_REQUEST",
      `${type}: ${title}`
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

// =====================================================
// GET ALL REQUESTS
// =====================================================

app.get("/api/requests", (req, res) => {
  try {
    const requests = db.prepare(`
      SELECT
        r.*,
        u.name AS requester_name,
        u.username,
        u.role,
        u.job_title,
        u.department,
        reviewer.name AS reviewer_name
      FROM requests r
      LEFT JOIN users u
        ON u.id = r.user_id
      LEFT JOIN users reviewer
        ON reviewer.id = r.reviewed_by
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

// =====================================================
// USER REQUESTS
// =====================================================

app.get("/api/requests/user/:userId", (req, res) => {
  try {
    const requests = db.prepare(`
      SELECT *
      FROM requests
      WHERE user_id = ?
      ORDER BY id DESC
    `).all(req.params.userId);

    res.json(requests);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب طلبات المستخدم"
    });
  }
});

// =====================================================
// REVIEW REQUEST
// =====================================================

app.patch("/api/requests/:id", (req, res) => {
  try {
    const {
      status,
      admin_note,
      reviewed_by
    } = req.body || {};

    const allowedStatuses = [
      "قيد المراجعة",
      "مقبول",
      "مرفوض",
      "مكتمل"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "حالة الطلب غير صحيحة"
      });
    }

    const request = db.prepare(`
      SELECT *
      FROM requests
      WHERE id = ?
    `).get(req.params.id);

    if (!request) {
      return res.status(404).json({
        error: "الطلب غير موجود"
      });
    }

    db.prepare(`
      UPDATE requests
      SET
        status = ?,
        admin_note = ?,
        reviewed_by = ?,
        reviewed_at = ?
      WHERE id = ?
    `).run(
      status,
      admin_note || "",
      reviewed_by || null,
      nowISO(),
      request.id
    );

    logAction(
      reviewed_by || null,
      "REVIEW_REQUEST",
      `الطلب ${request.id}: ${status}`
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

// =====================================================
// INSTITUTION NOTES
// =====================================================

app.post("/api/institution-notes", (req, res) => {
  try {
    const {
      title,
      text,
      target_role,
      created_by
    } = req.body || {};

    if (!title || !text) {
      return res.status(400).json({
        error: "العنوان والنص مطلوبان"
      });
    }

    const result = db.prepare(`
      INSERT INTO institution_notes
      (
        title,
        text,
        target_role,
        created_by,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(
      title,
      text,
      target_role || "all",
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
      error: "تعذر حفظ الملاحظة"
    });
  }
});

// =====================================================
// GET INSTITUTION NOTES
// =====================================================

app.get("/api/institution-notes", (req, res) => {
  try {
    const role = req.query.role || "all";

    const notes = db.prepare(`
      SELECT
        n.*,
        u.name AS creator_name
      FROM institution_notes n
      LEFT JOIN users u
        ON u.id = n.created_by
      WHERE n.target_role = 'all'
      OR n.target_role = ?
      ORDER BY n.id DESC
    `).all(role);

    res.json(notes);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب ملاحظات المؤسسة"
    });
  }
});

// =====================================================
// DELETE INSTITUTION NOTE
// =====================================================

app.delete("/api/institution-notes/:id", (req, res) => {
  try {
    db.prepare(`
      DELETE FROM institution_notes
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

// =====================================================
// PLATFORM SETTINGS
// =====================================================

app.get("/api/settings", (req, res) => {
  try {
    const settings = db.prepare(`
      SELECT *
      FROM platform_settings
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
    const old = db.prepare(`
      SELECT *
      FROM platform_settings
      WHERE id = 1
    `).get();

    const {
      school_name,
      logo_url,
      primary_color,
      secondary_color,
      welcome_text
    } = req.body || {};

    db.prepare(`
      UPDATE platform_settings
      SET
        school_name = ?,
        logo_url = ?,
        primary_color = ?,
        secondary_color = ?,
        welcome_text = ?
      WHERE id = 1
    `).run(
      school_name ?? old.school_name,
      logo_url ?? old.logo_url,
      primary_color ?? old.primary_color,
      secondary_color ?? old.secondary_color,
      welcome_text ?? old.welcome_text
    );

    logAction(
      null,
      "UPDATE_PLATFORM_SETTINGS",
      "تعديل إعدادات المنصة"
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

// =====================================================
// PAYROLL SETTINGS
// =====================================================

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
      Number(absence_deduction || 0),
      Number(late_deduction || 0),
      Number(allowed_late_minutes || 0)
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

// =====================================================
// DEDUCTIONS
// =====================================================

app.get("/api/employees/:id/deductions", (req, res) => {
  try {
    const records = db.prepare(`
      SELECT *
      FROM deductions
      WHERE employee_id = ?
      ORDER BY id DESC
    `).all(req.params.id);

    res.json(records);

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

    if (!amount || Number(amount) <= 0 || !reason) {
      return res.status(400).json({
        error: "قيمة وسبب الخصم مطلوبان"
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
      Number(amount),
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

// =====================================================
// BONUSES
// =====================================================

app.get("/api/employees/:id/bonuses", (req, res) => {
  try {
    const records = db.prepare(`
      SELECT *
      FROM bonuses
      WHERE employee_id = ?
      ORDER BY id DESC
    `).all(req.params.id);

    res.json(records);

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

    if (!amount || Number(amount) <= 0 || !reason) {
      return res.status(400).json({
        error: "قيمة وسبب المكافأة مطلوبان"
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
      Number(amount),
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

// =====================================================
// PAYROLL
// =====================================================

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

    const basicSalary =
      Number(employee.basic_salary || 0);

    const allowance =
      Number(employee.allowance || 0);

    const totalBonuses =
      Number(bonuses || 0);

    const totalDeductions =
      Number(deductions || 0);

    const gross =
      basicSalary +
      allowance +
      totalBonuses;

    const net =
      gross -
      totalDeductions;

    res.json({
      month,
      employee,
      basic_salary: basicSalary,
      allowance,
      bonuses: totalBonuses,
      deductions: totalDeductions,
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

// =====================================================
// VIDEOS
// =====================================================

app.post("/api/videos", (req, res) => {
  try {
    const {
      title,
      file_name
    } = req.body || {};

    if (!title) {
      return res.status(400).json({
        error: "اسم الحصة مطلوب"
      });
    }

    const result = db.prepare(`
      INSERT INTO videos
      (title, file_name, created_at)
      VALUES (?, ?, ?)
    `).run(
      title,
      file_name || "",
      nowISO()
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر حفظ الفيديو"
    });
  }
});

app.get("/api/videos", (req, res) => {
  try {
    const videos = db.prepare(`
      SELECT *
      FROM videos
      ORDER BY id DESC
    `).all();

    res.json(videos);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب الفيديوهات"
    });
  }
});

// =====================================================
// AUDIT LOGS
// =====================================================

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

// =====================================================
// DASHBOARD
// =====================================================

app.get("/api/dashboard", (req, res) => {
  try {
    const users = db.prepare(`
      SELECT *
      FROM users
    `).all();

    const students = db.prepare(`
      SELECT COUNT(*) AS count
      FROM students
    `).get().count;

    const employees = db.prepare(`
      SELECT COUNT(*) AS count
      FROM employees
      WHERE active = 1
    `).get().count;

    const requests = db.prepare(`
      SELECT COUNT(*) AS count
      FROM requests
      WHERE status = 'قيد المراجعة'
    `).get().count;

    const currentTime = Date.now();

    const online = users.filter(user => {
      if (!user.last_seen || !user.active) {
        return false;
      }

      return (
        currentTime -
        new Date(user.last_seen).getTime()
      ) <= 60000;
    }).length;

    res.json({
      users: users.length,
      online_users: online,
      students,
      employees,
      pending_requests: requests
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر تحميل لوحة التحكم"
    });
  }
});

// =====================================================
// HEALTH
// =====================================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "School portal is running",
    time: nowISO()
  });
});

// =====================================================
// ROOT
// =====================================================

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

// =====================================================
// 404 API
// =====================================================

app.use("/api", (req, res) => {
  res.status(404).json({
    error: "API endpoint غير موجود"
  });
});

// =====================================================
// ERROR HANDLER
// =====================================================

app.use((error, req, res, next) => {
  console.error("SERVER ERROR:", error);

  res.status(500).json({
    error: "حدث خطأ داخلي في السيرفر"
  });
});

// =====================================================
// START
// =====================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `School portal running on port ${PORT}`
  );
});
