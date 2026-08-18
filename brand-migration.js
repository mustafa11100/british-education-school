const path=require('path');
const Database=require('better-sqlite3');
const db=new Database(path.join(__dirname,'school.db'));
try{
  db.pragma('journal_mode = WAL');
  db.prepare("UPDATE schools SET name='EduCore Platform' WHERE name IN ('British Education School','مدرسة التعليم البريطاني')").run();
}catch(e){console.error('Brand migration error:',e.message)}
finally{db.close();}
