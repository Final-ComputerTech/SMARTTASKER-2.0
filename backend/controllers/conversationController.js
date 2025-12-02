const Conversation = require('../models/Conversation');
const User = require('../models/User');

exports.listForTask = async (req, res) => {
  try {
    const { id } = req.params;
    const conv = await Conversation.findAll({ where: { task_id: id }, include: [{ model: User, as: 'User' }], order: [['createdAt', 'ASC']] });
    res.json({ data: conv });
  } catch (err) {
    console.error('conversationController.listForTask error', err);
    res.status(500).json({ error: err.message });
  }
};

exports.createForTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });
    const conv = await Conversation.create({ task_id: id, user_id: req.user.user_id, message });
    const created = await Conversation.findByPk(conv.conversation_id, { include: [{ model: User, as: 'User' }] });
    res.status(201).json(created);
  } catch (err) {
    console.error('conversationController.createForTask error', err);
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conv = await Conversation.findByPk(conversationId);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    // only author or admin may delete
    if (req.user.role !== 'admin' && conv.user_id !== req.user.user_id) return res.status(403).json({ error: 'Forbidden' });
    await conv.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error('conversationController.delete error', err);
    res.status(500).json({ error: err.message });
  }
};
