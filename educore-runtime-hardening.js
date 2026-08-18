const crypto=require('crypto');
const Database=require('better-sqlite3');
const path=require('path');
const db=new Database(path.join(__dirname,'school.db'));
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,school_id INTEGER,action TEXT NOT NULL,method TEXT,path TEXT,ip TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS school_memberships(school_id INTEGER NOT NULL,user_id INTEGER NOT NULL,approved INTEGER DEFAULT 0,job_title TEXT,PRIMARY KEY(school_id,user_id)); CREATE TABLE IF NOT EXISTS platform_permissions(id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT UNIQUE NOT NULL,label TEXT NOT NULL); CREATE TABLE IF NOT EXISTS role_permissions(role TEXT NOT NULL,permission_id INTEGER NOT NULL,PRIMARY KEY(role,permission_id));`);
const permissions=[['platform.manage','إدارة المنصة'],['schools.manage','إدارة المدارس'],['users.manage','إدارة المستخدمين'],['roles.manage','إدارة الوظائف والصلاحيات'],['audit.read','قراءة سجل التدقيق'],['backup.manage','النسخ الاحتياطي والاستعادة'],['school.settings','إعدادات المدرسة'],['students.manage','إدارة الطلاب'],['teachers.manage','إدارة المعلمين'],['reports.read','قراءة التقارير']];
const ins=db.prepare('INSERT OR IGNORE INTO platform_permissions(code,label) VALUES (?,?)');permissions.forEach(x=>ins.run(...x));
function digest(value){return crypto.createHash('sha256').update(String(value)).digest('hex')}
function audit(req,user,action){try{db.prepare('INSERT INTO audit_log(user_id,school_id,action,method,path,ip) VALUES (?,?,?,?,?,?)').run(user?.id||null,user?.school_id||null,action,req.method,req.url,req.headers['x-forwarded-for']||req.socket.remoteAddress||null)}catch{}}
function schoolScope(user,schoolId){if(!user||!schoolId)return false;if(['مبرمج','مبرمج النظام'].includes(user.role))return true;return !!db.prepare('SELECT 1 FROM school_memberships WHERE school_id=? AND user_id=? AND approved=1').get(Number(schoolId),Number(user.id))}
function permission(role,code){if(['مبرمج','مبرمج النظام'].includes(role))return true;return !!db.prepare('SELECT 1 FROM role_permissions rp JOIN platform_permissions p ON p.id=rp.permission_id WHERE rp.role=? AND p.code=?').get(role,code)}
module.exports={db,digest,audit,schoolScope,permission};
process.on('exit',()=>db.close());
