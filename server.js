const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const db = new Database("school.db");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// =====================================================
// أدوات مساعدة
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

// =====================================================
// الجداول
// =====================================================

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
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
  created_at TEXT,
  created_by INTEGER
);

CREATE TABLE IF NOT EXISTS note_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  viewed_at TEXT,
  UNIQUE(note_id, user_id)
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
  id INTEGER PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  target_type TEXT DEFAULT 'all',
  created_by INTEGER,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS announcement_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  announcement_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  viewed_at TEXT,
  UNIQUE(announcement_id, user_id)
);

CREATE TABLE IF NOT EXISTS employee_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  request_type TEXT NOT NULL,
  title TEXT NOT NULL,
  details TEXT,
  amount REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  admin_note TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS platform_settings (
  id INTEGER PRIMARY KEY,
  institution_name TEXT DEFAULT 'نظام إدارة المدرسة',
  subtitle TEXT DEFAULT 'British Education School Portal',
  logo TEXT DEFAULT '🎓',
  primary_color TEXT DEFAULT '#173b70',
  secondary_color TEXT DEFAULT '#f4f7fb'
);
`);

// =====================================================
// الإعدادات الافتراضية
// =====================================================

if (
  !db.prepare("SELECT * FROM payroll_settings WHERE id = 1").get()
) {
  db.prepare(`
    INSERT INTO payroll_settings
    (id, absence_deduction, late_deduction, allowed_late_minutes)
    VALUES (1, 300, 50, 15)
  `).run();
}

if (
  !db.prepare("SELECT * FROM platform_settings WHERE id = 1").get()
) {
  db.prepare(`
    INSERT INTO platform_settings
    (id, institution_name, subtitle, logo, primary_color, secondary_color)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    1,
    "نظام إدارة المدرسة",
    "British Education School Portal",
    "🎓",
    "#173b70",
    "#f4f7fb"
  );
}

// =====================================================
// حساب المدير فقط عند أول تشغيل
// =====================================================

const userCount = db
  .prepare("SELECT COUNT(*) AS count FROM users")
  .get().count;

if (userCount === 0) {
  db.prepare(`
    INSERT INTO users
    (username, password, role, name, active)
    VALUES (?, ?, ?, ?, 1)
  `).run(
    "admin",
    "1234",
    "admin",
    "مدير المؤسسة"
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
      SELECT id, username, role, name, active, last_seen
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
// نشاط المستخدم
// =====================================================

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
      error: "حدث خطأ"
    });
  }
});

// =====================================================
// المستخدمون
// =====================================================

app.get("/api/users", (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, username, role, name, active, last_seen
      FROM users
      ORDER BY id DESC
    `).all();

    const current = Date.now();

    const result = users.map(user => {
      let online = false;

      if (user.last_seen) {
        const last = new Date(user.last_seen).getTime();

        online =
          user.active === 1 &&
          current - last <= 60000;
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
// إضافة مستخدم
// =====================================================

app.post("/api/users", (req, res) => {
  try {
    const {
      username,
      password,
      role,
      name
    } = req.body || {};

    if (!username || !password || !name) {
      return res.status(400).json({
        error: "اسم المستخدم وكلمة المرور والاسم مطلوبة"
      });
    }

    const finalRole = role || "user";

    const result = db.prepare(`
      INSERT INTO users
      (username, password, role, name, active)
      VALUES (?, ?, ?, ?, 1)
    `).run(
      username,
      password,
      finalRole,
      name
    );

    logAction(
      null,
      "ADD_USER",
      `إضافة ${name}`
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });

  } catch (error) {
    console.error(error);

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

// =====================================================
// تفعيل / إيقاف المستخدم
// =====================================================

app.patch("/api/users/:id/disable", (req, res) => {
  try {
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

app.patch("/api/users/:id/enable", (req, res) => {
  try {
    db.prepare(`
      UPDATE users
      SET active = 1
      WHERE id = ?
    `).run(req.params.id);

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
// حذف مستخدم
// =====================================================

app.delete("/api/users/:id", (req, res) => {
  try {
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

    if (user.username === "admin") {
      return res.status(400).json({
        error: "لا يمكن حذف المدير الرئيسي"
      });
    }

    db.prepare(`
      DELETE FROM users
      WHERE id = ?
    `).run(user.id);

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
// تغيير كلمة المرور
// =====================================================

app.patch("/api/users/:id/password", (req, res) => {
  try {
    const {
      current_password,
      new_password
    } = req.body || {};

    if (!new_password || String(new_password).length < 4) {
      return res.status(400).json({
        error: "كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل"
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
// الطلاب
// =====================================================

app.get("/api/students", (req, res) => {
  try {
    res.json(
      db.prepare(`
        SELECT *
        FROM students
        ORDER BY id DESC
      `).all()
    );
  } catch (error) {
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
      parent_phone
    } = req.body || {};

    if (!name) {
      return res.status(400).json({
        error: "اسم الطالب مطلوب"
      });
    }

    const result = db.prepare(`
      INSERT INTO students
      (name, class_name, parent_phone, status)
      VALUES (?, ?, ?, 'حاضر')
    `).run(
      name,
      class_name || "",
      parent_phone || ""
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
// حضور الطلاب
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
    `).run(status, student.id);

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

    if (!date || !status) {
      return res.status(400).json({
        error: "التاريخ والحالة مطلوبان"
      });
    }

    if (!["حاضر", "غائب"].includes(status)) {
      return res.status(400).json({
        error: "الحالة غير صحيحة"
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
      req.params.id,
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
        req.params.id
      );
    }

    res.json({
      success: true
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "تعذر تحديث سجل الحضور"
    });
  }
});

app.get("/api/students/:id/attendance", (req, res) => {
  try {
    const records = db.prepare(`
      SELECT *
      FROM student_attendance
      WHERE student_id = ?
      ORDER BY date DESC
    `).all(req.params.id);

    const present =
      records.filter(x => x.status === "حاضر").length;

    const absent =
      records.filter(x => x.status === "غائب").length;

    res.json({
      records,
      present,
      absent,
      total: records.length,
      percentage:
        records.length
          ? Math.round((present / records.length) * 100)
          : 0
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب الحضور"
    });
  }
});

// =====================================================
// الموظفون
// =====================================================

app.get("/api/employees", (req, res) => {
  try {
    const employees = db.prepare(`
      SELECT
        e.*,
        u.username,
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
      error: "تعذر إضافة الموظف. تأكد من رقم الموظف."
    });
  }
});

// =====================================================
// حضور الموظفين
// =====================================================

app.post("/api/employees/:id/attendance", (req, res) => {
  try {
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
      const parts = check_in.split(":").map(Number);

      const arrival =
        (parts[0] || 0) * 60 +
        (parts[1] || 0);

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
      req.params.id,
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
      present:
        records.filter(
          x =>
            x.status === "حاضر" ||
            x.status === "متأخر"
        ).length,
      absent:
        records.filter(
          x => x.status === "غائب"
        ).length,
      late:
        records.filter(
          x => x.status === "متأخر"
        ).length,
      total: records.length
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب الحضور"
    });
  }
});

// =====================================================
// الخصومات والمكافآت
// =====================================================

app.get("/api/employees/:id/deductions", (req, res) => {
  res.json(
    db.prepare(`
      SELECT *
      FROM deductions
      WHERE employee_id = ?
      ORDER BY id DESC
    `).all(req.params.id)
  );
});

app.post("/api/employees/:id/deductions", (req, res) => {
  try {
    const {
      amount,
      reason,
      month
    } = req.body || {};

    if (!amount || !reason) {
      return res.status(400).json({
        error: "القيمة والسبب مطلوبان"
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
        created_at
      )
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(
      req.params.id,
      Number(amount),
      reason,
      today(),
      month || currentMonth(),
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

app.get("/api/employees/:id/bonuses", (req, res) => {
  res.json(
    db.prepare(`
      SELECT *
      FROM bonuses
      WHERE employee_id = ?
      ORDER BY id DESC
    `).all(req.params.id)
  );
});

app.post("/api/employees/:id/bonuses", (req, res) => {
  try {
    const {
      amount,
      reason,
      month
    } = req.body || {};

    if (!amount || !reason) {
      return res.status(400).json({
        error: "القيمة والسبب مطلوبان"
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
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.params.id,
      Number(amount),
      reason,
      today(),
      month || currentMonth(),
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
// الرواتب
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

    const basic =
      Number(employee.basic_salary || 0);

    const allowance =
      Number(employee.allowance || 0);

    const gross =
      basic +
      allowance +
      Number(bonuses || 0);

    const net =
      gross -
      Number(deductions || 0);

    res.json({
      month,
      employee,
      basic_salary: basic,
      allowance,
      bonuses: Number(bonuses || 0),
      deductions: Number(deductions || 0),
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

app.get("/api/payroll-settings", (req, res) => {
  res.json(
    db.prepare(`
      SELECT *
      FROM payroll_settings
      WHERE id = 1
    `).get()
  );
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
      success: true
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر تحديث الإعدادات"
    });
  }
});

// =====================================================
// ملاحظات الطلاب + معرفة المشاهدة
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

    const result = db.prepare(`
      INSERT INTO notes
      (student_id, text, created_at, created_by)
      VALUES (?, ?, ?, ?)
    `).run(
      student_id,
      text,
      nowISO(),
      created_by || null
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

app.get("/api/notes/:studentId", (req, res) => {
  try {
    const notes = db.prepare(`
      SELECT
        n.*,
        s.name AS student_name,
        COUNT(nv.id) AS view_count
      FROM notes n
      LEFT JOIN students s
      ON s.id = n.student_id
      LEFT JOIN note_views nv
      ON nv.note_id = n.id
      WHERE n.student_id = ?
      GROUP BY n.id
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

// تسجيل أن المستخدم شاهد الملاحظة
app.post("/api/notes/:id/view", (req, res) => {
  try {
    const {
      user_id
    } = req.body || {};

    if (!user_id) {
      return res.status(400).json({
        error: "user_id مطلوب"
      });
    }

    db.prepare(`
      INSERT INTO note_views
      (note_id, user_id, viewed_at)
      VALUES (?, ?, ?)
      ON CONFLICT(note_id, user_id)
      DO UPDATE SET
        viewed_at = excluded.viewed_at
    `).run(
      req.params.id,
      user_id,
      nowISO()
    );

    res.json({
      success: true,
      viewed_at: nowISO()
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "تعذر تسجيل المشاهدة"
    });
  }
});

// معرفة من شاهد الملاحظة
app.get("/api/notes/:id/views", (req, res) => {
  try {
    const views = db.prepare(`
      SELECT
        nv.*,
        u.name,
        u.username,
        u.role
      FROM note_views nv
      LEFT JOIN users u
      ON u.id = nv.user_id
      WHERE nv.note_id = ?
      ORDER BY nv.viewed_at DESC
    `).all(req.params.id);

    res.json({
      views,
      viewed: views.length > 0
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب المشاهدات"
    });
  }
});

app.delete("/api/notes/:id", (req, res) => {
  try {
    db.prepare(`
      DELETE FROM note_views
      WHERE note_id = ?
    `).run(req.params.id);

    db.prepare(`
      DELETE FROM notes
      WHERE id = ?
    `).run(req.params.id);

    res.json({
      success: true
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر حذف الملاحظة"
    });
  }
});

// =====================================================
// تعاميم وملاحظات الموظفين
// =====================================================

app.post("/api/announcements", (req, res) => {
  try {
    const {
      title,
      text,
      target_type,
      created_by
    } = req.body || {};

    if (!title || !text) {
      return res.status(400).json({
        error: "العنوان والنص مطلوبان"
      });
    }

    const result = db.prepare(`
      INSERT INTO announcements
      (title, text, target_type, created_by, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      title,
      text,
      target_type || "all",
      created_by || null,
      nowISO()
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر إرسال التعميم"
    });
  }
});

app.get("/api/announcements", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        a.*,
        u.name AS creator_name
      FROM announcements a
      LEFT JOIN users u
      ON u.id = a.created_by
      ORDER BY a.id DESC
    `).all();

    res.json(rows);

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب التعميمات"
    });
  }
});

app.post("/api/announcements/:id/view", (req, res) => {
  try {
    const {
      user_id
    } = req.body || {};

    if (!user_id) {
      return res.status(400).json({
        error: "user_id مطلوب"
      });
    }

    db.prepare(`
      INSERT INTO announcement_views
      (announcement_id, user_id, viewed_at)
      VALUES (?, ?, ?)
      ON CONFLICT(announcement_id, user_id)
      DO UPDATE SET
        viewed_at = excluded.viewed_at
    `).run(
      req.params.id,
      user_id,
      nowISO()
    );

    res.json({
      success: true
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر تسجيل المشاهدة"
    });
  }
});

// =====================================================
// طلبات الموظفين
// =====================================================

app.post("/api/employee-requests", (req, res) => {
  try {
    const {
      employee_id,
      request_type,
      title,
      details,
      amount
    } = req.body || {};

    if (!employee_id || !request_type || !title) {
      return res.status(400).json({
        error: "بيانات الطلب ناقصة"
      });
    }

    const result = db.prepare(`
      INSERT INTO employee_requests
      (
        employee_id,
        request_type,
        title,
        details,
        amount,
        status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      employee_id,
      request_type,
      title,
      details || "",
      Number(amount || 0),
      nowISO(),
      nowISO()
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "تعذر إرسال الطلب"
    });
  }
});

app.get("/api/employee-requests", (req, res) => {
  try {
    const requests = db.prepare(`
      SELECT
        r.*,
        e.name AS employee_name,
        e.job_title,
        e.department
      FROM employee_requests r
      LEFT JOIN employees e
      ON e.id = r.employee_id
      ORDER BY r.id DESC
    `).all();

    res.json(requests);

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب الطلبات"
    });
  }
});

app.get("/api/employee-requests/:employeeId", (req, res) => {
  try {
    const requests = db.prepare(`
      SELECT *
      FROM employee_requests
      WHERE employee_id = ?
      ORDER BY id DESC
    `).all(req.params.employeeId);

    res.json(requests);

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب الطلبات"
    });
  }
});

app.patch("/api/employee-requests/:id", (req, res) => {
  try {
    const {
      status,
      admin_note
    } = req.body || {};

    const allowed = [
      "pending",
      "approved",
      "rejected"
    ];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: "حالة الطلب غير صحيحة"
      });
    }

    db.prepare(`
      UPDATE employee_requests
      SET
        status = ?,
        admin_note = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      status,
      admin_note || "",
      nowISO(),
      req.params.id
    );

    res.json({
      success: true
    });

  } catch (error) {
    res.status(500).json({
      error: "تعذر تحديث الطلب"
    });
  }
});

// =====================================================
// إعدادات المنصة
// =====================================================

app.get("/api/platform-settings", (req, res) => {
  try {
    const settings = db.prepare(`
      SELECT *
      FROM platform_settings
      WHERE id = 1
    `).get();

    res.json(settings);

  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب إعدادات المنصة"
    });
  }
});

app.patch("/api/platform-settings", (req, res) => {
  try {
    const {
      institution_name,
      subtitle,
      logo,
      primary_color,
      secondary_color
    } = req.body || {};

    const old = db.prepare(`
      SELECT *
      FROM platform_settings
      WHERE id = 1
    `).get();

    db.prepare(`
      UPDATE platform_settings
      SET
        institution_name = ?,
        subtitle = ?,
        logo = ?,
        primary_color = ?,
        secondary_color = ?
      WHERE id = 1
    `).run(
      institution_name ?? old.institution_name,
      subtitle ?? old.subtitle,
      logo ?? old.logo,
      primary_color ?? old.primary_color,
      secondary_color ?? old.secondary_color
    );

    res.json({
      success: true,
      message: "تم تحديث إعدادات المنصة"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "تعذر تحديث إعدادات المنصة"
    });
  }
});

// =====================================================
// سجل العمليات
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
    res.status(500).json({
      error: "تعذر جلب سجل العمليات"
    });
  }
});

// =====================================================
// الفيديوهات
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
    res.status(500).json({
      error: "تعذر إضافة الحصة"
    });
  }
});

app.get("/api/videos", (req, res) => {
  try {
    res.json(
      db.prepare(`
        SELECT *
        FROM videos
        ORDER BY id DESC
      `).all()
    );
  } catch (error) {
    res.status(500).json({
      error: "تعذر جلب الحصص"
    });
  }
});

// =====================================================
// Dashboard
// =====================================================

app.get("/api/dashboard", (req, res) => {
  try {
    const users = db.prepare(`
      SELECT COUNT(*) AS count
      FROM users
    `).get().count;

    const online = db.prepare(`
      SELECT COUNT(*) AS count
      FROM users
      WHERE active = 1
      AND last_seen IS NOT NULL
      AND datetime(last_seen) >= datetime('now', '-60 seconds')
    `).get().count;

    const students = db.prepare(`
      SELECT COUNT(*) AS count
      FROM students
    `).get().count;

    const employees = db.prepare(`
      SELECT COUNT(*) AS count
      FROM employees
      WHERE active = 1
    `).get().count;

    res.json({
      users,
      online,
      students,
      employees
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "تعذر تحميل لوحة التحكم"
    });
  }
});

// =====================================================
// Health
// =====================================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "School portal is running",
    time: nowISO()
  });
});

// =====================================================
// الصفحة الرئيسية
// =====================================================

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

// =====================================================
// تشغيل السيرفر
// =====================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `School portal running on port ${PORT}`
  );
});
