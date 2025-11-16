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
    const row = document.createElement('div');
    row.className = `notification-item p-3 ${n.read ? '' : 'bg-light'}`;
    row.innerHTML = `
      <div class="d-flex justify-content-between">
        <div>
          <div><strong>${n.title}</strong></div>
          <div><small>${n.description}</small></div>
        </div>
        <div><small>${timeAgo(n.created_at)}</small></div>
      </div>`;
    row.addEventListener('click', async () => {
      if (!n.read) await notificationApi.markRead(n.notification_id);
      window.location.href = `/task-detail.html?id=${n.task_id}`;
    });
    el.appendChild(row);
  });
}

document.addEventListener('DOMContentLoaded', loadNotifications);
