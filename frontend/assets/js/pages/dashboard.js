import { apiRequest } from '../utils/request.js';
import { projectApi } from '../api/projectApi.js';
import { notificationApi } from '../api/notificationApi.js';
import { requireAuthRedirect, getToken } from '../utils/auth.js';

// Debug: log token presence before redirect check
console.debug('dashboard: token present?', getToken());
requireAuthRedirect();

// ================= Load Metrics =================
async function loadMetrics() {
    try {
      console.debug('loadMetrics: start');
    // Prefer a single dashboard summary endpoint for consistent metrics
    let summary = {};
    try {
      summary = await apiRequest('dashboard/summary', 'GET', null, true);
    } catch (e) {
      console.warn('dashboard summary failed:', e.message || e);
    }

    const statuses = summary.statuses || [];
    const priorities = summary.priorities || [];
    const projects = summary.projects || [];
    const upcoming = summary.upcoming || [];
    const recentMissed = summary.recentMissed || [];
    const overdueCount = summary.overdueCount || 0;
    const recentChanges = summary.recentChanges || [];
    const categoryCounts = summary.categoryCounts || null;

    const totalTasks = categoryCounts && categoryCounts.total ? parseInt(categoryCounts.total, 10) : statuses.reduce((s, row) => s + (parseInt(row.count, 10) || 0), 0);
    const completed = statuses.reduce((s, row) => {
      const label = (row.status || '').toLowerCase();
      return s + ((label.includes('done') || label.includes('completed')) ? (parseInt(row.count, 10) || 0) : 0);
    }, 0);
    const pending = statuses.reduce((s, row) => {
      const label = (row.status || '').toLowerCase();
      return s + ((label.includes('todo') || label.includes('pending') || label.includes('in progress')) ? (parseInt(row.count, 10) || 0) : 0);
    }, 0);
    // Prefer authoritative categoryCounts if available
    document.getElementById('totalTasks').innerText = totalTasks;
    document.getElementById('totalCompleted').innerText = (categoryCounts && categoryCounts.done) ? categoryCounts.done : completed;
    document.getElementById('totalPending').innerText = (categoryCounts && (categoryCounts.todo || categoryCounts.in_progress)) ? ((parseInt(categoryCounts.todo,10)||0) + (parseInt(categoryCounts.in_progress,10)||0)) : pending;
    document.getElementById('totalOverdue').innerText = (categoryCounts && categoryCounts.overdue) ? categoryCounts.overdue : overdueCount;

    // Debug: log upcoming tasks received from API and show on-page debug panel
    try { console.debug('loadMetrics: upcoming count', (upcoming || []).length, upcoming ? upcoming.slice(0,5) : upcoming); } catch (e) {}
    // Update on-page debug panel for easier visibility during development
    try { updateDebugPanel({ upcoming, recentMissed, overdueCount, statuses, priorities, projects }); } catch (e) { console.debug('updateDebugPanel failed', e); }
    // Render upcoming tasks
    renderUpcomingTasks(upcoming);
    // Render recently missed tasks
    renderRecentMissed(recentMissed);
    // Render simple stats
    renderStats(priorities, 'priorityStats');
    renderStats(statuses, 'statusStats');
    renderProjectStats(projects, 'projectStats');
    // Render recent changes
    renderRecentChanges(recentChanges);
    // Render charts (Chart.js)
    try { renderCharts(priorities, statuses, projects); } catch (e) { console.warn('renderCharts failed', e); }

    } catch (err) {
    console.error('Error loading dashboard metrics:', err);
  } finally {
    try { console.debug('loadMetrics: end'); } catch (e) {}
  }
}

// ---------------- Debug panel helpers ----------------
function updateDebugPanel(summary) {
  try {
    const id = 'dashboardDebugPanel';
    let panel = document.getElementById(id);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = id;
      panel.style.position = 'fixed';
      panel.style.right = '12px';
      panel.style.bottom = '12px';
      panel.style.zIndex = 9999;
      panel.style.background = 'rgba(0,0,0,0.75)';
      panel.style.color = '#fff';
      panel.style.fontSize = '12px';
      panel.style.padding = '10px';
      panel.style.borderRadius = '6px';
      panel.style.maxWidth = '320px';
      panel.style.maxHeight = '40vh';
      panel.style.overflow = 'auto';
      panel.style.boxShadow = '0 6px 18px rgba(0,0,0,0.5)';
      const header = document.createElement('div');
      header.style.fontWeight = '600';
      header.style.marginBottom = '6px';
      header.innerText = 'Dashboard Debug';
      panel.appendChild(header);
      const body = document.createElement('div');
      body.id = id + '_body';
      panel.appendChild(body);
      const btn = document.createElement('button');
      btn.innerText = '⨉';
      btn.title = 'Close debug panel';
      btn.style.position = 'absolute';
      btn.style.top = '6px';
      btn.style.right = '8px';
      btn.style.background = 'transparent';
      btn.style.color = '#fff';
      btn.style.border = 'none';
      btn.style.cursor = 'pointer';
      btn.onclick = () => panel.remove();
      panel.appendChild(btn);
      document.body.appendChild(panel);
    }
    const body = document.getElementById(id + '_body');
    if (!body) return;
    const upcoming = summary && summary.upcoming ? summary.upcoming : [];
    const recentMissed = summary && summary.recentMissed ? summary.recentMissed : [];
    const overdue = typeof summary.overdueCount !== 'undefined' ? summary.overdueCount : 'N/A';
    const statuses = summary.statuses || [];
    const now = new Date().toLocaleString();
    let html = `<div><small>Refreshed: ${now}</small></div>`;
    html += `<div style="margin-top:6px"><strong>Upcoming:</strong> ${upcoming.length}</div>`;
    if (upcoming.length > 0) {
      html += '<ol style="margin:6px 0 0 16px;padding:0">';
      upcoming.slice(0,6).forEach(t => {
        const due = t.due_date ? new Date(t.due_date).toLocaleString() : '—';
        html += `<li style="margin-bottom:4px"><small>${escapeHtml(t.title || t.task_id)} <span style=\"color:#9ca3af\">• ${due}</span></small></li>`;
      });
      html += '</ol>';
    }
    html += `<div style="margin-top:8px"><small>OverdueCount: ${overdue}</small></div>`;
    html += `<div style="margin-top:6px"><small>Statuses: ${statuses.length}</small></div>`;
    try {
      html += `<div style="margin-top:6px"><small>Recent Missed: ${recentMissed.length}</small></div>`;
    } catch (e) {}
    body.innerHTML = html;
  } catch (e) { console.debug('updateDebugPanel error', e); }
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ================= Render Recent Tasks =================
function renderRecentTasks(tasks) {
  const ul = document.getElementById('recentTasks');
  if (!ul) return;

  ul.innerHTML = '';
  tasks.forEach(t => {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-start';
    li.innerHTML = `
      <div>
        <div><strong>${t.title}</strong></div>
        <small>${t.project?.project_name || '—'} • ${t.priority?.name || ''}</small>
      </div>
      <div>
        <small>${new Date(t.due_date?.date || t.created_at).toLocaleDateString()}</small>
      </div>
    `;
    li.addEventListener('click', () => {
      window.location.href = `/task-detail.html?id=${t.task_id}`;
    });
    ul.appendChild(li);
  });
}

function renderUpcomingTasks(tasks) {
  const ul = document.getElementById('recentTasks');
  if (!ul) return;
  // Reuse recentTasks list for upcoming tasks if recent list is not separately present
  ul.innerHTML = '';
  tasks.forEach(t => {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-start';
    li.innerHTML = `
      <div>
        <div><strong>${t.title}</strong></div>
        <small>${t.project || '—'} • ${t.priority || ''}</small>
      </div>
      <div>
        <small>${new Date(t.due_date).toLocaleString()}</small>
      </div>
    `;
    li.addEventListener('click', () => { window.location.href = `/task-detail.html?id=${t.task_id}`; });
    ul.appendChild(li);
  });
}

function renderRecentMissed(tasks) {
  const ul = document.getElementById('recentMissed');
  if (!ul) return;
  ul.innerHTML = '';
  tasks.forEach(t => {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-start';
    li.innerHTML = `
      <div>
        <div><strong>${t.title}</strong></div>
        <small>${t.project || '—'} • ${t.priority || ''}</small>
      </div>
      <div>
        <small>${new Date(t.due_date).toLocaleString()}</small>
      </div>
    `;
    li.addEventListener('click', () => { window.location.href = `/task-detail.html?id=${t.task_id}`; });
    ul.appendChild(li);
  });
}

function renderStats(rows, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  rows.forEach(r => {
    const name = r.priority || r.status || r.project || '—';
    const count = parseInt(r.count, 10) || 0;
    const li = document.createElement('div');
    li.className = 'd-flex justify-content-between py-1';
    li.innerHTML = `<small>${name}</small><strong>${count}</strong>`;
    el.appendChild(li);
  });
}

function renderProjectStats(rows, containerId) {
  renderStats(rows, containerId);
}

function renderRecentChanges(changes) {
  const el = document.getElementById('recentChanges');
  if (!el) return;
  el.innerHTML = '';
  changes.forEach(c => {
    const div = document.createElement('div');
    div.className = 'mb-2';
    div.innerHTML = `<div><strong>Task ${c.task_id}</strong> • ${c.field}</div><small>${c.old_value || ''} → ${c.new_value || ''} • ${new Date(c.createdAt).toLocaleString()}</small>`;
    el.appendChild(div);
  });
}

// ---------------- Chart helpers ----------------
let _priorityChart = null;
let _statusChart = null;
let _projectChart = null;

function ensureChartDestroyed(chart) {
  try { if (chart && chart.destroy) chart.destroy(); } catch (e) {}
}

function renderCharts(priorities, statuses, projects) {
  // priorities: [{ priority: 'High', count: 5 }, ...]
  const prLabels = priorities.map(r => r.priority || r.label || '—');
  const prData = priorities.map(r => parseInt(r.count, 10) || 0);

  const stLabels = statuses.map(r => r.status || r.label || '—');
  const stData = statuses.map(r => parseInt(r.count, 10) || 0);

  const pjLabels = projects.map(r => r.project || r.project_name || '—');
  const pjData = projects.map(r => parseInt(r.count, 10) || 0);
  // Aggregate projects: limit to top N, group rest as 'Others'
  const TOP_N = 8;
  const projPairs = projects.map(r => ({ name: r.project || r.project_name || '—', count: parseInt(r.count,10)||0 }));
  projPairs.sort((a,b) => b.count - a.count);
  let pjFinalLabels = [];
  let pjFinalData = [];
  if (projPairs.length <= TOP_N) {
    pjFinalLabels = projPairs.map(p => p.name);
    pjFinalData = projPairs.map(p => p.count);
  } else {
    const top = projPairs.slice(0, TOP_N);
    const rest = projPairs.slice(TOP_N);
    const othersSum = rest.reduce((s,x) => s + x.count, 0);
    pjFinalLabels = top.map(p => p.name).concat(['Others']);
    pjFinalData = top.map(p => p.count).concat([othersSum]);
  }
  // Priority chart (doughnut)
  ensureChartDestroyed(_priorityChart);
  const prCtx = document.getElementById('priorityChart')?.getContext('2d');
  if (prCtx && window.Chart) {
    _priorityChart = new Chart(prCtx, {
      type: 'doughnut',
      data: { labels: prLabels, datasets: [{ data: prData, backgroundColor: generateColors(prLabels.length) }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  // Status chart (bar)
  ensureChartDestroyed(_statusChart);
  const stCtx = document.getElementById('statusChart')?.getContext('2d');
  if (stCtx && window.Chart) {
    _statusChart = new Chart(stCtx, {
      type: 'bar',
      data: { labels: stLabels, datasets: [{ label: 'Tasks', data: stData, backgroundColor: generateColors(stLabels.length) }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  // Project chart (horizontal bar)
  ensureChartDestroyed(_projectChart);
  const pjCtx = document.getElementById('projectChart')?.getContext('2d');
  if (pjCtx && window.Chart) {
    _projectChart = new Chart(pjCtx, {
      type: 'bar',
      data: { labels: pjFinalLabels, datasets: [{ label: 'Tasks', data: pjFinalData, backgroundColor: generateColors(pjFinalLabels.length) }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: true } } }
    });
  }

  // Also render fallback textual stats
  renderStats(priorities, 'priorityStats');
  renderStats(statuses, 'statusStats');
  renderProjectStats(projects, 'projectStats');

  // Wire export buttons
  attachExportButton('priorityExportBtn', _priorityChart, 'priority-chart.png');
  attachExportButton('statusExportBtn', _statusChart, 'status-chart.png');
  attachExportButton('projectExportBtn', _projectChart, 'project-chart.png');
}

function generateColors(n) {
  const base = [ '#60a5fa', '#f97316', '#34d399', '#f472b6', '#f43f5e', '#a78bfa', '#facc15', '#7dd3fc' ];
  const out = [];
  for (let i=0;i<n;i++) out.push(base[i % base.length]);
  return out;
}

function attachExportButton(buttonId, chartInstance, filename) {
  try {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    btn.onclick = () => {
      try {
        if (!chartInstance) return alert('Chart not ready');
        const url = chartInstance.toBase64Image();
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'chart.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (e) {
        console.warn('Export failed', e);
        alert('Export failed: ' + (e.message || e));
      }
    };
  } catch (e) { console.debug('attachExportButton error', e); }
}

// ================= Initialize =================
document.addEventListener('DOMContentLoaded', () => {
  // Load sidebar, header, modal dynamically
  import('../utils/componentLoader.js');

  // Load metrics & recent tasks
  loadMetrics();
});

// expose for debugging/dev to allow manual refresh from console
try { window.loadMetrics = loadMetrics; } catch (e) { console.debug('could not expose loadMetrics', e); }

// Refresh dashboard metrics when tasks change elsewhere in the app
try {
  document.addEventListener('task:created', () => { try { loadMetrics(); } catch (e) { console.warn('reload metrics on task:created failed', e); } });
  document.addEventListener('task:assignment-changed', () => { try { loadMetrics(); } catch (e) { console.warn('reload metrics on task:assignment-changed failed', e); } });
  // storage-based broadcasts from other tabs (optional)
  window.addEventListener('storage', (ev) => {
    try {
      if (!ev || !ev.key) return;
      if (ev.key.startsWith('task:') || ev.key === 'task:assign') {
        setTimeout(() => { try { loadMetrics(); } catch (_) {} }, 100);
      }
    } catch (e) {}
  });
} catch (e) { console.debug('dashboard event wiring failed', e); }