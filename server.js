const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// DATABASE
// =========================

const db = new Database(
  path.join(__dirname, "school.db")
);

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  active INTEGER NOT NULL DEFAULT 1,
  online INTEGER NOT NULL DEFAULT 0,
  last_seen TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  class_name TEXT DEFAULT '',
  parent_phone TEXT DEFAULT '',
  status TEXT DEFAULT 'نشط',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_no TEXT DEFAULT '',
  name TEXT NOT NULL,
  job TEXT DEFAULT '',
  department TEXT DEFAULT '',
  phone TEXT DEFAULT '',
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

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subject TEXT DEFAULT '',
  url TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  details TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
`);

// =========================
// HELPERS
// =========================

function now() {
  return new Date().toISOString();
}

function sendError(res, message, code = 400) {
  return res.status(code).json({
    success: false,
    error: message
  });
}

// =========================
// DEFAULT ADMIN
// =========================

const admin = db
  .prepare("SELECT id FROM users WHERE username = ?")
  .get("admin");

if (!admin) {
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
    now(),
    now()
  );
}

// =========================
// MIDDLEWARE
// =========================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(
  path.join(__dirname, "public")
));

// =========================
// HEALTH
// =========================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "School portal is running"
  });
});

// =========================
// LOGIN
// =========================

app.post("/api/login", (req, res) => {
  try {
    const username = String(
      req.body.username || ""
    ).trim();

    const password = String(
      req.body.password || ""
    );

    if (!username || !password) {
      return sendError(
        res,
        "أدخل اسم المستخدم وكلمة المرور"
      );
    }

    const user = db
      .prepare(`
        SELECT *
        FROM users
        WHERE username = ?
      `)
      .get(username);

    if (!user) {
      return sendError(
        res,
        "اسم المستخدم أو كلمة المرور غير صحيحة",
        401
      );
    }

    if (!user.active) {
      return sendError(
        res,
        "هذا الحساب موقوف",
        403
      );
    }

    if (user.password !== password) {
      return sendError(
        res,
        "اسم المستخدم أو كلمة المرور غير صحيحة",
        401
      );
    }

    db.prepare(`
      UPDATE users
      SET online = 1,
          last_seen = ?
      WHERE id = ?
    `).run(
      now(),
      user.id
    );

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
      user.id,
      "تسجيل الدخول",
      "دخول المستخدم",
      now()
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

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return sendError(
      res,
      "حدث خطأ أثناء تسجيل الدخول",
      500
    );
  }
});

// =========================
// LOGOUT
// =========================

app.post("/api/logout", (req, res) => {
  try {
    const userId = Number(
      req.body.userId || 0
    );

    if (userId) {
      db.prepare(`
        UPDATE users
        SET online = 0,
            last_seen = ?
        WHERE id = ?
      `).run(
        now(),
        userId
      );
    }

    res.json({
      success: true
    });

  } catch (error) {
    console.error("LOGOUT ERROR:", error);
    return sendError(
      res,
      "حدث خطأ في تسجيل الخروج",
      500
    );
  }
});

// =========================
// USERS
// =========================

app.get("/api/users", (req, res) => {
  try {
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

  } catch (error) {
    console.error("USERS ERROR:", error);
    return sendError(
      res,
      "تعذر تحميل المستخدمين",
      500
    );
  }
});

app.post("/api/users", (req, res) => {
  try {
    const username = String(
      req.body.username || ""
    ).trim();

    const password = String(
      req.body.password || ""
    );

    const name = String(
      req.body.name || ""
    ).trim();

    const role =
      req.body.role || "user";

    if (!username || !password || !name) {
      return sendError(
        res,
        "أكمل بيانات المستخدم"
      );
    }

    const exists = db
      .prepare(
        "SELECT id FROM users WHERE username = ?"
      )
      .get(username);

    if (exists) {
      return sendError(
        res,
        "اسم المستخدم موجود بالفعل",
        409
      );
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
      now(),
      now()
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });

  } catch (error) {
    console.error("CREATE USER ERROR:", error);
    return sendError(
      res,
      "تعذر إنشاء المستخدم",
      500
    );
  }
});

app.patch("/api/users/:id/status", (req, res) => {
  try {
    const id = Number(
      req.params.id
    );

    const active =
      req.body.active ? 1 : 0;

    db.prepare(`
      UPDATE users
      SET active = ?
      WHERE id = ?
    `).run(
      active,
      id
    );

    res.json({
      success: true
    });

  } catch (error) {
    console.error("STATUS ERROR:", error);
    return sendError(
      res,
      "تعذر تغيير حالة المستخدم",
      500
    );
  }
});

app.delete("/api/users/:id", (req, res) => {
  try {
    const id = Number(
      req.params.id
    );

    const user = db
      .prepare(`
        SELECT username
        FROM users
        WHERE id = ?
      `)
      .get(id);

    if (!user) {
      return sendError(
        res,
        "المستخدم غير موجود",
        404
      );
    }

    if (user.username === "admin") {
      return sendError(
        res,
        "لا يمكن حذف المدير الرئيسي"
      );
    }

    db.prepare(
      "DELETE FROM users WHERE id = ?"
    ).run(id);

    res.json({
      success: true
    });

  } catch (error) {
    console.error("DELETE USER ERROR:", error);
    return sendError(
      res,
      "تعذر حذف المستخدم",
      500
    );
  }
});

// =========================
// STUDENTS
// =========================

app.get("/api/students", (req, res) => {
  try {
    const students = db
      .prepare(`
        SELECT *
        FROM students
        ORDER BY id DESC
      `)
      .all();

    res.json({
      success: true,
      students
    });

  } catch (error) {
    console.error("STUDENTS ERROR:", error);
    return sendError(
      res,
      "تعذر تحميل الطلاب",
      500
    );
  }
});

app.post("/api/students", (req, res) => {
  try {
    const name = String(
      req.body.name || ""
    ).trim();

    if (!name) {
      return sendError(
        res,
        "اسم الطالب مطلوب"
      );
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
      req.body.class_name || "",
      req.body.parent_phone || "",
      req.body.status || "نشط",
      now()
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });

  } catch (error) {
    console.error("ADD STUDENT ERROR:", error);
    return sendError(
      res,
      "تعذر إضافة الطالب",
      500
    );
  }
});

app.delete("/api/students/:id", (req, res) => {
  try {
    const id = Number(
      req.params.id
    );

    db.prepare(
      "DELETE FROM notes WHERE student_id = ?"
    ).run(id);

    db.prepare(
      "DELETE FROM attendance WHERE student_id = ?"
    ).run(id);

    db.prepare(
      "DELETE FROM students WHERE id = ?"
    ).run(id);

    res.json({
      success: true
    });

  } catch (error) {
    console.error("DELETE STUDENT ERROR:", error);
    return sendError(
      res,
      "تعذر حذف الطالب",
      500
    );
  }
});

// =========================
// EMPLOYEES
// =========================

app.get("/api/employees", (req, res) => {
  try {
    const employees = db
      .prepare(`
        SELECT *
        FROM employees
        ORDER BY id DESC
      `)
      .all();

    res.json({
      success: true,
      employees
    });

  } catch (error) {
    console.error("EMPLOYEES ERROR:", error);
    return sendError(
      res,
      "تعذر تحميل الموظفين",
      500
    );
  }
});

app.post("/api/employees", (req, res) => {
  try {
    const name = String(
      req.body.name || ""
    ).trim();

    if (!name) {
      return sendError(
        res,
        "اسم الموظف مطلوب"
      );
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
      req.body.employee_no || "",
      name,
      req.body.job || "",
      req.body.department || "",
      req.body.phone || "",
      Number(req.body.salary || 0),
      req.body.status || "نشط",
      now()
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });

  } catch (error) {
    console.error("ADD EMPLOYEE ERROR:", error);
    return sendError(
      res,
      "تعذر إضافة الموظف",
      500
    );
  }
});

app.delete("/api/employees/:id", (req, res) => {
  try {
    const id = Number(
      req.params.id
    );

    db.prepare(
      "DELETE FROM employees WHERE id = ?"
    ).run(id);

    res.json({
      success: true
    });

  } catch (error) {
    console.error("DELETE EMPLOYEE ERROR:", error);
    return sendError(
      res,
      "تعذر حذف الموظف",
      500
    );
  }
});

// =========================
// ATTENDANCE
// =========================

app.get("/api/attendance/students", (req, res) => {
  try {
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

  } catch (error) {
    console.error("ATTENDANCE ERROR:", error);
    return sendError(
      res,
      "تعذر تحميل الحضور",
      500
    );
  }
});

app.post("/api/attendance/students", (req, res) => {
  try {
    const studentId = Number(
      req.body.student_id || 0
    );

    const status = String(
      req.body.status || ""
    );

    if (!studentId || !status) {
      return sendError(
        res,
        "بيانات الحضور ناقصة"
      );
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
      studentId,
      status,
      new Date().toISOString().slice(0, 10),
      now()
    );

    res.json({
      success: true
    });

  } catch (error) {
    console.error("SAVE ATTENDANCE ERROR:", error);
    return sendError(
      res,
      "تعذر حفظ الحضور",
      500
    );
  }
});

// =========================
// NOTES
// =========================

app.get("/api/notes", (req, res) => {
  try {
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

  } catch (error) {
    console.error("NOTES ERROR:", error);
    return sendError(
      res,
      "تعذر تحميل الملاحظات",
      500
    );
  }
});

app.post("/api/notes", (req, res) => {
  try {
    const studentId = Number(
      req.body.student_id || 0
    );

    const note = String(
      req.body.note || ""
    ).trim();

    if (!studentId || !note) {
      return sendError(
        res,
        "اختر الطالب واكتب الملاحظة"
      );
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
      studentId,
      note,
      now()
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });

  } catch (error) {
    console.error("ADD NOTE ERROR:", error);
    return sendError(
      res,
      "تعذر حفظ الملاحظة",
      500
    );
  }
});

app.delete("/api/notes/:id", (req, res) => {
  try {
    db.prepare(
      "DELETE FROM notes WHERE id = ?"
    ).run(
      Number(req.params.id)
    );

    res.json({
      success: true
    });

  } catch (error) {
    console.error("DELETE NOTE ERROR:", error);
    return sendError(
      res,
      "تعذر حذف الملاحظة",
      500
    );
  }
});

// =========================
// VIDEOS
// =========================

app.get("/api/videos", (req, res) => {
  try {
    const videos = db.prepare(`
      SELECT *
      FROM videos
      ORDER BY id DESC
    `).all();

    res.json({
      success: true,
      videos
    });

  } catch (error) {
    console.error("VIDEOS ERROR:", error);
    return sendError(
      res,
      "تعذر تحميل الحصص",
      500
    );
  }
});

app.post("/api/videos", (req, res) => {
  try {
    const title = String(
      req.body.title || ""
    ).trim();

    if (!title) {
      return sendError(
        res,
        "عنوان الحصة مطلوب"
      );
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
      req.body.subject || "",
      req.body.url || "",
      req.body.description || "",
      now()
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });

  } catch (error) {
    console.error("ADD VIDEO ERROR:", error);
    return sendError(
      res,
      "تعذر إضافة الحصة",
      500
    );
  }
});

app.delete("/api/videos/:id", (req, res) => {
  try {
    db.prepare(
      "DELETE FROM videos WHERE id = ?"
    ).run(
      Number(req.params.id)
    );

    res.json({
      success: true
    });

  } catch (error) {
    console.error("DELETE VIDEO ERROR:", error);
    return sendError(
      res,
      "تعذر حذف الحصة",
      500
    );
  }
});

// =========================
// DASHBOARD
// =========================

app.get("/api/dashboard", (req, res) => {
  try {
    const users = db
      .prepare(
        "SELECT COUNT(*) AS count FROM users"
      )
      .get().count;

    const online = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM users
        WHERE online = 1
        AND active = 1
      `)
      .get().count;

    const students = db
      .prepare(
        "SELECT COUNT(*) AS count FROM students"
      )
      .get().count;

    const employees = db
      .prepare(
        "SELECT COUNT(*) AS count FROM employees"
      )
      .get().count;

    const onlineUsers = db
      .prepare(`
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
      `)
      .all();

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

  } catch (error) {
    console.error("DASHBOARD ERROR:", error);
    return sendError(
      res,
      "تعذر تحميل لوحة التحكم",
      500
    );
  }
});

// =========================
// LOGS
// =========================

app.get("/api/logs", (req, res) => {
  try {
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

  } catch (error) {
    console.error("LOGS ERROR:", error);
    return sendError(
      res,
      "تعذر تحميل السجلات",
      500
    );
  }
});

// =========================
// ROOT
// =========================

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

// =========================
// API 404
// =========================

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API endpoint not found"
  });
});

// =========================
// ERROR HANDLER
// =========================

app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    success: false,
    error: "حدث خطأ داخل السيرفر"
  });
});

// =========================
// START
// =========================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `School Portal running on port ${PORT}`
    );
  }
);
