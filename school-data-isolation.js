/* EduCore school tenant-isolation helpers.
 * Safe to require from server.js after db/auth are initialized.
 */
module.exports = function registerSchoolIsolation({ app, db, auth }) {
  const schoolId = (req) => Number(req.user?.school_id || 0);
  const isOwner = (req) => ['مبرمج','مبرمج النظام','مالك المنصة','owner'].includes(String(req.user?.role || ''));

  function requireSchool(req, res, next) {
    if (isOwner(req)) return next();
    const id = schoolId(req);
    if (!id) return res.status(403).json({ success:false, message:'الحساب غير مرتبط بمدرسة' });
    next();
  }

  // Central guard for common school-scoped resources. These routes deliberately
  // do not expose cross-school rows and use the authenticated user's school_id.
  app.get('/api/school/tenant-context', auth, requireSchool, (req,res) => {
    res.json({ success:true, school_id: isOwner(req) ? null : schoolId(req), owner:isOwner(req) });
  });

  app.get('/api/school/students', auth, requireSchool, (req,res) => {
    try {
      if (isOwner(req)) return res.json({ success:true, students:db.prepare('SELECT * FROM students ORDER BY id DESC LIMIT 500').all() });
      res.json({ success:true, students:db.prepare('SELECT * FROM students WHERE school_id=? ORDER BY id DESC LIMIT 500').all(schoolId(req)) });
    } catch(e) { res.status(500).json({success:false,message:'تعذر تحميل الطلاب'}); }
  });

  app.get('/api/school/employees', auth, requireSchool, (req,res) => {
    try {
      if (isOwner(req)) return res.json({ success:true, employees:db.prepare('SELECT e.*,u.username,u.full_name,u.role,u.active AS user_active FROM employees e LEFT JOIN users u ON u.id=e.user_id ORDER BY e.id DESC LIMIT 500').all() });
      res.json({ success:true, employees:db.prepare('SELECT e.*,u.username,u.full_name,u.role,u.active AS user_active FROM employees e LEFT JOIN users u ON u.id=e.user_id WHERE e.school_id=? ORDER BY e.id DESC LIMIT 500').all(schoolId(req)) });
    } catch(e) { res.status(500).json({success:false,message:'تعذر تحميل الموظفين'}); }
  });

  app.get('/api/school/classes', auth, requireSchool, (req,res) => {
    const rows = isOwner(req) ? db.prepare('SELECT * FROM classes ORDER BY id DESC LIMIT 500').all() : db.prepare('SELECT * FROM classes WHERE school_id=? ORDER BY id DESC LIMIT 500').all(schoolId(req));
    res.json({success:true,classes:rows});
  });

  app.get('/api/school/subjects', auth, requireSchool, (req,res) => {
    const rows = isOwner(req) ? db.prepare('SELECT * FROM subjects ORDER BY id DESC LIMIT 500').all() : db.prepare('SELECT * FROM subjects WHERE school_id=? ORDER BY id DESC LIMIT 500').all(schoolId(req));
    res.json({success:true,subjects:rows});
  });

  app.get('/api/school/announcements', auth, requireSchool, (req,res) => {
    const rows = isOwner(req) ? db.prepare('SELECT * FROM announcements ORDER BY id DESC LIMIT 500').all() : db.prepare('SELECT * FROM announcements WHERE school_id=? ORDER BY id DESC LIMIT 500').all(schoolId(req));
    res.json({success:true,announcements:rows});
  });
};
