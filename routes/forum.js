const express = require('express');
const router = express.Router();
const Forum = require('../models/Forum');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const Notification = require('../models/Notification');
const jwt = require('jsonwebtoken');

// Middleware xác thực
const authenticate = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    req.userId = null;
    req.role = null;
    req.notifications = [];
    console.log('Không có token, đặt notifications thành mảng rỗng');
    return next();
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
    console.log(`Số lượng thông báo chưa đọc: ${req.notifications.length}`);
    next();
  } catch (err) {
    req.userId = null;
    req.role = null;
    req.notifications = [];
    console.error('Lỗi khi lấy thông báo:', err);
    next();
  }
};

// Hàm getForums để lấy danh sách diễn đàn (dùng cho index.js)
const getForums = async () => {
  try {
    return await Forum.find().populate('user');
  } catch (err) {
    throw new Error('Lỗi khi lấy danh sách diễn đàn: ' + err.message);
  }
};

// Hiển thị diễn đàn
router.get('/', authenticate, async (req, res) => {
  try {
    const forums = await getForums();
    const isAuthenticated = req.userId !== null;
    const userRole = req.role;
    const notifications = req.notifications || [];
    res.render('forum', { forums, isAuthenticated, userRole, notifications });
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

// Tìm kiếm chủ đề
router.get('/search', authenticate, async (req, res) => {
  const query = req.query.query || '';
  try {
    const forums = await Forum.find({ 
      title: { $regex: query, $options: 'i' } 
    }).populate('user');
    const isAuthenticated = req.userId !== null;
    const userRole = req.role;
    const notifications = req.notifications || [];
    res.render('forum', { forums, isAuthenticated, userRole, notifications });
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

// Thêm chủ đề
router.post('/add', authenticate, async (req, res) => {
  if (!req.userId) {
    return res.redirect('/auth/login');
  }
  const { title, content } = req.body;
  try {
    const forum = new Forum({ title, content, user: req.userId });
    await forum.save();
    res.redirect('/forum');
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

// Hiển thị chi tiết chủ đề
router.get('/topic/:id', authenticate, async (req, res) => {
  try {
    const forum = await Forum.findById(req.params.id).populate('user');
    const posts = await Post.find({ forum: req.params.id }).populate('user');
    const isAuthenticated = req.userId !== null;
    const userRole = req.role;
    const notifications = req.notifications || [];
    res.render('topic', { forum, posts, isAuthenticated, userRole, notifications });
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

// Hiển thị form tạo bài viết
router.get('/topic/:id/add-post', authenticate, (req, res) => {
  if (!req.userId) {
    return res.redirect('/auth/login');
  }
  const isAuthenticated = req.userId !== null;
  const userRole = req.role;
  const notifications = req.notifications || [];
  res.render('add-post', { forumId: req.params.id, isAuthenticated, userRole, notifications });
});

// Thêm bài viết
router.post('/topic/:id/add-post', authenticate, async (req, res) => {
  if (!req.userId) {
    return res.redirect('/auth/login');
  }
  const { title, content } = req.body;
  try {
    const post = new Post({ title, content, forum: req.params.id, user: req.userId });
    await post.save();
    res.redirect(`/forum/topic/${req.params.id}`);
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

// Hiển thị chi tiết bài viết
router.get('/topic/:forumId/post/:postId', authenticate, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId).populate('user');
    const comments = await Comment.find({ post: req.params.postId }).populate('user');
    const isAuthenticated = req.userId !== null;
    const userRole = req.role;
    const notifications = req.notifications || [];
    res.render('post', { post, comments, forumId: req.params.forumId, isAuthenticated, userRole, notifications });
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

// Thêm bình luận
router.post('/topic/:forumId/post/:postId/comment', authenticate, async (req, res) => {
  if (!req.userId) {
    return res.redirect('/auth/login');
  }
  const { content } = req.body;
  try {
    const comment = new Comment({ content, post: req.params.postId, user: req.userId });
    await comment.save();

    // Tạo thông báo cho chủ bài viết
    const post = await Post.findById(req.params.postId).populate('user');
    const commenter = await User.findById(req.userId);
    if (post.user._id.toString() !== req.userId.toString()) {
      const notification = new Notification({
        user: post.user._id,
        post: req.params.postId,
        comment: comment._id,
        commenter: req.userId,
        message: `${commenter.name} đã bình luận vào bài viết của bạn: "${post.title}"`,
      });
      await notification.save();
    }

    res.redirect(`/forum/topic/${req.params.forumId}/post/${req.params.postId}`);
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

// Export router và hàm getForums
module.exports = router;
module.exports.getForums = getForums;