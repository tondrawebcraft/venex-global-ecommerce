import mongoose from 'mongoose';

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true, index: true },
  sessionId: { type: String, unique: true, sparse: true, index: true },
  items: [{ product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, quantity: { type: Number, required: true, min: 1, max: 50 }, size: String, color: String }],
  couponCode: { type: String, trim: true, uppercase: true }
}, { timestamps: true });

export default mongoose.model('Cart', cartSchema);

