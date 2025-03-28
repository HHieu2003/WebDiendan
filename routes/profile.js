const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Forum = require('../models/Forum');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const { auth } = require('../middleware/auth');

// Trang cá nhân
router.get('/', auth, async (req, res) => {
  const user = await User.findById(req.user._id);
  const forums = await Forum.find({ user: req.user._id });
  const posts = await Post.find({ user: req.user._id });
  const comments = await Comment.find({ user: req.user._id });
  res.render('profile', { user, forums, posts, comments });
});

// Cập nhật thông tin cá nhân
router.post('/update', auth, async (req, res) => {
  const { name, email } = req.body;
  await User.findByIdAndUpdate(req.user._id, { name, email });
  res.redirect('/profile');
});

module.exports = router;