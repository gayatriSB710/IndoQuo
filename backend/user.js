const express = require('express');
const { pool } = require('./db');
const { verifyToken } = require('./middleware');

const router = express.Router();

router.get("/info", verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT username, email FROM users WHERE id = $1', [req.user.userId]);
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ user });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;