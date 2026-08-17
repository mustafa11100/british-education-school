const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const db = new Database("school.db");

app.use(express.json());
app.use(express.static(__dirname));

/* =========================
   DATABASE
========================= */

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  role TEXT,
  name TEXT,
  active INTEGER DEFAULT 1,
  last_seen TEXT
);

CREATE TABLE IF NOT EXISTS students(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  class_name TEXT,
  parent_phone TEXT,
  status TEXT DEFAULT 'حاضر'
);

CREATE TABLE IF NOT EXISTS notes(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER,
  text TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS videos(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  file_name TEXT,
  created_at TEXT
);
`);

/* =========================
   COMPATIBILITY WITH OLD DATABASE
========================= */

try {
  db.prepare(
    "ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1"
  ).run();
} catch (e) {}

try {
  db.prepare(
    "ALTER TABLE users ADD COLUMN last_seen TEXT"
  ).run();
} catch (e) {}

/* =========================
   DEFAULT USERS
========================= */

const userCount = db
  .prepare("SELECT COUNT(*) AS c FROM users")
  .get().c;

if (userCount === 0) {

  const addUser = db.prepare(`
    INSERT INTO users(
      username,
      password,
      role,
      name,
      active,
      last_seen
    )
    VALUES(?,?,?,?,1,NULL)
  `);

  addUser.run(
    "admin",
    "1234",
    "admin",
    "مدير المدرسة"
  );

  addUser.run(
    "teacher",
    "1234",
    "teacher",
    "الأستاذ أحمد"
  );

  addUser.run(
    "parent",
    "1234",
    "parent",
    "ولي أمر محمد أحمد"
  );

  addUser.run(
    "student",
    "1234",
    "student",
    "محمد أحمد"
  );
}

/* =========================
   DEFAULT STUDENT
========================= */

const studentCount = db
  .prepare("SELECT COUNT(*) AS c FROM students")
  .get().c;

if (studentCount === 0) {

  db.prepare(`
    INSERT INTO students(
      name,
      class_name,
      parent_phone,
      status
    )
    VALUES(?,?,?,?)
  `).run(
    "محمد أحمد",
    "الصف السادس",
    "201000000000",
    "حاضر"
  );
}

/* =========================
   LOGIN
========================= */

app.post("/api/login", (req, res) => {

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

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE users
    SET last_seen = ?
    WHERE id = ?
  `).run(now, user.id);

  user.last_seen = now;

  res.json(user);
});

/* =========================
   USER ACTIVITY
========================= */

app.post("/api/activity", (req, res) => {

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

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE users
    SET last_seen = ?
    WHERE id = ?
  `).run(now, user_id);

  res.json({
    success: true,
    last_seen: now
  });
});

/* =========================
   GET USERS
========================= */

app.get("/api/users", (req, res) => {

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

  res.json(result);
});

/* =========================
   ADD USER
========================= */

app.post("/api/users", (req, res) => {

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

  try {

    const result = db.prepare(`
      INSERT INTO users(
        username,
        password,
        role,
        name,
        active,
        last_seen
      )
      VALUES(?,?,?,?,1,NULL)
    `).run(
      username,
      password,
      role,
      name
    );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });

  } catch (error) {

    res.status(400).json({
      error: "اسم المستخدم موجود بالفعل"
    });
  }
});

/* =========================
   DISABLE USER
========================= */

app.patch("/api/users/:id/disable", (req, res) => {

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
      error: "لا يمكن إيقاف حساب المدير الرئيسي"
    });
  }

  db.prepare(`
    UPDATE users
    SET active = 0
    WHERE id = ?
  `).run(req.params.id);

  res.json({
    success: true,
    message: "تم إيقاف المستخدم"
  });
});

/* =========================
   ENABLE USER
========================= */

app.patch("/api/users/:id/enable", (req, res) => {

  const user = db.prepare(`
    SELECT id
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
  `).run(req.params.id);

  res.json({
    success: true,
    message: "تم تفعيل المستخدم"
  });
});

/* =========================
   DELETE USER
========================= */

app.delete("/api/users/:id", (req, res) => {

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
  `).run(req.params.id);

  res.json({
    success: true,
    message: "تم حذف المستخدم"
  });
});

/* =========================
   STUDENTS
========================= */

app.get("/api/students", (req, res) => {

  const students = db.prepare(`
    SELECT *
    FROM students
    ORDER BY id DESC
  `).all();

  res.json(students);
});

/* =========================
   ADD STUDENT
========================= */

app.post("/api/students", (req, res) => {

  const {
    name,
    class_name,
    parent_phone
  } = req.body || {};

  if (!name || !class_name || !parent_phone) {
    return res.status(400).json({
      error: "أكمل بيانات الطالب"
    });
  }

  const result = db.prepare(`
    INSERT INTO students(
      name,
      class_name,
      parent_phone,
      status
    )
    VALUES(?,?,?,'حاضر')
  `).run(
    name,
    class_name,
    parent_phone
  );

  res.json({
    success: true,
    id: result.lastInsertRowid
  });
});

/* =========================
   ATTENDANCE
========================= */

app.patch("/api/students/:id/status", (req, res) => {

  const student = db.prepare(`
    SELECT status
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
    req.params.id
  );

  res.json({
    success: true,
    status
  });
});

/* =========================
   NOTES
========================= */

app.post("/api/notes", (req, res) => {

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
    SELECT id
    FROM students
    WHERE id = ?
  `).get(student_id);

  if (!student) {
    return res.status(404).json({
      error: "الطالب غير موجود"
    });
  }

  const now =
    new Date().toLocaleString("ar-EG");

  const result = db.prepare(`
    INSERT INTO notes(
      student_id,
      text,
      created_at
    )
    VALUES(?,?,?)
  `).run(
    student_id,
    text,
    now
  );

  res.json({
    success: true,
    id: result.lastInsertRowid,
    whatsapp_status: "pending_api_connection"
  });
});

/* =========================
   GET NOTES
========================= */

app.get("/api/notes/:studentId", (req, res) => {

  const notes = db.prepare(`
    SELECT
      n.id,
      n.student_id,
      n.text,
      n.created_at,
      s.name AS student_name
    FROM notes n
    JOIN students s
      ON s.id = n.student_id
    WHERE n.student_id = ?
    ORDER BY n.id DESC
  `).all(req.params.studentId);

  res.json(notes);
});

/* =========================
   VIDEOS
========================= */

app.post("/api/videos", (req, res) => {

  const {
    title,
    file_name
  } = req.body || {};

  if (!title) {
    return res.status(400).json({
      error: "اكتب اسم الحصة"
    });
  }

  const now =
    new Date().toLocaleString("ar-EG");

  const result = db.prepare(`
    INSERT INTO videos(
      title,
      file_name,
      created_at
    )
    VALUES(?,?,?)
  `).run(
    title,
    file_name || "",
    now
  );

  res.json({
    success: true,
    id: result.lastInsertRowid
  });
});

/* =========================
   GET VIDEOS
========================= */

app.get("/api/videos", (req, res) => {

  const videos = db.prepare(`
    SELECT *
    FROM videos
    ORDER BY id DESC
  `).all();

  res.json(videos);
});

/* =========================
   HEALTH CHECK
========================= */

app.get("/api/health", (req, res) => {

  res.json({
    success: true,
    message: "School portal is running"
  });
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {

  console.log(
    "School portal running on port " + PORT
  );

});
