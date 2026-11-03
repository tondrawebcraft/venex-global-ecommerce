import mongoose from 'mongoose';

const siteContentSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true },
  content: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

export default mongoose.model('SiteContent', siteContentSchema);

