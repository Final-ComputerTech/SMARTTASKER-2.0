import { taskApi } from '../api/taskApi.js';
import { requireAuthRedirect } from '../utils/auth.js';

requireAuthRedirect();

function getParam(name) {
  const url = new URL(location.href);
  return url.searchParams.get(name);
}

async function loadTask() {
  const id = getParam('id');
  if (!id) return window.location.href = '/task-schedule.html';
  try {
    const task = await taskApi.get(id);
    renderTask(task);
    await loadChanges(id);
  } catch (e) {
    console.error('Could not load task', e);
    document.getElementById('taskTitle').innerText = 'Error loading task';
  }
}

function renderTask(t) {
  document.getElementById('taskTitle').innerText = t.title || 'Untitled';
  document.getElementById('taskDescription').innerText = t.description || '';

  const meta = document.getElementById('taskMeta');
  if (meta) meta.innerHTML = `
    <div><strong>Project:</strong> ${t.Project?.project_name || t.project?.project_name || '—'}</div>
    <div><strong>Assigned to:</strong> ${t.User?.name || t.user?.name || '—'}</div>
  `;

  const side = document.getElementById('taskSideMeta');
  if (side) side.innerHTML = `
    <div><strong>Priority:</strong> ${t.Priority?.label || t.priority?.label || t.priority?.name || '—'}</div>
    <div><strong>Status:</strong> ${t.Status?.label || t.status?.label || t.status?.name || '—'}</div>
    <div><strong>Due:</strong> ${t.DueDate?.due_date || t.due_date ? new Date(t.DueDate?.due_date || t.due_date).toLocaleString() : '—'}</div>
    <div><strong>Created:</strong> ${t.createdAt ? new Date(t.createdAt).toLocaleString() : ''}</div>
  `;
}

async function loadChanges(taskId) {
  try {
    const res = await taskApi.changes(taskId);
    renderChanges(res.data || []);
  } catch (e) {
    console.warn('Could not load changes', e);
    const el = document.getElementById('activityLog'); if (el) el.innerText = 'No activity available';
  }
}

function renderChanges(list) {
  const el = document.getElementById('activityLog');
  if (!el) return;
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
