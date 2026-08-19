const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

// Ensure the platform owner exists before server.js registers its login routes.
// Use normal Railway variable names. Do not use a variable name containing a dot.
const username = String(process.env.OWNER_USERNAME || 'mustafa.adel').trim();
const password = String(process.env.OWNER_PASSWORD || '');

if (!password) {
  console.warn('OWNER BOOTSTRAP: OWNER_PASSWORD is not set; owner bootstrap skipped.');
} else {
  const db = new Database(path.join(__dirname, 'school.db'));
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    must_change_password INTEGER DEFAULT 1,
    school_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  const hash = crypto.createHash('sha256').update(password).digest('hex');
  const existing = db.prepare('SELECT id FROM users WHERE username=?').get(username);

  if (existing) {
    db.prepare(`UPDATE users
      SET password_hash=?, full_name=?, role=?, active=1,
          must_change_password=0, updated_at=CURRENT_TIMESTAMP
      WHERE id=?`)
      .run(hash, 'مالك المنصة', 'مبرمج', existing.id);
  } else {
    db.prepare(`INSERT INTO users
      (username,password_hash,full_name,role,active,must_change_password)
      VALUES(?,?,?,'مبرمج',1,0)`)
      .run(username, hash, 'مالك المنصة');
  }

  db.close();
  console.log('OWNER BOOTSTRAP: owner account is ready:', username);
}
