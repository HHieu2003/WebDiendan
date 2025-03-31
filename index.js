const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const forumRoutes = require('./routes/forum');
const profileRoutes = require('./routes/profile');
const adminRoutes = require('./routes/admin');
const Notification = require('./models/Notification');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Kết nối MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Kết nối MongoDB Atlas thành công'))
  .catch(err => console.log('Lỗi kết nối MongoDB Atlas:', err));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/forum', forumRoutes);
app.use('/profile', profileRoutes);
app.use('/admin', adminRoutes);

// Đánh dấu thông báo là đã đọc
app.get('/notifications/mark-read/:id', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      console.log(`Thông báo không tồn tại: ${req.params.id}`);
      return res.status(404).send('Thông báo không tồn tại');
    }
    if (notification.user.toString() !== req.userId.toString()) {
      console.log(`Người dùng không có quyền: ${req.userId}`);
      return res.status(403).send('Bạn không có quyền truy cập thông báo này');
    }
    notification.read = true;
    await notification.save();
    console.log(`Thông báo đã được đánh dấu là đã đọc: ${notification._id}`);
    res.redirect(`/forum/topic/${notification.post.forum}/post/${notification.post._id}`);
  } catch (err) {
    console.error('Lỗi khi đánh dấu thông báo là đã đọc:', err);
    res.status(500).send('Lỗi server');
  }
});

// Trang chủ
app.get('/', authenticate, async (req, res) => {
  try {
    const forums = await forumRoutes.getForums();
    const isAuthenticated = req.userId !== null;
    const userRole = req.role;
    const notifications = req.notifications || [];
    console.log('Forums found:', forums);
    console.log('Forums length:', forums.length);
    res.render('index', { forums, isAuthenticated, userRole, notifications });
  } catch (err) {
    console.error('Lỗi khi lấy danh sách diễn đàn:', err);
    res.status(500).send('Lỗi server');
  }
});

// Khởi động server
app.listen(port, () => {
  console.log(`Server chạy tại http://localhost:${port}`);
});