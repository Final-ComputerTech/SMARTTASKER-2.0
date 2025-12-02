const sequelize = require('../config/db');
const { QueryTypes } = require('sequelize');

exports.summary = async (req, res) => {
  try {
    const statuses = await sequelize.query(
      `SELECT s.label as status, COUNT(*) as count FROM Tasks t
       LEFT JOIN statuses s ON t.status_id = s.status_id
       GROUP BY s.label`,
      { type: QueryTypes.SELECT }
    );

    const priorities = await sequelize.query(
      `SELECT p.label as priority, COUNT(*) as count FROM Tasks t
       LEFT JOIN priorities p ON t.priority_id = p.priority_id
       GROUP BY p.label`,
      { type: QueryTypes.SELECT }
    );

    const projects = await sequelize.query(
      `SELECT pr.project_name as project, COUNT(*) as count FROM Tasks t
       LEFT JOIN Projects pr ON t.project_id = pr.project_id
       GROUP BY pr.project_name ORDER BY count DESC LIMIT 10`,
      { type: QueryTypes.SELECT }
    );

    const upcoming = await sequelize.query(
      `SELECT t.task_id, t.title, pr.project_name as project, p.label as priority, s.label as status, d.due_date
       FROM Tasks t
       LEFT JOIN due_dates d ON t.due_date_id = d.due_date_id
       LEFT JOIN Projects pr ON t.project_id = pr.project_id
       LEFT JOIN priorities p ON t.priority_id = p.priority_id
       LEFT JOIN statuses s ON t.status_id = s.status_id
       WHERE d.due_date IS NOT NULL
         AND d.due_date >= NOW()
         AND d.due_date <= DATE_ADD(NOW(), INTERVAL 7 DAY)
         AND (s.label IS NULL OR s.label NOT IN ('Done','Completed'))
       ORDER BY d.due_date ASC
       LIMIT 20`,
      { type: QueryTypes.SELECT }
    );

    const overdueRes = await sequelize.query(
      `SELECT COUNT(*) as count FROM Tasks t
       LEFT JOIN due_dates d ON t.due_date_id = d.due_date_id
       LEFT JOIN statuses s ON t.status_id = s.status_id
       WHERE d.due_date IS NOT NULL AND d.due_date < NOW() AND (s.label IS NULL OR s.label NOT IN ('Done','Completed'))`,
      { type: QueryTypes.SELECT }
    );

    const overdueCount = overdueRes && overdueRes[0] ? parseInt(overdueRes[0].count, 10) : 0;

    const categoryRes = await sequelize.query(
      `SELECT
         SUM(CASE WHEN LOWER(COALESCE(s.label,'')) LIKE 'todo%' OR LOWER(COALESCE(s.label,'')) LIKE 'to do%' THEN 1 ELSE 0 END) as todo,
         SUM(CASE WHEN LOWER(COALESCE(s.label,'')) LIKE '%in progress%' OR LOWER(COALESCE(s.label,'')) = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
         SUM(CASE WHEN LOWER(COALESCE(s.label,'')) LIKE 'done%' OR LOWER(COALESCE(s.label,'')) LIKE 'completed%' THEN 1 ELSE 0 END) as done,
         SUM(CASE WHEN LOWER(COALESCE(s.label,'')) LIKE 'failed%' THEN 1 ELSE 0 END) as failed,
         SUM(CASE WHEN d.due_date IS NOT NULL AND d.due_date < NOW() AND (s.label IS NULL OR LOWER(s.label) NOT IN ('done','completed')) THEN 1 ELSE 0 END) as overdue,
         COUNT(*) as total
       FROM Tasks t
       LEFT JOIN statuses s ON t.status_id = s.status_id
       LEFT JOIN due_dates d ON t.due_date_id = d.due_date_id`,
      { type: QueryTypes.SELECT }
    );

    const categoryCounts = (categoryRes && categoryRes[0]) ? categoryRes[0] : { todo:0, in_progress:0, done:0, failed:0, overdue:0, total:0 };

    const recentChanges = await sequelize.query(
      `SELECT c.change_id, c.task_id, c.user_id, c.field, c.old_value, c.new_value, c.created_at as createdAt
       FROM changes c
       ORDER BY c.created_at DESC
       LIMIT 20`,
      { type: QueryTypes.SELECT }
    );

    res.json({ statuses, priorities, projects, upcoming, overdueCount, recentChanges, categoryCounts });
  } catch (err) {
    console.error('dashboardV2.summary error', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = exports;
