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
      // Generate execution ID
      const executionId = uuidv4();

      // Path to Python script
      const pythonScript = path.join(__dirname, '../../ai_workers/resume_screener_bot.py');

      // Escape quotes in job description for shell
      const escapedJobDesc = jobDescription.replace(/"/g, '\\"');

      // Run Python script
      const command = `python "${pythonScript}" "${filesPath}" "${escapedJobDesc}" "${executionId}"`;

      exec(command, { timeout: 120000 }, async (error, stdout, stderr) => {
        try {
          if (error) {
            console.error('Python error:', stderr);
            return resolve({
              success: false,
              error: 'Screening failed',
              message: stderr || error.message,
            });
          }

          // Parse Python output
          const result = JSON.parse(stdout);

          // Save to database
          await db.query(
            `INSERT INTO results (id, execution_id, result_data, summary_text, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [uuidv4(), executionId, result, result.summary || 'Screening complete']
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
      console.error('Screening error:', error);
      resolve({
        success: false,
        error: 'Internal error',
        message: error.message,
      });
    }
  });
};

module.exports = {
  screenResumes,
};
