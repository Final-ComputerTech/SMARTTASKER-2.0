const Notification = require('../models/Notification');
const sequelize = require('../config/db');
const { QueryTypes } = require('sequelize');

console.log('[notificationController] module loaded');

exports.listNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const offset = (page - 1) * limit;

    console.log('[notificationController] listNotifications start', { userId: req.user && req.user.user_id, page, limit });

    const isAdmin = req.user && req.user.role === 'admin';
    const userId = req.user ? req.user.user_id : null;
    const whereObj = {};
    if (!isAdmin) whereObj.user_id = userId;

    console.log('[notificationController] counting notifications with whereObj:', whereObj);
    // Use raw queries to avoid any accidental attribute-name injection (defensive)
    let countSql = 'SELECT COUNT(*) as cnt FROM notifications';
    let listSql = `SELECT notification_id, user_id, task_id, title, message, description, type, severity, is_read, created_at, updated_at
                   FROM notifications`;
    const repl = {};
    if (!isAdmin) {
      countSql += ' WHERE user_id = :userId';
      listSql += ' WHERE user_id = :userId';
      repl.userId = userId;
    }
    listSql += ' ORDER BY created_at DESC LIMIT :limit OFFSET :offset';

    const countRes = await sequelize.query(countSql, { type: QueryTypes.SELECT, replacements: repl, logging: (sql) => console.log('[notificationController SQL - count]', sql) });
    const count = countRes && countRes[0] ? parseInt(countRes[0].cnt || 0, 10) : 0;

    console.log('[notificationController] fetching notifications raw with repl:', repl, 'limit:', limit, 'offset:', offset);
    console.log('[notificationController] raw SQL to execute:', listSql);
    console.log('[notificationController] raw SQL replacements:', Object.assign({}, repl, { limit, offset }));
    const rows = await sequelize.query(listSql, { type: QueryTypes.SELECT, replacements: Object.assign({}, repl, { limit, offset }), logging: (sql) => console.log('[notificationController SQL - findAll raw]', sql) });
    // Map DB field `is_read` to JS-friendly `read` property for the response
    const mapped = (rows || []).map(r => { r.read = !!r.is_read; return r; });


    res.json({ notifications: mapped, count });
  } catch (err) {
    console.error('notificationController.listNotifications error', err && err.stack ? err.stack : err);
    try {
      console.error('[NOTIF-ERR] SQL error details:', JSON.stringify({ sql: err && err.sql ? err.sql : null, sqlMessage: err && err.sqlMessage ? err.sqlMessage : null, parentSqlMessage: err && err.parent && err.parent.sqlMessage ? err.parent.sqlMessage : null }));
    } catch (e) { console.error('[NOTIF-ERR] failed to stringify sql error', e); }
    res.status(500).json({ error: err.message });
  }
};
exports.markAllRead = async (req, res) => {
  try {
    const where = {};
    // non-admins only mark their own notifications
    if (req.user.role !== 'admin') where.user_id = req.user.user_id;
    const [updated] = await Notification.update({ is_read: true }, { where });
    res.json({ success: true, updated });
  } catch (err) {
    console.error('notificationController.markAllRead error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const id = req.params.id;
    const notif = await Notification.findByPk(id);
    if (!notif) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && notif.user_id !== req.user.user_id) return res.status(403).json({ error: 'Forbidden' });
    notif.is_read = true;
    await notif.save();
    res.json({ success: true, notification: notif });
  } catch (err) {
    console.error('notificationController.markAsRead error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: err.message });
  }
};

exports.markAsUnread = async (req, res) => {
  try {
    const id = req.params.id;
    const notif = await Notification.findByPk(id);
    if (!notif) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && notif.user_id !== req.user.user_id) return res.status(403).json({ error: 'Forbidden' });
    notif.is_read = false;
    await notif.save();
    res.json({ success: true, notification: notif });
  } catch (err) {
    console.error('notificationController.markAsUnread error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: err.message });
  }
};

exports.unreadCount = async (req, res) => {
  try {
    const where = { is_read: false };
    if (req.user.role !== 'admin') where.user_id = req.user.user_id;
    const count = await Notification.count({ where });
    // compute important unread count (simple heuristic: message contains 'overdue' or 'urgent')
    let important = 0;
    try {
      const rows = await Notification.findAll({
        where,
        limit: 100,
        attributes: [
          'notification_id', 'user_id', 'task_id', 'title', 'message', 'description', 'type', 'severity', 'is_read', 'created_at', 'updated_at'
        ]
      });
      important = (rows || []).filter(r => {
        const txt = String(r.message || r.title || '').toLowerCase();
        return txt.includes('overdue') || txt.includes('urgent') || txt.includes('important');
      }).length;
    } catch (e) { /* ignore */ }
    // Also compute overdue task counts and tasks with no status for this user (same access rules as dashboard)
    try {
      const isAdmin = req.user && req.user.role === 'admin';
      const userId = req.user ? req.user.user_id : null;
      let accessWhere = '1=1';
      let replacements = {};
      if (!isAdmin) {
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        accessWhere = `(
          (
            (t.project_id IS NULL AND t.user_id = :userId)
            OR
            (
              t.project_id IS NOT NULL
              AND (
                t.project_id IN (SELECT project_id FROM Projects p WHERE p.owner_id = :userId)
                OR EXISTS (SELECT 1 FROM collaborators cm WHERE cm.project_id = t.project_id AND cm.user_id = :userId AND cm.role = 'manager')
              )
            )
            OR
            (
              t.project_id IS NOT NULL
              AND EXISTS (SELECT 1 FROM collaborators c WHERE c.project_id = t.project_id AND c.user_id = :userId)
              AND t.user_id IS NOT NULL
              AND (
                EXISTS (SELECT 1 FROM collaborators c2 WHERE c2.project_id = t.project_id AND c2.user_id = t.user_id)
                OR t.user_id = (SELECT p2.owner_id FROM Projects p2 WHERE p2.project_id = t.project_id)
              )
            )
          )
        )`;
        replacements = { userId };
      }

      let overdueRes;
      try {
        overdueRes = await sequelize.query(
          `SELECT COUNT(*) as count FROM Tasks t
           LEFT JOIN due_dates d ON t.due_date_id = d.due_date_id
           LEFT JOIN statuses s ON t.status_id = s.status_id
           WHERE d.due_date IS NOT NULL
             AND d.due_date < NOW()
             AND (s.label IS NULL OR LOWER(s.label) NOT IN ('done','completed'))
             AND ${accessWhere}`,
          { type: QueryTypes.SELECT, replacements }
        );
      } catch (e) {
        overdueRes = await sequelize.query(
          `SELECT COUNT(*) as count FROM Tasks t
           LEFT JOIN Due_Date dd ON t.due_date_id = dd.due_date_id
           LEFT JOIN statuses s ON t.status_id = s.status_id
           WHERE STR_TO_DATE(CONCAT(dd.date, ' ', dd.time), '%Y-%m-%d %H:%i:%s') IS NOT NULL
             AND STR_TO_DATE(CONCAT(dd.date, ' ', dd.time), '%Y-%m-%d %H:%i:%s') < NOW()
             AND (s.label IS NULL OR LOWER(s.label) NOT IN ('done','completed'))
             AND ${accessWhere}`,
          { type: QueryTypes.SELECT, replacements }
        );
      }

      const noStatusRes = await sequelize.query(
        `SELECT COUNT(*) as count FROM Tasks t
         WHERE t.status_id IS NULL
           AND ${accessWhere}`,
        { type: QueryTypes.SELECT, replacements }
      );

      const overdue_tasks_count = overdueRes && overdueRes[0] ? parseInt(overdueRes[0].count, 10) : 0;
      const no_status_tasks_count = noStatusRes && noStatusRes[0] ? parseInt(noStatusRes[0].count, 10) : 0;

      res.json({ unread_count: count, important_count: important, overdue_tasks_count, no_status_tasks_count });
      return;
    } catch (e) {
      // if task-based counts fail, still return notification counts
      console.warn('unreadCount: task counts failed', e);
    }
    res.json({ unread_count: count, important_count: important });
  } catch (err) {
    console.error('notificationController.unreadCount error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: err.message });
  }
};

// Temporary diagnostic endpoint: run a raw SQL SELECT explicitly listing `is_read`
exports.rawList = async (req, res) => {
  try {
    const userId = req.user ? req.user.user_id : null;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const rows = await sequelize.query(
      `SELECT notification_id, user_id, task_id, title, message, description, type, severity, is_read, created_at, updated_at
       FROM notifications
       WHERE user_id = :userId
       ORDER BY created_at DESC
       LIMIT 50`,
      { type: QueryTypes.SELECT, replacements: { userId } }
    );
    res.json({ raw: true, rows });
  } catch (err) {
    console.error('notificationController.rawList error', err && err.stack ? err.stack : err);
    try { console.error('[NOTIF-ERR-RAW]', { sql: err && err.sql ? err.sql : null, parent: err && err.parent && err.parent.sqlMessage ? err.parent.sqlMessage : null }); } catch (e) {}
    res.status(500).json({ error: err.message });
  }
};
