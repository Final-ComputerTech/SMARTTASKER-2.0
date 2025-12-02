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

    // Render upcoming tasks
    renderUpcomingTasks(upcoming);
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
  }
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