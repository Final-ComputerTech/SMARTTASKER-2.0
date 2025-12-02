import { taskApi } from '../api/taskApi.js';
import { requireAuthRedirect } from '../utils/auth.js';

requireAuthRedirect();

const state = { filters: {}, page: 1, perPage: 20, query: '' };

async function loadTasks() {
  try {
    const params = buildQueryParams();
    const res = await taskApi.list(params);
    // backend returns { total, page, pageSize, tasks: [...] }
    // some endpoints return { data: [...] } or raw array — normalize
    let tasks = [];
    if (Array.isArray(res)) tasks = res;
    else if (Array.isArray(res.tasks)) tasks = res.tasks;
    else if (Array.isArray(res.data)) tasks = res.data;
    else if (Array.isArray(res.tasks || res.data)) tasks = res.tasks || res.data;
    renderTaskList(tasks || []);
    renderCalendarEvents(tasks || []);
  } catch (e) {
    console.error('Error loading tasks', e);
  }
}

function buildQueryParams() {
  const parts = [];
  if (state.query) parts.push(`search=${encodeURIComponent(state.query)}`);
  if (state.filters.priority) parts.push(`priority=${state.filters.priority}`);
  if (state.filters.status) parts.push(`status=${state.filters.status}`);
  parts.push(`page=${state.page}&limit=${state.perPage}`);
  return parts.join('&');
}

// Map a priority name to a bootstrap color string for badge styling
function mapPriorityToColor(name) {
  if (!name) return 'secondary';
  const n = String(name).toLowerCase();
  if (n.includes('high') || n.includes('urgent') || n.includes('critical')) return 'danger';
  if (n.includes('medium') || n.includes('normal')) return 'warning';
  if (n.includes('low') || n.includes('minor')) return 'success';
  return 'secondary';
}

function renderTaskList(tasks) {
  const el = document.getElementById('taskList');
  if (!el) return; // page may not include a task list container
  el.innerHTML = '';
  tasks.forEach(t => {
    const item = document.createElement('div');
    item.className = 'task-item card mb-2 p-2';
    const priorityName = t.priority?.name || t.Priority?.label || t.Priority?.name || '';
    const projectName = t.project?.project_name || t.Project?.project_name || '';
    const dueRaw = t.DueDate?.due_date || t.due_date || (t.due_date && t.due_date.date) || t.createdAt || t.created_at;
    const dueStr = dueRaw ? new Date(dueRaw).toLocaleString() : '';
    item.innerHTML = `
      <div class="d-flex justify-content-between">
        <div>
          <span class="badge bg-${mapPriorityToColor(priorityName)}">${priorityName}</span>
          <a href="/task-detail.html?id=${t.task_id}"><strong>${t.title}</strong></a>
          <div><small>${projectName}</small></div>
        </div>
        <div>
          <small>${dueStr}</small>
        </div>
      </div>`;
    el.appendChild(item);
  });
  }

// minimal calendar renderer: mark days with dots
function renderCalendarEvents(tasks) {
  // Compact upcoming-7-days view (today + next 6 days)
  const mini = document.getElementById('miniCalendar');
  if (!mini) return;

  // Normalize tasks by YYYY-MM-DD
  const map = {};
  tasks.forEach(t => {
    const raw = t.DueDate?.due_date || t.due_date || (t.due_date && t.due_date.date) || t.createdAt || t.created_at;
    if (!raw) return;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return;
    const key = d.toISOString().slice(0,10);
    map[key] = map[key] || [];
    map[key].push(t);
  });

  const days = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    days.push(dt);
  }

  let html = '<div class="mini-calendar compact">';
  html += '<div class="d-flex justify-content-between align-items-center mb-2"><strong>Upcoming 7 days</strong></div>';
  html += '<div class="d-flex gap-2">';
  days.forEach((dt, idx) => {
    const key = dt.toISOString().slice(0,10);
    const tasksOn = map[key] || [];
    const isToday = idx === 0;
    const title = tasksOn.length ? tasksOn.map(t => t.title).join('\n') : 'No tasks';
    html += `<div class="calendar-day ${isToday ? 'today' : ''}" data-day="${key}" title="${escapeHtml(title)}" style="flex:1;min-width:0;">`;
    html += `<div class="day-label">${dt.toLocaleString(undefined,{ weekday: 'short' })}</div>`;
    html += `<div class="day-num">${dt.getDate()}</div>`;
    if (tasksOn.length) html += `<div class="day-badge"><span class="badge bg-primary">${tasksOn.length}</span></div>`;
    html += `</div>`;
  });
  html += '</div></div>';
  mini.innerHTML = html;

  // Attach click handlers
  mini.querySelectorAll('.calendar-day').forEach(el => {
    el.addEventListener('click', () => {
      const day = el.getAttribute('data-day');
      showTasksForDate(day, map[day] || []);
    });
  });
}

// small helper for tooltip-safe content
function escapeHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showTasksForDate(dateStr, tasksForDay) {
  // Render only tasks for the selected date
  const el = document.getElementById('taskList');
  if (!el) return;
  el.innerHTML = `<div class="mb-2"><strong>Tasks for ${new Date(dateStr).toLocaleDateString()}</strong></div>`;
  if (!tasksForDay || tasksForDay.length === 0) { el.innerHTML += '<div>No tasks for this day</div>'; return; }
  tasksForDay.forEach(t => {
    const item = document.createElement('div');
    item.className = 'task-item card mb-2 p-2';
    const priorityName = t.priority?.name || t.Priority?.label || t.Priority?.name || '';
    const projectName = t.project?.project_name || t.Project?.project_name || '';
    const dueRaw = t.DueDate?.due_date || t.due_date || (t.due_date && t.due_date.date) || t.createdAt || t.created_at;
    const dueStr = dueRaw ? new Date(dueRaw).toLocaleString() : '';
    item.innerHTML = `
      <div class="d-flex justify-content-between">
        <div>
          <span class="badge bg-${mapPriorityToColor(priorityName)}">${priorityName}</span>
          <a href="/task-detail.html?id=${t.task_id}"><strong>${t.title}</strong></a>
          <div><small>${projectName}</small></div>
        </div>
        <div>
          <small>${dueStr}</small>
        </div>
      </div>`;
    el.appendChild(item);
  });
}
// Attach search listener only if the input exists

// Attach search listener only if the input exists
const _searchEl = typeof document !== 'undefined' ? document.getElementById('searchInput') : null;
if (_searchEl) {
  _searchEl.addEventListener('input', (e) => {
    state.query = e.target.value;
    loadTasks();
  });
}

document.addEventListener('DOMContentLoaded', loadTasks);

// Reload tasks when a new task is created via the modal
document.addEventListener('task:created', () => {
  loadTasks();
});
