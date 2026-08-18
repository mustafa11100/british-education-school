const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// إعدادات أساسية
// =====================================================

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

// =====================================================
// قاعدة بيانات بسيطة داخل ملف JSON
// =====================================================

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "database.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const defaultDatabase = {
  settings: {
    schoolName: "نظام إدارة المدرسة",
    schoolEmail: "",
    schoolPhone: "",
    schoolAddress: "",
    logo: "",
    currency: "جنيه",
    emailNotifications: true,
    paymentReminders: true,
    reminderDays: 3
  },

  users: [],

  students: [],

  parents: [],

  fees: [],

  notifications: [],

  activityLogs: [],

  classes: [],

  subjects: []
};

function loadDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(
        DB_FILE,
        JSON.stringify(defaultDatabase, null, 2),
        "utf8"
      );
    }

    const data = fs.readFileSync(DB_FILE, "utf8");

    if (!data.trim()) {
      return JSON.parse(JSON.stringify(defaultDatabase));
    }

    return JSON.parse(data);
  } catch (error) {
    console.error("Database load error:", error);
    return JSON.parse(JSON.stringify(defaultDatabase));
  }
}

let db = loadDatabase();

function saveDatabase() {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(db, null, 2),
    "utf8"
  );
}

// =====================================================
// أدوات مساعدة
// =====================================================

function id() {
  return crypto.randomUUID();
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

const sessions = new Map();

function logActivity(user, action, details = "") {
  db.activityLogs.unshift({
    id: id(),
    userId: user?.id || null,
    username: user?.username || "system",
    role: user?.role || "system",
    action,
    details,
    date: new Date().toISOString()
  });

  db.activityLogs = db.activityLogs.slice(0, 2000);

  saveDatabase();
}

// =====================================================
// الصلاحيات
// =====================================================

const ROLE_PERMISSIONS = {

  programmer: [
    "*"
  ],

  admin: [
    "dashboard",
    "users",
    "students",
    "parents",
    "fees",
    "classes",
    "subjects",
    "reports",
    "notifications",
    "settings_view"
  ],

  operations: [
    "dashboard",
    "students",
    "parents",
    "fees",
    "classes",
    "reports",
    "notifications"
  ],

  quality: [
    "dashboard",
    "students_view",
    "parents_view",
    "fees_view",
    "reports",
    "notifications_view"
  ],

  teacher: [
    "dashboard",
    "students_view",
    "attendance",
    "grades",
    "subjects"
  ],

  parent: [
    "parent_dashboard",
    "my_students",
    "my_fees",
    "my_notifications"
  ]
};

function hasPermission(user, permission) {
  if (!user) return false;

  if (user.role === "programmer") {
    return true;
  }

  const permissions = ROLE_PERMISSIONS[user.role] || [];

  return permissions.includes(permission);
}

function authenticate(req, res, next) {
  const auth = req.headers.authorization || "";

  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "غير مسجل الدخول"
    });
  }

  const token = auth.substring(7);

  const session = sessions.get(token);

  if (!session) {
    return res.status(401).json({
      success: false,
      message: "انتهت جلسة تسجيل الدخول"
    });
  }

  const user = db.users.find(
    u => u.id === session.userId
  );

  if (!user || user.active === false) {
    return res.status(401).json({
      success: false,
      message: "الحساب غير موجود أو موقوف"
    });
  }

  req.user = user;
  req.token = token;

  next();
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({
        success: false,
        message: "ليس لديك صلاحية لتنفيذ هذه العملية"
      });
    }

    next();
  };
}

// =====================================================
// إنشاء حساب المبرمج الرئيسي أول مرة
// =====================================================

function createInitialProgrammer() {

  if (db.users.length > 0) {
    return;
  }

  const programmer = {
    id: id(),

    username: "programmer",

    password: hashPassword("123456"),

    name: "المبرمج الرئيسي",

    email: "",

    phone: "",

    role: "programmer",

    active: true,

    mustChangePassword: true,

    createdAt: new Date().toISOString()
  };

  db.users.push(programmer);

  saveDatabase();

  console.log("======================================");
  console.log("الحساب الرئيسي:");
  console.log("Username: programmer");
  console.log("Password: 123456");
  console.log("يجب تغيير كلمة المرور بعد الدخول");
  console.log("======================================");
}

createInitialProgrammer();

// =====================================================
// الصفحة الرئيسية
// =====================================================

app.get("/", (req, res) => {

  const indexPath = path.join(
    __dirname,
    "public",
    "index.html"
  );

  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  res.json({
    success: true,
    message: "School Management System is running"
  });
});

// =====================================================
// تسجيل الدخول
// =====================================================

app.post("/api/auth/login", (req, res) => {

  const {
    username,
    password
  } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "أدخل اسم المستخدم وكلمة المرور"
    });
  }

  const user = db.users.find(
    u =>
      u.username.toLowerCase() ===
      String(username).toLowerCase()
  );

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "اسم المستخدم أو كلمة المرور غير صحيحة"
    });
  }

  if (user.active === false) {
    return res.status(403).json({
      success: false,
      message: "هذا الحساب موقوف"
    });
  }

  if (
    user.password !==
    hashPassword(password)
  ) {
    return res.status(401).json({
      success: false,
      message: "اسم المستخدم أو كلمة المرور غير صحيحة"
    });
  }

  const token = createToken();

  sessions.set(token, {
    userId: user.id,
    createdAt: Date.now()
  });

  logActivity(
    user,
    "login",
    "تسجيل دخول"
  );

  res.json({
    success: true,

    token,

    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      mustChangePassword:
        user.mustChangePassword
    },

    settings: db.settings
  });
});

// =====================================================
// تسجيل الخروج
// =====================================================

app.post("/api/auth/logout", authenticate, (req, res) => {

  sessions.delete(req.token);

  logActivity(
    req.user,
    "logout",
    "تسجيل خروج"
  );

  res.json({
    success: true
  });
});

// =====================================================
// بيانات المستخدم الحالي
// =====================================================

app.get("/api/auth/me", authenticate, (req, res) => {

  res.json({
    success: true,

    user: {
      id: req.user.id,
      username: req.user.username,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      role: req.user.role,
      mustChangePassword:
        req.user.mustChangePassword
    }
  });
});

// =====================================================
// تغيير كلمة المرور
// =====================================================

app.post(
  "/api/auth/change-password",
  authenticate,
  (req, res) => {

    const {
      currentPassword,
      newPassword
    } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "أدخل كلمة المرور الحالية والجديدة"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message:
          "كلمة المرور يجب أن تكون 6 أحرف أو أكثر"
      });
    }

    if (
      req.user.password !==
      hashPassword(currentPassword)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "كلمة المرور الحالية غير صحيحة"
      });
    }

    req.user.password =
      hashPassword(newPassword);

    req.user.mustChangePassword = false;

    saveDatabase();

    logActivity(
      req.user,
      "change_password",
      "تغيير كلمة المرور"
    );

    res.json({
      success: true,
      message: "تم تغيير كلمة المرور بنجاح"
    });
  }
);

// =====================================================
// المستخدمين
// =====================================================

app.get(
  "/api/users",
  authenticate,
  requirePermission("users"),
  (req, res) => {

    const users = db.users.map(u => ({
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      active: u.active,
      createdAt: u.createdAt
    }));

    res.json({
      success: true,
      users
    });
  }
);

// =====================================================
// إنشاء مستخدم
// =====================================================

app.post(
  "/api/users",
  authenticate,
  requirePermission("users"),
  (req, res) => {

    const {
      username,
      password,
      name,
      email,
      phone,
      role
    } = req.body;

    if (!username || !name || !role) {
      return res.status(400).json({
        success: false,
        message:
          "اسم المستخدم والاسم والوظيفة مطلوبة"
      });
    }

    const exists = db.users.some(
      u =>
        u.username.toLowerCase() ===
        String(username).toLowerCase()
    );

    if (exists) {
      return res.status(400).json({
        success: false,
        message: "اسم المستخدم موجود بالفعل"
      });
    }

    const newUser = {

      id: id(),

      username: String(username).trim(),

      password: hashPassword(
        password || "123456"
      ),

      name,

      email: email || "",

      phone: phone || "",

      role,

      active: true,

      mustChangePassword: true,

      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);

    saveDatabase();

    logActivity(
      req.user,
      "create_user",
      `إنشاء المستخدم ${newUser.username}`
    );

    res.json({
      success: true,

      message:
        "تم إنشاء المستخدم بنجاح",

      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role
      }
    });
  }
);

// =====================================================
// تعديل مستخدم
// =====================================================

app.put(
  "/api/users/:id",
  authenticate,
  requirePermission("users"),
  (req, res) => {

    const user = db.users.find(
      u => u.id === req.params.id
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود"
      });
    }

    const {
      name,
      email,
      phone,
      role,
      active,
      password
    } = req.body;

    if (name !== undefined) user.name = name;

    if (email !== undefined)
      user.email = email;

    if (phone !== undefined)
      user.phone = phone;

    if (role !== undefined)
      user.role = role;

    if (active !== undefined)
      user.active = Boolean(active);

    if (password) {
      user.password =
        hashPassword(password);

      user.mustChangePassword = true;
    }

    saveDatabase();

    logActivity(
      req.user,
      "update_user",
      `تعديل المستخدم ${user.username}`
    );

    res.json({
      success: true,
      message: "تم تحديث المستخدم"
    });
  }
);

// =====================================================
// حذف مستخدم
// =====================================================

app.delete(
  "/api/users/:id",
  authenticate,
  requirePermission("users"),
  (req, res) => {

    if (req.params.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message:
          "لا يمكنك حذف حسابك الحالي"
      });
    }

    const index =
      db.users.findIndex(
        u => u.id === req.params.id
      );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود"
      });
    }

    const deleted =
      db.users.splice(index, 1)[0];

    saveDatabase();

    logActivity(
      req.user,
      "delete_user",
      `حذف المستخدم ${deleted.username}`
    );

    res.json({
      success: true,
      message: "تم حذف المستخدم"
    });
  }
);

// =====================================================
// الطلاب
// =====================================================

app.get(
  "/api/students",
  authenticate,
  (req, res) => {

    if (
      !hasPermission(req.user, "students") &&
      !hasPermission(req.user, "students_view") &&
      req.user.role !== "parent"
    ) {
      return res.status(403).json({
        success: false,
        message: "ليس لديك صلاحية"
      });
    }

    let students = db.students;

    if (req.user.role === "parent") {
      students =
        students.filter(
          s => s.parentId === req.user.id
        );
    }

    res.json({
      success: true,
      students
    });
  }
);

// =====================================================
// إضافة طالب
// =====================================================

app.post(
  "/api/students",
  authenticate,
  requirePermission("students"),
  (req, res) => {

    const student = {

      id: id(),

      name: req.body.name || "",

      studentNumber:
        req.body.studentNumber || "",

      nationalId:
        req.body.nationalId || "",

      gender:
        req.body.gender || "",

      birthDate:
        req.body.birthDate || "",

      className:
        req.body.className || "",

      section:
        req.body.section || "",

      parentId:
        req.body.parentId || null,

      parentName:
        req.body.parentName || "",

      parentEmail:
        req.body.parentEmail || "",

      parentPhone:
        req.body.parentPhone || "",

      createdAt:
        new Date().toISOString()
    };

    db.students.push(student);

    saveDatabase();

    logActivity(
      req.user,
      "create_student",
      `إضافة الطالب ${student.name}`
    );

    res.json({
      success: true,
      student
    });
  }
);

// =====================================================
// تعديل طالب
// =====================================================

app.put(
  "/api/students/:id",
  authenticate,
  requirePermission("students"),
  (req, res) => {

    const student =
      db.students.find(
        s => s.id === req.params.id
      );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "الطالب غير موجود"
      });
    }

    Object.assign(student, req.body);

    saveDatabase();

    logActivity(
      req.user,
      "update_student",
      `تعديل الطالب ${student.name}`
    );

    res.json({
      success: true,
      student
    });
  }
);

// =====================================================
// الرسوم الدراسية
// =====================================================

app.get(
  "/api/fees",
  authenticate,
  (req, res) => {

    let fees = db.fees;

    if (req.user.role === "parent") {

      const studentIds =
        db.students
          .filter(
            s => s.parentId === req.user.id
          )
          .map(s => s.id);

      fees = fees.filter(
        f => studentIds.includes(f.studentId)
      );
    } else {

      if (
        !hasPermission(req.user, "fees") &&
        !hasPermission(req.user, "fees_view")
      ) {
        return res.status(403).json({
          success: false,
          message: "ليس لديك صلاحية"
        });
      }
    }

    res.json({
      success: true,
      fees
    });
  }
);

// =====================================================
// إضافة خطة رسوم لطالب
// =====================================================

app.post(
  "/api/fees",
  authenticate,
  requirePermission("fees"),
  (req, res) => {

    const {
      studentId,
      totalAmount,
      paymentType,
      installments
    } = req.body;

    const student =
      db.students.find(
        s => s.id === studentId
      );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "الطالب غير موجود"
      });
    }

    const fee = {

      id: id(),

      studentId,

      studentName:
        student.name,

      totalAmount:
        Number(totalAmount || 0),

      paidAmount: 0,

      remainingAmount:
        Number(totalAmount || 0),

      paymentType:
        paymentType === "installments"
          ? "installments"
          : "full",

      installments:
        Array.isArray(installments)
          ? installments.map(item => ({
              id: id(),
              amount: Number(item.amount || 0),
              dueDate: item.dueDate || "",
              paid: false,
              paidDate: null
            }))
          : [],

      createdAt:
        new Date().toISOString()
    };

    db.fees.push(fee);

    saveDatabase();

    logActivity(
      req.user,
      "create_fee",
      `إضافة رسوم للطالب ${student.name}`
    );

    res.json({
      success: true,
      fee
    });
  }
);

// =====================================================
// تسجيل دفعة
// =====================================================

app.post(
  "/api/fees/:id/payment",
  authenticate,
  requirePermission("fees"),
  (req, res) => {

    const fee =
      db.fees.find(
        f => f.id === req.params.id
      );

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: "ملف الرسوم غير موجود"
      });
    }

    const amount =
      Number(req.body.amount || 0);

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "قيمة الدفعة غير صحيحة"
      });
    }

    fee.paidAmount += amount;

    if (
      fee.paidAmount >
      fee.totalAmount
    ) {
      fee.paidAmount =
        fee.totalAmount;
    }

    fee.remainingAmount =
      Math.max(
        0,
        fee.totalAmount -
        fee.paidAmount
      );

    if (
      Array.isArray(fee.installments)
    ) {

      let remainingPayment = amount;

      for (
        const installment
        of fee.installments
      ) {

        if (
          installment.paid ||
          remainingPayment <= 0
        ) {
          continue;
        }

        if (
          remainingPayment >=
          installment.amount
        ) {

          remainingPayment -=
            installment.amount;

          installment.paid = true;

          installment.paidDate =
            new Date().toISOString();

        }
      }
    }

    saveDatabase();

    logActivity(
      req.user,
      "fee_payment",
      `تسجيل سداد ${amount}`
    );

    res.json({
      success: true,
      fee
    });
  }
);

// =====================================================
// الإشعارات
// =====================================================

app.get(
  "/api/notifications",
  authenticate,
  (req, res) => {

    let notifications =
      db.notifications;

    if (req.user.role === "parent") {

      notifications =
        notifications.filter(
          n =>
            n.userId === req.user.id ||
            n.userId === null
        );
    }

    res.json({
      success: true,
      notifications
    });
  }
);

// =====================================================
// إنشاء إشعار
// =====================================================

app.post(
  "/api/notifications",
  authenticate,
  (req, res) => {

    if (
      !hasPermission(
        req.user,
        "notifications"
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "ليس لديك صلاحية"
      });
    }

    const notification = {

      id: id(),

      userId:
        req.body.userId || null,

      title:
        req.body.title || "إشعار",

      message:
        req.body.message || "",

      type:
        req.body.type || "info",

      read: false,

      createdAt:
        new Date().toISOString()
    };

    db.notifications.unshift(
      notification
    );

    saveDatabase();

    res.json({
      success: true,
      notification
    });
  }
);

// =====================================================
// إعدادات المنصة
// =====================================================

app.get(
  "/api/settings",
  authenticate,
  (req, res) => {

    res.json({
      success: true,
      settings: db.settings
    });
  }
);

// =====================================================
// تعديل الإعدادات - للمبرمج فقط
// =====================================================

app.put(
  "/api/settings",
  authenticate,
  (req, res) => {

    if (req.user.role !== "programmer") {
      return res.status(403).json({
        success: false,
        message:
          "إعدادات النظام متاحة للمبرمج فقط"
      });
    }

    const allowedFields = [
      "schoolName",
      "schoolEmail",
      "schoolPhone",
      "schoolAddress",
      "logo",
      "currency",
      "emailNotifications",
      "paymentReminders",
      "reminderDays"
    ];

    for (const field of allowedFields) {

      if (
        req.body[field] !== undefined
      ) {
        db.settings[field] =
          req.body[field];
      }
    }

    saveDatabase();

    logActivity(
      req.user,
      "update_settings",
      "تحديث إعدادات المنصة"
    );

    res.json({
      success: true,
      settings: db.settings
    });
  }
);

// =====================================================
// سجل العمليات
// =====================================================

app.get(
  "/api/activity-logs",
  authenticate,
  (req, res) => {

    if (req.user.role !== "programmer") {
      return res.status(403).json({
        success: false,
        message:
          "سجل العمليات متاح للمبرمج فقط"
      });
    }

    res.json({
      success: true,
      logs: db.activityLogs
    });
  }
);

// =====================================================
// الإحصائيات
// =====================================================

app.get(
  "/api/dashboard",
  authenticate,
  (req, res) => {

    const totalStudents =
      db.students.length;

    const totalUsers =
      db.users.length;

    const activeUsers =
      db.users.filter(
        u => u.active !== false
      ).length;

    const totalFees =
      db.fees.reduce(
        (sum, f) =>
          sum +
          Number(f.totalAmount || 0),
        0
      );

    const totalPaid =
      db.fees.reduce(
        (sum, f) =>
          sum +
          Number(f.paidAmount || 0),
        0
      );

    const totalRemaining =
      Math.max(
        0,
        totalFees - totalPaid
      );

    res.json({
      success: true,

      statistics: {
        totalStudents,
        totalUsers,
        activeUsers,
        totalFees,
        totalPaid,
        totalRemaining
      }
    });
  }
);

// =====================================================
// فحص النظام
// =====================================================

app.get("/api/health", (req, res) => {

  res.json({
    success: true,
    status: "online",
    system: "School Management System",
    time: new Date().toISOString()
  });
});

// =====================================================
// معالجة أخطاء API
// =====================================================

app.use("/api", (req, res) => {

  res.status(404).json({
    success: false,
    message: "API غير موجود"
  });
});

// =====================================================
// تشغيل السيرفر
// =====================================================

app.listen(PORT, "0.0.0.0", () => {

  console.log(
    `School Management System running on port ${PORT}`
  );

});
