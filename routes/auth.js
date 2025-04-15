const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Notification = require('../models/Notification');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

// Middleware để lấy thông tin người dùng từ token
const getUserInfo = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    req.user = { userId: null, userRole: null, notifications: [] };
    return next();
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    const userId = decoded.userId;
    const userRole = decoded.role;
    const notifications = await Notification.find({ user: userId, read: false })
      .populate('post')
      .populate('comment')
      .populate('commenter')
      .sort({ createdAt: -1 });
    req.user = { userId, userRole, notifications };
    next();
  } catch (err) {
    req.user = { userId: null, userRole: null, notifications: [] };
    next();
  }
};

// Đăng ký người dùng// Đăng ký người dùng
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Tên không được để trống'),
    body('email').isEmail().withMessage('Email không hợp lệ'),
    body('password').isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const { name, email, password } = req.body;

    if (!errors.isEmpty()) {
      return res.render('register', {
        isAuthenticated: false,
        userRole: null,
        notifications: [],
        errorMessage: errors.array().map(err => err.msg).join(', ')
      });
    }

    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.render('register', {
          isAuthenticated: false,
          userRole: null,
          notifications: [],
          errorMessage: 'Email đã tồn tại, vui lòng chọn email khác'
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({ name, email, password: hashedPassword, role: 'student' });
      await user.save();

      return res.render('login', {
        isAuthenticated: false,
        userRole: null,
        notifications: [],
        successMessage: 'Đăng ký thành công, vui lòng đăng nhập'
      });
    } catch (err) {
      console.error('Lỗi khi đăng ký:', err);
      return res.render('register', {
        isAuthenticated: false,
        userRole: null,
        notifications: [],
        errorMessage: 'Lỗi server, vui lòng thử lại sau'
      });
    }
  }
);


// Đăng nhập người dùng// Đăng nhập người dùng
router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('Email không hợp lệ'),
    body('password').notEmpty().withMessage('Mật khẩu không được để trống'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const { email, password } = req.body;

    if (!errors.isEmpty()) {
      return res.render('login', {
        isAuthenticated: false,
        userRole: null,
        notifications: [],
        errorMessage: errors.array().map(err => err.msg).join(', ')
      });
    }

    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.render('login', {
          isAuthenticated: false,
          userRole: null,
          notifications: [],
          errorMessage: 'Email hoặc mật khẩu không đúng'
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.render('login', {
          isAuthenticated: false,
          userRole: null,
          notifications: [],
          errorMessage: 'Email hoặc mật khẩu không đúng'
        });
      }

      const token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET || 'your_jwt_secret',
        { expiresIn: '1h' }
      );

      res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
      res.redirect('/');
    } catch (err) {
      console.error('Lỗi khi đăng nhập:', err);
      return res.render('login', {
        isAuthenticated: false,
        userRole: null,
        notifications: [],
        errorMessage: 'Lỗi server, vui lòng thử lại'
      });
    }
  }
);

// Đăng xuất người dùng
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  req.flash('success', 'Đăng xuất thành công');
  res.redirect('/auth/login');
  
});

// Hiển thị trang đăng ký
router.get('/register', getUserInfo, async (req, res) => {
  const { userId, userRole, notifications } = req.user;
  const isAuthenticated = userId !== null;
  if (isAuthenticated) {
    req.flash('error', 'Bạn đã đăng nhập, không thể truy cập trang đăng ký');
    return res.redirect('/');
  }
  res.render('register', { isAuthenticated, userRole, notifications, error_msg: req.flash('error'), success_msg: req.flash('success') });
});

// Hiển thị trang đăng nhập
router.get('/login', getUserInfo, async (req, res) => {
  const { userId, userRole, notifications } = req.user;
  const isAuthenticated = userId !== null;
  if (isAuthenticated) {
    req.flash('error', 'Bạn đã đăng nhập, không thể truy cập trang đăng nhập');
    return res.redirect('/');
  }
  res.render('login', { isAuthenticated, userRole, notifications, error_msg: req.flash('error'), success_msg: req.flash('success') });
});

module.exports = router;