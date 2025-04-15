const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Forum = require('../models/Forum');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const Report = require('../models/Report');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const bcrypt = require('bcryptjs');

// Middleware xác thực
const authenticate = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.redirect('/auth/login');
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.userId = decoded.userId;
    req.role = decoded.role;
    req.notifications = await Notification.find({ user: req.userId, read: false })
      .populate('post')
      .populate('comment')
      .populate('commenter')
      .sort({ createdAt: -1 });
    next();
  } catch (err) {
    console.error('Lỗi xác thực:', err);
    res.redirect('/auth/login');
  }
};

// Hiển thị trang cá nhân
router.get('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const forums = await Forum.find({ user: req.userId }).populate('teacher');
    const posts = await Post.find({ user: req.userId, pending: false }).populate('forum');
    const pendingPosts = await Post.find({ user: req.userId, pending: true }).populate('forum');
    const comments = await Comment.find({ user: req.userId }).populate({
      path: 'post',
      populate: { path: 'forum' }
    });
    const managedForums = await Forum.find({ teacher: req.userId });
    const reports = await Report.find({ reportedBy: req.userId })
      .populate({
        path: 'comment',
        populate: { path: 'user' }
      })
      .populate('post')
      .populate('forum')
      .sort({ createdAt: -1 });
    const isAuthenticated = !!req.userId;
    const userRole = req.role;
    const notifications = req.notifications;
    res.render('profile', { 
      user, 
      forums, 
      posts, 
      pendingPosts, 
      comments, 
      managedForums, 
      reports,
      isAuthenticated, 
      userRole, 
      notifications,
      req
    });
  } catch (err) {
    console.error('Lỗi khi tải trang cá nhân:', err);
    req.flash('error', 'Lỗi khi tải trang cá nhân');
    res.redirect('/forum');
  }
});

// Cập nhật thông tin cá nhân
router.post('/update', authenticate, async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email, _id: { $ne: req.userId } });
    if (existingUser) {
      req.flash('error', 'Email đã được sử dụng');
      return res.redirect('/profile');
    }
    const updateData = { name, email };
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    await User.findByIdAndUpdate(req.userId, updateData);
    req.flash('success', 'Cập nhật thông tin thành công');
    res.redirect('/profile');
  } catch (err) {
    console.error('Lỗi khi cập nhật thông tin:', err);
    req.flash('error', 'Lỗi khi cập nhật thông tin');
    res.redirect('/profile');
  }
});

// Xóa chủ đề
router.get('/delete-forum/:id', authenticate, async (req, res) => {
  try {
    const forum = await Forum.findById(req.params.id);
    if (!forum) {
      req.flash('error', 'Chủ đề không tồn tại');
      return res.redirect('/profile');
    }
    if (req.role !== 'admin' && forum.user.toString() !== req.userId) {
      req.flash('error', 'Bạn không có quyền xóa chủ đề này');
      return res.redirect('/profile');
    }
    const posts = await Post.find({ forum: req.params.id });
    const postIds = posts.map(post => post._id);
    for (const post of posts) {
      for (const url of [...(post.images || []), ...(post.videos || []), ...(post.files || [])]) {
        if (url) {
          const publicId = url.split('/').slice(-2).join('/').split('.')[0];
          await cloudinary.uploader.destroy(publicId, { resource_type: url.includes('video') ? 'video' : 'raw' })
            .catch(err => console.error('Lỗi xóa media từ Cloudinary:', err));
        }
      }
    }
    await Comment.deleteMany({ post: { $in: postIds } });
    await Notification.deleteMany({ post: { $in: postIds } });
    await Report.deleteMany({ forum: req.params.id });
    await Post.deleteMany({ forum: req.params.id });
    await Forum.findByIdAndDelete(req.params.id);
    req.flash('success', 'Xóa chủ đề và dữ liệu liên quan thành công');
    res.redirect('/profile');
  } catch (err) {
    console.error('Lỗi khi xóa chủ đề:', err);
    req.flash('error', 'Lỗi khi xóa chủ đề');
    res.redirect('/profile');
  }
});

// Xóa bài viết
router.get('/delete-post/:id', authenticate, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('forum');
    if (!post) {
      req.flash('error', 'Bài viết không tồn tại');
      return res.redirect('/profile');
    }
    const isTeacher = post.forum.teacher && post.forum.teacher.toString() === req.userId;
    if (req.role !== 'admin' && post.user.toString() !== req.userId && !isTeacher) {
      req.flash('error', 'Bạn không có quyền xóa bài viết này');
      return res.redirect('/profile');
    }
    for (const url of [...(post.images || []), ...(post.videos || []), ...(post.files || [])]) {
      if (url) {
        const publicId = url.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId, { resource_type: url.includes('video') ? 'video' : 'raw' })
          .catch(err => console.error('Lỗi xóa media từ Cloudinary:', err));
      }
    }
    await Comment.deleteMany({ post: req.params.id });
    await Notification.deleteMany({ post: req.params.id });
    await Report.deleteMany({ post: req.params.id });
    await Post.findByIdAndDelete(req.params.id);
    req.flash('success', 'Xóa bài viết và dữ liệu liên quan thành công');
    res.redirect('/profile');
  } catch (err) {
    console.error('Lỗi khi xóa bài viết:', err);
    req.flash('error', 'Lỗi khi xóa bài viết');
    res.redirect('/profile');
  }
});

// Xóa bình luận
router.get('/delete-comment/:id', authenticate, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id).populate({
      path: 'post',
      populate: { path: 'forum' }
    });
    if (!comment) {
      req.flash('error', 'Bình luận không tồn tại');
      return res.redirect('/profile');
    }
    const isTeacher = comment.post && comment.post.forum.teacher && comment.post.forum.teacher.toString() === req.userId;
    if (req.role !== 'admin' && comment.user.toString() !== req.userId && !isTeacher) {
      req.flash('error', 'Bạn không có quyền xóa bình luận này');
      return res.redirect('/profile');
    }
    for (const url of [...(comment.images || []), ...(comment.videos || []), ...(comment.files || [])]) {
      if (url) {
        const publicId = url.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId, { resource_type: url.includes('video') ? 'video' : 'raw' })
          .catch(err => console.error('Lỗi xóa media từ Cloudinary:', err));
      }
    }
    await Notification.deleteMany({ comment: req.params.id });
    await Report.deleteMany({ comment: req.params.id });
    await Comment.findByIdAndDelete(req.params.id);
    req.flash('success', 'Xóa bình luận và dữ liệu liên quan thành công');
    res.redirect('/profile');
  } catch (err) {
    console.error('Lỗi khi xóa bình luận:', err);
    req.flash('error', 'Lỗi khi xóa bình luận');
    res.redirect('/profile');
  }
});

// Xóa báo cáo
router.get('/delete-report/:id', authenticate, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      req.flash('error', 'Báo cáo không tồn tại');
      return res.redirect('/profile');
    }
    if (report.reportedBy.toString() !== req.userId && req.role !== 'admin') {
      req.flash('error', 'Bạn không có quyền xóa báo cáo này');
      return res.redirect('/profile');
    }
    await Report.findByIdAndDelete(req.params.id);
    req.flash('success', 'Xóa báo cáo thành công');
    res.redirect('/profile');
  } catch (err) {
    console.error('Lỗi khi xóa báo cáo:', err);
    req.flash('error', 'Lỗi khi xóa báo cáo');
    res.redirect('/profile');
  }
});

module.exports = router;