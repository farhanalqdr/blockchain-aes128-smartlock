const express = require('express');
const CommandController = require('../controllers/commandController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/commands/encrypt-and-submit
 * @desc    Backend encrypts LOCK/UNLOCK using AES-128-GCM + RSA wrapping, then stores it
 * @access  Private
 */
router.post('/encrypt-and-submit',
  authenticateToken,
  CommandController.encryptAndSubmitCommand
);

/**
 * @route   POST /api/commands
 * @desc    Store an already-encrypted command
 * @access  Private
 */
router.post('/',
  authenticateToken,
  CommandController.submitCommand
);

/**
 * @route   GET /api/commands
 * @desc    Get all commands
 * @access  Private
 */
router.get('/',
  authenticateToken,
  CommandController.getAllCommands
);

/**
 * @route   GET /api/commands/history/:lockAddress
 * @desc    Get command history for a lock
 * @access  Private
 */
router.get('/history/:lockAddress',
  authenticateToken,
  CommandController.getCommandHistoryByLock
);

/**
 * @route   GET /api/commands/pending/:lockAddress
 * @desc    Get pending encrypted commands for a lock listener / Raspberry
 * @access  Public temporarily (for easier testing)
 */
router.get('/pending/:lockAddress',
  CommandController.getPendingCommandsByLock
);

/**
 * @route   POST /api/commands/:commandId/execution
 * @desc    Report execution result from smartlock listener
 * @access  Public temporarily (for easier testing)
 */
router.post('/:commandId/execution',
  CommandController.reportExecution
);

/**
 * @route   GET /api/commands/:commandId
 * @desc    Get command by ID
 * @access  Private
 */
router.get('/:commandId',
  authenticateToken,
  CommandController.getCommandById
);

module.exports = router;