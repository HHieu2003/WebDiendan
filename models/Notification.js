const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Người nhận thông báo
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true }, // Bài viết được bình luận
  comment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', required: true }, // Bình luận
  commenter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Người bình luận
  message: { type: String, required: true }, // Nội dung thông báo
  read: { type: Boolean, default: false }, // Trạng thái đã đọc
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);  