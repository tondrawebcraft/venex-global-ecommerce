import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({ value: { type: String, trim: true }, stock: { type: Number, min: 0, default: 0 } }, { _id: false });
const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 180 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, required: true, maxlength: 6000 },
  shortDescription: { type: String, maxlength: 300 },
  images: [{ type: String }],
  price: { type: Number, required: true, min: 0 },
  compareAtPrice: { type: Number, min: 0 },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
  stock: { type: Number, required: true, min: 0, default: 0 },
  sizes: [variantSchema],
  colors: [variantSchema],
  featured: { type: Boolean, default: false, index: true },
  newArrival: { type: Boolean, default: false, index: true },
  bestSeller: { type: Boolean, default: false, index: true },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  reviewCount: { type: Number, min: 0, default: 0 },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true });
productSchema.index({ name: 'text', description: 'text', sku: 'text' });

export default mongoose.model('Product', productSchema);

