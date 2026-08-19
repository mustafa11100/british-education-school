// Express compatibility bridge for the platform's legacy Module._load wrappers.
// It guarantees the core Express middleware helpers remain available after wrappers.
const Module = require('module');
const bodyParser = require('body-parser');
const originalLoad = Module._load;

function ensureExpressApi(expressFactory) {
  if (!expressFactory || typeof expressFactory !== 'function') return expressFactory;
  if (typeof expressFactory.json !== 'function') expressFactory.json = bodyParser.json;
  if (typeof expressFactory.urlencoded !== 'function') expressFactory.urlencoded = bodyParser.urlencoded;
  return expressFactory;
}

Module._load = function(request, parent, isMain) {
  const loaded = originalLoad.apply(this, arguments);
  if (request === 'express') return ensureExpressApi(loaded);
  return loaded;
};
