const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { adminAuth } = require('../middleware/auth');

// Xem danh sách người dùng (chỉ quản trị viên)
router.get('/', adminAuth, async (req, res) => {
  const users = await User.find({ role: 'student' });
  const isAuthenticated = true; // Đã kiểm tra trong adminAuth
  res.render('users', { title: 'Quản lý Người dùng', users, user: null, isAuthenticated });
});

// Thêm người dùng (chỉ quản trị viên)
router.get('/add', adminAuth, (req, res) => {
  const isAuthenticated = true;
  res.render('users', { title: 'Thêm Người dùng', users: [], user: null, isAuthenticated });
});

router.post('/add', adminAuth, async (req, res) => {
  const { name, email, password } = req.body;
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const user = new User({ name, email, password: hashedPassword, role: 'student' });
  await user.save();
  res.redirect('/users');
});

// Xóa người dùng (chỉ quản trị viên)
router.get('/delete/:id', adminAuth, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.redirect('/users');
});

// Sửa người dùng (chỉ quản trị viên)
router.get('/edit/:id', adminAuth, async (req, res) => {
  const user = await User.findById(req.params.id);
  const isAuthenticated = true;
  res.render('users', { title: 'Sửa Người dùng', users: [], user, isAuthenticated });
});

router.post('/edit/:id', adminAuth, async (req, res) => {
  const { name, email, password } = req.body;
  const updateData = { name, email };
  if (password) {
    const salt = await bcrypt.genSalt(10);
    updateData.password = await bcrypt.hash(password, salt);
  }
  await User.findByIdAndUpdate(req.params.id, updateData);
  res.redirect('/users');
});

module.exports = router;