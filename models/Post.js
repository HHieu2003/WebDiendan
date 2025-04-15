const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  forum: { type: mongoose.Schema.Types.ObjectId, ref: 'Forum', required: true },
  createdAt: { type: Date, default: Date.now },
  images: [{ type: String }],
  videos: [{ type: String }],
  files: [{ type: String }],
  pending: { type: Boolean, default: false }, // Trạng thái chờ duyệt
});

module.exports = mongoose.model('Post', postSchema);