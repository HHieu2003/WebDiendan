const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Forum = require('../models/Forum');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const jwt = require('jsonwebtoken');

// Middleware xác thực và kiểm tra vai trò admin
const authenticateAdmin = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.redirect('/auth/login');
  }
  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    req.userId = decoded.userId;
    req.role = decoded.role;
    if (req.role !== 'admin') {
      return res.status(403).send('Chỉ admin mới có quyền truy cập');
    }
    next();
  } catch (err) {
    res.redirect('/auth/login');
  }
};

// Hiển thị trang admin
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const users = await User.find();
    const forums = await Forum.find().populate('user');
    const posts = await Post.find().populate('user').populate('forum');
    const comments = await Comment.find().populate('user').populate('post');
    const isAuthenticated = req.userId !== null;
    const userRole = req.role;
    res.render('admin', { users, forums, posts, comments, isAuthenticated, userRole });
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

// Xóa người dùng
router.get('/delete-user/:id', authenticateAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

// Xóa chủ đề
router.get('/delete-forum/:id', authenticateAdmin, async (req, res) => {
  try {
    await Forum.findByIdAndDelete(req.params.id);
    await Post.deleteMany({ forum: req.params.id }); // Xóa các bài viết liên quan
    await Comment.deleteMany({ post: { $in: await Post.find({ forum: req.params.id }).select('_id') } }); // Xóa các bình luận liên quan
    res.redirect('/admin');
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

// Xóa bài viết
router.get('/delete-post/:id', authenticateAdmin, async (req, res) => {
  try {
    await Post.findByIdAndDelete(req.params.id);
    await Comment.deleteMany({ post: req.params.id }); // Xóa các bình luận liên quan
    res.redirect('/admin');
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

// Xóa bình luận
router.get('/delete-comment/:id', authenticateAdmin, async (req, res) => {
  try {
    await Comment.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

module.exports = router;