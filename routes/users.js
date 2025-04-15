const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Notification = require('../models/Notification');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

// Middleware xác thực và kiểm tra vai trò
const authenticate = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    req.flash('error', 'Vui lòng đăng nhập');
    return res.redirect('/auth/login');
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.userId = decoded.userId;
    req.role = decoded.role;
    if (req.role !== 'admin') {
      req.flash('error', 'Chỉ admin mới có quyền truy cập');
      return res.redirect('/');
    }
    req.notifications = await Notification.find({ user: req.userId, read: false })
      .populate('post')
      .populate('comment')
      .populate('commenter')
      .sort({ createdAt: -1 });
    next();
  } catch (err) {
    req.flash('error', 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại');
    res.redirect('/auth/login');
  }
};

// Hiển thị danh sách người dùng
router.get('/', authenticate, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    const isAuthenticated = req.userId !== null;
    const userRole = req.role;
    const notifications = req.notifications;
    res.render('users', { 
      users, 
      user: null, 
      isAuthenticated, 
      userRole, 
      notifications, 
      error_msg: req.flash('error'), 
      success_msg: req.flash('success') 
    });
  } catch (err) {
    console.error('Lỗi khi lấy danh sách người dùng:', err);
    req.flash('error', 'Lỗi server, vui lòng thử lại');
    res.redirect('/');
  }
});

// Hiển thị form thêm người dùng
router.get('/add', authenticate, (req, res) => {
  const isAuthenticated = req.userId !== null;
  const userRole = req.role;
  const notifications = req.notifications;
  res.render('add-user', { 
    user: null, 
    isAuthenticated, 
    userRole, 
    notifications, 
    error_msg: req.flash('error'), 
    success_msg: req.flash('success') 
  });
});

// Thêm người dùng
router.post(
  '/add',
  authenticate,
  [
    body('name').trim().notEmpty().withMessage('Tên không được để trống'),
    body('email').isEmail().withMessage('Email không hợp lệ'),
    body('password').isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
    body('role').isIn(['student', 'teacher', 'admin']).withMessage('Vai trò không hợp lệ'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array().map(err => err.msg).join(', '));
      return res.redirect('/users/add');
    }
    const { name, email, password, role } = req.body;
    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        req.flash('error', 'Email đã tồn tại');
        return res.redirect('/users/add');
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({ name, email, password: hashedPassword, role });
      await user.save();
      req.flash('success', 'Thêm người dùng thành công');
      res.redirect('/users');
    } catch (err) {
      console.error('Lỗi khi thêm người dùng:', err);
      req.flash('error', 'Lỗi server, vui lòng thử lại');
      res.redirect('/users/add');
    }
  }
);

// Hiển thị form sửa người dùng
router.get('/edit/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      req.flash('error', 'Người dùng không tồn tại');
      return res.redirect('/users');
    }
    const isAuthenticated = req.userId !== null;
    const userRole = req.role;
    const notifications = req.notifications;
    res.render('edit-user', { 
      user, 
      isAuthenticated, 
      userRole, 
      notifications, 
      error_msg: req.flash('error'), 
      success_msg: req.flash('success') 
    });
  } catch (err) {
    console.error('Lỗi khi lấy thông tin người dùng:', err);
    req.flash('error', 'Lỗi server, vui lòng thử lại');
    res.redirect('/users');
  }
});

// Cập nhật người dùng
router.post(
  '/edit/:id',
  authenticate,
  [
    body('name').trim().notEmpty().withMessage('Tên không được để trống'),
    body('email').isEmail().withMessage('Email không hợp lệ'),
    body('role').isIn(['student', 'teacher', 'admin']).withMessage('Vai trò không hợp lệ'),
    body('password').optional().isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array().map(err => err.msg).join(', '));
      return res.redirect(`/users/edit/${req.params.id}`);
    }
    const { name, email, password, role } = req.body;
    try {
      const existingUser = await User.findOne({ email, _id: { $ne: req.params.id } });
      if (existingUser) {
        req.flash('error', 'Email đã tồn tại');
        return res.redirect(`/users/edit/${req.params.id}`);
      }
      const updateData = { name, email, role };
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }
      await User.findByIdAndUpdate(req.params.id, updateData);
      req.flash('success', 'Cập nhật người dùng thành công');
      res.redirect('/users');
    } catch (err) {
      console.error('Lỗi khi cập nhật người dùng:', err);
      req.flash('error', 'Lỗi server, vui lòng thử lại');
      res.redirect(`/users/edit/${req.params.id}`);
    }
  }
);

// Xóa người dùng
router.get('/delete/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error', 'Người dùng không tồn tại');
      return res.redirect('/users');
    }
    if (req.userId === req.params.id) {
      req.flash('error', 'Không thể xóa tài khoản đang đăng nhập');
      return res.redirect('/users');
    }
    await User.findByIdAndDelete(req.params.id);
    req.flash('success', 'Xóa người dùng thành công');
    res.redirect('/users');
  } catch (err) {
    console.error('Lỗi khi xóa người dùng:', err);
    req.flash('error', 'Lỗi server, vui lòng thử lại');
    res.redirect('/users');
  }
});

module.exports = router;