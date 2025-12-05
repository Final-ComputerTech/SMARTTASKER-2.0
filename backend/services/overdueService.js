const sequelize = require('../config/db');
const { QueryTypes } = require('sequelize');

async function getOverdueTaskIds({ accessWhere = '1=1', replacements = {} } = {}) {
  const merged = Object.assign({}, replacements);
  // Try modern schema first
  try {
    const rows = await sequelize.query(
      `SELECT t.task_id FROM Tasks t
       LEFT JOIN due_dates d ON t.due_date_id = d.due_date_id
       LEFT JOIN statuses s ON t.status_id = s.status_id
       WHERE d.due_date IS NOT NULL
         AND d.due_date < NOW()
         AND (s.label IS NULL OR LOWER(s.label) NOT IN ('done','completed'))
         AND ${accessWhere}`,
      { type: QueryTypes.SELECT, replacements: merged }
    );
    return { path: 'modern', ids: (rows || []).map(r => r.task_id), rows };
  } catch (err) {
    // fallback to legacy Due_Date
    const rows = await sequelize.query(
      `SELECT t.task_id FROM Tasks t
       LEFT JOIN Due_Date dd ON t.due_date_id = dd.due_date_id
       LEFT JOIN statuses s ON t.status_id = s.status_id
       WHERE STR_TO_DATE(CONCAT(dd.date,' ',dd.time),'%Y-%m-%d %H:%i:%s') IS NOT NULL
         AND STR_TO_DATE(CONCAT(dd.date,' ',dd.time),'%Y-%m-%d %H:%i:%s') < NOW()
         AND (s.label IS NULL OR LOWER(s.label) NOT IN ('done','completed'))
         AND ${accessWhere}`,
      { type: QueryTypes.SELECT, replacements: merged }
    );
    return { path: 'legacy', ids: (rows || []).map(r => r.task_id), rows };
  }
}

module.exports = { getOverdueTaskIds };
