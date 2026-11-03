import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  rating: { type: Number, min: 1, max: 5, required: true },
  title: { type: String, trim: true, maxlength: 120 },
  body: { type: String, trim: true, maxlength: 2000 },
  isApproved: { type: Boolean, default: false }
}, { timestamps: true });
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

export default mongoose.model('Review', reviewSchema);

