import { apiRequest } from '../utils/request.js';

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleString();
}

async function loadProject() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    document.getElementById('projTitle').innerText = 'Project not found';
    return;
  }
  try {
    const res = await apiRequest(`projects/${id}`, 'GET', null, true);
    const project = res.project || res;
    const tasks = res.tasks || [];
    const members = res.members || [];
    document.getElementById('projTitle').innerText = project.project_name || 'Project';
      document.getElementById('projMeta').innerHTML = `<div><strong>ID:</strong> ${project.project_id}</div><div>${project.description || ''}</div>`;

      // small UI: add task form
      const tasksHeader = document.createElement('div');
      tasksHeader.className = 'mb-2 d-flex gap-2';
      tasksHeader.innerHTML = `<input id="newProjTaskTitle" class="form-control form-control-sm" placeholder="New task title" /><button id="addProjTaskBtn" class="btn btn-sm btn-primary">Add Task</button>`;
      const tasksContainer = document.getElementById('projTasks');
      if (tasksContainer) tasksContainer.parentNode.insertBefore(tasksHeader, tasksContainer);

      // add member form
      const memContainer = document.getElementById('projMembers');
      const memForm = document.createElement('div');
      memForm.className = 'mb-2';
      memForm.innerHTML = `<div class="input-group input-group-sm"><input id="newMemberEmail" class="form-control" placeholder="Member email" /><button id="addMemberBtn" class="btn btn-outline-primary">Add</button></div>`;
      if (memContainer) memContainer.parentNode.insertBefore(memForm, memContainer);
      // wire add task button
      document.getElementById('addProjTaskBtn')?.addEventListener('click', async () => {
        const title = document.getElementById('newProjTaskTitle')?.value?.trim();
        if (!title) return alert('Enter a task title');
        try {
          await (await import('../api/taskApi.js')).taskApi.create({ title, project_id: project.project_id });
          document.getElementById('newProjTaskTitle').value = '';
          loadProject();
        } catch (e) { alert('Failed to create task: ' + (e.message || e)); }
      });

      // wire add member button
      document.getElementById('addMemberBtn')?.addEventListener('click', async () => {
        const email = document.getElementById('newMemberEmail')?.value?.trim();
        if (!email) return alert('Enter member email');
        try {
          const res = await (await import('../api/projectApi.js')).projectApi.addCollaborator(project.project_id, { email });
          document.getElementById('newMemberEmail').value = '';
          loadProject();
        } catch (e) { alert('Failed to add member: ' + (e.message || e)); }
      });

    const tasksEl = document.getElementById('projTasks');
    if (!tasks || tasks.length === 0) tasksEl.innerHTML = '<div>No tasks</div>'; else {
      const tbl = document.createElement('table'); tbl.className = 'table table-sm';
      tbl.innerHTML = '<thead><tr><th>Title</th><th>Due</th><th>Status</th><th>Priority</th></tr></thead>';
      const tbody = document.createElement('tbody');
      tasks.forEach(t => {
        const due = (t.DueDate && t.DueDate.due_date) || t.due_date || t.createdAt || t.created_at;
        const status = (t.Status && (t.Status.label || t.Status.name)) || (t.status && (t.status.label || t.status.name)) || '';
        const priority = (t.Priority && (t.Priority.label || t.Priority.name)) || (t.priority && t.priority.name) || '';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><a href="/task-detail.html?id=${t.task_id || t.id}">${escapeHtml(t.title || '')}</a></td><td>${fmtDate(due)}</td><td>${escapeHtml(status)}</td><td>${escapeHtml(priority)}</td>`;
        // assignments: render checkboxes for members
        const assignTd = document.createElement('td');
        if (members && members.length) {
          members.forEach(m => {
            const cb = document.createElement('input'); cb.type='checkbox'; cb.className='task-member-cb me-1'; cb.dataset.userId = m.user_id; cb.dataset.taskId = t.task_id || t.id;
            // check if assigned
            const assigned = Array.isArray(t.TaskCollaborators) ? t.TaskCollaborators.find(x => String(x.user_id) === String(m.user_id)) : false;
            try { cb.checked = !!assigned; } catch (e) {}
            cb.addEventListener('change', async (ev) => {
              const taskId = ev.target.dataset.taskId;
              const userId = ev.target.dataset.userId;
              try {
                if (ev.target.checked) await (await import('../api/taskApi.js')).taskApi.assign(taskId, { user_id: userId });
                else await (await import('../api/taskApi.js')).taskApi.unassign(taskId, userId);
              } catch (err) { alert('Failed to update assignment: ' + (err.message || err)); ev.target.checked = !ev.target.checked; }
            });
            const span = document.createElement('span'); span.className = 'd-inline-block me-2'; span.appendChild(cb); span.appendChild(document.createTextNode(' ' + (m.name || m.email || '')));
            assignTd.appendChild(span);
          });
        }
        tr.appendChild(assignTd);
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody);
      tasksEl.innerHTML = ''; tasksEl.appendChild(tbl);
    }

    const memEl = document.getElementById('projMembers');
    if (!members || members.length === 0) memEl.innerHTML = '<div>No members</div>'; else {
      memEl.innerHTML = '';
      members.forEach(m => {
        const d = document.createElement('div'); d.className = 'd-flex align-items-center mb-2';
        const avatar = document.createElement('img'); avatar.src = m.avatar || '/assets/icons/Profile.jpg'; avatar.style.width = '36px'; avatar.style.height = '36px'; avatar.className = 'rounded-circle me-2';
        const text = document.createElement('div'); text.innerHTML = `<div><strong>${escapeHtml(m.name)}</strong></div><div class="small text-muted">${escapeHtml(m.email || '')}</div>`;
        const removeBtn = document.createElement('button'); removeBtn.className = 'btn btn-sm btn-link text-danger ms-auto'; removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', async () => {
          if (!confirm('Remove member from project?')) return;
          try {
            await (await import('../api/projectApi.js')).projectApi.removeCollaborator(project.project_id, m.user_id);
            loadProject();
          } catch (e) { alert('Failed to remove member: ' + (e.message || e)); }
        });
        d.appendChild(avatar); d.appendChild(text); d.appendChild(removeBtn); memEl.appendChild(d);
      });
    }
  } catch (e) {
    console.error('Could not load project detail', e);
    document.getElementById('projTitle').innerText = 'Error loading project';
  }
}

function escapeHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

document.addEventListener('DOMContentLoaded', loadProject);

export {};
