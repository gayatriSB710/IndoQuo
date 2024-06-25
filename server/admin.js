require('dotenv').config();
const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const { Pool } = require('pg');
const fs = require('fs');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const upload = multer({ dest: 'uploads/' });

const app = express();
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createMoviesTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS movies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        time_in VARCHAR(8) NOT NULL,
        time_out VARCHAR(8) NOT NULL
      );
    `);
    console.log('Movies table created or already exists');
  } catch (error) {
    console.error('Error creating movies table:', error);
  } finally {
    client.release();
  }
}

createMoviesTable().catch(error => {
  console.error('Failed to create movies table:', error);
  process.exit(1);
});

app.post("/upload", upload.single('movieScript'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const movieName = req.body.movieName;
    if (!movieName) {
      return res.status(400).json({ error: "Movie name is required" });
    }

    const results = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        if (results.length === 0) {
          return res.status(400).json({ error: "No data found in CSV" });
        }

        const timeIn = results[0].time_in;
        const timeOut = results[results.length - 1].time_out;

        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          const tableName = `"${movieName.replace(/"/g, '""')}"`;
          await client.query(`
            CREATE TABLE IF NOT EXISTS ${tableName} (
              id SERIAL PRIMARY KEY,
              time_in TEXT,
              time_out TEXT,
              dialogue TEXT
            )
          `);

          for (const row of results) {
            await client.query(
              `INSERT INTO ${tableName} (time_in, time_out, dialogue) VALUES ($1, $2, $3)`,
              [row.time_in, row.time_out, row.dialogue]
            );
          }

          const result = await client.query(
            "INSERT INTO movies (name, time_in, time_out) VALUES ($1, $2, $3) RETURNING *",
            [movieName, timeIn, timeOut]
          );

          await client.query('COMMIT');

          fs.unlinkSync(req.file.path);

          res.status(201).json(result.rows[0]);
        } catch (error) {
          await client.query('ROLLBACK');
          console.error(error.message);
          res.status(500).send("Server Error");
        } finally {
          client.release();
        }
      });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// const express = require('express');
// const busboy = require('busboy');
// const csv = require('csv-parser');
// const { Pool } = require('pg');
// const fs = require('fs');
// const path = require('path');

// const app = express();

// if (!process.env.DATABASE_URL) {
//   console.error('DATABASE_URL is not set.');
//   process.exit(1);

// } else {
//   console.log('DATABASE_URL is set.');
// }

// // Ensure the uploads directory exists
// const uploadPath = path.join(__dirname, 'uploads');
// fs.mkdirSync(uploadPath, { recursive: true });

// // Database connection
// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
// });

// app.post('/upload', (req, res) => {
//   const bb = busboy({ headers: req.headers });
//   let movieName = '';
//   let csvFilePath = '';

//   bb.on('field', (name, val) => {
//     if (name === 'movieName') {
//       movieName = val;
//     }
//   });

//   bb.on('file', (name, file, info) => {
//     if (name === 'movieScript') {
//       const saveTo = path.join(uploadPath, `${Date.now()}-${info.filename}`);
//       csvFilePath = saveTo;
//       file.pipe(fs.createWriteStream(saveTo));
//     }
//   });

//   bb.on('finish', async () => {
//     if (!movieName) {
//       return res.status(400).json({ error: "Movie name is required" });
//     }
//     if (!csvFilePath) {
//       return res.status(400).json({ error: "No file uploaded" });
//     }

//     try {
//       const results = [];
//       fs.createReadStream(csvFilePath)
//         .pipe(csv())
//         .on('data', (data) => results.push(data))
//         .on('end', async () => {
//           if (results.length === 0) {
//             return res.status(400).json({ error: "No data found in CSV" });
//           }

//           const timeIn = results[0].time_in;
//           const timeOut = results[results.length - 1].time_out;

//           const client = await pool.connect();
//           try {
//             await client.query('BEGIN');

//             // Create a new table for the movie script
//             const tableName = `"${movieName.replace(/"/g, '""')}"`;
//             await client.query(`
//               CREATE TABLE IF NOT EXISTS ${tableName} (
//                 id SERIAL PRIMARY KEY,
//                 time_in TEXT,
//                 time_out TEXT,
//                 dialogue TEXT
//               )
//             `);

//             // Insert script lines into the new table
//             for (const row of results) {
//               await client.query(
//                 `INSERT INTO ${tableName} (time_in, time_out, dialogue) VALUES ($1, $2, $3)`,
//                 [row.time_in, row.time_out, row.dialogue]
//               );
//             }

//             // Insert movie details into the movies table
//             const result = await client.query(
//               "INSERT INTO movies (name, time_in, time_out) VALUES ($1, $2, $3) RETURNING *",
//               [movieName, timeIn, timeOut]
//             );

//             await client.query('COMMIT');
            
//             // Delete the uploaded file
//             fs.unlinkSync(csvFilePath);

//             res.status(201).json(result.rows[0]);
//           } catch (error) {
//             await client.query('ROLLBACK');
//             console.error('Database error:', error);
//             res.status(500).json({ error: "Server error" });
//           } finally {
//             client.release();
//           }
//         });
//     } catch (error) {
//       console.error('File processing error:', error);
//       res.status(500).json({ error: "Server error" });
//     }
//   });

//   req.pipe(bb);
// });

// const port = process.env.PORT || 3000;
// app.listen(port, () => {
//   console.log(`Server is running on port ${port}`);
// });