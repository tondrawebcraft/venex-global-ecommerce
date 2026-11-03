import crypto from 'node:crypto';
import { validationResult } from 'express-validator';
import Cart from '../models/Cart.js';
import Wishlist from '../models/Wishlist.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import Address from '../models/Address.js';
import Newsletter from '../models/Newsletter.js';
import ContactMessage from '../models/ContactMessage.js';
import { asyncHandler, HttpError, ok } from '../utils/http.js';
import { cartIdentity, getCart, serializeCart, validateItem } from '../services/cart.js';
import { calculateTotals } from '../services/pricing.js';
import { preparePayment } from '../services/payments.js';

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new HttpError(400, 'Please check the information and try again.', errors.array().map(({ path, msg }) => ({ field: path, message: msg })));
}

export const readCart = asyncHandler(async (req, res) => ok(res, { cart: await serializeCart(await getCart(req, true)) }));

export const addToCart = asyncHandler(async (req, res) => {
  validate(req);
  const identity = cartIdentity(req);
  if (!identity) throw new HttpError(400, 'Your shopping session has expired. Refresh and try again.');
  const quantity = Number(req.body.quantity || 1);
  const product = await validateItem(req.body.productId, quantity);
  const cart = await Cart.findOne(identity) || await Cart.create({ ...identity, items: [] });
  const line = cart.items.find((entry) => entry.product.toString() === product._id.toString() && (entry.size || '') === (req.body.size || '') && (entry.color || '') === (req.body.color || ''));
  if (line) {
    if (line.quantity + quantity > product.stock) throw new HttpError(409, `${product.name} has only ${product.stock} left.`);
    line.quantity = Math.min(50, line.quantity + quantity);
  }
  else cart.items.push({ product: product._id, quantity, size: req.body.size || '', color: req.body.color || '' });
  await cart.save();
  await cart.populate('items.product');
  ok(res, { cart: await serializeCart(cart) });
});

export const updateCartItem = asyncHandler(async (req, res) => {
  const cart = await getCart(req, true);
  if (!cart) throw new HttpError(400, 'Your shopping session has expired. Refresh and try again.');
  const item = cart.items.id(req.params.itemId);
  if (!item) throw new HttpError(404, 'Cart item not found.');
  if (Number(req.body.quantity) <= 0) cart.items.pull(item._id);
  else {
    await validateItem(item.product._id || item.product, Number(req.body.quantity));
    item.quantity = Number(req.body.quantity);
  }
  await cart.save();
  await cart.populate('items.product');
  ok(res, { cart: await serializeCart(cart) });
});

export const removeCartItem = asyncHandler(async (req, res) => {
  const cart = await getCart(req, true);
  if (!cart) return ok(res, { cart: await serializeCart(null) });
  cart.items.pull(req.params.itemId);
  await cart.save();
  await cart.populate('items.product');
  ok(res, { cart: await serializeCart(cart) });
});

export const applyCoupon = asyncHandler(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const cart = await getCart(req, true);
  const current = await serializeCart(cart);
  const coupon = await Coupon.findOne({ code, isActive: true, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] });
  if (!coupon || (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)) throw new HttpError(400, 'This offer code is invalid or has expired.');
  if (current.totals.subtotal < coupon.minimumSpend) throw new HttpError(400, `This offer requires a minimum spend of ৳${coupon.minimumSpend}.`);
  cart.couponCode = code;
  await cart.save();
  ok(res, { cart: await serializeCart(cart) });
});

export const removeCoupon = asyncHandler(async (req, res) => {
  const cart = await getCart(req, true);
  if (cart) { cart.couponCode = undefined; await cart.save(); }
  ok(res, { cart: await serializeCart(cart) });
});

export const readWishlist = asyncHandler(async (req, res) => {
  const identity = cartIdentity(req);
  const wishlist = identity ? await Wishlist.findOne(identity).populate({ path: 'products', match: { isActive: true }, populate: { path: 'category', select: 'name slug' } }) : null;
  ok(res, { products: wishlist?.products || [] });
});

export const toggleWishlist = asyncHandler(async (req, res) => {
  const identity = cartIdentity(req);
  if (!identity) throw new HttpError(400, 'Your shopping session has expired. Refresh and try again.');
  const product = await Product.findOne({ _id: req.params.productId, isActive: true });
  if (!product) throw new HttpError(404, 'Product not found.');
  const wishlist = await Wishlist.findOne(identity) || await Wishlist.create({ ...identity, products: [] });
  const exists = wishlist.products.some((id) => id.toString() === product._id.toString());
  if (exists) wishlist.products.pull(product._id); else wishlist.products.push(product._id);
  await wishlist.save();
  await wishlist.populate('products');
  ok(res, { products: wishlist.products, added: !exists });
});

export const createOrder = asyncHandler(async (req, res) => {
  validate(req);
  const identity = cartIdentity(req);
  if (!identity) throw new HttpError(400, 'Your shopping session has expired. Refresh and try again.');
  const cart = await Cart.findOne(identity).populate('items.product');
  if (!cart?.items.length) throw new HttpError(400, 'Your cart is empty.');
  const { fullName, email, phone, line1, line2, city, district, postalCode } = req.body.shippingAddress || {};
  const paymentMethod = req.body.paymentMethod;
  if (paymentMethod !== 'cod') throw new HttpError(503, 'Online payment is not active yet. Please choose cash on delivery.');
  const lines = [];
  for (const item of cart.items) {
    const product = item.product;
    if (!product || !product.isActive || item.quantity > product.stock) throw new HttpError(409, `${product?.name || 'A product'} is no longer available in the requested quantity.`);
    lines.push({ product: product._id, name: product.name, slug: product.slug, image: product.images[0] || '', sku: product.sku, quantity: item.quantity, unitPrice: product.price, size: item.size, color: item.color });
  }
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const checkout = async (session) => {
    const options = session ? { session } : undefined;
    let coupon = cart.couponCode ? await Coupon.findOne({ code: cart.couponCode, isActive: true, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).session(session || null) : null;
    if (coupon && subtotal < coupon.minimumSpend) coupon = null;
    let couponCounted = false;
    const adjusted = [];
    let createdOrder;
    try {
      if (coupon?.usageLimit) {
        const reserved = await Coupon.findOneAndUpdate({ _id: coupon._id, usedCount: { $lt: coupon.usageLimit } }, { $inc: { usedCount: 1 } }, { new: true, ...(options || {}) });
        if (!reserved) throw new HttpError(400, 'This offer code has reached its limit.');
        coupon = reserved;
        couponCounted = true;
      }
      const totals = calculateTotals(lines, coupon);
      for (const line of lines) {
        const updated = await Product.findOneAndUpdate({ _id: line.product, isActive: true, stock: { $gte: line.quantity } }, { $inc: { stock: -line.quantity } }, { new: true, ...(options || {}) });
        if (!updated) throw new HttpError(409, `${line.name} just sold out. Please review your cart.`);
        adjusted.push(line);
      }
      [createdOrder] = await Order.create([{
        orderNumber: `VX-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        user: req.user?._id,
        email: String(email || req.user?.email || '').toLowerCase(),
        items: lines,
        shippingAddress: { fullName, email, phone, line1, line2, city, district, postalCode },
        ...totals,
        couponCode: coupon?.code,
        paymentMethod,
        statusHistory: [{ status: 'pending', note: 'Order received.' }]
      }], options);
      const paymentResult = await preparePayment(createdOrder, session);
      if (coupon && !coupon.usageLimit) {
        await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } }, options);
        couponCounted = true;
      }
      await Cart.deleteOne({ _id: cart._id }, options);
      return { order: createdOrder, payment: { status: paymentResult.payment.status, activationRequired: paymentResult.activationRequired, message: paymentResult.message } };
    } catch (error) {
      if (session) throw error;
      if (createdOrder) await Promise.all([Order.deleteOne({ _id: createdOrder._id }), Payment.deleteMany({ order: createdOrder._id })]);
      if (couponCounted && coupon) await Coupon.updateOne({ _id: coupon._id, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
      await Promise.all(adjusted.map((line) => Product.updateOne({ _id: line.product }, { $inc: { stock: line.quantity } })));
      throw error;
    }
  };

  const session = await Order.startSession();
  let result;
  try {
    try {
      result = await session.withTransaction(() => checkout(session));
    } catch (error) {
      const standaloneMongo = error.code === 20 || error.codeName === 'IllegalOperation' || /Transaction numbers are only allowed on a replica set member or mongos/i.test(error.message);
      if (!standaloneMongo) throw error;
      result = await checkout(null);
    }
  } finally {
    await session.endSession();
  }
  ok(res.status(201), result);
});

export const myOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
  ok(res, { orders });
});

export const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!order) throw new HttpError(404, 'Order not found.');
  ok(res, { order });
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOneAndUpdate({ _id: req.params.id, user: req.user._id, status: { $in: ['pending', 'confirmed'] }, paymentStatus: { $in: ['pending', 'failed'] } }, { $set: { status: 'cancelled' }, $push: { statusHistory: { status: 'cancelled', note: 'Cancelled by customer.' } } }, { new: true });
  if (!order) throw new HttpError(409, 'This order can no longer be cancelled.');
  await Promise.all(order.items.map((line) => Product.updateOne({ _id: line.product }, { $inc: { stock: line.quantity } })));
  await Payment.updateMany({ order: order._id, status: { $in: ['initiated', 'pending'] } }, { $set: { status: 'failed' } });
  ok(res, { order });
});

export const saveAddress = asyncHandler(async (req, res) => {
  validate(req);
  if (req.body.isDefault) await Address.updateMany({ user: req.user._id }, { $set: { isDefault: false } });
  const address = await Address.create({ ...req.body, user: req.user._id });
  ok(res.status(201), { address });
});

export const listAddresses = asyncHandler(async (req, res) => ok(res, { addresses: await Address.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: -1 }) }));

export const deleteAddress = asyncHandler(async (req, res) => {
  const deleted = await Address.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!deleted) throw new HttpError(404, 'Address not found.');
  ok(res, { message: 'Address removed.' });
});

export const subscribe = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  await Newsletter.findOneAndUpdate({ email }, { $set: { isSubscribed: true, source: req.body.source || 'website' } }, { upsert: true, new: true, runValidators: true });
  ok(res.status(201), { message: 'You are on the list. Look out for a little something from us soon.' });
});

export const contactMessage = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const message = String(req.body.message || '').trim();
  if (name.length < 2 || name.length > 100 || !/^\S+@\S+\.\S+$/.test(email) || message.length < 10 || message.length > 4000) throw new HttpError(400, 'Add your name, a valid email, and a message of at least 10 characters.');
  await ContactMessage.create({ name, email, message });
  ok(res.status(201), { message: 'Your note has reached our team. We will be in touch soon.' });
});

export const orderTracking = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ orderNumber: req.params.orderNumber, email: String(req.query.email || '').toLowerCase() }).select('orderNumber status trackingNumber statusHistory createdAt updatedAt');
  if (!order) throw new HttpError(404, 'We could not find an order with those details.');
  ok(res, { order });
});

export const couponPreview = asyncHandler(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const coupon = await Coupon.findOne({ code, isActive: true, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] });
  if (!coupon || (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)) throw new HttpError(400, 'This offer code is invalid or has expired.');
  ok(res, { coupon: { code, type: coupon.type, value: coupon.value, minimumSpend: coupon.minimumSpend } });
});

export const paymentTransactions = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  if (!order || (req.user.role !== 'admin' && order.user?.toString() !== req.user._id.toString())) throw new HttpError(404, 'Payment not found.');
  ok(res, { payments: await Payment.find({ order: order._id }).select('-metadata').sort({ createdAt: -1 }) });
});

export const paymentCallback = asyncHandler(async (req, _res) => {
  const provider = req.params.provider;
  if (!['bkash', 'nagad', 'sslcommerz'].includes(provider)) throw new HttpError(404, 'Payment provider not found.');
  throw new HttpError(501, `${provider} callbacks are pending merchant credentials and signature verification setup. No payment status was changed.`);
});

