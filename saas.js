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
