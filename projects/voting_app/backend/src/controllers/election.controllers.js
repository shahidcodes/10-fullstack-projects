
const electionService = require('../service/election.service');

class ElectionController {
  async createElection(req, res) {
    try {
      const election = await electionService.createElection(
        req.body,
        req.user.id
      );

      return res.status(201).json({
        success: true,
        message: 'Election created successfully.',
        data: { election },
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getAllElections(req, res) {
    try {
      const elections = await electionService.getAllElections();

      return res.status(200).json({
        success: true,
        message: 'Elections retrieved successfully.',
        data: { elections },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getElectionById(req, res) {
    try {
      const election = await electionService.getElectionById(
        req.params.id
      );

      return res.status(200).json({
        success: true,
        message: 'Election retrieved successfully.',
        data: { election },
      });
    } catch (error) {
      const statusCode =
        error.message === 'Invalid election ID.' ? 400 : 404;

      return res.status(statusCode).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateElection(req, res) {
    try {
      const election = await electionService.updateElection(
        req.params.id,
        req.body
      );

      return res.status(200).json({
        success: true,
        message: 'Election updated successfully.',
        data: { election },
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async deleteElection(req, res) {
    try {
      await electionService.deleteElection(req.params.id);

      return res.status(200).json({
        success: true,
        message: 'Election deleted successfully.',
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = new ElectionController();
