const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/database');

const PYTHON_BIN = process.env.PYTHON_BIN || 'python';
const TIMEOUT_MS = Number(process.env.DATA_ANALYST_TIMEOUT_MS || 300000);


// Keep for backwards compatibility (not used by spawn, but keep env contract)
const MAX_BUFFER_BYTES = Number(process.env.DATA_ANALYST_MAX_BUFFER || 10 * 1024 * 1024); // 10MB

// Server-side guard (never trust the client limit)
const MAX_FILE_BYTES = Number(process.env.DATA_ANALYST_MAX_FILE_BYTES || 10 * 1024 * 1024);

function safeParsePythonJson(stdout) {
  const text = (stdout || '').toString().trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (_) {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) {
      return JSON.parse(text.slice(first, last + 1));
    }
    throw new Error('Python output was not valid JSON');
  }
}

function truncate(s, n = 2000) {
  const t = (s || '').toString();
  return t.length > n ? t.slice(0, n) : t;
}

/**
 * Call Python Data Analyst Bot
 * @param {string} filePath - Path to uploaded file (CSV/JSON/JSONL)
 * @param {string} userId - User ID (for record-keeping/logging)
 * @param {string} executionId - bot_executions.id created by the route
 * @returns {Promise<object>} Analysis results
 */
const analyzeData = async (filePath, userId, executionId) => {
  return new Promise((resolve) => {
    (async () => {
      try {
        if (!executionId) {
          return resolve({
            success: false,
            error: 'Missing executionId',
            message: 'Server error: executionId not provided to service',
          });
        }

        if (!filePath || !fs.existsSync(filePath)) {
          await db.query(
            `UPDATE bot_executions SET status = $1, error_message = $2 WHERE id = $3`,
            ['failed', 'File missing on server', executionId]
          );

          return resolve({
            success: false,
            executionId,
            error: 'Invalid file',
            message: 'File path is missing or file does not exist',
          });
        }

        // Size guard
        try {
          const st = fs.statSync(filePath);
          if (st.size > MAX_FILE_BYTES) {
            await db.query(
              `UPDATE bot_executions SET status = $1, error_message = $2 WHERE id = $3`,
              ['failed', 'File too large (server guard)', executionId]
            );

            return resolve({
              success: false,
              executionId,
              error: 'File too large',
              message: `Max allowed size is ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB`,
            });
          }
        } catch (e) {
          console.warn('File stat warning:', e?.message);
        }

        const pythonScript = path.join(__dirname, '../../ai_workers/data_analyst_bot.py');

        // Mark as running
        await db.query(
          `UPDATE bot_executions SET status = $1 WHERE id = $2`,
          ['running', executionId]
        );

        const args = [pythonScript, filePath, executionId];

        // Use spawn to avoid maxBuffer issues and to capture stderr properly. [web:228]
        const child = spawn(PYTHON_BIN, args, {
          windowsHide: true,
          env: process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        // Optional soft cap to avoid huge memory usage if python prints too much
        const SOFT_STDOUT_CAP = MAX_BUFFER_BYTES; // reuse your env var as a cap
        const SOFT_STDERR_CAP = 2 * 1024 * 1024;

        const timeout = setTimeout(() => {
          try {
            child.kill('SIGKILL');
          } catch (_) {}

          // DB update on timeout
          db.query(
            `UPDATE bot_executions SET status = $1, error_message = $2 WHERE id = $3`,
            ['failed', `Timed out after ${TIMEOUT_MS}ms`, executionId]
          ).catch(() => {});

          return resolve({
            success: false,
            executionId,
            error: 'Analysis failed',
            message: `Timed out after ${TIMEOUT_MS}ms`,
          });
        }, TIMEOUT_MS);

        child.stdout.on('data', (d) => {
          if (stdout.length < SOFT_STDOUT_CAP) stdout += d.toString();
        });

        child.stderr.on('data', (d) => {
          if (stderr.length < SOFT_STDERR_CAP) stderr += d.toString();
        });

        child.on('error', async (err) => {
          clearTimeout(timeout);

          const msg = truncate(err?.message || 'Python spawn error');
          await db.query(
            `UPDATE bot_executions SET status = $1, error_message = $2 WHERE id = $3`,
            ['failed', msg, executionId]
          );

          return resolve({
            success: false,
            executionId,
            error: 'Analysis failed',
            message: msg,
          });
        });

        child.on('close', async (code) => {
          clearTimeout(timeout);

          // If python failed, use stderr first (real reason), then stdout fallback
          if (code !== 0) {
            const msg = truncate(stderr || stdout || `Python exited with code ${code}`);
            await db.query(
              `UPDATE bot_executions SET status = $1, error_message = $2 WHERE id = $3`,
              ['failed', msg, executionId]
            );

            // This prints in Render logs, making debugging easy. [web:763]
            console.error('Data analyst python failed:', { executionId, code, msg });

            return resolve({
              success: false,
              executionId,
              error: 'Analysis failed',
              message: msg,
            });
          }

          if (!stdout) {
            await db.query(
              `UPDATE bot_executions SET status = $1, error_message = $2 WHERE id = $3`,
              ['failed', 'Python returned empty output', executionId]
            );

            return resolve({
              success: false,
              executionId,
              error: 'No output',
              message: 'Python script returned empty output',
            });
          }

          try {
            const result = safeParsePythonJson(stdout);

            if (!result || typeof result !== 'object') {
              await db.query(
                `UPDATE bot_executions SET status = $1, error_message = $2 WHERE id = $3`,
                ['failed', 'Python output parse failed', executionId]
              );

              return resolve({
                success: false,
                executionId,
                error: 'Invalid output',
                message: 'Python output could not be parsed',
              });
            }

            // Store results
            await db.query(
              `INSERT INTO results (id, execution_id, result_data, summary_text, created_at)
               VALUES ($1, $2, $3, $4, NOW())`,
              [uuidv4(), executionId, result, result.summary || 'Analysis complete']
            );

            const status = result.success === false ? 'failed' : 'completed';
            await db.query(
              `UPDATE bot_executions
               SET status = $1, completed_at = NOW(), error_message = NULL
               WHERE id = $2`,
              [status, executionId]
            );

            return resolve({
              success: status === 'completed',
              executionId,
              data: result,
            });
          } catch (err) {
            console.error('Result handling error:', err);

            const msg = truncate(err?.message || 'Failed to process results');
            await db.query(
              `UPDATE bot_executions SET status = $1, error_message = $2 WHERE id = $3`,
              ['failed', msg, executionId]
            );

            return resolve({
              success: false,
              executionId,
              error: 'Failed to process results',
              message: msg,
            });
          }
        });
      } catch (err) {
        console.error('Service error:', err);

        if (executionId) {
          try {
            await db.query(
              `UPDATE bot_executions SET status = $1, error_message = $2 WHERE id = $3`,
              ['failed', truncate(err.message), executionId]
            );
          } catch (_) {}
        }

        return resolve({
          success: false,
          executionId,
          error: 'Internal error',
          message: err.message,
        });
      }
    })();
  });
};

module.exports = {
  analyzeData,
};
