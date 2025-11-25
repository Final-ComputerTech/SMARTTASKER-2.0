// services/taskService.js
const Task = require('../models/Task');
const User = require('../models/User');
const Project = require('../models/Project');
const TaskCollaborator = require('../models/TaskCollaborator');
const Priority = require('../models/Priority');
const Status = require('../models/Status');
const { Op } = require('sequelize');

// Lấy tất cả task
async function getAllTasks() {
  return await Task.findAll({
    include: [
      { model: User, as: 'creator' },
      { model: Project, as: 'project' },
      { model: Priority, as: 'priority' },
      { model: Status, as: 'status' },
      { model: User, as: 'collaborators' }
    ]
  });
}

// Lấy task theo id
async function getTaskById(id) {
  return await Task.findOne({
    where: { id },
    include: [
      { model: User, as: 'creator' },
      { model: Project, as: 'project' },
      { model: Priority, as: 'priority' },
      { model: Status, as: 'status' },
      { model: User, as: 'collaborators' }
    ]
  });
}

// Tạo task mới
async function createTask(taskData) {
  const task = await Task.create(taskData);
  // Nếu có collaborators, add vào bảng trung gian
  if (taskData.collaborators && taskData.collaborators.length > 0) {
    await task.addCollaborators(taskData.collaborators);
  }
  return task;
}

// Cập nhật task
async function updateTask(id, taskData) {
  const task = await Task.findByPk(id);
  if (!task) throw new Error('Task not found');

  await task.update(taskData);

  // Cập nhật collaborators nếu có
  if (taskData.collaborators) {
    await task.setCollaborators(taskData.collaborators); // overwrite collaborators
  }

  return task;
}

// Xóa task
async function deleteTask(id) {
  const task = await Task.findByPk(id);
  if (!task) throw new Error('Task not found');
  await task.destroy();
  return true;
}

// Thêm collaborator
async function addCollaborator(taskId, userId) {
  const task = await Task.findByPk(taskId);
  const user = await User.findByPk(userId);
  if (!task || !user) throw new Error('Task or User not found');
  await task.addCollaborators(user);
  return task;
}

// Xóa collaborator
async function removeCollaborator(taskId, userId) {
  const task = await Task.findByPk(taskId);
  const user = await User.findByPk(userId);
  if (!task || !user) throw new Error('Task or User not found');
  await task.removeCollaborators(user);
  return task;
}

module.exports = {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  addCollaborator,
  removeCollaborator
};