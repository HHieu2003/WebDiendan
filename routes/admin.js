const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Forum = require('../models/Forum');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const SensitiveWord = require('../models/SensitiveWord');
const Report = require('../models/Report');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cloudinary = require('cloudinary').v2;

// Middleware xác thực và kiểm tra vai trò admin
const authenticateAdmin = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    console.log('Không có token, chuyển hướng đến login');
    return res.redirect('/auth/login');
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.userId = decoded.userId;
    req.role = decoded.role;
    if (req.role !== 'admin') {
      console.log('Không phải admin, role:', req.role);
      return res.status(403).send('Chỉ admin mới có quyền truy cập');
    }
    try {
      req.notifications = await Notification.find({ user: req.userId, read: false })
        .populate('post')
        .populate('comment')
        .populate('commenter')
        .sort({ createdAt: -1 });
    } catch (err) {
      console.error('Lỗi lấy thông báo:', err);
      req.notifications = [];
    }
    next();
  } catch (err) {
    console.error('Lỗi xác thực token:', err);
    res.redirect('/auth/login');
  }
};

// Trang admin
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const users = await User.find();
    const forums = await Forum.find().populate('user').populate('teacher');
    const posts = await Post.find().populate('user').populate('forum');
    const pendingPosts = await Post.find({ isApproved: false }).populate('user').populate('forum');
    const comments = await Comment.find().populate('user').populate('post');
    const sensitiveWords = await SensitiveWord.find().populate('addedBy');
    const reports = await Report.find()
      .populate({
        path: 'comment',
        match: { _id: { $ne: null } },
        populate: { path: 'user' }
      })
      .populate('reportedBy')
      .populate('post')
      .populate('forum')
      .lean()
      .then(reports => reports.filter(report => report.comment));
    res.render('admin', {
      users,
      forums,
      posts,
      pendingPosts,
      comments,
      sensitiveWords,
      reports,
      notifications: req.notifications,
      isAuthenticated: true,
      userRole: req.role,
      success_msg: req.flash('success'),
      error_msg: req.flash('error')
    });
  } catch (err) {
    console.error('Lỗi khi tải trang admin:', err);
    req.flash('error', 'Lỗi khi tải trang admin');
    res.redirect('/forum');
  }
});

// Bỏ qua báo cáo
router.post('/dismiss-report/:id', authenticateAdmin, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      req.flash('error', 'Báo cáo không tồn tại');
      return res.redirect('/admin');
    }
    await Report.findByIdAndDelete(req.params.id);
    req.flash('success', 'Bỏ qua báo cáo thành công');
    res.redirect('/admin');
  } catch (err) {
    console.error('Lỗi khi bỏ qua báo cáo:', err);
    req.flash('error', 'Lỗi khi bỏ qua báo cáo');
    res.redirect('/admin');
  }
});

// Xóa người dùng
router.get('/delete-user/:id', authenticateAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error', 'Người dùng không tồn tại');
      return res.redirect('/admin');
    }
    
    // Xóa media của bài viết
    const posts = await Post.find({ user: req.params.id });
    for (const post of posts) {
      for (const url of [...post.images, ...post.videos, ...post.files]) {
        if (url) {
          const publicId = url.split('/').slice(-2).join('/').split('.')[0];
          await cloudinary.uploader.destroy(publicId, { resource_type: url.includes('video') ? 'video' : 'raw' })
            .catch(err => console.error('Lỗi xóa media từ Cloudinary:', err));
        }
      }
    }

    // Xóa media của bình luận
    const comments = await Comment.find({ user: req.params.id });
    for (const comment of comments) {
      for (const url of [...comment.images, ...comment.videos, ...comment.files]) {
        if (url) {
          const publicId = url.split('/').slice(-2).join('/').split('.')[0];
          await cloudinary.uploader.destroy(publicId, { resource_type: url.includes('video') ? 'video' : 'raw' })
            .catch(err => console.error('Lỗi xóa media từ Cloudinary:', err));
        }
      }
    }

    // Xóa dữ liệu liên quan
    const postIds = posts.map(post => post._id);
    await Comment.deleteMany({ $or: [{ user: req.params.id }, { post: { $in: postIds } }] });
    await Notification.deleteMany({ $or: [{ user: req.params.id }, { post: { $in: postIds } }, { commenter: req.params.id }] });
    await Report.deleteMany({ $or: [{ reportedBy: req.params.id }, { comment: { $in: comments.map(c => c._id) } }] });
    await Post.deleteMany({ user: req.params.id });
    await Forum.deleteMany({ user: req.params.id });
    await SensitiveWord.deleteMany({ addedBy: req.params.id });
    await User.findByIdAndDelete(req.params.id);

    req.flash('success', 'Xóa người dùng và dữ liệu liên quan thành công');
    res.redirect('/admin');
  } catch (err) {
    console.error('Lỗi khi xóa người dùng:', err);
    req.flash('error', 'Lỗi khi xóa người dùng');
    res.redirect('/admin');
  }
});

// Thêm người dùng
router.post('/add-user', authenticateAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash('error', 'Email đã được sử dụng');
      return res.redirect('/admin');
    }
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }
    const user = new User({ name, email, password: hashedPassword, role });
    await user.save();
    req.flash('success', 'Thêm người dùng thành công');
    res.redirect('/admin');
  } catch (err) {
    console.error('Lỗi khi thêm người dùng:', err);
    req.flash('error', 'Lỗi khi thêm người dùng');
    res.redirect('/admin');
  }
});

// Sửa người dùng
router.post('/edit-user', authenticateAdmin, async (req, res) => {
  const { id, name, email, password, role } = req.body;
  try {
    const existingUser = await User.findOne({ email, _id: { $ne: id } });
    if (existingUser) {
      req.flash('error', 'Email đã được sử dụng');
      return res.redirect('/admin');
    }
    const updateData = { name, email, role };
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    await User.findByIdAndUpdate(id, updateData);
    req.flash('success', 'Cập nhật người dùng thành công');
    res.redirect('/admin');
  } catch (err) {
    console.error('Lỗi khi sửa người dùng:', err);
    req.flash('error', 'Lỗi khi sửa người dùng');
    res.redirect('/admin');
  }
});

// Thêm chủ đề
router.post('/add-forum', authenticateAdmin, async (req, res) => {
  const { title, content, teacherId } = req.body;
  try {
    const forum = new Forum({ 
      title, 
      content, 
      user: req.userId,
      teacher: teacherId || null
    });
    await forum.save();
    req.flash('success', 'Thêm chủ đề thành công');
    res.redirect('/admin');
  } catch (err) {
    console.error('Lỗi khi thêm chủ đề:', err);
    req.flash('error', 'Lỗi khi thêm chủ đề');
    res.redirect('/admin');
  }
});

// Sửa chủ đề
router.post('/edit-forum', authenticateAdmin, async (req, res) => {
  const { id, title, content, teacherId } = req.body;
  try {
    await Forum.findByIdAndUpdate(id, { 
      title, 
      content,
      teacher: teacherId || null 
    });
    req.flash('success', 'Cập nhật chủ đề thành công');
    res.redirect('/admin');
  } catch (err) {
    console.error('Lỗi khi sửa chủ đề:', err);
    req.flash('error', 'Lỗi khi sửa chủ đề');
    res.redirect('/admin');
  }
});

// Xóa chủ đề
router.get('/delete-forum/:id', authenticateAdmin, async (req, res) => {
  try {
    const forum = await Forum.findById(req.params.id);
    if (!forum) {
      req.flash('error', 'Chủ đề không tồn tại');
      return res.redirect('/admin');
    }

    // Xóa media của bài viết
    const posts = await Post.find({ forum: req.params.id });
    for (const post of posts) {
      for (const url of [...post.images, ...post.videos, ...post.files]) {
        if (url) {
          const publicId = url.split('/').slice(-2).join('/').split('.')[0];
          await cloudinary.uploader.destroy(publicId, { resource_type: url.includes('video') ? 'video' : 'raw' })
            .catch(err => console.error('Lỗi xóa media từ Cloudinary:', err));
        }
      }
    }

    // Xóa media của bình luận
    const postIds = posts.map(post => post._id);
    const comments = await Comment.find({ post: { $in: postIds } });
    for (const comment of comments) {
      for (const url of [...comment.images, ...comment.videos, ...comment.files]) {
        if (url) {
          const publicId = url.split('/').slice(-2).join('/').split('.')[0];
          await cloudinary.uploader.destroy(publicId, { resource_type: url.includes('video') ? 'video' : 'raw' })
            .catch(err => console.error('Lỗi xóa media từ Cloudinary:', err));
        }
      }
    }

    // Xóa dữ liệu liên quan
    await Comment.deleteMany({ post: { $in: postIds } });
    await Notification.deleteMany({ post: { $in: postIds } });
    await Report.deleteMany({ forum: req.params.id });
    await Post.deleteMany({ forum: req.params.id });
    await Forum.findByIdAndDelete(req.params.id);

    req.flash('success', 'Xóa chủ đề và dữ liệu liên quan thành công');
    res.redirect('/admin');
  } catch (err) {
    console.error('Lỗi khi xóa chủ đề:', err);
    req.flash('error', 'Lỗi khi xóa chủ đề');
    res.redirect('/admin');
  }
});

// Thêm bài viết
router.post('/add-post', authenticateAdmin, async (req, res) => {
  const { title, content, forum } = req.body;
  try {
    const post = new Post({ 
      title, 
      content, 
      forum, 
      user: req.userId,
      pending: false
    });
    await post.save();
    req.flash('success', 'Thêm bài viết thành công');
    res.redirect('/admin');
  } catch (err) {
    console.error('Lỗi khi thêm bài viết:', err);
    req.flash('error', 'Lỗi khi thêm bài viết');
    res.redirect('/admin');
  }
});

// Sửa bài viết
router.post('/edit-post', authenticateAdmin, async (req, res) => {
  const { id, title, content, forum } = req.body;
  try {
    await Post.findByIdAndUpdate(id, { title, content, forum });
    req.flash('success', 'Cập nhật bài viết thành công');
    res.redirect('/admin');
  } catch (err) {
    console.error('Lỗi khi sửa bài viết:', err);
    req.flash('error', 'Lỗi khi sửa bài viết');
    res.redirect('/admin');
  }
});

// Xóa bài viết
router.get('/delete-post/:id', authenticateAdmin, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      req.flash('error', 'Bài viết không tồn tại');
      return res.redirect('/admin');
    }

    // Xóa media của bài viết
    for (const url of [...post.images, ...post.videos, ...post.files]) {
      if (url) {
        const publicId = url.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId, { resource_type: url.includes('video') ? 'video' : 'raw' })
          .catch(err => console.error('Lỗi xóa media từ Cloudinary:', err));
      }
    }

    // Xóa media của bình luận
    const comments = await Comment.find({ post: req.params.id });
    for (const comment of comments) {
      for (const url of [...comment.images, ...comment.videos, ...comment.files]) {
        if (url) {
          const publicId = url.split('/').slice(-2).join('/').split('.')[0];
          await cloudinary.uploader.destroy(publicId, { resource_type: url.includes('video') ? 'video' : 'raw' })
            .catch(err => console.error('Lỗi xóa media từ Cloudinary:', err));
        }
      }
    }

    // Xóa dữ liệu liên quan
    await Comment.deleteMany({ post: req.params.id });
    await Notification.deleteMany({ post: req.params.id });
    await Report.deleteMany({ post: req.params.id });
    await Post.findByIdAndDelete(req.params.id);

    req.flash('success', 'Xóa bài viết và dữ liệu liên quan thành công');
    res.redirect('/admin');
  } catch (err) {
    console.error('Lỗi khi xóa bài viết:', err);
    req.flash('error', 'Lỗi khi xóa bài viết');
    res.redirect('/admin');
  }
});

// Duyệt bài viết
router.get('/approve-post/:id', authenticateAdmin, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('forum');
    if (!post) {
      req.flash('error', 'Bài viết không tồn tại');
      return res.redirect('/admin');
    }
    post.pending = false;
    await post.save();
    const notification = new Notification({
      user: post.user,
      post: post._id,
      message: `Bài viết "${post.title}" của bạn đã được duyệt trong chủ đề "${post.forum.title}"`,
    });
    await notification.save();
    req.flash('success', 'Duyệt bài viết thành công');
    res.redirect('/admin');
  } catch (err) {
    console.error('Lỗi khi duyệt bài viết:', err);
    req.flash('error', 'Lỗi khi duyệt bài viết');
    res.redirect('/admin');
  }
});

// Thêm bình luận
router.post('/add-comment', authenticateAdmin, async (req, res) => {
  const { content, post } = req.body;
  try {
    const comment = new Comment({ content, post, user: req.userId });
    await comment.save();
    req.flash('success', 'Thêm bình luận thành công');
    res.redirect('/admin');
  } catch (err) {
    console.error('Lỗi khi thêm bình luận:', err);
    req.flash('error', 'Lỗi khi thêm bình luận');
    res.redirect('/admin');
  }
});

// Sửa bình luận
router.post('/edit-comment', authenticateAdmin, async (req, res) => {
  const { id, content, post } = req.body;
  try {
    await Comment.findByIdAndUpdate(id, { content, post });
    req.flash('success', 'Cập nhật bình luận thành công');
    res.redirect('/admin');
  } catch (err) {
    console.error('Lỗi khi sửa bình luận:', err);
    req.flash('error', 'Lỗi khi sửa bình luận');
    res.redirect('/admin#comments');
  }
});

// Xóa bình luận// Xóa bình luận
router.get('/delete-comment/:id', authenticateAdmin, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      req.flash('error', 'Bình luận không tồn tại');
      return res.redirect('/admin#comments');
    }

    // Xóa media của bình luận trên Cloudinary
    for (const url of [...(comment.images || []), ...(comment.videos || []), ...(comment.files || [])]) {
      if (url) {
        const publicId = url.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId, { 
          resource_type: url.includes('video') ? 'video' : 'raw' 
        }).catch(err => console.error('Lỗi xóa media từ Cloudinary:', err));
      }
    }

    // Xóa dữ liệu liên quan
    await Notification.deleteMany({ comment: req.params.id });
    await Report.deleteMany({ comment: req.params.id });
    await Comment.findByIdAndDelete(req.params.id);

    req.flash('success', 'Xóa bình luận và dữ liệu liên quan thành công');
    res.redirect('/admin#comments');
  } catch (err) {
    console.error('Lỗi khi xóa bình luận:', err);
    req.flash('error', 'Lỗi khi xóa bình luận');
    res.redirect('/admin#comments');
  }
});

// Hiển thị danh sách từ ngữ nhạy cảm
router.get('/sensitive-words', authenticateAdmin, async (req, res) => {
  try {
    const sensitiveWords = await SensitiveWord.find().populate('addedBy');
    const notifications = await Notification.find({ user: req.userId, read: false })
      .populate('post')
      .populate('comment')
      .populate('commenter')
      .sort({ createdAt: -1 });
    res.render('sensitive-words', {
      sensitiveWords,
      notifications,
      isAuthenticated: true,
      userRole: req.role,
      success_msg: req.flash('success'),
      error_msg: req.flash('error')
    });
  } catch (err) {
    console.error('Lỗi khi tải danh sách từ ngữ nhạy cảm:', err);
    req.flash('error', 'Lỗi khi tải danh sách từ ngữ nhạy cảm');
    res.redirect('/admin');
  }
});

// Thêm từ ngữ nhạy cảm
router.post('/sensitive-words/add', authenticateAdmin, async (req, res) => {
  const { word } = req.body;
  try {
    const existingWord = await SensitiveWord.findOne({ word });
    if (existingWord) {
      req.flash('error', 'Từ này đã tồn tại');
      return res.redirect('/admin');
    }
    const sensitiveWord = new SensitiveWord({
      word,
      addedBy: req.userId
    });
    await sensitiveWord.save();
    req.flash('success', 'Thêm từ ngữ nhạy cảm thành công');
    res.redirect('/admin');
  } catch (err) {
    console.error('Lỗi khi thêm từ ngữ nhạy cảm:', err);
    req.flash('error', 'Lỗi khi thêm từ ngữ nhạy cảm');
    res.redirect('/admin');
  }
});

// Xóa từ ngữ nhạy cảm
router.post('/sensitive-words/delete/:id', authenticateAdmin, async (req, res) => {
  try {
    const word = await SensitiveWord.findById(req.params.id);
    if (!word) {
      req.flash('error', 'Từ ngữ không tồn tại');
      return res.redirect('/admin');
    }
    await SensitiveWord.findByIdAndDelete(req.params.id);
    req.flash('success', 'Xóa từ ngữ nhạy cảm thành công');
    res.redirect('/admin');
  } catch (err) {
    console.error('Lỗi khi xóa từ ngữ nhạy cảm:', err);
    req.flash('error', 'Lỗi khi xóa từ ngữ nhạy cảm');
    res.redirect('/admin');
  }
});

module.exports = router;