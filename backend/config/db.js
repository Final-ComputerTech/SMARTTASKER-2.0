const { Sequelize } = require('sequelize');
const path = require('path');
// Ensure we load the backend .env file even when the process is started from repository root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    // enable verbose SQL logging temporarily to diagnose notification SQL errors
    logging: (msg) => {
      try {
        // Always print SQL for visibility during debugging
        console.log('[sequelize]', msg);
        const s = String(msg);
        const ls = s.toLowerCase();
        if (ls.includes('from `notifications`') || ls.includes('from notifications') || s.includes(' read,') || s.includes(', read') || s.includes('`read`')) {
          console.log('[sequelize-notify-sql] captured notification SQL:');
          console.log(msg);
          console.log(new Error('stack').stack.split('\n').slice(2,12).join('\n'));
        }
      } catch (e) {}
    }
  }
);

// Monkey-patch sequelize.query to capture raw SQL strings with stack traces for debugging
try {
  const _origQuery = sequelize.query.bind(sequelize);
  sequelize.query = async function (sql, options) {
    const s = String(sql || '');
    try {
      const ls = s.toLowerCase();
      // Mitigation: detect queries that reference the notifications table and
      // contain an unquoted alias/token `read` in SELECT lists. Rewrite a few
      // common patterns to use the physical column `is_read` instead. This is
      // a temporary runtime sanitizer to avoid MySQL syntax errors while we
      // capture the root cause. All rewrites are logged for later removal.
      if (ls.includes(' from `notifications`') || ls.includes(' from notifications') || s.includes(' read,') || s.includes(', read') || s.includes('\nread,') || s.includes('`read`') || /\bAS\s+read\b/i.test(s) || /\bSELECT\s+read\b/i.test(s)) {
        console.log('[sequelize-query-monitor] about to run SQL touching notifications/read:');
        console.log('[sequelize-query-monitor] original SQL:');
        console.log(s);
        console.log(new Error('query-stack').stack.split('\n').slice(2,12).join('\n'));

        try {
          let transformed = s;
          // Common safe textual replacements to convert unqualified/alias `read` -> `is_read`
          transformed = transformed.replace(/,\s*read\b/gi, ', is_read');
          transformed = transformed.replace(/\bread\s*,/gi, ' is_read,');
          transformed = transformed.replace(/\bAS\s+read\b/gi, 'AS is_read');
          transformed = transformed.replace(/`read`/g, '`is_read`');
          transformed = transformed.replace(/\bSELECT\s+read\b/gi, 'SELECT is_read');

          if (transformed !== s) {
            console.log('[sequelize-query-monitor] transformed SQL (read -> is_read):');
            console.log(transformed);
            // replace sql with transformed version for execution
            sql = transformed;
          }
        } catch (e2) {
          console.warn('[sequelize-query-monitor] failed to transform SQL safely', e2 && e2.stack ? e2.stack : e2);
        }
      }

      // Execute the original query and catch runtime SQL errors so we can log
      // the full SQL that caused them (err.sql may be partial in some cases).
      try {
        return await _origQuery(sql, options);
      } catch (queryErr) {
        try {
          console.error('[sequelize-query-monitor] query failed. SQL:');
          console.error(String(sql));
          console.error('[sequelize-query-monitor] error stack:');
          console.error(queryErr && (queryErr.stack || queryErr));
          if (queryErr && queryErr.sql) console.error('[sequelize-query-monitor] err.sql:', queryErr.sql);
          if (queryErr && queryErr.parent && queryErr.parent.sql) console.error('[sequelize-query-monitor] err.parent.sql:', queryErr.parent.sql);
        } catch (logErr) {}
        throw queryErr;
      }
    } catch (e) {
      // If our inspector throws, fall back to executing the original query.
      try { return await _origQuery(sql, options); } catch (qE) { throw qE; }
    }
  };
} catch (e) {
  // best-effort only; do not block startup
  try { console.warn('Failed to patch sequelize.query for debug:', e && e.stack ? e.stack : e); } catch (e2) {}
}

module.exports = sequelize;

