const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Notification = require('../models/Notification');
const jwt = require('jsonwebtoken');

// Middleware xác thực và kiểm tra vai trò admin
const authenticate = async (req, res, next) => {
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

// Hiển thị danh sách người dùng
router.get('/', authenticate, async (req, res) => {
  try {
    const users = await User.find();
    const isAuthenticated = req.userId !== null;
    const userRole = req.role;
    const notifications = req.notifications;
    res.render('users', { users, user: null, isAuthenticated, userRole, notifications });
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

// Hiển thị form thêm người dùng
router.get('/add', authenticate, (req, res) => {
  const isAuthenticated = req.userId !== null;
  const userRole = req.role;
  const notifications = req.notifications;
  res.render('users', { users: [], user: null, isAuthenticated, userRole, notifications });
});

// Thêm người dùng
router.post('/add', authenticate, async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const user = new User({ name, email, password });
    await user.save();
    res.redirect('/users');
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

// Hiển thị form sửa người dùng
router.get('/edit/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const users = await User.find();
    const isAuthenticated = req.userId !== null;
    const userRole = req.role;
    const notifications = req.notifications;
    res.render('users', { users, user, isAuthenticated, userRole, notifications });
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

// Cập nhật người dùng
router.post('/edit/:id', authenticate, async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const updateData = { name, email };
    if (password) {
      updateData.password = password;
    }
    await User.findByIdAndUpdate(req.params.id, updateData);
    res.redirect('/users');
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

// Xóa người dùng
router.get('/delete/:id', authenticate, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.redirect('/users');
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});



module.exports = router;