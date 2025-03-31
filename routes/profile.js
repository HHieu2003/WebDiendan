const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Forum = require('../models/Forum');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const jwt = require('jsonwebtoken');

// Middleware xác thực
const authenticate = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.redirect('/auth/login');
  }
  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    req.userId = decoded.userId;
    req.role = decoded.role;
    req.notifications = await Notification.find({ user: req.userId, read: false })
      .populate('post')
      .populate('comment')
      .populate('commenter')
      .sort({ createdAt: -1 });
    next();
  } catch (err) {
    res.redirect('/auth/login');
  }
};

// Hiển thị trang cá nhân
router.get('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const forums = await Forum.find({ user: req.userId });
    const posts = await Post.find({ user: req.userId });
    const comments = await Comment.find({ user: req.userId });
    const isAuthenticated = req.userId !== null;
    const userRole = req.role;
    const notifications = req.notifications;
    res.render('profile', { user, forums, posts, comments, isAuthenticated, userRole, notifications });
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

// Cập nhật thông tin cá nhân
router.post('/update', authenticate, async (req, res) => {
  const { name, email, password } = req.body;
  try {
    await User.findByIdAndUpdate(req.userId, { name, email, password });
    res.redirect('/profile');
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

module.exports = router;