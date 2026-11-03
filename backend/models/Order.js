import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String, slug: String, image: String, sku: String,
    quantity: { type: Number, min: 1 }, unitPrice: { type: Number, min: 0 },
    size: String, color: String
  }],
  shippingAddress: { fullName: String, email: String, phone: String, line1: String, line2: String, city: String, district: String, postalCode: String },
  subtotal: { type: Number, required: true, min: 0 },
  shipping: { type: Number, required: true, min: 0, default: 0 },
  discount: { type: Number, min: 0, default: 0 },
  total: { type: Number, required: true, min: 0 },
  couponCode: String,
  paymentMethod: { type: String, enum: ['cod', 'bkash', 'nagad', 'sslcommerz'], required: true },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  status: { type: String, enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'], default: 'pending', index: true },
  trackingNumber: String,
  statusHistory: [{ status: String, note: String, at: { type: Date, default: Date.now } }]
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);

