const Module=require('module');
const Database=require('better-sqlite3');
const path=require('path');
const previous=Module._load;
const db=new Database(path.join(__dirname,'school.db'));
db.pragma('journal_mode=WAL'); db.pragma('foreign_keys=ON');
function hasColumn(table,col){return db.prepare(`PRAGMA table_info(${table})`).all().some(x=>x.name===col)}
function addColumn(table,col,def){if(!hasColumn(table,col))db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`)}
try{
  db.exec(`CREATE TABLE IF NOT EXISTS schools(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,description TEXT,logo TEXT,active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
  addColumn('schools','description','TEXT'); addColumn('schools','logo','TEXT'); addColumn('schools','active','INTEGER DEFAULT 1'); addColumn('schools','created_at','TEXT DEFAULT CURRENT_TIMESTAMP');
  db.exec(`CREATE TABLE IF NOT EXISTS attendance(id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,date TEXT NOT NULL,status TEXT NOT NULL,check_in TEXT,check_out TEXT,notes TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);CREATE TABLE IF NOT EXISTS results(id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,subject TEXT NOT NULL,term TEXT,score REAL,max_score REAL DEFAULT 100,notes TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
}catch(e){console.error('OWNER API MIGRATION',e)}
function owner(req,res){return ['مبرمج','مبرمج النظام','مالك المنصة','owner'].includes(req.user?.role)}
function sendError(res,e){console.error('OWNER API REPAIR',e);return res.status(500).json({success:false,message:'تعذر تنفيذ العملية داخل الخادم',error:e.message})}
function count(t){try{return db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c}catch{return 0}}
function reorder(app,paths){const stack=app._router&&app._router.stack;if(!stack)return;for(const p of paths){const i=stack.findIndex(l=>l.route&&l.route.path===p);if(i<0)continue;const layer=stack.splice(i,1)[0];const target=stack.findIndex(l=>l.route&&l.route.path===p&&l!==layer);const fallback=stack.findIndex(l=>!l.route&&l.name==='');const pos=target>=0?target:(fallback>=0?fallback:stack.length);stack.splice(pos,0,layer)}}
Module._load=function(request,...args){const loaded=previous.call(this,request,...args);if(request!=='express')return loaded;
  const wrapped=function(...a){const app=loaded(...a);if(app.__ownerRepair)return app;app.__ownerRepair=true;
    const get=app.get.bind(app),post=app.post.bind(app);
    const schoolsGet=(req,res)=>{if(!owner(req,res))return res.status(403).json({success:false,message:'هذه المنطقة مخصصة لمالك المنصة'});try{return res.json({success:true,schools:db.prepare('SELECT * FROM schools ORDER BY id DESC').all()})}catch(e){return sendError(res,e)}};
    const schoolsPost=(req,res)=>{if(!owner(req,res))return res.status(403).json({success:false,message:'هذه المنطقة مخصصة لمالك المنصة'});try{const b=req.body||{},name=String(b.name||'').trim();if(!name)return res.status(400).json({success:false,message:'اسم المدرسة مطلوب'});const r=db.prepare('INSERT INTO schools(name,description,logo,active) VALUES(?,?,?,1)').run(name,String(b.description||''),String(b.logo||''));return res.status(201).json({success:true,id:r.lastInsertRowid,school:db.prepare('SELECT * FROM schools WHERE id=?').get(r.lastInsertRowid)})}catch(e){return sendError(res,e)}};
    app.get=function(path,...h){if(path==='/api/owner/schools')get(path,schoolsGet);return get(path,...h)};
    app.post=function(path,...h){if(path==='/api/owner/schools')post(path,schoolsPost);return post(path,...h)};
    setImmediate(()=>{
      if(!app.__ownerFullOverview){app.__ownerFullOverview=true;get('/api/owner/full-overview',(req,res)=>{if(!owner(req,res))return res.status(403).json({success:false,message:'هذه المنطقة مخصصة لمالك المنصة'});try{res.json({success:true,counts:{schools:count('schools'),users:count('users'),students:count('students'),teachers:db.prepare("SELECT COUNT(*) c FROM users WHERE role='معلم'").get().c,parents:count('parents'),employees:count('employees'),classes:count('classes'),subjects:count('subjects'),attendance:count('attendance'),results:count('results'),announcements:count('announcements'),subscriptions:count('subscriptions'),pendingRequests:db.prepare("SELECT COUNT(*) c FROM admin_requests WHERE status IN ('new','review')").get().c},recent:{schools:db.prepare('SELECT * FROM schools ORDER BY id DESC LIMIT 5').all(),activity:db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 10').all()}})}catch(e){sendError(res,e)}});}
      reorder(app,['/api/owner/full-overview','/api/owner/schools']);
    });
    return app;
  };
  Object.setPrototypeOf(wrapped,loaded);wrapped.prototype=loaded.prototype;for(const k of Object.keys(loaded))wrapped[k]=loaded[k];return wrapped;
};
