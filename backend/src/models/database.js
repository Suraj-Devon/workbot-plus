const { Pool } = require('pg');

// Create a connection pool to PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
});

// Function to initialize database
const initializeDatabase = async () => {
  try {
    console.log('📊 Initializing database schema...');

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
    console.log('✅ Users table created/verified');

    // Create bot_executions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bot_type VARCHAR(50) NOT NULL,
        file_name VARCHAR(255),
        file_size_bytes INT,
        status VARCHAR(50) DEFAULT 'pending',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        execution_time_ms INT
      );

      CREATE INDEX IF NOT EXISTS idx_bot_executions_user ON bot_executions(user_id, created_at DESC);
    `);
    console.log('✅ Bot executions table created/verified');

    // Create results table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        execution_id UUID NOT NULL REFERENCES bot_executions(id) ON DELETE CASCADE,
        result_data JSONB,
        chart_urls TEXT[],
        summary_text TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_results_execution ON results(execution_id);
    `);
    console.log('✅ Results table created/verified');

    // Create api_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS api_logs (
        id BIGSERIAL PRIMARY KEY,
        endpoint VARCHAR(255),
        method VARCHAR(10),
        status_code INT,
        response_time_ms INT,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        error_details TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_logs(created_at DESC);
    `);
    console.log('✅ API logs table created/verified');

    console.log('✅ Database initialization complete!');
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    throw error;
  }
};

// Query function
const query = (text, params) => pool.query(text, params);

// Get single row
const getOne = async (text, params) => {
  const result = await pool.query(text, params);
  return result.rows[0];
};

// Get multiple rows
const getAll = async (text, params) => {
  const result = await pool.query(text, params);
  return result.rows;
};

module.exports = {
  pool,
  query,
  getOne,
  getAll,
  initializeDatabase,
};
