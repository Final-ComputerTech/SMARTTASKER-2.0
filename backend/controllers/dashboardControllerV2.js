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
      // - Always include tasks owned/created by the user (any project or standalone)
      // - Include all tasks in projects where the user is a manager (owner OR collaborator.role='manager')
      // - For projects the user participates in (collaborator), include only tasks that are assigned (t.user_id IS NOT NULL)
      //   and where the assignee is a project member (owner or collaborator). This prevents unassigned tasks from appearing
      //   for non-manager participants while still showing tasks the user created.
      accessWhere = `(
        (
          -- user's own tasks (anywhere)
          (t.user_id = :userId)

          OR

          -- any task in a project where user is manager (project owner OR collaborator.role='manager')
          (
            t.project_id IS NOT NULL
            AND (
              t.project_id IN (SELECT project_id FROM Projects p WHERE p.owner_id = :userId)
              OR EXISTS (SELECT 1 FROM collaborators cm WHERE cm.project_id = t.project_id AND cm.user_id = :userId AND cm.role = 'manager')
            )
          )

          OR

          -- tasks in projects where user participates but is not manager: require the task to be assigned to a project member
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
    // Use database-side NOW() comparisons for robust timezone handling.
    // `replacements` only needs to contain user-related values.
    replacements = Object.assign({}, replacements);

    const statuses = await sequelize.query(
      `SELECT COALESCE(s.label, 'No status') as status, COUNT(*) as count FROM Tasks t
       LEFT JOIN statuses s ON t.status_id = s.status_id
       WHERE ${accessWhere}
       GROUP BY COALESCE(s.label, 'No status')`,
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

    // Include undated tasks that were created recently so users see newly-created undated items.
    // `undatedDays` controls the lookback window (in days). Default to 3 days. Can be overridden
    // via query param `?undatedDays=N` for testing; value is capped at 90.
    let undatedDays = 3;
    try {
      const qv = parseInt(req.query && req.query.undatedDays ? req.query.undatedDays : '', 10);
      if (!isNaN(qv) && qv > 0) undatedDays = Math.min(qv, 90);
    } catch (e) { undatedDays = 3; }
    replacements.undatedDays = undatedDays;

    // Try modern due_dates.due_date first. If the DB uses the legacy Due_Date(date,time) schema
    // the primary query will fail due to missing columns; in that case fall back to the legacy query.
    let upcoming;
    try {
      // modern schema: use DB-side NOW() window [NOW(), NOW()+7 days]
      upcoming = await sequelize.query(
        `SELECT t.task_id, t.title, pr.project_name as project, p.label as priority, s.label as status, d.due_date
         FROM Tasks t
         LEFT JOIN due_dates d ON t.due_date_id = d.due_date_id
         LEFT JOIN Projects pr ON t.project_id = pr.project_id
         LEFT JOIN priorities p ON t.priority_id = p.priority_id
         LEFT JOIN statuses s ON t.status_id = s.status_id
         WHERE (
           -- tasks with an explicit due date inside the upcoming window
           (d.due_date IS NOT NULL AND d.due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY))
           OR
           -- undated tasks (no due row) created within the last undatedDays (use Sequelize createdAt column)
           (d.due_date IS NULL AND t.createdAt >= DATE_SUB(NOW(), INTERVAL :undatedDays DAY))
         )
           AND (s.label IS NULL OR s.label NOT IN ('Done','Completed'))
           AND ${accessWhere}
         ORDER BY COALESCE(d.due_date, t.createdAt) ASC
         LIMIT 20`,
        { type: QueryTypes.SELECT, replacements }
      );
    } catch (e) {
      // Fallback to legacy Due_Date table (columns: date, time) and coerce to datetime
      upcoming = await sequelize.query(
        `SELECT t.task_id, t.title, pr.project_name as project, p.label as priority, s.label as status,
           STR_TO_DATE(CONCAT(dd.date, ' ', dd.time), '%Y-%m-%d %H:%i:%s') as due_date
         FROM Tasks t
         LEFT JOIN Due_Date dd ON t.due_date_id = dd.due_date_id
         LEFT JOIN Projects pr ON t.project_id = pr.project_id
         LEFT JOIN priorities p ON t.priority_id = p.priority_id
         LEFT JOIN statuses s ON t.status_id = s.status_id
         WHERE (
           (STR_TO_DATE(CONCAT(dd.date, ' ', dd.time), '%Y-%m-%d %H:%i:%s') IS NOT NULL
             AND STR_TO_DATE(CONCAT(dd.date, ' ', dd.time), '%Y-%m-%d %H:%i:%s') BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY))
           OR
           (STR_TO_DATE(CONCAT(dd.date, ' ', dd.time), '%Y-%m-%d %H:%i:%s') IS NULL
             AND t.createdAt >= DATE_SUB(NOW(), INTERVAL :undatedDays DAY))
         )
           AND (s.label IS NULL OR s.label NOT IN ('Done','Completed'))
           AND ${accessWhere}
         ORDER BY COALESCE(STR_TO_DATE(CONCAT(dd.date, ' ', dd.time), '%Y-%m-%d %H:%i:%s'), t.createdAt) ASC
         LIMIT 20`,
        { type: QueryTypes.SELECT, replacements }
      );
    }

    // Centralize overdue ID computation so counts match across endpoints
    const overdueService = require('../services/overdueService');
    const over = await overdueService.getOverdueTaskIds({ accessWhere, replacements });
    const overdueCount = (over.ids || []).length;

    let categoryRes;
    try {
      categoryRes = await sequelize.query(
        `SELECT
         SUM(CASE WHEN LOWER(COALESCE(s.label,'')) LIKE 'todo%' OR LOWER(COALESCE(s.label,'')) LIKE 'to do%' THEN 1 ELSE 0 END) as todo,
         SUM(CASE WHEN LOWER(COALESCE(s.label,'')) LIKE '%in progress%' OR LOWER(COALESCE(s.label,'')) = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
         SUM(CASE WHEN LOWER(COALESCE(s.label,'')) LIKE 'done%' OR LOWER(COALESCE(s.label,'')) LIKE 'completed%' THEN 1 ELSE 0 END) as done,
         SUM(CASE WHEN LOWER(COALESCE(s.label,'')) LIKE 'failed%' THEN 1 ELSE 0 END) as failed,
         SUM(CASE WHEN d.due_date IS NOT NULL
                 AND d.due_date < NOW()
                 AND (s.label IS NULL OR LOWER(s.label) NOT IN ('done','completed')) THEN 1 ELSE 0 END) as overdue,
         COUNT(*) as total
       FROM Tasks t
       LEFT JOIN statuses s ON t.status_id = s.status_id
       LEFT JOIN due_dates d ON t.due_date_id = d.due_date_id
       WHERE ${accessWhere}`,
        { type: QueryTypes.SELECT, replacements }
      );
    } catch (e) {
      categoryRes = await sequelize.query(
        `SELECT
         SUM(CASE WHEN LOWER(COALESCE(s.label,'')) LIKE 'todo%' OR LOWER(COALESCE(s.label,'')) LIKE 'to do%' THEN 1 ELSE 0 END) as todo,
         SUM(CASE WHEN LOWER(COALESCE(s.label,'')) LIKE '%in progress%' OR LOWER(COALESCE(s.label,'')) = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
         SUM(CASE WHEN LOWER(COALESCE(s.label,'')) LIKE 'done%' OR LOWER(COALESCE(s.label,'')) LIKE 'completed%' THEN 1 ELSE 0 END) as done,
         SUM(CASE WHEN LOWER(COALESCE(s.label,'')) LIKE 'failed%' THEN 1 ELSE 0 END) as failed,
         SUM(CASE WHEN STR_TO_DATE(CONCAT(dd.date, ' ', dd.time), '%Y-%m-%d %H:%i:%s') IS NOT NULL
                 AND STR_TO_DATE(CONCAT(dd.date, ' ', dd.time), '%Y-%m-%d %H:%i:%s') < NOW()
                 AND (s.label IS NULL OR LOWER(s.label) NOT IN ('done','completed')) THEN 1 ELSE 0 END) as overdue,
         COUNT(*) as total
       FROM Tasks t
       LEFT JOIN statuses s ON t.status_id = s.status_id
       LEFT JOIN Due_Date dd ON t.due_date_id = dd.due_date_id
       WHERE ${accessWhere}`,
        { type: QueryTypes.SELECT, replacements }
      );
    }

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

exports.debugOverdue = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role === 'admin';
    const userId = req.user ? req.user.user_id : null;
    let accessWhere = '1=1';
    let replacements = {};
    if (!isAdmin) {
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      accessWhere = `(
        (
          -- user's own tasks (anywhere)
          (t.user_id = :userId)

          OR

          -- any task in a project where user is manager (project owner OR collaborator.role='manager')
          (
            t.project_id IS NOT NULL
            AND (
              t.project_id IN (SELECT project_id FROM Projects p WHERE p.owner_id = :userId)
              OR EXISTS (SELECT 1 FROM collaborators cm WHERE cm.project_id = t.project_id AND cm.user_id = :userId AND cm.role = 'manager')
            )
          )

          OR

          -- tasks in projects where user participates but is not manager: require the task to be assigned to a project member
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

    // Use DB-side NOW() for overdue comparisons
    replacements = Object.assign({}, replacements);

    // Try modern schema first
    try {
      const rows = await sequelize.query(
        `SELECT t.task_id, d.due_date, s.label as status FROM Tasks t
         LEFT JOIN due_dates d ON t.due_date_id = d.due_date_id
         LEFT JOIN statuses s ON t.status_id = s.status_id
         WHERE d.due_date IS NOT NULL
           AND d.due_date < NOW()
           AND (s.label IS NULL OR LOWER(s.label) NOT IN ('done','completed'))
           AND ${accessWhere}`,
        { type: QueryTypes.SELECT, replacements }
      );
      return res.json({ path: 'modern', count: rows.length, tasks: rows.map(r => ({ task_id: r.task_id, due_date: r.due_date, status: r.status })) });
    } catch (e) {
      // fallback to legacy Due_Date
      const rows = await sequelize.query(
          `SELECT t.task_id, STR_TO_DATE(CONCAT(dd.date,' ',dd.time),'%Y-%m-%d %H:%i:%s') as due_date, s.label as status
         FROM Tasks t
         LEFT JOIN Due_Date dd ON t.due_date_id = dd.due_date_id
         LEFT JOIN statuses s ON t.status_id = s.status_id
         WHERE STR_TO_DATE(CONCAT(dd.date,' ',dd.time),'%Y-%m-%d %H:%i:%s') IS NOT NULL
            AND STR_TO_DATE(CONCAT(dd.date,' ',dd.time),'%Y-%m-%d %H:%i:%s') < NOW()
           AND (s.label IS NULL OR LOWER(s.label) NOT IN ('done','completed'))
           AND ${accessWhere}`,
        { type: QueryTypes.SELECT, replacements }
      );
      return res.json({ path: 'legacy', count: rows.length, tasks: rows.map(r => ({ task_id: r.task_id, due_date: r.due_date, status: r.status })) });
    }
  } catch (err) {
    console.error('dashboardV2.debugOverdue error', err);
    res.status(500).json({ error: err.message });
  }
};
