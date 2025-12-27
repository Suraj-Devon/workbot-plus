const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/database');

/**
 * Call Python Data Analyst Bot
 * @param {string} filePath - Path to CSV file
 * @param {string} userId - User ID
 * @returns {Promise<object>} Analysis results
 */
const analyzeData = async (filePath, userId) => {
  return new Promise((resolve) => {
    try {
      // Path to Python script
      const pythonScript = path.join(
        __dirname,
        '../../ai_workers/data_analyst_bot.py'
      );

      // Create an execution record first (required by FK on results.execution_id)
      db.query(
        `INSERT INTO bot_executions (id, user_id, bot_type, status, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id`,
        [uuidv4(), userId || null, 'data-analyst', 'running']
      )
        .then(({ rows }) => {
          const executionId = rows[0].id;

          // Run Python script: python data_analyst_bot.py <filePath> <executionId>
          const command = `python "${pythonScript}" "${filePath}" "${executionId}"`;

          exec(command, { timeout: 60000 }, async (error, stdout, stderr) => {
            try {
              if (error) {
                console.error('Python error:', stderr || error.message);

                // Mark execution as failed
                await db.query(
                  `UPDATE bot_executions
                     SET status = $2
                   WHERE id = $1`,
                  [executionId, 'failed']
                );

                return resolve({
                  success: false,
                  error: 'Analysis failed',
                  message: stderr || error.message,
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

              // Parse Python output
              const result = JSON.parse(stdout);

              // Save to results table
              await db.query(
                `INSERT INTO results (id, execution_id, result_data, summary_text, created_at)
                 VALUES ($1, $2, $3, $4, NOW())`,
                [
                  uuidv4(),
                  executionId,
                  result,
                  result.summary || 'Analysis complete',
                ]
              );

              // Mark execution as completed
              await db.query(
                `UPDATE bot_executions
                   SET status = $2
                 WHERE id = $1`,
                [executionId, 'completed']
              );

              resolve({
                success: true,
                executionId,
                data: result,
              });
            } catch (err) {
              console.error('Parse error:', err);

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
          });
        })
        .catch((error) => {
          console.error('Analysis error (create execution):', error);
          resolve({
            success: false,
            error: 'Internal error',
            message: error.message,
          });
        });
    } catch (error) {
      console.error('Analysis error:', error);
      resolve({
        success: false,
        error: 'Internal error',
        message: error.message,
      });
    }
  });
};

module.exports = {
  analyzeData,
};
