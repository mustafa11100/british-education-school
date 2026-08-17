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
   إضافة الأعمدة لو كانت قاعدة البيانات قديمة
========================= */

try {
  db.prepare("ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE users ADD COLUMN last_seen TEXT").run();
} catch (e) {}

/* =========================
   USERS DEFAULT
========================= */

const count = db.prepare("SELECT COUNT(*) c FROM users").get().c;

if (!count) {
  const add = db.prepare(`
    INSERT INTO users(username,password,role,name,active,last_seen)
    VALUES(?,?,?,?,1,NULL)
  `);

  add.run("admin", "1234", "admin", "مدير المدرسة");
  add.run("teacher", "1234", "teacher", "الأستاذ أحمد");
  add.run("parent", "1234", "parent", "ولي أمر محمد أحمد");
  add.run("student", "1234", "student", "محمد أحمد");
}

/* =========================
   DEFAULT STUDENT
========================= */

if (db.prepare("SELECT COUNT(*) c FROM students").get().c === 0) {
  db.prepare(`
    INSERT INTO students(name,class_name,parent_phone,status)
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

  const u = db.prepare(`
    SELECT id,username,role,name,active,last_seen
    FROM users
    WHERE username=? AND password=?
  `).get(username, password);

  if (!u) {
    return res.status(401).json({
      error: "بيانات الدخول غير صحيحة"
    });
  }

  if (!u.active) {
    return res.status(403).json({
      error: "هذا الحساب موقوف من الإدارة"
    });
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE users
    SET last_seen=?
    WHERE id=?
  `).run(now, u.id);

  u.last_seen = now;

  res.json(u);
});

/* =========================
   UPDATE USER ACTIVITY
========================= */

app.post("/api/activity", (req, res) => {

  const { user_id } = req.body || {};

  if (!user_id) {
    return res.status(400).json({
      error: "user_id مطلوب"
    });
  }

  const user = db.prepare(`
    SELECT id,active
    FROM users
    WHERE id=?
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
    SET last_seen=?
    WHERE id=?
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

      const lastSeen = new Date(user.last_seen).getTime();

      /* يعتبر المستخدم متصل إذا كان آخر نشاط خلال آخر 60 ثانية */

      online =
        user.active === 1 &&
        (now - lastSeen) <= 60000;
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
    SELECT id,username
    FROM users
    WHERE id=?
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
    SET active=0
    WHERE id=?
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
    WHERE id=?
  `).get(req.params.id);

  if (!user) {
    return res.status(404).json({
      error: "المستخدم غير موجود"
    });
  }

  db.prepare(`
    UPDATE users
    SET active=1
    WHERE id=?
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
    SELECT id,username
    FROM users
    WHERE id=?
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
    WHERE id=?
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

  const r = db.prepare(`
    INSERT INTO students(
      name,
      class_name,
      parent_phone
    )
    VALUES(?,?,?)
  `).run(
    name,
    class_name,
    parent_phone
  );

  res.json({
    id: r.lastInsertRowid
  });
});

/* =========================
   STUDENT ATTENDANCE
========================= */

app.patch("/api/students/:id/status", (req, res) => {

  const s = db.prepare(`
    SELECT status
    FROM students
    WHERE id=?
  `).get(req.params.id);

  if (!s) {
    return res.sendStatus(404);
  }

  const status =
    s.status === "حاضر"
      ? "غائب"
      : "حاضر";

  db.prepare(`
    UPDATE students
    SET status=?
    WHERE id=?
  `).run(
    status,
    req.params.id
  );

  res.json({
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

  const now =
    new Date().toLocaleString("ar-EG");

  const r = db.prepare(`
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
    id: r.lastInsertRowid,
    whatsapp_status: "pending_api_connection"
  });
});

app.get("/api/notes/:studentId", (req, res) => {

  const notes = db.prepare(`
    SELECT
      n.*,
      s.name student_name
    FROM notes n
    JOIN students s
      ON s.id=n.student_id
    WHERE student_id=?
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

  const r = db.prepare(`
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
    id: r.lastInsertRowid
  });
});

app.get("/api/videos", (req, res) => {

  const videos = db.prepare(`
    SELECT *
    FROM videos
    ORDER BY id DESC
  `).all();

  res.json(videos);
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    "School portal running on port " + PORT
  );
});
