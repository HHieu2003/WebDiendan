const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  comment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', required: true },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  forum: { type: mongoose.Schema.Types.ObjectId, ref: 'Forum', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema);