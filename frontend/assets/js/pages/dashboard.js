import { taskApi } from '../api/taskApi.js';
import { projectApi } from '../api/projectApi.js';
import { notificationApi } from '../api/notificationApi.js';
import { requireAuthRedirect } from '../utils/auth.js';

requireAuthRedirect();

async function loadMetrics() {
  try {
    const [projects, notifications, recentTasks] = await Promise.all([
      projectApi.summary(),
      notificationApi.list(),
      taskApi.list('limit=5&sort=created_at_desc')
    ]);
    document.getElementById('totalProjects').innerText = projects.total || 0;
    document.getElementById('totalNotifications').innerText = notifications.unreadCount || 0;
    renderRecentTasks(recentTasks.data || []);
  } catch (err) { console.error(err); }
}

function renderRecentTasks(tasks) {
  const ul = document.getElementById('recentTasks');
  ul.innerHTML = '';
  tasks.forEach(t => {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-start';
    li.innerHTML = `
      <div>
        <div><strong>${t.title}</strong></div>
        <small>${t.project?.project_name || '—'} • ${t.priority?.name || ''}</small>
      </div>
      <div>
        <small>${new Date(t.due_date?.date || t.created_at).toLocaleDateString()}</small>
      </div>`;
    li.addEventListener('click', () => window.location.href = `/task-detail.html?id=${t.task_id}`);
    ul.appendChild(li);
  });
}

document.addEventListener('DOMContentLoaded', loadMetrics);
