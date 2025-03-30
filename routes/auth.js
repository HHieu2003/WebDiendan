const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Đăng ký người dùng
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).send('Email đã tồn tại');
    }
    const user = new User({ name, email, password, role: 'student' }); // Vai trò mặc định là user
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

// Middleware để lấy userRole từ token (nếu có)
const getUserRole = (req) => {
  const token = req.cookies.token;
  if (!token) {
    return null;
  }
  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    return decoded.role;
  } catch (err) {
    return null;
  }
};

// Hiển thị trang đăng ký
router.get('/register', (req, res) => {
  const isAuthenticated = req.cookies && req.cookies.token;
  const userRole = getUserRole(req); // Lấy userRole từ token
  res.render('register', { isAuthenticated, userRole });
});

// Hiển thị trang đăng nhập
router.get('/login', (req, res) => {
  const isAuthenticated = req.cookies && req.cookies.token;
  const userRole = getUserRole(req); // Lấy userRole từ token
  res.render('login', { isAuthenticated, userRole });
});

module.exports = router;