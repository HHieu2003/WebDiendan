const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const forumRoutes = require('./routes/forum');
const profileRoutes = require('./routes/profile');

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

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/forum', forumRoutes); // Sửa lỗi: Bỏ .router vì forumRoutes đã là router
app.use('/profile', profileRoutes);

// Trang chủ
app.get('/', authenticate, async (req, res) => {
  try {
    const forums = await forumRoutes.getForums(); // Gọi hàm getForums từ forumRoutes
    const isAuthenticated = req.userId !== null;
    console.log('Forums found:', forums);
    console.log('Forums length:', forums.length);
    res.render('index', { forums, isAuthenticated });
  } catch (err) {
    console.error('Lỗi khi lấy danh sách diễn đàn:', err);
    res.status(500).send('Lỗi server');
  }
});

// Khởi động server
app.listen(port, () => {
  console.log(`Server chạy tại http://localhost:${port}`);
});