
const express = require('express');
const router = express.Router();

const authenticate = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');

const electionController = require('../controllers/election.controller');

router.use(authenticate);

// Read operations: any authenticated user
router.get('/', electionController.getAllElections);
router.get('/:id', electionController.getElectionById);

// Write operations: ADMIN only
router.post(
  '/',
  authorize('ADMIN'),
  electionController.createElection
);

router.patch(
  '/:id',
  authorize('ADMIN'),
  electionController.updateElection
);

router.delete(
  '/:id',
  authorize('ADMIN'),
  electionController.deleteElection
);

module.exports = router;
