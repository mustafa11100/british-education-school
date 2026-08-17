const express=require("express");
const path=require("path");
const Database=require("better-sqlite3");
app.use(express.json()); app.use(express.static(__dirname));

db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE,password TEXT,role TEXT,name TEXT);
CREATE TABLE IF NOT EXISTS students(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,class_name TEXT,parent_phone TEXT,status TEXT DEFAULT 'حاضر');
CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER,text TEXT,created_at TEXT);
CREATE TABLE IF NOT EXISTS videos(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT,file_name TEXT,created_at TEXT);
`);
const count=db.prepare("SELECT COUNT(*) c FROM users").get().c;
if(!count){
 const add=db.prepare("INSERT INTO users(username,password,role,name) VALUES(?,?,?,?)");
 add.run("admin","1234","admin","مدير المدرسة");
 add.run("teacher","1234","teacher","الأستاذ أحمد");
 add.run("parent","1234","parent","ولي أمر محمد أحمد");
 add.run("student","1234","student","محمد أحمد");
}
if(db.prepare("SELECT COUNT(*) c FROM students").get().c===0){
 db.prepare("INSERT INTO students(name,class_name,parent_phone,status) VALUES(?,?,?,?)")
 .run("محمد أحمد","الصف السادس","201000000000","حاضر");
}
app.post("/api/login",(req,res)=>{
 const {username,password}=req.body||{};
 const u=db.prepare("SELECT id,username,role,name FROM users WHERE username=? AND password=?").get(username,password);
 if(!u)return res.status(401).json({error:"بيانات الدخول غير صحيحة"});
 res.json(u);
});
app.get("/api/students",(req,res)=>res.json(db.prepare("SELECT * FROM students ORDER BY id DESC").all()));
app.post("/api/students",(req,res)=>{
 const {name,class_name,parent_phone}=req.body||{};
 if(!name||!class_name||!parent_phone)return res.status(400).json({error:"أكمل بيانات الطالب"});
 const r=db.prepare("INSERT INTO students(name,class_name,parent_phone) VALUES(?,?,?)").run(name,class_name,parent_phone);
 res.json({id:r.lastInsertRowid});
});
app.patch("/api/students/:id/status",(req,res)=>{
 const s=db.prepare("SELECT status FROM students WHERE id=?").get(req.params.id);
 if(!s)return res.sendStatus(404);
 const status=s.status==="حاضر"?"غائب":"حاضر";
 db.prepare("UPDATE students SET status=? WHERE id=?").run(status,req.params.id);
 res.json({status});
});
app.post("/api/notes",(req,res)=>{
 const {student_id,text}=req.body||{};
 if(!student_id||!text)return res.status(400).json({error:"أدخل الملاحظة"});
 const now=new Date().toLocaleString("ar-EG");
 const r=db.prepare("INSERT INTO notes(student_id,text,created_at) VALUES(?,?,?)").run(student_id,text,now);
 // WhatsApp integration point: connect an official WhatsApp Business API provider here.
 res.json({id:r.lastInsertRowid,whatsapp_status:"pending_api_connection"});
});
app.get("/api/notes/:studentId",(req,res)=>res.json(db.prepare("SELECT n.*,s.name student_name FROM notes n JOIN students s ON s.id=n.student_id WHERE student_id=? ORDER BY n.id DESC").all(req.params.studentId)));
app.post("/api/videos",(req,res)=>{
 const {title,file_name}=req.body||{};
 if(!title)return res.status(400).json({error:"اكتب اسم الحصة"});
 const now=new Date().toLocaleString("ar-EG");
 const r=db.prepare("INSERT INTO videos(title,file_name,created_at) VALUES(?,?,?)").run(title,file_name||"",now);
 res.json({id:r.lastInsertRowid});
});
app.get("/api/videos",(req,res)=>res.json(db.prepare("SELECT * FROM videos ORDER BY id DESC").all()));
app.listen(process.env.PORT||3000,()=>console.log("School portal running on port "+(process.env.PORT||3000)));
