require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json());
const port = process.env.PORT || 5000;
app.use(cors());

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME
});

async function connectToPool() {
  try {
    await pool.connect();
    console.log('Connected to database');
  } catch (error) {
    console.error('Failed to connect to database:', error);
  }
}
connectToPool();

app.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *",
      [username, email, hashedPassword]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

app.post("/login", async (req, res) => {
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
      { userId: user.id, email: user.email },
      process.env.SECRET_KEY || '0b1ac8dd8197e876ab946f8ca7d480e95c3e7a2910033fbc0ac94ae8e5e40b3e1519a880a9663e949d38274d57693aa23aaf4d955cb9b200df4cb7d4db575316',
      { expiresIn: "1d" }
    );
    res.json({ token });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

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

app.get("/userinfo", verifyToken, async (req, res) => {
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

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});