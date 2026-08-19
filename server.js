const express = require("express");
const bodyParser = require("body-parser");
const Database = require("better-sqlite3");
const nodemailer = require("nodemailer");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080;

// Some legacy compatibility modules wrap the Express factory. Prefer native
// middleware when available, but always fall back to body-parser so startup
// cannot fail with "express.json is not a function".
const jsonParser = typeof express.json === "function"
  ? express.json({ limit: "2mb" })
  : bodyParser.json({ limit: "2mb" });
const urlencodedParser = typeof express.urlencoded === "function"
  ? express.urlencoded({ extended: true })
  : bodyParser.urlencoded({ extended: true });

app.use(jsonParser);
app.use(urlencodedParser);

const db = new Database(path.join(__dirname, "school.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/* =========================================================
   DATABASE
========================================================= */

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    must_change_password INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    student_number TEXT UNIQUE,
    full_name TEXT NOT NULL,
    grade TEXT,
    class_name TEXT,
    date_of_birth TEXT,
    gender TEXT,
    address TEXT,
    notes TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS parents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL`);