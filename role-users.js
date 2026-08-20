const Module = require('module');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const previousLoad = Module._load;
const tokens = new Map();
const db = new Database(path.join(__dirname,'school.db'));

function hash(p){return crypto.createHash('sha256').update(String(p)).digest('hex');}

// Gibbon-style access: role/permission controls access, not a single owner-only page.
const managementRoles = new Set([
  'مبرمج','مبرمج النظام','مالك المنصة','owner',
  'مدير','مدير المدرسة','نائب مدير المدرسة',
  'المدير الأكاديمي','المدير الإداري'
]);
const platformRoles = new Set(['مبرمج','مبرمج النظام','مالك المنصة','owner']);

Module._load = function(request,parent,isMain){
  const loaded = previousLoad.apply(this,arguments);
  if(request!=='express') return loaded;
  function wrapped(){
    const app = loaded();
    const originalGet = app.get.bind(app);
    const originalPost = app.post.bind(app);

    app.get = function(route,...handlers){
      if(route==='/api/users'){
        return originalGet(route,(req,res)=>{
          const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
          const u=tokens.get(token);
          if(!u) return res.status(401).json({success:false,message:'يجب تسجيل الدخول'});
          if(!managementRoles.has(u.role)) return res.status(403).json({success:false,message:'ليست لديك صلاحية عرض المستخدمين'});
          try{
            const users=(!platformRoles.has(u.role)&&u.school_id)
              ? db.prepare('SELECT id,username,full_name,full_name AS name,email,phone,role,active,must_change_password,school_id,created_at FROM users WHERE school_id=? ORDER BY id DESC').all(u.school_id)
              : db.prepare('SELECT id,username,full_name,full_name AS name,email,phone,role,active,must_change_password,school_id,created_at FROM users ORDER BY id DESC').all();
            return res.json({success:true,users});
          }catch(e){console.error('role-users GET /api/users',e);return res.status(500).json({success:false,message:'تعذر تحميل المستخدمين'});}
        });
      }
      return originalGet(route,...handlers);
    };

    app.post = function(route,...handlers){
      if(route==='/api/auth/login'){
        const last=handlers[handlers.length-1];
        handlers[handlers.length-1]=function(req,res,next){
          const old=res.json.bind(res);
          res.json=(body)=>{if(body?.success&&body.token&&body.user)tokens.set(body.token,body.user);return old(body);};
          return last(req,res,next);
        };
      }
      if(route==='/api/users'){
        return originalPost(route,(req,res)=>{
          const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
          const u=tokens.get(token);
          if(!u) return res.status(401).json({success:false,message:'يجب تسجيل الدخول'});
          if(!managementRoles.has(u.role)) return res.status(403).json({success:false,message:'ليست لديك صلاحية إدارة المستخدمين'});
          try{
            const {username,password,full_name,email,phone,role,school_id}=req.body||{};
            if(!username||!password||!full_name||!role) return res.status(400).json({success:false,message:'البيانات الأساسية مطلوبة'});
            const r=db.prepare('SELECT id FROM roles WHERE name=? AND active=1').get(role);
            if(!r) return res.status(400).json({success:false,message:'الوظيفة غير موجودة'});
            if(['مدير','مدير المدرسة','نائب مدير المدرسة'].includes(u.role)&&platformRoles.has(role)) return res.status(403).json({success:false,message:'لا يمكن لمدير المدرسة إنشاء حساب مالك أو مبرمج نظام'});
            const exists=db.prepare('SELECT id FROM users WHERE username=?').get(String(username).trim());
            if(exists) return res.status(400).json({success:false,message:'اسم المستخدم موجود بالفعل'});
            const targetSchool=platformRoles.has(u.role)?(school_id||null):(u.school_id||null);
            const x=db.prepare('INSERT INTO users(username,password_hash,full_name,email,phone,role,school_id,must_change_password) VALUES(?,?,?,?,?,?,?,1)').run(String(username).trim(),hash(password),String(full_name).trim(),email||'',phone||'',role,targetSchool);
            res.json({success:true,message:'تم إنشاء المستخدم',user_id:x.lastInsertRowid});
          }catch(e){console.error(e);res.status(500).json({success:false,message:'تعذر إنشاء المستخدم'});}
        });
      }
      return originalPost(route,...handlers);
    };
    return app;
  }
  Object.assign(wrapped,loaded);
  return wrapped;
};