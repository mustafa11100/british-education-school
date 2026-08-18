const http=require('http');
const port=Number(process.env.PORT||8080);
const req=http.get({host:'127.0.0.1',port,path:'/health',timeout:3000},res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>{if(res.statusCode!==200){console.error('EduCore health check failed:',res.statusCode,b);process.exit(1)}console.log('EduCore Platform health: OK');});});
req.on('timeout',()=>req.destroy(new Error('timeout')));req.on('error',e=>{console.error('EduCore health check failed:',e.message);process.exit(1)});
