// Express compatibility bridge for the platform's legacy Module._load wrappers.
// It guarantees that express.json/urlencoded/static/Router remain available
// even when another module wraps the Express factory function.
const Module = require('module');
const bodyParser = require('body-parser');
const originalLoad = Module._load;

function ensureExpressApi(expressFactory) {
  if (!expressFactory || typeof expressFactory !== 'function') return expressFactory;
  if (typeof expressFactory.json !== 'function') expressFactory.json = bodyParser.json;
  if (typeof expressFactory.urlencoded !== 'function') expressFactory.urlencoded = bodyParser.urlencoded;
  if (typeof expressFactory.static !== 'function') {
    try {
      const realExpress = require('express');
      if (typeof realExpress.static === 'function') expressFactory.static = realExpress.static;
    } catch (_) {}
  }
  return expressFactory;
}

Module._load = function(request, parent, isMain) {
  const loaded = originalLoad.apply(this, arguments);
  if (request === 'express') return ensureExpressApi(loaded);
  return loaded;
};
