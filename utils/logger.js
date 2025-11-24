function info(msg, meta) {
  console.log('[INFO]', msg, meta || '');
}
function warn(msg, meta) {
  console.warn('[WARN]', msg, meta || '');
}
function error(msg, meta) {
  console.error('[ERROR]', msg, meta || '');
}

module.exports = { info, warn, error };

