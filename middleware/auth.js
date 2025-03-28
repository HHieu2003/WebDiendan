const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.cookies && req.cookies.token;
  if (!token) return res.status(401).send('Không có token, truy cập bị từ chối');

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).send('Token không hợp lệ');
  }
};

// Middleware kiểm tra quản trị viên
const adminAuth = (req, res, next) => {
  const token = req.cookies && req.cookies.token;
  if (!token) return res.status(401).send('Không có token, truy cập bị từ chối');

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'admin') return res.status(403).send('Chỉ quản trị viên mới có quyền truy cập');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).send('Token không hợp lệ');
  }
};

module.exports = { auth, adminAuth };