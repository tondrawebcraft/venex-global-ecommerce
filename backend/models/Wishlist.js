import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true, index: true },
  sessionId: { type: String, unique: true, sparse: true, index: true },
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
}, { timestamps: true });

export default mongoose.model('Wishlist', wishlistSchema);

