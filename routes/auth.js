const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Notification = require('../models/Notification');
const jwt = require('jsonwebtoken');

// Middleware để lấy userRole và notifications từ token (nếu có)
const getUserInfo = async (req) => {
  const token = req.cookies.token;
  if (!token) {
    return { userId: null, userRole: null, notifications: [] };
  }
  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    const userId = decoded.userId;
    const userRole = decoded.role;
    const notifications = await Notification.find({ user: userId, read: false })
      .populate('post')
      .populate('comment')
      .populate('commenter')
      .sort({ createdAt: -1 });
    return { userId, userRole, notifications };
  } catch (err) {
    return { userId: null, userRole: null, notifications: [] };
  }
};

// Đăng ký người dùng
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).send('Email đã tồn tại');
    }
    const user = new User({ name, email, password, role: 'student' });
    await user.save();
    res.redirect('/auth/login');
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

// Đăng nhập người dùng
router.post('/login', async (req, res) => {
  const { name, password } = req.body;
  try {
    const user = await User.findOne({ name });
    if (!user || user.password !== password) {
      return res.status(400).send('Tên hoặc mật khẩu không đúng');
    }
    const token = jwt.sign({ userId: user._id, role: user.role }, 'your_jwt_secret', { expiresIn: '1h' });
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

// Đăng xuất người dùng
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});

// Hiển thị trang đăng ký
router.get('/register', async (req, res) => {
  const { userId, userRole, notifications } = await getUserInfo(req);
  const isAuthenticated = userId !== null;
  res.render('register', { isAuthenticated, userRole, notifications });
});

// Hiển thị trang đăng nhập
router.get('/login', async (req, res) => {
  const { userId, userRole, notifications } = await getUserInfo(req);
  const isAuthenticated = userId !== null;
  res.render('login', { isAuthenticated, userRole, notifications });
});

module.exports = router;