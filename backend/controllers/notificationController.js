const Notification = require('../models/Notification');

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
