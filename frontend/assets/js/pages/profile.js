import { authProfileApi, authPasswordApi } from '../api/authApi.js';
import { requireAuthRedirect, clearToken } from '../utils/auth.js';

requireAuthRedirect();

async function loadProfile() {
  try {
    const me = await authProfileApi.me();
    document.getElementById('p_name').value = me.name || '';
    document.getElementById('p_email').value = me.email || '';
    document.getElementById('p_bio').value = me.bio || '';
    document.getElementById('p_gender').value = me.gender || '';
    document.getElementById('p_dob').value = me.dob || '';
    document.getElementById('p_phone').value = me.phone || '';
    document.getElementById('p_address').value = me.address || '';
    document.getElementById('p_timezone').value = me.timezone || '';
    document.getElementById('p_language').value = me.language || '';
    const avatar = me.avatar || '/assets/img/default-avatar.png';
    document.getElementById('avatarPreview').src = avatar;
  } catch (e) {
    console.warn('Could not load profile:', e.message || e);
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// Resize/compress image to target dimensions and return a Blob (JPEG)
function resizeImage(file, maxWidth = 1024, maxHeight = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = (e) => reject(new Error('Failed to load image for resizing'));
    const fr = new FileReader();
    fr.onerror = (e) => reject(new Error('Failed to read file'));
    fr.onload = () => {
      img.onload = () => {
        // calculate target size while preserving aspect ratio
        let { width, height } = img;
        let ratio = Math.min(maxWidth / width, maxHeight / height, 1);
        const targetW = Math.round(width * ratio);
        const targetH = Math.round(height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, targetW, targetH);
        // convert to blob (jpeg)
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Canvas is empty'));
          resolve(blob);
        }, 'image/jpeg', quality);
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadProfile();

  const form = document.getElementById('profileEditForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('p_name').value.trim(),
      bio: document.getElementById('p_bio').value.trim(),
      gender: document.getElementById('p_gender').value || null,
      dob: document.getElementById('p_dob').value || null,
      phone: document.getElementById('p_phone').value.trim(),
      address: document.getElementById('p_address').value.trim(),
      timezone: document.getElementById('p_timezone').value || null,
      language: document.getElementById('p_language').value || null
    };
    try {
      await authProfileApi.updateMe(payload);
      // reload profile to reflect any server-side formatting and current values
      await loadProfile();
      alert('Profile updated');
    } catch (err) {
      alert('Update failed: ' + (err.message || err));
    }
  });

  const uploadBtn = document.getElementById('uploadAvatarBtn');
  uploadBtn.addEventListener('click', async () => {
    const input = document.getElementById('avatarFile');
    if (!input.files || input.files.length === 0) { alert('Choose a file'); return; }
    const file = input.files[0];
    try {
      // Resize/compress image before upload
      const maxDim = 1024; // px
      const quality = 0.8; // jpeg quality
      let blob;
      try {
        blob = await resizeImage(file, maxDim, maxDim, quality);
      } catch (e) {
        console.warn('Resizing failed, falling back to original file:', e.message || e);
        blob = file;
      }

      const API_BASE = (window.location.port && window.location.port !== '3000') ? 'http://localhost:3000/api' : '/api';
      const fd = new FormData();
      // ensure filename ends with .jpg when blob is from canvas
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const filename = blob instanceof File ? file.name : `${baseName}.jpg`;
      fd.append('avatar', blob, filename);
      const resp = await fetch(`${API_BASE}/auth/me/avatar`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('st_token') },
        body: fd
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || json.message || 'Upload failed');
      // reload profile so all fields (and avatar path) reflect the saved state
      await loadProfile();
      alert('Avatar uploaded');
    } catch (err) {
      alert('Upload failed: ' + (err.message || err));
    }
  });
});
