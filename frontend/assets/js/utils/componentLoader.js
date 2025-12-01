// ================= componentLoader.js =================

// Hàm load 1 component vào div có id
export async function loadComponent(id, url) {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      const resp = await fetch(url);
      const html = await resp.text();
      el.innerHTML = html;
    } catch (err) {
      console.error(`Failed to load component ${id} from ${url}:`, err);
    }
  }
  
  // Load các component mặc định khi DOM sẵn sàng
  document.addEventListener('DOMContentLoaded', () => {
    loadComponent('sidebar', 'assets/html/sidebar.html');
    loadComponent('header', 'assets/html/header.html');
    loadComponent('modalFilter', 'assets/html/modal-filter.html'); // nếu dùng modal
  });
  