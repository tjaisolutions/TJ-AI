
import express from 'express';
import pg from 'pg';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Cria o servidor HTTP combinando Express
const httpServer = createServer(app);

// Configura o Socket.io no mesmo servidor
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Em produção, configure isso para o domínio do seu site
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database connection
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize Database Table
const initDb = async () => {
  if (!process.env.DATABASE_URL) {
    console.warn("⚠️ DATABASE_URL not found. Running in memory-only mode.");
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

// --- SOCKET.IO LOGIC ---
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Entrar em uma sala (fixa por enquanto, 'meeting-room-1')
  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
    // Avisa os outros que alguém entrou (para iniciar a conexão WebRTC)
    socket.to(roomId).emit('user-connected', socket.id);
  });

  // Novo evento: User diz que está pronto (útil para reconexões ou atrasos)
  socket.on('ready', (roomId) => {
    socket.to(roomId).emit('user-connected', socket.id);
  });

  // Evento específico para avisar que o compartilhamento de tela mudou
  socket.on('screen-toggle', (data) => {
    socket.to(data.roomId).emit('screen-toggle', data.isSharing);
  });

  // Sinalização WebRTC (Offer, Answer, ICE Candidates)
  socket.on('signal', (data) => {
    // CORREÇÃO: Se o target for 'broadcast' ou se tiver roomId mas não target específico
    // usamos socket.to(roomId) para enviar para todos na sala exceto o remetente.
    const roomId = data.roomId;
    const target = data.target;

    if (target && target !== 'broadcast') {
        // Envia para um usuário específico
        io.to(target).emit('signal', {
          sender: socket.id,
          signal: data.signal
        });
    } else if (roomId) {
        // Broadcast na sala (excluindo quem enviou)
        socket.to(roomId).emit('signal', {
          sender: socket.id,
          signal: data.signal
        });
    }
  });

  // Sinalização para saída
  socket.on('disconnect', () => {
    console.log('User disconnected');
    io.emit('user-disconnected', socket.id);
  });
});

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: process.env.DATABASE_URL ? 'cloud' : 'memory' });
});

app.get('/api/:key', async (req, res) => {
  const { key } = req.params;
  if (!process.env.DATABASE_URL) return res.json([]);

  try {
    const result = await pool.query('SELECT value FROM app_data WHERE key = $1', [key]);
    if (result.rows.length > 0) {
      res.json(result.rows[0].value);
    } else {
      res.json([]);
    }
  } catch (err) {
    console.error(`Error fetching ${key}:`, err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/:key', async (req, res) => {
  const { key } = req.params;
  const data = req.body;

  if (!process.env.DATABASE_URL) {
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

// Serve Static Files
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Use httpServer.listen com '0.0.0.0' para evitar Timeout no Render
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
