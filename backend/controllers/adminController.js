import Product from '../models/Product.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import Coupon from '../models/Coupon.js';
import Review from '../models/Review.js';
import Newsletter from '../models/Newsletter.js';
import SiteContent from '../models/SiteContent.js';
import ContactMessage from '../models/ContactMessage.js';
import { asyncHandler, HttpError, ok } from '../utils/http.js';

export const dashboard = asyncHandler(async (_req, res) => {
  const [totalOrders, totalCustomers, totalProducts, pendingOrders, completedOrders, lowStock, revenue, recentOrders, sales] = await Promise.all([
    Order.countDocuments(), User.countDocuments({ role: 'customer' }), Product.countDocuments({ isActive: true }),
    Order.countDocuments({ status: { $in: ['pending', 'confirmed', 'processing'] } }), Order.countDocuments({ status: 'delivered' }),
    Product.find({ isActive: true, stock: { $lte: 5 } }).select('name slug sku stock').limit(10).lean(),
    Order.aggregate([{ $match: { status: { $nin: ['cancelled', 'returned'] }, $or: [{ paymentStatus: 'paid' }, { paymentMethod: 'cod', status: 'delivered' }] } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    Order.find().sort({ createdAt: -1 }).limit(8).select('orderNumber email total status createdAt').lean(),
    Order.aggregate([{ $match: { createdAt: { $gte: new Date(Date.now() - 30 * 86400000) }, status: { $nin: ['cancelled', 'returned'] } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }])
  ]);
  ok(res, { metrics: { revenue: revenue[0]?.total || 0, totalOrders, totalCustomers, totalProducts, pendingOrders, completedOrders }, lowStock, recentOrders, sales });
});

export const adminOrders = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Number.parseInt(req.query.limit, 10) || 20);
  const filter = req.query.status ? { status: req.query.status } : {};
  const [orders, total] = await Promise.all([Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Order.countDocuments(filter)]);
  ok(res, { orders, pagination: { page, pages: Math.ceil(total / limit), total } });
});

export const adminUpdateOrder = asyncHandler(async (req, res) => {
  const allowed = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
  if (!allowed.includes(req.body.status)) throw new HttpError(400, 'Choose a valid order status.');
  const query = { _id: req.params.id, status: { $nin: ['cancelled', 'returned'] } };
  if (req.body.status === 'cancelled') query.paymentStatus = { $ne: 'paid' };
  const order = await Order.findOneAndUpdate(query, {
    $set: { status: req.body.status, ...(req.body.trackingNumber ? { trackingNumber: String(req.body.trackingNumber).slice(0, 100) } : {}) },
    $push: { statusHistory: { status: req.body.status, note: String(req.body.note || 'Updated by admin.').slice(0, 300) } }
  }, { new: true, runValidators: true });
  if (!order) throw new HttpError(409, 'This order cannot be updated in its current state.');
  if (order.status === 'cancelled') {
    await Promise.all(order.items.map((line) => Product.updateOne({ _id: line.product }, { $inc: { stock: line.quantity } })));
    await Payment.updateMany({ order: order._id, status: { $in: ['initiated', 'pending'] } }, { $set: { status: 'failed' } });
  }
  ok(res, { order });
});

export const customers = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Number.parseInt(req.query.limit, 10) || 25);
  const [users, total] = await Promise.all([User.find({ role: 'customer' }).select('name email phone isActive createdAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), User.countDocuments({ role: 'customer' })]);
  ok(res, { customers: users, pagination: { page, pages: Math.ceil(total / limit), total } });
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const user = await User.findOneAndUpdate({ _id: req.params.id, role: 'customer' }, { $set: { isActive: req.body.isActive === true } }, { new: true }).select('name email isActive');
  if (!user) throw new HttpError(404, 'Customer not found.');
  ok(res, { customer: user });
});

export const coupons = asyncHandler(async (_req, res) => ok(res, { coupons: await Coupon.find().sort({ createdAt: -1 }).lean() }));
export const createCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.create({ ...req.body, code: String(req.body.code || '').trim().toUpperCase() });
  ok(res.status(201), { coupon });
});
export const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, { ...req.body, code: req.body.code?.toUpperCase() }, { new: true, runValidators: true });
  if (!coupon) throw new HttpError(404, 'Coupon not found.');
  ok(res, { coupon });
});
export const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw new HttpError(404, 'Coupon not found.');
  ok(res, { message: 'Coupon removed.' });
});

export const payments = asyncHandler(async (_req, res) => ok(res, { payments: await Payment.find().populate('order', 'orderNumber email total').select('-metadata').sort({ createdAt: -1 }).limit(200).lean() }));

export const reviews = asyncHandler(async (_req, res) => ok(res, { reviews: await Review.find().populate('user', 'name email').populate('product', 'name slug').sort({ createdAt: -1 }).limit(200).lean() }));
export const moderateReview = asyncHandler(async (req, res) => {
  const review = await Review.findByIdAndUpdate(req.params.id, { isApproved: Boolean(req.body.isApproved) }, { new: true });
  if (!review) throw new HttpError(404, 'Review not found.');
  const group = await Review.aggregate([{ $match: { product: review.product, isApproved: true } }, { $group: { _id: '$product', rating: { $avg: '$rating' }, count: { $sum: 1 } } }]);
  await Product.updateOne({ _id: review.product }, { $set: { rating: group[0]?.rating || 0, reviewCount: group[0]?.count || 0 } });
  ok(res, { review });
});

export const reports = asyncHandler(async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 90 * 86400000);
  const to = req.query.to ? new Date(req.query.to) : new Date();
  if (Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf()) || from > to) throw new HttpError(400, 'Choose a valid reporting date range.');
  const rows = await Order.aggregate([{ $match: { createdAt: { $gte: from, $lte: to }, status: { $nin: ['cancelled', 'returned'] } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 }, items: { $sum: { $sum: '$items.quantity' } } } }, { $sort: { _id: 1 } }]);
  ok(res, { rows, totals: rows.reduce((a, row) => ({ revenue: a.revenue + row.revenue, orders: a.orders + row.orders, items: a.items + row.items }), { revenue: 0, orders: 0, items: 0 }) });
});

export const readContent = asyncHandler(async (_req, res) => ok(res, { content: await SiteContent.find().lean() }));
export const updateContent = asyncHandler(async (req, res) => {
  const key = String(req.params.key || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60);
  const content = await SiteContent.findOneAndUpdate({ key }, { $set: { content: req.body.content || {} } }, { upsert: true, new: true, runValidators: true });
  ok(res, { content });
});

export const newsletterSubscribers = asyncHandler(async (_req, res) => ok(res, { subscribers: await Newsletter.find({ isSubscribed: true }).sort({ createdAt: -1 }).lean() }));
export const contactMessages = asyncHandler(async (_req, res) => ok(res, { messages: await ContactMessage.find().sort({ createdAt: -1 }).limit(200).lean() }));
export const updateContactMessage = asyncHandler(async (req, res) => {
  const message = await ContactMessage.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
  if (!message) throw new HttpError(404, 'Message not found.');
  ok(res, { message });
});

