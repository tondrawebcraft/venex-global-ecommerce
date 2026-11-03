import mongoose from 'mongoose';

const contactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true },
  message: { type: String, required: true, trim: true, maxlength: 4000 },
  status: { type: String, enum: ['new', 'in-progress', 'resolved'], default: 'new' }
}, { timestamps: true });

export default mongoose.model('ContactMessage', contactMessageSchema);

