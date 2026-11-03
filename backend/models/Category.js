import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, trim: true, maxlength: 500 },
  image: { type: String, default: '' },
  order: { type: Number, default: 0 },
  featured: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Category', categorySchema);

