const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/database');

const PYTHON_BIN = process.env.PYTHON_BIN || 'python';
const TIMEOUT_MS = Number(process.env.DATA_ANALYST_TIMEOUT_MS || 60000);

// Important for JSON-heavy stdout; otherwise can throw "maxBuffer exceeded". [web:223]
const MAX_BUFFER_BYTES = Number(process.env.DATA_ANALYST_MAX_BUFFER || 10 * 1024 * 1024); // 10MB

// Server-side guard (never trust the client limit)
const MAX_FILE_BYTES = Number(process.env.DATA_ANALYST_MAX_FILE_BYTES || 10 * 1024 * 1024);

function safeParsePythonJson(stdout) {
  const text = (stdout || '').toString().trim();
  if (!text) return null;

  // Most common: clean JSON only
  try {
    return JSON.parse(text);
  } catch (_) {
    // Defensive: if any logs slip in, attempt to extract the JSON object
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) {
      return JSON.parse(text.slice(first, last + 1));
    }
    throw new Error('Python output was not valid JSON');
  }
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
          // Not fatal
          console.warn('File stat warning:', e?.message);
        }

        const pythonScript = path.join(__dirname, '../../ai_workers/data_analyst_bot.py');

        // Mark as running (optional but helpful)
        await db.query(
          `UPDATE bot_executions SET status = $1 WHERE id = $2`,
          ['running', executionId]
        );

        // Use execFile with args array (avoid shell string). [web:228][web:233]
        const args = [pythonScript, filePath, executionId];

        execFile(
          PYTHON_BIN,
          args,
          { timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER_BYTES, windowsHide: true },
          async (error, stdout, stderr) => {
            try {
              if (error) {
                const msg = (stderr || error.message || 'Python execution error').toString();

                await db.query(
                  `UPDATE bot_executions SET status = $1, error_message = $2 WHERE id = $3`,
                  ['failed', msg.slice(0, 2000), executionId]
                );

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

              // Store results (even if Python success=false; helps debugging + history)
              await db.query(
                `INSERT INTO results (id, execution_id, result_data, summary_text, created_at)
                 VALUES ($1, $2, $3, $4, NOW())`,
                [uuidv4(), executionId, result, result.summary || 'Analysis complete']
              );

              const status = result.success === false ? 'failed' : 'completed';
              await db.query(
                `UPDATE bot_executions SET status = $1, completed_at = NOW(), error_message = NULL WHERE id = $2`,
                [status, executionId]
              );

              return resolve({
                success: status === 'completed',
                executionId,
                data: result,
              });
            } catch (err) {
              console.error('Result handling error:', err);

              await db.query(
                `UPDATE bot_executions SET status = $1, error_message = $2 WHERE id = $3`,
                ['failed', err.message.slice(0, 2000), executionId]
              );

              return resolve({
                success: false,
                executionId,
                error: 'Failed to process results',
                message: err.message,
              });
            }
          }
        );
      } catch (err) {
        console.error('Service error:', err);

        if (executionId) {
          try {
            await db.query(
              `UPDATE bot_executions SET status = $1, error_message = $2 WHERE id = $3`,
              ['failed', err.message.slice(0, 2000), executionId]
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
