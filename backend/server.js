require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./src/models/database');
const authRoutes = require('./src/routes/auth');
const botsRoutes = require('./src/routes/bots');

const app = express();

// Security & CORS
app.use(helmet());

// allowed frontend origins
const allowedOrigins = [
  'http://localhost:3000',
  'https://workbot-plus.vercel.app', // Vercel frontend
];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow mobile apps / curl / Postman with no origin
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// Body parsing
app.use(express.json());

// Initialize database when server starts
let dbInitialized = false;

// Health Check Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'WorkBot+ Backend is running!',
    timestamp: new Date().toISOString(),
    database: dbInitialized ? 'Connected' : 'Initializing',
  });
});

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to WorkBot+ API' });
});

// Auth Routes
app.use('/api/auth', authRoutes);

// Bot Routes
app.use('/api/bots', botsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Initialize database
    await db.initializeDatabase();
    dbInitialized = true;
    console.log('✅ Database initialized successfully');

    app.listen(PORT, () => {
      console.log(`✅ WorkBot+ Backend listening on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔄 Running in ${process.env.NODE_ENV} mode`);
      console.log('');
      console.log('📚 API Endpoints:');
      console.log(`   POST   /api/auth/signup           - Register new user`);
      console.log(`   POST   /api/auth/login            - Log in user`);
      console.log(`   GET    /api/auth/verify           - Verify token (protected)`);
      console.log(`   GET    /api/auth/me               - Get user info (protected)`);
      console.log(`   POST   /api/bots/data-analyst     - Analyze CSV (protected)`);
      console.log(`   POST   /api/bots/resume-screener  - Screen resumes (protected)`);
      console.log(`   GET    /api/bots/history          - Get execution history (protected)`);
      console.log(`   GET    /api/bots/result/:id       - Get execution results (protected)`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
