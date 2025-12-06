import { taskApi } from '../api/taskApi.js';
import { requireAuthRedirect } from '../utils/auth.js';
import { apiRequest } from '../utils/request.js';
import { authProfileApi } from '../api/authApi.js';

requireAuthRedirect();

const state = { filters: {}, page: 1, perPage: 20, query: '', view: 'weekly', sortBy: 'due', sortDir: 'asc', total: 0, selected: new Set(), currentDate: new Date() };
// meta cache to map ids -> labels when association objects are missing
const metaCache = { priorities: null, statuses: null, projects: null };

async function ensureMetaCache() {
  try {
    if (!metaCache.priorities) {
      const p = await apiRequest('meta/priorities', 'GET', null, false);
      metaCache.priorities = Array.isArray(p) ? p : (p.data || p || []);
    }
  } catch (e) { metaCache.priorities = []; console.warn('Could not load priorities for mapping', e); }
  try {
    if (!metaCache.statuses) {
      const s = await apiRequest('meta/statuses', 'GET', null, false);
      metaCache.statuses = Array.isArray(s) ? s : (s.data || s || []);
    }
  } catch (e) { metaCache.statuses = []; console.warn('Could not load statuses for mapping', e); }
  try {
    if (!metaCache.projects) {
      const pr = await apiRequest('projects', 'GET', null, false);
      metaCache.projects = Array.isArray(pr) ? pr : (pr.data || pr || []);
    }
  } catch (e) { metaCache.projects = []; console.warn('Could not load projects for mapping', e); }
}

function lookupPriorityLabelById(id) {
  if (!id) return '';
  const p = (metaCache.priorities || []).find(x => x.priority_id === id);
  return p ? (p.label || p.name || '') : '';
}
function lookupStatusLabelById(id) {
  if (!id) return '';
  const s = (metaCache.statuses || []).find(x => x.status_id === id);
  return s ? (s.label || s.name || '') : '';
}
function lookupProjectNameById(id) {
  if (!id) return '';
  const pr = (metaCache.projects || []).find(x => x.project_id === id);
  return pr ? (pr.project_name || pr.name || '') : '';
}

function lookupProjectInfoById(id) {
  if (!id) return null;
  return (metaCache.projects || []).find(x => String(x.project_id) === String(id) || String(x.id) === String(id)) || null;
}

// Determine if a task is "orphan": no collaborators, no project assignment, and not open to everyone
function isOrphanTask(t) {
  try {
    // collaborators can be provided as array or count
    const hasCollaborators = (Array.isArray(t.Collaborators) && t.Collaborators.length > 0) || (Array.isArray(t.collaborators) && t.collaborators.length > 0) || (t.collaborator_count && Number(t.collaborator_count) > 0) || (t.collaborators_count && Number(t.collaborators_count) > 0);
    if (hasCollaborators) return false;
    // project presence
    const hasProject = !!(t.project_id || (t.Project && (t.Project.project_id || t.Project.id)));
    if (hasProject) {
      // if project exists, check project-level permission for 'everyone'
      const p = lookupProjectInfoById(t.project_id || (t.Project && (t.Project.project_id || t.Project.id)));
      if (p) {
        const perm = String(p.user_permission || p.permission || '').toLowerCase();
        if (perm === 'everyone' || perm === 'public') return false;
      }
      // if project exists but no 'everyone' permission, consider it not orphan w.r.t project (we only mark orphan when no project)
      return false;
    }
    // no collaborators and no project -> orphan
    return true;
  } catch (e) {
    return false;
  }
}

async function loadTasks() {
  try {
    const params = buildQueryParams();
    console.debug('loadTasks: query params ->', params);
    const resRaw = await taskApi.list(params);
    console.debug('loadTasks: API response ->', resRaw);
    // Defensive parsing: some backends return unexpected shapes (null, string, or error object)
    let res = resRaw;
    if (!res) {
      console.warn('loadTasks: API returned empty response');
      res = [];
    } else if (typeof res === 'string') {
      try { res = JSON.parse(res); } catch (err) { console.warn('loadTasks: response not JSON', err); res = []; }
    } else if (typeof res === 'object' && (res.error || res.message) && !Array.isArray(res)) {
      console.error('loadTasks: API returned error payload', res.error || res.message, res);
      const ss = document.getElementById('searchStatus'); if (ss) ss.textContent = `Query: "${state.query}" — API error`; return;
    }
    // ensure we have meta lookups available before rendering
    await ensureMetaCache();
    // backend returns { total, page, pageSize, tasks: [...] }
    // some endpoints return { data: [...] } or raw array — normalize
    let tasks = [];
    if (Array.isArray(res)) tasks = res;
    else if (Array.isArray(res.tasks)) tasks = res.tasks;
    else if (Array.isArray(res.data)) tasks = res.data;
    else if (Array.isArray(res.tasks || res.data)) tasks = res.tasks || res.data;
    // Normalize task objects by filling missing association objects from meta cache
    let normalized = (tasks || []).map(t => {
      const copy = Object.assign({}, t);
      if ((!copy.Priority || Object.keys(copy.Priority).length===0) && copy.priority_id) copy.Priority = { label: lookupPriorityLabelById(copy.priority_id), priority_id: copy.priority_id };
      if ((!copy.Status || Object.keys(copy.Status).length===0) && copy.status_id) copy.Status = { label: lookupStatusLabelById(copy.status_id), status_id: copy.status_id };
      if ((!copy.Project || Object.keys(copy.Project).length===0) && copy.project_id) copy.Project = { project_name: lookupProjectNameById(copy.project_id), project_id: copy.project_id };
      return copy;
    });

    // If the current user is a project manager for any projects, also fetch all tasks
    // from those projects and merge them so managers see all project tasks in their schedule.
    try {
      const mgrProjectIds = (metaCache.projects || []).filter(p => String(p.user_permission || '').toLowerCase() === 'manager').map(p => p.project_id).filter(Boolean);
      if (mgrProjectIds.length) {
        // fetch tasks for each managed project in parallel
        const mgrFetches = mgrProjectIds.map(pid => taskApi.list(`project=${encodeURIComponent(pid)}&limit=1000`));
        const mgrResults = await Promise.all(mgrFetches.map(p => p.catch(e => { console.warn('manager project tasks fetch failed', e); return null; })));
        const mgrTasks = [];
        mgrResults.forEach(r => {
          if (!r) return;
          if (Array.isArray(r)) mgrTasks.push(...r);
          else if (Array.isArray(r.tasks)) mgrTasks.push(...r.tasks);
          else if (Array.isArray(r.data)) mgrTasks.push(...r.data);
        });
        if (mgrTasks.length) {
          // merge manager tasks with primary set, dedupe by task_id
          const map = new Map();
          normalized.forEach(t => { const id = String(t.task_id || t.id || ''); if (id) map.set(id, t); });
          mgrTasks.forEach(t => { const id = String(t.task_id || t.id || ''); if (!id) return; if (!map.has(id)) map.set(id, t); });
          normalized = Array.from(map.values());
          // adjust total count for pagination display when possible
          try { state.total = normalized.length; } catch (e) {}
        }
      }
    } catch (e) { console.warn('Could not merge manager project tasks', e); }

    // client-side orphan filter (when user checks the Orphan tasks checkbox)
    if (state.filters.orphan) {
      normalized = normalized.filter(isOrphanTask);
    }

    renderTaskList(normalized);
    renderTableView(normalized);
    renderCalendarEvents(normalized);
    // update search status indicator (debug helper)
    const ss = document.getElementById('searchStatus');
    if (ss) ss.textContent = `Query: "${state.query}" — ${normalized.length} tasks`;
    // update total for pagination
    try { state.total = res && (res.total || res.count || 0); } catch (e) { state.total = normalized.length; }
  } catch (e) {
    console.error('Error loading tasks', e);
    const ss = document.getElementById('searchStatus'); if (ss) ss.textContent = `Query: "${state.query}" — error`;
  }
}

function buildQueryParams() {
  const parts = [];
  if (state.query) parts.push(`search=${encodeURIComponent(state.query)}`);
  if (state.filters.priority) parts.push(`priority=${encodeURIComponent(state.filters.priority)}`);
  if (state.filters.status) parts.push(`status=${encodeURIComponent(state.filters.status)}`);
  if (state.filters.project) parts.push(`project=${encodeURIComponent(state.filters.project)}`);
  if (state.filters.from) parts.push(`from=${encodeURIComponent(state.filters.from)}`);
  if (state.filters.to) parts.push(`to=${encodeURIComponent(state.filters.to)}`);
  if (state.filters.mine) parts.push(`mine=true`);
  if (state.filters.attachments) parts.push(`attachments=true`);
  if (state.filters.overdue) parts.push(`overdue=true`);
  if (state.filters.type) parts.push(`type=${encodeURIComponent(state.filters.type)}`);
  // sorting
  if (state.sortBy) parts.push(`sort_by=${encodeURIComponent(state.sortBy)}`);
  if (state.sortDir) parts.push(`order=${encodeURIComponent(state.sortDir)}`);
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
    const id = String(t.task_id || t.id || '');
    // add a checkbox for bulk selection in list view
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'task-select-cb me-2'; cb.setAttribute('data-id', id);
    try { cb.checked = state.selected.has(id); } catch (e) {}
    cb.addEventListener('change', (e) => { if (e.target.checked) state.selected.add(id); else state.selected.delete(id); updateSelectionCount(); });
    const projectName = t.project?.project_name || t.Project?.project_name || lookupProjectNameById(t.project_id || (t.Project && (t.Project.project_id || t.Project.id))) || '';
    const projectInfo = lookupProjectInfoById(t.project_id || (t.Project && (t.Project.project_id || t.Project.id)));
    let projectHtml = escapeHtml(projectName || '');
    if (projectInfo) {
      const isGroup = projectInfo.is_group || projectInfo.type === 'group' || projectInfo.team_id;
      // Show a group/team badge only when the project is a group/team project.
      if (isGroup) projectHtml += ` <span class="badge bg-info ms-1">Group</span>`;
      if (projectInfo.user_permission) {
        const perm = String(projectInfo.user_permission || '').toLowerCase();
        const permColor = perm.includes('owner') ? 'primary' : perm.includes('write') || perm.includes('edit') ? 'warning' : perm.includes('read') ? 'success' : 'secondary';
        projectHtml += ` <span class="badge bg-${permColor} ms-1">${escapeHtml(projectInfo.user_permission)}</span>`;
      }
    }
    const dueRaw = t.DueDate?.due_date || t.due_date || (t.due_date && t.due_date.date) || t.createdAt || t.created_at;
    const dueStr = dueRaw ? new Date(dueRaw).toLocaleString() : '';
    // determine status icon
    const statusLabel = (t.Status && (t.Status.label || t.Status.name)) || (t.status && (t.status.label || t.status.name)) || '';
    const mapStatusToIcon = (label) => {
      const s = String(label || '').toLowerCase();
      if (s.includes('done') || s.includes('completed')) return '/assets/icons/done.png';
      if (s.includes('in progress') || s.includes('progress')) return '/assets/icons/in-progress.png';
      // default to to-do
      return '/assets/icons/to-do.png';
    };
    const statusIcon = mapStatusToIcon(statusLabel);

    item.innerHTML = `
      <div class="d-flex justify-content-between">
        <div class="d-flex align-items-start">
          <div class="me-2" style="margin-top:6px;"></div>
          <div>
            <div class="d-flex align-items-center mb-1">
              <img src="${statusIcon}" alt="status" title="${escapeHtml(statusLabel||'to-do')}" style="width:18px;height:18px;margin-right:8px;"/>
              <span class="badge bg-${mapPriorityToColor(priorityName)} me-2">${priorityName}</span>
              <a href="/task-detail.html?id=${t.task_id}"><strong>${escapeHtml(t.title)}</strong></a>
            </div>
            <div><small>${projectHtml}${isOrphanTask(t) ? ' <span class="badge bg-danger ms-1">Unassigned</span>' : ''}</small></div>
          </div>
        </div>
        <div>
          <small>${dueStr}</small>
        </div>
      </div>`;
    // prepend checkbox
    const left = document.createElement('div'); left.className = 'd-flex align-items-center mb-2'; left.appendChild(cb); left.appendChild(item);
    el.appendChild(left);
  });
  // update selection badge once after rendering the list
  updateSelectionCount();
  }

function updateSelectionCount() {
  const controls = document.getElementById('taskControls');
  if (!controls) return;
  let badge = document.getElementById('selectedCount');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'selectedCount';
    badge.className = 'small text-muted ms-3 align-self-center';
    const paginationEl = document.getElementById('paginationControls');
    // Prefer inserting before paginationControls only when it's actually a child of `controls`.
    // Use a strict parentNode check and robust try/catch fallback to avoid DOM NotFoundError
    try {
      if (paginationEl && paginationEl.parentNode === controls) {
        controls.insertBefore(badge, paginationEl);
      } else {
        controls.appendChild(badge);
      }
    } catch (insErr) {
      console.warn('Could not insert selectedCount before paginationControls, appending instead', insErr);
      try { controls.appendChild(badge); } catch (_) { /* swallow */ }
    }
  }
  const n = state.selected.size;
  badge.innerText = n === 0 ? 'No tasks selected' : `${n} selected`;
  // enable/disable bulk action controls based on selection
  const applyBulkStatusBtn = document.getElementById('applyBulkStatus');
  const applyBulkPriorityBtn = document.getElementById('applyBulkPriority');
  const bulkDeleteBtn = document.getElementById('bulkDelete');
  const bulkStatusSel = document.getElementById('bulkStatusSelect');
  const bulkPrioritySel = document.getElementById('bulkPrioritySelect');
  const enabled = n > 0;
  if (applyBulkStatusBtn) applyBulkStatusBtn.disabled = !enabled;
  if (applyBulkPriorityBtn) applyBulkPriorityBtn.disabled = !enabled;
  if (bulkDeleteBtn) bulkDeleteBtn.disabled = !enabled;
  if (bulkStatusSel) bulkStatusSel.disabled = !enabled;
  if (bulkPrioritySel) bulkPrioritySel.disabled = !enabled;
}

// Render a table view with sorting, selection and pagination
function renderTableView(tasks) {
  const cont = document.getElementById('taskTable');
  if (!cont) return;
  // build table (use non-compact table and responsive wrapper)
  const table = document.createElement('table');
  table.className = 'table table-striped';
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const headers = [ {k:'select', t:'', sortable:false}, {k:'title', t:'Title', sortable:true}, {k:'project', t:'Project', sortable:true}, {k:'priority', t:'Priority', sortable:true}, {k:'status', t:'Status', sortable:true}, {k:'due', t:'Due date', sortable:true}, {k:'updated', t:'Last updated', sortable:true}, {k:'actions', t:'Actions', sortable:false} ];
  headers.forEach(h => {
    const th = document.createElement('th');
    // allow wrapping for most columns to avoid truncation on narrow screens
  th.style.whiteSpace = (h.k === 'select' || h.k === 'actions') ? 'nowrap' : 'normal';
    // prefer wider title column so inline editing has space
    if (h.k === 'title') { th.style.width = '40%'; th.style.minWidth = '220px'; }
    if (h.k === 'project') { th.style.width = '15%'; }
    if (h.k === 'priority') { th.style.width = '10%'; }
    if (h.k === 'status') { th.style.width = '8%'; }
    if (h.k === 'due') { th.style.width = '12%'; }
    if (h.k === 'updated') { th.style.width = '10%'; }
    if (h.k === 'select') {
      const cb = document.createElement('input'); cb.type='checkbox'; cb.id='selectAllCb';
        cb.addEventListener('change', (e) => {
          const checked = e.target.checked;
          cont.querySelectorAll('input.task-select-cb').forEach(i => { i.checked = checked; const id = i.getAttribute('data-id'); if (checked) state.selected.add(id); else state.selected.delete(id); });
          updateSelectionCount();
        });
      th.appendChild(cb);
    } else {
      th.textContent = h.t;
      // Ensure the Project header looks and behaves as a sortable clickable column
      if (h.k === 'project') {
        th.style.whiteSpace = 'normal';
        th.style.width = '15%';
        th.style.cursor = 'pointer';
        th.title = 'Sort by project';
      }
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
    const cbSel = document.createElement('input'); cbSel.type='checkbox'; cbSel.className='task-select-cb'; cbSel.setAttribute('data-id', id);
    // restore checkbox state from selection set
    try { cbSel.checked = state.selected.has(id); } catch (e) {}
    cbSel.addEventListener('change', (e) => { if (e.target.checked) state.selected.add(id); else state.selected.delete(id); updateSelectionCount(); });
    tdSel.appendChild(cbSel);
    tr.appendChild(tdSel);
    // title
    const tdTitle = document.createElement('td'); tdTitle.style.minWidth = '220px'; tdTitle.style.width = '40%'; tdTitle.innerHTML = `<a href="/task-detail.html?id=${id}">${escapeHtml(t.title || '')}</a>`; tr.appendChild(tdTitle);
    // project (show name + individual/group + permission badge when available)
    const tdProj = document.createElement('td'); tdProj.style.width = '15%';
    const projName = t.project?.project_name || t.Project?.project_name || lookupProjectNameById(t.project_id || (t.Project && (t.Project.project_id || t.Project.id))) || '';
    const projInfo = lookupProjectInfoById(t.project_id || (t.Project && (t.Project.project_id || t.Project.id)));
    let projHtml = escapeHtml(projName || '');
    if (projInfo) {
      // group indicator: show only when this is a group/team project
      const isGroup = projInfo.is_group || projInfo.type === 'group' || projInfo.team_id;
      if (isGroup) projHtml += ` <span class="badge bg-info ms-1">Group</span>`;
      // user permission (if provided by backend in meta)
      if (projInfo.user_permission) {
        const perm = String(projInfo.user_permission || '').toLowerCase();
        const permColor = perm.includes('owner') ? 'primary' : perm.includes('write') || perm.includes('edit') ? 'warning' : perm.includes('read') ? 'success' : 'secondary';
        projHtml += ` <span class="badge bg-${permColor} ms-1">${escapeHtml(projInfo.user_permission)}</span>`;
      }
    }
    tdProj.innerHTML = projHtml;
    tr.appendChild(tdProj);
    // priority (editable select)
    const tdPr = document.createElement('td');
    const prSelect = document.createElement('select');
    prSelect.className = 'form-select';
    prSelect.style.minWidth = '140px';
    // populate options from metaCache (ensureMetaCache ran before)
    const priOptions = Array.isArray(metaCache.priorities) ? metaCache.priorities : [];
    const currentPrId = t.priority_id || (t.Priority && (t.Priority.priority_id || t.Priority.id));
    // empty option
    const emptyPr = document.createElement('option'); emptyPr.value = ''; emptyPr.textContent = '—'; prSelect.appendChild(emptyPr);
    priOptions.forEach(p => {
      const opt = document.createElement('option'); opt.value = p.priority_id || p.id || '';
      const label = p.label || p.name || '';
      // lightweight emoji mapping
      let emoji = '🔹';
      const ln = String(label || '').toLowerCase();
      if (ln.includes('high') || ln.includes('urgent') || ln.includes('critical')) emoji = '🔥';
      else if (ln.includes('medium') || ln.includes('normal')) emoji = '⚠️';
      else if (ln.includes('low') || ln.includes('minor')) emoji = '🟢';
      opt.textContent = `${emoji} ${label}`.trim();
      if (String(opt.value) === String(currentPrId)) opt.selected = true;
      prSelect.appendChild(opt);
    });
    prSelect.addEventListener('change', async (ev) => {
      const val = ev.target.value;
      prSelect.disabled = true;
      try {
        await taskApi.update(id, { priority_id: val || null });
      } catch (err) {
        alert('Failed to update priority: ' + (err.message || err));
      } finally { prSelect.disabled = false; }
    });
    tdPr.appendChild(prSelect);
    tr.appendChild(tdPr);
    // status (editable select)
    const tdSt = document.createElement('td');
    const stSelect = document.createElement('select');
    stSelect.className = 'form-select';
    stSelect.style.minWidth = '140px';
    const stOptions = Array.isArray(metaCache.statuses) ? metaCache.statuses : [];
    const currentStId = t.status_id || (t.Status && (t.Status.status_id || t.Status.id));
    const emptySt = document.createElement('option'); emptySt.value = ''; emptySt.textContent = '—'; stSelect.appendChild(emptySt);
    stOptions.forEach(s => {
      const opt = document.createElement('option'); opt.value = s.status_id || s.id || '';
      const label = s.label || s.name || '';
      let emoji = '📝';
      const ln = String(label || '').toLowerCase();
      if (ln.includes('done') || ln.includes('completed')) emoji = '✅';
      else if (ln.includes('in progress') || ln.includes('progress')) emoji = '⏳';
      else if (ln.includes('blocked')) emoji = '⛔';
      opt.textContent = `${emoji} ${label}`.trim();
      if (String(opt.value) === String(currentStId)) opt.selected = true;
      stSelect.appendChild(opt);
    });
    stSelect.addEventListener('change', async (ev) => {
      const val = ev.target.value;
      stSelect.disabled = true;
      try {
        await taskApi.update(id, { status_id: val || null });
      } catch (err) {
        alert('Failed to update status: ' + (err.message || err));
      } finally { stSelect.disabled = false; }
    });
    tdSt.appendChild(stSelect);
    tr.appendChild(tdSt);
    // due
    const dueRaw = t.DueDate?.due_date || t.due_date || t.createdAt || t.created_at;
    const tdDue = document.createElement('td'); tdDue.textContent = dueRaw ? new Date(dueRaw).toLocaleString() : ''; tr.appendChild(tdDue);
    // updated
    const tdUpd = document.createElement('td'); tdUpd.textContent = t.updatedAt ? new Date(t.updatedAt).toLocaleString() : (t.updated_at ? new Date(t.updated_at).toLocaleString() : ''); tr.appendChild(tdUpd);
    // actions
    const tdAct = document.createElement('td');
    const viewBtn = document.createElement('button'); viewBtn.className='btn btn-sm btn-link'; viewBtn.textContent='View'; viewBtn.addEventListener('click', () => window.location.href = `/task-detail.html?id=${id}`);
    const editBtn = document.createElement('button'); editBtn.className='btn btn-sm btn-link'; editBtn.textContent='Edit'; editBtn.addEventListener('click', () => enterRowEdit(tr, t));
    const delBtn = document.createElement('button'); delBtn.className='btn btn-sm btn-link text-danger'; delBtn.textContent='Delete'; delBtn.addEventListener('click', async () => {
      if (!confirm('Delete this task?')) return;
      try { await taskApi.delete(id); alert('Deleted'); loadTasks(); } catch (err) { alert('Delete failed: ' + (err.message || err)); }
    });
    tdAct.appendChild(viewBtn); tdAct.appendChild(document.createTextNode(' ')); tdAct.appendChild(editBtn); tdAct.appendChild(document.createTextNode(' ')); tdAct.appendChild(delBtn);
    tr.appendChild(tdAct);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  cont.innerHTML = '';
  // wrap table in a responsive container to allow horizontal scroll if needed
  const wrapper = document.createElement('div'); wrapper.className = 'table-responsive';
  wrapper.appendChild(table);
  cont.appendChild(wrapper);

  // keep header select-all checkbox in sync (checked if all visible rows are selected)
  const selectAll = document.getElementById('selectAllCb');
  if (selectAll) {
    const rowChecks = Array.from(cont.querySelectorAll('input.task-select-cb'));
    selectAll.checked = rowChecks.length > 0 && rowChecks.every(c => c.checked);
    // update selectAll disabled state when no rows
    selectAll.disabled = rowChecks.length === 0;
  }

  // actions handler
  cont.querySelectorAll('button[data-action]').forEach(b => {
    b.addEventListener('click', async (e) => {
      const id = b.getAttribute('data-id');
      const action = b.getAttribute('data-action');
      if (action === 'view') return window.location.href = `/task-detail.html?id=${id}`;
      if (action === 'edit') return window.location.href = `/task-detail.html?id=${id}&edit=1`;
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

function toLocalDatetimeValue(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function enterRowEdit(tr, task) {
  if (!tr || tr.dataset.editing === '1') return;
  tr.dataset.editing = '1';
  const id = String(task.task_id || task.id || '');
  // cell indexes: 0=select,1=title,2=project,3=priority,4=status,5=due,6=updated,7=actions
  const tdTitle = tr.children[1];
  const tdProj = tr.children[2];
  const tdDue = tr.children[5];
  const tdAct = tr.children[7];
  // backup original content
  const origTitle = tdTitle.innerHTML;
  const origProj = tdProj.innerHTML;
  const origDue = tdDue.innerHTML;

  // title input
  tdTitle.innerHTML = '';
  const titleInput = document.createElement('input'); titleInput.type = 'text'; titleInput.className = 'form-control'; titleInput.value = task.title || '';
  tdTitle.appendChild(titleInput);

  // project select
  tdProj.innerHTML = '';
  const projSelect = document.createElement('select'); projSelect.className = 'form-select'; projSelect.style.minWidth = '160px';
  const projects = Array.isArray(metaCache.projects) ? metaCache.projects : [];
  const emptyOpt = document.createElement('option'); emptyOpt.value = ''; emptyOpt.textContent = '—'; projSelect.appendChild(emptyOpt);
  projects.forEach(p => { const opt = document.createElement('option'); opt.value = p.project_id || p.id || ''; opt.textContent = p.project_name || p.name || ''; if (String(opt.value) === String(task.project_id || (task.Project && (task.Project.project_id || task.Project.id)))) opt.selected = true; projSelect.appendChild(opt); });
  tdProj.appendChild(projSelect);

  // due date input (datetime-local)
  tdDue.innerHTML = '';
  const dueInput = document.createElement('input'); dueInput.type = 'datetime-local'; dueInput.className = 'form-control'; dueInput.value = toLocalDatetimeValue(task.DueDate?.due_date || task.due_date || task.createdAt || task.created_at || '');
  tdDue.appendChild(dueInput);

  // actions: replace with Save/Cancel
  tdAct.innerHTML = '';
  const saveBtn = document.createElement('button'); saveBtn.className = 'btn btn-sm btn-primary me-1'; saveBtn.textContent = 'Save';
  const cancelBtn = document.createElement('button'); cancelBtn.className = 'btn btn-sm btn-outline-secondary'; cancelBtn.textContent = 'Cancel';
  tdAct.appendChild(saveBtn); tdAct.appendChild(cancelBtn);

  cancelBtn.addEventListener('click', () => { tr.dataset.editing = '0'; tdTitle.innerHTML = origTitle; tdProj.innerHTML = origProj; tdDue.innerHTML = origDue; tdAct.innerHTML = `<button class="btn btn-sm btn-link" data-id="${id}" data-action="view">View</button> <button class="btn btn-sm btn-link" data-id="${id}" data-action="edit">Edit</button> <button class="btn btn-sm btn-link text-danger" data-id="${id}" data-action="delete">Delete</button>`; loadTasks(); });

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true; cancelBtn.disabled = true;
    const payload = { title: titleInput.value || null };
    const projVal = projSelect.value; if (projVal) payload.project_id = projVal; else payload.project_id = null;
    const dueVal = dueInput.value; if (dueVal) payload.due_date = new Date(dueVal).toISOString(); else payload.due_date = null;
    try {
      await taskApi.update(id, payload);
      tr.dataset.editing = '0';
      loadTasks();
    } catch (err) {
      alert('Failed to save: ' + (err.message || err));
      saveBtn.disabled = false; cancelBtn.disabled = false;
    }
  });
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
// On load: determine user role and default to 'mine' for non-admins, then load tasks
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const me = await authProfileApi.me();
    const isAdmin = me && me.role && String(me.role) === 'admin';
    if (!isAdmin && (typeof state.filters.mine === 'undefined' || state.filters.mine === false)) {
      state.filters.mine = true;
      const cb = document.getElementById('filterMine'); if (cb) cb.checked = true;
    }
  } catch (e) { /* ignore profile errors and continue */ }
  loadTasks();
});

// Initialize UI bindings
document.addEventListener('DOMContentLoaded', () => {
  // view selector
  document.getElementById('viewDaily')?.addEventListener('click', () => { state.view='daily'; loadTasks(); });
  document.getElementById('viewWeekly')?.addEventListener('click', () => { state.view='weekly'; loadTasks(); });
  document.getElementById('viewMonthly')?.addEventListener('click', () => { state.view='monthly'; loadTasks(); });
  // search input (debounced)
  const searchEl = document.getElementById('searchInput');
  if (searchEl) {
    const debounce = (fn, wait = 300) => {
      let t = null;
      return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); };
    };
    searchEl.addEventListener('input', debounce((e) => { state.query = e.target.value; state.page = 1; loadTasks(); fetchSuggestions(state.query); }, 300));
    // hide suggestions on escape
    searchEl.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') hideSuggestions(); });
  }
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
    state.filters.orphan = document.getElementById('filterOrphan')?.checked || false;
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
    document.getElementById('filterOrphan') && (document.getElementById('filterOrphan').checked = false);
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

// When a new project is created elsewhere, refresh project filters and tasks
document.addEventListener('project:created', () => {
  try { loadFilterOptions().catch(() => {}); } catch (_) {}
  try { loadTasks(); } catch (_) {}
});

async function loadFilterOptions() {
  try {
    // priorities/statuses via meta endpoints
    const pri = await apiRequest('meta/priorities', 'GET', null, false);
    const priorities = Array.isArray(pri) ? pri : (pri.data || pri || []);
    const selP = document.getElementById('filterPriority');
    const bulkPr = document.getElementById('bulkPrioritySelect');
    // helper to choose an emoji + color for priorities
    const priorityEmojiColor = (name) => {
      const n = String(name || '').toLowerCase();
      if (n.includes('high') || n.includes('urgent') || n.includes('critical')) return {emoji: '🔥', color: 'red'};
      if (n.includes('medium') || n.includes('normal')) return {emoji: '⚠️', color: 'orange'};
      if (n.includes('low') || n.includes('minor')) return {emoji: '🟢', color: 'green'};
      return {emoji: '🔹', color: 'gray'};
    };
    if (Array.isArray(priorities)) {
      priorities.forEach(p => {
        const label = p.label || p.name || '';
        const meta = priorityEmojiColor(label);
        const text = `${meta.emoji} ${label}`.trim();
        if (selP) {
          const opt = document.createElement('option'); opt.value = p.priority_id; opt.textContent = text; try { opt.style.color = meta.color; } catch(_) {};
          selP.appendChild(opt);
        }
        if (bulkPr) {
          const opt2 = document.createElement('option'); opt2.value = p.priority_id; opt2.textContent = text; try { opt2.style.color = meta.color; } catch(_) {};
          bulkPr.appendChild(opt2);
        }
      });
    }
    // fallback: if API returned empty, try metaCache (populated by loadTasks)
    if ((!Array.isArray(priorities) || priorities.length === 0) && Array.isArray(metaCache.priorities) && metaCache.priorities.length) {
      metaCache.priorities.forEach(p => {
        const label = p.label || p.name || '';
        const meta = priorityEmojiColor(label);
        const text = `${meta.emoji} ${label}`.trim();
        if (selP) {
          const opt = document.createElement('option'); opt.value = p.priority_id; opt.textContent = text; try { opt.style.color = meta.color; } catch(_) {};
          selP.appendChild(opt);
        }
        if (bulkPr) {
          const opt2 = document.createElement('option'); opt2.value = p.priority_id; opt2.textContent = text; try { opt2.style.color = meta.color; } catch(_) {};
          bulkPr.appendChild(opt2);
        }
      });
    }
  } catch (e) { console.warn('Could not load filter priorities', e); }
  try {
    const st = await apiRequest('meta/statuses', 'GET', null, false);
    const statuses = Array.isArray(st) ? st : (st.data || st || []);
    const selS = document.getElementById('filterStatus');
    const bulkSt = document.getElementById('bulkStatusSelect');
    // helper to choose emoji + color for statuses
    const statusEmojiColor = (name) => {
      const s = String(name || '').toLowerCase();
      if (s.includes('done') || s.includes('completed')) return {emoji: '✅', color: 'green'};
      if (s.includes('in progress') || s.includes('progress')) return {emoji: '⏳', color: 'orange'};
      if (s.includes('blocked') || s.includes('blocked')) return {emoji: '⛔', color: 'red'};
      return {emoji: '📝', color: 'blue'};
    };
    if (Array.isArray(statuses)) {
      statuses.forEach(s => {
        const label = s.label || s.name || '';
        const meta = statusEmojiColor(label);
        const text = `${meta.emoji} ${label}`.trim();
        if (selS) {
          const opt = document.createElement('option'); opt.value = s.status_id; opt.textContent = text; try { opt.style.color = meta.color; } catch(_) {};
          selS.appendChild(opt);
        }
        if (bulkSt) {
          const opt2 = document.createElement('option'); opt2.value = s.status_id; opt2.textContent = text; try { opt2.style.color = meta.color; } catch(_) {};
          bulkSt.appendChild(opt2);
        }
      });
    }
    // fallback: if API returned empty, try metaCache
    if ((!Array.isArray(statuses) || statuses.length === 0) && Array.isArray(metaCache.statuses) && metaCache.statuses.length) {
      metaCache.statuses.forEach(s => {
        const label = s.label || s.name || '';
        const meta = statusEmojiColor(label);
        const text = `${meta.emoji} ${label}`.trim();
        if (selS) {
          const opt = document.createElement('option'); opt.value = s.status_id; opt.textContent = text; try { opt.style.color = meta.color; } catch(_) {};
          selS.appendChild(opt);
        }
        if (bulkSt) {
          const opt2 = document.createElement('option'); opt2.value = s.status_id; opt2.textContent = text; try { opt2.style.color = meta.color; } catch(_) {};
          bulkSt.appendChild(opt2);
        }
      });
    }
  } catch (e) { console.warn('Could not load filter statuses', e); }
  try {
    const pr = await apiRequest('projects', 'GET', null, false);
    const projects = Array.isArray(pr) ? pr : (pr.data || pr || []);
    // populate metaCache.projects so task rendering can lookup project names
    if (Array.isArray(projects) && projects.length) metaCache.projects = projects;
    const selPr = document.getElementById('filterProject');
    if (selPr && Array.isArray(projects)) {
      projects.forEach(p => {
        const opt = document.createElement('option'); opt.value = p.project_id || p.id || '';
        const isGroup = p.is_group || p.type === 'group' || p.team_id;
        const prefix = isGroup ? '👥 ' : '👤 ';
        opt.textContent = `${prefix}${p.project_name || p.name || ''}`;
        // attach raw data attributes for potential future use
        try { opt.dataset.isGroup = isGroup ? '1' : '0'; } catch(_) {}
        selPr.appendChild(opt);
      });
    }
    // fallback: use metaCache.projects when API returned none
    if ((!Array.isArray(projects) || projects.length === 0) && Array.isArray(metaCache.projects) && metaCache.projects.length) {
      const selPr2 = document.getElementById('filterProject');
      metaCache.projects.forEach(p => {
        const opt = document.createElement('option'); opt.value = p.project_id || p.id || '';
        const isGroup = p.is_group || p.type === 'group' || p.team_id;
        const prefix = isGroup ? '👥 ' : '👤 ';
        opt.textContent = `${prefix}${p.project_name || p.name || ''}`;
        if (selPr2) selPr2.appendChild(opt);
      });
    }
  } catch (e) { console.warn('Could not load filter projects', e); }
}

// Suggestions: fetch a small list of tasks for the current query and show clickable suggestions
async function fetchSuggestions(q) {
  const box = document.getElementById('searchSuggestions');
  if (!box) return;
  if (!q || String(q).trim() === '') { box.style.display = 'none'; box.innerHTML = ''; return; }
  try {
    // request a reasonable candidate set from the API then refine client-side
    const res = await taskApi.list(`search=${encodeURIComponent(q)}&limit=50`);
    let tasks = [];
    if (Array.isArray(res)) tasks = res;
    else if (Array.isArray(res.tasks)) tasks = res.tasks;
    else if (Array.isArray(res.data)) tasks = res.data;
    const ql = String(q).toLowerCase();
    // scoring: lower is better
    const scored = (tasks || []).map(t => {
      const title = String(t.title || '').toLowerCase();
      const proj = String((t.Project && (t.Project.project_name || t.Project.name)) || (t.project && t.project.project_name) || '').toLowerCase();
      let score = 999;
      if (title === ql) score = 0;
      else if (title.startsWith(ql)) score = 1;
      else if (title.includes(' ' + ql)) score = 2;
      else if (title.includes(ql)) score = 3;
      else if (proj.startsWith(ql)) score = 10;
      else if (proj.includes(ql)) score = 11;
      return { t, score };
    }).filter(x => x.score < 999).sort((a,b) => a.score - b.score).slice(0,6).map(x => x.t);
    renderSearchSuggestions(scored || []);
  } catch (err) {
    console.warn('Suggestion fetch failed', err);
    box.style.display = 'none'; box.innerHTML = '';
  }
}

function renderSearchSuggestions(tasks) {
  const box = document.getElementById('searchSuggestions');
  if (!box) return;
  box.innerHTML = '';
  if (!tasks || tasks.length === 0) { box.style.display = 'none'; return; }
  const ql = String(state.query || '').toLowerCase();
  tasks.forEach(t => {
    const id = t.task_id || t.id || '';
    const title = t.title || '(no title)';
    const proj = (t.Project && (t.Project.project_name || t.Project.name)) || (t.project && t.project.project_name) || '';
    // highlight match in title or project
    const hl = (text) => {
      if (!ql) return escapeHtml(text);
      const idx = String(text || '').toLowerCase().indexOf(ql);
      if (idx === -1) return escapeHtml(text);
      const start = escapeHtml(text.slice(0, idx));
      const match = escapeHtml(text.slice(idx, idx + ql.length));
      const end = escapeHtml(text.slice(idx + ql.length));
      return `${start}<mark style="background:rgba(255,235,59,0.5);padding:0 2px;border-radius:2px">${match}</mark>${end}`;
    };
    const item = document.createElement('button');
    item.className = 'list-group-item list-group-item-action';
    item.type = 'button';
    item.innerHTML = `<div class="d-flex justify-content-between align-items-start"><div><strong>${hl(title)}</strong><div class="small text-muted">${hl(proj)}</div></div><small class="text-muted">${t.DueDate?.due_date ? new Date(t.DueDate.due_date || t.DueDate?.due_date).toLocaleDateString() : ''}</small></div>`;
    item.addEventListener('click', () => {
      // navigate to task detail when suggestion clicked
      window.location.href = `/task-detail.html?id=${id}`;
    });
    box.appendChild(item);
  });
  box.style.display = 'block';
}

function hideSuggestions() {
  const box = document.getElementById('searchSuggestions'); if (!box) return; box.style.display = 'none'; box.innerHTML = '';
}

// hide suggestions on outside click
document.addEventListener('click', (ev) => {
  const wrap = document.getElementById('searchWrap');
  const box = document.getElementById('searchSuggestions');
  if (!wrap || !box) return;
  if (!wrap.contains(ev.target)) { hideSuggestions(); }
});

// Bulk apply handlers (dropdown + apply buttons)
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('applyBulkStatus')?.addEventListener('click', async () => {
    const val = document.getElementById('bulkStatusSelect')?.value;
    if (!val) return alert('Select a status first');
    if (state.selected.size === 0) return alert('No tasks selected');
    if (!confirm('Apply status to selected tasks?')) return;
    for (const id of Array.from(state.selected)) { try { await taskApi.update(id, { status_id: val }); } catch (e) { console.warn('bulk apply status failed', id, e); } }
    state.selected.clear(); updateSelectionCount(); loadTasks();
  });
  document.getElementById('applyBulkPriority')?.addEventListener('click', async () => {
    const val = document.getElementById('bulkPrioritySelect')?.value;
    if (!val) return alert('Select a priority first');
    if (state.selected.size === 0) return alert('No tasks selected');
    if (!confirm('Apply priority to selected tasks?')) return;
    for (const id of Array.from(state.selected)) { try { await taskApi.update(id, { priority_id: val }); } catch (e) { console.warn('bulk apply priority failed', id, e); } }
    state.selected.clear(); updateSelectionCount(); loadTasks();
  });
});
