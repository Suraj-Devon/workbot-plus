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
      // Generate execution ID
      const executionId = uuidv4();

      // Path to Python script
      const pythonScript = path.join(__dirname, '../../ai_workers/data_analyst_bot.py');

      // Run Python script
      const command = `python "${pythonScript}" "${filePath}" "${executionId}"`;

      exec(command, { timeout: 60000 }, async (error, stdout, stderr) => {
        try {
          if (error) {
            console.error('Python error:', stderr);
            return resolve({
              success: false,
              error: 'Analysis failed',
              message: stderr || error.message,
            });
          }

          // Parse Python output
          const result = JSON.parse(stdout);

          // Save to database
          await db.query(
            `INSERT INTO results (id, execution_id, result_data, summary_text, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [uuidv4(), executionId, result, result.summary || 'Analysis complete']
          );

          resolve({
            success: true,
            executionId,
            data: result,
          });
        } catch (err) {
          console.error('Parse error:', err);
          resolve({
            success: false,
            error: 'Failed to process results',
            message: err.message,
          });
        }
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
