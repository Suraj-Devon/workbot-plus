const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');
const dataAnalystService = require('../services/dataAnalystService');
const resumeScreenerService = require('../services/resumeScreenerService');
const db = require('../models/database');
const { botsLimiter } = require('../middleware/rateLimit');

const router = express.Router();
router.use(botsLimiter);

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Multer: Data Analyst uploads (CSV/JSON/JSONL/NDJSON)
 * Keep limit aligned with frontend demo (10MB).
 */
const uploadDataAnalyst = multer({
  dest: uploadsDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const fileName = (file.originalname || '').toLowerCase();

    const extOk =
      fileName.endsWith('.csv') ||
      fileName.endsWith('.json') ||
      fileName.endsWith('.jsonl') ||
      fileName.endsWith('.ndjson');

    if (!extOk) {
      cb(new Error('Invalid file type. Only CSV, JSON, JSONL/NDJSON allowed.'));
      return;
    }

    // MIME is unreliable; extension is primary
    cb(null, true);
  },
});

/**
 * Multer: Resume Screener uploads (PDF/TXT/DOCX)
 * Keep your original 50MB setting here.
 */
const uploadResumeScreener = multer({
  dest: uploadsDir,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const fileName = (file.originalname || '').toLowerCase();

    const extOk =
      fileName.endsWith('.pdf') ||
      fileName.endsWith('.txt') ||
      fileName.endsWith('.docx');

    if (!extOk) {
      cb(new Error('Invalid file type. Only PDF, TXT, and DOCX allowed.'));
      return;
    }

    const allowedMimes = [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream',
      '',
    ];

    if (!allowedMimes.includes(file.mimetype)) {
      console.warn(`Unusual MIME type for ${file.originalname}: ${file.mimetype}, but extension OK`);
    }

    cb(null, true);
  },
});

/**
 * POST /api/bots/data-analyst
 * Analyze CSV/JSON/JSONL data
 */
router.post(
  '/data-analyst',
  authenticateToken,
  uploadDataAnalyst.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
          message: 'Please upload a CSV, JSON, or JSONL file',
        });
      }

      const original = (req.file.originalname || '').toLowerCase();
      const extOk =
        original.endsWith('.csv') ||
        original.endsWith('.json') ||
        original.endsWith('.jsonl') ||
        original.endsWith('.ndjson');

      if (!extOk) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: 'Invalid file type',
          message: 'Please upload a CSV, JSON, or JSONL file',
        });
      }

      const executionId = uuidv4();

      await db.query(
        `INSERT INTO bot_executions (id, user_id, bot_type, file_name, file_size_bytes, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          executionId,
          req.user.userId,
          'data_analyst',
          req.file.originalname,
          req.file.size,
          'processing',
        ]
      );

      const result = await dataAnalystService.analyzeData(
        req.file.path,
        req.user.userId,
        executionId
      );

      // cleanup upload
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      if (!result.success) {
        return res.status(500).json(result);
      }

      return res.status(200).json({
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

      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/bots/resume-screener
 * Screen resumes (increased to 300 files)
 */
router.post(
  '/resume-screener',
  authenticateToken,
  uploadResumeScreener.array('files', 300),
  async (req, res) => {
    try {
      console.log('Resume screener request:', {
        fileCount: req.files?.length || 0,
        hasJobDesc: !!req.body.jobDescription,
        userId: req.user.userId,
      });

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded',
          message: 'Please upload at least one resume (PDF/TXT/DOCX)',
        });
      }

      if (!req.body.jobDescription || req.body.jobDescription.trim().length < 10) {
        req.files.forEach((f) => {
          if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
        });
        return res.status(400).json({
          success: false,
          error: 'Missing job description',
          message: 'Please provide a job description (min 10 characters)',
        });
      }

      const executionId = uuidv4();
      const baseDir = uploadsDir;
      const uploadDir = path.join(baseDir, executionId);

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const movedFiles = [];
      for (const f of req.files) {
        const safeName = f.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const newPath = path.join(uploadDir, safeName);

        fs.renameSync(f.path, newPath);
        movedFiles.push(safeName);
      }

      console.log(`Moved ${movedFiles.length} files to ${uploadDir}:`, movedFiles);

      await db.query(
        `INSERT INTO bot_executions (id, user_id, bot_type, file_name, status, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [executionId, req.user.userId, 'resume_screener', `${movedFiles.length} resumes`, 'processing']
      );

      const result = await resumeScreenerService.screenResumes(
        uploadDir,
        req.body.jobDescription,
        req.user.userId
      );

      if (!result.success) {
        console.error('Service failed:', result);
        await db.query(
          `UPDATE bot_executions SET status = $1, error_message = $2 WHERE id = $3`,
          ['failed', result.error || result.message || 'Service error', executionId]
        );
        return res.status(500).json({
          success: false,
          message: result.error || result.message || 'Screening failed',
          data: result,
        });
      }

      await db.query(
        `UPDATE bot_executions SET status = $1, completed_at = NOW() WHERE id = $2`,
        ['completed', executionId]
      );

      setTimeout(() => {
        try {
          if (fs.existsSync(uploadDir)) {
            fs.rmSync(uploadDir, { recursive: true, force: true });
          }
        } catch (e) {
          console.log('Cleanup failed:', e.message);
        }
      }, 3600000);

      console.log('Resume screening success:', {
        total: result.data?.total_resumes,
        strong: result.data?.strong_candidates,
      });

      return res.status(200).json({
        success: true,
        message: 'Screening complete',
        executionId,
        data: result.data,
      });
    } catch (error) {
      console.error('Resume screener CRASH:', error);

      if (req.files) {
        req.files.forEach((f) => {
          if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/bots/history
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

    return res.status(200).json({ success: true, history });
  } catch (error) {
    console.error('History error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * GET /api/bots/result/:executionId
 */
router.get('/result/:executionId', authenticateToken, async (req, res) => {
  try {
    const { executionId } = req.params;

    const execution = await db.getOne(
      `SELECT id, user_id, status FROM bot_executions WHERE id = $1`,
      [executionId]
    );

    if (!execution) {
      return res.status(404).json({ success: false, error: 'Execution not found' });
    }

    if (execution.user_id !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized',
        message: 'You do not have access to this execution',
      });
    }

    const result = await db.getOne(
      `SELECT result_data, summary_text FROM results WHERE execution_id = $1`,
      [executionId]
    );

    if (!result && execution.status !== 'processing') {
      return res.status(404).json({ success: false, error: 'Results not found' });
    }

    return res.status(200).json({
      success: true,
      status: execution.status,
      data: result ? result.result_data : null,
      summary: result ? result.summary_text : null,
    });
  } catch (error) {
    console.error('Get result error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

module.exports = router;
