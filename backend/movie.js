const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
let imageType;
import('image-type').then((module) => {
    imageType = module.default;
}).catch(err => console.error(err));
const { pool } = require('./db');

const router = express.Router();

const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image.'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

router.post("/upload", upload.single('movieScript'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const movieName = req.body.movieName;
    const moviePoster = req.body.moviePoster;

    if (!movieName) {
      return res.status(400).json({ error: "Movie name is required" });
    }

    const results = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => {
        console.log("CSV row:", data);
        results.push(data);
      })
      .on('end', async () => {
        if (results.length === 0) {
          return res.status(400).json({ error: "No data found in CSV" });
        }

        console.log("First row of CSV:", results[0]);

        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          const tableName = `"${movieName.replace(/"/g, '""')}"`;
          
          const columns = Object.keys(results[0]);
          console.log("CSV columns:", columns);

          const createTableQuery = `
            CREATE TABLE IF NOT EXISTS ${tableName} (
              Serial_no SERIAL PRIMARY KEY,
              ${columns.map(col => `"${col}" TEXT`).join(', ')}
            )
          `;
          console.log("Create table query:", createTableQuery);
          await client.query(createTableQuery);

          for (const row of results) {
            const insertQuery = `
              INSERT INTO ${tableName} (${columns.map(col => `"${col}"`).join(', ')})
              VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
            `;
            const values = columns.map(col => row[col]);
            console.log("Insert query:", insertQuery);
            console.log("Insert values:", values);
            await client.query(insertQuery, values);
          }

          const result = await client.query(
            "INSERT INTO movies (name, moviePoster) VALUES ($1, $2) RETURNING *",
            [movieName, moviePoster]
          );

          await client.query('COMMIT');
          fs.unlinkSync(req.file.path);
          res.status(201).json(result.rows[0]);
        } catch (error) {
          await client.query('ROLLBACK');
          console.error("Database error:", error.message);
          res.status(500).send("Server Error: " + error.message);
        } finally {
          client.release();
        }
      });
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).send("Server Error: " + error.message);
  }
});

router.post("/upload-poster", upload.single('moviePoster'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const movieName = req.body.movieName;
    if (!movieName) {
      return res.status(400).json({ error: "Movie name is required" });
    }

    const buffer = fs.readFileSync(req.file.path);
    const type = imageType(buffer);
    if (!type || !type.mime.startsWith('image/')) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Uploaded file is not a valid image" });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        "UPDATE movies SET moviePoster = $1 WHERE name = $2 RETURNING *",
        [buffer, movieName]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Movie not found" });
      }

      fs.unlinkSync(req.file.path);

      res.status(200).json({ message: "Poster uploaded successfully", movie: result.rows[0] });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).send("Server Error: " + error.message);
  }
});

router.get("/movie-poster/:movieName", async (req, res) => {
  const movieName = req.params.movieName;

  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT moviePoster FROM movies WHERE name = $1",
      [movieName]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Movie not found" });
    }

    const posterData = result.rows[0].movieposter;

    const type = imageType(posterData);
    if (!type) {
      return res.status(500).json({ error: "Invalid image data" });
    }

    res.contentType(type.mime);
    res.send(posterData);
  } catch (error) {
    console.error("Database error:", error.message);
    res.status(500).send("Server Error: " + error.message);
  } finally {
    client.release();
  }
});

module.exports = router;