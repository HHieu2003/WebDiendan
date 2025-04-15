const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  content: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  createdAt: { type: Date, default: Date.now },
  images: [{ type: String }], // Lưu đường dẫn các ảnh
  videos: [{ type: String }], // Lưu đường dẫn các video
  files: [{ type: String }], // Lưu đường dẫn các file khác
});

module.exports = mongoose.model('Comment', commentSchema);