import { authApi } from '../api/authApi.js';
import { saveToken } from '../utils/auth.js';

function showModal(modal) {
  if (!modal) return;
  modal.style.display = 'block';
  modal.classList.add('show');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop fade show';
  backdrop.id = '__regBackdrop';
  document.body.appendChild(backdrop);
}
function hideModal(modal) {
  if (!modal) return;
  modal.style.display = 'none';
  modal.classList.remove('show');
  const bd = document.getElementById('__regBackdrop'); if (bd) bd.remove();
}

document.addEventListener('DOMContentLoaded', () => {
  const open = document.getElementById('openRegister');
  const modal = document.getElementById('registerModal');
  const form = document.getElementById('registerForm');
  if (open && modal) open.addEventListener('click', (e) => { e.preventDefault(); showModal(modal); });
  modal.querySelectorAll('[data-bs-dismiss]').forEach(b => b.addEventListener('click', () => hideModal(modal)));

  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const errEl = document.getElementById('registerError');
    try {
      errEl.innerText = '';
      const res = await authApi.register({ name, email, password });
      // expect { token, user }
      if (res && res.token) {
        saveToken(res.token);
        hideModal(modal);
        setTimeout(() => { window.location.href = '/dashboard.html'; }, 50);
      } else {
        errEl.innerText = 'Registration succeeded but no token returned';
      }
    } catch (err) {
      errEl.innerText = err.message || 'Registration failed';
    }
  });
});

export {};
