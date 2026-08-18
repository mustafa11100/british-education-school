const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "school-data.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_DATA = {
  settings: {
    schoolName: "نظام إدارة المدرسة",
    schoolEmail: "",
    schoolPhone: "",
    currency: "ريال",
    academicYear: "2026 / 2027",
    feeReminderDays: 7
  },

  users: [],

  students: [],

  fees: [],

  notifications: [],

  sessions: []
};

function loadData() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }

    const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

    return {
      ...DEFAULT_DATA,
      ...data,
      settings: {
        ...DEFAULT_DATA.settings,
        ...(data.settings || {})
      },
      users: Array.isArray(data.users) ? data.users : [],
      students: Array.isArray(data.students) ? data.students : [],
      fees: Array.isArray(data.fees) ? data.fees : [],
      notifications: Array.isArray(data.notifications)
        ? data.notifications
        : [],
      sessions: Array.isArray(data.sessions) ? data.sessions : []
    };
  } catch (error) {
    console.error("DATA LOAD ERROR:", error);

    const backup = path.join(
      DATA_DIR,
      `backup-${Date.now()}.json`
    );

    try {
      fs.copyFileSync(DB_FILE, backup);
    } catch (_) {}

    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

let db = loadData();

function saveData() {
  const tempFile = DB_FILE + ".tmp";

  fs.writeFileSync(
    tempFile,
    JSON.stringify(db, null, 2),
    "utf8"
  );

  fs.renameSync(tempFile, DB_FILE);
}

function id(prefix = "") {
  return (
    prefix +
    Date.now().toString(36) +
    crypto.randomBytes(4).toString("hex")
  );
}

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(String(password))
    .digest("hex");
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function cleanUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    phone: user.phone,
    job: user.job,
    department: user.department,
    role: user.role,
    active: user.active,
    approved: user.approved,
    createdAt: user.createdAt
  };
}

function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });

  res.end(JSON.stringify(data));
}

function text(res, status, data, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType
  });

  res.end(data);
}

function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 5 * 1024 * 1024) {
        reject(new Error("حجم البيانات كبير جداً"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("JSON غير صالح"));
      }
    });

    req.on("error", reject);
  });
}

function getToken(req) {
  const auth = req.headers.authorization || "";

  if (auth.startsWith("Bearer ")) {
    return auth.substring(7);
  }

  return null;
}

function getCurrentUser(req) {
  const token = getToken(req);

  if (!token) return null;

  const session = db.sessions.find(
    s => s.token === token
  );

  if (!session) return null;

  const user = db.users.find(
    u => u.id === session.userId
  );

  if (!user || !user.active || !user.approved) {
    return null;
  }

  return user;
}

function requireAuth(req, res) {
  const user = getCurrentUser(req);

  if (!user) {
    json(res, 401, {
      success: false,
      message: "يجب تسجيل الدخول أولاً"
    });

    return null;
  }

  return user;
}

function requireRole(req, res, roles) {
  const user = requireAuth(req, res);

  if (!user) return null;

  if (!roles.includes(user.role)) {
    json(res, 403, {
      success: false,
      message: "ليس لديك صلاحية لتنفيذ هذا الإجراء"
    });

    return null;
  }

  return user;
}

function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase();
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function createInitialAdmin() {
  if (db.users.length > 0) return;

  const admin = {
    id: id("USR-"),
    fullName: "مدير النظام",
    username: "admin",
    email: "",
    phone: "",
    job: "مدير النظام",
    department: "الإدارة",
    role: "admin",
    passwordHash: hashPassword("123456"),
    active: true,
    approved: true,
    mustChangePassword: true,
    createdAt: new Date().toISOString()
  };

  db.users.push(admin);
  saveData();

  console.log("=================================");
  console.log("INITIAL ADMIN CREATED");
  console.log("Username: admin");
  console.log("Password: 123456");
  console.log("=================================");
}

createInitialAdmin();

function hasPermission(user, permission) {
  const permissions = {
    admin: [
      "dashboard",
      "users",
      "students",
      "fees",
      "notifications",
      "settings"
    ],

    programmer: [
      "dashboard",
      "users",
      "settings"
    ],

    operations: [
      "dashboard",
      "students",
      "fees",
      "notifications"
    ],

    quality: [
      "dashboard",
      "students",
      "notifications"
    ],

    supervisor: [
      "dashboard",
      "students",
      "fees",
      "notifications"
    ],

    teacher: [
      "dashboard",
      "students"
    ],

    accountant: [
      "dashboard",
      "students",
      "fees",
      "notifications"
    ],

    parent: [
      "dashboard",
      "fees",
      "notifications"
    ]
  };

  return (permissions[user.role] || []).includes(permission);
}

function calculateFeeStatus(fee) {
  const total = Number(fee.totalAmount || 0);
  const paid = Number(fee.paidAmount || 0);
  const remaining = Math.max(total - paid, 0);

  if (remaining <= 0) {
    return "paid";
  }

  const dueDate = fee.nextDueDate
    ? new Date(fee.nextDueDate)
    : null;

  if (dueDate && dueDate < new Date()) {
    return "overdue";
  }

  return "pending";
}

function enrichFee(fee) {
  const student = db.students.find(
    s => s.id === fee.studentId
  );

  const status = calculateFeeStatus(fee);

  return {
    ...fee,
    studentName: student ? student.fullName : "غير معروف",
    remainingAmount: Math.max(
      Number(fee.totalAmount || 0) -
      Number(fee.paidAmount || 0),
      0
    ),
    status
  };
}

function createFeeNotification(fee, student, type = "reminder") {
  if (!student || !student.parentEmail) return;

  let title = "";
  let message = "";

  if (type === "overdue") {
    title = "قسط دراسي متأخر";

    message =
      `نود تذكيركم بأن قسط الطالب ${student.fullName} ` +
      `متأخر عن موعد السداد. ` +
      `المبلغ المتبقي: ${fee.remainingAmount} ${db.settings.currency}.`;
  } else {
    title = "موعد سداد القسط يقترب";

    message =
      `نود تذكيركم بأن موعد سداد الدفعة القادمة ` +
      `للطالب ${student.fullName} يقترب. ` +
      `قيمة الدفعة: ${fee.nextInstallmentAmount || 0} ${db.settings.currency}. ` +
      `إجمالي المبلغ المتبقي: ${fee.remainingAmount} ${db.settings.currency}. ` +
      `تاريخ الاستحقاق: ${fee.nextDueDate || "غير محدد"}.`;
  }

  const exists = db.notifications.find(
    n =>
      n.studentId === student.id &&
      n.type === type &&
      n.referenceId === fee.id &&
      n.createdAt &&
      new Date(n.createdAt).toDateString() ===
        new Date().toDateString()
  );

  if (exists) return;

  db.notifications.push({
    id: id("NOT-"),
    studentId: student.id,
    parentEmail: student.parentEmail,
    type,
    title,
    message,
    referenceId: fee.id,
    read: false,
    emailSent: false,
    createdAt: new Date().toISOString()
  });

  saveData();

  /*
    البريد الإلكتروني الحقيقي سيتم ربطه في المرحلة التالية
    عن طريق SMTP / خدمة بريد.
  */
}

function runFeeReminders() {
  const today = new Date();

  db.fees.forEach(fee => {
    const student = db.students.find(
      s => s.id === fee.studentId
    );

    if (!student) return;

    const enriched = enrichFee(fee);

    if (
      enriched.status === "paid" ||
      !fee.nextDueDate
    ) {
      return;
    }

    const due = new Date(fee.nextDueDate);

    const diff =
      Math.ceil(
        (due.getTime() - today.getTime()) /
        (1000 * 60 * 60 * 24)
      );

    const reminderDays =
      Number(db.settings.feeReminderDays || 7);

    if (diff >= 0 && diff <= reminderDays) {
      createFeeNotification(
        enriched,
        student,
        "reminder"
      );
    }

    if (diff < 0) {
      createFeeNotification(
        enriched,
        student,
        "overdue"
      );
    }
  });
}

setInterval(() => {
  try {
    runFeeReminders();
  } catch (error) {
    console.error("REMINDER ERROR:", error);
  }
}, 60 * 60 * 1000);

async function router(req, res) {
  const url = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`
  );

  const pathname = url.pathname;
  const method = req.method.toUpperCase();

  /*
   * HEALTH
   */

  if (method === "GET" && pathname === "/api/health") {
    return json(res, 200, {
      success: true,
      message: "School portal is running",
      time: new Date().toISOString()
    });
  }

  /*
   * REGISTER
   */

  if (
    method === "POST" &&
    pathname === "/api/auth/register"
  ) {
    try {
      const body = await getBody(req);

      const fullName = String(body.fullName || "").trim();
      const username = normalizeUsername(body.username);
      const email = normalizeEmail(body.email);
      const phone = String(body.phone || "").trim();
      const password = String(body.password || "");
      const job = String(body.job || "").trim();
      const department = String(body.department || "").trim();

      if (
        !fullName ||
        !username ||
        !email ||
        !password ||
        !job
      ) {
        return json(res, 400, {
          success: false,
          message:
            "الاسم واسم المستخدم والإيميل وكلمة المرور والوظيفة مطلوبة"
        });
      }

      if (password.length < 6) {
        return json(res, 400, {
          success: false,
          message:
            "كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل"
        });
      }

      if (
        db.users.some(
          u => u.username === username
        )
      ) {
        return json(res, 409, {
          success: false,
          message: "اسم المستخدم مستخدم بالفعل"
        });
      }

      if (
        db.users.some(
          u => u.email === email
        )
      ) {
        return json(res, 409, {
          success: false,
          message: "البريد الإلكتروني مستخدم بالفعل"
        });
      }

      const allowedRequestedRoles = [
        "teacher",
        "accountant",
        "operations",
        "quality",
        "supervisor",
        "parent"
      ];

      const requestedRole =
        String(body.role || "teacher");

      const role = allowedRequestedRoles.includes(
        requestedRole
      )
        ? requestedRole
        : "teacher";

      const user = {
        id: id("USR-"),
        fullName,
        username,
        email,
        phone,
        job,
        department,
        role,
        passwordHash: hashPassword(password),

        active: true,

        /*
          التسجيل الجديد لا يعطي صلاحيات الإدارة
          ولا يستطيع الشخص إنشاء نفسه كمدير.
        */
        approved: false,

        mustChangePassword: false,

        createdAt: new Date().toISOString()
      };

      db.users.push(user);
      saveData();

      return json(res, 201, {
        success: true,
        message:
          "تم إنشاء الحساب، وهو الآن بانتظار موافقة الإدارة",
        user: cleanUser(user)
      });
    } catch (error) {
      console.error(error);

      return json(res, 500, {
        success: false,
        message: "حدث خطأ أثناء إنشاء الحساب"
      });
    }
  }

  /*
   * LOGIN
   */

  if (
    method === "POST" &&
    pathname === "/api/auth/login"
  ) {
    try {
      const body = await getBody(req);

      const username = normalizeUsername(
        body.username
      );

      const password = String(
        body.password || ""
      );

      const user = db.users.find(
        u => u.username === username
      );

      if (!user) {
        return json(res, 401, {
          success: false,
          message:
            "اسم المستخدم أو كلمة المرور غير صحيحة"
        });
      }

      if (!user.active) {
        return json(res, 403, {
          success: false,
          message: "الحساب موقوف"
        });
      }

      if (!user.approved) {
        return json(res, 403, {
          success: false,
          message:
            "الحساب لم تتم الموافقة عليه من الإدارة بعد"
        });
      }

      if (
        user.passwordHash !==
        hashPassword(password)
      ) {
        return json(res, 401, {
          success: false,
          message:
            "اسم المستخدم أو كلمة المرور غير صحيحة"
        });
      }

      const token = createToken();

      db.sessions = db.sessions.filter(
        s => s.userId !== user.id
      );

      db.sessions.push({
        token,
        userId: user.id,
        createdAt: new Date().toISOString()
      });

      saveData();

      return json(res, 200, {
        success: true,
        message: "تم تسجيل الدخول بنجاح",
        token,
        user: cleanUser(user),
        permissions: {
          dashboard: hasPermission(user, "dashboard"),
          users: hasPermission(user, "users"),
          students: hasPermission(user, "students"),
          fees: hasPermission(user, "fees"),
          notifications: hasPermission(
            user,
            "notifications"
          ),
          settings: hasPermission(user, "settings")
        }
      });
    } catch (error) {
      console.error(error);

      return json(res, 500, {
        success: false,
        message: "حدث خطأ أثناء تسجيل الدخول"
      });
    }
  }

  /*
   * LOGOUT
   */

  if (
    method === "POST" &&
    pathname === "/api/auth/logout"
  ) {
    const token = getToken(req);

    db.sessions = db.sessions.filter(
      s => s.token !== token
    );

    saveData();

    return json(res, 200, {
      success: true,
      message: "تم تسجيل الخروج"
    });
  }

  /*
   * CURRENT USER
   */

  if (
    method === "GET" &&
    pathname === "/api/auth/me"
  ) {
    const user = requireAuth(req, res);

    if (!user) return;

    return json(res, 200, {
      success: true,
      user: cleanUser(user),
      permissions: {
        dashboard: hasPermission(user, "dashboard"),
        users: hasPermission(user, "users"),
        students: hasPermission(user, "students"),
        fees: hasPermission(user, "fees"),
        notifications: hasPermission(
          user,
          "notifications"
        ),
        settings: hasPermission(user, "settings")
      }
    });
  }

  /*
   * CHANGE PASSWORD
   */

  if (
    method === "POST" &&
    pathname === "/api/auth/change-password"
  ) {
    const user = requireAuth(req, res);

    if (!user) return;

    try {
      const body = await getBody(req);

      const oldPassword = String(
        body.oldPassword || ""
      );

      const newPassword = String(
        body.newPassword || ""
      );

      if (
        user.passwordHash !==
        hashPassword(oldPassword)
      ) {
        return json(res, 400, {
          success: false,
          message: "كلمة المرور الحالية غير صحيحة"
        });
      }

      if (newPassword.length < 6) {
        return json(res, 400, {
          success: false,
          message:
            "كلمة المرور الجديدة يجب أن تكون 6 أحرف أو أرقام على الأقل"
        });
      }

      user.passwordHash =
        hashPassword(newPassword);

      user.mustChangePassword = false;

      saveData();

      return json(res, 200, {
        success: true,
        message: "تم تغيير كلمة المرور بنجاح"
      });
    } catch (error) {
      return json(res, 500, {
        success: false,
        message: "حدث خطأ أثناء تغيير كلمة المرور"
      });
    }
  }

  /*
   * DASHBOARD
   */

  if (
    method === "GET" &&
    pathname === "/api/dashboard"
  ) {
    const user = requireAuth(req, res);

    if (!user) return;

    if (!hasPermission(user, "dashboard")) {
      return json(res, 403, {
        success: false,
        message: "ليس لديك صلاحية لوحة التحكم"
      });
    }

    runFeeReminders();

    const totalStudents =
      db.students.length;

    const totalUsers =
      db.users.length;

    const activeUsers =
      db.users.filter(u => u.active).length;

    const totalFees =
      db.fees.reduce(
        (sum, f) =>
          sum + Number(f.totalAmount || 0),
        0
      );

    const paidFees =
      db.fees.reduce(
        (sum, f) =>
          sum + Number(f.paidAmount || 0),
        0
      );

    const remainingFees =
      Math.max(totalFees - paidFees, 0);

    const overdueFees =
      db.fees.filter(
        f => calculateFeeStatus(f) === "overdue"
      ).length;

    const pendingFees =
      db.fees.filter(
        f => calculateFeeStatus(f) === "pending"
      ).length;

    const unreadNotifications =
      db.notifications.filter(
        n => !n.read
      ).length;

    return json(res, 200, {
      success: true,
      stats: {
        totalStudents,
        totalUsers,
        activeUsers,
        totalFees,
        paidFees,
        remainingFees,
        overdueFees,
        pendingFees,
        unreadNotifications
      }
    });
  }

  /*
   * USERS
   */

  if (
    method === "GET" &&
    pathname === "/api/users"
  ) {
    const user = requireRole(
      req,
      res,
      ["admin", "programmer"]
    );

    if (!user) return;

    return json(res, 200, {
      success: true,
      users: db.users.map(cleanUser)
    });
  }

  /*
   * APPROVE USER
   */

  if (
    method === "PATCH" &&
    pathname.startsWith("/api/users/") &&
    pathname.endsWith("/approve")
  ) {
    const user = requireRole(
      req,
      res,
      ["admin"]
    );

    if (!user) return;

    const parts = pathname.split("/");
    const userId = parts[3];

    const target = db.users.find(
      u => u.id === userId
    );

    if (!target) {
      return json(res, 404, {
        success: false,
        message: "المستخدم غير موجود"
      });
    }

    target.approved = true;

    saveData();

    return json(res, 200, {
      success: true,
      message: "تم اعتماد المستخدم",
      user: cleanUser(target)
    });
  }

  /*
   * ACTIVATE / DEACTIVATE USER
   */

  if (
    method === "PATCH" &&
    pathname.startsWith("/api/users/") &&
    pathname.endsWith("/status")
  ) {
    const user = requireRole(
      req,
      res,
      ["admin"]
    );

    if (!user) return;

    try {
      const body = await getBody(req);

      const parts = pathname.split("/");
      const userId = parts[3];

      const target = db.users.find(
        u => u.id === userId
      );

      if (!target) {
        return json(res, 404, {
          success: false,
          message: "المستخدم غير موجود"
        });
      }

      target.active =
        body.active !== false;

      saveData();

      return json(res, 200, {
        success: true,
        message: "تم تحديث حالة المستخدم",
        user: cleanUser(target)
      });
    } catch (error) {
      return json(res, 400, {
        success: false,
        message: "بيانات غير صحيحة"
      });
    }
  }

  /*
   * STUDENTS - LIST
   */

  if (
    method === "GET" &&
    pathname === "/api/students"
  ) {
    const user = requireAuth(req, res);

    if (!user) return;

    if (!hasPermission(user, "students")) {
      return json(res, 403, {
        success: false,
        message: "ليس لديك صلاحية الطلاب"
      });
    }

    return json(res, 200, {
      success: true,
      students: db.students
    });
  }

  /*
   * STUDENTS - CREATE
   */

  if (
    method === "POST" &&
    pathname === "/api/students"
  ) {
    const user = requireRole(
      req,
      res,
      [
        "admin",
        "operations",
        "supervisor"
      ]
    );

    if (!user) return;

    try {
      const body = await getBody(req);

      const fullName =
        String(body.fullName || "").trim();

      if (!fullName) {
        return json(res, 400, {
          success: false,
          message: "اسم الطالب مطلوب"
        });
      }

      const student = {
        id: id("STU-"),
        studentNumber:
          body.studentNumber ||
          `ST-${Date.now()}`,

        fullName,

        className:
          String(body.className || "").trim(),

        section:
          String(body.section || "").trim(),

        gender:
          String(body.gender || "").trim(),

        birthDate:
          String(body.birthDate || "").trim(),

        parentName:
          String(body.parentName || "").trim(),

        parentEmail:
          normalizeEmail(body.parentEmail),

        parentPhone:
          String(body.parentPhone || "").trim(),

        address:
          String(body.address || "").trim(),

        status: "active",

        createdAt:
          new Date().toISOString()
      };

      db.students.push(student);

      saveData();

      return json(res, 201, {
        success: true,
        message: "تمت إضافة الطالب",
        student
      });
    } catch (error) {
      return json(res, 500, {
        success: false,
        message: "تعذر إضافة الطالب"
      });
    }
  }

  /*
   * STUDENT DETAILS
   */

  if (
    method === "GET" &&
    pathname.startsWith("/api/students/")
  ) {
    const user = requireAuth(req, res);

    if (!user) return;

    const studentId =
      pathname.split("/")[3];

    const student =
      db.students.find(
        s => s.id === studentId
      );

    if (!student) {
      return json(res, 404, {
        success: false,
        message: "الطالب غير موجود"
      });
    }

    const fees =
      db.fees
        .filter(f => f.studentId === studentId)
        .map(enrichFee);

    const notifications =
      db.notifications.filter(
        n => n.studentId === studentId
      );

    return json(res, 200, {
      success: true,
      student,
      fees,
      notifications
    });
  }

  /*
   * FEES - LIST
   */

  if (
    method === "GET" &&
    pathname === "/api/fees"
  ) {
    const user = requireAuth(req, res);

    if (!user) return;

    if (!hasPermission(user, "fees")) {
      return json(res, 403, {
        success: false,
        message: "ليس لديك صلاحية الرسوم"
      });
    }

    runFeeReminders();

    return json(res, 200, {
      success: true,
      fees: db.fees.map(enrichFee)
    });
  }

  /*
   * FEES - CREATE
   */

  if (
    method === "POST" &&
    pathname === "/api/fees"
  ) {
    const user = requireRole(
      req,
      res,
      [
        "admin",
        "accountant",
        "operations",
        "supervisor"
      ]
    );

    if (!user) return;

    try {
      const body = await getBody(req);

      const student =
        db.students.find(
          s => s.id === body.studentId
        );

      if (!student) {
        return json(res, 404, {
          success: false,
          message: "الطالب غير موجود"
        });
      }

      const totalAmount =
        Number(body.totalAmount || 0);

      const paidAmount =
        Number(body.paidAmount || 0);

      if (totalAmount < 0 || paidAmount < 0) {
        return json(res, 400, {
          success: false,
          message: "مبلغ غير صحيح"
        });
      }

      const fee = {
        id: id("FEE-"),

        studentId:
          body.studentId,

        totalAmount,

        paidAmount:
          Math.min(paidAmount, totalAmount),

        paymentType:
          body.paymentType === "full"
            ? "full"
            : "installments",

        nextInstallmentAmount:
          Number(
            body.nextInstallmentAmount || 0
          ),

        nextDueDate:
          body.nextDueDate || "",

        notes:
          String(body.notes || "").trim(),

        createdAt:
          new Date().toISOString(),

        updatedAt:
          new Date().toISOString()
      };

      db.fees.push(fee);

      saveData();

      runFeeReminders();

      return json(res, 201, {
        success: true,
        message: "تم تسجيل الرسوم",
        fee: enrichFee(fee)
      });
    } catch (error) {
      console.error(error);

      return json(res, 500, {
        success: false,
        message: "تعذر تسجيل الرسوم"
      });
    }
  }

  /*
   * FEES - PAYMENT
   */

  if (
    method === "POST" &&
    pathname.startsWith("/api/fees/") &&
    pathname.endsWith("/payment")
  ) {
    const user = requireRole(
      req,
      res,
      [
        "admin",
        "accountant",
        "operations",
        "supervisor"
      ]
    );

    if (!user) return;

    try {
      const feeId =
        pathname.split("/")[3];

      const fee =
        db.fees.find(
          f => f.id === feeId
        );

      if (!fee) {
        return json(res, 404, {
          success: false,
          message: "ملف الرسوم غير موجود"
        });
      }

      const body = await getBody(req);

      const amount =
        Number(body.amount || 0);

      if (amount <= 0) {
        return json(res, 400, {
          success: false,
          message: "مبلغ السداد غير صحيح"
        });
      }

      fee.paidAmount = Math.min(
        Number(fee.totalAmount || 0),
        Number(fee.paidAmount || 0) + amount
      );

      fee.updatedAt =
        new Date().toISOString();

      if (
        Number(fee.paidAmount) >=
        Number(fee.totalAmount)
      ) {
        fee.nextDueDate = "";
        fee.nextInstallmentAmount = 0;
        fee.paymentType = "full";
      }

      saveData();

      return json(res, 200, {
        success: true,
        message: "تم تسجيل السداد",
        fee: enrichFee(fee)
      });
    } catch (error) {
      return json(res, 500, {
        success: false,
        message: "تعذر تسجيل السداد"
      });
    }
  }

  /*
   * NOTIFICATIONS
   */

  if (
    method === "GET" &&
    pathname === "/api/notifications"
  ) {
    const user = requireAuth(req, res);

    if (!user) return;

    runFeeReminders();

    let notifications =
      db.notifications;

    if (user.role === "parent") {
      notifications =
        notifications.filter(
          n =>
            n.parentEmail === user.email
        );
    }

    return json(res, 200, {
      success: true,
      notifications:
        notifications
          .slice()
          .reverse()
    });
  }

  /*
   * MARK NOTIFICATION READ
   */

  if (
    method === "PATCH" &&
    pathname.startsWith("/api/notifications/") &&
    pathname.endsWith("/read")
  ) {
    const user = requireAuth(req, res);

    if (!user) return;

    const notificationId =
      pathname.split("/")[3];

    const notification =
      db.notifications.find(
        n => n.id === notificationId
      );

    if (!notification) {
      return json(res, 404, {
        success: false,
        message: "الإشعار غير موجود"
      });
    }

    notification.read = true;

    saveData();

    return json(res, 200, {
      success: true,
      message: "تم تعليم الإشعار كمقروء"
    });
  }

  /*
   * SETTINGS - GET
   */

  if (
    method === "GET" &&
    pathname === "/api/settings"
  ) {
    const user = requireRole(
      req,
      res,
      ["admin", "programmer"]
    );

    if (!user) return;

    return json(res, 200, {
      success: true,
      settings: db.settings
    });
  }

  /*
   * SETTINGS - UPDATE
   */

  if (
    method === "PUT" &&
    pathname === "/api/settings"
  ) {
    const user = requireRole(
      req,
      res,
      ["admin"]
    );

    if (!user) return;

    try {
      const body = await getBody(req);

      db.settings = {
        ...db.settings,

        schoolName:
          body.schoolName !== undefined
            ? String(body.schoolName)
            : db.settings.schoolName,

        schoolEmail:
          body.schoolEmail !== undefined
            ? normalizeEmail(body.schoolEmail)
            : db.settings.schoolEmail,

        schoolPhone:
          body.schoolPhone !== undefined
            ? String(body.schoolPhone)
            : db.settings.schoolPhone,

        currency:
          body.currency !== undefined
            ? String(body.currency)
            : db.settings.currency,

        academicYear:
          body.academicYear !== undefined
            ? String(body.academicYear)
            : db.settings.academicYear,

        feeReminderDays:
          body.feeReminderDays !== undefined
            ? Number(body.feeReminderDays)
            : db.settings.feeReminderDays
      };

      saveData();

      return json(res, 200, {
        success: true,
        message: "تم حفظ إعدادات المنصة",
        settings: db.settings
      });
    } catch (error) {
      return json(res, 400, {
        success: false,
        message: "إعدادات غير صحيحة"
      });
    }
  }

  /*
   * REPORT
   */

  if (
    method === "GET" &&
    pathname === "/api/reports/fees"
  ) {
    const user = requireRole(
      req,
      res,
      [
        "admin",
        "accountant",
        "operations",
        "supervisor"
      ]
    );

    if (!user) return;

    const report = {
      totalInvoices:
        db.fees.length,

      totalAmount:
        db.fees.reduce(
          (sum, f) =>
            sum + Number(f.totalAmount || 0),
          0
        ),

      paidAmount:
        db.fees.reduce(
          (sum, f) =>
            sum + Number(f.paidAmount || 0),
          0
        ),

      remainingAmount:
        db.fees.reduce(
          (sum, f) =>
            sum +
            Math.max(
              Number(f.totalAmount || 0) -
              Number(f.paidAmount || 0),
              0
            ),
          0
        ),

      overdue:
        db.fees.filter(
          f =>
            calculateFeeStatus(f) ===
            "overdue"
        ).length
    };

    return json(res, 200, {
      success: true,
      report
    });
  }

  /*
   * SERVE INDEX.HTML
   */

  if (
    method === "GET" &&
    (pathname === "/" ||
      pathname === "/index.html")
  ) {
    const file =
      path.join(__dirname, "index.html");

    if (!fs.existsSync(file)) {
      return text(
        res,
        404,
        "index.html غير موجود حالياً"
      );
    }

    return text(
      res,
      200,
      fs.readFileSync(file),
      "text/html; charset=utf-8"
    );
  }

  /*
   * 404 API
   */

  if (pathname.startsWith("/api/")) {
    return json(res, 404, {
      success: false,
      message: "API endpoint غير موجود"
    });
  }

  return text(
    res,
    404,
    "Page not found"
  );
}

const server = http.createServer(
  async (req, res) => {
    try {
      await router(req, res);
    } catch (error) {
      console.error(
        "SERVER ERROR:",
        error
      );

      if (!res.headersSent) {
        json(res, 500, {
          success: false,
          message: "حدث خطأ داخلي في الخادم"
        });
      }
    }
  }
);

server.listen(PORT, HOST, () => {
  console.log(
    `School system running on ${HOST}:${PORT}`
  );

  console.log(
    "Data file:",
    DB_FILE
  );
});
