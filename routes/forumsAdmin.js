// routes/forumsAdmin.js
const express = require('express');
const router = express.Router();
const Forum = require('../models/Forum');
const { adminAuth } = require('../middleware/auth');

// Xem danh sách chủ đề (chỉ quản trị viên)
router.get('/', adminAuth, async (req, res) => {
  const forums = await Forum.find().populate('user');
  res.render('forumsAdmin', { forums, forum: null });
});

// Sửa chủ đề (chỉ quản trị viên)
router.get('/edit/:id', adminAuth, async (req, res) => {
  const forum = await Forum.findById(req.params.id).populate('user');
  res.render('forumsAdmin', { forums: [], forum });
});

router.post('/edit/:id', adminAuth, async (req, res) => {
  const { title, content } = req.body;
  await Forum.findByIdAndUpdate(req.params.id, { title, content });
  res.redirect('/forumsAdmin');
});

// Xóa chủ đề (chỉ quản trị viên)
router.get('/delete/:id', adminAuth, async (req, res) => {
  await Forum.findByIdAndDelete(req.params.id);
  res.redirect('/forumsAdmin');
});

module.exports = router;