const crypto=require('crypto');
const Database=require('better-sqlite3');
const path=require('path');
const db=new Database(path.join(__dirname,'school.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS platform_permissions(id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS role_permissions(role TEXT NOT NULL, permission_id INTEGER NOT NULL, PRIMARY KEY(role,permission_id), FOREIGN KEY(permission_id) REFERENCES platform_permissions(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS schools(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,slug TEXT UNIQUE,logo_url TEXT,primary_color TEXT DEFAULT '#173b70',status TEXT DEFAULT 'pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS school_users(school_id INTEGER NOT NULL,user_id INTEGER NOT NULL,job_title TEXT,approved INTEGER DEFAULT 0,PRIMARY KEY(school_id,user_id),FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS security_events(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,school_id INTEGER,event TEXT NOT NULL,ip TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
const perms=[['platform.manage','إدارة المنصة'],['schools.manage','إدارة المدارس'],['users.manage','إدارة المستخدمين'],['roles.manage','إدارة الوظائف والصلاحيات'],['audit.read','قراءة سجل التدقيق'],['backup.manage','النسخ الاحتياطي والاستعادة'],['school.settings','إعدادات المدرسة'],['students.manage','إدارة الطلاب'],['teachers.manage','إدارة المعلمين'],['reports.read','قراءة التقارير']];
const ins=db.prepare('INSERT OR IGNORE INTO platform_permissions(code,label) VALUES (?,?)');for(const p of perms)ins.run(...p);
const all=db.prepare('SELECT id FROM platform_permissions').all().map(x=>x.id);const roles=['مبرمج','مدير'];const rp=db.prepare('INSERT OR IGNORE INTO role_permissions(role,permission_id) VALUES (?,?)');for(const role of roles)for(const id of all)rp.run(role,id);
function ensureSchoolUser(schoolId,userId,jobTitle){db.prepare('INSERT OR IGNORE INTO school_users(school_id,user_id,job_title,approved) VALUES (?,?,?,1)').run(schoolId,userId,jobTitle||null)}
function scopedUser(userId,schoolId){return !!db.prepare('SELECT 1 FROM school_users WHERE school_id=? AND user_id=? AND approved=1').get(schoolId,userId)}
function hasPermission(role,code){return !!db.prepare('SELECT 1 FROM role_permissions rp JOIN platform_permissions p ON p.id=rp.permission_id WHERE rp.role=? AND p.code=?').get(role,code)}
function audit(userId,schoolId,event,ip){db.prepare('INSERT INTO security_events(user_id,school_id,event,ip) VALUES (?,?,?,?)').run(userId||null,schoolId||null,event,ip||null)}
module.exports={db,ensureSchoolUser,scopedUser,hasPermission,audit};
process.on('exit',()=>db.close());
