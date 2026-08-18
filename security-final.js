const crypto=require('crypto');
const Module=require('module');
const originalLoad=Module._load;
const buckets=new Map();
const WINDOW=60_000, LIMIT=120;
function clientKey(req){return String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim()}
Module._load=function(request,parent,isMain){const loaded=originalLoad.apply(this,arguments);if(request!=='express')return loaded;function wrappedExpress(){const app=loaded();
app.disable('x-powered-by');
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');if(process.env.NODE_ENV==='production')res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');next()});
app.use('/api/',(req,res,next)=>{const key=clientKey(req);const now=Date.now();let b=buckets.get(key);if(!b||now-b.start>=WINDOW)b={start:now,count:0};b.count++;buckets.set(key,b);if(b.count>LIMIT)return res.status(429).json({success:false,message:'عدد الطلبات مرتفع جداً، حاول بعد قليل'});next()});
app.use('/api/auth/',(req,res,next)=>{if(req.method!=='POST')return next();const key='auth:'+clientKey(req);const now=Date.now();let b=buckets.get(key);if(!b||now-b.start>=WINDOW)b={start:now,count:0};b.count++;buckets.set(key,b);if(b.count>20)return res.status(429).json({success:false,message:'محاولات المصادقة كثيرة، حاول بعد دقيقة'});next()});
app.use((req,res,next)=>{const started=Date.now();res.on('finish',()=>{if(!req.url.startsWith('/api/'))return;try{const db=global.__educoreDB;if(!db)return;const token=String(req.headers.authorization||'').replace(/^Bearer\s+/,'');let uid=null;const s=global.__educoreSessions?.get(token);if(s)uid=s.userId;db.prepare('INSERT INTO audit_logs(user_id,action,details) VALUES(?,?,?)').run(uid,req.method+' '+req.path,JSON.stringify({status:res.statusCode,ms:Date.now()-started,ip:clientKey(req)}))}catch{}});next()});
return app}return wrappedExpress};
};
