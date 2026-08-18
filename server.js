const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();

// =====================================================
// إعداد قاعدة البيانات
// =====================================================

const db = new Database("school.db");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// =====================================================
// إنشاء الجداول
// =====================================================

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

// =====================================================
// الإعدادات الافتراضية
// =====================================================

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
  `).run(1, 300, 50, 15);
}

// =====================================================
// وظائف مساعدة
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

// =====================================================
// الحسابات الافتراضية
// =====================================================

const userCount = db
  .prepare("SELECT COUNT(*) AS count FROM users")
  .get().count;

if (userCount === 0) {
  const insertUser = db.prepare(`
    INSERT INTO users (
      username,
      password,
      role,
      name,
      active,
      last_seen
    )
    VALUES (?, ?, ?, ?, 1, NULL)
  `);

  insertUser.run(
    "admin",
    "1234",
    "admin",
    "مدير المدرسة"
  );

  insertUser.run(
    "teacher",
    "1234",
    "teacher",
    "الأستاذ أحمد"
  );

  insertUser.run(
    "parent",
    "1234",
    "parent",
    "ولي أمر محمد أحمد"
  );

  insertUser.run(
    "student",
    "1234",
    "student",
    "محمد أحمد"
  );
}

// =====================================================
// طالب تجريبي
// =====================================================

const studentCount = db
  .prepare("SELECT COUNT(*) AS count FROM students")
  .get().count;

if (studentCount === 0) {
  db.prepare(`
    INSERT INTO students (
      name,
      class_name,
      parent_phone,
      status
    )
    VALUES (?, ?, ?, ?)
  `).run(
    "محمد أحمد",
    "الصف السادس",
    "201000000000",
    "حاضر"
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
        role,
        name,
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

    const now = nowISO();

    db.prepare(`
      UPDATE users
      SET last_seen = ?
      WHERE id = ?
    `).run(now, user.id);

    user.last_seen = now;

    logAction(
      user.id,
      "LOGIN",
      `تسجيل دخول ${user.username}`
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

    const now = nowISO();

    db.prepare(`
      UPDATE users
      SET last_seen = ?
      WHERE id = ?
    `).run(now, user_id);

    res.json({
      success: true,
      last_seen: now
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
      SELECT
        id,
        username,
        role,
        name,
        active,
        last_seen
      FROM users
      ORDER BY id DESC
    `).all();

    const now = Date.now();

    const result = users.map(user => {
      let online = false;

      if (user.last_seen) {
        const lastSeen =
          new Date(user.last_seen).getTime();

        online =
          user.active === 1 &&
          now - lastSeen <= 60000;
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

    if (!username || !password || !role || !name) {
      return res.status(400).json({
        error: "أكمل جميع بيانات المستخدم"
      });
    }

    const allowedRoles = [
      "admin",
      "teacher",
      "parent",
      "student"
    ];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        error: "الصلاحية غير صحيحة"
      });
    }

    const result = db.prepare(`
      INSERT INTO users (
        username,
        password,
        role,
        name,
        active,
        last_seen
      )
      VALUES (?, ?, ?, ?, 1, NULL)
    `).run(
      username,
      password,
      role,
      name
    );

    logAction(
      null,
      "ADD_USER",
      `إضافة المستخدم ${username}`
    );

    res.json({
      success: true,
      id: result.lastInsertRowid,
      message: "تم إضافة المستخدم بنجاح"
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
// إيقاف مستخدم
// =====================================================

app.patch("/api/users/:id/disable", (req, res) => {
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
      `إيقاف المستخدم ${user.username}`
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
// تفعيل مستخدم
// =====================================================

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
      `تفعيل المستخدم ${user.username}`
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
// تغيير كلمة المرور
// =====================================================

app.patch("/api/users/:id/password", (req, res) => {
  try {
    const {
      current_password,
      new_password
    } = req.body || {};

    if (!new_password) {
      return res.status(400).json({
        error: "أدخل كلمة المرور الجديدة"
      });
    }

    if (String(new_password).length < 4) {
      return res.status(400).json({
        error: "كلمة المرور يجب أن تكون 4 أحرف أو أكثر"
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
      `تغيير كلمة مرور ${user.username}`
    );

    res.json({
      success: true,
      message: "تم تغيير كلمة المرور بنجاح"
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر تغيير كلمة المرور"
    });
  }
});

// =====================================================
// حذف مستخدم
// =====================================================

app.delete("/api/users/:id", (req, res) => {
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
      `حذف المستخدم ${user.username}`
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
// الطلاب
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
// إضافة طالب
// =====================================================

app.post("/api/students", (req, res) => {
  try {
    const {
      name,
      class_name,
      parent_phone
    } = req.body || {};

    if (!name || !class_name) {
      return res.status(400).json({
        error: "اسم الطالب والفصل مطلوبان"
      });
    }

    const result = db.prepare(`
      INSERT INTO students (
        name,
        class_name,
        parent_phone,
        status
      )
      VALUES (?, ?, ?, 'حاضر')
    `).run(
      name,
      class_name,
      parent_phone || ""
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
// تغيير حالة الطالب
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

    const newStatus =
      student.status === "حاضر"
        ? "غائب"
        : "حاضر";

    const date = today();

    db.prepare(`
      UPDATE students
      SET status = ?
      WHERE id = ?
    `).run(
      newStatus,
      student.id
    );

    db.prepare(`
      INSERT INTO student_attendance (
        student_id,
        date,
        status,
        created_at
      )
      VALUES (?, ?, ?, ?)
      ON CONFLICT(student_id, date)
      DO UPDATE SET
        status = excluded.status,
        created_at = excluded.created_at
    `).run(
      student.id,
      date,
      newStatus,
      nowISO()
    );

    logAction(
      null,
      "STUDENT_ATTENDANCE",
      `${student.name}: ${newStatus}`
    );

    res.json({
      success: true,
      status: newStatus
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر تحديث حضور الطالب"
    });
  }
});

// =====================================================
// سجل حضور الطالب
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
      item => item.status === "حاضر"
    ).length;

    const absent = records.filter(
      item => item.status === "غائب"
    ).length;

    const total = records.length;

    const percentage =
      total > 0
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
      error: "تعذر جلب سجل الحضور"
    });
  }
});

// =====================================================
// حضور طالب بتاريخ محدد
// =====================================================

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

    if (status !== "حاضر" && status !== "غائب") {
      return res.status(400).json({
        error: "حالة الحضور غير صحيحة"
      });
    }

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

    db.prepare(`
      INSERT INTO student_attendance (
        student_id,
        date,
        status,
        created_at
      )
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
      message: "تم تحديث سجل الحضور"
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر تحديث سجل الحضور"
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

// =====================================================
// إضافة موظف
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
      INSERT INTO employees (
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
      error: "تعذر إضافة الموظف. تأكد أن رقم الموظف غير مكرر."
    });
  }
});

// =====================================================
// حضور الموظف
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
      const parts = check_in.split(":").map(Number);

      const hour = parts[0] || 0;
      const minute = parts[1] || 0;

      const arrival = hour * 60 + minute;
      const workStart = 8 * 60;

      lateMinutes = Math.max(
        0,
        arrival - workStart
      );

      if (
        lateMinutes >
        settings.allowed_late_minutes
      ) {
        finalStatus = "متأخر";
      }
    }

    db.prepare(`
      INSERT INTO employee_attendance (
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
// سجل حضور الموظف
// =====================================================

app.get("/api/employees/:id/attendance", (req, res) => {
  try {
    const records = db.prepare(`
      SELECT *
      FROM employee_attendance
      WHERE employee_id = ?
      ORDER BY date DESC
    `).all(req.params.id);

    const present = records.filter(
      x =>
        x.status === "حاضر" ||
        x.status === "متأخر"
    ).length;

    const absent = records.filter(
      x => x.status === "غائب"
    ).length;

    const late = records.filter(
      x => x.status === "متأخر"
    ).length;

    res.json({
      records,
      present,
      absent,
      late,
      total: records.length
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب حضور الموظف"
    });
  }
});

// =====================================================
// الخصومات
// =====================================================

app.get("/api/employees/:id/deductions", (req, res) => {
  try {
    const deductions = db.prepare(`
      SELECT *
      FROM deductions
      WHERE employee_id = ?
      ORDER BY date DESC, id DESC
    `).all(req.params.id);

    res.json(deductions);

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
      automatic
    } = req.body || {};

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        error: "أدخل قيمة الخصم"
      });
    }

    if (!reason) {
      return res.status(400).json({
        error: "سبب الخصم مطلوب"
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
      INSERT INTO deductions (
        employee_id,
        amount,
        reason,
        date,
        month,
        automatic,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      employee.id,
      Number(amount),
      reason,
      today(),
      month || currentMonth(),
      automatic ? 1 : 0,
      nowISO()
    );

    logAction(
      null,
      "ADD_DEDUCTION",
      `${employee.name} - خصم ${amount} - ${reason}`
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
    const deduction = db.prepare(`
      SELECT *
      FROM deductions
      WHERE id = ?
    `).get(req.params.id);

    if (!deduction) {
      return res.status(404).json({
        error: "الخصم غير موجود"
      });
    }

    db.prepare(`
      DELETE FROM deductions
      WHERE id = ?
    `).run(req.params.id);

    logAction(
      null,
      "DELETE_DEDUCTION",
      `حذف خصم ${deduction.amount} - ${deduction.reason}`
    );

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

// =====================================================
// المكافآت
// =====================================================

app.get("/api/employees/:id/bonuses", (req, res) => {
  try {
    const bonuses = db.prepare(`
      SELECT *
      FROM bonuses
      WHERE employee_id = ?
      ORDER BY date DESC, id DESC
    `).all(req.params.id);

    res.json(bonuses);

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
      month
    } = req.body || {};

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        error: "أدخل قيمة المكافأة"
      });
    }

    if (!reason) {
      return res.status(400).json({
        error: "سبب المكافأة مطلوب"
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
      INSERT INTO bonuses (
        employee_id,
        amount,
        reason,
        date,
        month,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      employee.id,
      Number(amount),
      reason,
      today(),
      month || currentMonth(),
      nowISO()
    );

    logAction(
      null,
      "ADD_BONUS",
      `${employee.name} - مكافأة ${amount} - ${reason}`
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
    const bonus = db.prepare(`
      SELECT *
      FROM bonuses
      WHERE id = ?
    `).get(req.params.id);

    if (!bonus) {
      return res.status(404).json({
        error: "المكافأة غير موجودة"
      });
    }

    db.prepare(`
      DELETE FROM bonuses
      WHERE id = ?
    `).run(req.params.id);

    logAction(
      null,
      "DELETE_BONUS",
      `حذف مكافأة ${bonus.amount} - ${bonus.reason}`
    );

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

// =====================================================
// كشف الراتب
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

    const bonusResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM bonuses
      WHERE employee_id = ?
      AND month = ?
    `).get(
      employee.id,
      month
    );

    const deductionResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM deductions
      WHERE employee_id = ?
      AND month = ?
    `).get(
      employee.id,
      month
    );

    const basicSalary =
      Number(employee.basic_salary || 0);

    const allowance =
      Number(employee.allowance || 0);

    const bonuses =
      Number(bonusResult.total || 0);

    const deductions =
      Number(deductionResult.total || 0);

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
    console.error(error);

    res.status(500).json({
      error: "تعذر حساب الراتب"
    });
  }
});

// =====================================================
// إعدادات الرواتب
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

    logAction(
      null,
      "UPDATE_PAYROLL_SETTINGS",
      "تحديث إعدادات الرواتب"
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
// خصم الغياب تلقائياً
// =====================================================

app.post(
  "/api/employees/:id/attendance-deduction",
  (req, res) => {
    try {
      const {
        date,
        month
      } = req.body || {};

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

      const attendanceDate =
        date || today();

      const attendance = db.prepare(`
        SELECT *
        FROM employee_attendance
        WHERE employee_id = ?
        AND date = ?
      `).get(
        employee.id,
        attendanceDate
      );

      if (
        !attendance ||
        attendance.status !== "غائب"
      ) {
        return res.status(400).json({
          error: "لا يوجد غياب مسجل لهذا اليوم"
        });
      }

      const settings = db.prepare(`
        SELECT *
        FROM payroll_settings
        WHERE id = 1
      `).get();

      const deductionAmount =
        Number(settings.absence_deduction || 0);

      if (deductionAmount <= 0) {
        return res.status(400).json({
          error: "قيمة خصم الغياب غير محددة"
        });
      }

      const result = db.prepare(`
        INSERT INTO deductions (
          employee_id,
          amount,
          reason,
          date,
          month,
          automatic,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `).run(
        employee.id,
        deductionAmount,
        `خصم غياب بتاريخ ${attendanceDate}`,
        attendanceDate,
        month || attendanceDate.slice(0, 7),
        nowISO()
      );

      logAction(
        null,
        "AUTO_ABSENCE_DEDUCTION",
        `${employee.name} - ${deductionAmount}`
      );

      res.json({
        success: true,
        id: result.lastInsertRowid,
        amount: deductionAmount,
        message: "تم تسجيل خصم الغياب"
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "تعذر تسجيل خصم الغياب"
      });
    }
  }
);

// =====================================================
// خصم التأخير تلقائياً
// =====================================================

app.post(
  "/api/employees/:id/late-deduction",
  (req, res) => {
    try {
      const {
        date,
        month
      } = req.body || {};

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

      const attendanceDate =
        date || today();

      const attendance = db.prepare(`
        SELECT *
        FROM employee_attendance
        WHERE employee_id = ?
        AND date = ?
      `).get(
        employee.id,
        attendanceDate
      );

      if (
        !attendance ||
        attendance.status !== "متأخر"
      ) {
        return res.status(400).json({
          error: "لا يوجد تأخير مسجل لهذا اليوم"
        });
      }

      const settings = db.prepare(`
        SELECT *
        FROM payroll_settings
        WHERE id = 1
      `).get();

      const deductionAmount =
        Number(settings.late_deduction || 0);

      if (deductionAmount <= 0) {
        return res.status(400).json({
          error: "قيمة خصم التأخير غير محددة"
        });
      }

      const result = db.prepare(`
        INSERT INTO deductions (
          employee_id,
          amount,
          reason,
          date,
          month,
          automatic,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `).run(
        employee.id,
        deductionAmount,
        `خصم تأخير ${attendance.late_minutes} دقيقة بتاريخ ${attendanceDate}`,
        attendanceDate,
        month || attendanceDate.slice(0, 7),
        nowISO()
      );

      logAction(
        null,
        "AUTO_LATE_DEDUCTION",
        `${employee.name} - ${deductionAmount}`
      );

      res.json({
        success: true,
        id: result.lastInsertRowid,
        amount: deductionAmount,
        message: "تم تسجيل خصم التأخير"
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "تعذر تسجيل خصم التأخير"
      });
    }
  }
);

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
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب سجل العمليات"
    });
  }
});

// =====================================================
// ملاحظات الطلاب
// =====================================================

app.post("/api/notes", (req, res) => {
  try {
    const {
      student_id,
      text
    } = req.body || {};

    if (!student_id || !text) {
      return res.status(400).json({
        error: "أدخل الملاحظة"
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
      INSERT INTO notes (
        student_id,
        text,
        created_at
      )
      VALUES (?, ?, ?)
    `).run(
      student_id,
      text,
      nowISO()
    );

    logAction(
      null,
      "ADD_NOTE",
      `إضافة ملاحظة للطالب ${student.name}`
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
      SELECT *
      FROM notes
      WHERE student_id = ?
      ORDER BY id DESC
    `).all(req.params.studentId);

    res.json(notes);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "تعذر جلب الملاحظات"
    });
  }
});

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
        error: "اكتب اسم الحصة"
      });
    }

    const result = db.prepare(`
      INSERT INTO videos (
        title,
        file_name,
        created_at
      )
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
      error: "تعذر حفظ الحصة"
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
      error: "تعذر جلب الحصص"
    });
  }
});

// =====================================================
// Health Check
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

const PORT = Number(process.env.PORT) || 3000;

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`School portal running on port ${PORT}`);
});

server.on("error", (error) => {
  console.error("SERVER ERROR:", error);
});

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("UNHANDLED REJECTION:", error);
});
