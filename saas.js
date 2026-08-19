const path = require('path');
const Database = require('better-sqlite3');
const Module = require('module');

const DB_PATH = path.join(__dirname, 'school.db');
const originalLoad = Module._load;

function ensureColumn(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(x => x.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function slugify(value, fallback = 'school') {
  return String(value || fallback).trim().toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback;
}

function uniqueSlug(db, name, id = null) {
  const base = slugify(name);
  let slug = base;
  let n = 1;
  while (true) {
    const row = db.prepare('SELECT id FROM schools WHERE slug=? LIMIT 1').get(slug);
    if (!row || Number(row.id) === Number(id)) return slug;
    slug = `${base}-${n++}`;
  }
}

function initSaaS(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      slug TEXT NOT NULL DEFAULT '',
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

  // Legacy databases need all fields added before any new-school insert runs.
  ensureColumn(db, 'schools', 'code', 'TEXT');
  ensureColumn(db, 'schools', 'slug', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'schools', 'logo_url', "TEXT DEFAULT ''");
  ensureColumn(db, 'schools', 'primary_color', "TEXT DEFAULT '#173b70'");
  ensureColumn(db, 'schools', 'secondary_color', "TEXT DEFAULT '#24579b'");
  ensureColumn(db, 'schools', 'phone', "TEXT DEFAULT ''");
  ensureColumn(db, 'schools', 'email', "TEXT DEFAULT ''");
  ensureColumn(db, 'schools', 'address', "TEXT DEFAULT ''");
  ensureColumn(db, 'schools', 'status', "TEXT DEFAULT 'active'");
  ensureColumn(db, 'schools', 'plan', "TEXT DEFAULT 'basic'");
  ensureColumn(db, 'schools', 'subscription_status', "TEXT DEFAULT 'trial'");
  ensureColumn(db, 'schools', 'subscription_start', 'TEXT');
  ensureColumn(db, 'schools', 'subscription_end', 'TEXT');
  ensureColumn(db, 'schools', 'max_students', 'INTEGER DEFAULT 500');
  ensureColumn(db, 'schools', 'notes', "TEXT DEFAULT ''");
  ensureColumn(db, 'schools', 'created_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');
  ensureColumn(db, 'schools', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');

  const missingCodes = db.prepare("SELECT id,name FROM schools WHERE code IS NULL OR TRIM(code)='' ORDER BY id").all();
  const used = new Set(db.prepare("SELECT code FROM schools WHERE code IS NOT NULL AND TRIM(code)<>''").all().map(x => String(x.code)));
  const setCode = db.prepare('UPDATE schools SET code=? WHERE id=?');
  for (const row of missingCodes) {
    const base = String(row.name || 'SCHOOL').replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 8).toUpperCase() || 'SCHOOL';
    let code = `${base}-${String(row.id).padStart(3, '0')}`;
    let n = 1;
    while (used.has(code)) code = `${base}-${String(row.id).padStart(3, '0')}-${n++}`;
    setCode.run(code, row.id);
    used.add(code);
  }

  const missingSlugs = db.prepare("SELECT id,name FROM schools WHERE slug IS NULL OR TRIM(slug)='' ORDER BY id").all();
  const setSlug = db.prepare('UPDATE schools SET slug=? WHERE id=?');
  for (const row of missingSlugs) setSlug.run(uniqueSlug(db, row.name, row.id), row.id);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_code_unique ON schools(code)');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_slug_unique ON schools(slug)');

  let school = db.prepare('SELECT id FROM schools ORDER BY id LIMIT 1').get();
  if (!school) {
    const r = db.prepare(`INSERT INTO schools
      (code,slug,name,logo_url,primary_color,secondary_color,plan,subscription_status,max_students)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(
        'BES-001', 'british-education-school', 'British Education School', '', '#173b70', '#24579b', 'enterprise', 'active', 5000
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
        const code=`${codeBase}-${Date.now().toString().slice(-5)}`;
        const crypto=require('crypto');
        const r=db.prepare(`INSERT INTO school_registrations(school_name,admin_name,email,phone,address,admin_username,admin_password_hash)
          VALUES(?,?,?,?,?,?,?)`).run(String(school_name).trim(),String(admin_name).trim(),String(email).trim(),String(phone).trim(),String(address).trim(),candidate,crypto.createHash('sha256').update(String(password)).digest('hex'));
        res.status(201).json({success:true,registration_id:Number(r.lastInsertRowid),username:candidate,school_code:code,message:'تم إرسال طلب المدرسة للمراجعة والاعتماد قبل تفعيل الحساب'});
      } catch(e){res.status(500).json({success:false,message:'تعذر إرسال طلب التسجيل'});}
    });

    app.get('/api/saas/registrations', guard, (req,res) => res.json({success:true,registrations:db.prepare('SELECT id,school_name,admin_name,email,phone,address,admin_username,status,created_at,reviewed_at FROM school_registrations ORDER BY id DESC').all()}));

    app.post('/api/saas/registrations/:id/approve', guard, (req,res) => {
      const id=Number(req.params.id), row=db.prepare('SELECT * FROM school_registrations WHERE id=?').get(id);
      if(!row) return res.status(404).json({success:false,message:'طلب التسجيل غير موجود'});
      if(row.status!=='pending') return res.status(400).json({success:false,message:'الطلب تمت مراجعته مسبقاً'});
      try {
        const codeBase=String(row.school_name).replace(/[^\p{L}\p{N}]+/gu,'').slice(0,8).toUpperCase()||'SCHOOL';
        let code=`${codeBase}-${Date.now().toString().slice(-5)}`;
        while(db.prepare('SELECT id FROM schools WHERE code=?').get(code)) code=`${codeBase}-${Math.floor(Math.random()*90000+10000)}`;
        const schoolSlug=uniqueSlug(db,row.school_name);
        const school=db.prepare(`INSERT INTO schools(code,slug,name,logo_url,primary_color,secondary_color,phone,email,address,status,plan,subscription_status,max_students)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(code,schoolSlug,row.school_name,'','#173b70','#24579b',row.phone,row.email,row.address,'active','basic','trial',500);
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
        (SELECT COUNT(*) FROM students st WHERE st.school_id=s.id) student_count FROM schools s ORDER BY s.id DESC`).all();
      res.json({success:true,schools});
    });

    app.post('/api/saas/schools', guard, (req,res) => {
      try {
        const {name,code,plan='basic',max_students=500,primary_color='#173b70',secondary_color='#24579b',logo_url='',phone='',email='',address=''} = req.body;
        if(!name) return res.status(400).json({success:false,message:'اسم المدرسة مطلوب'});
        let schoolCode=String(code||'').trim() || `${String(name).replace(/[^\p{L}\p{N}]+/gu,'').slice(0,8).toUpperCase()||'SCHOOL'}-${Date.now().toString().slice(-5)}`;
        const slug=uniqueSlug(db,name);
        const r=db.prepare(`INSERT INTO schools(code,slug,name,logo_url,primary_color,secondary_color,phone,email,address,plan,max_students)
          VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(schoolCode,slug,String(name).trim(),logo_url,primary_color,secondary_color,phone,email,address,plan,max_students);
        res.status(201).json({success:true,school_id:Number(r.lastInsertRowid),code:schoolCode,slug});
      } catch(e){res.status(400).json({success:false,message:'تعذر إنشاء المدرسة'});}
    });

    app.get('/api/public/schools', (req,res) => {
      try {
        const schools = db.prepare("SELECT id,code,slug,name,logo_url,primary_color,secondary_color,status,plan FROM schools WHERE status='active' ORDER BY name").all();
        res.json({success:true,schools});
      } catch(e) { res.status(500).json({success:false,message:'تعذر تحميل المدارس'}); }
    });

    return app;
  }

  if (loaded.__saasWrapped) return loaded;
  const wrapped = wrappedExpress;
  wrapped.__saasWrapped = true;
  return wrapped;
};