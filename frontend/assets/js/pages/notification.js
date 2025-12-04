import { notificationApi } from '../api/notificationApi.js';
import { requireAuthRedirect } from '../utils/auth.js';

requireAuthRedirect();

// Small icon mapping by type/heuristic
function iconForNotification(n) {
  const txt = (n.type || n.message || n.title || '').toString().toLowerCase();
  if (txt.includes('overdue') || txt.includes('late') || txt.includes('urgent')) return '⚠️';
  if (txt.includes('assigned') || txt.includes('assigned to')) return '📌';
  if (txt.includes('reminder') || txt.includes('due')) return '🔔';
  if (txt.includes('updated') || txt.includes('change') || txt.includes('edited')) return '✏️';
  return '🔔';
}

function formatTimeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

async function refreshSidebarBadge() {
  try {
    const res = await notificationApi.unreadCount();
    const badgeEl = document.getElementById('notifBadge');
    if (!badgeEl) return;
    const unread = res && (res.unread_count || 0);
    const important = res && (res.important_count || 0);
    if (unread > 0) {
      badgeEl.innerHTML = `<span class="badge" style="background:${important>0?'#dc3545':'#0dcaf0'};color:white;padding:2px 6px;border-radius:999px;">${unread}</span>`;
      badgeEl.title = `You have ${unread} unread notifications`;
    } else {
      badgeEl.innerHTML = '';
      badgeEl.title = '';
    }
  } catch (e) { /* ignore */ }
}

// Render grouped by date optionally
function groupByDate(items) {
  const groups = { 'Today': [], 'Yesterday': [], 'Earlier': [] };
  const now = new Date();
  items.forEach(n => {
    const d = new Date(n.created_at || n.createdAt || n.updatedAt || Date.now());
    const diff = (now - d) / (1000 * 60 * 60 * 24);
    if (diff < 1) groups['Today'].push(n);
    else if (diff < 2) groups['Yesterday'].push(n);
    else groups['Earlier'].push(n);
  });
  return groups;
}

function renderNotifications(list) {
  const el = document.getElementById('notificationList');
  el.innerHTML = '';
  const grouped = groupByDate(list || []);
  Object.keys(grouped).forEach(section => {
    const arr = grouped[section];
    if (!arr || arr.length === 0) return;
    const h = document.createElement('h6'); h.className = 'mt-3'; h.textContent = section; el.appendChild(h);
    const ul = document.createElement('ul'); ul.className = 'list-group mb-2';
    arr.forEach(n => {
      const row = document.createElement('li');
      row.className = `list-group-item d-flex justify-content-between align-items-start ${n.read ? 'bg-white' : 'bg-light fw-bold'}`;
      const icon = iconForNotification(n);
      row.innerHTML = `
        <div class="me-2">${icon}</div>
        <div class="flex-grow-1">
          <div><strong>${escapeHtml(n.title || n.message || '')}</strong></div>
          <div class="small text-muted">${escapeHtml(n.description || '')}</div>
        </div>
        <div class="text-end ms-2">
          <div class="small text-muted">${formatTimeAgo(n.created_at || n.createdAt)}</div>
          <div class="mt-1">
            <button class="btn btn-sm btn-outline-primary mark-read-btn">${n.read ? 'Mark Unread' : 'Mark Read'}</button>
            <button class="btn btn-sm btn-outline-danger ms-1 delete-notif-btn">Delete</button>
          </div>
        </div>
      `;
      // click opens task
      row.querySelector('div.flex-grow-1').addEventListener('click', async () => {
        if (!n.read) await notificationApi.markRead(n.notification_id);
        refreshSidebarBadge();
        window.location.href = `/task-detail.html?id=${n.task_id}`;
      });
      // mark read/unread
      row.querySelector('.mark-read-btn').addEventListener('click', async (ev) => {
        ev.stopPropagation();
        try {
          if (n.read) {
            await notificationApi.markUnread(n.notification_id);
          } else {
            await notificationApi.markRead(n.notification_id);
          }
          loadAndRender();
        } catch (e) { console.warn('mark read/unread failed', e); }
      });
      // delete (optional): simple UI remove; backend delete API not implemented, so perform client-side removal and refresh
      row.querySelector('.delete-notif-btn').addEventListener('click', async (ev) => {
        ev.stopPropagation();
        if (!confirm('Delete this notification?')) return;
        try {
          // attempt to call backend delete if available
          try { await fetch(`/api/notifications/${n.notification_id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('st_token')}` } }); } catch (e) { /* ignore */ }
          loadAndRender();
        } catch (e) { console.warn('delete failed', e); }
      });
      ul.appendChild(row);
    });
    el.appendChild(ul);
  });
}

async function loadAndRender(q) {
  try {
    let res = await notificationApi.list();
    let list = res.notifications || res.data || res || [];
    // normalize array
    if (!Array.isArray(list)) list = [];
    // apply search filter if provided
    if (q && q.trim()) {
      const ql = q.toLowerCase();
      list = list.filter(n => (String(n.title||n.message||n.description||'')+ ' ' + (n.task_id||'')).toLowerCase().includes(ql));
    }
    renderNotifications(list);
    refreshSidebarBadge();
  } catch (e) { console.error('load notifications failed', e); }
}

// Mark all as read
document.getElementById('markAllReadBtn')?.addEventListener('click', async () => {
  try { await notificationApi.markAllRead(); loadAndRender(); } catch (e) { console.warn('mark all read failed', e); }
});

// Search input
document.getElementById('notifSearchInput')?.addEventListener('input', (e) => {
  const q = e.target.value || '';
  // debounce
  clearTimeout(window.__notifSearchTimer);
  window.__notifSearchTimer = setTimeout(() => loadAndRender(q), 250);
});

// helper: escape html
function escapeHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

document.addEventListener('DOMContentLoaded', () => { loadAndRender(); setInterval(refreshSidebarBadge, 60000); });
