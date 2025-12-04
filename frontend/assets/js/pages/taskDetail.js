import { taskApi } from '../api/taskApi.js';
import { authProfileApi } from '../api/authApi.js';
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
    // If association objects are missing, try to enrich from meta endpoints
    try {
      if ((!task.Priority || Object.keys(task.Priority).length === 0) && task.priority_id) {
        const pr = await apiRequest('meta/priorities', 'GET');
        const priorities = Array.isArray(pr) ? pr : (pr.data || pr || []);
        const found = priorities.find(p => p.priority_id === task.priority_id);
        if (found) task.Priority = found;
      }
      if ((!task.Status || Object.keys(task.Status).length === 0) && task.status_id) {
        const st = await apiRequest('meta/statuses', 'GET');
        const statuses = Array.isArray(st) ? st : (st.data || st || []);
        const foundS = statuses.find(s => s.status_id === task.status_id);
        if (foundS) task.Status = foundS;
      }
      if ((!task.Project || Object.keys(task.Project).length === 0) && task.project_id) {
        const prj = await apiRequest('projects', 'GET');
        const projects = Array.isArray(prj) ? prj : (prj.data || prj || []);
        const foundP = projects.find(p => p.project_id === task.project_id);
        if (foundP) task.Project = foundP;
      }
    } catch (e) { console.warn('Could not enrich task metadata', e); }

    renderTask(task);
    // determine current user's permissions so we can hide/disable controls
    try {
      // Try to fetch profile info, but prefer server-provided `current_user` when available
      let me = null;
      try { me = await authProfileApi.me(); } catch (e) { /* ignore profile errors */ }
      const reqUserIdFromProfile = me && me.user_id ? String(me.user_id) : null;
      const isAdminFromProfile = me && me.role && String(me.role) === 'admin';
      let canEdit = false; // upload files, add subtasks, edit
      if (isAdminFromProfile) canEdit = true;
      if (task.user_id && reqUserIdFromProfile && String(task.user_id) === reqUserIdFromProfile) canEdit = true;
      if (!canEdit && task.project_id) {
        try {
          const proj = await apiRequest(`projects/${task.project_id}`, 'GET', null, true);
          // project endpoint returns { project, tasks, members, current_user }
          const project = proj && proj.project ? proj.project : proj;
          // prefer `current_user` returned by server for permission checks
          const serverUser = proj && proj.current_user ? proj.current_user : null;
          const reqUserId = serverUser && serverUser.user_id ? String(serverUser.user_id) : reqUserIdFromProfile;
          const isAdmin = serverUser && serverUser.role ? String(serverUser.role) === 'admin' : isAdminFromProfile;
          // if current user is owner, allow edit
          if (project && project.owner_id && reqUserId && String(project.owner_id) === reqUserId) canEdit = true;
          const members = proj && proj.members ? proj.members : [];
          if (!canEdit && Array.isArray(members) && members.find(m => reqUserId && String(m.user_id) === reqUserId && (m.user_permission === 'manager' || m.user_permission === 'owner' || m.user_permission === 'admin'))) canEdit = true;
          // also allow if server indicates admin
          if (!canEdit && isAdmin) canEdit = true;
        } catch (e) { /* ignore project fetch errors */ }
      }
      // toggle attachment upload control
      const attachInput = document.getElementById('attachmentInput');
      const attachBtn = document.getElementById('uploadAttachmentsBtn');
      if (attachInput) attachInput.disabled = !canEdit;
      if (attachBtn) attachBtn.disabled = !canEdit;
      // toggle subtask add control
      const subInput = document.getElementById('subtaskInput');
      const subBtn = document.getElementById('addSubtaskBtn');
      if (subInput) subInput.disabled = !canEdit;
      if (subBtn) subBtn.disabled = !canEdit;
      // visually hide the controls for clarity when no permission
      if (!canEdit) {
        if (attachInput && attachInput.parentElement) attachInput.parentElement.style.opacity = '0.6';
        if (subInput && subInput.parentElement) subInput.parentElement.style.opacity = '0.6';
      } else {
        if (attachInput && attachInput.parentElement) attachInput.parentElement.style.opacity = '';
        if (subInput && subInput.parentElement) subInput.parentElement.style.opacity = '';
      }
    } catch (e) { console.warn('Could not determine user permissions', e); }

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
  const btn = document.getElementById('refreshChangesBtn');
  if (btn) { btn.disabled = true; const prev = btn.innerText; btn.innerText = 'Loading...'; }
  try {
    const res = await apiRequest(`tasks/${taskId}/changes?_=${Date.now()}`, 'GET');
    console.log('loadChanges response for', taskId, res);
    renderChanges(res.data || []);
    // show last-updated timestamp
    const stamp = document.getElementById('changesLastUpdated') || (() => { const s = document.createElement('div'); s.id = 'changesLastUpdated'; s.className = 'small text-muted mt-1'; const container = document.getElementById('activityLog'); if (container && container.parentElement) container.parentElement.insertBefore(s, container.nextSibling); return s; })();
    if (stamp) stamp.innerText = 'Last updated: ' + new Date().toLocaleTimeString();
  } catch (e) {
    console.error('Could not load changes', e);
    const el = document.getElementById('activityLog'); if (el) el.innerText = 'Could not load activity: ' + (e.message || e);
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = 'Refresh'; }
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

// Listen for assignment changes happening elsewhere (Project Detail page)
document.addEventListener('task:assignment-changed', (ev) => {
  try {
    const detail = ev && ev.detail ? ev.detail : null;
    if (!detail) return;
    const currentId = getParam('id');
    if (String(currentId) === String(detail.taskId)) {
      // reload task to reflect new assignment
      loadTask();
    }
  } catch (e) { console.warn('Error handling task:assignment-changed', e); }
});

// Cross-tab synchronization: listen for storage events when assignment changes occur in other tabs
window.addEventListener('storage', (ev) => {
  try {
    if (!ev.key || ev.key !== 'task:assign') return;
    const payload = ev.newValue ? JSON.parse(ev.newValue) : null;
    if (!payload) return;
    const currentId = getParam('id');
    if (String(currentId) === String(payload.taskId)) {
      loadTask();
    }
  } catch (e) { console.warn('Error handling storage task:assign', e); }
});

// ---------------- Conversations (comments) ----------------
let _commentsPoll = null;
async function loadComments(taskId) {
  const btn = document.getElementById('refreshCommentsBtn');
  if (btn) { btn.disabled = true; const prev = btn.innerText; btn.innerText = 'Loading...'; }
  try {
    const json = await apiRequest(`tasks/${taskId}/conversations?_=${Date.now()}`, 'GET');
    console.log('loadComments response for', taskId, json);
    renderComments(json.data || json || []);
    const stamp = document.getElementById('commentsLastUpdated') || (() => { const s = document.createElement('div'); s.id = 'commentsLastUpdated'; s.className = 'small text-muted mt-1'; const container = document.getElementById('commentsList'); if (container && container.parentElement) container.parentElement.insertBefore(s, container.nextSibling); return s; })();
    if (stamp) stamp.innerText = 'Last updated: ' + new Date().toLocaleTimeString();
    // start polling
    if (_commentsPoll) clearInterval(_commentsPoll);
    _commentsPoll = setInterval(() => loadComments(taskId), 8000);
  } catch (e) {
    console.error('Could not load comments', e);
    const el = document.getElementById('commentsList'); if (el) el.innerText = 'Could not load comments: ' + (e.message || e);
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = 'Refresh'; }
  }
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
  try {
    const t = await taskApi.get(id);
    const currentTitle = t.title || document.getElementById('taskTitle')?.innerText || '';
    const newTitle = prompt('Edit title:', currentTitle);
    if (newTitle === null) return;

    // Fetch selectable options
    const projects = await apiRequest('projects', 'GET');
    const priorities = await apiRequest('meta/priorities', 'GET');
    const statuses = await apiRequest('meta/statuses', 'GET');

    // helper to build selection prompt
    const buildPrompt = (label, list, idKey, nameKey, currentId) => {
      let text = `${label}:\n`;
      text += `0) Leave unchanged\n`;
      list.forEach((it, idx) => { const n = it[nameKey] || it.label || it.project_name || it.name || `item${idx+1}`; text += `${idx+1}) ${n} (id: ${it[idKey]})\n`; });
      text += `\nEnter the number to select (or 0 to keep current).`;
      return { text, list };
    };

    const pPrompt = buildPrompt('Project', projects || [], 'project_id', 'project_name', t.project_id);
    const prPrompt = buildPrompt('Priority', priorities || [], 'priority_id', 'label', t.priority_id);
    const sPrompt = buildPrompt('Status', statuses || [], 'status_id', 'label', t.status_id);

    const pChoice = prompt(pPrompt.text, '0');
    if (pChoice === null) return;
    const prChoice = prompt(prPrompt.text, '0');
    if (prChoice === null) return;
    const sChoice = prompt(sPrompt.text, '0');
    if (sChoice === null) return;

    const updates = {};
    if (newTitle !== currentTitle) updates.title = newTitle;
    const pIdx = parseInt(pChoice, 10); if (!isNaN(pIdx) && pIdx > 0 && projects && projects[pIdx-1]) updates.project_id = projects[pIdx-1].project_id;
    const prIdx = parseInt(prChoice, 10); if (!isNaN(prIdx) && prIdx > 0 && priorities && priorities[prIdx-1]) updates.priority_id = priorities[prIdx-1].priority_id;
    const sIdx = parseInt(sChoice, 10); if (!isNaN(sIdx) && sIdx > 0 && statuses && statuses[sIdx-1]) updates.status_id = statuses[sIdx-1].status_id;

    if (Object.keys(updates).length === 0) { alert('No changes made'); return; }
    await taskApi.update(id, updates);
    alert('Updated'); loadTask();
  } catch (e) { alert('Update failed: ' + (e.message || e)); }
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
