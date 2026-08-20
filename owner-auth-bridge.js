const Module=require('module');
const previous=Module._load;
Module._load=function(request,parent,isMain){
  const loaded=previous.apply(this,arguments);
  if(request!=='express') return loaded;
  const wrapped=function(){
    const app=loaded();
    const originalUse=app.use.bind(app);
    const originalMethods={get:app.get.bind(app),post:app.post.bind(app),put:app.put.bind(app),patch:app.patch.bind(app),delete:app.delete.bind(app)};
    let captured=false;
    for(const [name,original] of Object.entries(originalMethods)){
      app[name]=function(...args){
        if(!captured){
          const auth=args.find(x=>typeof x==='function'&&x.name==='auth');
          if(auth){
            captured=true;
            try{
              // The owner dashboard APIs are protected by the same authentication
              // middleware as the rest of the application. Mounting the captured
              // middleware on /api/owner fixes the mismatch where the dashboard was
              // logged in but its nested school APIs saw an unauthenticated request.
              originalUse('/api/owner',auth);
              originalUse('/__auth_capture__',auth);
            }catch(_){ }
          }
        }
        return original(...args);
      };
    }
    return app;
  };
  Object.setPrototypeOf(wrapped,loaded);
  wrapped.prototype=loaded.prototype;
  for(const k of Object.keys(loaded)) wrapped[k]=loaded[k];
  return wrapped;
};
