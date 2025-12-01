import { requireAuthRedirect, getToken, clearToken } from '../utils/auth.js';
import { authProfileApi, authPasswordApi, authDeleteApi } from '../api/authApi.js';

requireAuthRedirect();

async function loadProfile() {
  try {
    const me = await authProfileApi.me();
    document.getElementById('username').value = me.name || '';
    document.getElementById('email').value = me.email || '';
  } catch (e) {
    console.warn('Could not load profile:', e.message || e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadProfile();

  const profileForm = document.getElementById('profileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('username').value.trim();
      try {
        const updated = await authProfileApi.updateMe({ name });
        alert('Profile updated');
      } catch (err) {
        alert('Update failed: ' + (err.message || err));
      }
    });
  }

  const passwordForm = document.getElementById('passwordForm');
  if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const current = document.getElementById('currentPassword').value.trim();
      const nw = document.getElementById('newPassword').value.trim();
      if (!current || !nw) { alert('Please fill both fields'); return; }
      try {
        const { success } = await authPasswordApi.change(current, nw);
        if (success) {
          alert('Password changed successfully. Please login again.');
          clearToken();
          window.location.href = '/index.html';
        } else {
          alert('Change password failed');
        }
      } catch (err) {
        alert('Change failed: ' + (err.message || err));
      }
    });
  }

  // Delete account handler
  const delBtn = document.getElementById('deleteAccountBtn');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) return;
      try {
        await authDeleteApi.deleteMe();
        alert('Your account has been deleted');
        clearToken();
        window.location.href = '/index.html';
      } catch (err) {
        alert('Delete failed: ' + (err.message || err));
      }
    });
  }
});
