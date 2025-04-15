const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  req.isAuthenticated = !!token;
  
  // Bỏ qua kiểm tra token cho các route công khai
  if (['/auth/register', '/auth/login'].includes(req.path) && req.method === 'POST') {
    return next();
  }
  
  if (!token) {
    req.isAuthenticated = false;
    return res.redirect('/auth/login');
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.userId = decoded.userId; // Sửa từ decoded.id thành decoded.userId
    req.isAuthenticated = true;
    req.userRole = decoded.role; // Thêm userRole để đồng bộ với auth.js
    next();
  } catch (err) {
    console.error('Error verifying token:', err);
    res.clearCookie('token');
    req.isAuthenticated = false;
    res.redirect('/auth/login');
  }
};

module.exports = verifyToken;