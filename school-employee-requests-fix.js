/* EduCore: school employee registration request routes
 * Loaded by the main server after auth/db initialization.
 */
module.exports = function registerSchoolEmployeeRequestRoutes({ app, db, auth }) {
  const getSchoolId = (req) => Number(req.user?.school_id || req.user?.schoolId || 0);
  const canManage = (req) => {
    const role = String(req.user?.role || '').toLowerCase();
    return ['owner','admin','school_admin','مدير المدرسة','مبرمج النظام','مبرمج'].includes(role);
  };

  app.get('/api/school/employee-requests', auth, (req, res) => {
    try {
      const schoolId = getSchoolId(req);
      if (!schoolId || !canManage(req)) return res.status(401).json({ success:false, message:'غير مصرح أو لا توجد مدرسة مرتبطة بالحساب' });
      const rows = db.prepare(`SELECT * FROM admin_requests WHERE school_id = ? ORDER BY created_at DESC, id DESC`).all(schoolId);
      res.json({ success:true, requests:rows });
    } catch (e) {
      console.error('school employee requests:', e);
      res.status(500).json({ success:false, message:'تعذر تحميل طلبات الموظفين' });
    }
  });

  app.post('/api/school/employee-requests/:id/review', auth, (req, res) => {
    try {
      const schoolId = getSchoolId(req);
      if (!schoolId || !canManage(req)) return res.status(401).json({ success:false, message:'غير مصرح' });
      const id = Number(req.params.id);
      const action = String(req.body?.action || req.body?.status || '').toLowerCase();
      const request = db.prepare('SELECT * FROM admin_requests WHERE id = ? AND school_id = ?').get(id, schoolId);
      if (!request) return res.status(404).json({ success:false, message:'الطلب غير موجود في هذه المدرسة' });
      const status = ['approve','approved','accept','accepted','موافقة','مقبول'].includes(action) ? 'approved' : ['reject','rejected','رفض','مرفوض'].includes(action) ? 'rejected' : null;
      if (!status) return res.status(400).json({ success:false, message:'إجراء المراجعة غير صحيح' });
      db.prepare('UPDATE admin_requests SET status = ? WHERE id = ? AND school_id = ?').run(status, id, schoolId);
      res.json({ success:true, status, message: status === 'approved' ? 'تمت الموافقة على الطلب' : 'تم رفض الطلب' });
    } catch (e) {
      console.error('review school employee request:', e);
      res.status(500).json({ success:false, message:'تعذر تحديث الطلب' });
    }
  });
};
