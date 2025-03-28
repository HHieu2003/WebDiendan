
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const forumRoutes = require('./routes/forum');
const profileRoutes = require('./routes/profile');
require('dotenv').config(); // Tải biến môi trường từ .env

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

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/forum', forumRoutes.router);
app.use('/profile', profileRoutes);

// Trang chủ
app.get('/', async (req, res) => {
  const forums = await forumRoutes.getForums();
  console.log('Forums found:', forums);
  console.log('Forums length:', forums.length);
  res.render('index', { forums });
});

// Khởi động server
app.listen(port, () => {
  console.log(`Server chạy tại http://localhost:${port}`);
});
