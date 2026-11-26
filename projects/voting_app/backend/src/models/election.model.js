
const mongoose = require('mongoose');

const electionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Election title is required'],
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      required: [true, 'Election description is required'],
      trim: true,
      maxlength: 2000,
    },

    imageUrl: {
      type: String,
      default: null,
    },

    startAt: {
      type: Date,
      required: [true, 'Election start date is required'],
    },

    endAt: {
      type: Date,
      required: [true, 'Election end date is required'],
    },

    status: {
      type: String,
      enum: ['UPCOMING', 'ONGOING', 'COMPLETED'],
      default: 'UPCOMING',
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Ensure the end date is after the start date.
electionSchema.pre('validate', function (next) {
  if (this.startAt && this.endAt && this.endAt <= this.startAt) {
    this.invalidate('endAt', 'End date must be after start date.');
  }

  next();
});

electionSchema.index({ startAt: 1, endAt: 1 });
electionSchema.index({ isActive: 1, status: 1 });

module.exports = mongoose.model('Election', electionSchema);
