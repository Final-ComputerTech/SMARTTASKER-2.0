import { projectApi } from '../api/projectApi.js';
import { taskApi } from '../api/taskApi.js';

function showModal(modal) {
  if (!modal) return;
  modal.style.display = 'block';
  modal.classList.add('show');
  // add backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop fade show';
  backdrop.id = '__newProjectBackdrop';
  document.body.appendChild(backdrop);
}
function hideModal(modal) {
  if (!modal) return;
  modal.style.display = 'none';
  modal.classList.remove('show');
  const bd = document.getElementById('__newProjectBackdrop'); if (bd) bd.remove();
}

document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.getElementById('openNewProjectBtn');
  const modal = document.getElementById('newProjectModal');
  const createBtn = document.getElementById('createProjectBtn');
  const closeBtns = modal ? modal.querySelectorAll('[data-bs-dismiss]') : [];

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => showModal(modal));
  }
  if (closeBtns && closeBtns.length) closeBtns.forEach(b => b.addEventListener('click', () => hideModal(modal)));

  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      createBtn.disabled = true;
      const name = document.getElementById('newProjectName')?.value?.trim() || '';
      const desc = document.getElementById('newProjectDesc')?.value?.trim() || '';
      const tasksText = document.getElementById('newProjectTasks')?.value || '';
      if (!name) { alert('Please enter a project name'); createBtn.disabled = false; return; }
      try {
        // Prepare tasks array: one title per non-empty line
        const lines = tasksText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const tasksPayload = lines.map(t => ({ title: t }));
        // Send tasks together with project creation so backend can create them in a transaction
        const res = await projectApi.create({ project_name: name, description: desc, tasks: tasksPayload });
        const project = res.project || res;
        hideModal(modal);
        // notify other parts of the app to refresh
        try { document.dispatchEvent(new CustomEvent('project:created', { detail: { project } })); } catch (_) {}
        alert('Project created');
      } catch (err) {
        alert('Failed to create project: ' + (err.message || err));
      } finally { createBtn.disabled = false; }
    });
  }
});

export {};
