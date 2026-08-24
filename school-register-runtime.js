const express = require('express');
const originalExpress = express;
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || '');

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk.toString();
    if (raw.length > 1024 * 1024) throw new Error('payload too large');
  }
  return raw ? JSON.parse(raw) : {};
}

async function registerSchool(req, res) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(503).json({ success: false, message: 'خدمة تسجيل المدارس غير مهيأة بعد' });
    }
    const body = await readBody(req);
    const response = await fetch(`${SUPABASE_URL}/functions/v1/school-register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY
      },
      body: JSON.stringify(body)
    });
    const text = await response.text();
    res.status(response.status).type('application/json').send(text);
  } catch (error) {
    console.error('SCHOOL_REGISTER_RUNTIME', error);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'تعذر تسجيل المدرسة' });
  }
}

function wrappedExpress(...args) {
  const app = originalExpress(...args);
  app.post('/api/public/school-register', registerSchool);
  return app;
}
Object.setPrototypeOf(wrappedExpress, Object.getPrototypeOf(originalExpress));
Object.assign(wrappedExpress, originalExpress);
require.cache[require.resolve('express')].exports = wrappedExpress;
