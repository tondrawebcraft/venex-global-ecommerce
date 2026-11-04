import { validationResult } from 'express-validator';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Review from '../models/Review.js';
import Order from '../models/Order.js';
import SiteContent from '../models/SiteContent.js';
import { HttpError, asyncHandler, ok } from '../utils/http.js';

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new HttpError(400, 'Please check the information and try again.', errors.array().map(({ path, msg }) => ({ field: path, message: msg })));
}
const slugify = (value) => String(value || '').toLowerCase().trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const bool = (value) => value === true || value === 'true';

export const listProducts = asyncHandler(async (req, res) => {
  const { q, category, sort = 'featured', minPrice, maxPrice } = req.query;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(48, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
  const filter = { isActive: true };
  if (category) {
    const categoryDoc = await Category.findOne({ $or: [{ slug: category }, ...( /^[a-f\d]{24}$/i.test(category) ? [{ _id: category }] : [])], isActive: true });
    if (!categoryDoc) return ok(res, { products: [], pagination: { page, pages: 0, total: 0 } });
    filter.category = categoryDoc._id;
  }
  if (q) filter.$text = { $search: String(q).slice(0, 100) };
  if (minPrice !== undefined || maxPrice !== undefined) filter.price = { ...(minPrice !== undefined ? { $gte: Math.max(0, Number(minPrice) || 0) } : {}), ...(maxPrice !== undefined ? { $lte: Math.max(0, Number(maxPrice) || 0) } : {}) };
  for (const key of ['featured', 'newArrival', 'bestSeller']) if (req.query[key] !== undefined && bool(req.query[key])) filter[key] = true;
  const sorts = { featured: { featured: -1, createdAt: -1 }, newest: { createdAt: -1 }, 'price-low': { price: 1 }, 'price-high': { price: -1 }, popular: { bestSeller: -1, rating: -1 }, rating: { rating: -1 } };
  const [products, total] = await Promise.all([
    Product.find(filter).populate('category', 'name slug').sort(sorts[sort] || sorts.featured).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(filter)
  ]);
  ok(res, { products, pagination: { page, pages: Math.ceil(total / limit), total, limit } });
});

export const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true }).populate('category', 'name slug');
  if (!product) throw new HttpError(404, 'Product not found.');
  const [related, reviews] = await Promise.all([
    Product.find({ category: product.category._id, _id: { $ne: product._id }, isActive: true }).limit(4).lean(),
    Review.find({ product: product._id, isApproved: true }).populate('user', 'name').sort({ createdAt: -1 }).limit(20).lean()
  ]);
  ok(res, { product, related, reviews });
});

export const listCategories = asyncHandler(async (_req, res) => {
  const categories = await Category.aggregate([
    { $match: { isActive: true } },
    { $lookup: { from: 'products', let: { categoryId: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$category', '$$categoryId'] }, { $eq: ['$isActive', true] }] } } }, { $count: 'count' }], as: 'productCount' } },
    { $addFields: { productCount: { $ifNull: [{ $arrayElemAt: ['$productCount.count', 0] }, 0] } } },
    { $sort: { order: 1, name: 1 } }
  ]);
  ok(res, { categories });
});

export const getSiteContent = asyncHandler(async (req, res) => {
  const key = String(req.params.key || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60);
  const record = await SiteContent.findOne({ key }).lean();
  ok(res, { content: record?.content || {} });
});

export const getCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug, isActive: true });
  if (!category) throw new HttpError(404, 'Category not found.');
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(48, Number.parseInt(req.query.limit, 10) || 12);
  const [products, total] = await Promise.all([
    Product.find({ category: category._id, isActive: true }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments({ category: category._id, isActive: true })
  ]);
  ok(res, { category, products, pagination: { page, pages: Math.ceil(total / limit), total, limit } });
});

export const createProduct = asyncHandler(async (req, res) => {
  validate(req);
  const input = { ...req.body, slug: slugify(req.body.slug || req.body.name) };
  const product = await Product.create(input);
  ok(res.status(201), { product });
});

export const updateProduct = asyncHandler(async (req, res) => {
  validate(req);
  const updates = { ...req.body };
  if (updates.name && !updates.slug) updates.slug = slugify(updates.name);
  const product = await Product.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!product) throw new HttpError(404, 'Product not found.');
  ok(res, { product });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!product) throw new HttpError(404, 'Product not found.');
  ok(res, { message: 'Product archived.' });
});

export const restoreProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, isActive: false },
    { $set: { isActive: true } },
    { new: true, runValidators: true }
  );
  if (!product) throw new HttpError(404, 'Archived product not found.');
  ok(res, { product });
});

export const permanentlyDeleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new HttpError(404, 'Product not found.');
  ok(res, { message: 'Product permanently deleted.' });
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create({ ...req.body, slug: slugify(req.body.slug || req.body.name) });
  ok(res.status(201), { category });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const updates = { ...req.body };
  if (updates.name && !updates.slug) updates.slug = slugify(updates.name);
  const category = await Category.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!category) throw new HttpError(404, 'Category not found.');
  ok(res, { category });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!category) throw new HttpError(404, 'Category not found.');
  ok(res, { message: 'Category archived.' });
});

export const permanentlyDeleteCategory = asyncHandler(async (req, res) => {
  const hasProducts = await Product.exists({ category: req.params.id });
  if (hasProducts) throw new HttpError(409, 'This collection still has products. Move or permanently delete its products before deleting the collection.');
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new HttpError(404, 'Collection not found.');
  ok(res, { message: 'Collection permanently deleted.' });
});

export const restoreCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOneAndUpdate(
    { _id: req.params.id, isActive: false },
    { $set: { isActive: true } },
    { new: true, runValidators: true }
  );
  if (!category) throw new HttpError(404, 'Archived collection not found.');
  ok(res, { category });
});

export const addReview = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product || !product.isActive) throw new HttpError(404, 'Product not found.');
  const purchased = await Order.exists({ user: req.user._id, status: 'delivered', 'items.product': product._id });
  if (!purchased) throw new HttpError(403, 'Reviews are available to customers with a delivered order.');
  const review = await Review.create({ product: product._id, user: req.user._id, ...req.body });
  ok(res.status(201), { review, message: 'Your review is awaiting moderation.' });
});

