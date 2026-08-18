const express = require("express");
const Database = require("better-sqlite3");
const nodemailer = require("nodemailer");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const db = new Database(path.join(__dirname, "school.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/* =========================================================
   DATABASE
========================================================= */

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    must_change_password INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    student_number TEXT UNIQUE,
    full_name TEXT NOT NULL,
    grade TEXT,
    class_name TEXT,
    date_of_birth TEXT,
    gender TEXT,
    address TEXT,
    notes TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS parents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS student_parents (
    student_id INTEGER NOT NULL,
    parent_id INTEGER NOT NULL,
    relation TEXT DEFAULT 'ولي أمر',
    PRIMARY KEY(student_id, parent_id),
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY(parent_id) REFERENCES parents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    grade TEXT,
    room TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER,
    subject_id INTEGER,
    teacher_id INTEGER,
    day TEXT,
    start_time TEXT,
    end_time TEXT,
    room TEXT,
    notes TEXT,
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE SET NULL,
    FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
    FOREIGN KEY(teacher_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS student_lessons (
    student_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    PRIMARY KEY(student_id, lesson_id),
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY(lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    teacher_id INTEGER,
    created_by INTEGER,
    note_type TEXT DEFAULT 'عام',
    title TEXT,
    content TEXT NOT NULL,
    visible_to_parent INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY(teacher_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS teacher_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    created_by INTEGER,
    title TEXT,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    subject TEXT,
    content TEXT NOT NULL,
    read_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(receiver_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'general',
    read_at TEXT,
    email_sent INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
`);

/* =========================================================
   PASSWORD
========================================================= */

function hashPassword(password) {
    return crypto
        .createHash("sha256")
        .update(String(password))
        .digest("hex");
}

function generateToken() {
    return crypto.randomBytes(32).toString("hex");
}

/*
  الجلسات في الذاكرة.
  مناسبة كبداية للمنصة.
*/
const sessions = new Map();

/* =========================================================
   ROLES
========================================================= */

const ROLES = {
    PROGRAMMER: "مبرمج",
    ADMIN: "مدير",
    OPERATIONS: "عمليات",
    QUALITY: "جودة",
    SUPERVISOR: "مشرف",
    TEACHER: "معلم",
    PARENT: "ولي أمر",
    STUDENT: "طالب"
};

const ALL_ROLES = Object.values(ROLES);

function isManagement(role) {
    return [
        ROLES.PROGRAMMER,
        ROLES.ADMIN,
        ROLES.OPERATIONS,
        ROLES.QUALITY,
        ROLES.SUPERVISOR
    ].includes(role);
}

function canManageUsers(role) {
    return [
        ROLES.PROGRAMMER,
        ROLES.ADMIN
    ].includes(role);
}

function canManageSystem(role) {
    return role === ROLES.PROGRAMMER;
}

/* =========================================================
   SETTINGS
========================================================= */

const defaultSettings = {
    school_name: "نظام إدارة المدرسة",
    school_email: "",
    school_phone: "",
    notifications_enabled: "1",
    email_notifications_enabled: "1"
};

for (const [key, value] of Object.entries(defaultSettings)) {
    db.prepare(`
        INSERT OR IGNORE INTO settings (key, value)
        VALUES (?, ?)
    `).run(key, value);
}

/* =========================================================
   MAIL
========================================================= */

let transporter = null;

function setupMailer() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !port || !user || !pass) {
        console.log(
            "⚠️ Mailer Notice: SMTP Environment variables missing. Emails will be logged locally."
        );
        transporter = null;
        return;
    }

    transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: String(port) === "465",
        auth: {
            user,
            pass
        }
    });

    console.log("📧 SMTP mailer configured.");
}

setupMailer();

async function sendEmail(to, subject, html) {
    if (!to) {
        return {
            success: false,
            reason: "No email address"
        };
    }

    if (!transporter) {
        console.log("📧 EMAIL LOG");
        console.log("To:", to);
        console.log("Subject:", subject);
        console.log("Body:", html);

        return {
            success: false,
            logged: true
        };
    }

    try {
        const from =
            process.env.SMTP_FROM ||
            process.env.SMTP_USER;

        await transporter.sendMail({
            from,
            to,
            subject,
            html
        });

        return {
            success: true
        };
    } catch (error) {
        console.error("Email error:", error.message);

        return {
            success: false,
            error: error.message
        };
    }
}

/* =========================================================
   AUTH
========================================================= */

function auth(req, res, next) {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token || !sessions.has(token)) {
        return res.status(401).json({
            success: false,
            message: "يجب تسجيل الدخول أولاً"
        });
    }

    const session = sessions.get(token);

    const user = db.prepare(`
        SELECT id, username, full_name, email, phone, role,
               active, must_change_password
        FROM users
        WHERE id = ?
    `).get(session.userId);

    if (!user || !user.active) {
        sessions.delete(token);

        return res.status(401).json({
            success: false,
            message: "الحساب غير فعال"
        });
    }

    req.user = user;
    req.token = token;

    next();
}

function requireRoles(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية لتنفيذ هذا الإجراء"
            });
        }

        next();
    };
}

function audit(userId, action, details = "") {
    db.prepare(`
        INSERT INTO audit_logs (user_id, action, details)
        VALUES (?, ?, ?)
    `).run(userId || null, action, details);
}

/* =========================================================
   HEALTH
========================================================= */

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "School Management System is running",
        version: "2.0.0"
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        status: "online",
        time: new Date().toISOString()
    });
});

/* =========================================================
   LOGIN
========================================================= */

app.post("/api/auth/register", (req, res) => {
    try {
        const {
            username,
            password,
            full_name,
            email,
            phone,
            role
        } = req.body;

        if (!username || !password || !full_name || !role) {
            return res.status(400).json({
                success: false,
                message: "الاسم واسم المستخدم وكلمة المرور والوظيفة مطلوبة"
            });
        }

        if (!ALL_ROLES.includes(role)) {
            return res.status(400).json({
                success: false,
                message: "الوظيفة غير صحيحة"
            });
        }

        const exists = db.prepare(`
            SELECT id FROM users WHERE username = ?
        `).get(username.trim());

        if (exists) {
            return res.status(400).json({
                success: false,
                message: "اسم المستخدم موجود بالفعل"
            });
        }

        /*
          التسجيل العام لا يسمح بإنشاء حسابات إدارية
          أو حساب مبرمج.
        */
        const publicRoles = [
            ROLES.TEACHER,
            ROLES.PARENT,
            ROLES.STUDENT
        ];

        if (!publicRoles.includes(role)) {
            return res.status(403).json({
                success: false,
                message: "هذا النوع من الحسابات يتم إنشاؤه من الإدارة"
            });
        }

        const result = db.prepare(`
            INSERT INTO users
            (username, password_hash, full_name, email, phone, role)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            username.trim(),
            hashPassword(password),
            full_name.trim(),
            email || "",
            phone || "",
            role
        );

        audit(
            result.lastInsertRowid,
            "register",
            `تم إنشاء حساب ${role}`
        );

        res.json({
            success: true,
            message: "تم إنشاء الحساب بنجاح",
            user_id: result.lastInsertRowid
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "حدث خطأ أثناء التسجيل"
        });
    }
});

app.post("/api/auth/login", (req, res) => {
    try {
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

        const user = db.prepare(`
            SELECT *
            FROM users
            WHERE username = ?
        `).get(username.trim());

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "اسم المستخدم أو كلمة المرور غير صحيحة"
            });
        }

        if (!user.active) {
            return res.status(403).json({
                success: false,
                message: "الحساب موقوف"
            });
        }

        if (user.password_hash !== hashPassword(password)) {
            return res.status(401).json({
                success: false,
                message: "اسم المستخدم أو كلمة المرور غير صحيحة"
            });
        }

        const token = generateToken();

        sessions.set(token, {
            userId: user.id,
            createdAt: Date.now()
        });

        audit(user.id, "login");

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                must_change_password: Boolean(user.must_change_password)
            }
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "حدث خطأ أثناء تسجيل الدخول"
        });
    }
});

app.post("/api/auth/logout", auth, (req, res) => {
    sessions.delete(req.token);

    audit(req.user.id, "logout");

    res.json({
        success: true,
        message: "تم تسجيل الخروج"
    });
});

app.get("/api/auth/me", auth, (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

app.post("/api/auth/change-password", auth, (req, res) => {
    const { old_password, new_password } = req.body;

    if (!old_password || !new_password) {
        return res.status(400).json({
            success: false,
            message: "أدخل كلمة المرور القديمة والجديدة"
        });
    }

    if (new_password.length < 6) {
        return res.status(400).json({
            success: false,
            message: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل"
        });
    }

    const current = db.prepare(`
        SELECT password_hash
        FROM users
        WHERE id = ?
    `).get(req.user.id);

    if (current.password_hash !== hashPassword(old_password)) {
        return res.status(400).json({
            success: false,
            message: "كلمة المرور القديمة غير صحيحة"
        });
    }

    db.prepare(`
        UPDATE users
        SET password_hash = ?,
            must_change_password = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(
        hashPassword(new_password),
        req.user.id
    );

    audit(req.user.id, "change_password");

    res.json({
        success: true,
        message: "تم تغيير كلمة المرور"
    });
});

/* =========================================================
   USERS
========================================================= */

app.get(
    "/api/users",
    auth,
    requireRoles(ROLES.PROGRAMMER, ROLES.ADMIN),
    (req, res) => {
        const users = db.prepare(`
            SELECT id, username, full_name, email, phone,
                   role, active, must_change_password, created_at
            FROM users
            ORDER BY id DESC
        `).all();

        res.json({
            success: true,
            users
        });
    }
);

app.post(
    "/api/users",
    auth,
    requireRoles(ROLES.PROGRAMMER, ROLES.ADMIN),
    (req, res) => {
        try {
            const {
                username,
                password,
                full_name,
                email,
                phone,
                role
            } = req.body;

            if (!username || !password || !full_name || !role) {
                return res.status(400).json({
                    success: false,
                    message: "البيانات الأساسية مطلوبة"
                });
            }

            if (!ALL_ROLES.includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: "الوظيفة غير صحيحة"
                });
            }

            /*
              المدير لا يستطيع إنشاء مبرمج.
            */
            if (
                req.user.role === ROLES.ADMIN &&
                role === ROLES.PROGRAMMER
            ) {
                return res.status(403).json({
                    success: false,
                    message: "لا يمكن للمدير إنشاء حساب مبرمج"
                });
            }

            const exists = db.prepare(`
                SELECT id FROM users WHERE username = ?
            `).get(username.trim());

            if (exists) {
                return res.status(400).json({
                    success: false,
                    message: "اسم المستخدم موجود بالفعل"
                });
            }

            const result = db.prepare(`
                INSERT INTO users
                (username, password_hash, full_name, email, phone, role,
                 must_change_password)
                VALUES (?, ?, ?, ?, ?, ?, 1)
            `).run(
                username.trim(),
                hashPassword(password),
                full_name.trim(),
                email || "",
                phone || "",
                role
            );

            audit(
                req.user.id,
                "create_user",
                `user_id=${result.lastInsertRowid}; role=${role}`
            );

            res.json({
                success: true,
                message: "تم إنشاء المستخدم",
                user_id: result.lastInsertRowid
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                success: false,
                message: "تعذر إنشاء المستخدم"
            });
        }
    }
);

app.put(
    "/api/users/:id",
    auth,
    requireRoles(ROLES.PROGRAMMER, ROLES.ADMIN),
    (req, res) => {
        const id = Number(req.params.id);

        const target = db.prepare(`
            SELECT * FROM users WHERE id = ?
        `).get(id);

        if (!target) {
            return res.status(404).json({
                success: false,
                message: "المستخدم غير موجود"
            });
        }

        if (
            req.user.role === ROLES.ADMIN &&
            target.role === ROLES.PROGRAMMER
        ) {
            return res.status(403).json({
                success: false,
                message: "لا يمكن تعديل حساب المبرمج"
            });
        }

        const {
            full_name,
            email,
            phone,
            role,
            active
        } = req.body;

        if (role && !ALL_ROLES.includes(role)) {
            return res.status(400).json({
                success: false,
                message: "الوظيفة غير صحيحة"
            });
        }

        if (
            req.user.role === ROLES.ADMIN &&
            role === ROLES.PROGRAMMER
        ) {
            return res.status(403).json({
                success: false,
                message: "لا يمكن تعيين المستخدم كمبرمج"
            });
        }

        db.prepare(`
            UPDATE users
            SET full_name = COALESCE(?, full_name),
                email = COALESCE(?, email),
                phone = COALESCE(?, phone),
                role = COALESCE(?, role),
                active = COALESCE(?, active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            full_name ?? null,
            email ?? null,
            phone ?? null,
            role ?? null,
            active === undefined ? null : (active ? 1 : 0),
            id
        );

        audit(
            req.user.id,
            "update_user",
            `user_id=${id}`
        );

        res.json({
            success: true,
            message: "تم تحديث المستخدم"
        });
    }
);

app.post(
    "/api/users/:id/reset-password",
    auth,
    requireRoles(ROLES.PROGRAMMER, ROLES.ADMIN),
    (req, res) => {
        const id = Number(req.params.id);
        const password = req.body.password || "123456";

        const target = db.prepare(`
            SELECT * FROM users WHERE id = ?
        `).get(id);

        if (!target) {
            return res.status(404).json({
                success: false,
                message: "المستخدم غير موجود"
            });
        }

        if (
            req.user.role === ROLES.ADMIN &&
            target.role === ROLES.PROGRAMMER
        ) {
            return res.status(403).json({
                success: false,
                message: "لا يمكن تعديل كلمة مرور المبرمج"
            });
        }

        db.prepare(`
            UPDATE users
            SET password_hash = ?,
                must_change_password = 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            hashPassword(password),
            id
        );

        audit(
            req.user.id,
            "reset_password",
            `user_id=${id}`
        );

        res.json({
            success: true,
            message: "تم إعادة تعيين كلمة المرور"
        });
    }
);

/* =========================================================
   STUDENTS
========================================================= */

app.get("/api/students", auth, (req, res) => {
    let students;

    if (req.user.role === ROLES.PARENT) {
        students = db.prepare(`
            SELECT s.*
            FROM students s
            JOIN student_parents sp
                ON sp.student_id = s.id
            JOIN parents p
                ON p.id = sp.parent_id
            WHERE p.user_id = ?
            ORDER BY s.full_name
        `).all(req.user.id);
    } else if (req.user.role === ROLES.STUDENT) {
        students = db.prepare(`
            SELECT *
            FROM students
            WHERE user_id = ?
        `).all(req.user.id);
    } else {
        students = db.prepare(`
            SELECT *
            FROM students
            ORDER BY id DESC
        `).all();
    }

    res.json({
        success: true,
        students
    });
});

app.post(
    "/api/students",
    auth,
    requireRoles(
        ROLES.PROGRAMMER,
        ROLES.ADMIN,
        ROLES.OPERATIONS,
        ROLES.SUPERVISOR
    ),
    (req, res) => {
        const {
            student_number,
            full_name,
            grade,
            class_name,
            date_of_birth,
            gender,
            address,
            notes,
            user_id
        } = req.body;

        if (!full_name) {
            return res.status(400).json({
                success: false,
                message: "اسم الطالب مطلوب"
            });
        }

        try {
            const result = db.prepare(`
                INSERT INTO students
                (student_number, full_name, grade, class_name,
                 date_of_birth, gender, address, notes, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                student_number || null,
                full_name,
                grade || "",
                class_name || "",
                date_of_birth || "",
                gender || "",
                address || "",
                notes || "",
                user_id || null
            );

            audit(
                req.user.id,
                "create_student",
                `student_id=${result.lastInsertRowid}`
            );

            res.json({
                success: true,
                message: "تم إضافة الطالب",
                student_id: result.lastInsertRowid
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                message: "تعذر إضافة الطالب. ربما رقم الطالب موجود مسبقاً."
            });
        }
    }
);

app.put(
    "/api/students/:id",
    auth,
    requireRoles(
        ROLES.PROGRAMMER,
        ROLES.ADMIN,
        ROLES.OPERATIONS,
        ROLES.SUPERVISOR
    ),
    (req, res) => {
        const id = Number(req.params.id);

        db.prepare(`
            UPDATE students
            SET student_number = COALESCE(?, student_number),
                full_name = COALESCE(?, full_name),
                grade = COALESCE(?, grade),
                class_name = COALESCE(?, class_name),
                date_of_birth = COALESCE(?, date_of_birth),
                gender = COALESCE(?, gender),
                address = COALESCE(?, address),
                notes = COALESCE(?, notes),
                user_id = COALESCE(?, user_id)
            WHERE id = ?
        `).run(
            req.body.student_number ?? null,
            req.body.full_name ?? null,
            req.body.grade ?? null,
            req.body.class_name ?? null,
            req.body.date_of_birth ?? null,
            req.body.gender ?? null,
            req.body.address ?? null,
            req.body.notes ?? null,
            req.body.user_id ?? null,
            id
        );

        res.json({
            success: true,
            message: "تم تحديث بيانات الطالب"
        });
    }
);

/* =========================================================
   PARENTS
========================================================= */

app.get(
    "/api/parents",
    auth,
    requireRoles(
        ROLES.PROGRAMMER,
        ROLES.ADMIN,
        ROLES.OPERATIONS,
        ROLES.SUPERVISOR
    ),
    (req, res) => {
        const parents = db.prepare(`
            SELECT
                p.*,
                u.username,
                u.active
            FROM parents p
            LEFT JOIN users u
                ON u.id = p.user_id
            ORDER BY p.id DESC
        `).all();

        res.json({
            success: true,
            parents
        });
    }
);

app.post(
    "/api/parents",
    auth,
    requireRoles(
        ROLES.PROGRAMMER,
        ROLES.ADMIN,
        ROLES.OPERATIONS
    ),
    (req, res) => {
        const {
            user_id,
            full_name,
            email,
            phone,
            address
        } = req.body;

        if (!full_name) {
            return res.status(400).json({
                success: false,
                message: "اسم ولي الأمر مطلوب"
            });
        }

        const result = db.prepare(`
            INSERT INTO parents
            (user_id, full_name, email, phone, address)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            user_id || null,
            full_name,
            email || "",
            phone || "",
            address || ""
        );

        res.json({
            success: true,
            message: "تم إضافة ولي الأمر",
            parent_id: result.lastInsertRowid
        });
    }
);

app.post(
    "/api/parents/link-student",
    auth,
    requireRoles(
        ROLES.PROGRAMMER,
        ROLES.ADMIN,
        ROLES.OPERATIONS
    ),
    (req, res) => {
        const {
            parent_id,
            student_id,
            relation
        } = req.body;

        if (!parent_id || !student_id) {
            return res.status(400).json({
                success: false,
                message: "ولي الأمر والطالب مطلوبان"
            });
        }

        db.prepare(`
            INSERT OR REPLACE INTO student_parents
            (student_id, parent_id, relation)
            VALUES (?, ?, ?)
        `).run(
            student_id,
            parent_id,
            relation || "ولي أمر"
        );

        res.json({
            success: true,
            message: "تم ربط الطالب بولي الأمر"
        });
    }
);

/* =========================================================
   SUBJECTS
========================================================= */

app.get("/api/subjects", auth, (req, res) => {
    const subjects = db.prepare(`
        SELECT *
        FROM subjects
        WHERE active = 1
        ORDER BY name
    `).all();

    res.json({
        success: true,
        subjects
    });
});

app.post(
    "/api/subjects",
    auth,
    requireRoles(
        ROLES.PROGRAMMER,
        ROLES.ADMIN,
        ROLES.OPERATIONS
    ),
    (req, res) => {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "اسم المادة مطلوب"
            });
        }

        try {
            const result = db.prepare(`
                INSERT INTO subjects
                (name, description)
                VALUES (?, ?)
            `).run(
                name,
                description || ""
            );

            res.json({
                success: true,
                message: "تم إضافة المادة",
                subject_id: result.lastInsertRowid
            });

        } catch {
            res.status(400).json({
                success: false,
                message: "المادة موجودة بالفعل"
            });
        }
    }
);

/* =========================================================
   CLASSES
========================================================= */

app.get("/api/classes", auth, (req, res) => {
    const classes = db.prepare(`
        SELECT *
        FROM classes
        WHERE active = 1
        ORDER BY grade, name
    `).all();

    res.json({
        success: true,
        classes
    });
});

app.post(
    "/api/classes",
    auth,
    requireRoles(
        ROLES.PROGRAMMER,
        ROLES.ADMIN,
        ROLES.OPERATIONS
    ),
    (req, res) => {
        const {
            name,
            grade,
            room
        } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "اسم الفصل مطلوب"
            });
        }

        const result = db.prepare(`
            INSERT INTO classes
            (name, grade, room)
            VALUES (?, ?, ?)
        `).run(
            name,
            grade || "",
            room || ""
        );

        res.json({
            success: true,
            message: "تم إنشاء الفصل",
            class_id: result.lastInsertRowid
        });
    }
);

/* =========================================================
   LESSONS
========================================================= */

app.get("/api/lessons", auth, (req, res) => {
    let lessons;

    if (req.user.role === ROLES.TEACHER) {
        lessons = db.prepare(`
            SELECT
                l.*,
                c.name AS class_name,
                s.name AS subject_name
            FROM lessons l
            LEFT JOIN classes c ON c.id = l.class_id
            LEFT JOIN subjects s ON s.id = l.subject_id
            WHERE l.teacher_id = ?
            ORDER BY l.day, l.start_time
        `).all(req.user.id);
    } else if (req.user.role === ROLES.STUDENT) {
        lessons = db.prepare(`
            SELECT
                l.*,
                c.name AS class_name,
                s.name AS subject_name,
                u.full_name AS teacher_name
            FROM student_lessons sl
            JOIN lessons l ON l.id = sl.lesson_id
            LEFT JOIN classes c ON c.id = l.class_id
            LEFT JOIN subjects s ON s.id = l.subject_id
            LEFT JOIN users u ON u.id = l.teacher_id
            JOIN students st ON st.id = sl.student_id
            WHERE st.user_id = ?
            ORDER BY l.day, l.start_time
        `).all(req.user.id);
    } else {
        lessons = db.prepare(`
            SELECT
                l.*,
                c.name AS class_name,
                s.name AS subject_name,
                u.full_name AS teacher_name
            FROM lessons l
            LEFT JOIN classes c ON c.id = l.class_id
            LEFT JOIN subjects s ON s.id = l.subject_id
            LEFT JOIN users u ON u.id = l.teacher_id
            ORDER BY l.day, l.start_time
        `).all();
    }

    res.json({
        success: true,
        lessons
    });
});

app.post(
    "/api/lessons",
    auth,
    requireRoles(
        ROLES.PROGRAMMER,
        ROLES.ADMIN,
        ROLES.OPERATIONS
    ),
    (req, res) => {
        const {
            class_id,
            subject_id,
            teacher_id,
            day,
            start_time,
            end_time,
            room,
            notes
        } = req.body;

        const result = db.prepare(`
            INSERT INTO lessons
            (class_id, subject_id, teacher_id, day,
             start_time, end_time, room, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            class_id || null,
            subject_id || null,
            teacher_id || null,
            day || "",
            start_time || "",
            end_time || "",
            room || "",
            notes || ""
        );

        res.json({
            success: true,
            message: "تم إضافة الحصة",
            lesson_id: result.lastInsertRowid
        });
    }
);

app.post(
    "/api/lessons/:id/add-student",
    auth,
    requireRoles(
        ROLES.PROGRAMMER,
        ROLES.ADMIN,
        ROLES.OPERATIONS,
        ROLES.SUPERVISOR
    ),
    (req, res) => {
        const lessonId = Number(req.params.id);
        const studentId = Number(req.body.student_id);

        if (!studentId) {
            return res.status(400).json({
                success: false,
                message: "رقم الطالب مطلوب"
            });
        }

        db.prepare(`
            INSERT OR IGNORE INTO student_lessons
            (student_id, lesson_id)
            VALUES (?, ?)
        `).run(
            studentId,
            lessonId
        );

        res.json({
            success: true,
            message: "تم ربط الطالب بالحصة"
        });
    }
);

/* =========================================================
   STUDENT NOTES
========================================================= */

app.get("/api/students/:id/notes", auth, (req, res) => {
    const studentId = Number(req.params.id);

    if (req.user.role === ROLES.PARENT) {
        const allowed = db.prepare(`
            SELECT 1
            FROM student_parents sp
            JOIN parents p ON p.id = sp.parent_id
            WHERE sp.student_id = ?
              AND p.user_id = ?
        `).get(studentId, req.user.id);

        if (!allowed) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية مشاهدة هذا الطالب"
            });
        }
    }

    if (req.user.role === ROLES.STUDENT) {
        const allowed = db.prepare(`
            SELECT 1
            FROM students
            WHERE id = ? AND user_id = ?
        `).get(studentId, req.user.id);

        if (!allowed) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية مشاهدة هذه البيانات"
            });
        }
    }

    const notes = db.prepare(`
        SELECT
            n.*,
            u.full_name AS creator_name,
            t.full_name AS teacher_name
        FROM notes n
        LEFT JOIN users u ON u.id = n.created_by
        LEFT JOIN users t ON t.id = n.teacher_id
        WHERE n.student_id = ?
        ${req.user.role === ROLES.PARENT ? "AND n.visible_to_parent = 1" : ""}
        ORDER BY n.created_at DESC
    `).all(studentId);

    res.json({
        success: true,
        notes
    });
});

app.post(
    "/api/students/:id/notes",
    auth,
    requireRoles(
        ROLES.PROGRAMMER,
        ROLES.ADMIN,
        ROLES.OPERATIONS,
        ROLES.QUALITY,
        ROLES.SUPERVISOR,
        ROLES.TEACHER
    ),
    (req, res) => {
        const studentId = Number(req.params.id);

        const {
            title,
            content,
            note_type,
            visible_to_parent
        } = req.body;

        if (!content) {
            return res.status(400).json({
                success: false,
                message: "نص الملاحظة مطلوب"
            });
        }

        db.prepare(`
            INSERT INTO notes
            (student_id, teacher_id, created_by,
             note_type, title, content, visible_to_parent)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            studentId,
            req.user.role === ROLES.TEACHER ? req.user.id : null,
            req.user.id,
            note_type || "عام",
            title || "",
            content,
            visible_to_parent === false ? 0 : 1
        );

        /*
          إرسال إشعار لولي الأمر
        */
        notifyParentsOfStudent(
            studentId,
            title || "ملاحظة جديدة عن الطالب",
            content,
            "student_note"
        );

        res.json({
            success: true,
            message: "تم حفظ الملاحظة وإرسال الإشعار"
        });
    }
);

/* =========================================================
   TEACHER NOTES
========================================================= */

app.get(
    "/api/teachers/:id/notes",
    auth,
    requireRoles(
        ROLES.PROGRAMMER,
        ROLES.ADMIN,
        ROLES.OPERATIONS,
        ROLES.QUALITY,
        ROLES.SUPERVISOR,
        ROLES.TEACHER
    ),
    (req, res) => {
        const teacherId = Number(req.params.id);

        if (
            req.user.role === ROLES.TEACHER &&
            req.user.id !== teacherId
        ) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية"
            });
        }

        const notes = db.prepare(`
            SELECT
                tn.*,
                u.full_name AS creator_name
            FROM teacher_notes tn
            LEFT JOIN users u
                ON u.id = tn.created_by
            WHERE tn.teacher_id = ?
            ORDER BY tn.created_at DESC
        `).all(teacherId);

        res.json({
            success: true,
            notes
        });
    }
);

app.post(
    "/api/teachers/:id/notes",
    auth,
    requireRoles(
        ROLES.PROGRAMMER,
        ROLES.ADMIN,
        ROLES.OPERATIONS,
        ROLES.QUALITY,
        ROLES.SUPERVISOR
    ),
    async (req, res) => {
        const teacherId = Number(req.params.id);

        const {
            title,
            content
        } = req.body;

        if (!content) {
            return res.status(400).json({
                success: false,
                message: "نص الملاحظة مطلوب"
            });
        }

        db.prepare(`
            INSERT INTO teacher_notes
            (teacher_id, created_by, title, content)
            VALUES (?, ?, ?, ?)
        `).run(
            teacherId,
            req.user.id,
            title || "ملاحظة من الإدارة",
            content
        );

        await createNotification(
            teacherId,
            title || "ملاحظة من الإدارة",
            content,
            "teacher_note",
            true
        );

        res.json({
            success: true,
            message: "تم حفظ الملاحظة وإرسال إشعار للمعلم"
        });
    }
);

/* =========================================================
   MESSAGES
========================================================= */

app.get("/api/messages", auth, (req, res) => {
    const messages = db.prepare(`
        SELECT
            m.*,
            s.full_name AS sender_name,
            r.full_name AS receiver_name
        FROM messages m
        JOIN users s ON s.id = m.sender_id
        JOIN users r ON r.id = m.receiver_id
        WHERE m.sender_id = ?
           OR m.receiver_id = ?
        ORDER BY m.created_at DESC
    `).all(
        req.user.id,
        req.user.id
    );

    res.json({
        success: true,
        messages
    });
});

app.post("/api/messages", auth, async (req, res) => {
    const {
        receiver_id,
        subject,
        content,
        send_email
    } = req.body;

    if (!receiver_id || !content) {
        return res.status(400).json({
            success: false,
            message: "المستلم ونص الرسالة مطلوبان"
        });
    }

    const receiver = db.prepare(`
        SELECT *
        FROM users
        WHERE id = ? AND active = 1
    `).get(receiver_id);

    if (!receiver) {
        return res.status(404).json({
            success: false,
            message: "المستخدم المستلم غير موجود"
        });
    }

    const result = db.prepare(`
        INSERT INTO messages
        (sender_id, receiver_id, subject, content)
        VALUES (?, ?, ?, ?)
    `).run(
        req.user.id,
        receiver_id,
        subject || "",
        content
    );

    await createNotification(
        receiver_id,
        subject || "رسالة جديدة",
        content,
        "message",
        send_email !== false
    );

    res.json({
        success: true,
        message: "تم إرسال الرسالة",
        message_id: result.lastInsertRowid
    });
});

app.post(
    "/api/messages/:id/read",
    auth,
    (req, res) => {
        const id = Number(req.params.id);

        db.prepare(`
            UPDATE messages
            SET read_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND receiver_id = ?
        `).run(
            id,
            req.user.id
        );

        res.json({
            success: true
        });
    }
);

/* =========================================================
   NOTIFICATIONS
========================================================= */

async function createNotification(
    userId,
    title,
    content,
    type = "general",
    sendEmail = true
) {
    const result = db.prepare(`
        INSERT INTO notifications
        (user_id, title, content, type)
        VALUES (?, ?, ?, ?)
    `).run(
        userId,
        title,
        content,
        type
    );

    let emailSent = false;

    const settings = getSettings();

    if (
        sendEmail &&
        settings.email_notifications_enabled === "1"
    ) {
        const user = db.prepare(`
            SELECT email
            FROM users
            WHERE id = ?
        `).get(userId);

        if (user?.email) {
            const resultEmail = await sendEmail(
                user.email,
                title,
                `
                <div dir="rtl" style="font-family:Arial">
                    <h2>${escapeHtml(title)}</h2>
                    <p>${escapeHtml(content)}</p>
                    <hr>
                    <p>نظام إدارة المدرسة</p>
                </div>
                `
            );

            emailSent = resultEmail.success;

            if (emailSent) {
                db.prepare(`
                    UPDATE notifications
                    SET email_sent = 1
                    WHERE id = ?
                `).run(result.lastInsertRowid);
            }
        }
    }

    return result.lastInsertRowid;
}

async function notifyParentsOfStudent(
    studentId,
    title,
    content,
    type
) {
    const parents = db.prepare(`
        SELECT DISTINCT
            p.user_id
        FROM student_parents sp
        JOIN parents p
            ON p.id = sp.parent_id
        WHERE sp.student_id = ?
          AND p.user_id IS NOT NULL
    `).all(studentId);

    for (const parent of parents) {
        await createNotification(
            parent.user_id,
            title,
            content,
            type,
            true
        );
    }
}

app.get("/api/notifications", auth, (req, res) => {
    const notifications = db.prepare(`
        SELECT *
        FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 100
    `).all(req.user.id);

    const unread = db.prepare(`
        SELECT COUNT(*) AS count
        FROM notifications
        WHERE user_id = ?
          AND read_at IS NULL
    `).get(req.user.id);

    res.json({
        success: true,
        notifications,
        unread: unread.count
    });
});

app.post(
    "/api/notifications/:id/read",
    auth,
    (req, res) => {
        const id = Number(req.params.id);

        db.prepare(`
            UPDATE notifications
            SET read_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND user_id = ?
        `).run(
            id,
            req.user.id
        );

        res.json({
            success: true
        });
    }
);

app.post(
    "/api/notifications/read-all",
    auth,
    (req, res) => {
        db.prepare(`
            UPDATE notifications
            SET read_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND read_at IS NULL
        `).run(req.user.id);

        res.json({
            success: true,
            message: "تم تعليم الإشعارات كمقروءة"
        });
    }
);

/* =========================================================
   ADMIN NOTIFICATIONS
========================================================= */

app.post(
    "/api/admin/notify-user",
    auth,
    requireRoles(
        ROLES.PROGRAMMER,
        ROLES.ADMIN,
        ROLES.OPERATIONS
    ),
    async (req, res) => {
        const {
            user_id,
            title,
            content,
            send_email
        } = req.body;

        if (!user_id || !title || !content) {
            return res.status(400).json({
                success: false,
                message: "المستلم والعنوان والمحتوى مطلوبة"
            });
        }

        await createNotification(
            user_id,
            title,
            content,
            "admin",
            send_email !== false
        );

        res.json({
            success: true,
            message: "تم إرسال الإشعار"
        });
    }
);

/* =========================================================
   SETTINGS
========================================================= */

function getSettings() {
    const rows = db.prepare(`
        SELECT key, value
        FROM settings
    `).all();

    const result = {};

    for (const row of rows) {
        result[row.key] = row.value;
    }

    return result;
}

app.get(
    "/api/settings",
    auth,
    requireRoles(
        ROLES.PROGRAMMER,
        ROLES.ADMIN,
        ROLES.OPERATIONS
    ),
    (req, res) => {
        res.json({
            success: true,
            settings: getSettings()
        });
    }
);

app.put(
    "/api/settings",
    auth,
    requireRoles(ROLES.PROGRAMMER),
    (req, res) => {
        const allowed = [
            "school_name",
            "school_email",
            "school_phone",
            "notifications_enabled",
            "email_notifications_enabled"
        ];

        const update = db.prepare(`
            INSERT INTO settings (key, value)
            VALUES (?, ?)
            ON CONFLICT(key)
            DO UPDATE SET value = excluded.value
        `);

        const transaction = db.transaction(() => {
            for (const key of allowed) {
                if (req.body[key] !== undefined) {
                    update.run(
                        key,
                        String(req.body[key])
                    );
                }
            }
        });

        transaction();

        audit(
            req.user.id,
            "update_settings"
        );

        res.json({
            success: true,
            message: "تم حفظ إعدادات المنصة"
        });
    }
);

/* =========================================================
   DASHBOARD
========================================================= */

app.get("/api/dashboard", auth, (req, res) => {
    const students = db.prepare(`
        SELECT COUNT(*) AS count
        FROM students
        WHERE active = 1
    `).get().count;

    const teachers = db.prepare(`
        SELECT COUNT(*) AS count
        FROM users
        WHERE role = ?
          AND active = 1
    `).get(ROLES.TEACHER).count;

    const parents = db.prepare(`
        SELECT COUNT(*) AS count
        FROM users
        WHERE role = ?
          AND active = 1
    `).get(ROLES.PARENT).count;

    const classes = db.prepare(`
        SELECT COUNT(*) AS count
        FROM classes
        WHERE active = 1
    `).get().count;

    const unread = db.prepare(`
        SELECT COUNT(*) AS count
        FROM notifications
        WHERE user_id = ?
          AND read_at IS NULL
    `).get(req.user.id).count;

    res.json({
        success: true,
        dashboard: {
            students,
            teachers,
            parents,
            classes,
            unread_notifications: unread
        }
    });
});

/* =========================================================
   AUDIT LOGS
========================================================= */

app.get(
    "/api/audit-logs",
    auth,
    requireRoles(ROLES.PROGRAMMER),
    (req, res) => {
        const logs = db.prepare(`
            SELECT
                a.*,
                u.full_name
            FROM audit_logs a
            LEFT JOIN users u
                ON u.id = a.user_id
            ORDER BY a.created_at DESC
            LIMIT 500
        `).all();

        res.json({
            success: true,
            logs
        });
    }
);

/* =========================================================
   SEARCH
========================================================= */

app.get("/api/search", auth, (req, res) => {
    const q = String(req.query.q || "").trim();

    if (!q) {
        return res.json({
            success: true,
            students: [],
            users: []
        });
    }

    const like = `%${q}%`;

    const students = db.prepare(`
        SELECT id, student_number, full_name, grade, class_name
        FROM students
        WHERE full_name LIKE ?
           OR student_number LIKE ?
        ORDER BY full_name
        LIMIT 50
    `).all(like, like);

    let users = [];

    if (isManagement(req.user.role)) {
        users = db.prepare(`
            SELECT id, username, full_name, email, role, active
            FROM users
            WHERE full_name LIKE ?
               OR username LIKE ?
               OR email LIKE ?
            ORDER BY full_name
            LIMIT 50
        `).all(
            like,
            like,
            like
        );
    }

    res.json({
        success: true,
        students,
        users
    });
});

/* =========================================================
   HELPERS
========================================================= */

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =========================================================
   STATIC FILES
========================================================= */

app.use(express.static(path.join(__dirname, "public")));

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({
            success: false,
            message: "المسار غير موجود"
        });
    }

    res.status(404).send("Page not found");
});

app.use((error, req, res, next) => {
    console.error("SERVER ERROR:", error);

    res.status(500).json({
        success: false,
        message: "حدث خطأ داخلي في الخادم"
    });
});

/* =========================================================
   DEFAULT PROGRAMMER ACCOUNT
========================================================= */

function createDefaultProgrammer() {
    const existing = db.prepare(`
        SELECT id
        FROM users
        WHERE role = ?
        LIMIT 1
    `).get(ROLES.PROGRAMMER);

    if (existing) {
        return;
    }

    /*
      حساب المبرمج الأول.
      يفضل تغييره مباشرة بعد أول دخول.
    */
    const username =
        process.env.DEFAULT_ADMIN_USERNAME ||
        "programmer";

    const password =
        process.env.DEFAULT_ADMIN_PASSWORD ||
        "123456";

    const result = db.prepare(`
        INSERT INTO users
        (username, password_hash, full_name, email, role,
         must_change_password, active)
        VALUES (?, ?, ?, ?, ?, 1, 1)
    `).run(
        username,
        hashPassword(password),
        "مبرمج النظام",
        process.env.DEFAULT_ADMIN_EMAIL || "",
        ROLES.PROGRAMMER
    );

    console.log(
        `👨‍💻 Default programmer created: ${username}`
    );

    audit(
        result.lastInsertRowid,
        "system_init",
        "Default programmer account created"
    );
}

createDefaultProgrammer();

/* =========================================================
   SERVER
========================================================= */

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server listening on port ${PORT}`);
    console.log("🏫 School Management System v2.0.0");
});
