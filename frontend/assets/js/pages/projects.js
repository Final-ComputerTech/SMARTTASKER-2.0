import { projectApi } from '../api/projectApi.js';

function showModal(modal) {
  if (!modal) return;
  modal.style.display = 'block';
  modal.classList.add('show');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop fade show';
  backdrop.id = '__projBackdrop';
  document.body.appendChild(backdrop);
}
function hideModal(modal) {
  if (!modal) return;
  modal.style.display = 'none';
  modal.classList.remove('show');
  const bd = document.getElementById('__projBackdrop'); if (bd) bd.remove();
}

async function loadSummary() {
  try {
    const data = await projectApi.summary();
    const el = document.getElementById('projectsSummary');
    if (!el) return;
    el.textContent = `${data.totalProjects || 0} projects — showing ${data.projects ? data.projects.length : 0}`;
  } catch (e) { console.warn('Could not load projects summary', e); }
}

async function loadProjects() {
  const cont = document.getElementById('projectsTable');
  if (!cont) return;
  cont.innerHTML = 'Loading...';
  try {
    const rows = await projectApi.list();
    const table = document.createElement('table'); table.className = 'table table-striped';
    const thead = document.createElement('thead'); thead.innerHTML = '<tr><th>Name</th><th>Description</th><th>Actions</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    (rows || []).forEach(r => {
      const tr = document.createElement('tr');
      const name = r.project_name || r.name || '';
      const desc = r.description || '';
      tr.innerHTML = `<td><a href="/project-detail.html?id=${r.project_id}">${escapeHtml(name)}</a></td><td>${escapeHtml(desc)}</td><td></td>`;
      const tdAct = tr.querySelector('td:last-child');
      const editBtn = document.createElement('button'); editBtn.className='btn btn-sm btn-link'; editBtn.textContent='Edit';
      editBtn.addEventListener('click', () => openEdit(r));
      const delBtn = document.createElement('button'); delBtn.className='btn btn-sm btn-link text-danger'; delBtn.textContent='Delete';
      delBtn.addEventListener('click', async () => {
        if (!confirm('Delete project? This will NOT delete tasks.')) return;
        try {
          await projectApi.delete(r.project_id);
          // notify other modules a project was deleted
          try { document.dispatchEvent(new CustomEvent('project:deleted', { detail: { projectId: r.project_id } })); } catch (_) {}
          loadProjects(); loadSummary();
        } catch (e) { alert('Delete failed: ' + (e.message || e)); }
      });
      tdAct.appendChild(editBtn); tdAct.appendChild(document.createTextNode(' ')); tdAct.appendChild(delBtn);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    cont.innerHTML = '';
    cont.appendChild(table);
  } catch (e) { cont.innerHTML = '<div class="text-danger">Failed to load projects</div>'; console.error(e); }
}

function escapeHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function openEdit(project) {
  const modal = document.getElementById('projectModal');
  if (!modal) return;
  document.getElementById('projName').value = project.project_name || '';
  document.getElementById('projDesc').value = project.description || '';
  modal.dataset.editId = project.project_id;
  document.getElementById('projectModalTitle').innerText = 'Edit Project';
  showModal(modal);
}

document.addEventListener('DOMContentLoaded', () => {
  loadProjects(); loadSummary();
  const newBtn = document.getElementById('btnNewProject');
  const modal = document.getElementById('projectModal');
  const save = document.getElementById('projSave');
  if (newBtn && modal) newBtn.addEventListener('click', () => { modal.dataset.editId = ''; document.getElementById('projName').value=''; document.getElementById('projDesc').value=''; document.getElementById('projectModalTitle').innerText = 'New Project'; showModal(modal); });
  // close buttons
  modal.querySelectorAll('[data-bs-dismiss]').forEach(b => b.addEventListener('click', () => hideModal(modal)));
  if (save) save.addEventListener('click', async () => {
    save.disabled = true;
    const id = modal.dataset.editId;
    const payload = { project_name: document.getElementById('projName').value.trim(), description: document.getElementById('projDesc').value.trim() };
    try {
      if (id) {
        const updated = await projectApi.update(id, payload);
        // notify other modules that a project was updated
        try { document.dispatchEvent(new CustomEvent('project:updated', { detail: { project: updated } })); } catch (_) {}
      } else {
        const created = await projectApi.create(payload);
        // notify other modules that a project was created
        try { document.dispatchEvent(new CustomEvent('project:created', { detail: { project: created } })); } catch (_) {}
      }
      hideModal(modal);
      loadProjects(); loadSummary();
    } catch (e) { alert('Save failed: ' + (e.message || e)); }
    finally { save.disabled = false; }
  });
});

export {};
