const Notification = require('../models/Notification');
const sequelize = require('../config/db');
const { QueryTypes } = require('sequelize');

exports.listNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const offset = (page - 1) * limit;

    const where = {};
    // non-admins only see their notifications
    if (req.user.role !== 'admin') where.user_id = req.user.user_id;

    const { count, rows } = await Notification.findAndCountAll({ where, limit, offset, order: [['createdAt', 'DESC']] });
    res.json({ total: count, page, pageSize: rows.length, notifications: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notif = await Notification.findByPk(id);
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    if (req.user.role !== 'admin' && notif.user_id !== req.user.user_id) return res.status(403).json({ error: 'Forbidden' });
    await notif.update({ read: true });
    res.json({ success: true, notification: notif });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.markAsUnread = async (req, res) => {
  try {
    const { id } = req.params;
    const notif = await Notification.findByPk(id);
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    if (req.user.role !== 'admin' && notif.user_id !== req.user.user_id) return res.status(403).json({ error: 'Forbidden' });
    await notif.update({ read: false });
    res.json({ success: true, notification: notif });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    const where = {};
    // non-admins only mark their own notifications
    if (req.user.role !== 'admin') where.user_id = req.user.user_id;
    const [updated] = await Notification.update({ read: true }, { where });
    res.json({ success: true, updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.unreadCount = async (req, res) => {
  try {
    const where = { read: false };
    if (req.user.role !== 'admin') where.user_id = req.user.user_id;
    const count = await Notification.count({ where });
    // compute important unread count (simple heuristic: message contains 'overdue' or 'urgent')
    let important = 0;
    try {
      const rows = await Notification.findAll({ where, limit: 100 });
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
    res.status(500).json({ error: err.message });
  }
};
