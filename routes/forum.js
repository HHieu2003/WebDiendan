const express = require('express');
const router = express.Router();
const Forum = require('../models/Forum');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const Notification = require('../models/Notification');
const SensitiveWord = require('../models/SensitiveWord');
const Report = require('../models/Report');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { Readable } = require('stream');

// Cấu hình multer để lưu tạm thời
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
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

// Hàm tải file lên Cloudinary
const uploadToCloudinary = (file, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: folder, resource_type: 'auto' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    const readableStream = new Readable();
    readableStream.push(file.buffer);
    readableStream.push(null);
    readableStream.pipe(stream);
  });
};

// Hàm getForums để lấy danh sách diễn đàn
const getForums = async () => {
  try {
    return await Forum.find().populate('user').populate('teacher');
  } catch (err) {
    throw new Error('Lỗi khi lấy danh sách diễn đàn: ' + err.message);
  }
};

// Hiển thị diễn đàn
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;
    const forums = await Forum.find()
      .populate('user')
      .populate('teacher')
      .skip(skip)
      .limit(limit);
    const totalForums = await Forum.countDocuments();
    const totalPages = Math.ceil(totalForums / limit);
    const isAuthenticated = req.userId !== null;
    const userRole = req.role;
    const notifications = req.notifications || [];
    res.render('forum', { 
      forums, 
      isAuthenticated, 
      userRole, 
      notifications,
      page,
      totalPages
    });
  } catch (err) {
    console.error('Lỗi khi tải diễn đàn:', err);
    req.flash('error', 'Lỗi server khi tải diễn đàn');
    res.redirect('/forum');
  }
});

// Tìm kiếm chủ đề
router.get('/search', authenticate, async (req, res) => {
  const query = req.query.query || '';
  const page = parseInt(req.query.page) || 1;
  const limit = 9;
  const skip = (page - 1) * limit;

  try {
    const [forums, totalForums] = await Promise.all([
      Forum.find({ title: { $regex: query, $options: 'i' } })
        .populate('user')
        .populate('teacher')
        .skip(skip)
        .limit(limit),
      Forum.countDocuments({ title: { $regex: query, $options: 'i' } })
    ]);

    const totalPages = Math.ceil(totalForums / limit);
    const isAuthenticated = req.userId !== null;
    const userRole = req.role;
    const notifications = req.notifications || [];

    res.render('forum', {
      forums,
      isAuthenticated,
      userRole,
      notifications,
      page,
      totalPages
    });
  } catch (err) {
    console.error('Lỗi khi tìm kiếm chủ đề:', err);
    req.flash('error', 'Lỗi khi tìm kiếm chủ đề');
    res.redirect('/forum');
  }
});

// Hiển thị chi tiết chủ đề
router.get('/topic/:id', authenticate, async (req, res) => {
  try {
    const forum = await Forum.findById(req.params.id).populate('user').populate('teacher');
    if (!forum) {
      req.flash('error', 'Chủ đề không tồn tại');
      return res.redirect('/forum');
    }
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const isTeacher = forum.teacher && req.userId && forum.teacher._id.toString() === req.userId;
    const isOwner = forum.user && req.userId && forum.user._id.toString() === req.userId;
    const query = { 
      forum: req.params.id, 
      pending: false 
    };
    if (req.role === 'admin' || isTeacher || isOwner) {
      delete query.pending; // Admin, giáo viên, hoặc chủ sở hữu có thể thấy bài viết chờ duyệt
    }
    const [posts, totalPosts] = await Promise.all([
      Post.find(query)
        .populate('user')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Post.countDocuments(query)
    ]);
    const totalPages = Math.ceil(totalPosts / limit);
    const isAuthenticated = req.userId !== null;
    const userRole = req.role;
    const notifications = req.notifications || [];
    res.render('topic', { 
      forum, 
      posts, 
      isAuthenticated, 
      userRole, 
      notifications, 
      page, 
      totalPages,
      isTeacher,
      isOwner
    });
  } catch (err) {
    console.error('Lỗi khi tải chi tiết chủ đề:', err);
    req.flash('error', 'Lỗi khi tải chi tiết chủ đề');
    res.redirect('/forum');
  }
});

// Hiển thị form tạo bài viết
router.get('/topic/:id/add-post', authenticate, async (req, res) => {
  if (!req.userId) {
    return res.redirect('/auth/login');
  }
  try {
    const forum = await Forum.findById(req.params.id).populate('teacher');
    if (!forum) {
      req.flash('error', 'Chủ đề không tồn tại');
      return res.redirect('/forum');
    }
    const isAssignedTeacher = forum.teacher && forum.teacher._id.toString() === req.userId;
    const isAuthenticated = req.userId !== null;
    const userRole = req.role;
    const notifications = req.notifications || [];
    const formData = req.flash('formData')[0] ? JSON.parse(req.flash('formData')[0]) : {};
    res.render('add-post', { 
      forumId: req.params.id, 
      isAuthenticated, 
      userRole, 
      notifications,
      formData,
      isAssignedTeacher,
      error_msg: req.flash('error'),
      success_msg: req.flash('success')
    });
  } catch (err) {
    console.error('Lỗi khi tải form thêm bài viết:', err);
    req.flash('error', 'Lỗi khi tải form thêm bài viết');
    res.redirect('/forum');
  }
});

// Thêm bài viết
router.post('/topic/:id/add-post', authenticate, upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'videos', maxCount: 5 },
  { name: 'files', maxCount: 5 }
]), async (req, res) => {
  if (!req.userId) {
    return res.redirect('/auth/login');
  }
  const { title, content } = req.body;
  try {
    const forum = await Forum.findById(req.params.id).populate('teacher');
    if (!forum) {
      req.flash('error', 'Chủ đề không tồn tại');
      req.flash('formData', JSON.stringify({ title, content }));
      return res.redirect(`/forum/topic/${req.params.id}/add-post`);
    }

    const images = [];
    const videos = [];
    const files = [];

    if (req.files.images) {
      for (const file of req.files.images) {
        const url = await uploadToCloudinary(file, 'forum/images');
        images.push(url);
      }
    }
    if (req.files.videos) {
      for (const file of req.files.videos) {
        const url = await uploadToCloudinary(file, 'forum/videos');
        videos.push(url);
      }
    }
    if (req.files.files) {
      for (const file of req.files.files) {
        const url = await uploadToCloudinary(file, 'forum/files');
        files.push(url);
      }
    }

    const isAssignedTeacher = forum.teacher && forum.teacher._id.toString() === req.userId;

    const post = new Post({
      title,
      content,
      forum: req.params.id,
      user: req.userId,
      images,
      videos,
      files,
      pending: !isAssignedTeacher
    });
    await post.save();

    if (!isAssignedTeacher) {
      const user = await User.findById(req.userId);
      if (forum.teacher) {
        const notification = new Notification({
          user: forum.teacher._id,
          post: post._id,
          message: `Bài viết "${title}" của ${user.name} trong chủ đề "${forum.title}" đang chờ duyệt`,
        });
        await notification.save();
      }
    }

    req.flash('success', isAssignedTeacher ? 'Thêm bài viết thành công' : 'Bài viết đã được gửi, đang chờ duyệt');
    res.redirect(`/forum/topic/${req.params.id}`);
  } catch (err) {
    console.error('Lỗi khi thêm bài viết:', err);
    req.flash('error', 'Lỗi khi thêm bài viết, vui lòng thử lại');
    req.flash('formData', JSON.stringify({ title, content }));
    res.redirect(`/forum/topic/${req.params.id}/add-post`);
  }
});

// Hiển thị danh sách bài viết chờ duyệt
router.get('/topic/:id/pending-posts', authenticate, async (req, res) => {
  if (!req.userId) {
    return res.redirect('/auth/login');
  }
  try {
    const forum = await Forum.findById(req.params.id).populate('teacher');
    if (!forum) {
      req.flash('error', 'Chủ đề không tồn tại');
      return res.redirect('/forum');
    }
    if (req.role !== 'admin' && (!forum.teacher || forum.teacher._id.toString() !== req.userId)) {
      req.flash('error', 'Bạn không có quyền xem bài viết chờ duyệt');
      return res.redirect(`/forum/topic/${req.params.id}`);
    }
    const pendingPosts = await Post.find({ 
      forum: req.params.id, 
      pending: true 
    }).populate('user');
    const isAuthenticated = req.userId !== null;
    const userRole = req.role;
    const notifications = req.notifications || [];
    res.render('pending-posts', { 
      forum, 
      pendingPosts, 
      isAuthenticated, 
      userRole, 
      notifications 
    });
  } catch (err) {
    console.error('Lỗi khi tải bài viết chờ duyệt:', err);
    req.flash('error', 'Lỗi khi tải bài viết chờ duyệt');
    res.redirect(`/forum/topic/${req.params.id}`);
  }
});

// Duyệt bài viết
router.post('/topic/:forumId/post/:postId/approve', authenticate, async (req, res) => {
  if (!req.userId) {
    return res.redirect('/auth/login');
  }
  try {
    const forum = await Forum.findById(req.params.forumId).populate('teacher');
    const post = await Post.findById(req.params.postId);
    if (!forum || !post) {
      req.flash('error', 'Chủ đề hoặc bài viết không tồn tại');
      return res.redirect(`/forum/topic/${req.params.forumId}`);
    }
    if (req.role !== 'admin' && (!forum.teacher || forum.teacher._id.toString() !== req.userId)) {
      req.flash('error', 'Bạn không có quyền duyệt bài viết');
      return res.redirect(`/forum/topic/${req.params.forumId}`);
    }
    post.pending = false;
    await post.save();
    const notification = new Notification({
      user: post.user,
      post: post._id,
      message: `Bài viết "${post.title}" của bạn đã được duyệt trong chủ đề "${forum.title}"`,
    });
    await notification.save();
    req.flash('success', 'Duyệt bài viết thành công');
    res.redirect(`/forum/topic/${req.params.forumId}/pending-posts`);
  } catch (err) {
    console.error('Lỗi khi duyệt bài viết:', err);
    req.flash('error', 'Lỗi khi duyệt bài viết');
    res.redirect(`/forum/topic/${req.params.forumId}/pending-posts`);
  }
});

// Từ chối bài viết
router.post('/topic/:forumId/post/:postId/reject', authenticate, async (req, res) => {
  if (!req.userId) {
    return res.redirect('/auth/login');
  }
  try {
    const forum = await Forum.findById(req.params.forumId).populate('teacher');
    const post = await Post.findById(req.params.postId);
    if (!forum || !post) {
      req.flash('error', 'Chủ đề hoặc bài viết không tồn tại');
      return res.redirect(`/forum/topic/${req.params.forumId}`);
    }
    if (req.role !== 'admin' && (!forum.teacher || forum.teacher._id.toString() !== req.userId)) {
      req.flash('error', 'Bạn không có quyền từ chối bài viết');
      return res.redirect(`/forum/topic/${req.params.forumId}`);
    }
    for (const url of [...(post.images || []), ...(post.videos || []), ...(post.files || [])]) {
      if (url) {
        const publicId = url.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId, { resource_type: url.includes('video') ? 'video' : 'raw' })
          .catch(err => console.error('Lỗi xóa media từ Cloudinary:', err));
      }
    }
    const notification = new Notification({
      user: post.user,
      post: post._id,
      message: `Bài viết "${post.title}" của bạn đã bị từ chối trong chủ đề "${forum.title}"`,
    });
    await notification.save();
    await Post.findByIdAndDelete(req.params.postId);
    req.flash('success', 'Từ chối bài viết thành công');
    res.redirect(`/forum/topic/${req.params.forumId}/pending-posts`);
  } catch (err) {
    console.error('Lỗi khi từ chối bài viết:', err);
    req.flash('error', 'Lỗi khi từ chối bài viết');
    res.redirect(`/forum/topic/${req.params.forumId}/pending-posts`);
  }
});

// Xóa bài viết trong chủ đề
router.get('/topic/:forumId/post/:postId/delete', authenticate, async (req, res) => {
  if (!req.userId) {
    return res.redirect('/auth/login');
  }
  try {
    const forum = await Forum.findById(req.params.forumId).populate('teacher');
    const post = await Post.findById(req.params.postId).populate('user');
    if (!forum || !post) {
      req.flash('error', 'Chủ đề hoặc bài viết không tồn tại');
      return res.redirect(`/forum/topic/${req.params.forumId}`);
    }
    if (req.role !== 'admin' && 
        (!forum.teacher || forum.teacher._id.toString() !== req.userId) && 
        post.user._id.toString() !== req.userId) {
      req.flash('error', 'Bạn không có quyền xóa bài viết này');
      return res.redirect(`/forum/topic/${req.params.forumId}`);
    }
    for (const url of [...(post.images || []), ...(post.videos || []), ...(post.files || [])]) {
      if (url) {
        const publicId = url.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId, { resource_type: url.includes('video') ? 'video' : 'raw' })
          .catch(err => console.error('Lỗi xóa media từ Cloudinary:', err));
      }
    }
    await Comment.deleteMany({ post: req.params.postId });
    await Notification.deleteMany({ post: req.params.postId });
    await Report.deleteMany({ post: req.params.postId });
    await Post.findByIdAndDelete(req.params.postId);
    req.flash('success', 'Xóa bài viết và dữ liệu liên quan thành công');
    res.redirect(`/forum/topic/${req.params.forumId}`);
  } catch (err) {
    console.error('Lỗi khi xóa bài viết:', err);
    req.flash('error', 'Lỗi khi xóa bài viết');
    res.redirect(`/forum/topic/${req.params.forumId}`);
  }
});

// Xóa bình luận trong chủ đề
router.get('/topic/:forumId/post/:postId/delete-comment/:commentId', authenticate, async (req, res) => {
  if (!req.userId) {
    return res.redirect('/auth/login');
  }
  try {
    const forum = await Forum.findById(req.params.forumId).populate('teacher');
    const comment = await Comment.findById(req.params.commentId).populate('user');
    if (!forum || !comment) {
      req.flash('error', 'Chủ đề hoặc bình luận không tồn tại');
      return res.redirect(`/forum/topic/${req.params.forumId}/post/${req.params.postId}`);
    }
    if (req.role !== 'admin' && 
        (!forum.teacher || forum.teacher._id.toString() !== req.userId) && 
        comment.user._id.toString() !== req.userId) {
      req.flash('error', 'Bạn không có quyền xóa bình luận này');
      return res.redirect(`/forum/topic/${req.params.forumId}/post/${req.params.postId}`);
    }
    for (const url of [...(comment.images || []), ...(comment.videos || []), ...(comment.files || [])]) {
      if (url) {
        const publicId = url.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId, { resource_type: url.includes('video') ? 'video' : 'raw' })
          .catch(err => console.error('Lỗi xóa media từ Cloudinary:', err));
      }
    }
    await Notification.deleteMany({ comment: req.params.commentId });
    await Report.deleteMany({ comment: req.params.commentId });
    await Comment.findByIdAndDelete(req.params.commentId);
    req.flash('success', 'Xóa bình luận và dữ liệu liên quan thành công');
    res.redirect(`/forum/topic/${req.params.forumId}/post/${req.params.postId}`);
  } catch (err) {
    console.error('Lỗi khi xóa bình luận:', err);
    req.flash('error', 'Lỗi khi xóa bình luận');
    res.redirect(`/forum/topic/${req.params.forumId}/post/${req.params.postId}`);
  }
});

// Hiển thị chi tiết bài viết
router.get('/topic/:forumId/post/:postId', authenticate, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId).populate('user');
    const forum = await Forum.findById(req.params.forumId).populate('teacher');
    if (!post || !forum) {
      req.flash('error', 'Bài viết hoặc chủ đề không tồn tại');
      return res.redirect(`/forum/topic/${req.params.forumId}`);
    }
    const isTeacher = forum.teacher && req.userId && forum.teacher._id.toString() === req.userId;
    const isOwner = post.user && req.userId && post.user._id.toString() === req.userId;
    if (post.pending && req.role !== 'admin' && !isTeacher && !isOwner) {
      req.flash('error', 'Bài viết chưa được duyệt');
      return res.redirect(`/forum/topic/${req.params.forumId}`);
    }
    const comments = await Comment.find({ post: req.params.postId }).populate('user');
    const isAuthenticated = req.userId !== null;
    const userRole = req.role;
    const notifications = req.notifications || [];
    res.render('post', { 
      post, 
      comments, 
      forumId: req.params.forumId, 
      forum,
      isAuthenticated, 
      userRole, 
      notifications,
      req
    });
  } catch (err) {
    console.error('Lỗi khi tải bài viết:', err);
    req.flash('error', 'Lỗi khi tải bài viết');
    res.redirect(`/forum/topic/${req.params.forumId}`);
  }
});

// Thêm bình luận
router.post('/topic/:forumId/post/:postId/comment', authenticate, upload.fields([
  { name: 'images', maxCount: 5 },
  { name: 'videos', maxCount: 2 },
  { name: 'files', maxCount: 3 }
]), async (req, res) => {
  if (!req.userId) {
    return res.redirect('/auth/login');
  }
  const { content } = req.body;
  try {
    // Kiểm tra từ ngữ nhạy cảm
    const sensitiveWords = await SensitiveWord.find();
    const contentLower = content.toLowerCase().replace(/[^\w\s]/g, '');
    const hasSensitiveWord = sensitiveWords.some(word => 
      contentLower.includes(word.word.toLowerCase())
    );
    if (hasSensitiveWord) {
      req.flash('error', 'Không thể bình luận do chứa từ ngữ không phù hợp');
      return res.redirect(`/forum/topic/${req.params.forumId}/post/${req.params.postId}`);
    }

    const images = [];
    const videos = [];
    const files = [];

    if (req.files.images) {
      for (const file of req.files.images) {
        const url = await uploadToCloudinary(file, 'forum/images');
        images.push(url);
      }
    }
    if (req.files.videos) {
      for (const file of req.files.videos) {
        const url = await uploadToCloudinary(file, 'forum/videos');
        videos.push(url);
      }
    }
    if (req.files.files) {
      for (const file of req.files.files) {
        const url = await uploadToCloudinary(file, 'forum/files');
        files.push(url);
      }
    }

    const comment = new Comment({
      content,
      post: req.params.postId,
      user: req.userId,
      images,
      videos,
      files,
    });
    await comment.save();

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

    req.flash('success', 'Thêm bình luận thành công');
    res.redirect(`/forum/topic/${req.params.forumId}/post/${req.params.postId}`);
  } catch (err) {
    console.error('Lỗi khi thêm bình luận:', err);
    req.flash('error', 'Lỗi khi thêm bình luận');
    res.redirect(`/forum/topic/${req.params.forumId}/post/${req.params.postId}`);
  }
});

// Báo cáo bình luận
router.post('/topic/:forumId/post/:postId/comment/:commentId/report', authenticate, async (req, res) => {
  try {
    const { forumId, postId, commentId } = req.params;
    
    // Kiểm tra tồn tại
    const comment = await Comment.findById(commentId).populate('user post');
    if (!comment) {
      req.flash('error', 'Bình luận không tồn tại');
      return res.redirect(`/forum/topic/${forumId}/post/${postId}`);
    }
    
    const post = await Post.findById(postId).populate('user forum');
    if (!post) {
      req.flash('error', 'Bài viết không tồn tại');
      return res.redirect(`/forum/topic/${forumId}`);
    }
    
    const forum = await Forum.findById(forumId).populate('user');
    if (!forum) {
      req.flash('error', 'Chủ đề không tồn tại');
      return res.redirect('/forum');
    }
    
    // Kiểm tra xem đã báo cáo chưa
    const existingReport = await Report.findOne({
      comment: commentId,
      reportedBy: req.userId
    });
    if (existingReport) {
      req.flash('error', 'Bạn đã báo cáo bình luận này rồi');
      return res.redirect(`/forum/topic/${forumId}/post/${postId}`);
    }
    
    // Tạo báo cáo
    const report = new Report({
      comment: commentId,
      reportedBy: req.userId,
      post: postId,
      forum: forumId
    });
    await report.save();
    
    // Tạo thông báo cho admin
    const admins = await User.find({ role: 'admin' });
    const adminNotifications = admins.map(admin => ({
      user: admin._id,
      post: postId,
      comment: commentId,
      commenter: comment.user._id,
      message: `Bình luận trong bài "${post.title}" bị báo cáo bởi ${req.userName || 'người dùng'}`,
      read: false
    }));
    
    // Tạo thông báo cho người tạo bài viết (nếu không phải người báo cáo)
    const postOwnerNotification = post.user._id.toString() !== req.userId.toString() ? [{
      user: post.user._id,
      post: postId,
      comment: commentId,
      commenter: comment.user._id,
      message: `Bình luận trong bài viết "${post.title}" của bạn bị báo cáo`,
      read: false
    }] : [];
    
    // Tạo thông báo cho người tạo chủ đề (nếu không phải người báo cáo hoặc người tạo bài viết)
    const forumOwnerNotification = forum.user._id.toString() !== req.userId.toString() && 
      forum.user._id.toString() !== post.user._id.toString() ? [{
      user: forum.user._id,
      post: postId,
      comment: commentId,
      commenter: comment.user._id,
      message: `Bình luận trong chủ đề "${forum.title}" bị báo cáo`,
      read: false
    }] : [];
    
    // Lưu tất cả thông báo
    await Notification.insertMany([
      ...adminNotifications,
      ...postOwnerNotification,
      ...forumOwnerNotification
    ]);
    
    req.flash('success', 'Báo cáo bình luận thành công');
    res.redirect(`/forum/topic/${forumId}/post/${postId}`);
  } catch (err) {
    console.error('Lỗi khi báo cáo bình luận:', err);
    req.flash('error', 'Lỗi khi báo cáo bình luận');
    res.redirect(`/forum/topic/${req.params.forumId}/post/${req.params.postId}`);
  }
});

module.exports = router;
module.exports.getForums = getForums;