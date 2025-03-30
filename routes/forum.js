const express = require('express');
const router = express.Router();
const Forum = require('../models/Forum');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Middleware xác thực
const authenticate = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    req.userId = null;
    return next();
  }
  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    req.userId = decoded.userId;
    next();
  } catch (err) {
    req.userId = null;
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
    res.render('forum', { forums, isAuthenticated });
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
    res.render('forum', { forums, isAuthenticated });
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
    res.render('topic', { forum, posts, isAuthenticated });
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
  res.render('add-post', { forumId: req.params.id, isAuthenticated });
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
    res.render('post', { post, comments, forumId: req.params.forumId, isAuthenticated });
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
    res.redirect(`/forum/topic/${req.params.forumId}/post/${req.params.postId}`);
  } catch (err) {
    res.status(500).send('Lỗi server');
  }
});

// Export router và hàm getForums
module.exports = router;
module.exports.getForums = getForums;