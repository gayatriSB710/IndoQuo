const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function connectToPool() {
  try {
    await pool.connect();
    console.log('Connected to database');
    await createMoviesTable();
  } catch (error) {
    console.error('Failed to connect to database:', error);
  }
}

async function createMoviesTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS movies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        moviePoster BYTEA
      );
    `);
    console.log('Movies table created or already exists');
  } catch (error) {
    console.error('Error creating movies table:', error);
  } finally {
    client.release();
  }
}

module.exports = { pool, connectToPool };