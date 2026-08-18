const path = require('path');
const Database = require('better-sqlite3');
const Module = require('module');

const DB_PATH = path.join(__dirname, 'school.db');
const originalLoad = Module._load;

function initSaaS(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      logo_url TEXT DEFAULT '',
      primary_color TEXT DEFAULT '#173b70',
      secondary_color TEXT DEFAULT '#24579b',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      address TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      plan TEXT DEFAULT 'basic',
      subscription_status TEXT DEFAULT 'trial',
      subscription_start TEXT,
      subscription_end TEXT,
      max_students INTEGER DEFAULT 500,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS school_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      plan TEXT NOT NULL,
      amount REAL DEFAULT 0,
      billing_cycle TEXT DEFAULT 'monthly',
      status TEXT DEFAULT 'active',
      starts_at TEXT,
      ends_at TEXT,
      reference TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS school_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_name TEXT NOT NULL,
      admin_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      admin_username TEXT NOT NULL,
      admin_password_hash TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      school_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT,
      FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE SET NULL
    );
  `);

  let school = db.prepare('SELECT id FROM schools ORDER BY id LIMIT 1').get();
  if (!school) {
    const r = db.prepare(`INSERT INTO schools
      (code,name,logo_url,primary_color,secondary_color,plan,subscription_status,max_students)
      VALUES (?,?,?,?,?,?,?,?)`).run(
        'BES-001', 'British Education School', '', '#173b70', '#24579b', 'enterprise', 'active', 5000
      );
    school = { id: Number(r.lastInsertRowid) };
  }
  return school.id;
}

Module._load = function(request, parent, isMain) {
  const loaded = originalLoad.apply(this, arguments);
  if (request !== 'express') return loaded;

  function wrappedExpress() {
    const app = loaded();
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    const defaultSchoolId = initSaaS(db);

    app.use((req, res, next) => {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/, '');
      req.saasSchoolId = Number(req.headers['x-school-id'] || defaultSchoolId);
      req.saasToken = token;
      next();
    });

    const isProgrammer = req => ['مبرمج','مبرمج النظام'].includes(req.user?.role) || ['مبرمج','مبرمج النظام'].includes(req.enhancedUser?.role);
    const guard = (req, res, next) => isProgrammer(req) ? next() : res.status(403).json({success:false,message:'صلاحية المبرمج مطلوبة'});

    app.post('/api/saas/school-register', (req,res) => {
      try {
        const {school_name,admin_name,email,phone='',address='',username='',password=''}=req.body||{};
        if(!school_name||!admin_name||!email||!password) return res.status(400).json({success:false,message:'اسم المدرسة واسم المسؤول والبريد وكلمة المرور مطلوبة'});
        const base=String(username||admin_name).trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'.').replace(/^\.|\.$/g,'')||'admin';
        let candidate=base, i=1;
        while(db.prepare('SELECT id FROM users WHERE username=?').get(candidate) || db.prepare('SELECT id FROM school_registrations WHERE admin_username=? AND status=?').get(candidate,'pending')) candidate=`${base}${++i}`;
        const codeBase=String(school_name).replace(/[^\p{L}\p{N}]+/gu,'').slice(0,8).toUpperCase()||'SCHOOL';
        let code=`${codeBase}-${Date.now().toString().slice(-5)}`;
        const crypto=require('crypto');
        const r=db.prepare(`INSERT INTO school_registrations(school_name,admin_name,email,phone,address,admin_username,admin_password_hash)
          VALUES(?,?,?,?,?,?,?)`).run(String(school_name).trim(),String(admin_name).trim(),String(email).trim(),String(phone).trim(),String(address).trim(),candidate,crypto.createHash('sha256').update(String(password)).digest('hex'));
        res.status(201).json({success:true,registration_id:Number(r.lastInsertRowid),username:candidate,school_code:code,message:'تم إرسال طلب المدرسة للمراجعة والاعتماد قبل تفعيل الحساب'});
      } catch(e){res.status(500).json({success:false,message:'تعذر إرسال طلب التسجيل'});}
    });

    app.get('/api/saas/registrations', guard, (req,res) => {
      res.json({success:true,registrations:db.prepare('SELECT id,school_name,admin_name,email,phone,address,admin_username,status,created_at,reviewed_at FROM school_registrations ORDER BY id DESC').all()});
    });

    app.post('/api/saas/registrations/:id/approve', guard, (req,res) => {
      const id=Number(req.params.id), row=db.prepare('SELECT * FROM school_registrations WHERE id=?').get(id);
      if(!row) return res.status(404).json({success:false,message:'طلب التسجيل غير موجود'});
      if(row.status!=='pending') return res.status(400).json({success:false,message:'الطلب تمت مراجعته مسبقاً'});
      try {
        const codeBase=String(row.school_name).replace(/[^\p{L}\p{N}]+/gu,'').slice(0,8).toUpperCase()||'SCHOOL';
        let code=`${codeBase}-${Date.now().toString().slice(-5)}`;
        while(db.prepare('SELECT id FROM schools WHERE code=?').get(code)) code=`${codeBase}-${Math.floor(Math.random()*90000+10000)}`;
        const school=db.prepare(`INSERT INTO schools(code,name,logo_url,primary_color,secondary_color,phone,email,address,status,plan,subscription_status,max_students)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(code,row.school_name,'','#173b70','#24579b',row.phone,row.email,row.address,'active','basic','trial',500);
        const user=db.prepare(`INSERT INTO users(username,password_hash,full_name,email,phone,role,school_id,active,must_change_password)
          VALUES(?,?,?,?,?,?,?,?,?)`).run(row.admin_username,row.admin_password_hash,row.admin_name,row.email,row.phone,'مدير المدرسة',Number(school.lastInsertRowid),1,1);
        db.prepare('UPDATE school_registrations SET status=\'approved\',school_id=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?').run(Number(school.lastInsertRowid),id);
        res.json({success:true,school_id:Number(school.lastInsertRowid),admin_user_id:Number(user.lastInsertRowid),message:'تم اعتماد المدرسة وإنشاء حساب مديرها'});
      } catch(e){res.status(400).json({success:false,message:'تعذر اعتماد الطلب'});}
    });

    app.post('/api/saas/registrations/:id/reject', guard, (req,res) => {
      const id=Number(req.params.id);
      const result=db.prepare("UPDATE school_registrations SET status='rejected',reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").run(id);
      if(!result.changes) return res.status(404).json({success:false,message:'طلب التسجيل غير موجود أو تمت مراجعته'});
      res.json({success:true,message:'تم رفض طلب التسجيل'});
    });

    app.get('/api/saas/schools', guard, (req,res) => {
      const schools = db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM users u WHERE u.school_id=s.id) user_count,
        (SELECT COUNT(*) FROM students st WHERE st.school_id=s.id) student_count
        FROM schools s ORDER BY s.id DESC`).all();
      res.json({success:true,schools});
    });

    app.post('/api/saas/schools', guard, (req,res) => {
      try {
        const {name,code,plan='basic',max_students=500,primary_color='#173b70',secondary_color='#24579b',logo_url='',phone='',email='',address=''} = req.body;
        if(!name || !code) return res.status(400).json({success:false,message:'اسم المدرسة والكود مطلوبان'});
        const r=db.prepare(`INSERT INTO schools(code,name,plan,max_students,primary_color,secondary_color,logo_url,phone,email,address)
          VALUES(?,?,?,?,?,?,?,?,?,?)`).run(code.trim(),name.trim(),plan,Number(max_students),primary_color,secondary_color,logo_url,phone,email,address);
        res.json({success:true,school_id:Number(r.lastInsertRowid),message:'تم إنشاء المدرسة'});
      } catch(e) { res.status(400).json({success:false,message:'كود المدرسة مستخدم أو البيانات غير صحيحة'}); }
    });

    app.put('/api/saas/schools/:id', guard, (req,res) => {
      const id=Number(req.params.id), x=req.body;
      const exists=db.prepare('SELECT id FROM schools WHERE id=?').get(id);
      if(!exists) return res.status(404).json({success:false,message:'المدرسة غير موجودة'});
      db.prepare(`UPDATE schools SET name=COALESCE(?,name),logo_url=COALESCE(?,logo_url),primary_color=COALESCE(?,primary_color),
        secondary_color=COALESCE(?,secondary_color),phone=COALESCE(?,phone),email=COALESCE(?,email),address=COALESCE(?,address),
        status=COALESCE(?,status),plan=COALESCE(?,plan),subscription_status=COALESCE(?,subscription_status),max_students=COALESCE(?,max_students),
        notes=COALESCE(?,notes),updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
          x.name??null,x.logo_url??null,x.primary_color??null,x.secondary_color??null,x.phone??null,x.email??null,x.address??null,
          x.status??null,x.plan??null,x.subscription_status??null,x.max_students??null,x.notes??null,id);
      res.json({success:true,message:'تم تحديث المدرسة'});
    });

    app.get('/api/saas/schools/:id', guard, (req,res) => {
      const school=db.prepare('SELECT * FROM schools WHERE id=?').get(Number(req.params.id));
      if(!school) return res.status(404).json({success:false,message:'المدرسة غير موجودة'});
      const subscriptions=db.prepare('SELECT * FROM school_subscriptions WHERE school_id=? ORDER BY id DESC').all(school.id);
      res.json({success:true,school,subscriptions});
    });

    app.post('/api/saas/schools/:id/subscriptions', guard, (req,res) => {
      const id=Number(req.params.id), {plan,amount=0,billing_cycle='monthly',starts_at='',ends_at='',reference='',notes=''}=req.body;
      if(!plan) return res.status(400).json({success:false,message:'الخطة مطلوبة'});
      const r=db.prepare(`INSERT INTO school_subscriptions(school_id,plan,amount,billing_cycle,starts_at,ends_at,reference,notes)
        VALUES(?,?,?,?,?,?,?,?)`).run(id,plan,Number(amount),billing_cycle,starts_at,ends_at,reference,notes);
      db.prepare(`UPDATE schools SET plan=?,subscription_status='active',subscription_start=?,subscription_end=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(plan,starts_at||null,ends_at||null,id);
      res.json({success:true,id:Number(r.lastInsertRowid),message:'تم تحديث اشتراك المدرسة'});
    });

    app.get('/api/saas/branding', (req,res) => {
      const id=Number(req.headers['x-school-id'] || defaultSchoolId);
      const school=db.prepare('SELECT id,name,logo_url,primary_color,secondary_color,phone,email,address,plan,subscription_status FROM schools WHERE id=?').get(id) || db.prepare('SELECT id,name,logo_url,primary_color,secondary_color,phone,email,address,plan,subscription_status FROM schools WHERE id=?').get(defaultSchoolId);
      res.json({success:true,school});
    });

    app.post('/api/saas/schools/:id/admin', guard, (req,res) => {
      const {username,password,full_name,email='',phone=''}=req.body;
      if(!username||!password||!full_name) return res.status(400).json({success:false,message:'بيانات المدير مطلوبة'});
      const cols=db.prepare("PRAGMA table_info(users)").all().map(x=>x.name);
      if(!cols.includes('school_id')) return res.status(500).json({success:false,message:'قاعدة البيانات تحتاج ترقية'});
      const crypto=require('crypto');
      try {
        const r=db.prepare(`INSERT INTO users(username,password_hash,full_name,email,phone,role,school_id,must_change_password) VALUES(?,?,?,?,?,?,?,1)`).run(
          username.trim(),crypto.createHash('sha256').update(String(password)).digest('hex'),full_name.trim(),email,phone,'مدير المدرسة',Number(req.params.id));
        res.json({success:true,user_id:Number(r.lastInsertRowid),message:'تم إنشاء مدير المدرسة'});
      } catch(e){res.status(400).json({success:false,message:'اسم المستخدم مستخدم بالفعل أو تعذر إنشاء المدير'});}
    });

    const cols=db.prepare('PRAGMA table_info(users)').all().map(x=>x.name);
    if(!cols.includes('school_id')) db.exec('ALTER TABLE users ADD COLUMN school_id INTEGER');
    const studentCols=db.prepare('PRAGMA table_info(students)').all().map(x=>x.name);
    if(!studentCols.includes('school_id')) db.exec('ALTER TABLE students ADD COLUMN school_id INTEGER');
    const parentCols=db.prepare('PRAGMA table_info(parents)').all().map(x=>x.name);
    if(!parentCols.includes('school_id')) db.exec('ALTER TABLE parents ADD COLUMN school_id INTEGER');
    db.prepare('UPDATE users SET school_id=? WHERE school_id IS NULL').run(defaultSchoolId);
    db.prepare('UPDATE students SET school_id=? WHERE school_id IS NULL').run(defaultSchoolId);
    db.prepare('UPDATE parents SET school_id=? WHERE school_id IS NULL').run(defaultSchoolId);

    return app;
  }
  return wrappedExpress;
};
