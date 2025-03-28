// routes/commentsAdmin.js
const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const { adminAuth } = require('../middleware/auth');

// Xem danh sách bình luận (chỉ quản trị viên)
router.get('/', adminAuth, async (req, res) => {
  const comments = await Comment.find().populate('user').populate('post');
  res.render('commentsAdmin', { comments, comment: null });
});

// Sửa bình luận (chỉ quản trị viên)
router.get('/edit/:id', adminAuth, async (req, res) => {
  const comment = await Comment.findById(req.params.id).populate('user').populate('post');
  res.render('commentsAdmin', { comments: [], comment });
});

router.post('/edit/:id', adminAuth, async (req, res) => {
  const { content } = req.body;
  await Comment.findByIdAndUpdate(req.params.id, { content });
  res.redirect('/commentsAdmin');
});

// Xóa bình luận (chỉ quản trị viên)
router.get('/delete/:id', adminAuth, async (req, res) => {
  await Comment.findByIdAndDelete(req.params.id);
  res.redirect('/commentsAdmin');
});

module.exports = router;