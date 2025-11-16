import { taskApi } from '../api/taskApi.js';
import { requireAuthRedirect } from '../utils/auth.js';

requireAuthRedirect();

const state = { filters: {}, page: 1, perPage: 20, query: '' };

async function loadTasks() {
  const params = buildQueryParams();
  const res = await taskApi.list(params);
  renderTaskList(res.data || []);
  renderCalendarEvents(res.data || []);
}

function buildQueryParams() {
  const parts = [];
  if (state.query) parts.push(`search=${encodeURIComponent(state.query)}`);
  if (state.filters.priority) parts.push(`priority=${state.filters.priority}`);
  if (state.filters.status) parts.push(`status=${state.filters.status}`);
  parts.push(`page=${state.page}&limit=${state.perPage}`);
  return parts.join('&');
}

function renderTaskList(tasks) {
  const el = document.getElementById('taskList');
  el.innerHTML = '';
  tasks.forEach(t => {
    const item = document.createElement('div');
    item.className = 'task-item card mb-2 p-2';
    item.innerHTML = `
      <div class="d-flex justify-content-between">
        <div>
          <span class="badge bg-${mapPriorityToColor(t.priority?.name)}">${t.priority?.name}</span>
          <a href="/task-detail.html?id=${t.task_id}"><strong>${t.title}</strong></a>
          <div><small>${t.project?.project_name}</small></div>
        </div>
        <div>
          <small>${new Date(t.due_date?.date || t.created_at).toLocaleString()}</small>
        </div>
      </div>`;
    el.appendChild(item);
  });
}

// minimal calendar renderer: mark days with dots
function renderCalendarEvents(tasks) {
  // Build map: date -> tasks
  const map = {};
  tasks.forEach(t => {
    const d = t.due_date?.date || t.created_at?.split('T')[0];
    if (!d) return;
    map[d] = map[d] || [];
    map[d].push(t);
  });
  // Render calendar grid (or call a small calendar lib)
  // For brevity, assume you have an element #miniCalendar and render clickable days.
}

document.getElementById('searchInput').addEventListener('input', (e) => {
  state.query = e.target.value;
  loadTasks();
});

document.addEventListener('DOMContentLoaded', loadTasks);
