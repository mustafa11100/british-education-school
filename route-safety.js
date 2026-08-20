// Express route safety guard.
// Some legacy compatibility layers in this project can leave a malformed
// layer in an Express Route stack. Express then crashes at request time with
// "layer.handle_request is not a function". Filter only malformed layers and
// keep valid handlers untouched so one bad compatibility route cannot take
// down the whole backend.
try {
  const Route = require('express/lib/router/route');
  const originalDispatch = Route.prototype.dispatch;
  if (!Route.prototype.__educoreSafeDispatch) {
    Route.prototype.dispatch = function dispatch(req, res, done) {
      if (Array.isArray(this.stack)) {
        const before = this.stack.length;
        this.stack = this.stack.filter(layer => layer && typeof layer.handle_request === 'function');
        if (this.stack.length !== before) {
          console.error(`ROUTE SAFETY: removed ${before - this.stack.length} malformed route layer(s) from ${this.path || '<unknown>'}`);
        }
      }
      return originalDispatch.call(this, req, res, done);
    };
    Route.prototype.__educoreSafeDispatch = true;
  }
} catch (e) {
  console.error('ROUTE SAFETY INIT:', e.stack || e);
}
