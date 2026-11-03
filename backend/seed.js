import dotenv from 'dotenv';
dotenv.config({ path: process.env.ENV_FILE || '../.env' });
import mongoose from 'mongoose';
import { connectDatabase } from './config/db.js';
import User from './models/User.js';
import Category from './models/Category.js';
import Product from './models/Product.js';
import Coupon from './models/Coupon.js';

const categories = [
  { name: 'Everyday bags', slug: 'bags', description: 'Carry less, live more.', image: '/images/weekender.jpg', order: 1, featured: true },
  { name: 'Objects & tech', slug: 'objects-tech', description: 'Good design for daily rituals.', image: '/images/headphones-alt.jpg', order: 2, featured: true },
  { name: 'Personal care', slug: 'personal-care', description: 'A softer start and finish to every day.', image: '/images/care-alt.jpg', order: 3, featured: true },
  { name: 'Wardrobe', slug: 'wardrobe', description: 'Quiet staples, made to move.', image: '/images/hero-v2.jpg', order: 4, featured: true }
];
const products = [
  { name: 'The Everyday Pack', slug: 'everyday-pack', sku: 'VX-BAG-001', category: 'bags', price: 2950, compareAtPrice: 3400, stock: 24, featured: true, bestSeller: true, shortDescription: 'A considered carryall for everything between here and there.', description: 'A softly structured everyday pack with a roomy lined interior, reinforced straps and a discreet front pocket. Designed for daily commutes and a little more.', images: ['/images/weekender.jpg'], colors: [{ value: 'Sand', stock: 12 }, { value: 'Olive', stock: 12 }] },
  { name: 'Arc Studio Headphones', slug: 'arc-studio-headphones', sku: 'VX-TECH-004', category: 'objects-tech', price: 6850, stock: 12, featured: true, newArrival: true, shortDescription: 'Immersive sound, considered form.', description: 'Wireless over-ear listening with balanced sound, soft memory foam cushions and all-day comfort. Up to 32 hours of listening and a compact fold for travel.', images: ['/images/headphones-alt.jpg'], colors: [{ value: 'Onyx', stock: 8 }, { value: 'Stone', stock: 4 }] },
  { name: 'Forma Crossbody', slug: 'forma-crossbody', sku: 'VX-BAG-007', category: 'bags', price: 4250, compareAtPrice: 4900, stock: 9, featured: true, newArrival: true, shortDescription: 'A hands-free silhouette with room for what matters.', description: 'A clean, compact crossbody with a softly padded strap, secure magnetic closure and two thoughtful compartments. Made for moving through the city.', images: ['/images/hero-v2.jpg'], colors: [{ value: 'Espresso', stock: 5 }, { value: 'Black', stock: 4 }] },
  { name: 'Morning Ritual Set', slug: 'morning-ritual-set', sku: 'VX-CARE-003', category: 'personal-care', price: 3250, stock: 18, bestSeller: true, shortDescription: 'Three small things for a slower morning.', description: 'A curated three-piece set of daily care essentials. Gentle textures and quietly uplifting scent make space for a more intentional start.', images: ['/images/care-alt.jpg'] },
  { name: 'Field Notes Jacket', slug: 'field-notes-jacket', sku: 'VX-WARD-012', category: 'wardrobe', price: 7950, stock: 6, newArrival: true, shortDescription: 'A light layer for the in-between.', description: 'A relaxed, utility-inspired jacket in washed cotton twill. Finished with a clean collar, hidden snap fastening and considered pockets.', images: ['/images/hero-v2.jpg'], sizes: [{ value: 'S', stock: 1 }, { value: 'M', stock: 2 }, { value: 'L', stock: 3 }], colors: [{ value: 'Moss', stock: 6 }] },
  { name: 'Solis Botanical Oil', slug: 'solis-botanical-oil', sku: 'VX-CARE-008', category: 'personal-care', price: 4800, stock: 15, featured: true, shortDescription: 'A quiet little moment in your daily routine.', description: 'A lightweight botanical oil with a soft, comforting texture. Made for a slower evening routine and a few minutes of care.', images: ['/images/care-alt.jpg'] },
  { name: 'Orbit Travel Backpack', slug: 'orbit-travel-backpack', sku: 'VX-BAG-010', category: 'bags', price: 8900, stock: 7, bestSeller: true, shortDescription: 'Pack a little lighter. Go a little further.', description: 'A generous travel backpack with a structured base, padded laptop sleeve, trolley pass-through and a removable shoulder strap. Ready for a couple of days away.', images: ['/images/weekender.jpg'] },
  { name: 'Everyday Boots', slug: 'everyday-boots', sku: 'VX-WARD-018', category: 'wardrobe', price: 6200, stock: 14, newArrival: true, shortDescription: 'Light on your feet. Easy on the eyes.', description: 'A clean, versatile boot with a cushioned footbed and flexible sole. Easy to dress up for a long day or wear out on an ordinary one.', images: ['/images/hero-v2.jpg'], sizes: [{ value: '39', stock: 2 }, { value: '40', stock: 4 }, { value: '41', stock: 4 }, { value: '42', stock: 4 }] },
  { name: 'Stillwater Glass Bottle', slug: 'stillwater-glass-bottle', sku: 'VX-OBJ-021', category: 'objects-tech', price: 1250, stock: 32, shortDescription: 'A gentle reminder to take a moment.', description: 'A double-wall borosilicate glass bottle wrapped in a protective silicone sleeve. Keeps your daily water close without adding visual noise.', images: ['/images/bottle.jpg'] }
];

try {
  await connectDatabase();
  const categoryMap = new Map();
  for (const entry of categories) categoryMap.set(entry.slug, await Category.findOneAndUpdate({ slug: entry.slug }, { $set: entry }, { upsert: true, new: true, setDefaultsOnInsert: true }));
  for (const entry of products) {
    const { category, ...fields } = entry;
    await Product.findOneAndUpdate({ sku: fields.sku }, { $set: { ...fields, category: categoryMap.get(category)._id } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@venex.global').toLowerCase();
  const existing = await User.findOne({ email: adminEmail }).select('+password');
  if (!existing) {
    if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) throw new Error('Set ADMIN_PASSWORD to at least 12 characters before seeding the first admin.');
    await User.create({ name: process.env.ADMIN_NAME || 'VENEX Administrator', email: adminEmail, password: process.env.ADMIN_PASSWORD, role: 'admin' });
  }
  else if (existing.role !== 'admin') throw new Error('The configured admin email already belongs to a customer. Choose a new ADMIN_EMAIL before seeding.');
  await Coupon.findOneAndUpdate({ code: 'WELCOME10' }, { $setOnInsert: { code: 'WELCOME10', type: 'percentage', value: 10, minimumSpend: 1500, maxDiscount: 1000, usageLimit: 500, expiresAt: new Date(Date.now() + 365 * 86400000), isActive: true } }, { upsert: true, new: true });
  console.log(`Seed complete. Admin: ${adminEmail}`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

