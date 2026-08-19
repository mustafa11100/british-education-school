const express = require("express");
const bodyParser = require("body-parser");
const Database = require("better-sqlite3");
const nodemailer = require("nodemailer");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.BACKEND_PORT || 8081;

// Legacy compatibility modules wrap the Express factory. Never assume that
// express.json/urlencoded/static survived those wrappers.
const jsonParser = typeof express.json === "function"
  ? express.json({ limit: "2mb" })
  : bodyParser.json({ limit: "2mb" });
const urlencodedParser = typeof express.urlencoded === "function"
  ? express.urlencoded({ extended: true })
  : bodyParser.urlencoded({ extended: true });
app.use(jsonParser);
app.use(urlencodedParser);

const db = new Database(path.join(__dirname, "school.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/* Core schema. bootstrap-db.js normally creates these first; IF NOT EXISTS
   keeps this process safe when started independently. */
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
 school_id INTEGER,
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
 school_id INTEGER,
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
 school_id INTEGER,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS student_parents (
 student_id INTEGER NOT NULL,
 parent_id INTEGER NOT NULL,
 relation TEXT DEFAULT 'ولي أمر',
 PRIMARY KEY(student_id,parent_id),
 FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
 FOREIGN KEY(parent_id) REFERENCES parents(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER,
 action TEXT NOT NULL,
 details TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT);
`);

function hashPassword(password) {
 return crypto.createHash("sha256").update(String(password)).digest("hex");
}
function token() { return crypto.randomBytes(32).toString("hex"); }
const sessions = new Map();

const ROLES = {
 PROGRAMMER: "مبرمج", ADMIN: "مدير", OPERATIONS: "عمليات", QUALITY: "جودة",
 SUPERVISOR: "مشرف", TEACHER: "معلم", PARENT: "ولي أمر", STUDENT: "طالب"
};
const ALL_ROLES = Object.values(ROLES);

function audit(userId, action, details = "") {
 try { db.prepare("INSERT INTO audit_logs(user_id,action,details) VALUES(?,?,?)").run(userId || null, action, details); } catch (_) {}
}
function auth(req, res, next) {
 const raw = req.headers.authorization || "";
 const t = raw.replace(/^Bearer\s+/i, "");
 const s = t && sessions.get(t);
 if (!s) return res.status(401).json({success:false,message:"يجب تسجيل الدخول أولاً"});
 const user = db.prepare("SELECT id,username,full_name,email,phone,role,active,must_change_password,school_id FROM users WHERE id=?").get(s.userId);
 if (!user || !user.active) { sessions.delete(t); return res.status(401).json({success:false,message:"الحساب غير فعال"}); }
 req.user = user; req.token = t; next();
}
function roles(...allowed) {
 return (req,res,next) => allowed.includes(req.user.role)
  ? next() : res.status(403).json({success:false,message:"ليس لديك صلاحية لتنفيذ هذا الإجراء"});
}

app.get("/health", (req,res)=>res.json({success:true,status:"online",service:"backend",time:new Date().toISOString()}));
app.get("/api/health", (req,res)=>res.json({success:true,status:"online",time:new Date().toISOString()}));
app.get("/", (req,res)=>res.json({success:true,message:"EduCore backend is running",version:"2.3.0"}));

app.post("/api/auth/login", (req,res)=>{
 try {
  const {username,password} = req.body || {};
  if (!username || !password) return res.status(400).json({success:false,message:"أدخل اسم المستخدم وكلمة المرور"});
  const user = db.prepare("SELECT * FROM users WHERE username=?").get(String(username).trim());
  if (!user || user.password_hash !== hashPassword(password)) return res.status(401).json({success:false,message:"اسم المستخدم أو كلمة المرور غير صحيحة"});
  if (!user.active) return res.status(403).json({success:false,message:"الحساب غير مفعل أو بانتظار الاعتماد"});
  const t = token(); sessions.set(t,{userId:user.id,createdAt:Date.now()}); audit(user.id,"login");
  res.json({success:true,token:t,user:{id:user.id,username:user.username,full_name:user.full_name,email:user.email,phone:user.phone,role:user.role,school_id:user.school_id,must_change_password:Boolean(user.must_change_password)}});
 } catch(e) { console.error("LOGIN",e); res.status(500).json({success:false,message:"حدث خطأ أثناء تسجيل الدخول"}); }
});
app.post("/api/auth/logout",auth,(req,res)=>{sessions.delete(req.token);audit(req.user.id,"logout");res.json({success:true});});
app.get("/api/auth/me",auth,(req,res)=>res.json({success:true,user:req.user}));
app.post("/api/auth/change-password",auth,(req,res)=>{
 const {old_password,new_password}=req.body||{};
 if(!old_password||!new_password||String(new_password).length<6)return res.status(400).json({success:false,message:"كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل"});
 const row=db.prepare("SELECT password_hash FROM users WHERE id=?").get(req.user.id);
 if(row.password_hash!==hashPassword(old_password))return res.status(400).json({success:false,message:"كلمة المرور القديمة غير صحيحة"});
 db.prepare("UPDATE users SET password_hash=?,must_change_password=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(hashPassword(new_password),req.user.id);
 res.json({success:true,message:"تم تغيير كلمة المرور"});
});

app.get("/api/users",auth,roles(ROLES.PROGRAMMER,ROLES.ADMIN),(req,res)=>{
 const users=db.prepare("SELECT id,username,full_name,email,phone,role,active,must_change_password,school_id,created_at FROM users ORDER BY id DESC").all();
 res.json({success:true,users});
});
app.post("/api/users",auth,roles(ROLES.PROGRAMMER,ROLES.ADMIN),(req,res)=>{
 try {
  const b=req.body||{};
  if(!b.username||!b.password||!b.full_name||!b.role)return res.status(400).json({success:false,message:"البيانات الأساسية مطلوبة"});
  if(!ALL_ROLES.includes(b.role))return res.status(400).json({success:false,message:"الوظيفة غير صحيحة"});
  if(req.user.role===ROLES.ADMIN&&b.role===ROLES.PROGRAMMER)return res.status(403).json({success:false,message:"لا يمكن للمدير إنشاء حساب مبرمج"});
  if(db.prepare("SELECT id FROM users WHERE username=?").get(String(b.username).trim()))return res.status(400).json({success:false,message:"اسم المستخدم موجود بالفعل"});
  const r=db.prepare("INSERT INTO users(username,password_hash,full_name,email,phone,role,active,must_change_password,school_id) VALUES(?,?,?,?,?,?,1,1,?)").run(String(b.username).trim(),hashPassword(b.password),String(b.full_name).trim(),b.email||"",b.phone||"",b.role,b.school_id||null);
  audit(req.user.id,"create_user",`user_id=${r.lastInsertRowid}`);res.json({success:true,user_id:r.lastInsertRowid,message:"تم إنشاء المستخدم"});
 } catch(e){console.error(e);res.status(500).json({success:false,message:"تعذر إنشاء المستخدم"});}
});
app.put("/api/users/:id",auth,roles(ROLES.PROGRAMMER,ROLES.ADMIN),(req,res)=>{
 const id=Number(req.params.id); const u=db.prepare("SELECT * FROM users WHERE id=?").get(id); if(!u)return res.status(404).json({success:false,message:"المستخدم غير موجود"});
 if(req.user.role===ROLES.ADMIN&&u.role===ROLES.PROGRAMMER)return res.status(403).json({success:false,message:"لا يمكن تعديل حساب المبرمج"});
 const b=req.body||{}; db.prepare("UPDATE users SET full_name=COALESCE(?,full_name),email=COALESCE(?,email),phone=COALESCE(?,phone),role=COALESCE(?,role),active=COALESCE(?,active),school_id=COALESCE(?,school_id),updated_at=CURRENT_TIMESTAMP WHERE id=?").run(b.full_name??null,b.email??null,b.phone??null,b.role??null,b.active===undefined?null:(b.active?1:0),b.school_id??null,id);
 res.json({success:true,message:"تم تحديث المستخدم"});
});

app.get("/api/students",auth,(req,res)=>{
 let rows;
 if(req.user.role===ROLES.STUDENT) rows=db.prepare("SELECT * FROM students WHERE user_id=?").all(req.user.id);
 else if(req.user.school_id) rows=db.prepare("SELECT * FROM students WHERE school_id=? ORDER BY id DESC").all(req.user.school_id);
 else rows=db.prepare("SELECT * FROM students ORDER BY id DESC").all();
 res.json({success:true,students:rows});
});
app.post("/api/students",auth,roles(ROLES.PROGRAMMER,ROLES.ADMIN,ROLES.OPERATIONS,ROLES.SUPERVISOR),(req,res)=>{
 const b=req.body||{}; if(!b.full_name)return res.status(400).json({success:false,message:"اسم الطالب مطلوب"});
 try{const r=db.prepare("INSERT INTO students(student_number,full_name,grade,class_name,date_of_birth,gender,address,notes,user_id,school_id) VALUES(?,?,?,?,?,?,?,?,?,?)").run(b.student_number||null,b.full_name,b.grade||"",b.class_name||"",b.date_of_birth||"",b.gender||"",b.address||"",b.notes||"",b.user_id||null,b.school_id||req.user.school_id||null);res.json({success:true,student_id:r.lastInsertRowid,message:"تم إضافة الطالب"});}
 catch(e){res.status(400).json({success:false,message:"تعذر إضافة الطالب. ربما رقم الطالب موجود مسبقاً."});}
});

app.get("/api/parents",auth,roles(ROLES.PROGRAMMER,ROLES.ADMIN,ROLES.OPERATIONS,ROLES.SUPERVISOR),(req,res)=>{
 const rows=req.user.school_id?db.prepare("SELECT p.*,u.username,u.active FROM parents p LEFT JOIN users u ON u.id=p.user_id WHERE p.school_id=? ORDER BY p.id DESC").all(req.user.school_id):db.prepare("SELECT p.*,u.username,u.active FROM parents p LEFT JOIN users u ON u.id=p.user_id ORDER BY p.id DESC").all();
 res.json({success:true,parents:rows});
});

app.get("/api/dashboard",auth,(req,res)=>{
 const school=req.user.school_id;
 const where=school?" AND school_id=?":""; const arg=school?[school]:[];
 const students=db.prepare(`SELECT COUNT(*) count FROM students WHERE active=1${where}`).get(...arg).count;
 const teachers=school?db.prepare("SELECT COUNT(*) count FROM users WHERE role=? AND active=1 AND school_id=?").get(ROLES.TEACHER,school).count:db.prepare("SELECT COUNT(*) count FROM users WHERE role=? AND active=1").get(ROLES.TEACHER).count;
 const parents=school?db.prepare("SELECT COUNT(*) count FROM users WHERE role=? AND active=1 AND school_id=?").get(ROLES.PARENT,school).count:db.prepare("SELECT COUNT(*) count FROM users WHERE role=? AND active=1").get(ROLES.PARENT).count;
 res.json({success:true,dashboard:{students,teachers,parents}});
});

const staticMiddleware = typeof express.static === "function" ? express.static(path.join(__dirname,"public")) : null;
if(staticMiddleware) app.use(staticMiddleware);
app.use((req,res)=>res.status(req.path.startsWith("/api/")?404:404).json({success:false,message:"المسار غير موجود"}));
app.use((err,req,res,next)=>{console.error("SERVER ERROR",err);res.status(500).json({success:false,message:"حدث خطأ داخلي في الخادم"});});

app.listen(PORT,"0.0.0.0",()=>console.log(`🚀 Backend listening on ${PORT}`));
