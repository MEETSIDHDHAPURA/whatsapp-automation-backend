import mongoose from 'mongoose';

const messageResultSchema = new mongoose.Schema({
  number: { type: String, required: true },
  status: { type: String, enum: ['sent', 'failed', 'skipped'], required: true },
  error: { type: String },
  reason: { type: String },
  timestamp: { type: Date, default: Date.now }
});

const messageHistorySchema = new mongoose.Schema(
  {
    templateName: {
      type: String,
      default: 'Custom Message'
    },
    contactListName: {
      type: String,
      default: 'Manual Entry'
    },
    totalNumbers: {
      type: Number,
      required: true
    },
    message: {
      type: String
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date
    },
    results: [messageResultSchema]
  },
  {
    timestamps: true
  }
);

export const MessageHistory = mongoose.model('MessageHistory', messageHistorySchema);
