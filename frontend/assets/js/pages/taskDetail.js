import { taskApi } from '../api/taskApi.js';
import { requireAuthRedirect } from '../utils/auth.js';
import { apiRequest, apiUpload } from '../utils/request.js';

requireAuthRedirect();

function getParam(name) {
  const url = new URL(location.href);
  return url.searchParams.get(name);
}

// small helper for escaping HTML in user-generated content
function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadTask() {
  const id = getParam('id');
  if (!id) return window.location.href = '/task-schedule.html';
  try {
    const task = await taskApi.get(id);
    renderTask(task);
    await loadChanges(id);
    await loadComments(id);
    await loadReminders(id);
    await loadAttachments(id);
    renderSubtasksFromStore(id);
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

// ---------------- Conversations (comments) ----------------
let _commentsPoll = null;
async function loadComments(taskId) {
  try {
    const json = await apiRequest(`tasks/${taskId}/conversations`, 'GET');
    renderComments(json.data || json || []);
    // start polling
    if (_commentsPoll) clearInterval(_commentsPoll);
    _commentsPoll = setInterval(() => loadComments(taskId), 8000);
  } catch (e) { console.warn('Could not load comments', e); }
}

function renderComments(list) {
  const el = document.getElementById('commentsList');
  if (!el) return;
  el.innerHTML = '';
  if (!list || list.length === 0) { el.innerText = 'No comments yet'; return; }
  list.forEach(c => {
    const div = document.createElement('div');
    div.className = 'mb-2';
    const author = c.User?.name || c.user_id || 'Unknown';
    const time = new Date(c.createdAt).toLocaleString();
    div.innerHTML = `<div class="d-flex justify-content-between"><div><strong>${escapeHtml(author)}</strong> <small class="text-muted">${time}</small></div>${(c.user_id === (JSON.parse(localStorage.getItem('st_user')||'{}').user_id) ? `<div><button class="btn btn-sm btn-link text-danger delete-comment-btn" data-id="${c.conversation_id}">Delete</button></div>` : '')}</div><div class="mt-1">${escapeHtml(c.message)}</div>`;
    el.appendChild(div);
  });
  // attach delete handlers
  el.querySelectorAll('.delete-comment-btn').forEach(b => {
    b.addEventListener('click', async () => {
      const id = b.getAttribute('data-id');
      if (!confirm('Delete this comment?')) return;
      try {
        await apiRequest(`tasks/conversations/${id}`, 'DELETE');
        loadComments(getParam('id'));
      } catch (e) { console.warn('Could not delete comment', e); }
    });
  });
}

document.getElementById('postCommentBtn')?.addEventListener('click', async () => {
  const id = getParam('id'); if (!id) return;
  const txt = document.getElementById('commentInput')?.value || '';
  if (!txt.trim()) return alert('Enter a comment');
  try {
    await apiRequest(`tasks/${id}/conversations`, 'POST', { message: txt });
    document.getElementById('commentInput').value = '';
    loadComments(id);
  } catch (e) { alert('Could not post comment: ' + (e.message || e)); }
});

document.getElementById('refreshCommentsBtn')?.addEventListener('click', () => { const id = getParam('id'); if (id) loadComments(id); });

// ---------------- Subtasks (client-side store) ----------------
function subtasksKey(taskId) { return `subtasks:${taskId}`; }
function renderSubtasksFromStore(taskId) {
  const key = subtasksKey(taskId);
  const raw = localStorage.getItem(key);
  const list = raw ? JSON.parse(raw) : [];
  const el = document.getElementById('subtaskList'); if (!el) return;
  el.innerHTML = '';
  if (list.length === 0) { el.innerText = 'No subtasks'; return; }
  let comp = 0;
  list.forEach((s, idx) => {
    const div = document.createElement('div'); div.className = 'd-flex justify-content-between align-items-center mb-1';
    const left = document.createElement('div'); left.innerHTML = `<input type="checkbox" data-idx="${idx}" class="subtask-cb me-2" ${s.done ? 'checked' : ''}/> ${escapeHtml(s.text)}`;
    div.appendChild(left);
    const rm = document.createElement('button'); rm.className = 'btn btn-sm btn-link text-danger'; rm.textContent = 'Delete'; rm.addEventListener('click', () => { list.splice(idx,1); localStorage.setItem(key, JSON.stringify(list)); renderSubtasksFromStore(taskId); });
    div.appendChild(rm);
    el.appendChild(div);
    if (s.done) comp++;
  });
  const pct = Math.round((comp / Math.max(1, list.length)) * 100);
  const progressEl = document.getElementById('subtasksProgress');
  if (progressEl) progressEl.textContent = `${pct}%`; else { const p = document.createElement('div'); p.id = 'subtasksProgress'; p.className = 'small text-muted mt-1'; p.textContent = `${pct}%`; document.getElementById('subtasksArea')?.appendChild(p); }
  // attach checkbox handlers
  document.querySelectorAll('.subtask-cb').forEach(cb => { cb.addEventListener('change', (e) => { const idx = parseInt(e.target.getAttribute('data-idx'),10); list[idx].done = e.target.checked; localStorage.setItem(key, JSON.stringify(list)); renderSubtasksFromStore(taskId); }); });
}

document.getElementById('addSubtaskBtn')?.addEventListener('click', () => {
  const id = getParam('id'); if (!id) return;
  const input = document.getElementById('subtaskInput'); if (!input) return;
  const text = input.value.trim(); if (!text) return;
  const key = subtasksKey(id); const list = JSON.parse(localStorage.getItem(key) || '[]'); list.push({ text, done: false, createdAt: new Date().toISOString() }); localStorage.setItem(key, JSON.stringify(list)); input.value = ''; renderSubtasksFromStore(id);
});

// ---------------- Reminders ----------------
async function loadReminders(taskId) {
  try {
    const json = await apiRequest(`tasks/${taskId}/reminders`, 'GET');
    renderReminders(json.data || json || []);
  } catch (e) { console.warn('Could not load reminders', e); }
}

function renderReminders(list) {
  const el = document.getElementById('taskSideMeta');
  if (!el) return;
  const rEl = document.getElementById('remindersList');
  if (!rEl) {
    const wrapper = document.createElement('div'); wrapper.id = 'remindersList'; wrapper.className = 'mt-2 small text-muted'; el.appendChild(wrapper);
  }
  const wrapper = document.getElementById('remindersList'); wrapper.innerHTML = '';
  if (!list || list.length === 0) { wrapper.innerText = 'No reminders'; return; }
  list.forEach(r => { const d = document.createElement('div'); d.className='mb-1'; d.innerHTML = `${new Date(r.reminder_at).toLocaleString()} <button class="btn btn-sm btn-link text-danger ms-2 delete-reminder" data-id="${r.reminder_id}">Delete</button>`; wrapper.appendChild(d); });
  // attach delete handlers
  wrapper.querySelectorAll('.delete-reminder').forEach(b => { b.addEventListener('click', async () => { const rid = b.getAttribute('data-id'); if (!confirm('Delete reminder?')) return; try { await apiRequest(`tasks/reminders/${rid}`, 'DELETE'); loadReminders(getParam('id')); } catch (e) { console.warn('Could not delete reminder', e); } }); });
}

// Add reminder UI action (simple)
async function addReminderForTask(taskId, datetime) {
  try {
    await apiRequest(`tasks/${taskId}/reminders`, 'POST', { reminder_at: datetime });
    loadReminders(taskId);
  } catch (e) { alert('Could not add reminder: ' + (e.message || e)); }
}

// ---------------- Attachments (client-only preview fallback) ----------------
document.getElementById('uploadAttachmentsBtn')?.addEventListener('click', async () => {
  const input = document.getElementById('attachmentInput'); if (!input || !input.files || input.files.length === 0) return alert('Select files first');
  const id = getParam('id'); if (!id) return alert('Missing task id');
  const form = new FormData();
  for (const f of Array.from(input.files)) form.append('attachments', f);
  try {
    await apiUpload(`tasks/${id}/attachments`, form);
    input.value = '';
    await loadAttachments(id);
  } catch (e) { alert('Could not upload attachments: ' + (e.message || e)); }
});

async function loadAttachments(taskId) {
  try {
    const json = await apiRequest(`tasks/${taskId}/attachments`, 'GET');
    const list = json.data || json || [];
    renderAttachments(list);
  } catch (e) { console.warn('Could not load attachments', e); }
}

function renderAttachments(list) {
  const el = document.getElementById('attachmentsList'); if (!el) return;
  el.innerHTML = '';
  if (!list || list.length === 0) { el.innerText = 'No attachments'; return; }
  list.forEach(a => {
    const d = document.createElement('div'); d.className = 'mb-2';
    const href = a.filepath || a.file_path || a.path || '#';
    d.innerHTML = `<div><strong>${escapeHtml(a.filename)}</strong> <small class="text-muted">${a.size ? Math.round(a.size/1024) + ' KB' : ''}</small> <a href="${href}" target="_blank" class="ms-2">View</a> <button class="btn btn-sm btn-link text-danger ms-2 delete-attachment" data-id="${a.attachment_id}">Delete</button></div>`;
    el.appendChild(d);
  });
  el.querySelectorAll('.delete-attachment').forEach(b => { b.addEventListener('click', async () => { const aid = b.getAttribute('data-id'); if (!confirm('Delete attachment?')) return; try { await apiRequest(`tasks/attachments/${aid}`, 'DELETE'); loadAttachments(getParam('id')); } catch (e) { console.warn('Could not delete attachment', e); } }); });
}

// ---------------- Main actions: Edit/Complete/Duplicate/Delete ----------------
document.getElementById('deleteTaskBtn')?.addEventListener('click', async () => {
  const id = getParam('id'); if (!id) return;
  if (!confirm('Delete this task?')) return;
  try { await taskApi.delete(id); alert('Deleted'); window.location.href = '/task-schedule.html'; } catch (e) { alert('Delete failed: ' + (e.message || e)); }
});

document.getElementById('duplicateTaskBtn')?.addEventListener('click', async () => {
  const id = getParam('id'); if (!id) return;
  try {
    const t = await taskApi.get(id);
    const payload = { title: `Copy of ${t.title}`, description: t.description, project_id: t.project_id || t.Project?.project_id, priority_id: t.priority_id || t.Priority?.priority_id, status_id: t.status_id || t.Status?.status_id, due_date: t.DueDate?.due_date || null };
    const created = await taskApi.create(payload);
    alert('Task duplicated');
    window.location.href = `/task-detail.html?id=${created.task_id || created.taskId || created.id}`;
  } catch (e) { alert('Duplicate failed: ' + (e.message || e)); }
});

document.getElementById('editTaskBtn')?.addEventListener('click', async () => {
  const id = getParam('id'); if (!id) return;
  const newTitle = prompt('Edit title:', document.getElementById('taskTitle')?.innerText || '');
  if (newTitle === null) return;
  try { await taskApi.update(id, { title: newTitle }); alert('Updated'); loadTask(); } catch (e) { alert('Update failed: ' + (e.message || e)); }
});

document.getElementById('completeTaskBtn')?.addEventListener('click', async () => {
  const id = getParam('id'); if (!id) return;
  // try to find a status labelled done/completed via meta endpoint
  try {
    const statuses = await apiRequest('meta/statuses', 'GET');
    const statusList = Array.isArray(statuses) ? statuses : (statuses.data || statuses || []);
    const done = (statusList || []).find(s => (s.label || s.name || '').toLowerCase().includes('done') || (s.label || s.name || '').toLowerCase().includes('completed'));
    if (done) {
      await taskApi.update(id, { status_id: done.status_id });
      alert('Marked completed'); loadTask();
    } else {
      // If no explicit "Done" status exists, show available statuses for the user to pick
      const opts = (statusList || []).map(s => `${s.label} (id: ${s.status_id})`).join('\n');
      const msg = `Could not find a \"Done\" status. Available statuses:\n${opts}\n\nEnter the status id to set, or Cancel to abort.`;
      const custom = prompt(msg);
      if (!custom) return;
      try { await taskApi.update(id, { status_id: custom }); alert('Updated'); loadTask(); } catch (e) { alert('Update failed: ' + (e.message || e)); }
    }
  } catch (e) { alert('Could not mark complete: ' + (e.message || e)); }
});
