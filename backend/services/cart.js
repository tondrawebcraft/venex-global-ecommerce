import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import { calculateTotals } from './pricing.js';

export function cartIdentity(req) {
  if (req.user) return { user: req.user._id };
  const sessionId = req.get('x-session-id');
  if (!sessionId || !/^[a-zA-Z0-9-]{16,80}$/.test(sessionId)) return null;
  return { sessionId };
}

export async function getCart(req, create = true) {
  const identity = cartIdentity(req);
  if (!identity) return null;
  const query = Cart.findOne(identity).populate('items.product');
  let cart = await query;
  if (!cart && create) cart = await Cart.create({ ...identity, items: [] });
  return cart;
}

export async function serializeCart(cart) {
  if (!cart) return { items: [], totals: calculateTotals([]), couponCode: null };
  const items = cart.items.filter((line) => line.product && line.product.isActive).map((line) => ({
    product: line.product,
    quantity: line.quantity,
    id: line._id.toString(),
    size: line.size || '',
    color: line.color || '',
    unitPrice: line.product.price,
    lineTotal: line.product.price * line.quantity
  }));
  const coupon = cart.couponCode ? await Coupon.findOne({ code: cart.couponCode, isActive: true, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }) : null;
  return { items, totals: calculateTotals(items, coupon), couponCode: cart.couponCode || null };
}

export async function validateItem(productId, quantity) {
  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) throw Object.assign(new Error('A product in your cart is no longer available.'), { status: 404 });
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) throw Object.assign(new Error('Choose a quantity between 1 and 50.'), { status: 400 });
  if (quantity > product.stock) throw Object.assign(new Error(`${product.name} has only ${product.stock} left.`), { status: 409 });
  return product;
}

