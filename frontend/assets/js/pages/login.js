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
    console.debug('login: token saved', res.token && res.token.slice ? res.token.slice(0,20) + '...' : res.token);
    // small delay to ensure storage and give visual feedback
    setTimeout(() => { window.location.href = '/dashboard.html'; }, 50);
  } catch (err) {
    // render error
    document.getElementById('loginError').innerText = err.message;
  }
});
