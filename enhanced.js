const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Module = require('module');
const Database = require('better-sqlite3');

const originalLoad = Module._load;
const tokenUsers = new Map();
const DB_PATH = path.join(__dirname, 'school.db');

const roleSeed = [
['مبرمج النظام','programmer'],['مدير المدرسة','school_manager'],['نائب مدير المدرسة','vice_principal'],['المدير الأكاديمي','academic_director'],['المدير الإداري','administrative_director'],
['مشرف أكاديمي','academic_supervisor'],['مشرف تربوي','educational_supervisor'],['مشرف إداري','administrative_supervisor'],['رئيس قسم','department_head'],['منسق أكاديمي','academic_coordinator'],
['معلم','teacher'],['معلم أول','senior_teacher'],['معلم مساعد','assistant_teacher'],['مدرس بديل','substitute_teacher'],
['مسؤول شؤون الطلاب','student_affairs'],['مسؤول التسجيل والقبول','admissions'],['مسؤول الحضور والغياب','attendance_officer'],['مسؤول الأنشطة الطلابية','activities'],['مرشد طلابي','counselor'],
['مدير مالي','finance_manager'],['محاسب','accountant'],['مسؤول الرسوم الدراسية','fees_officer'],['أمين صندوق','cashier'],
['مدير الجودة','quality_manager'],['مسؤول الجودة','quality_officer'],['مسؤول التقييم والمتابعة','assessment_officer'],
['مسؤول العمليات','operations_officer'],['مسؤول الموارد البشرية','hr_officer'],['مسؤول تقنية المعلومات','it_officer'],['مسؤول المرافق','facilities_officer'],['أمين مكتبة','librarian'],['مسؤول النقل المدرسي','transport_officer'],['مسؤول الأمن والسلامة','safety_officer'],
['ولي أمر','parent'],['طالب','student']
];

const permissionSeed = [
['dashboard','لوحة التحكم'],['users.view','عرض المستخدمين'],['users.manage','إدارة المستخدمين'],['roles.manage','إدارة الوظائف والصلاحيات'],['students.view','عرض الطلاب'],['students.manage','إدارة الطلاب'],['parents.view','عرض أولياء الأمور'],['parents.manage','إدارة أولياء الأمور'],['teachers.view','عرض المعلمين'],['teachers.manage','إدارة المعلمين'],['classes.manage','إدارة الفصول'],['subjects.manage','إدارة المواد'],['schedule.manage','إدارة الجداول'],['attendance.view','عرض الحضور'],['attendance.manage','إدارة الحضور'],['results.view','عرض النتائج'],['results.manage','إدارة النتائج'],['notes.view','عرض الملاحظات'],['notes.manage','إدارة الملاحظات'],['fees.view','عرض الرسوم'],['fees.manage','إدارة الرسوم والمدفوعات'],['notifications.manage','إدارة الإشعارات'],['reports.view','عرض التقارير'],['settings.manage','إعدادات النظام']
];

function hashPassword(password){ return crypto.createHash('sha256').update(String(password)).digest('hex'); }
function dbInit(){
  const db = new Database(DB_PATH); db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON');
  db.exec(`CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE NOT NULL,slug TEXT UNIQUE NOT NULL,active INTEGER DEFAULT 1,system INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS permissions (id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT UNIQUE NOT NULL,label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS role_permissions (role_id INTEGER NOT NULL,permission_id INTEGER NOT NULL,PRIMARY KEY(role_id,permission_id),FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE,FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS fees (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,description TEXT,amount REAL NOT NULL DEFAULT 0,due_date TEXT,status TEXT DEFAULT 'unpaid',created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT,fee_id INTEGER,student_id INTEGER NOT NULL,amount REAL NOT NULL DEFAULT 0,payment_date TEXT DEFAULT CURRENT_TIMESTAMP,method TEXT,reference TEXT,notes TEXT,FOREIGN KEY(fee_id) REFERENCES fees(id) ON DELETE SET NULL,FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS results (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,subject TEXT NOT NULL,exam TEXT,term TEXT,score REAL DEFAULT 0,max_score REAL DEFAULT 100,teacher_id INTEGER,notes TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS attendance (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,attendance_date TEXT NOT NULL,status TEXT NOT NULL,notes TEXT,created_by INTEGER,UNIQUE(student_id,attendance_date),FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE);
`);
  for(const [name,slug] of roleSeed) db.prepare('INSERT OR IGNORE INTO roles(name,slug,system) VALUES(?,?,1)').run(name,slug);
  for(const [code,label] of permissionSeed) db.prepare('INSERT OR IGNORE INTO permissions(code,label) VALUES(?,?)').run(code,label);
  const allPerm = db.prepare('SELECT id FROM permissions').all().map(x=>x.id);
  const programmer = db.prepare("SELECT id FROM roles WHERE slug='programmer'").get();
  if(programmer) for(const pid of allPerm) db.prepare('INSERT OR IGNORE INTO role_permissions(role_id,permission_id) VALUES(?,?)').run(programmer.id,pid);
  const mappings = {
    school_manager:['dashboard','users.view','users.manage','students.view','students.manage','parents.view','parents.manage','teachers.view','teachers.manage','classes.manage','subjects.manage','schedule.manage','attendance.view','attendance.manage','results.view','results.manage','notes.view','notes.manage','fees.view','fees.manage','notifications.manage','reports.view'],
    vice_principal:['dashboard','students.view','parents.view','teachers.view','attendance.view','attendance.manage','results.view','notes.view','notes.manage','reports.view'],
    academic_director:['dashboard','students.view','teachers.view','teachers.manage','classes.manage','subjects.manage','schedule.manage','attendance.view','results.view','results.manage','notes.view','notes.manage','reports.view'],
    teacher:['dashboard','students.view','attendance.view','attendance.manage','results.view','results.manage','notes.view','notes.manage'],
    parent:['dashboard','students.view','attendance.view','results.view','notes.view','fees.view'],
    student:['dashboard','students.view','attendance.view','results.view','notes.view'],
    finance_manager:['dashboard','fees.view','fees.manage','reports.view'], accountant:['dashboard','fees.view','fees.manage','reports.view'], fees_officer:['dashboard','fees.view','fees.manage'], cashier:['dashboard','fees.view','fees.manage'],
    quality_manager:['dashboard','students.view','teachers.view','attendance.view','results.view','notes.view','reports.view'], quality_officer:['dashboard','students.view','attendance.view','results.view','notes.view','reports.view'], assessment_officer:['dashboard','students.view','results.view','results.manage','reports.view'],
    student_affairs:['dashboard','students.view','students.manage','parents.view','attendance.view','notes.view','notes.manage','reports.view'], admissions:['dashboard','students.view','students.manage','parents.view','parents.manage'], attendance_officer:['dashboard','students.view','attendance.view','attendance.manage','reports.view'], counselor:['dashboard','students.view','attendance.view','notes.view','notes.manage'],
    operations_officer:['dashboard','students.view','parents.view','teachers.view','attendance.view','reports.view'], hr_officer:['dashboard','users.view','users.manage','teachers.view','teachers.manage','reports.view'], it_officer:['dashboard','users.view','users.manage','roles.manage','settings.manage','reports.view']
  };
  for(const [slug,codes] of Object.entries(mappings)){ const r=db.prepare('SELECT id FROM roles WHERE slug=?').get(slug); if(!r) continue; for(const code of codes){const p=db.prepare('SELECT id FROM permissions WHERE code=?').get(code); if(p) db.prepare('INSERT OR IGNORE INTO role_permissions(role_id,permission_id) VALUES(?,?)').run(r.id,p.id);} }
  db.close();
}

dbInit();

Module._load = function(request,parent,isMain){
  const loaded = originalLoad.apply(this,arguments);
  if(request !== 'express') return loaded;
  function wrappedExpress(){
    const app = loaded();
    app.use(loaded.json({limit:'4mb'}));
    app.use(loaded.urlencoded({extended:true}));
    app.use((req,res,next)=>{
      if(req.method==='GET' && (req.path==='/' || req.path==='/index.html')) return res.sendFile(path.join(__dirname,'index.html'));
      next();
    });
    const db = new Database(DB_PATH); db.pragma('journal_mode = WAL');
    const auth = (req,res,next)=>{ const t=(req.headers.authorization||'').replace(/^Bearer\s+/,''); const u=tokenUsers.get(t); if(!u) return res.status(401).json({success:false,message:'يجب تسجيل الدخول'}); req.enhancedUser=u; next(); };
    const programmerOnly=(req,res,next)=>{ if(req.enhancedUser.role!=='مبرمج' && req.enhancedUser.role!=='مبرمج النظام') return res.status(403).json({success:false,message:'صلاحية المبرمج مطلوبة'}); next(); };
    const parentOnly=(req,res,next)=>{ if(req.enhancedUser.role!=='ولي أمر') return res.status(403).json({success:false,message:'هذه الصفحة لولي الأمر'}); next(); };
    app.get('/api/system/roles',auth,(req,res)=>{ const roles=db.prepare('SELECT id,name,slug,active,system FROM roles ORDER BY id').all(); res.json({success:true,roles}); });
    app.get('/api/system/permissions',auth,programmerOnly,(req,res)=>res.json({success:true,permissions:db.prepare('SELECT * FROM permissions ORDER BY id').all()}));
    app.post('/api/system/roles',auth,programmerOnly,(req,res)=>{try{const {name,slug}=req.body;if(!name||!slug)return res.status(400).json({success:false,message:'اسم الوظيفة والمعرف مطلوبان'});const r=db.prepare('INSERT INTO roles(name,slug,system) VALUES(?,?,0)').run(name.trim(),slug.trim());res.json({success:true,role_id:r.lastInsertRowid});}catch(e){res.status(400).json({success:false,message:'الوظيفة موجودة بالفعل أو البيانات غير صحيحة'});}});
    app.put('/api/system/roles/:id',auth,programmerOnly,(req,res)=>{const id=Number(req.params.id);const r=db.prepare('SELECT * FROM roles WHERE id=?').get(id);if(!r)return res.status(404).json({success:false,message:'الوظيفة غير موجودة'});const {name,active}=req.body;db.prepare('UPDATE roles SET name=COALESCE(?,name),active=COALESCE(?,active) WHERE id=?').run(name||null,active===undefined?null:(active?1:0),id);res.json({success:true});});
    app.get('/api/system/roles/:id/permissions',auth,programmerOnly,(req,res)=>{const rows=db.prepare('SELECT p.id,p.code,p.label,CASE WHEN rp.role_id IS NULL THEN 0 ELSE 1 END enabled FROM permissions p LEFT JOIN role_permissions rp ON rp.permission_id=p.id AND rp.role_id=? ORDER BY p.id').all(Number(req.params.id));res.json({success:true,permissions:rows});});
    app.put('/api/system/roles/:id/permissions',auth,programmerOnly,(req,res)=>{const id=Number(req.params.id), ids=Array.isArray(req.body.permission_ids)?req.body.permission_ids.map(Number):[];const tx=db.transaction(()=>{db.prepare('DELETE FROM role_permissions WHERE role_id=?').run(id);const ins=db.prepare('INSERT OR IGNORE INTO role_permissions(role_id,permission_id) VALUES(?,?)');ids.forEach(pid=>ins.run(id,pid));});tx();res.json({success:true});});
    app.get('/api/parent/dashboard',auth,parentOnly,(req,res)=>{const p=db.prepare('SELECT id FROM parents WHERE user_id=?').get(req.enhancedUser.id);if(!p)return res.json({success:true,students:[],fees:[],payments:[],results:[],notes:[],attendance:[]});const students=db.prepare('SELECT s.* FROM students s JOIN student_parents sp ON sp.student_id=s.id WHERE sp.parent_id=? ORDER BY s.full_name').all(p.id);const ids=students.map(s=>s.id);const q=(sql)=>ids.length?db.prepare(sql.replace('/*IDS*/',ids.map(()=>'?').join(','))).all(...ids):[];const fees=q('SELECT * FROM fees WHERE student_id IN (/*IDS*/) ORDER BY due_date DESC');const payments=q('SELECT * FROM payments WHERE student_id IN (/*IDS*/) ORDER BY payment_date DESC');const results=q('SELECT * FROM results WHERE student_id IN (/*IDS*/) ORDER BY created_at DESC');const notes=q('SELECT * FROM notes WHERE student_id IN (/*IDS*/) AND visible_to_parent=1 ORDER BY created_at DESC');const attendance=q('SELECT * FROM attendance WHERE student_id IN (/*IDS*/) ORDER BY attendance_date DESC');res.json({success:true,students,fees,payments,results,notes,attendance});});
    app.get('/api/parent/summary',auth,parentOnly,(req,res)=>{const p=db.prepare('SELECT id FROM parents WHERE user_id=?').get(req.enhancedUser.id);if(!p)return res.json({success:true,summary:{students:0,total:0,paid:0,remaining:0}});const s=db.prepare('SELECT COUNT(*) c FROM student_parents WHERE parent_id=?').get(p.id).c;const total=db.prepare('SELECT COALESCE(SUM(f.amount),0) n FROM fees f JOIN student_parents sp ON sp.student_id=f.student_id WHERE sp.parent_id=?').get(p.id).n;const paid=db.prepare('SELECT COALESCE(SUM(x.amount),0) n FROM payments x JOIN student_parents sp ON sp.student_id=x.student_id WHERE sp.parent_id=?').get(p.id).n;res.json({success:true,summary:{students:s,total,paid,remaining:total-paid}});});
    app.get('/api/admin/fees',auth,(req,res)=>res.json({success:true,fees:db.prepare('SELECT f.*,s.full_name student_name,COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.fee_id=f.id),0) paid FROM fees f JOIN students s ON s.id=f.student_id ORDER BY f.id DESC').all()}));
    app.post('/api/admin/fees',auth,(req,res)=>{const {student_id,description,amount,due_date}=req.body;if(!student_id||amount===undefined)return res.status(400).json({success:false,message:'الطالب والمبلغ مطلوبان'});const r=db.prepare('INSERT INTO fees(student_id,description,amount,due_date) VALUES(?,?,?,?)').run(student_id,description||'',Number(amount),due_date||'');res.json({success:true,id:r.lastInsertRowid});});
    app.post('/api/admin/payments',auth,(req,res)=>{const {fee_id,student_id,amount,method,reference,notes}=req.body;if(!student_id||!amount)return res.status(400).json({success:false,message:'الطالب والمبلغ مطلوبان'});const r=db.prepare('INSERT INTO payments(fee_id,student_id,amount,method,reference,notes) VALUES(?,?,?,?,?,?)').run(fee_id||null,student_id,Number(amount),method||'',reference||'',notes||'');res.json({success:true,id:r.lastInsertRowid});});
    app.get('/api/admin/results',auth,(req,res)=>res.json({success:true,results:db.prepare('SELECT r.*,s.full_name student_name FROM results r JOIN students s ON s.id=r.student_id ORDER BY r.id DESC').all()}));
    app.post('/api/admin/results',auth,(req,res)=>{const {student_id,subject,exam,term,score,max_score,notes}=req.body;if(!student_id||!subject)return res.status(400).json({success:false,message:'الطالب والمادة مطلوبان'});const r=db.prepare('INSERT INTO results(student_id,subject,exam,term,score,max_score,notes) VALUES(?,?,?,?,?,?,?)').run(student_id,subject,exam||'',term||'',Number(score||0),Number(max_score||100),notes||'');res.json({success:true,id:r.lastInsertRowid});});
    app.get('/api/admin/attendance',auth,(req,res)=>res.json({success:true,attendance:db.prepare('SELECT a.*,s.full_name student_name FROM attendance a JOIN students s ON s.id=a.student_id ORDER BY attendance_date DESC').all()}));
    app.post('/api/admin/attendance',auth,(req,res)=>{const {student_id,attendance_date,status,notes}=req.body;if(!student_id||!attendance_date||!status)return res.status(400).json({success:false,message:'بيانات الحضور ناقصة'});db.prepare('INSERT INTO attendance(student_id,attendance_date,status,notes,created_by) VALUES(?,?,?,?,?) ON CONFLICT(student_id,attendance_date) DO UPDATE SET status=excluded.status,notes=excluded.notes').run(student_id,attendance_date,status,notes||'',req.enhancedUser.id);res.json({success:true});});
    const originalPost=app.post;
    app.post=function(route,...handlers){
      if(route==='/api/auth/login'){
        const last=handlers[handlers.length-1];handlers[handlers.length-1]=function(req,res,next){const old=res.json.bind(res);res.json=(body)=>{if(body&&body.success&&body.token&&body.user) tokenUsers.set(body.token,body.user);return old(body);};return last(req,res,next);};
      }
      return originalPost.call(this,route,...handlers);
    };
    return app;
  }
  Object.assign(wrappedExpress, loaded);
  return wrappedExpress;
};
