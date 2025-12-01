import { taskApi } from '../api/taskApi.js';
import { requireAuthRedirect } from '../utils/auth.js';

requireAuthRedirect();

function getParam(name) {
  const url = new URL(location.href);
  return url.searchParams.get(name);
}

async function loadTask() {
  const id = getParam('id');
  if (!id) return document.getElementById('taskTitle').innerText = 'Task not found';
  try {
    const task = await taskApi.get(id);
    renderTask(task);
    loadChanges(id);
  } catch (e) {
    console.error('Could not load task', e);
    document.getElementById('taskTitle').innerText = 'Error loading task';
  }
}

function renderTask(t) {
  document.getElementById('taskTitle').innerText = t.title || 'Untitled';
  document.getElementById('taskDescription').innerText = t.description || '';

  const meta = document.getElementById('taskMeta');
  meta.innerHTML = `
    <div><strong>Project:</strong> ${t.project?.project_name || '—'}</div>
    <div><strong>Assigned to:</strong> ${t.user?.name || '—'}</div>
  `;

  const side = document.getElementById('taskSideMeta');
  side.innerHTML = `
    <div><strong>Priority:</strong> ${t.priority?.label || t.priority?.name || '—'}</div>
    <div><strong>Status:</strong> ${t.status?.label || t.status?.name || '—'}</div>
    <div><strong>Due:</strong> ${t.due_date?.date ? new Date(t.due_date.date).toLocaleString() : '—'}</div>
    <div><strong>Created:</strong> ${new Date(t.createdAt).toLocaleString()}</div>
  `;
}

async function loadChanges(taskId) {
  try {
    const res = await taskApi.changes(taskId);
    renderChanges(res.data || []);
  } catch (e) {
    console.warn('Could not load changes', e);
    document.getElementById('activityLog').innerText = 'No activity available';
  }
}

function renderChanges(list) {
  const el = document.getElementById('activityLog');
  el.innerHTML = '';
  if (!list || list.length === 0) { el.innerText = 'No recent changes'; return; }
  list.forEach(c => {
    const d = document.createElement('div');
    d.className = 'mb-2';
    d.innerHTML = `<div><strong>${c.field}</strong> — ${c.user_id}</div><small>${c.old_value || ''} → ${c.new_value || ''} • ${new Date(c.createdAt).toLocaleString()}</small>`;
    el.appendChild(d);
  });
}

document.getElementById('refreshChangesBtn')?.addEventListener('click', () => {
  const id = getParam('id'); if (id) loadChanges(id);
});

document.addEventListener('DOMContentLoaded', loadTask);
import { taskApi } from '../api/taskApi.js';
import { requireAuthRedirect } from '../utils/auth.js';

requireAuthRedirect();

async function loadTask() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) return window.location.href = '/task-schedule.html';
  const res = await taskApi.get(id);
  renderTaskDetail(res);
  // load conversation via taskApi or conversation endpoint (if separate)
}

function renderTaskDetail(t) {
  document.getElementById('taskTitle').innerText = t.title;
  document.getElementById('taskDesc').innerHTML = t.description || '';
  document.getElementById('taskPriority').innerText = t.priority?.name || '';
  // attachments, collaborators render...
}

// comment submit
document.getElementById('commentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const val = e.target.comment.value.trim();
  if (!val) return;
  await taskApi.postComment(taskId, { message: val }); // implement endpoint with backend
  // append to UI
});

document.addEventListener('DOMContentLoaded', loadTask);
