// ================= componentLoader.js =================

// Hàm load 1 component vào div có id
async function loadComponent(id, url) {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      const resp = await fetch(url);
      const html = await resp.text();

      // Create a template to parse the fetched HTML so we can execute scripts (including nested ones)
      const tpl = document.createElement('template');
      tpl.innerHTML = html.trim();

      // Find all script elements inside the parsed content (nested or top-level)
      const scriptNodes = Array.from(tpl.content.querySelectorAll('script'));

      // Remove scripts from the template so they don't get appended as inert nodes
      scriptNodes.forEach(s => { if (s.parentNode) s.parentNode.removeChild(s); });

      // Clear existing content and append parsed nodes (scripts removed)
      el.innerHTML = '';
      Array.from(tpl.content.childNodes).forEach(node => el.appendChild(node.cloneNode(true)));

      // Execute scripts: recreate them so browser runs them
      for (const s of scriptNodes) {
        try {
          const newScript = document.createElement('script');
          // copy attributes (e.g., src, type)
          for (const attr of Array.from(s.attributes || [])) newScript.setAttribute(attr.name, attr.value);
          if (s.src) {
            // external script — append and wait for load (best-effort)
            await new Promise((resolve) => {
              newScript.addEventListener('load', resolve);
              newScript.addEventListener('error', resolve);
              el.appendChild(newScript);
            }).catch(()=>{});
          } else {
            // inline script: set textContent then append
            newScript.textContent = s.textContent;
            el.appendChild(newScript);
          }
        } catch (e) {
          console.debug('componentLoader: script execution failed', e);
        }
      }
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
  