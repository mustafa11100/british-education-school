const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* =====================================================
   DATA
===================================================== */

const DATA_DIR = path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DATA_FILE = path.join(DATA_DIR, "database.json");

const defaultData = {
  users: [
    {
      id: 1,
      name: "المدير الرئيسي",
      username: "admin",
      password: "1234",
      role: "admin",
      active: true,
      last_seen: null
    },
    {
      id: 2,
      name: "المدرس",
      username: "teacher",
      password: "1234",
      role: "teacher",
      active: true,
      last_seen: null
    },
    {
      id: 3,
      name: "ولي الأمر",
      username: "parent",
      password: "1234",
      role: "parent",
      active: true,
      last_seen: null
    },
    {
      id: 4,
      name: "الطالب",
      username: "student",
      password: "1234",
      role: "student",
      active: true,
      last_seen: null
    }
  ],

  students: [],

  employees: [],

  attendance: [],

  notes: [],

  videos: [],

  deductions: [],

  bonuses: [],

  audit_logs: [],

  payroll_settings: {
    absence_deduction: 0,
    late_deduction: 0,
    allowed_late_minutes: 15,
    work_start: "08:00"
  }
};

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(defaultData, null, 2)
      );

      return JSON.parse(
        JSON.stringify(defaultData)
      );
    }

    const raw = fs.readFileSync(
      DATA_FILE,
      "utf8"
    );

    const data = JSON.parse(raw);

    return {
      ...defaultData,
      ...data,
      users: data.users || [],
      students: data.students || [],
      employees: data.employees || [],
      attendance: data.attendance || [],
      notes: data.notes || [],
      videos: data.videos || [],
      deductions: data.deductions || [],
      bonuses: data.bonuses || [],
      audit_logs: data.audit_logs || [],
      payroll_settings: {
        ...defaultData.payroll_settings,
        ...(data.payroll_settings || {})
      }
    };
  } catch (error) {
    console.error("Database error:", error);

    return JSON.parse(
      JSON.stringify(defaultData)
    );
  }
}

let db = loadData();

function saveData() {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(db, null, 2)
  );
}

function nextId(items) {
  if (!items.length) return 1;

  return (
    Math.max(
      ...items.map(item =>
        Number(item.id) || 0
      )
    ) + 1
  );
}

function now() {
  return new Date().toISOString();
}

function addLog(
  userId,
  action,
  details = ""
) {
  const user =
    db.users.find(
      item =>
        Number(item.id) ===
        Number(userId)
    );

  db.audit_logs.unshift({
    id: nextId(db.audit_logs),
    user_id: userId || null,
    user_name:
      user?.name || "النظام",
    action,
    details,
    created_at: now()
  });

  if (db.audit_logs.length > 1000) {
    db.audit_logs =
      db.audit_logs.slice(0, 1000);
  }
}

/* =====================================================
   AUTH HELPERS
===================================================== */

function findUser(id) {
  return db.users.find(
    user =>
      Number(user.id) ===
      Number(id)
  );
}

function requireAdmin(req, res, next) {
  const userId =
    req.headers["x-user-id"];

  const user =
    findUser(userId);

  if (!user) {
    return res.status(401).json({
      error: "يجب تسجيل الدخول"
    });
  }

  if (!user.active) {
    return res.status(403).json({
      error: "الحساب موقوف"
    });
  }

  if (user.role !== "admin") {
    return res.status(403).json({
      error: "غير مصرح"
    });
  }

  req.user = user;

  next();
}

/* =====================================================
   LOGIN
===================================================== */

app.post("/api/login", (req, res) => {
  const {
    username,
    password
  } = req.body;

  const user =
    db.users.find(
      item =>
        item.username ===
          String(username || "").trim() &&
        item.password ===
          String(password || "")
    );

  if (!user) {
    return res.status(401).json({
      error:
        "اسم المستخدم أو كلمة المرور غير صحيحة"
    });
  }

  if (!user.active) {
    return res.status(403).json({
      error: "الحساب موقوف"
    });
  }

  user.last_seen = now();

  addLog(
    user.id,
    "تسجيل دخول",
    "تم تسجيل الدخول"
  );

  saveData();

  res.json({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    active: user.active,
    last_seen: user.last_seen
  });
});

/* =====================================================
   ACTIVITY
===================================================== */

app.post(
  "/api/activity",
  (req, res) => {
    const user =
      findUser(
        req.body.user_id
      );

    if (!user) {
      return res.status(401).json({
        error: "الحساب غير موجود"
      });
    }

    if (!user.active) {
      return res.status(403).json({
        error: "الحساب موقوف"
      });
    }

    user.last_seen = now();

    saveData();

    res.json({
      success: true,
      last_seen: user.last_seen
    });
  }
);

/* =====================================================
   USERS
===================================================== */

app.get(
  "/api/users",
  requireAdmin,
  (req, res) => {
    const currentTime =
      Date.now();

    const users =
      db.users.map(user => ({
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        active: user.active,
        last_seen: user.last_seen,
        online:
          user.active &&
          user.last_seen &&
          currentTime -
            new Date(
              user.last_seen
            ).getTime() <
            60000
      }));

    res.json(users);
  }
);

app.post(
  "/api/users",
  requireAdmin,
  (req, res) => {
    const {
      name,
      username,
      password,
      role
    } = req.body;

    if (
      !name ||
      !username ||
      !password ||
      !role
    ) {
      return res.status(400).json({
        error:
          "أكمل بيانات المستخدم"
      });
    }

    const exists =
      db.users.find(
        user =>
          user.username ===
          username
      );

    if (exists) {
      return res.status(400).json({
        error:
          "اسم المستخدم موجود بالفعل"
      });
    }

    const user = {
      id: nextId(db.users),
      name,
      username,
      password,
      role,
      active: true,
      last_seen: null
    };

    db.users.push(user);

    addLog(
      req.user.id,
      "إضافة مستخدم",
      username
    );

    saveData();

    res.json({
      success: true,
      user
    });
  }
);

app.patch(
  "/api/users/:id/disable",
  requireAdmin,
  (req, res) => {
    const user =
      findUser(req.params.id);

    if (!user) {
      return res.status(404).json({
        error:
          "المستخدم غير موجود"
      });
    }

    if (user.username === "admin") {
      return res.status(400).json({
        error:
          "لا يمكن إيقاف المدير الرئيسي"
      });
    }

    user.active = false;

    addLog(
      req.user.id,
      "إيقاف مستخدم",
      user.username
    );

    saveData();

    res.json({
      success: true
    });
  }
);

app.patch(
  "/api/users/:id/enable",
  requireAdmin,
  (req, res) => {
    const user =
      findUser(req.params.id);

    if (!user) {
      return res.status(404).json({
        error:
          "المستخدم غير موجود"
      });
    }

    user.active = true;

    addLog(
      req.user.id,
      "تفعيل مستخدم",
      user.username
    );

    saveData();

    res.json({
      success: true
    });
  }
);

app.delete(
  "/api/users/:id",
  requireAdmin,
  (req, res) => {
    const user =
      findUser(req.params.id);

    if (!user) {
      return res.status(404).json({
        error:
          "المستخدم غير موجود"
      });
    }

    if (user.username === "admin") {
      return res.status(400).json({
        error:
          "لا يمكن حذف المدير الرئيسي"
      });
    }

    db.users =
      db.users.filter(
        item =>
          Number(item.id) !==
          Number(req.params.id)
      );

    addLog(
      req.user.id,
      "حذف مستخدم",
      user.username
    );

    saveData();

    res.json({
      success: true
    });
  }
);

/* =====================================================
   PASSWORD
===================================================== */

app.patch(
  "/api/users/:id/password",
  (req, res) => {
    const user =
      findUser(req.params.id);

    if (!user) {
      return res.status(404).json({
        error:
          "المستخدم غير موجود"
      });
    }

    const {
      current_password,
      new_password
    } = req.body;

    if (!new_password) {
      return res.status(400).json({
        error:
          "أدخل كلمة المرور الجديدة"
      });
    }

    if (
      current_password &&
      user.password !==
        current_password
    ) {
      return res.status(400).json({
        error:
          "كلمة المرور الحالية غير صحيحة"
      });
    }

    user.password =
      new_password;

    saveData();

    res.json({
      success: true
    });
  }
);

/* =====================================================
   STUDENTS
===================================================== */

app.get(
  "/api/students",
  (req, res) => {
    res.json(db.students);
  }
);

app.post(
  "/api/students",
  requireAdmin,
  (req, res) => {
    const {
      name,
      class_name,
      parent_phone
    } = req.body;

    if (!name || !class_name) {
      return res.status(400).json({
        error:
          "أدخل اسم الطالب والفصل"
      });
    }

    const student = {
      id: nextId(db.students),
      name,
      class_name,
      parent_phone:
        parent_phone || "",
      status: "حاضر"
    };

    db.students.push(student);

    addLog(
      req.user.id,
      "إضافة طالب",
      name
    );

    saveData();

    res.json(student);
  }
);

app.delete(
  "/api/students/:id",
  requireAdmin,
  (req, res) => {
    const id =
      Number(req.params.id);

    const student =
      db.students.find(
        item =>
          Number(item.id) === id
      );

    if (!student) {
      return res.status(404).json({
        error:
          "الطالب غير موجود"
      });
    }

    db.students =
      db.students.filter(
        item =>
          Number(item.id) !== id
      );

    db.attendance =
      db.attendance.filter(
        item =>
          Number(item.student_id) !==
          id
      );

    db.notes =
      db.notes.filter(
        item =>
          Number(item.student_id) !==
          id
      );

    addLog(
      req.user.id,
      "حذف طالب",
      student.name
    );

    saveData();

    res.json({
      success: true
    });
  }
);

/* =====================================================
   STUDENT STATUS
===================================================== */

app.patch(
  "/api/students/:id/status",
  (req, res) => {
    const student =
      db.students.find(
        item =>
          Number(item.id) ===
          Number(req.params.id)
      );

    if (!student) {
      return res.status(404).json({
        error:
          "الطالب غير موجود"
      });
    }

    const statuses = [
      "حاضر",
      "غائب",
      "متأخر"
    ];

    const current =
      statuses.indexOf(
        student.status
      );

    student.status =
      statuses[
        (current + 1) %
          statuses.length
      ];

    db.attendance.push({
      id: nextId(db.attendance),
      student_id: student.id,
      date:
        new Date()
          .toISOString()
          .slice(0, 10),
      status: student.status
    });

    saveData();

    res.json({
      success: true,
      status: student.status
    });
  }
);

/* =====================================================
   STUDENT ATTENDANCE
===================================================== */

app.get(
  "/api/students/:id/attendance",
  (req, res) => {
    const id =
      Number(req.params.id);

    const records =
      db.attendance.filter(
        item =>
          Number(item.student_id) ===
          id
      );

    const present =
      records.filter(
        item =>
          item.status ===
          "حاضر"
      ).length;

    const absent =
      records.filter(
        item =>
          item.status ===
          "غائب"
      ).length;

    const percentage =
      records.length
        ? Math.round(
            (present /
              records.length) *
              100
          )
        : 0;

    res.json({
      present,
      absent,
      percentage,
      records
    });
  }
);

/* =====================================================
   EMPLOYEES
===================================================== */

app.get(
  "/api/employees",
  (req, res) => {
    const employees =
      db.employees.map(
        employee => {
          const user =
            findUser(
              employee.user_id
            );

          return {
            ...employee,
            username:
              user?.username || null
          };
        }
      );

    res.json(employees);
  }
);

app.post(
  "/api/employees",
  requireAdmin,
  (req, res) => {
    const employee = {
      id:
        nextId(db.employees),

      employee_number:
        req.body.employee_number ||
        "",

      name:
        req.body.name || "",

      job_title:
        req.body.job_title ||
        "",

      department:
        req.body.department ||
        "",

      phone:
        req.body.phone || "",

      hire_date:
        req.body.hire_date || "",

      basic_salary:
        Number(
          req.body.basic_salary ||
            0
        ),

      allowance:
        Number(
          req.body.allowance ||
            0
        ),

      user_id:
        req.body.user_id
          ? Number(
              req.body.user_id
            )
          : null
    };

    if (!employee.name) {
      return res.status(400).json({
        error:
          "أدخل اسم الموظف"
      });
    }

    db.employees.push(employee);

    addLog(
      req.user.id,
      "إضافة موظف",
      employee.name
    );

    saveData();

    res.json(employee);
  }
);

/* =====================================================
   EMPLOYEE ATTENDANCE
===================================================== */

app.get(
  "/api/employees/:id/attendance",
  (req, res) => {
    const employeeId =
      Number(req.params.id);

    const records =
      db.attendance.filter(
        item =>
          Number(
            item.employee_id
          ) === employeeId
      );

    const present =
      records.filter(
        item =>
          item.status ===
          "حاضر"
      ).length;

    const absent =
      records.filter(
        item =>
          item.status ===
          "غائب"
      ).length;

    const late =
      records.filter(
        item =>
          item.status ===
          "متأخر"
      ).length;

    res.json({
      present,
      absent,
      late,
      records
    });
  }
);

/* =====================================================
   DEDUCTIONS
===================================================== */

app.get(
  "/api/employees/:id/deductions",
  (req, res) => {
    res.json(
      db.deductions.filter(
        item =>
          Number(
            item.employee_id
          ) ===
          Number(req.params.id)
      )
    );
  }
);

app.post(
  "/api/employees/:id/deductions",
  requireAdmin,
  (req, res) => {
    const item = {
      id:
        nextId(db.deductions),

      employee_id:
        Number(req.params.id),

      amount:
        Number(req.body.amount || 0),

      reason:
        req.body.reason || "",

      date:
        new Date()
          .toISOString()
          .slice(0, 10),

      automatic: false
    };

    if (
      item.amount <= 0 ||
      !item.reason
    ) {
      return res.status(400).json({
        error:
          "أدخل مبلغ وسبب الخصم"
      });
    }

    db.deductions.push(item);

    saveData();

    res.json(item);
  }
);

app.delete(
  "/api/deductions/:id",
  requireAdmin,
  (req, res) => {
    db.deductions =
      db.deductions.filter(
        item =>
          Number(item.id) !==
          Number(req.params.id)
      );

    saveData();

    res.json({
      success: true
    });
  }
);

/* =====================================================
   BONUSES
===================================================== */

app.get(
  "/api/employees/:id/bonuses",
  (req, res) => {
    res.json(
      db.bonuses.filter(
        item =>
          Number(
            item.employee_id
          ) ===
          Number(req.params.id)
      )
    );
  }
);

app.post(
  "/api/employees/:id/bonuses",
  requireAdmin,
  (req, res) => {
    const item = {
      id:
        nextId(db.bonuses),

      employee_id:
        Number(req.params.id),

      amount:
        Number(req.body.amount || 0),

      reason:
        req.body.reason || "",

      date:
        new Date()
          .toISOString()
          .slice(0, 10)
    };

    if (
      item.amount <= 0 ||
      !item.reason
    ) {
      return res.status(400).json({
        error:
          "أدخل مبلغ وسبب المكافأة"
      });
    }

    db.bonuses.push(item);

    saveData();

    res.json(item);
  }
);

app.delete(
  "/api/bonuses/:id",
  requireAdmin,
  (req, res) => {
    db.bonuses =
      db.bonuses.filter(
        item =>
          Number(item.id) !==
          Number(req.params.id)
      );

    saveData();

    res.json({
      success: true
    });
  }
);

/* =====================================================
   PAYROLL
===================================================== */

app.get(
  "/api/payroll",
  requireAdmin,
  (req, res) => {
    const employees =
      db.employees.map(
        employee => {

          const bonuses =
            db.bonuses
              .filter(
                item =>
                  Number(
                    item.employee_id
                  ) ===
                  Number(
                    employee.id
                  )
              )
              .reduce(
                (sum, item) =>
                  sum +
                  Number(
                    item.amount || 0
                  ),
                0
              );

          const deductions =
            db.deductions
              .filter(
                item =>
                  Number(
                    item.employee_id
                  ) ===
                  Number(
                    employee.id
                  )
              )
              .reduce(
                (sum, item) =>
                  sum +
                  Number(
                    item.amount || 0
                  ),
                0
              );

          const basic =
            Number(
              employee.basic_salary ||
                0
            );

          const allowance =
            Number(
              employee.allowance ||
                0
            );

          const gross =
            basic +
            allowance +
            bonuses;

          const net =
            gross -
            deductions;

          return {
            ...employee,
            bonuses,
            deductions,
            gross,
            net
          };
        }
      );

    res.json({
      month:
        req.query.month || "",
      employees
    });
  }
);

/* =====================================================
   PAYROLL SETTINGS
===================================================== */

app.get(
  "/api/payroll-settings",
  requireAdmin,
  (req, res) => {
    res.json(
      db.payroll_settings
    );
  }
);

app.patch(
  "/api/payroll-settings",
  requireAdmin,
  (req, res) => {
    db.payroll_settings = {
      ...db.payroll_settings,

      absence_deduction:
        Number(
          req.body.absence_deduction ||
            0
        ),

      late_deduction:
        Number(
          req.body.late_deduction ||
            0
        ),

      allowed_late_minutes:
        Number(
          req.body.allowed_late_minutes ||
            0
        ),

      work_start:
        req.body.work_start ||
        "08:00"
    };

    saveData();

    res.json({
      success: true,
      settings:
        db.payroll_settings
    });
  }
);

/* =====================================================
   ADMIN SUMMARY
===================================================== */

app.get(
  "/api/admin/summary",
  requireAdmin,
  (req, res) => {

    const currentTime =
      Date.now();

    const onlineUsers =
      db.users.filter(
        user =>
          user.active &&
          user.last_seen &&
          currentTime -
            new Date(
              user.last_seen
            ).getTime() <
            60000
      ).length;

    res.json({
      students:
        db.students.length,

      present:
        db.students.filter(
          student =>
            student.status ===
            "حاضر"
        ).length,

      absent:
        db.students.filter(
          student =>
            student.status ===
            "غائب"
        ).length,

      employees:
        db.employees.length,

      users:
        db.users.length,

      online:
        onlineUsers
    });
  }
);

/* =====================================================
   AUDIT LOGS
===================================================== */

app.get(
  "/api/audit-logs",
  requireAdmin,
  (req, res) => {
    res.json(
      db.audit_logs
    );
  }
);

/* =====================================================
   NOTES
===================================================== */

app.post(
  "/api/notes",
  (req, res) => {
    const {
      student_id,
      text
    } = req.body;

    if (!student_id || !text) {
      return res.status(400).json({
        error:
          "بيانات الملاحظة ناقصة"
      });
    }

    const note = {
      id:
        nextId(db.notes),

      student_id:
        Number(student_id),

      text,

      created_at: now()
    };

    db.notes.push(note);

    saveData();

    res.json(note);
  }
);

app.get(
  "/api/notes/:studentId",
  (req, res) => {
    res.json(
      db.notes.filter(
        item =>
          Number(
            item.student_id
          ) ===
          Number(
            req.params.studentId
          )
      )
    );
  }
);

/* =====================================================
   VIDEOS
===================================================== */

app.get(
  "/api/videos",
  (req, res) => {
    res.json(
      db.videos
    );
  }
);

app.post(
  "/api/videos",
  (req, res) => {
    const video = {
      id:
        nextId(db.videos),

      title:
        req.body.title || "",

      file_name:
        req.body.file_name || "",

      created_at:
        now()
    };

    if (!video.title) {
      return res.status(400).json({
        error:
          "اكتب اسم الحصة"
      });
    }

    db.videos.push(video);

    saveData();

    res.json(video);
  }
);

/* =====================================================
   HEALTH CHECK
===================================================== */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      success: true,
      message:
        "School portal is running"
    });
  }
);

/* =====================================================
   STATIC FILES
===================================================== */

const publicDir =
  path.join(
    __dirname,
    "public"
  );

if (
  fs.existsSync(publicDir)
) {
  app.use(
    express.static(
      publicDir
    )
  );

  app.get(
    "*",
    (req, res, next) => {

      if (
        req.path.startsWith(
          "/api/"
        )
      ) {
        return next();
      }

      const indexFile =
        path.join(
          publicDir,
          "index.html"
        );

      if (
        fs.existsSync(indexFile)
      ) {
        return res.sendFile(
          indexFile
        );
      }

      next();
    }
  );
}

/* =====================================================
   404
===================================================== */

app.use(
  (req, res) => {
    res.status(404).json({
      error:
        "المسار غير موجود"
    });
  }
);

/* =====================================================
   ERROR HANDLER
===================================================== */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    console.error(error);

    res.status(500).json({
      error:
        "حدث خطأ في الخادم"
    });
  }
);

/* =====================================================
   START
===================================================== */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `School portal running on port ${PORT}`
    );

  }
);
