import { authApi } from '../api/authApi.js';
import { saveToken } from '../utils/auth.js';

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = e.target.email.value.trim();
  const password = e.target.password.value.trim();
  try {
    const res = await authApi.login(email, password);
    // backend should return { token, user }
    saveToken(res.token);
    window.location.href = '/dashboard.html';
  } catch (err) {
    // render error
    document.getElementById('loginError').innerText = err.message;
  }
});
