const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');

const router = express.Router();

router.post("/signup", async (req, res) => {
    try {
      const { username, email, password } = req.body;
  
      // Check if email already exists
      const emailCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ message: "Email already exists" });
      }
  
      // If email doesn't exist, proceed with user creation
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await pool.query(
        "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *",
        [username, email, hashedPassword]
      );
  
      // Remove password from the response
      const { password: _, ...newUser } = result.rows[0];
      res.status(201).json(newUser);
    } catch (error) {
      console.error("Signup error:", error.message);
      res.status(500).json({ message: "Server Error", error: error.message });
    }
  });

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];
    if (!user) {
      return res.status(400).json({ message: "Invalid Credentials" });
    }
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(400).json({ message: "Invalid Credentials" });
    }
    const token = jwt.sign(
      { userId: user.id, email: user.email, isAdmin: true },
      process.env.SECRET_KEY || '0b1ac8dd8197e876ab946f8ca7d480e95c3e7a2910033fbc0ac94ae8e5e40b3e1519a880a9663e949d38274d57693aa23aaf4d955cb9b200df4cb7d4db575316',
      { expiresIn: "1d" }
    );
    res.json({
      token,
      redirectTo: '/admin.js'
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;