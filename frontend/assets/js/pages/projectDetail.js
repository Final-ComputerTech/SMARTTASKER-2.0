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

      // small UI: add task form (remove existing to avoid duplicates on reload)
      const existingTasksHeader = document.getElementById('__projTasksHeader');
      if (existingTasksHeader) existingTasksHeader.remove();
      const tasksHeader = document.createElement('div');
      tasksHeader.id = '__projTasksHeader';
      tasksHeader.className = 'mb-2 d-flex gap-2';
      tasksHeader.innerHTML = `<input id="newProjTaskTitle" class="form-control form-control-sm" placeholder="New task title" /><button id="addProjTaskBtn" class="btn btn-sm btn-primary">Add Task</button>`;
      const tasksContainer = document.getElementById('projTasks');
      if (tasksContainer) tasksContainer.parentNode.insertBefore(tasksHeader, tasksContainer);

      // add member form
      const memContainer = document.getElementById('projMembers');
      // remove existing member form to avoid duplicates
      const existingMemForm = document.getElementById('__projMemForm');
      if (existingMemForm) existingMemForm.remove();
      const memForm = document.createElement('div');
      memForm.id = '__projMemForm';
      memForm.className = 'mb-2';
      memForm.innerHTML = `<div class="input-group input-group-sm"><input id="newMemberEmail" class="form-control" placeholder="Member email" /><select id="newMemberRole" class="form-select" style="width:140px;margin-left:8px;"><option value="member">Member</option><option value="manager">Manager</option></select><button id="addMemberBtn" class="btn btn-outline-primary">Add</button></div>`;
      if (memContainer) memContainer.parentNode.insertBefore(memForm, memContainer);
      // wire add task button (remove previous listeners by replacing the node)
      const addBtnOld = document.getElementById('addProjTaskBtn');
      if (addBtnOld) {
        const addBtnNew = addBtnOld.cloneNode(true);
        addBtnOld.parentNode.replaceChild(addBtnNew, addBtnOld);
      }
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
      // wire add member button (replace node to clear listeners)
      const addMemOld = document.getElementById('addMemberBtn');
      if (addMemOld) {
        const addMemNew = addMemOld.cloneNode(true);
        addMemOld.parentNode.replaceChild(addMemNew, addMemOld);
      }
      document.getElementById('addMemberBtn')?.addEventListener('click', async () => {
        const email = document.getElementById('newMemberEmail')?.value?.trim();
        const role = document.getElementById('newMemberRole')?.value || 'member';
        if (!email) return alert('Enter member email');
        try {
          const res = await (await import('../api/projectApi.js')).projectApi.addCollaborator(project.project_id, { email, role });
          document.getElementById('newMemberEmail').value = '';
          document.getElementById('newMemberRole').value = 'member';
          loadProject();
        } catch (e) { alert('Failed to add member: ' + (e.message || e)); }
      });

    const tasksEl = document.getElementById('projTasks');
    if (!tasks || tasks.length === 0) tasksEl.innerHTML = '<div>No tasks</div>'; else {
      const tbl = document.createElement('table'); tbl.className = 'table table-sm';
      tbl.innerHTML = '<thead><tr><th>Title</th><th>Due</th><th>Status</th><th>Priority</th><th>Assignee</th></tr></thead>';
      const tbody = document.createElement('tbody');
      tasks.forEach(t => {
        const due = (t.DueDate && t.DueDate.due_date) || t.due_date || t.createdAt || t.created_at;
        const status = (t.Status && (t.Status.label || t.Status.name)) || (t.status && (t.status.label || t.status.name)) || '';
        const priority = (t.Priority && (t.Priority.label || t.Priority.name)) || (t.priority && t.priority.name) || '';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><a href="/task-detail.html?id=${t.task_id || t.id}">${escapeHtml(t.title || '')}</a></td><td>${fmtDate(due)}</td><td>${escapeHtml(status)}</td><td>${escapeHtml(priority)}</td>`;
        // assignments: show a visible assignee badge and a Change control (inline select) for assignment
        const assignTd = document.createElement('td');
        try {
          // determine current assignee id (primary task.user_id preferred)
          const currentAssigneeId = t.user_id || (Array.isArray(t.TaskCollaborators) && t.TaskCollaborators[0] && t.TaskCollaborators[0].user_id) || null;
          const currentAssignee = members.find(m => String(m.user_id) === String(currentAssigneeId));
          const badge = document.createElement('span'); badge.className = 'badge bg-secondary me-2'; badge.style.minWidth = '90px'; badge.style.display = 'inline-block';
          badge.innerText = currentAssignee ? (currentAssignee.name || currentAssignee.email || 'Member') : 'Unassigned';
          assignTd.appendChild(badge);

          // small change button
          const changeBtn = document.createElement('button'); changeBtn.className = 'btn btn-sm btn-outline-primary'; changeBtn.type = 'button'; changeBtn.textContent = 'Change';
          assignTd.appendChild(changeBtn);

          // clicking Change opens an inline select to choose a member or Unassigned
          changeBtn.addEventListener('click', () => {
            if (assignTd.querySelector('.assign-select')) return; // already open
            const sel = document.createElement('select'); sel.className = 'form-select form-select-sm assign-select'; sel.style.display = 'inline-block'; sel.style.width = 'auto'; sel.style.marginLeft = '8px';
            const emptyOpt = document.createElement('option'); emptyOpt.value = ''; emptyOpt.innerText = 'Unassigned'; sel.appendChild(emptyOpt);
            members.forEach(m => { const o = document.createElement('option'); o.value = m.user_id; o.innerText = (m.name || m.email || m.user_id); if (currentAssigneeId && String(currentAssigneeId) === String(m.user_id)) o.selected = true; sel.appendChild(o); });
            const saveBtn = document.createElement('button'); saveBtn.className = 'btn btn-sm btn-primary ms-2'; saveBtn.type = 'button'; saveBtn.textContent = 'Save';
            const cancelBtn = document.createElement('button'); cancelBtn.className = 'btn btn-sm btn-outline-secondary ms-1'; cancelBtn.type = 'button'; cancelBtn.textContent = 'Cancel';
            assignTd.appendChild(sel); assignTd.appendChild(saveBtn); assignTd.appendChild(cancelBtn);

            saveBtn.addEventListener('click', async () => {
              const selVal = sel.value || null;
              try {
                if (!selVal) {
                  // unassign primary assignee if any
                  if (currentAssigneeId) await (await import('../api/taskApi.js')).taskApi.unassign(t.task_id || t.id, currentAssigneeId);
                } else {
                  // assign selected user
                  await (await import('../api/taskApi.js')).taskApi.assign(t.task_id || t.id, { user_id: selVal });
                }
                // broadcast change in-window and across tabs
                try { document.dispatchEvent(new CustomEvent('task:assignment-changed', { detail: { taskId: t.task_id || t.id, userId: selVal } })); } catch (_) {}
                try { const payload = JSON.stringify({ taskId: t.task_id || t.id, userId: selVal, ts: Date.now() }); localStorage.setItem('task:assign', payload); setTimeout(() => { try { localStorage.removeItem('task:assign'); } catch (e) {} }, 200); } catch (e) {}
                loadProject();
              } catch (err) { alert('Failed to update assignee: ' + (err.message || err)); }
            });

            cancelBtn.addEventListener('click', () => { sel.remove(); saveBtn.remove(); cancelBtn.remove(); });
          });
        } catch (e) { assignTd.innerText = '—'; }
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
        const permBadge = m.user_permission ? ` <span class="badge bg-${m.user_permission === 'manager' ? 'primary' : 'secondary'} ms-1">${escapeHtml(m.user_permission)}</span>` : '';
        const text = document.createElement('div'); text.innerHTML = `<div><strong>${escapeHtml(m.name)}</strong>${permBadge}</div><div class="small text-muted">${escapeHtml(m.email || '')}</div>`;
        const removeBtn = document.createElement('button'); removeBtn.className = 'btn btn-sm btn-link text-danger ms-auto'; removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', async () => {
          if (!confirm('Remove member from project?')) return;
          try {
            await (await import('../api/projectApi.js')).projectApi.removeCollaborator(project.project_id, m.user_id);
            loadProject();
          } catch (e) { alert('Failed to remove member: ' + (e.message || e)); }
        });
        // insert role control (promote/demote) before the Remove button, unless this user is the project owner
        const roleWrapper = document.createElement('div'); roleWrapper.className = 'ms-3 d-flex align-items-center';
        if (project && project.owner_id && String(project.owner_id) === String(m.user_id)) {
          // owner: show an owner badge instead of controls
          const ownerBadge = document.createElement('span'); ownerBadge.className = 'badge bg-warning text-dark ms-2'; ownerBadge.textContent = 'Owner';
          roleWrapper.appendChild(ownerBadge);
        } else {
          const roleSel = document.createElement('select'); roleSel.className = 'form-select form-select-sm'; roleSel.style.width = '120px';
          const optMember = document.createElement('option'); optMember.value = 'member'; optMember.innerText = 'Member';
          const optManager = document.createElement('option'); optManager.value = 'manager'; optManager.innerText = 'Manager';
          roleSel.appendChild(optMember); roleSel.appendChild(optManager);
          try { roleSel.value = m.user_permission || 'member'; } catch (e) {}
          const saveRoleBtn = document.createElement('button'); saveRoleBtn.className = 'btn btn-sm btn-outline-success ms-2'; saveRoleBtn.type = 'button'; saveRoleBtn.textContent = 'Save';
          saveRoleBtn.addEventListener('click', async () => {
            const newRole = roleSel.value;
            if (!newRole) return alert('Select a role');
            if (!confirm(`Change role of ${m.name || m.email} to ${newRole}?`)) return;
            try {
              // disable button to avoid duplicate clicks
              saveRoleBtn.disabled = true;
              console.debug('projectDetail: updating collaborator', { projectId: project.project_id, userId: m.user_id, role: newRole });
              const res = await (await import('../api/projectApi.js')).projectApi.updateCollaborator(project.project_id, m.user_id, { role: newRole });
              console.debug('projectDetail: updateCollaborator response', res);
              // success: reload members
              await loadProject();
            } catch (err) {
              console.error('projectDetail: updateCollaborator failed', err);
              alert('Failed to update role: ' + (err && err.message ? err.message : err));
            } finally {
              try { saveRoleBtn.disabled = false; } catch (e) {}
            }
          });
          roleWrapper.appendChild(roleSel); roleWrapper.appendChild(saveRoleBtn);
        }

        d.appendChild(avatar); d.appendChild(text); d.appendChild(roleWrapper); d.appendChild(removeBtn); memEl.appendChild(d);
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
