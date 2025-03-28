const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Đăng ký
router.get('/register', (req, res) => {
  res.render('register');
});

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).send('Email đã tồn tại');

    const nameExists = await User.findOne({ name });
    if (nameExists) return res.status(400).send('Tên đã tồn tại');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({ name, email, password: hashedPassword, role: 'student' });
    await user.save();

    res.redirect('/auth/login');
  } catch (error) {
    res.status(500).send('Lỗi server');
  }
});

// Đăng nhập
router.get('/login', (req, res) => {
  res.render('login');
});

router.post('/login', async (req, res) => {
  const { name, password } = req.body;
  try {
    const user = await User.findOne({ name });
    if (!user) return res.status(400).send('Tên không tồn tại');

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(400).send('Mật khẩu không đúng');

    const token = jwt.sign({ _id: user._id, role: user.role }, 'your_jwt_secret');
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/profile'); // Chuyển hướng đến trang cá nhân sau khi đăng nhập
  } catch (error) {
    res.status(500).send('Lỗi server');
  }
});

// Đăng xuất
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});

module.exports = router;