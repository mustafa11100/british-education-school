const Module=require('module');
const Database=require('better-sqlite3');
const path=require('path');
const originalLoad=Module._load;
const db=new Database(path.join(__dirname,'school.db'));
db.pragma('journal_mode=WAL');
db.pragma('foreign_keys=ON');

function columns(table){return db.prepare(`PRAGMA table_info(${table})`).all();}
function hasColumn(table,column){return columns(table).some(x=>x.name===column);}
function ensureColumn(table,column,definition){if(!hasColumn(table,column))db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);}
function migrateSchools(){
  db.exec(`CREATE TABLE IF NOT EXISTS schools(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,description TEXT,logo TEXT,active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
  for(const [c,d] of [['code','TEXT'],['slug','TEXT'],['description','TEXT'],['logo','TEXT'],['logo_url',"TEXT DEFAULT ''"],['primary_color',"TEXT DEFAULT '#173b70'"],['secondary_color',"TEXT DEFAULT '#24579b'"],['phone',"TEXT DEFAULT ''"],['email',"TEXT DEFAULT ''"],['address',"TEXT DEFAULT ''"],['status',"TEXT DEFAULT 'active'"],['plan',"TEXT DEFAULT 'basic'"],['subscription_status',"TEXT DEFAULT 'trial'"],['subscription_start','TEXT'],['subscription_end','TEXT'],['max_students','INTEGER DEFAULT 500'],['notes',"TEXT DEFAULT ''"],['active','INTEGER DEFAULT 1'],['created_at','TEXT DEFAULT CURRENT_TIMESTAMP'],['updated_at','TEXT DEFAULT CURRENT_TIMESTAMP']])ensureColumn('schools',c,d);
  if(hasColumn('schools','code')){const used=new Set(db.prepare("SELECT code FROM schools WHERE code IS NOT NULL AND TRIM(code)<>''").all().map(x=>String(x.code)));const missing=db.prepare("SELECT id,name FROM schools WHERE code IS NULL OR TRIM(code)='' ORDER BY id").all();const set=db.prepare('UPDATE schools SET code=? WHERE id=?');for(const row of missing){const base=(String(row.name||'SCHOOL').replace(/[^\\p{L}\\p{N}]+/gu,'').slice(0,8).toUpperCase()||'SCHOOL');let code=`${base}-${String(row.id).padStart(3,'0')}`,n=1;while(used.has(code))code=`${base}-${String(row.id).padStart(3,'0')}-${n++}`;set.run(code,row.id);used.add(code);}}
}
try{migrateSchools();}catch(e){console.error('OWNER_RUNTIME_SCHEMA:',e.stack||e);}

function isOwner(req){return ['مبرمج','مبرمج النظام','مالك المنصة','owner'].includes(req.user?.role)||['مبرمج','مبرمج النظام','مالك المنصة','owner'].includes(req.enhancedUser?.role);}
function valueForColumn(column,name,body){
  const b=body||{};
  if(column==='name')return name;
  if(column==='code'){const base=(name.replace(/[^\\p{L}\\p{N}]+/gu,'').slice(0,8).toUpperCase()||'SCHOOL');let code=`${base}-${Date.now().toString().slice(-8)}`,n=1;while(db.prepare('SELECT 1 FROM schools WHERE code=?').get(code))code=`${base}-${Date.now().toString().slice(-8)}-${n++}`;return code;}
  const known={description:b.description||'',logo:b.logo||'',logo_url:b.logo_url||b.logo||'',slug:b.slug||name.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),primary_color:b.primary_color||'#173b70',secondary_color:b.secondary_color||'#24579b',phone:b.phone||'',email:b.email||'',address:b.address||'',status:b.status||'active',plan:b.plan||'basic',subscription_status:b.subscription_status||'trial',subscription_start:b.subscription_start||null,subscription_end:b.subscription_end||null,max_students:Number(b.max_students||500),notes:b.notes||'',active:b.active===undefined?1:Number(b.active),updated_at:new Date().toISOString()};
  if(Object.prototype.hasOwnProperty.call(known,column))return known[column];
  if(column.endsWith('_id'))return b[column]??null;
  return '';
}
function install(app){
  if(app.__ownerRuntimeFixInstalled)return;app.__ownerRuntimeFixInstalled=true;
  const originalUse=app.use.bind(app),originalGet=app.get.bind(app),originalPost=app.post.bind(app);let installed=false;
  const installRoutes=()=>{if(installed)return;installed=true;
    originalGet('/api/owner/full-overview',(req,res)=>{if(!isOwner(req))return res.status(403).json({success:false,message:'هذه المنطقة مخصصة لمالك المنصة'});try{const count=t=>db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;const pending=hasColumn('admin_requests','status')?db.prepare("SELECT COUNT(*) AS c FROM admin_requests WHERE status IN ('new','review','pending')").get().c:0;res.json({success:true,counts:{schools:count('schools'),users:count('users'),students:count('students'),teachers:db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='معلم'").get().c,parents:count('parents'),employees:count('employees'),classes:count('classes'),subjects:count('subjects'),attendance:count('attendance'),results:count('results'),announcements:count('announcements'),subscriptions:count('subscriptions'),pendingRequests:pending},recent:{schools:db.prepare('SELECT * FROM schools ORDER BY id DESC LIMIT 5').all(),activity:hasColumn('audit_logs','id')?db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 10').all():[]}});}catch(e){console.error('OWNER_FULL_OVERVIEW:',e.stack||e);res.status(500).json({success:false,message:'حدث خطأ داخلي في الخادم',error:String(e.message||e)});}});
    originalGet('/api/owner/schools',(req,res)=>{if(!isOwner(req))return res.status(403).json({success:false,message:'هذه المنطقة مخصصة لمالك المنصة'});try{res.json({success:true,schools:db.prepare('SELECT * FROM schools ORDER BY id DESC').all()});}catch(e){console.error('OWNER_SCHOOLS_GET:',e.stack||e);res.status(500).json({success:false,message:'حدث خطأ داخلي في الخادم',error:String(e.message||e)});}});
    originalPost('/api/owner/schools',(req,res)=>{if(!isOwner(req))return res.status(403).json({success:false,message:'هذه المنطقة مخصصة لمالك المنصة'});try{const b=req.body||{},name=String(b.name||'').trim();if(!name)return res.status(400).json({success:false,message:'اسم المدرسة مطلوب'});const info=columns('schools');const insertable=info.filter(c=>c.name!=='id'&&!c.pk&&!String(c.type||'').toUpperCase().includes('GENERATED')&&c.name!=='created_at');const insertCols=[],params=[];for(const c of insertable){if(c.notnull && c.dflt_value===null){insertCols.push(c.name);params.push(valueForColumn(c.name,name,b));}else if(Object.prototype.hasOwnProperty.call(b,c.name)){insertCols.push(c.name);params.push(b[c.name]);}}
      if(!insertCols.includes('name')){insertCols.unshift('name');params.unshift(name);}const placeholders=insertCols.map(()=>'?').join(',');const result=db.prepare(`INSERT INTO schools(${insertCols.join(',')}) VALUES(${placeholders})`).run(...params);if(hasColumn('schools','updated_at'))db.prepare('UPDATE schools SET updated_at=CURRENT_TIMESTAMP WHERE id=?').run(result.lastInsertRowid);if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='audit_logs'").get()&&req.user?.id){try{db.prepare('INSERT INTO audit_logs(user_id,action,details) VALUES(?,?,?)').run(req.user.id,'create_school',`school_id=${result.lastInsertRowid}`);}catch(_){} }res.status(201).json({success:true,id:Number(result.lastInsertRowid),school:db.prepare('SELECT * FROM schools WHERE id=?').get(result.lastInsertRowid)});
    }catch(e){console.error('OWNER_SCHOOLS_POST:',e.stack||e);res.status(500).json({success:false,message:'تعذر إضافة المدرسة',error:String(e.message||e)});}});
  };
  app.use=function(pathOrMiddleware,...handlers){const result=originalUse(pathOrMiddleware,...handlers);if(pathOrMiddleware==='/api/owner')installRoutes();return result;};
}
Module._load=function(request,...args){const loaded=originalLoad.call(this,request,...args);if(request!=='express')return loaded;const wrapped=function(...args2){const app=loaded(...args2);install(app);return app;};Object.setPrototypeOf(wrapped,loaded);wrapped.prototype=loaded.prototype;for(const key of Object.keys(loaded))wrapped[key]=loaded[key];return wrapped;};
