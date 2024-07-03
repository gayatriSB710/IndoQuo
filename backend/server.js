require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { connectToPool } = require('./db');
const authRoutes = require('./auth');
const userRoutes = require('./user');
const searchRoutes = require('./search');
const movieRoutes = require('./movie'); // New file we'll create

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

const port = process.env.PORT || 3000;

connectToPool();

// Use the routes
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/search', searchRoutes);
app.use('/movie', movieRoutes); // New movie routes

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});