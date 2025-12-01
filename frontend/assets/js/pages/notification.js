import { notificationApi } from '../api/notificationApi.js';
import { requireAuthRedirect } from '../utils/auth.js';

requireAuthRedirect();

async function loadNotifications() {
  const res = await notificationApi.list();
  renderNotifications(res.data || []);
}

function renderNotifications(list) {
  const el = document.getElementById('notificationList');
  el.innerHTML = '';
  list.forEach(n => {
    const row = document.createElement('li');
    row.className = `list-group-item ${n.read ? '' : 'bg-light fw-bold'}`;
    row.innerHTML = `
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <div>${n.title}</div>
          <small>${n.description || ''}</small>
        </div>
        <div><small>${timeAgo(n.created_at)}</small></div>
      </div>
    `;
    row.addEventListener('click', async () => {
      if (!n.read) await notificationApi.markRead(n.notification_id);
      window.location.href = `/task-detail.html?id=${n.task_id}`;
    });
    el.appendChild(row);
  });
}

// Mark all as read
document.getElementById('markAllReadBtn')?.addEventListener('click', async () => {
  await notificationApi.markAllRead();
  loadNotifications();
});

// helper: format time ago
function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

document.addEventListener('DOMContentLoaded', loadNotifications);
