const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const dotenv = require('dotenv');
//const { Transliterator } = require('@ai4bharat/indic-transliterate');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// const LANGUAGE_SCHEMES = {
//   'hindi': 'devanagari',
//   'bengali': 'bengali',
//   'gujarati': 'gujarati',
//   'kannada': 'kannada',
//   'malayalam': 'malayalam',
//   'marathi': 'devanagari',
//   'oriya': 'oriya',
//   'tamil': 'tamil',
//   'telugu': 'telugu',
//   'punjabi': 'gurmukhi'
// };

const { transliterate } = require('@ai4bharat/indic-transliterate');
const { getTransliterateSuggestions } = require("@ai4bharat/indic-transliterate");

const LANGUAGE_SCHEMES = {
  'hindi': 'devanagari',
  'bengali': 'bengali',
  'gujarati': 'gujarati',
  'kannada': 'kannada',
  'malayalam': 'malayalam',
  'marathi': 'devanagari',
  'oriya': 'oriya',
  'tamil': 'tamil',
  'telugu': 'telugu',
  'punjabi': 'gurmukhi'
};

// function transliterateText(text, targetLanguage) {
//   const scheme = LANGUAGE_SCHEMES[targetLanguage.toLowerCase()];
//   if (scheme) {
//     const tr = new Transliterator(scheme);
//     return tr.transliterate(text);
//   } else {
//     return 'Unsupported language';
//   }
// }
const { Transliterator } = require('@ai4bharat/indic-transliterate');

function transliterateText(text, targetLanguage) {
  const scheme = LANGUAGE_SCHEMES[targetLanguage];
  if (scheme) {
    const transliterator = new Transliterator(scheme);
    return transliterator.transliterate(text);
  } else {
    return 'Unsupported language';
  }
}

app.post('/transliterate', (req, res) => {
  const { input_text, target_language } = req.body;
  console.log(typeof transliterate); 
  if (!input_text) {
    return res.status(200).json({ output_text: '' });
  }
  const transliteratedText = transliterateText(input_text, target_language || 'hindi');
  res.json({ output_text: transliteratedText });
});

app.post('/suggestions', async (req, res) => {
  try {
    const { word, targetLanguage } = req.body;
    const scheme = LANGUAGE_SCHEMES[targetLanguage];

    if (!scheme) {
      return res.status(400).json({ error: 'Unsupported language' });
    }

    const data = await getTransliterateSuggestions(word, {
      numOptions: 5,
      showCurrentWordAsLastSuggestion: true,
      lang: scheme,
    });

    res.json({ suggestions: data });
  } catch (error) {
    console.error('Error while fetching suggestions:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// app.get('/search', async (req, res) => {
//   try {
//     const userInput = req.query.q || '';
//     const client = await pool.connect();
//     const query = "SELECT * FROM bioscope_1 WHERE context LIKE $1";
//     const searchTerm = `%${userInput}%`;
//     const result = await client.query(query, [searchTerm]);
//     const data = result.rows;
//     client.release();
//     res.json(data);
//   } catch (error) {
//     console.error('Error while fetching data from PostgreSQL:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// const port = process.env.PORT || 3000;

const { Pool } = require('pg');
const format = require('pg-format');

app.get('/search', async (req, res) => {
  try {
    const userInput = req.query.q || '';
    const client = await pool.connect();

    // Get a list of all tables in the database, excluding 'movies'
    const tableListQuery = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name != 'movies' AND table_name != `users`;";
    const tableListResult = await client.query(tableListQuery);
    const tableNames = tableListResult.rows.map(row => row.table_name);

    // Construct a dynamic SQL query to search all tables except 'movies'
    let unionQueries = tableNames.map(table => {
      // Use double quotes for table names to handle spaces and special characters
      return format('SELECT context, %L AS table_name FROM %I WHERE context ILIKE $1', table, table);
    });

    const unionQuery = unionQueries.join(' UNION ALL ');

    const searchTerm = `%${userInput}%`;
    console.log(unionQuery);

    const result = await client.query(unionQuery, [searchTerm]);
    const data = result.rows;
    client.release();
    res.json(data);
  } catch (error) {
    console.error('Error while fetching data from PostgreSQL:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log(`Server is running on port 3000`);
});
