const express = require('express');
const router = express.Router();
const Forum = require('../models/Forum');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const { auth } = require('../middleware/auth');

// Hàm lấy danh sách diễn đàn (không yêu cầu auth)
const getForums = async () => {
  try {
    const forums = await Forum.find().populate('user');
    return forums;
  } catch (error) {
    console.error('Lỗi khi lấy danh sách diễn đàn:', error);
    return [];
  }
};

// Route GET /forum (không yêu cầu đăng nhập)
router.get('/', async (req, res) => {
  const forums = await getForums();
  const isAuthenticated = req.cookies && req.cookies.token; // Kiểm tra xem người dùng đã đăng nhập chưa
  res.render('forum', { forums, isAuthenticated });
});

// Tạo chủ đề (yêu cầu đăng nhập)
router.get('/add', auth, (req, res) => {
  res.render('forum', { forums: [], isAuthenticated: true });
});

router.post('/add', auth, async (req, res) => {
  const { title, content } = req.body;
  const forum = new Forum({ title, content, user: req.user._id });
  await forum.save();
  res.redirect('/forum');
});

// Xem chi tiết chủ đề và danh sách bài viết (không yêu cầu đăng nhập)
router.get('/topic/:id', async (req, res) => {
  const forum = await Forum.findById(req.params.id).populate('user');
  const posts = await Post.find({ forum: req.params.id }).populate('user');
  const isAuthenticated = req.cookies && req.cookies.token;
  res.render('topic', { forum, posts, isAuthenticated });
});

// Tạo bài viết trong chủ đề (yêu cầu đăng nhập)
router.get('/topic/:id/add-post', auth, (req, res) => {
  res.render('add-post', { forumId: req.params.id });
});

router.post('/topic/:id/add-post', auth, async (req, res) => {
  const { title, content } = req.body;
  const post = new Post({ title, content, user: req.user._id, forum: req.params.id });
  await post.save();
  res.redirect(`/forum/topic/${req.params.id}`);
});

// Xem chi tiết bài viết và bình luận (không yêu cầu đăng nhập)
router.get('/topic/:forumId/post/:postId', async (req, res) => {
  const post = await Post.findById(req.params.postId).populate('user');
  const comments = await Comment.find({ post: req.params.postId }).populate('user');
  const isAuthenticated = req.cookies && req.cookies.token;
  res.render('post', { post, comments, forumId: req.params.forumId, isAuthenticated });
});

// Thêm bình luận vào bài viết (yêu cầu đăng nhập)
router.post('/topic/:forumId/post/:postId/comment', auth, async (req, res) => {
  const { content } = req.body;
  const comment = new Comment({ content, user: req.user._id, post: req.params.postId });
  await comment.save();
  res.redirect(`/forum/topic/${req.params.forumId}/post/${req.params.postId}`);
});

module.exports = { router, getForums };