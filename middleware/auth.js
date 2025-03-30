const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  req.isAuthenticated = !!token; // Đặt biến isAuthenticated dựa trên sự tồn tại của token
  if (!token) {
    return res.redirect('/auth/login');
  }
  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    req.userId = decoded.id;
    req.isAuthenticated = true; // Xác nhận đăng nhập thành công
    next();
  } catch (err) {
    console.error('Error verifying token:', err);
    res.clearCookie('token');
    req.isAuthenticated = false;
    res.redirect('/auth/login');
  }
};

module.exports = verifyToken;