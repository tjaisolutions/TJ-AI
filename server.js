import express from 'express';
import pg from 'pg';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database connection
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize Database Table (Key-Value Store style)
const initDb = async () => {
  if (!process.env.DATABASE_URL) {
    console.warn("⚠️ DATABASE_URL not found. Running in memory-only mode (data will be lost on restart).");
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_data (
        key TEXT PRIMARY KEY,
        value JSONB,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Database initialized successfully.");
  } catch (err) {
    console.error("❌ Error initializing database:", err);
  }
};

initDb();

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: process.env.DATABASE_URL ? 'cloud' : 'memory' });
});

// Generic GET for any resource collection (users, projects, etc)
app.get('/api/:key', async (req, res) => {
  const { key } = req.params;
  
  if (!process.env.DATABASE_URL) {
    return res.json([]); // Fallback empty if no DB
  }

  try {
    const result = await pool.query('SELECT value FROM app_data WHERE key = $1', [key]);
    if (result.rows.length > 0) {
      res.json(result.rows[0].value);
    } else {
      res.json([]); // Default to empty array if not found
    }
  } catch (err) {
    console.error(`Error fetching ${key}:`, err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Generic POST to save any resource collection
app.post('/api/:key', async (req, res) => {
  const { key } = req.params;
  const data = req.body;

  if (!process.env.DATABASE_URL) {
    console.log(`[Memory Mode] Saved ${key} (${Array.isArray(data) ? data.length : 1} items)`);
    return res.json({ success: true, mode: 'memory' });
  }

  try {
    await pool.query(`
      INSERT INTO app_data (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = $2, updated_at = NOW();
    `, [key, JSON.stringify(data)]);
    
    res.json({ success: true });
  } catch (err) {
    console.error(`Error saving ${key}:`, err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Serve Static Files (The React App)
app.use(express.static(path.join(__dirname, 'dist')));

// Handle React Routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
