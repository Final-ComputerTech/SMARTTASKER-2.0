const sequelize = require('../config/db');
const { QueryTypes } = require('sequelize');

exports.summary = async (req, res) => {
  try {
    // Build access filter for non-admin users so they only see their own or related tasks
    const isAdmin = req.user && req.user.role === 'admin';
    const userId = req.user ? req.user.user_id : null;
    let accessWhere = '1=1';
    let replacements = {};
    if (!isAdmin) {
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      // Build visibility according to user rules:
      // 1) Include user's own standalone tasks (not in a project): t.project_id IS NULL and t.user_id = :userId
      // 2) Include all tasks in projects where the user is a manager (owner OR collaborator.role='manager')
      // 3) For projects the user participates in (collaborator), include only tasks that are assigned (t.user_id IS NOT NULL)
      //    and where the assignee is a project member (owner or collaborator). This prevents unassigned tasks from appearing
      //    for non-manager participants.
      accessWhere = `(
        (
          -- 1) user's own standalone tasks
          (t.project_id IS NULL AND t.user_id = :userId)

          OR

          -- 2) any task in a project where user is manager (project owner OR collaborator.role='manager')
          (
            t.project_id IS NOT NULL
            AND (
              t.project_id IN (SELECT project_id FROM Projects p WHERE p.owner_id = :userId)
              OR EXISTS (SELECT 1 FROM collaborators cm WHERE cm.project_id = t.project_id AND cm.user_id = :userId AND cm.role = 'manager')
            )
          )

          OR

          -- 3) tasks in projects where user participates but is not manager: require the task to be assigned to a project member
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
    const statuses = await sequelize.query(
      `SELECT s.label as status, COUNT(*) as count FROM Tasks t
       LEFT JOIN statuses s ON t.status_id = s.status_id
       WHERE ${accessWhere}
       GROUP BY s.label`,
      { type: QueryTypes.SELECT, replacements }
    );

    const priorities = await sequelize.query(
      `SELECT p.label as priority, COUNT(*) as count FROM Tasks t
       LEFT JOIN priorities p ON t.priority_id = p.priority_id
       WHERE ${accessWhere}
       GROUP BY p.label`,
      { type: QueryTypes.SELECT, replacements }
    );

    const projects = await sequelize.query(
      `SELECT pr.project_name as project, COUNT(*) as count FROM Tasks t
       LEFT JOIN Projects pr ON t.project_id = pr.project_id
       WHERE ${accessWhere}
       GROUP BY pr.project_name ORDER BY count DESC LIMIT 10`,
      { type: QueryTypes.SELECT, replacements }
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
         AND ${accessWhere}
       ORDER BY d.due_date ASC
       LIMIT 20`,
      { type: QueryTypes.SELECT, replacements }
    );

    const overdueRes = await sequelize.query(
      `SELECT COUNT(*) as count FROM Tasks t
       LEFT JOIN due_dates d ON t.due_date_id = d.due_date_id
       LEFT JOIN statuses s ON t.status_id = s.status_id
       WHERE d.due_date IS NOT NULL AND d.due_date < NOW() AND (s.label IS NULL OR s.label NOT IN ('Done','Completed')) AND ${accessWhere}`,
      { type: QueryTypes.SELECT, replacements }
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
       LEFT JOIN due_dates d ON t.due_date_id = d.due_date_id
       WHERE ${accessWhere}`,
      { type: QueryTypes.SELECT, replacements }
    );

    const categoryCounts = (categoryRes && categoryRes[0]) ? categoryRes[0] : { todo:0, in_progress:0, done:0, failed:0, overdue:0, total:0 };

    const recentChanges = await sequelize.query(
      `SELECT c.change_id, c.task_id, c.user_id, c.field, c.old_value, c.new_value, c.created_at as createdAt
       FROM changes c
       WHERE c.task_id IN (SELECT t.task_id FROM Tasks t WHERE ${accessWhere})
       ORDER BY c.created_at DESC
       LIMIT 20`,
      { type: QueryTypes.SELECT, replacements }
    );

    res.json({ statuses, priorities, projects, upcoming, overdueCount, recentChanges, categoryCounts });
  } catch (err) {
    console.error('dashboardV2.summary error', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = exports;
