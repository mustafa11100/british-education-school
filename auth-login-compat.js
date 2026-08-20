const Module = require('module');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const previousLoad = Module._load;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

Module._load = function (request, parent, isMain) {
  const loaded = previousLoad.apply(this, arguments);
  if (request !== 'express') return loaded;

  const wrapped = function () {
    const app = loaded();
    const originalPost = app.post.bind(app);
    app.post = function (...args) {
      if (args[0] === '/api/auth/login' && typeof args[1] === 'function') {
        const originalHandler = args[1];
        args[1] = function (req, res, next) {
          try {
            const body = req.body || {};
            const username = String(body.username || '').trim();
            const password = String(body.password || '');
            if (username && password) {
              const db = new Database(path.join(__dirname, 'school.db'));
              try {
                const user = db.prepare('SELECT id,username,password_hash FROM users WHERE username=? OR lower(username)=lower(?)').get(username, username);
                if (user) {
                  if (user.username !== username) req.body.username = user.username;
                  const expected = sha256(password);
                  // Migrate legacy plaintext passwords to the current SHA-256 format.
                  if (String(user.password_hash) === password && String(user.password_hash) !== expected) {
                    db.prepare('UPDATE users SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(expected, user.id);
                  }
                  // Normalize legacy uppercase SHA-256 hashes without changing the user's password.
                  if (String(user.password_hash).toLowerCase() === expected && String(user.password_hash) !== expected) {
                    db.prepare('UPDATE users SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(expected, user.id);
                  }
                }
              } finally {
                db.close();
              }
            }
          } catch (e) {
            console.warn('AUTH COMPAT:', e.message);
          }
          return originalHandler(req, res, next);
        };
      }
      return originalPost(...args);
    };
    return app;
  };

  Object.setPrototypeOf(wrapped, loaded);
  wrapped.prototype = loaded.prototype;
  for (const key of Object.keys(loaded)) wrapped[key] = loaded[key];
  return wrapped;
};
