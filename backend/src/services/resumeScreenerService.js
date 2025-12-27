const { exec } = require('child_process');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/database');

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
      const pythonScript = path.join(
        __dirname,
        '../../ai_workers/resume_screener_bot.py'
      );

      // Ensure temp dir exists (if you still use it elsewhere)
      const tempDir = path.join(__dirname, '../../temp');
      if (!require('fs').existsSync(tempDir)) {
        require('fs').mkdirSync(tempDir, { recursive: true });
      }

      // Escape quotes in job description for shell
      const escapedJobDesc = jobDescription
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'");

      // Create an execution row first
      db.query(
        `INSERT INTO bot_executions (id, user_id, bot_type, status, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id`,
        [uuidv4(), userId || null, 'resume-screener', 'running']
      )
        .then(({ rows }) => {
          const executionId = rows[0].id;

          // Match Python script args exactly: upload_dir, job_description, execution_id
          const command = `python "${pythonScript}" "${filesPath}" "${escapedJobDesc}" "${executionId}"`;

          console.log('Executing:', command);

          exec(
            command,
            { timeout: 120000, cwd: path.dirname(pythonScript) },
            async (error, stdout, stderr) => {
              try {
                if (error) {
                  console.error('Python error:', error.message);
                  console.error('Stderr:', stderr);

                  await db.query(
                    `UPDATE bot_executions
                       SET status = $2, updated_at = NOW()
                     WHERE id = $1`,
                    [executionId, 'failed']
                  );

                  return resolve({
                    success: false,
                    error: 'Screening failed',
                    message: stderr || error.message,
                  });
                }

                if (!stdout) {
                  await db.query(
                    `UPDATE bot_executions
                       SET status = $2, updated_at = NOW()
                     WHERE id = $1`,
                    [executionId, 'failed']
                  );

                  return resolve({
                    success: false,
                    error: 'No output',
                    message: 'Python script returned empty output',
                  });
                }

                // Parse Python output
                let result;
                try {
                  result = JSON.parse(stdout.trim());
                } catch (parseErr) {
                  console.error('Parse error:', parseErr, 'Raw output:', stdout);

                  await db.query(
                    `UPDATE bot_executions
                       SET status = $2, updated_at = NOW()
                     WHERE id = $1`,
                    [executionId, 'failed']
                  );

                  return resolve({
                    success: false,
                    error: 'Invalid output format',
                    message: 'Python script returned invalid JSON',
                  });
                }

                // Save to results table
                await db.query(
                  `INSERT INTO results (id, execution_id, result_data, summary_text, created_at)
                   VALUES ($1, $2, $3, $4, NOW())`,
                  [
                    uuidv4(),
                    executionId,
                    result,
                    result.summary || 'Screening complete',
                  ]
                );

                await db.query(
                  `UPDATE bot_executions
                     SET status = $2, updated_at = NOW()
                   WHERE id = $1`,
                  [executionId, 'completed']
                );

                console.log('Screening success:', result);
                resolve({
                  success: true,
                  executionId,
                  data: result,
                });
              } catch (err) {
                console.error('Service error:', err);

                await db.query(
                  `UPDATE bot_executions
                     SET status = $2, updated_at = NOW()
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
          resolve({
            success: false,
            error: 'Internal error',
            message: error.message,
          });
        });
    } catch (error) {
      console.error('Screening error:', error);
      resolve({
        success: false,
        error: 'Internal error',
        message: error.message,
      });
    }
  });
};

module.exports = { screenResumes };
