const Module = require('module');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const previousLoad = Module._load;
const tokens = new Map();
const db = new Database(path.join(__dirname,'school.db'));
function hash(p){return crypto.createHash('sha256').update(String(p)).digest('hex');}
Module._load = function(request,parent,isMain){
  const loaded = previousLoad.apply(this,arguments);
  if(request!=='express') return loaded;
  function wrapped(){
    const app = loaded();
    const originalPost = app.post.bind(app);
    app.post = function(route,...handlers){
      if(route==='/api/auth/login'){
        const last=handlers[handlers.length-1];
        handlers[handlers.length-1]=function(req,res,next){const old=res.json.bind(res);res.json=(body)=>{if(body?.success&&body.token&&body.user)tokens.set(body.token,body.user);return old(body);};return last(req,res,next);};
      }
      if(route==='/api/users'){
        return originalPost(route, (req,res)=>{
          const token=(req.headers.authorization||'').replace(/^Bearer\s+/,''); const u=tokens.get(token);
          if(!u) return res.status(401).json({success:false,message:'يجب تسجيل الدخول'});
          if(!['مبرمج','مبرمج النظام','مدير'].includes(u.role)) return res.status(403).json({success:false,message:'ليست لديك صلاحية إدارة المستخدمين'});
          try{
            const {username,password,full_name,email,phone,role}=req.body;
            if(!username||!password||!full_name||!role) return res.status(400).json({success:false,message:'البيانات الأساسية مطلوبة'});
            const r=db.prepare('SELECT id FROM roles WHERE name=? AND active=1').get(role);
            if(!r) return res.status(400).json({success:false,message:'الوظيفة غير موجودة'});
            if(u.role==='مدير' && role==='مبرمج النظام') return res.status(403).json({success:false,message:'لا يمكن للمدير إنشاء مبرمج نظام'});
            const exists=db.prepare('SELECT id FROM users WHERE username=?').get(username.trim());
            if(exists) return res.status(400).json({success:false,message:'اسم المستخدم موجود بالفعل'});
            const x=db.prepare('INSERT INTO users(username,password_hash,full_name,email,phone,role,must_change_password) VALUES(?,?,?,?,?,?,1)').run(username.trim(),hash(password),full_name.trim(),email||'',phone||'',role);
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
