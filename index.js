

const User = require('./models/User');
const Comment = require('./models/Comment');

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer'); // Thêm multer
const cloudinary = require('cloudinary').v2; // Thêm Cloudinar
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const forumRoutes = require('./routes/forum');
const profileRoutes = require('./routes/profile');
const adminRoutes = require('./routes/admin');
const Notification = require('./models/Notification');
const Forum = require('./models/Forum');
const Post = require('./models/Post');




require('dotenv').config();




const app = express();
const port = process.env.PORT || 5000;


// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Kết nối MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Kết nối MongoDB Atlas thành công'))
  .catch(err => console.log('Lỗi kết nối MongoDB Atlas:', err));


  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'public/uploads/'); // Thư mục lưu trữ
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + '-' + file.originalname); // Tên tệp duy nhất
    },
  });
  
  const fileFilter = (req, file, cb) => {
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
    const allowedVideoTypes = ['video/mp4', 'video/mpeg', 'video/webm'];
    const allowedFileTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  
    if (allowedImageTypes.includes(file.mimetype)) {
      req.fileType = 'image';
      cb(null, true);
    } else if (allowedVideoTypes.includes(file.mimetype)) {
      req.fileType = 'video';
      cb(null, true);
    } else if (allowedFileTypes.includes(file.mimetype)) {
      req.fileType = 'file';
      cb(null, true);
    } else {
      cb(new Error('Loại tệp không được phép'), false);
    }
  };
  
  const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 100 * 1024 * 1024 }, // Giới hạn 100MB
  });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    res.locals.userCount = await User.countDocuments();
    res.locals.forumCount = await Forum.countDocuments();
    res.locals.postCount = await Post.countDocuments();
    res.locals.todayPostCount = await Post.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    });
    res.locals.todayCommentCount = await Comment.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    });
    next();
  } catch (err) {
    console.error('Lỗi lấy thống kê:', err);
    res.locals.userCount = res.locals.forumCount = res.locals.postCount = 0;
    res.locals.todayPostCount = res.locals.todayCommentCount = 0;
    next();
  }
});

// Cấu hình session
app.use(session({
  secret: 'your_jwt_secret', // Thay bằng chuỗi bí mật của bạn
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Đặt secure: true nếu dùng HTTPS
}));

app.use(flash()); // Đặt sau session
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success');
  res.locals.error_msg = req.flash('error');
  next();
});

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
    const forums = await Forum.find().populate('user');
    const forumIds = forums.map(forum => forum._id);
    const posts = await Post.find({ forum: { $in: forumIds } }).populate('user');
    const isAuthenticated = req.userId !== null;
    const userRole = req.role;
    const notifications = req.notifications || [];
    res.render('index', { forums, posts, isAuthenticated, userRole, notifications });
  } catch (err) {
    console.error('Lỗi khi tải trang chủ:', err);
    res.status(500).send('Lỗi server');
  }
});

// Khởi động server
app.listen(port, () => {
  console.log(`Server chạy tại http://localhost:${port}`);
});