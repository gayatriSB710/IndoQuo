const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const token = req.headers.authorization && req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Missing token" });
  }
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY || '0b1ac8dd8197e876ab946f8ca7d480e95c3e7a2910033fbc0ac94ae8e5e40b3e1519a880a9663e949d38274d57693aa23aaf4d955cb9b200df4cb7d4db575316');
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Token Verification Failed: ", error.message);
    res.status(400).json({ message: "Invalid Token" });
  }
}

module.exports = { verifyToken };