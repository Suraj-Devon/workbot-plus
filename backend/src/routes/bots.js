const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');
const dataAnalystService = require('../services/dataAnalystService');
const resumeScreenerService = require('../services/resumeScreenerService');
const db = require('../models/database');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, '../../uploads'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    // Allow CSV for data analyst, PDF/TXT for resume screener
    const allowedMimes = ['text/csv', 'application/pdf', 'text/plain'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV, PDF, and TXT allowed.'));
    }
  },
});

/**
 * POST /api/bots/data-analyst
 * Analyze CSV data
 * Body: { file: CSV file }
 * Headers: { Authorization: "Bearer <token>" }
 */
router.post('/data-analyst', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    // Validate file
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        message: 'Please upload a CSV file',
      });
    }

    // Validate CSV
    if (!req.file.originalname.endsWith('.csv')) {
      fs.unlinkSync(req.file.path); // Delete uploaded file
      return res.status(400).json({
        success: false,
        error: 'Invalid file type',
        message: 'Please upload a CSV file',
      });
    }

    const executionId = uuidv4();

    // Record bot execution in database
    await db.query(
      `INSERT INTO bot_executions (id, user_id, bot_type, file_name, file_size_bytes, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [executionId, req.user.userId, 'data_analyst', req.file.originalname, req.file.size, 'processing']
    );

    // Call data analyst service
    const result = await dataAnalystService.analyzeData(req.file.path, req.user.userId);

    if (!result.success) {
      // Update status to failed
      await db.query(
        `UPDATE bot_executions SET status = $1, error_message = $2 WHERE id = $3`,
        ['failed', result.message, executionId]
      );

      // Clean up file
      fs.unlinkSync(req.file.path);

      return res.status(500).json(result);
    }

    // Update status to completed
    await db.query(
      `UPDATE bot_executions SET status = $1, completed_at = NOW() WHERE id = $2`,
      ['completed', executionId]
    );

    // Clean up file
    fs.unlinkSync(req.file.path);

    res.status(200).json({
      success: true,
      message: 'Analysis complete',
      executionId,
      data: result.data,
    });
  } catch (error) {
    console.error('Data analyst error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * POST /api/bots/resume-screener
 * Screen resumes
 * Body: { files: [resume files], jobDescription: string }
 * Headers: { Authorization: "Bearer <token>" }
 */
router.post('/resume-screener', authenticateToken, upload.array('files', 100), async (req, res) => {
  try {
    // Validate files
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded',
        message: 'Please upload at least one resume',
      });
    }

    // Validate job description
    if (!req.body.jobDescription) {
      // Clean up files
      req.files.forEach(f => fs.unlinkSync(f.path));
      return res.status(400).json({
        success: false,
        error: 'Missing job description',
        message: 'Please provide a job description',
      });
    }

    const executionId = uuidv4();
    const uploadDir = path.dirname(req.files[0].path);

    // Record bot execution in database
    await db.query(
      `INSERT INTO bot_executions (id, user_id, bot_type, file_name, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [executionId, req.user.userId, 'resume_screener', `${req.files.length} resumes`, 'processing']
    );

    // Call resume screener service
    const result = await resumeScreenerService.screenResumes(
      uploadDir,
      req.body.jobDescription,
      req.user.userId
    );

    if (!result.success) {
      // Update status to failed
      await db.query(
        `UPDATE bot_executions SET status = $1, error_message = $2 WHERE id = $3`,
        ['failed', result.message, executionId]
      );

      // Clean up files
      req.files.forEach(f => {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });

      return res.status(500).json(result);
    }

    // Update status to completed
    await db.query(
      `UPDATE bot_executions SET status = $1, completed_at = NOW() WHERE id = $2`,
      ['completed', executionId]
    );

    // Clean up files
    req.files.forEach(f => {
      if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
    });

    res.status(200).json({
      success: true,
      message: 'Screening complete',
      executionId,
      data: result.data,
    });
  } catch (error) {
    console.error('Resume screener error:', error);
    if (req.files) {
      req.files.forEach(f => {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * GET /api/bots/history
 * Get bot execution history for current user
 * Headers: { Authorization: "Bearer <token>" }
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const history = await db.getAll(
      `SELECT id, bot_type, file_name, status, created_at, completed_at, error_message
       FROM bot_executions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.userId]
    );

    res.status(200).json({
      success: true,
      history,
    });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * GET /api/bots/result/:executionId
 * Get results for a specific execution
 * Headers: { Authorization: "Bearer <token>" }
 */
router.get('/result/:executionId', authenticateToken, async (req, res) => {
  try {
    const { executionId } = req.params;

    // Verify execution belongs to user
    const execution = await db.getOne(
      `SELECT id, user_id, status FROM bot_executions WHERE id = $1`,
      [executionId]
    );

    if (!execution) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found',
      });
    }

    if (execution.user_id !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized',
        message: 'You do not have access to this execution',
      });
    }

    // Get results
    const result = await db.getOne(
      `SELECT result_data, summary_text FROM results WHERE execution_id = $1`,
      [executionId]
    );

    if (!result && execution.status !== 'processing') {
      return res.status(404).json({
        success: false,
        error: 'Results not found',
      });
    }

    res.status(200).json({
      success: true,
      status: execution.status,
      data: result ? result.result_data : null,
      summary: result ? result.summary_text : null,
    });
  } catch (error) {
    console.error('Get result error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

module.exports = router;
