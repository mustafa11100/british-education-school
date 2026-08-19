// Express compatibility bridge.
// Keep the native Express API intact; legacy modules must not replace the
// Express factory or its middleware helpers.
const Module = require('module');
const originalLoad = Module._load;

Module._load = function(request, parent, isMain) {
  return originalLoad.apply(this, arguments);
};
