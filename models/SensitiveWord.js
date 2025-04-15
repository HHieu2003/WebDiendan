const mongoose = require('mongoose');
const sensitiveWordSchema = new mongoose.Schema({
  word: { type: String, required: true, unique: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('SensitiveWord', sensitiveWordSchema);