import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  provider: { type: String, enum: ['cod', 'bkash', 'nagad', 'sslcommerz'], required: true },
  transactionId: { type: String, sparse: true, unique: true },
  amount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['initiated', 'pending', 'paid', 'failed', 'refunded'], default: 'initiated' },
  providerReference: String,
  verifiedAt: Date,
  metadata: { type: mongoose.Schema.Types.Mixed, select: false }
}, { timestamps: true });

export default mongoose.model('Payment', paymentSchema);

