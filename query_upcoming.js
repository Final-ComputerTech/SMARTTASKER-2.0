(async()=>{
  const sequelize = require('./backend/config/db');
  const { QueryTypes } = require('sequelize');
  const sql = `SELECT t.task_id,t.title,pr.project_name as project,p.label as priority,s.label as status,d.due_date
FROM Tasks t
LEFT JOIN due_dates d ON t.due_date_id = d.due_date_id
LEFT JOIN Projects pr ON t.project_id = pr.project_id
LEFT JOIN priorities p ON t.priority_id = p.priority_id
LEFT JOIN statuses s ON t.status_id = s.status_id
WHERE ((d.due_date IS NOT NULL AND d.due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY))
       OR (d.due_date IS NULL AND t.createdAt >= DATE_SUB(NOW(), INTERVAL :undatedDays DAY)))
  AND (s.label IS NULL OR s.label NOT IN ('Done','Completed'))
  AND ((t.user_id = :userId)
       OR (t.project_id IS NOT NULL AND (t.project_id IN (SELECT project_id FROM Projects p WHERE p.owner_id = :userId) OR EXISTS (SELECT 1 FROM collaborators cm WHERE cm.project_id = t.project_id AND cm.user_id = :userId AND cm.role = 'manager')))
       OR (t.project_id IS NOT NULL AND EXISTS (SELECT 1 FROM collaborators c WHERE c.project_id = t.project_id AND c.user_id = :userId) AND t.user_id IS NOT NULL AND (EXISTS (SELECT 1 FROM collaborators c2 WHERE c2.project_id = t.project_id AND c2.user_id = t.user_id) OR t.user_id = (SELECT p2.owner_id FROM Projects p2 WHERE p2.project_id = t.project_id))))
ORDER BY COALESCE(d.due_date, t.createdAt) ASC LIMIT 50`;
  try {
    const rows = await sequelize.query(sql, { type: QueryTypes.SELECT, replacements: { userId: '55f23ff3-636e-4ade-9e73-05e549da73d0', undatedDays: 365 } });
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error('ERR', e && e.stack ? e.stack : e);
    process.exit(1);
  }
  process.exit(0);
})();
