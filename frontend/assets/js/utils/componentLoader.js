// ================= componentLoader.js =================

// Hàm load 1 component vào div có id
async function loadComponent(id, url) {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      const resp = await fetch(url);
      const html = await resp.text();
      el.innerHTML = html;
      // If we just loaded the header, try to set its title from page content
      try {
        if (id === 'header') {
          // Prefer a visible .page-heading text if present in the page
          const ph = document.querySelector('.page-heading');
          const headerTitleEl = document.getElementById('pageTitle');
          if (headerTitleEl) {
            if (ph && ph.textContent && ph.textContent.trim().length > 0) {
              // Use only the textual part (strip icons)
              headerTitleEl.innerText = ph.textContent.trim();
            } else if (document.title) {
              headerTitleEl.innerText = document.title.replace(/\s*-\s*SMARTTASKER.*$/i, '').trim();
            }
          }
        }
      } catch (e) { console.debug('componentLoader header title set failed', e); }
    } catch (err) {
      console.error(`Failed to load component ${id} from ${url}:`, err);
    }
  }
  
  // Load các component mặc định when DOM is ready. If the script is imported
  // after DOMContentLoaded fired (dynamic import), call immediately.
  function loadAllComponents() {
    // Components live under `/components` in this project
    loadComponent('sidebar', 'components/sidebar.html');
    loadComponent('header', 'components/header.html');
    loadComponent('modalFilter', 'components/modal-filter.html'); // nếu dùng modal
    console.debug('componentLoader: loadAllComponents invoked');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAllComponents);
  } else {
    // DOM already ready — load immediately
    loadAllComponents();
  }

  // Expose for other scripts or debugging
  try { window.componentLoader = window.componentLoader || {}; window.componentLoader.loadAllComponents = loadAllComponents; window.componentLoader.loadComponent = loadComponent; } catch (e) {}
  