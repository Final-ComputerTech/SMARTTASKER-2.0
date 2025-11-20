import { taskApi } from '../api/taskApi.js';
import { requireAuthRedirect } from '../utils/auth.js';

requireAuthRedirect();

async function loadTask() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) return window.location.href = '/task-schedule.html';
  const res = await taskApi.get(id);
  renderTaskDetail(res);
  // load conversation via taskApi or conversation endpoint (if separate)
}

function renderTaskDetail(t) {
  document.getElementById('taskTitle').innerText = t.title;
  document.getElementById('taskDesc').innerHTML = t.description || '';
  document.getElementById('taskPriority').innerText = t.priority?.name || '';
  // attachments, collaborators render...
}

// comment submit
document.getElementById('commentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const val = e.target.comment.value.trim();
  if (!val) return;
  await taskApi.postComment(taskId, { message: val }); // implement endpoint with backend
  // append to UI
});

document.addEventListener('DOMContentLoaded', loadTask);
