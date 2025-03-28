ttttt
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const forumRoutes = require('./routes/forum');
const profileRoutes = require('./routes/profile');

const app = express();
const port = 3000;

// Kết nối MongoDB
mongoose.connect('mongodb://localhost:27017/studentmanagement', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Kết nối MongoDB thành công'))
  .catch(err => console.log('Lỗi kết nối MongoDB:', err));

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
