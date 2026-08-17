import mongoose from 'mongoose';

const contactListSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Contact list name is required'],
      trim: true
    },
    numbers: [
      {
        type: String,
        required: true,
        trim: true
      }
    ]
  },
  {
    timestamps: true
  }
);

// Pre-save hook to clean phone numbers
contactListSchema.pre('save', function (next) {
  if (this.numbers && Array.isArray(this.numbers)) {
    this.numbers = this.numbers
      .map(n => n.toString().replace(/[\s\-\(\)\+]/g, ''))
      .filter(n => n.length >= 7);
  }
  next();
});

export const ContactList = mongoose.model('ContactList', contactListSchema);
