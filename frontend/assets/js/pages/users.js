import { userApi } from '../api/userApi.js';
import { requireAuthRedirect } from '../utils/auth.js';

requireAuthRedirect();

async function refreshStats() {
  try {
    const s = await userApi.stats();
    document.getElementById('stat_total').textContent = s.total || 0;
    document.getElementById('stat_admin').textContent = s.admin || 0;
    document.getElementById('stat_manager').textContent = s.manager || 0;
    document.getElementById('stat_member').textContent = s.member || 0;
    document.getElementById('stat_suspended').textContent = s.suspended || 0;
  } catch (e) {
    console.warn('Could not load stats', e.message || e);
  }
}

function buildActionButtons(u) {
  return `
    <button class="btn btn-sm btn-outline-primary btn-edit" data-id="${u.user_id}">Edit</button>
    <button class="btn btn-sm btn-outline-warning btn-suspend" data-id="${u.user_id}">Suspend</button>
    <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${u.user_id}">Delete</button>
    <button class="btn btn-sm btn-outline-dark btn-logs" data-id="${u.user_id}">Logs</button>
  `;
}

async function loadUsers(params) {
  try {
    const users = await userApi.list(params);
    const tbody = document.querySelector('#usersTable tbody');
    tbody.innerHTML = '';
    users.forEach(u => {
      const tr = document.createElement('tr');
      const created = u.createdAt ? new Date(u.createdAt).toLocaleString() : '';
      const lastLogin = u.last_login ? new Date(u.last_login).toLocaleString() : '';
      const roleSelect = `
        <select class="form-select form-select-sm role-select" data-id="${u.user_id}">
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
          <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>Manager</option>
          <option value="member" ${u.role === 'member' ? 'selected' : ''}>Member</option>
          <option value="suspended" ${u.role === 'suspended' ? 'selected' : ''}>Suspended</option>
        </select>
      `;

      tr.innerHTML = `
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${u.phone || ''}</td>
        <td>${roleSelect}</td>
        <td>${created}</td>
        <td>${lastLogin}</td>
        <td>${buildActionButtons(u)}</td>
      `;
      tbody.appendChild(tr);
    });
    attachRowHandlers();
    // wire inline role change handlers
    document.querySelectorAll('.role-select').forEach(sel => sel.addEventListener('change', async (ev) => {
      const id = ev.currentTarget.dataset.id;
      const role = ev.currentTarget.value;
      if (!confirm('Change role to ' + role + '?')) {
        // revert select to previous value by reloading users
        loadUsers();
        return;
      }
      try {
        await userApi.setRole(id, role);
        alert('Role updated');
        refreshStats();
      } catch (e) {
        alert('Role update failed: ' + (e.message || e));
        loadUsers();
      }
    }));
  } catch (e) {
    console.warn('Could not load users:', e.message || e);
  }
}

function attachRowHandlers() {
  // Inline edit handlers
  document.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const tr = btn.closest('tr');
    const id = btn.dataset.id;
    if (tr.dataset.editing === '1') return;
    tr.dataset.editing = '1';
    const nameTd = tr.querySelector('td:nth-child(1)');
    const emailTd = tr.querySelector('td:nth-child(2)');
    const roleSelect = tr.querySelector('.role-select');
    const origName = nameTd.textContent.trim();
    const origEmail = emailTd.textContent.trim();

    nameTd.innerHTML = `<input class="form-control form-control-sm inline-edit-name" value="${origName}">`;
    emailTd.innerHTML = `<input class="form-control form-control-sm inline-edit-email" value="${origEmail}">`;

    const actionsTd = btn.parentElement;
    actionsTd.dataset.orig = actionsTd.innerHTML;
    actionsTd.innerHTML = `
      <button class="btn btn-sm btn-success btn-save" data-id="${id}">Save</button>
      <button class="btn btn-sm btn-secondary btn-cancel" data-id="${id}">Cancel</button>
    `;

    actionsTd.querySelector('.btn-save').addEventListener('click', async () => {
      const newName = nameTd.querySelector('.inline-edit-name').value.trim();
      const newEmail = emailTd.querySelector('.inline-edit-email').value.trim();
      const newRole = roleSelect ? roleSelect.value : undefined;
      try {
        await userApi.update(id, { name: newName, email: newEmail, role: newRole });
        tr.dataset.editing = '0';
        loadUsers();
        refreshStats();
      } catch (err) { alert('Update failed: ' + (err.message || err)); }
    });

    actionsTd.querySelector('.btn-cancel').addEventListener('click', () => {
      tr.dataset.editing = '0';
      loadUsers();
    });
  }));

  // Suspend handler
  document.querySelectorAll('.btn-suspend').forEach(b => b.addEventListener('click', async (ev) => {
    const id = ev.currentTarget.dataset.id;
    if (!confirm('Suspend this user?')) return;
    try { await userApi.suspend(id); alert('User suspended'); refreshStats(); loadUsers(); }
    catch (e) { alert('Suspend failed: ' + (e.message || e)); }
  }));

  // Delete handler
  document.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', async (ev) => {
    const id = ev.currentTarget.dataset.id;
    if (!confirm('Permanently delete this user?')) return;
    try { await userApi.remove(id); alert('User deleted'); refreshStats(); loadUsers(); }
    catch (e) { alert('Delete failed: ' + (e.message || e)); }
  }));

  // Logs handler
  document.querySelectorAll('.btn-logs').forEach(b => b.addEventListener('click', async (ev) => {
    const id = ev.currentTarget.dataset.id;
    try {
      const logs = await userApi.logs(id);
      alert('Logs:\n' + logs.map(l => `${l.field} @ ${l.createdAt}`).join('\n'));
    } catch (e) { alert('Could not load logs: ' + (e.message || e)); }
  }));
}

document.addEventListener('DOMContentLoaded', () => {
  loadUsers();
  refreshStats();
  const form = document.getElementById('createUserForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('u_name').value.trim();
    const email = document.getElementById('u_email').value.trim();
    const password = document.getElementById('u_password').value.trim();
    const role = document.getElementById('u_role').value;
    try {
      await userApi.create({ name, email, password, role });
      alert('User created');
      form.reset();
      loadUsers();
      refreshStats();
    } catch (err) {
      alert('Create failed: ' + (err.message || err));
    }
  });

  document.getElementById('applyFilters').addEventListener('click', () => {
    const q = document.getElementById('search_q').value.trim();
    const role = document.getElementById('filter_role').value;
    const params = {};
    if (q) params.search = q;
    if (role) params.role = role;
    loadUsers(params);
  });
});
