// EduCore session persistence is now implemented directly in server.js.
// Keep this preload module as a compatibility shim because the deployment
// command still loads it through NODE_OPTIONS.
const Module = require('module');
const original = Module._extensions['.js'];
Module._extensions['.js'] = function(module, filename) {
  return original(module, filename);
};
