// routes/postsAdmin.js
const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const { adminAuth } = require('../middleware/auth');

// Xem danh sách bài viết (chỉ quản trị viên)
router.get('/', adminAuth, async (req, res) => {
  const posts = await Post.find().populate('user').populate('forum');
  res.render('postsAdmin', { posts, post: null });
});

// Sửa bài viết (chỉ quản trị viên)
router.get('/edit/:id', adminAuth, async (req, res) => {
  const post = await Post.findById(req.params.id).populate('user').populate('forum');
  res.render('postsAdmin', { posts: [], post });
});

router.post('/edit/:id', adminAuth, async (req, res) => {
  const { title, content } = req.body;
  await Post.findByIdAndUpdate(req.params.id, { title, content });
  res.redirect('/postsAdmin');
});

// Xóa bài viết (chỉ quản trị viên)
router.get('/delete/:id', adminAuth, async (req, res) => {
  await Post.findByIdAndDelete(req.params.id);
  res.redirect('/postsAdmin');
});

module.exports = router;