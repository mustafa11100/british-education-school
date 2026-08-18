const fs = require('fs');
const path = require('path');

const boot = fs.readFileSync(path.join(__dirname, 'bootstrap.js'), 'utf8');
const marker = "require('./.server-runtime.js');";
const inject = `
const staticMarker='/* =========================================================\\n   STATIC FILES\\n========================================================= */';
code=code.replace(staticMarker, \`app.get('/index.html',(req,res)=>{let h=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');h=h.replace('</body>','<script src="/portal.js"></script></body>');res.type('html').send(h);});\\n\`+staticMarker);
`;
const patched = boot.replace(marker, inject + marker);
const runtime = path.join(__dirname, '.bootstrap-runtime.js');
fs.writeFileSync(runtime, patched, 'utf8');
require(runtime);
