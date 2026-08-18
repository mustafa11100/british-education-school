const Module = require('module');
const originalLoad = Module._load;

Module._load = function(request, parent, isMain) {
  const loaded = originalLoad.apply(this, arguments);
  if (request !== 'express') return loaded;

  function wrappedExpress() {
    const app = loaded();
    const buckets = new Map();
    const WINDOW_MS = 15 * 60 * 1000;
    const MAX_AUTH_ATTEMPTS = 20;

    app.disable('x-powered-by');
    app.set('trust proxy', 1);

    app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      next();
    });

    app.use((req, res, next) => {
      if (!/^\/api\/auth\/(login|register)$/.test(req.path)) return next();
      const key = `${req.ip}:${req.path}`;
      const now = Date.now();
      const old = buckets.get(key) || [];
      const fresh = old.filter(t => now - t < WINDOW_MS);
      if (fresh.length >= MAX_AUTH_ATTEMPTS) {
        res.setHeader('Retry-After', '900');
        return res.status(429).json({success:false,message:'تم تجاوز عدد المحاولات. حاول مرة أخرى لاحقاً'});
      }
      fresh.push(now);
      buckets.set(key, fresh);
      next();
    });

    setInterval(() => {
      const now = Date.now();
      for (const [key, times] of buckets) {
        const fresh = times.filter(t => now - t < WINDOW_MS);
        if (fresh.length) buckets.set(key, fresh); else buckets.delete(key);
      }
    }, WINDOW_MS).unref();

    return app;
  }
  return wrappedExpress;
};
