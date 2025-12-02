import { taskApi } from '../api/taskApi.js';
import { requireAuthRedirect } from '../utils/auth.js';
import { apiRequest } from '../utils/request.js';

requireAuthRedirect();

const state = { filters: {}, page: 1, perPage: 20, query: '', view: 'weekly', sortBy: 'due', sortDir: 'asc', total: 0, selected: new Set(), currentDate: new Date() };

async function loadTasks() {
  try {
    const params = buildQueryParams();
    const res = await taskApi.list(params);
    // backend returns { total, page, pageSize, tasks: [...] }
    // some endpoints return { data: [...] } or raw array — normalize
    let tasks = [];
    if (Array.isArray(res)) tasks = res;
    else if (Array.isArray(res.tasks)) tasks = res.tasks;
    else if (Array.isArray(res.data)) tasks = res.data;
    else if (Array.isArray(res.tasks || res.data)) tasks = res.tasks || res.data;
    renderTaskList(tasks || []);
    renderTableView(tasks || []);
    renderCalendarEvents(tasks || []);
  } catch (e) {
    console.error('Error loading tasks', e);
  }
}

function buildQueryParams() {
  const parts = [];
  if (state.query) parts.push(`search=${encodeURIComponent(state.query)}`);
  if (state.filters.priority) parts.push(`priority=${state.filters.priority}`);
  if (state.filters.status) parts.push(`status=${state.filters.status}`);
  parts.push(`page=${state.page}&limit=${state.perPage}`);
  return parts.join('&');
}

// Map a priority name to a bootstrap color string for badge styling
function mapPriorityToColor(name) {
  if (!name) return 'secondary';
  const n = String(name).toLowerCase();
  if (n.includes('high') || n.includes('urgent') || n.includes('critical')) return 'danger';
  if (n.includes('medium') || n.includes('normal')) return 'warning';
  if (n.includes('low') || n.includes('minor')) return 'success';
  return 'secondary';
}

// Determine dominant priority color from an array of tasks
function getDominantPriorityColor(tasks) {
  if (!tasks || tasks.length === 0) return 'primary';
  const weight = (n) => {
    if (!n) return 0;
    const s = String(n).toLowerCase();
    if (s.includes('critical') || s.includes('urgent') || s.includes('high')) return 4;
    if (s.includes('medium') || s.includes('normal')) return 3;
    if (s.includes('low') || s.includes('minor')) return 2;
    return 1;
  };
  let best = null; let bestW = 0;
  tasks.forEach(t => {
    const n = t.priority?.name || t.Priority?.label || t.Priority?.name || null;
    const w = weight(n);
    if (w > bestW) { bestW = w; best = n; }
  });
  return mapPriorityToColor(best);
}

function renderTaskList(tasks) {
  const el = document.getElementById('taskList');
  if (!el) return; // page may not include a task list container
  el.innerHTML = '';
  tasks.forEach(t => {
    const item = document.createElement('div');
    item.className = 'task-item card mb-2 p-2';
    const priorityName = t.priority?.name || t.Priority?.label || t.Priority?.name || '';
    const projectName = t.project?.project_name || t.Project?.project_name || '';
    const dueRaw = t.DueDate?.due_date || t.due_date || (t.due_date && t.due_date.date) || t.createdAt || t.created_at;
    const dueStr = dueRaw ? new Date(dueRaw).toLocaleString() : '';
    item.innerHTML = `
      <div class="d-flex justify-content-between">
        <div>
          <span class="badge bg-${mapPriorityToColor(priorityName)}">${priorityName}</span>
          <a href="/task-detail.html?id=${t.task_id}"><strong>${t.title}</strong></a>
          <div><small>${projectName}</small></div>
        </div>
        <div>
          <small>${dueStr}</small>
        </div>
      </div>`;
    el.appendChild(item);
  });
  }

// Render a table view with sorting, selection and pagination
function renderTableView(tasks) {
  const cont = document.getElementById('taskTable');
  if (!cont) return;
  // build table
  const table = document.createElement('table');
  table.className = 'table table-striped table-sm';
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const headers = [ {k:'select', t:'', sortable:false}, {k:'title', t:'Title', sortable:true}, {k:'project', t:'Project', sortable:true}, {k:'priority', t:'Priority', sortable:true}, {k:'status', t:'Status', sortable:true}, {k:'due', t:'Due date', sortable:true}, {k:'updated', t:'Last updated', sortable:true}, {k:'actions', t:'Actions', sortable:false} ];
  headers.forEach(h => {
    const th = document.createElement('th');
    th.style.whiteSpace = 'nowrap';
    if (h.k === 'select') {
      const cb = document.createElement('input'); cb.type='checkbox'; cb.id='selectAllCb';
      cb.addEventListener('change', (e) => {
        const checked = e.target.checked;
        cont.querySelectorAll('input.task-select-cb').forEach(i => { i.checked = checked; const id = i.getAttribute('data-id'); if (checked) state.selected.add(id); else state.selected.delete(id); });
      });
      th.appendChild(cb);
    } else {
      th.textContent = h.t;
      if (h.sortable) {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => { toggleSort(h.k); });
      }
    }
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  // sort tasks according to state.sortBy/sortDir (basic)
  const sorted = tasks.slice().sort((a,b) => {
    const key = state.sortBy;
    let va = '';
    let vb = '';
    if (key === 'title') { va = a.title || ''; vb = b.title || ''; }
    else if (key === 'project') { va = a.project?.project_name || a.Project?.project_name || ''; vb = b.project?.project_name || b.Project?.project_name || ''; }
    else if (key === 'priority') { va = a.priority?.name || a.Priority?.label || ''; vb = b.priority?.name || b.Priority?.label || ''; }
    else if (key === 'status') { va = a.status?.name || a.Status?.label || ''; vb = b.status?.name || b.Status?.label || ''; }
    else if (key === 'due') { va = a.DueDate?.due_date || a.due_date || a.createdAt || ''; vb = b.DueDate?.due_date || b.due_date || b.createdAt || ''; }
    else if (key === 'updated') { va = a.updatedAt || a.updated_at || ''; vb = b.updatedAt || b.updated_at || ''; }
    if (state.sortDir === 'asc') return String(va).localeCompare(String(vb));
    return String(vb).localeCompare(String(va));
  });

  sorted.forEach(t => {
    const tr = document.createElement('tr');
    const id = String(t.task_id || t.id || '');
    // select
    const tdSel = document.createElement('td');
    const cb = document.createElement('input'); cb.type='checkbox'; cb.className='task-select-cb'; cb.setAttribute('data-id', id);
    cb.addEventListener('change', (e) => { if (e.target.checked) state.selected.add(id); else state.selected.delete(id); });
    tdSel.appendChild(cb);
    tr.appendChild(tdSel);
    // title
    const tdTitle = document.createElement('td'); tdTitle.innerHTML = `<a href="/task-detail.html?id=${id}">${escapeHtml(t.title || '')}</a>`; tr.appendChild(tdTitle);
    // project
    const tdProj = document.createElement('td'); tdProj.textContent = t.project?.project_name || t.Project?.project_name || ''; tr.appendChild(tdProj);
    // priority
    const tdPr = document.createElement('td'); tdPr.innerHTML = `<span class="badge bg-${mapPriorityToColor(t.priority?.name || t.Priority?.label || '')}">${escapeHtml(t.priority?.name || t.Priority?.label || '')}</span>`; tr.appendChild(tdPr);
    // status
    const tdSt = document.createElement('td'); tdSt.textContent = t.status?.name || t.Status?.label || ''; tr.appendChild(tdSt);
    // due
    const dueRaw = t.DueDate?.due_date || t.due_date || t.createdAt || t.created_at;
    const tdDue = document.createElement('td'); tdDue.textContent = dueRaw ? new Date(dueRaw).toLocaleString() : ''; tr.appendChild(tdDue);
    // updated
    const tdUpd = document.createElement('td'); tdUpd.textContent = t.updatedAt ? new Date(t.updatedAt).toLocaleString() : (t.updated_at ? new Date(t.updated_at).toLocaleString() : ''); tr.appendChild(tdUpd);
    // actions
    const tdAct = document.createElement('td'); tdAct.innerHTML = `<button class="btn btn-sm btn-link" data-id="${id}" data-action="view">View</button> <button class="btn btn-sm btn-link" data-id="${id}" data-action="edit">Edit</button> <button class="btn btn-sm btn-link text-danger" data-id="${id}" data-action="delete">Delete</button>`; tr.appendChild(tdAct);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  cont.innerHTML = '';
  cont.appendChild(table);

  // actions handler
  cont.querySelectorAll('button[data-action]').forEach(b => {
    b.addEventListener('click', async (e) => {
      const id = b.getAttribute('data-id');
      const action = b.getAttribute('data-action');
      if (action === 'view') return window.location.href = `/task-detail.html?id=${id}`;
      if (action === 'edit') return alert('Edit not implemented in this UI');
      if (action === 'delete') {
        if (!confirm('Delete this task?')) return;
        try { await taskApi.delete(id); alert('Deleted'); loadTasks(); } catch (err) { alert('Delete failed: ' + (err.message || err)); }
      }
    });
  });

  renderPagination();
}

function toggleSort(k) {
  if (state.sortBy === k) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc'; else { state.sortBy = k; state.sortDir = 'asc'; }
  loadTasks();
}

function renderPagination() {
  const el = document.getElementById('paginationControls');
  if (!el) return;
  const total = state.total || 0;
  const pages = Math.max(1, Math.ceil(total / state.perPage));
  el.innerHTML = `<div class="btn-group"><button id="pgPrev" class="btn btn-sm btn-outline-secondary">Prev</button><span class="px-2 align-middle">${state.page}/${pages}</span><button id="pgNext" class="btn btn-sm btn-outline-secondary">Next</button></div>`;
  document.getElementById('pgPrev').addEventListener('click', () => { if (state.page>1) { state.page--; loadTasks(); } });
  document.getElementById('pgNext').addEventListener('click', () => { if (state.page<pages) { state.page++; loadTasks(); } });
}

// minimal calendar renderer: mark days with dots
function renderCalendarEvents(tasks) {
  // Compact upcoming-7-days view (today + next 6 days)
  const mini = document.getElementById('miniCalendar');
  if (!mini) return;

  // Normalize tasks by YYYY-MM-DD
  const map = {};
  tasks.forEach(t => {
    const raw = t.DueDate?.due_date || t.due_date || (t.due_date && t.due_date.date) || t.createdAt || t.created_at;
    if (!raw) return;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return;
    const key = d.toISOString().slice(0,10);
    map[key] = map[key] || [];
    map[key].push(t);
  });

  const days = [];
  const today = new Date();
  // days count adjusted by view
  let daysCount = 7;
  if (state.view === 'daily') daysCount = 1;
  if (state.view === 'weekly') daysCount = 7;
  if (state.view === 'monthly') daysCount = 30;
  for (let i = 0; i < daysCount; i++) {
    const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    days.push(dt);
  }

  // render differently for monthly vs weekly/daily
  const isMonthly = state.view === 'monthly';
  let html = `<div class="mini-calendar compact ${isMonthly ? 'monthly' : ''}">`;
  if (!isMonthly) {
    html += '<div class="d-flex justify-content-between align-items-center mb-2"><strong>Upcoming</strong></div>';
    html += '<div class="d-flex gap-2">';
    days.forEach((dt, idx) => {
      const key = dt.toISOString().slice(0,10);
      const tasksOn = map[key] || [];
      const isToday = idx === 0;
      const title = tasksOn.length ? tasksOn.map(t => t.title).join('\n') : 'No tasks';
      html += `<div class="calendar-day ${isToday ? 'today' : ''}" data-day="${key}" title="${escapeHtml(title)}" style="flex:1;min-width:0;">`;
      html += `<div class="day-label">${dt.toLocaleString(undefined,{ weekday: 'short' })}</div>`;
      html += `<div class="day-num">${dt.getDate()}</div>`;
      if (tasksOn.length) html += `<div class="day-badge"><span class="badge bg-primary">${tasksOn.length}</span></div>`;
      // add quick-add button
      html += `<div class="mt-1"><button class="btn btn-sm btn-outline-success add-day-btn" data-day="${key}">+ Add</button></div>`;
      html += `</div>`;
    });
    html += '</div>';
  } else {
    // Monthly grid for current month (or state.currentDate)
    const cur = state.currentDate || new Date();
    const year = cur.getFullYear();
    const month = cur.getMonth();
    const monthName = cur.toLocaleString(undefined, { month: 'long' });
    // header with navigation
    html += `<div class="d-flex justify-content-between align-items-center mb-2"><div><strong>${monthName} ${year}</strong></div><div><button id="calPrevMonth" class="btn btn-sm btn-outline-secondary me-1">&lt;</button><button id="calNextMonth" class="btn btn-sm btn-outline-secondary">&gt;</button></div></div>`;
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = firstOfMonth.getDay(); // 0=Sun
    const gridStart = new Date(year, month, 1 - startWeekday);
    // weekday headers
    const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    html += '<div class="calendar-weekdays">';
    weekdays.forEach(w => { html += `<div class="weekday">${w}</div>`; });
    html += '</div>';
    html += '<div class="calendar-grid">';
    // render 6 weeks (42 days)
    for (let i = 0; i < 42; i++) {
      const dt = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const key = dt.toISOString().slice(0,10);
      const tasksOn = map[key] || [];
      const isOther = dt.getMonth() !== month;
      const title = tasksOn.length ? tasksOn.map(t => t.title).join('\n') : 'No tasks';
      const color = getDominantPriorityColor(tasksOn) || 'primary';
      html += `<div class="calendar-day ${isOther ? 'other-month' : ''}" data-day="${key}" title="${escapeHtml(title)}">`;
      html += `<div class="day-num">${dt.getDate()}</div>`;
      if (tasksOn.length) html += `<div class="day-badge"><span class="badge bg-${color}">${tasksOn.length}</span></div>`;
      html += `<div class="mt-1" style="width:100%;display:flex;justify-content:flex-end;"><button class="btn btn-sm btn-outline-${color} add-day-btn" data-day="${key}">+ Add</button></div>`;
      html += `</div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  mini.innerHTML = html;

  // Attach click handlers
  mini.querySelectorAll('.calendar-day').forEach(el => {
    el.addEventListener('click', () => {
      const day = el.getAttribute('data-day');
      showTasksForDate(day, map[day] || []);
    });
  });

  // add-day buttons open New Task modal prefilled
  mini.querySelectorAll('.add-day-btn').forEach(b => {
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const day = b.getAttribute('data-day');
      document.dispatchEvent(new CustomEvent('openNewTask', { detail: { date: day } }));
    });
  });

  // prev/next month handlers (only for monthly view)
  const prev = document.getElementById('calPrevMonth');
  const next = document.getElementById('calNextMonth');
  if (prev) prev.addEventListener('click', (ev) => { ev.stopPropagation(); const d = state.currentDate || new Date(); d.setMonth(d.getMonth() - 1); state.currentDate = new Date(d.getFullYear(), d.getMonth(), 1); renderCalendarEvents(tasks); });
  if (next) next.addEventListener('click', (ev) => { ev.stopPropagation(); const d = state.currentDate || new Date(); d.setMonth(d.getMonth() + 1); state.currentDate = new Date(d.getFullYear(), d.getMonth(), 1); renderCalendarEvents(tasks); });
}

// small helper for tooltip-safe content
function escapeHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showTasksForDate(dateStr, tasksForDay) {
  // Render only tasks for the selected date
  const el = document.getElementById('taskList');
  if (!el) return;
  el.innerHTML = `<div class="mb-2"><strong>Tasks for ${new Date(dateStr).toLocaleDateString()}</strong></div>`;
  if (!tasksForDay || tasksForDay.length === 0) { el.innerHTML += '<div>No tasks for this day</div>'; return; }
  tasksForDay.forEach(t => {
    const item = document.createElement('div');
    item.className = 'task-item card mb-2 p-2';
    const priorityName = t.priority?.name || t.Priority?.label || t.Priority?.name || '';
    const projectName = t.project?.project_name || t.Project?.project_name || '';
    const dueRaw = t.DueDate?.due_date || t.due_date || (t.due_date && t.due_date.date) || t.createdAt || t.created_at;
    const dueStr = dueRaw ? new Date(dueRaw).toLocaleString() : '';
    item.innerHTML = `
      <div class="d-flex justify-content-between">
        <div>
          <span class="badge bg-${mapPriorityToColor(priorityName)}">${priorityName}</span>
          <a href="/task-detail.html?id=${t.task_id}"><strong>${t.title}</strong></a>
          <div><small>${projectName}</small></div>
        </div>
        <div>
          <small>${dueStr}</small>
        </div>
      </div>`;
    el.appendChild(item);
  });
}
// Attach search listener only if the input exists

// Attach search listener only if the input exists
const _searchEl = typeof document !== 'undefined' ? document.getElementById('searchInput') : null;
if (_searchEl) {
  _searchEl.addEventListener('input', (e) => {
    state.query = e.target.value;
    loadTasks();
  });
}

document.addEventListener('DOMContentLoaded', loadTasks);

// Initialize UI bindings
document.addEventListener('DOMContentLoaded', () => {
  // view selector
  document.getElementById('viewDaily')?.addEventListener('click', () => { state.view='daily'; loadTasks(); });
  document.getElementById('viewWeekly')?.addEventListener('click', () => { state.view='weekly'; loadTasks(); });
  document.getElementById('viewMonthly')?.addEventListener('click', () => { state.view='monthly'; loadTasks(); });
  // small new task button in mini calendar
  document.getElementById('openNewTaskBtnSmall')?.addEventListener('click', () => document.dispatchEvent(new CustomEvent('openNewTask', { detail: {} })));
  // apply/clear filters
  document.getElementById('applyFilters')?.addEventListener('click', () => {
    state.filters.priority = document.getElementById('filterPriority')?.value || '';
    state.filters.status = document.getElementById('filterStatus')?.value || '';
    state.filters.project = document.getElementById('filterProject')?.value || '';
    state.filters.from = document.getElementById('filterFrom')?.value || '';
    state.filters.to = document.getElementById('filterTo')?.value || '';
    state.filters.mine = document.getElementById('filterMine')?.checked || false;
    state.filters.attachments = document.getElementById('filterAttachments')?.checked || false;
    state.filters.overdue = document.getElementById('filterOverdue')?.checked || false;
    state.page = 1;
    loadTasks();
  });
  document.getElementById('clearFilters')?.addEventListener('click', () => {
    document.getElementById('filterPriority').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterProject').value = '';
    document.getElementById('filterFrom').value = '';
    document.getElementById('filterTo').value = '';
    document.getElementById('filterMine').checked = false;
    document.getElementById('filterAttachments').checked = false;
    document.getElementById('filterOverdue').checked = false;
    state.filters = {};
    state.page = 1;
    loadTasks();
  });

  // bulk actions
  document.getElementById('bulkDelete')?.addEventListener('click', async () => {
    if (state.selected.size === 0) return alert('No tasks selected');
    if (!confirm('Delete selected tasks?')) return;
    const ids = Array.from(state.selected);
    for (const id of ids) {
      try { await taskApi.delete(id); } catch (e) { console.warn('bulk delete failed', id, e); }
    }
    state.selected.clear();
    loadTasks();
  });
  document.getElementById('bulkStatus')?.addEventListener('click', async () => {
    if (state.selected.size === 0) return alert('No tasks selected');
    const val = prompt('Enter status id to set:'); if (!val) return;
    for (const id of Array.from(state.selected)) { try { await taskApi.update(id, { status_id: val }); } catch (e) { console.warn('bulk status failed', id, e); } }
    state.selected.clear(); loadTasks();
  });
  document.getElementById('bulkPriority')?.addEventListener('click', async () => {
    if (state.selected.size === 0) return alert('No tasks selected');
    const val = prompt('Enter priority id to set:'); if (!val) return;
    for (const id of Array.from(state.selected)) { try { await taskApi.update(id, { priority_id: val }); } catch (e) { console.warn('bulk priority failed', id, e); } }
    state.selected.clear(); loadTasks();
  });

  // open new task button wired to modal
  document.getElementById('openNewTaskBtn')?.addEventListener('click', () => document.dispatchEvent(new CustomEvent('openNewTask',{detail:{}})));

  // load filter options (priorities/statuses/projects)
  loadFilterOptions().catch(() => {});
});

// Reload tasks when a new task is created via the modal
document.addEventListener('task:created', () => {
  loadTasks();
});

async function loadFilterOptions() {
  try {
    // priorities/statuses via meta endpoints
    const pri = await apiRequest('meta/priorities', 'GET');
    const priorities = Array.isArray(pri) ? pri : (pri.data || pri || []);
    const selP = document.getElementById('filterPriority'); if (selP && Array.isArray(priorities)) {
      priorities.forEach(p => { const opt = document.createElement('option'); opt.value = p.priority_id; opt.textContent = p.label || p.name; selP.appendChild(opt); });
    }
    // populate bulk priority select as well
    const bulkPr = document.getElementById('bulkPrioritySelect'); if (bulkPr && Array.isArray(priorities)) {
      priorities.forEach(p => { const opt = document.createElement('option'); opt.value = p.priority_id; opt.textContent = p.label || p.name; bulkPr.appendChild(opt); });
    }
  } catch (e) { console.warn('Could not load filter priorities', e); }
  try {
    const st = await apiRequest('meta/statuses', 'GET');
    const statuses = Array.isArray(st) ? st : (st.data || st || []);
    const selS = document.getElementById('filterStatus'); if (selS && Array.isArray(statuses)) {
      statuses.forEach(s => { const opt = document.createElement('option'); opt.value = s.status_id; opt.textContent = s.label || s.name; selS.appendChild(opt); });
    }
    // populate bulk status select as well
    const bulkSt = document.getElementById('bulkStatusSelect'); if (bulkSt && Array.isArray(statuses)) {
      statuses.forEach(s => { const opt = document.createElement('option'); opt.value = s.status_id; opt.textContent = s.label || s.name; bulkSt.appendChild(opt); });
    }
  } catch (e) { console.warn('Could not load filter statuses', e); }
  try {
    const pr = await apiRequest('projects', 'GET');
    const projects = Array.isArray(pr) ? pr : (pr.data || pr || []);
    const selPr = document.getElementById('filterProject'); if (selPr && Array.isArray(projects)) {
      projects.forEach(p => { const opt = document.createElement('option'); opt.value = p.project_id; opt.textContent = p.project_name || p.name; selPr.appendChild(opt); });
    }
  } catch (e) { console.warn('Could not load filter projects', e); }
}

// Bulk apply handlers (dropdown + apply buttons)
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('applyBulkStatus')?.addEventListener('click', async () => {
    const val = document.getElementById('bulkStatusSelect')?.value;
    if (!val) return alert('Select a status first');
    if (state.selected.size === 0) return alert('No tasks selected');
    if (!confirm('Apply status to selected tasks?')) return;
    for (const id of Array.from(state.selected)) { try { await taskApi.update(id, { status_id: val }); } catch (e) { console.warn('bulk apply status failed', id, e); } }
    state.selected.clear(); loadTasks();
  });
  document.getElementById('applyBulkPriority')?.addEventListener('click', async () => {
    const val = document.getElementById('bulkPrioritySelect')?.value;
    if (!val) return alert('Select a priority first');
    if (state.selected.size === 0) return alert('No tasks selected');
    if (!confirm('Apply priority to selected tasks?')) return;
    for (const id of Array.from(state.selected)) { try { await taskApi.update(id, { priority_id: val }); } catch (e) { console.warn('bulk apply priority failed', id, e); } }
    state.selected.clear(); loadTasks();
  });
});
