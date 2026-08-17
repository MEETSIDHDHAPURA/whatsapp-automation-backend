import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true
    },
    content: {
      type: String,
      required: [true, 'Template content is required'],
      trim: true
    },
    variables: [
      {
        type: String,
        trim: true
      }
    ]
  },
  {
    timestamps: true
  }
);

// Auto-extract {{variable}} placeholders before saving
templateSchema.pre('save', function (next) {
  const variables = [];
  const regex = /\{\{(\w+)\}\}/g;
  let match;
  while ((match = regex.exec(this.content)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  this.variables = variables;
  next();
});

export const Template = mongoose.model('Template', templateSchema);
