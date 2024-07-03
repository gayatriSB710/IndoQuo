const express = require('express');
const { pool } = require('./db');
const format = require('pg-format');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { description } = req.body;
    const client = await pool.connect();
    
    // Get a list of all tables in the database, excluding 'movies'
    const tableListQuery = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name != 'movies' AND table_name != 'users';";
    const tableListResult = await client.query(tableListQuery);
    const tableNames = tableListResult.rows.map(row => row.table_name);
    
    // Construct a dynamic SQL query to search all tables except 'movies'
    let unionQueries = tableNames.map(table => {
      return format('SELECT context, %L AS table_name FROM %I WHERE context ILIKE $1', table, table);
    });
    const unionQuery = unionQueries.join(' UNION ALL ');
    const searchTerm = `%${description}%`;
    
    console.log(unionQuery);
    const result = await client.query(unionQuery, [searchTerm]);
    const data = result.rows;
    client.release();
    
    console.log(data);
    res.json(data);
  } catch (error) {
    console.error('Error while fetching data from PostgreSQL:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;