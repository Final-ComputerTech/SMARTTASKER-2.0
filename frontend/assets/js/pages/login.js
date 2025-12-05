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
    // Render error message
    const msg = err && err.message ? err.message : 'Login failed';
    document.getElementById('loginError').innerText = msg;

    // If the error appears to be a network/backend connection issue, offer demo/offline login
    const lower = String(msg).toLowerCase();
    const networkIndicators = ['failed to fetch', 'networkerror', 'could not connect', 'connection refused', 'fetch failed', 'api error', 'could not connect to server'];
    const isNetwork = networkIndicators.some(k => lower.includes(k));
    if (isNetwork) {
      showOfflineFallback();
    }
  }
});

function showOfflineFallback() {
  // avoid duplicating the fallback UI
  if (document.getElementById('offlineFallback')) return;
  const container = document.createElement('div');
  container.id = 'offlineFallback';
  container.style.marginTop = '12px';
  container.style.padding = '12px';
  container.style.borderRadius = '8px';
  container.style.background = 'linear-gradient(90deg, rgba(239,68,68,0.06), rgba(99,102,241,0.03))';
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:200px">
        <strong style="display:block;color:#b91c1c">Backend unreachable</strong>
        <small style="color:#374151">You can continue in demo mode (no backend required). This will create a temporary local token.</small>
      </div>
      <div style="flex:0 0 auto;display:flex;gap:8px">
        <button id="offlineDemoBtn" class="btn primary-btn">Continue (Demo)</button>
        <button id="offlineRetryBtn" class="btn social-btn outline">Retry</button>
      </div>
    </div>`;
  const form = document.getElementById('loginForm');
  form.parentNode.insertBefore(container, form.nextSibling);

  document.getElementById('offlineDemoBtn').addEventListener('click', () => {
    const mockToken = 'mock_local_login_' + Date.now();
    saveToken(mockToken);
    console.debug('Offline demo: saved mock token', mockToken);
    window.location.href = '/dashboard.html';
  });
  document.getElementById('offlineRetryBtn').addEventListener('click', () => {
    // remove fallback UI and allow user to retry
    const el = document.getElementById('offlineFallback');
    if (el) el.remove();
    document.getElementById('loginError').innerText = '';
  });
}

// ================= Mock OAuth popup flow =================
function openOAuthPopup(provider) {
  const w = 500, h = 600;
  const left = window.screenX + (window.innerWidth - w) / 2;
  const top = window.screenY + (window.innerHeight - h) / 2;
  const popup = window.open('', `${provider}-oauth`, `width=${w},height=${h},left=${left},top=${top}`);
  if (!popup) return alert('Popup blocked. Please allow popups and try again.');
  // write a small page that simulates OAuth provider redirect and then posts a token back
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Sign in — ${provider}</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">`+
    `<div style="text-align:center;max-width:320px">`+
    `<h3>Signing in with ${provider}</h3><p>Please wait…</p>`+
    `<script>
      (function(){
        try{
          // simulate network delay
          setTimeout(function(){
            const token = 'mock_'+encodeURIComponent('${provider}')+'_'+Date.now();
            // post message back to opener and close
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ type: 'oauth:success', provider: '${provider}', token: token }, window.location.origin || '*');
            }
            // show success briefly then close
            document.body.innerHTML = '<div style="text-align:center"><h4>Success</h4><p>You can close this window.</p></div>';
            setTimeout(function(){ try{ window.close(); } catch(e){} }, 800);
          }, 900);
        }catch(e){ try{ window.opener.postMessage({ type: 'oauth:error', provider: '${provider}', error: String(e) }, window.location.origin || '*'); } catch(_){} }
      })();
    <\/script></div></body></html>`;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}

// listen for oauth messages from popup
window.addEventListener('message', (ev) => {
  try {
    if (!ev || !ev.data) return;
    const data = ev.data;
    if (data && data.type === 'oauth:success' && data.token) {
      // simple validation of origin could be added here
      saveToken(data.token);
      console.debug('OAuth mock: token saved', data.token);
      // navigate to dashboard
      setTimeout(() => { window.location.href = '/dashboard.html'; }, 100);
    } else if (data && data.type === 'oauth:error') {
      document.getElementById('loginError').innerText = 'OAuth error: ' + (data.error || 'unknown');
    }
  } catch (e) { console.warn('oauth message handler error', e); }
});

// wire social buttons
try {
  document.getElementById('social-google')?.addEventListener('click', () => openOAuthPopup('google'));
  document.getElementById('social-github')?.addEventListener('click', () => openOAuthPopup('github'));
} catch (e) { console.debug('Could not wire social buttons', e); }
