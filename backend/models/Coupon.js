import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, enum: ['percentage', 'fixed'], required: true },
  value: { type: Number, required: true, min: 0 },
  minimumSpend: { type: Number, default: 0, min: 0 },
  maxDiscount: { type: Number, min: 0 },
  usageLimit: { type: Number, min: 1 },
  usedCount: { type: Number, default: 0, min: 0 },
  expiresAt: Date,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Coupon', couponSchema);

