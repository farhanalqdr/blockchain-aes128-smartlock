const express = require('express');
const LockController = require('../controllers/lockController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/locks
 * @desc    Register lock in backend DB
 * @access  Private
 */
router.post('/',
  authenticateToken,
  LockController.registerLock
);

/**
 * @route   GET /api/locks
 * @desc    Get all locks
 * @access  Private
 */
router.get('/',
  authenticateToken,
  LockController.getLocks
);

/**
 * @route   GET /api/locks/address/:walletAddress
 * @desc    Get lock by wallet address
 * @access  Private
 */
router.get('/address/:walletAddress',
  authenticateToken,
  LockController.getLockByAddress
);

/**
 * @route   GET /api/locks/public-key/:walletAddress
 * @desc    Get approved lock public key for encryption
 * @access  Private
 */
router.get('/public-key/:walletAddress',
  authenticateToken,
  LockController.getLockPublicKey
);

/**
 * @route   POST /api/locks/approve/:walletAddress
 * @desc    Approve lock in backend DB
 * @access  Private
 */
router.post('/approve/:walletAddress',
  authenticateToken,
  LockController.approveLock
);

/**
 * @route   POST /api/locks/reject/:walletAddress
 * @desc    Reject lock in backend DB
 * @access  Private
 */
router.post('/reject/:walletAddress',
  authenticateToken,
  LockController.rejectLock
);

/**
 * @route   POST /api/locks/heartbeat/:walletAddress
 * @desc    Heartbeat from lock listener / Raspberry
 * @access  Public temporarily for easy testing
 */
router.post('/heartbeat/:walletAddress',
  LockController.heartbeat
);

/**
 * @route   GET /api/locks/:lockId
 * @desc    Get lock by MongoDB ID
 * @access  Private
 */
router.get('/:lockId',
  authenticateToken,
  LockController.getLockById
);

module.exports = router;