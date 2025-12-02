import { taskApi } from '../api/taskApi.js';
import { projectApi } from '../api/projectApi.js';
import { apiRequest } from '../utils/request.js';

// Create a simple modal for new task creation and wire submit
(function () {
  function createModal() {
    if (document.getElementById('newTaskModal')) return;
    const modal = document.createElement('div');
    modal.id = 'newTaskModal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.display = 'none';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '1050';

    modal.innerHTML = `
      <div class="modal-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.4);display:block;z-index:1040;"></div>
      <div class="modal-dialog" style="max-width:600px;margin:auto;position:relative;z-index:1051;">
        <div class="modal-content p-3" style="position:relative;z-index:1052;pointer-events:auto;">
          <div class="modal-header d-flex justify-content-between align-items-center">
            <h5 class="modal-title">New Task</h5>
            <button type="button" id="closeNewTask" class="btn-close" aria-label="Close"></button>
          </div>
          <form id="newTaskForm">
            <div class="modal-body">
              <div class="mb-2">
                <label class="form-label">Title</label>
                <input id="nt_title" class="form-control" name="title" required />
              </div>
              <div class="mb-2">
                <label class="form-label">Description</label>
                <textarea id="nt_description" class="form-control" name="description"></textarea>
              </div>
              <div class="row">
                <div class="col-md-4 mb-2">
                  <label class="form-label">Project</label>
                  <select id="nt_project" class="form-select"><option value="">(none)</option></select>
                </div>
                <div class="col-md-4 mb-2">
                  <label class="form-label">Priority</label>
                  <select id="nt_priority" class="form-select"><option value="">(default)</option></select>
                </div>
                <div class="col-md-4 mb-2">
                  <label class="form-label">Status</label>
                  <select id="nt_status" class="form-select"><option value="">(default)</option></select>
                </div>
              </div>
              <div class="mb-2">
                <label class="form-label">Due date</label>
                <input id="nt_due_date" type="datetime-local" class="form-control" name="due_date" />
              </div>
            </div>
            <div class="modal-footer d-flex justify-content-end">
              <button type="button" id="cancelNewTask" class="btn btn-sm btn-secondary me-2">Cancel</button>
              <button type="submit" class="btn btn-sm btn-primary">Create Task</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Wire buttons
    const closeBtn = document.getElementById('closeNewTask');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    const cancelBtn = document.getElementById('cancelNewTask');
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    document.getElementById('newTaskForm').addEventListener('submit', onSubmit);
  }

  async function loadOptions() {
    // populate projects
    try {
      const proj = await projectApi.list();
      const sel = document.getElementById('nt_project');
      if (sel && Array.isArray(proj)) {
        // clear existing except first
        sel.innerHTML = '<option value="">(none)</option>';
        proj.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.project_id;
          opt.textContent = p.project_name || p.name || p.project_id;
          sel.appendChild(opt);
        });
      }
    } catch (e) { console.warn('Could not load projects', e.message || e); }

    // priorities
    try {
      const priorities = await apiRequest('meta/priorities', 'GET', null, true);
      const selP = document.getElementById('nt_priority');
      if (selP && Array.isArray(priorities)) {
        selP.innerHTML = '<option value="">(default)</option>';
        priorities.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.priority_id;
          opt.textContent = p.label || p.name || p.priority_id;
          selP.appendChild(opt);
        });
      }
    } catch (e) { console.warn('Could not load priorities', e.message || e); }

    // statuses
    try {
      const statuses = await apiRequest('meta/statuses', 'GET', null, true);
      const selS = document.getElementById('nt_status');
      if (selS && Array.isArray(statuses)) {
        selS.innerHTML = '<option value="">(default)</option>';
        statuses.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.status_id;
          opt.textContent = s.label || s.name || s.status_id;
          selS.appendChild(opt);
        });
      }
    } catch (e) { console.warn('Could not load statuses', e.message || e); }
  }

  function openModal() {
    createModal();
    const modal = document.getElementById('newTaskModal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    // populate selects each time to reflect current data
    loadOptions().catch(() => {});
    const titleEl = document.getElementById('nt_title');
    if (titleEl) titleEl.focus();
  }

  // Allow other modules to open the New Task modal with a prefilled date
  document.addEventListener('openNewTask', (e) => {
    try {
      createModal();
      const modal = document.getElementById('newTaskModal');
      if (!modal) return;
      const { date } = (e && e.detail) || {};
      if (date) {
        // convert yyyy-mm-dd to datetime-local value at 09:00
        let dt = new Date(date);
        if (!isNaN(dt.getTime())) {
          // set time to 09:00 local by default
          dt.setHours(9,0,0,0);
          const local = dt.toISOString().slice(0,16);
          const input = document.getElementById('nt_due_date');
          if (input) input.value = local;
        }
      }
      openModal();
    } catch (err) { console.warn('openNewTask handler error', err); }
  });

  function closeModal() {
    const modal = document.getElementById('newTaskModal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
    // reset form
    const form = document.getElementById('newTaskForm');
    if (form) form.reset();
  }

  async function onSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('nt_title').value.trim();
    if (!title) return alert('Title is required');
    const description = document.getElementById('nt_description').value.trim() || null;
    const dueVal = document.getElementById('nt_due_date').value;
    let due_date = null;
    if (dueVal) {
      // convert local datetime-local to ISO
      const d = new Date(dueVal);
      if (!isNaN(d.getTime())) due_date = d.toISOString();
    }

    const payload = { title, description };
    if (due_date) payload.due_date = due_date;
    const projectId = document.getElementById('nt_project') ? document.getElementById('nt_project').value : '';
    const priorityId = document.getElementById('nt_priority') ? document.getElementById('nt_priority').value : '';
    const statusId = document.getElementById('nt_status') ? document.getElementById('nt_status').value : '';
    if (projectId) payload.project_id = projectId;
    if (priorityId) payload.priority_id = priorityId;
    if (statusId) payload.status_id = statusId;

    try {
      const created = await taskApi.create(payload);
      // dispatch event for other modules to react
      document.dispatchEvent(new CustomEvent('task:created', { detail: created }));
      closeModal();
      alert('Task created');
    } catch (err) {
      console.error('Could not create task', err);
      alert('Error creating task: ' + (err.message || err));
    }
  }

  // Attach to button
  document.addEventListener('DOMContentLoaded', () => {
    createModal();
    const btn = document.getElementById('openNewTaskBtn');
    if (btn) btn.addEventListener('click', openModal);
  });
})();
