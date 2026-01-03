const { execFile } = require('child_process');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/database');
const fs = require('fs');

/**
 * Screen resumes against job description
 * @param {string} filesPath - Path to directory with resume files
 * @param {string} jobDescription - Job description text
 * @param {string} userId - User ID
 * @returns {Promise<object>} Screening results
 */
const screenResumes = async (filesPath, jobDescription, userId) => {
  return new Promise((resolve) => {
    try {
      const pythonScript = path.join(__dirname, '../../ai_workers/resume_screener_bot.py');

      // Ensure temp dir exists (optional; keeping your behavior)
      const tempDir = path.join(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      db.query(
        `INSERT INTO bot_executions (id, user_id, bot_type, status, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id`,
        [uuidv4(), userId || null, 'resume-screener', 'running']
      )
        .then(async ({ rows }) => {
          const executionId = rows[0].id;

          const pythonArgs = [pythonScript, filesPath, jobDescription, executionId];

          console.log('Executing (execFile):', 'python', pythonArgs);

          // KEY FIX: increase timeout now that you process 228/300 files
          // 15 minutes is a safe starting point on Render.
          const TIMEOUT_MS = Number(process.env.RESUME_SCREENER_TIMEOUT_MS || 15 * 60 * 1000);

          execFile(
            'python',
            pythonArgs,
            {
              cwd: path.dirname(pythonScript),
              timeout: TIMEOUT_MS,
              maxBuffer: 50 * 1024 * 1024, // 50MB stdout buffer
            },
            async (error, stdout, stderr) => {
              try {
                if (error) {
                  // This is the info you need to confirm timeout-kill vs real crash
                  console.error('Python execFile error:', {
                    message: error.message,
                    code: error.code,
                    signal: error.signal,
                    killed: error.killed,
                    timeoutMs: TIMEOUT_MS,
                  });
                  console.error('Python stderr:', stderr);

                  await db.query(
                    `UPDATE bot_executions
                        SET status = $2
                      WHERE id = $1`,
                    [executionId, 'failed']
                  );

                  return resolve({
                    success: false,
                    error: 'Screening failed',
                    message: stderr || error.message,
                    meta: {
                      code: error.code,
                      signal: error.signal,
                      killed: error.killed,
                      timeoutMs: TIMEOUT_MS,
                    },
                  });
                }

                if (!stdout) {
                  await db.query(
                    `UPDATE bot_executions
                        SET status = $2
                      WHERE id = $1`,
                    [executionId, 'failed']
                  );

                  return resolve({
                    success: false,
                    error: 'No output',
                    message: 'Python script returned empty output',
                  });
                }

                let result;
                try {
                  result = JSON.parse(stdout.trim());
                } catch (parseErr) {
                  console.error('Parse error:', parseErr, 'Raw output:', stdout);

                  await db.query(
                    `UPDATE bot_executions
                        SET status = $2
                      WHERE id = $1`,
                    [executionId, 'failed']
                  );

                  return resolve({
                    success: false,
                    error: 'Invalid output format',
                    message: 'Python script returned invalid JSON',
                  });
                }

                await db.query(
                  `INSERT INTO results (id, execution_id, result_data, summary_text, created_at)
                   VALUES ($1, $2, $3, $4, NOW())`,
                  [uuidv4(), executionId, result, result.summary || 'Screening complete']
                );

                await db.query(
                  `UPDATE bot_executions
                      SET status = $2
                    WHERE id = $1`,
                  [executionId, 'completed']
                );

                resolve({ success: true, executionId, data: result });
              } catch (err) {
                console.error('Service error:', err);

                await db.query(
                  `UPDATE bot_executions
                      SET status = $2
                    WHERE id = $1`,
                  [executionId, 'failed']
                );

                resolve({
                  success: false,
                  error: 'Failed to process results',
                  message: err.message,
                });
              }
            }
          );
        })
        .catch((error) => {
          console.error('Screening error (create execution):', error);
          resolve({ success: false, error: 'Internal error', message: error.message });
        });
    } catch (error) {
      console.error('Screening error:', error);
      resolve({ success: false, error: 'Internal error', message: error.message });
    }
  });
};

module.exports = { screenResumes };
