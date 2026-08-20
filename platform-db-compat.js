const Database=require('better-sqlite3');
const originalPrepare=Database.prototype.prepare;
Database.prototype.prepare=function(sql){
  let query=String(sql);
  const m=query.match(/^SELECT \* FROM ([A-Za-z_][A-Za-z0-9_]*) ORDER BY id DESC LIMIT 1000$/);
  if(m){
    try{
      const table=m[1];
      const info=originalPrepare.call(this,`PRAGMA table_info(${table})`).all();
      const key=info.find(c=>c.pk)?.name;
      query=key?`SELECT * FROM ${table} ORDER BY ${key} DESC LIMIT 1000`:`SELECT * FROM ${table} LIMIT 1000`;
    }catch(e){console.error('PLATFORM_DB_COMPAT',e.message)}
  }
  return originalPrepare.call(this,query);
};
