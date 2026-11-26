
const mongoose = require('mongoose');
const Election = require('../models/election.model');

class ElectionService {
  async createElection(electionData, userId) {
    const { title, description, imageUrl, startAt, endAt } =
      electionData;

    const startDate = new Date(startAt);
    const endDate = new Date(endAt);

    if (
      !startAt ||
      !endAt ||
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ) {
      throw new Error('Valid election start and end dates are required.');
    }

    if (endDate <= startDate) {
      throw new Error('Election end date must be after start date.');
    }

    const now = new Date();

    const status =
      now < startDate
        ? 'UPCOMING'
        : now < endDate
          ? 'ONGOING'
          : 'COMPLETED';

    const election = await Election.create({
      title,
      description,
      imageUrl,
      startAt: startDate,
      endAt: endDate,
      status,
      createdBy: userId,
    });

    return election;
  }

  async getAllElections() {
    const now = new Date();

    // Update statuses before returning elections.
    await Election.updateMany(
      { isActive: true, endAt: { $lte: now } },
      { $set: { status: 'COMPLETED' } }
    );

    await Election.updateMany(
      {
        isActive: true,
        startAt: { $lte: now },
        endAt: { $gt: now },
      },
      { $set: { status: 'ONGOING' } }
    );

    await Election.updateMany(
      { isActive: true, startAt: { $gt: now } },
      { $set: { status: 'UPCOMING' } }
    );

    return Election.find({ isActive: true })
      .populate('createdBy', 'name email')
      .sort({ startAt: 1 });
  }

  async getElectionById(electionId) {
    if (!mongoose.Types.ObjectId.isValid(electionId)) {
      throw new Error('Invalid election ID.');
    }

    const now = new Date();

    const election = await Election.findOneAndUpdate(
      { _id: electionId, isActive: true },
      [
        {
          $set: {
            status: {
              $switch: {
                branches: [
                  {
                    case: { $gt: ['$startAt', now] },
                    then: 'UPCOMING',
                  },
                  {
                    case: { $lte: ['$endAt', now] },
                    then: 'COMPLETED',
                  },
                ],
                default: 'ONGOING',
              },
            },
          },
        },
      ],
      { new: true }
    ).populate('createdBy', 'name email');

    if (!election) {
      throw new Error('Election not found.');
    }

    return election;
  }

  async updateElection(electionId, updateData) {
    if (!mongoose.Types.ObjectId.isValid(electionId)) {
      throw new Error('Invalid election ID.');
    }

    const allowedFields = [
      'title',
      'description',
      'imageUrl',
      'startAt',
      'endAt',
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    }

    if (updates.startAt || updates.endAt) {
      const existingElection = await Election.findOne({
        _id: electionId,
        isActive: true,
      });

      if (!existingElection) {
        throw new Error('Election not found.');
      }

      const startAt = new Date(
        updates.startAt ?? existingElection.startAt
      );

      const endAt = new Date(
        updates.endAt ?? existingElection.endAt
      );

      if (
        Number.isNaN(startAt.getTime()) ||
        Number.isNaN(endAt.getTime()) ||
        endAt <= startAt
      ) {
        throw new Error('Invalid election dates.');
      }

      updates.startAt = startAt;
      updates.endAt = endAt;

      const now = new Date();

      updates.status =
        now < startAt
          ? 'UPCOMING'
          : now < endAt
            ? 'ONGOING'
            : 'COMPLETED';
    }

    const election = await Election.findOneAndUpdate(
      { _id: electionId, isActive: true },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!election) {
      throw new Error('Election not found.');
    }

    return election;
  }

  async deleteElection(electionId) {
    if (!mongoose.Types.ObjectId.isValid(electionId)) {
      throw new Error('Invalid election ID.');
    }

    const election = await Election.findOneAndUpdate(
      { _id: electionId, isActive: true },
      { $set: { isActive: false } },
      { new: true }
    );

    if (!election) {
      throw new Error('Election not found.');
    }

    return election;
  }
}

module.exports = new ElectionService();
