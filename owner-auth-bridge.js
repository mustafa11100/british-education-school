const Module = require('module');
const previousLoad = Module._load;

Module._load = function (request, parent, isMain) {
  const loaded = previousLoad.apply(this, arguments);
  if (request !== 'express') return loaded;

  const wrapped = function () {
    const app = loaded();

    const cookieAuth = (req, res, next) => {
      try {
        if (!req.headers.authorization) {
          const raw = String(req.headers.cookie || '');
          const match = raw.match(/(?:^|;\\s*)educore_token=([^;]+)/);
          if (match) {
            req.headers.authorization = `Bearer ${decodeURIComponent(match[1])}`;
          }
        }
      } catch (_) {}
      next();
    };

    const originalMethods = {
      get: app.get.bind(app),
      post: app.post.bind(app),
      put: app.put.bind(app),
      patch: app.patch.bind(app),
      delete: app.delete.bind(app)
    };

    for (const [name, original] of Object.entries(originalMethods)) {
      app[name] = function (...args) {
        if (
          name === 'post' &&
          args[0] === '/api/auth/login' &&
          typeof args[1] === 'function'
        ) {
          const handler = args[1];
          args[1] = function (req, res, next) {
            const oldJson = res.json.bind(res);
            res.json = function (body) {
              try {
                if (body && body.success && body.token) {
                  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
                  res.setHeader(
                    'Set-Cookie',
                    `educore_token=${encodeURIComponent(body.token)}; Path=/; HttpOnly; SameSite=Lax${secure}`
                  );
                }
              } catch (_) {}
              return oldJson(body);
            };
            return handler(req, res, next);
          };
        }
        return original(...args);
      };
    }

    const originalUse = app.use.bind(app);
    app.use = function (...args) {
      const pathArg = args[0];

      if (pathArg === '/api/owner' || pathArg === '/api') {
        const handlers = args.slice(1);
        return originalUse(pathArg, cookieAuth, ...handlers);
      }

      return originalUse(...args);
    };

    return app;
  };

  Object.setPrototypeOf(wrapped, loaded);
  wrapped.prototype = loaded.prototype;
  for (const key of Object.keys(loaded)) wrapped[key] = loaded[key];

  return wrapped;
};
