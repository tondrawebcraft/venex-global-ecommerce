import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  label: { type: String, default: 'Home', maxlength: 40 },
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  line1: { type: String, required: true, trim: true, maxlength: 200 },
  line2: { type: String, trim: true, maxlength: 200 },
  city: { type: String, required: true, trim: true, maxlength: 80 },
  district: { type: String, required: true, trim: true, maxlength: 80 },
  postalCode: { type: String, trim: true, maxlength: 20 },
  isDefault: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('Address', addressSchema);

