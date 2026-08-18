const fs = require('fs');
const path = require('path');

let boot = fs.readFileSync(path.join(__dirname, 'bootstrap.js'), 'utf8');

// Keep legacy backend role checks working while exposing the new job titles.
boot = boot.replace("ADMIN:'مدير المدرسة'", "ADMIN:'مدير', SCHOOL_ADMIN:'مدير المدرسة'");
boot = boot.replace("OPERATIONS:'مسؤول العمليات'", "OPERATIONS:'عمليات', SCHOOL_OPERATIONS:'مسؤول العمليات'");

// The bootstrap file is itself a template string. Convert the few dynamic
// notification messages to normal string concatenation before evaluating it.
boot = boot.replace("`تمت إضافة رسوم ${description} بقيمة ${Number(amount||0)}`", "'تمت إضافة رسوم '+description+' بقيمة '+Number(amount||0)");
boot = boot.replace("`تم تسجيل نتيجة جديدة في ${assessment||'اختبار'}`", "'تم تسجيل نتيجة جديدة في '+(assessment||'اختبار')");
boot = boot.replace("`تم تسجيل حالة ${status} بتاريخ ${attendance_date}`", "'تم تسجيل حالة '+status+' بتاريخ '+attendance_date");

const marker = "require('./.server-runtime.js');";
const inject = `
const staticMarker='/* =========================================================\\n   STATIC FILES\\n========================================================= */';
code=code.replace(staticMarker, \`app.get('/index.html',(req,res)=>{let h=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');h=h.replace('</body>','<script src="/portal.js"></script></body>');res.type('html').send(h);});\\n\`+staticMarker);
`;
const patched = boot.replace(marker, inject + marker);
const runtime = path.join(__dirname, '.bootstrap-runtime.js');
fs.writeFileSync(runtime, patched, 'utf8');
require(runtime);
