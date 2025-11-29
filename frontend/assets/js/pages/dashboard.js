import { taskApi } from '../api/taskApi.js';
import { projectApi } from '../api/projectApi.js';
import { notificationApi } from '../api/notificationApi.js';
import { requireAuthRedirect } from '../utils/auth.js';

requireAuthRedirect();

// ================= Load Metrics =================
async function loadMetrics() {
  try {
    const [projects, notifications, tasksResp] = await Promise.all([
      projectApi.summary(),
      notificationApi.list(),
      taskApi.list('limit=100') // lấy tất cả tasks để tính toán
    ]);

    const tasks = tasksResp.data || [];

    // --- Tính các chỉ số dashboard ---
    const totalTasks = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const pending = tasks.filter(t => t.status === 'Pending').length;
    const overdue = tasks.filter(t => {
      const due = new Date(t.due_date?.date || t.created_at);
      return t.status !== 'Completed' && due < new Date();
    }).length;

    // --- Render metric cards ---
    document.getElementById('totalTasks').innerText = totalTasks;
    document.getElementById('totalCompleted').innerText = completed;
    document.getElementById('totalPending').innerText = pending;
    document.getElementById('totalOverdue').innerText = overdue;

    // --- Render recent tasks (top 5) ---
    renderRecentTasks(tasks.slice(0, 5));

  } catch (err) {
    console.error('Error loading dashboard metrics:', err);
  }
}

// ================= Render Recent Tasks =================
function renderRecentTasks(tasks) {
  const ul = document.getElementById('recentTasks');
  if (!ul) return;

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
      </div>
    `;
    li.addEventListener('click', () => {
      window.location.href = `/task-detail.html?id=${t.task_id}`;
    });
    ul.appendChild(li);
  });
}

// ================= Initialize =================
document.addEventListener('DOMContentLoaded', () => {
  // Load sidebar, header, modal dynamically
  import('../utils/componentLoader.js');

  // Load metrics & recent tasks
  loadMetrics();
});
