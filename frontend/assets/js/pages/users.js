import { userApi } from '../api/userApi.js';
import { requireAuthRedirect } from '../utils/auth.js';

requireAuthRedirect();

async function loadUsers() {
  try {
    const users = await userApi.list();
    const tbody = document.querySelector('#usersTable tbody');
    tbody.innerHTML = '';
    users.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${u.name}</td><td>${u.email}</td><td>${u.role || 'member'}</td>`;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.warn('Could not load users:', e.message || e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadUsers();
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
    } catch (err) {
      alert('Create failed: ' + (err.message || err));
    }
  });
});
