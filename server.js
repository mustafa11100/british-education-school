const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();

const PORT = process.env.PORT || 3000;

const db = new Database(
  path.join(__dirname, "school.db")
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

/* =====================================================
   HELPERS
===================================================== */

function nowISO() {
  return new Date().toISOString();
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function statusBadge(status) {
  return `<span class="badge">${esc(status)}</span>`;
}

/* =====================================================
   DATABASE TABLES
===================================================== */

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  active INTEGER DEFAULT 1,
  online INTEGER DEFAULT 0,
  last_seen TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  class_name TEXT,
  parent_phone TEXT,
  status TEXT DEFAULT 'نشط',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_no TEXT,
  name TEXT NOT NULL,
  job TEXT,
  department TEXT,
  phone TEXT,
  salary REAL DEFAULT 0,
  status TEXT DEFAULT 'نشط',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER,
  status TEXT,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employee_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER,
  date TEXT NOT NULL,
  check_in TEXT,
  check_out TEXT,
  status TEXT,
  late_minutes INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payroll (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER,
  basic REAL DEFAULT 0,
  allowances REAL DEFAULT 0,
  bonuses REAL DEFAULT 0,
  deductions REAL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subject TEXT,
  url TEXT,
  description TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL
);
`);

/* =====================================================
   DEFAULT ADMIN
===================================================== */

const adminExists = db
  .prepare(
    "SELECT id FROM users WHERE username = ?"
  )
  .get("admin");

if (!adminExists) {
  db.prepare(`
    INSERT INTO users
    (
      username,
      password,
      name,
      role,
      active,
      online,
      last_seen,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "admin",
    "1234",
    "مدير النظام",
    "admin",
    1,
    0,
    nowISO(),
    nowISO()
  );
}

/* =====================================================
   LOG FUNCTION
===================================================== */

function addLog(userId, action, details = "") {
  db.prepare(`
    INSERT INTO logs
    (
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
   LOGIN
===================================================== */

app.post("/api/login", (req, res) => {

  const {
    username,
    password
  } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: "أدخل اسم المستخدم وكلمة المرور"
    });
  }

  const user = db.prepare(`
    SELECT *
    FROM users
    WHERE username = ?
  `).get(username);

  if (!user) {
    return res.status(401).json({
      error: "اسم المستخدم أو كلمة المرور غير صحيحة"
    });
  }

  if (!user.active) {
    return res.status(403).json({
      error: "هذا الحساب موقوف"
    });
  }

  if (user.password !== password) {
    return res.status(401).json({
      error: "اسم المستخدم أو كلمة المرور غير صحيحة"
    });
  }

  db.prepare(`
    UPDATE users
    SET online = 1,
        last_seen = ?
    WHERE id = ?
  `).run(
    nowISO(),
    user.id
  );

  addLog(
    user.id,
    "تسجيل الدخول",
    `دخول المستخدم ${user.username}`
  );

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    }
  });
});

/* =====================================================
   LOGOUT
===================================================== */

app.post("/api/logout", (req, res) => {

  const {
    userId
  } = req.body;

  if (userId) {

    db.prepare(`
      UPDATE users
      SET online = 0,
          last_seen = ?
      WHERE id = ?
    `).run(
      nowISO(),
      userId
    );

    addLog(
      userId,
      "تسجيل الخروج",
      "تم تسجيل خروج المستخدم"
    );
  }

  res.json({
    success: true
  });
});

/* =====================================================
   USERS - GET
===================================================== */

app.get("/api/users", (req, res) => {

  const users = db.prepare(`
    SELECT
      id,
      username,
      name,
      role,
      active,
      online,
      last_seen,
      created_at
    FROM users
    ORDER BY id DESC
  `).all();

  res.json({
    success: true,
    users
  });
});

/* =====================================================
   USERS - CREATE
===================================================== */

app.post("/api/users", (req, res) => {

  const {
    username,
    password,
    name,
    role = "user"
  } = req.body;

  if (!username || !password || !name) {
    return res.status(400).json({
      error: "أكمل جميع البيانات"
    });
  }

  if (password.length < 4) {
    return res.status(400).json({
      error: "كلمة المرور يجب أن تكون 4 أحرف على الأقل"
    });
  }

  const exists = db.prepare(`
    SELECT id
    FROM users
    WHERE username = ?
  `).get(username);

  if (exists) {
    return res.status(409).json({
      error: "اسم المستخدم موجود بالفعل"
    });
  }

  const result = db.prepare(`
    INSERT INTO users
    (
      username,
      password,
      name,
      role,
      active,
      online,
      last_seen,
      created_at
    )
    VALUES (?, ?, ?, ?, 1, 0, ?, ?)
  `).run(
    username,
    password,
    name,
    role,
    nowISO(),
    nowISO()
  );

  addLog(
    null,
    "إنشاء مستخدم",
    `تم إنشاء المستخدم ${username}`
  );

  res.json({
    success: true,
    id: result.lastInsertRowid
  });
});

/* =====================================================
   USERS - UPDATE STATUS
===================================================== */

app.patch("/api/users/:id/status", (req, res) => {

  const id = Number(req.params.id);

  const {
    active
  } = req.body;

  db.prepare(`
    UPDATE users
    SET active = ?
    WHERE id = ?
  `).run(
    active ? 1 : 0,
    id
  );

  addLog(
    null,
    "تغيير حالة مستخدم",
    `المستخدم رقم ${id} أصبح ${active ? "نشط" : "موقوف"}`
  );

  res.json({
    success: true
  });
});

/* =====================================================
   USERS - DELETE
===================================================== */

app.delete("/api/users/:id", (req, res) => {

  const id = Number(req.params.id);

  const user = db.prepare(`
    SELECT username
    FROM users
    WHERE id = ?
  `).get(id);

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
  `).run(id);

  addLog(
    null,
    "حذف مستخدم",
    `تم حذف المستخدم ${user.username}`
  );

  res.json({
    success: true
  });
});

/* =====================================================
   STUDENTS - GET
===================================================== */

app.get("/api/students", (req, res) => {

  const students = db.prepare(`
    SELECT *
    FROM students
    ORDER BY id DESC
  `).all();

  res.json({
    success: true,
    students
  });
});

/* =====================================================
   STUDENTS - CREATE
===================================================== */

app.post("/api/students", (req, res) => {

  const {
    name,
    class_name,
    parent_phone,
    status = "نشط"
  } = req.body;

  if (!name) {
    return res.status(400).json({
      error: "اسم الطالب مطلوب"
    });
  }

  const result = db.prepare(`
    INSERT INTO students
    (
      name,
      class_name,
      parent_phone,
      status,
      created_at
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(
    name,
    class_name || "",
    parent_phone || "",
    status,
    nowISO()
  );

  addLog(
    null,
    "إضافة طالب",
    `تمت إضافة الطالب ${name}`
  );

  res.json({
    success: true,
    id: result.lastInsertRowid
  });
});

/* =====================================================
   STUDENTS - DELETE
===================================================== */

app.delete("/api/students/:id", (req, res) => {

  const id = Number(req.params.id);

  db.prepare(`
    DELETE FROM students
    WHERE id = ?
  `).run(id);

  db.prepare(`
    DELETE FROM notes
    WHERE student_id = ?
  `).run(id);

  db.prepare(`
    DELETE FROM attendance
    WHERE student_id = ?
  `).run(id);

  res.json({
    success: true
  });
});

/* =====================================================
   EMPLOYEES - GET
===================================================== */

app.get("/api/employees", (req, res) => {

  const employees = db.prepare(`
    SELECT *
    FROM employees
    ORDER BY id DESC
  `).all();

  res.json({
    success: true,
    employees
  });
});

/* =====================================================
   EMPLOYEES - CREATE
===================================================== */

app.post("/api/employees", (req, res) => {

  const {
    employee_no,
    name,
    job,
    department,
    phone,
    salary = 0,
    status = "نشط"
  } = req.body;

  if (!name) {
    return res.status(400).json({
      error: "اسم الموظف مطلوب"
    });
  }

  const result = db.prepare(`
    INSERT INTO employees
    (
      employee_no,
      name,
      job,
      department,
      phone,
      salary,
      status,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    employee_no || "",
    name,
    job || "",
    department || "",
    phone || "",
    Number(salary) || 0,
    status,
    nowISO()
  );

  addLog(
    null,
    "إضافة موظف",
    `تمت إضافة الموظف ${name}`
  );

  res.json({
    success: true,
    id: result.lastInsertRowid
  });
});

/* =====================================================
   EMPLOYEES - DELETE
===================================================== */

app.delete("/api/employees/:id", (req, res) => {

  const id = Number(req.params.id);

  db.prepare(`
    DELETE FROM employees
    WHERE id = ?
  `).run(id);

  db.prepare(`
    DELETE FROM payroll
    WHERE employee_id = ?
  `).run(id);

  db.prepare(`
    DELETE FROM employee_attendance
    WHERE employee_id = ?
  `).run(id);

  res.json({
    success: true
  });
});

/* =====================================================
   STUDENT ATTENDANCE
===================================================== */

app.get("/api/attendance/students", (req, res) => {

  const students = db.prepare(`
    SELECT
      s.id,
      s.name,
      s.class_name,
      COALESCE(
        (
          SELECT a.status
          FROM attendance a
          WHERE a.student_id = s.id
          ORDER BY a.id DESC
          LIMIT 1
        ),
        'غير مسجل'
      ) AS attendance_status
    FROM students s
    ORDER BY s.name
  `).all();

  res.json({
    success: true,
    students
  });
});

/* =====================================================
   STUDENT ATTENDANCE - SAVE
===================================================== */

app.post("/api/attendance/students", (req, res) => {

  const {
    student_id,
    status
  } = req.body;

  if (!student_id || !status) {
    return res.status(400).json({
      error: "البيانات ناقصة"
    });
  }

  db.prepare(`
    INSERT INTO attendance
    (
      student_id,
      status,
      date,
      created_at
    )
    VALUES (?, ?, ?, ?)
  `).run(
    student_id,
    status,
    new Date().toISOString().slice(0, 10),
    nowISO()
  );

  res.json({
    success: true
  });
});

/* =====================================================
   EMPLOYEE ATTENDANCE
===================================================== */

app.get("/api/attendance/employees", (req, res) => {

  const rows = db.prepare(`
    SELECT
      ea.id,
      e.name,
      ea.date,
      ea.check_in,
      ea.check_out,
      ea.status,
      ea.late_minutes
    FROM employee_attendance ea
    LEFT JOIN employees e
      ON e.id = ea.employee_id
    ORDER BY ea.id DESC
  `).all();

  res.json({
    success: true,
    attendance: rows
  });
});

/* =====================================================
   PAYROLL
===================================================== */

app.get("/api/payroll", (req, res) => {

  const rows = db.prepare(`
    SELECT
      e.id AS employee_id,
      e.name,
      COALESCE(p.basic, e.salary, 0) AS basic,
      COALESCE(p.allowances, 0) AS allowances,
      COALESCE(p.bonuses, 0) AS bonuses,
      COALESCE(p.deductions, 0) AS deductions
    FROM employees e
    LEFT JOIN payroll p
      ON p.employee_id = e.id
  `).all();

  const payroll = rows.map(row => ({
    ...row,
    net:
      Number(row.basic) +
      Number(row.allowances) +
      Number(row.bonuses) -
      Number(row.deductions)
  }));

  res.json({
    success: true,
    payroll
  });
});

/* =====================================================
   PAYROLL - SAVE
===================================================== */

app.post("/api/payroll", (req, res) => {

  const {
    employee_id,
    basic = 0,
    allowances = 0,
    bonuses = 0,
    deductions = 0
  } = req.body;

  if (!employee_id) {
    return res.status(400).json({
      error: "الموظف مطلوب"
    });
  }

  const existing = db.prepare(`
    SELECT id
    FROM payroll
    WHERE employee_id = ?
  `).get(employee_id);

  if (existing) {

    db.prepare(`
      UPDATE payroll
      SET
        basic = ?,
        allowances = ?,
        bonuses = ?,
        deductions = ?
      WHERE employee_id = ?
    `).run(
      Number(basic),
      Number(allowances),
      Number(bonuses),
      Number(deductions),
      employee_id
    );

  } else {

    db.prepare(`
      INSERT INTO payroll
      (
        employee_id,
        basic,
        allowances,
        bonuses,
        deductions,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      employee_id,
      Number(basic),
      Number(allowances),
      Number(bonuses),
      Number(deductions),
      nowISO()
    );
  }

  res.json({
    success: true
  });
});

/* =====================================================
   NOTES - GET
===================================================== */

app.get("/api/notes", (req, res) => {

  const notes = db.prepare(`
    SELECT
      n.id,
      n.student_id,
      s.name AS student_name,
      n.note,
      n.created_at
    FROM notes n
    LEFT JOIN students s
      ON s.id = n.student_id
    ORDER BY n.id DESC
  `).all();

  res.json({
    success: true,
    notes
  });
});

/* =====================================================
   NOTES - CREATE
===================================================== */

app.post("/api/notes", (req, res) => {

  const {
    student_id,
    note
  } = req.body;

  if (!student_id || !note) {
    return res.status(400).json({
      error: "اختر الطالب واكتب الملاحظة"
    });
  }

  const result = db.prepare(`
    INSERT INTO notes
    (
      student_id,
      note,
      created_at
    )
    VALUES (?, ?, ?)
  `).run(
    student_id,
    note,
    nowISO()
  );

  res.json({
    success: true,
    id: result.lastInsertRowid
  });
});

/* =====================================================
   NOTES - DELETE
===================================================== */

app.delete("/api/notes/:id", (req, res) => {

  const id = Number(req.params.id);

  db.prepare(`
    DELETE FROM notes
    WHERE id = ?
  `).run(id);

  res.json({
    success: true
  });
});

/* =====================================================
   VIDEOS - GET
===================================================== */

app.get("/api/videos", (req, res) => {

  const videos = db.prepare(`
    SELECT *
    FROM videos
    ORDER BY id DESC
  `).all();

  res.json({
    success: true,
    videos
  });
});

/* =====================================================
   VIDEOS - CREATE
===================================================== */

app.post("/api/videos", (req, res) => {

  const {
    title,
    subject,
    url,
    description
  } = req.body;

  if (!title) {
    return res.status(400).json({
      error: "عنوان الحصة مطلوب"
    });
  }

  const result = db.prepare(`
    INSERT INTO videos
    (
      title,
      subject,
      url,
      description,
      created_at
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(
    title,
    subject || "",
    url || "",
    description || "",
    nowISO()
  );

  res.json({
    success: true,
    id: result.lastInsertRowid
  });
});

/* =====================================================
   VIDEOS - DELETE
===================================================== */

app.delete("/api/videos/:id", (req, res) => {

  const id = Number(req.params.id);

  db.prepare(`
    DELETE FROM videos
    WHERE id = ?
  `).run(id);

  res.json({
    success: true
  });
});

/* =====================================================
   LOGS
===================================================== */

app.get("/api/logs", (req, res) => {

  const logs = db.prepare(`
    SELECT
      l.id,
      l.user_id,
      COALESCE(u.username, 'النظام') AS username,
      l.action,
      l.details,
      l.created_at
    FROM logs l
    LEFT JOIN users u
      ON u.id = l.user_id
    ORDER BY l.id DESC
    LIMIT 500
  `).all();

  res.json({
    success: true,
    logs
  });
});

/* =====================================================
   DASHBOARD
===================================================== */

app.get("/api/dashboard", (req, res) => {

  const users = db.prepare(`
    SELECT COUNT(*) AS count
    FROM users
  `).get().count;

  const online = db.prepare(`
    SELECT COUNT(*) AS count
    FROM users
    WHERE online = 1
      AND active = 1
  `).get().count;

  const students = db.prepare(`
    SELECT COUNT(*) AS count
    FROM students
  `).get().count;

  const employees = db.prepare(`
    SELECT COUNT(*) AS count
    FROM employees
  `).get().count;

  const onlineUsers = db.prepare(`
    SELECT
      id,
      username,
      name,
      role,
      last_seen
    FROM users
    WHERE online = 1
      AND active = 1
    ORDER BY last_seen DESC
  `).all();

  res.json({
    success: true,
    stats: {
      users,
      online,
      students,
      employees
    },
    onlineUsers
  });
});

/* =====================================================
   ROOT
===================================================== */

app.get("/", (req, res) => {

  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

/* =====================================================
   404 API
===================================================== */

app.use("/api", (req, res) => {

  res.status(404).json({
    error: "API endpoint not found"
  });
});

/* =====================================================
   ERROR HANDLER
===================================================== */

app.use((err, req, res, next) => {

  console.error("SERVER ERROR:", err);

  res.status(500).json({
    error: "حدث خطأ داخل السيرفر"
  });
});

/* =====================================================
   START SERVER
===================================================== */

app.listen(PORT, "0.0.0.0", () => {

  console.log(
    `School Portal running on port ${PORT}`
  );

});
