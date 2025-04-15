const mongoose = require('mongoose');

const forumSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Người tạo (Admin hoặc Teacher)
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Teacher quản lý
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Forum', forumSchema);