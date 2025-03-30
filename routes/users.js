const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Middleware xác thực
const authenticate = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.redirect('/auth/login');
  }
  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.redirect('/auth/login');
  }
};

// Hiển thị danh sách người dùng
router.get('/', authenticate, async (req, res) => {
  try {
    const users = await User.find();
    const isAuthenticated = req.cookies && req.cookies.token;
    res.render('users', { users, user: null, isAuthenticated });
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

// Hiển thị form thêm người dùng
router.get('/add', authenticate, (req, res) => {
  const isAuthenticated = req.cookies && req.cookies.token;
  res.render('users', { users: [], user: null, isAuthenticated });
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
    const isAuthenticated = req.cookies && req.cookies.token;
    res.render('users', { users, user, isAuthenticated });
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