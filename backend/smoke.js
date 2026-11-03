import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const apiBase = process.env.SMOKE_API_URL || 'http://localhost:5001/api';
const newSession = () => ({ id: crypto.randomUUID(), csrf: '', cookies: new Map() });

async function request(session, route, { method = 'GET', body, expectedStatus = 200 } = {}) {
  const headers = { 'x-session-id': session.id };
  if (session.cookies.size) headers.Cookie = [...session.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && session.csrf) headers['x-csrf-token'] = session.csrf;
  const response = await fetch(`${apiBase}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  for (const value of response.headers.getSetCookie()) {
    const [pair, ...attributes] = value.split(';');
    const separator = pair.indexOf('=');
    if (separator < 1) continue;
    const name = pair.slice(0, separator);
    const cookieValue = pair.slice(separator + 1);
    if (attributes.some((attribute) => attribute.trim().toLowerCase() === 'max-age=0')) session.cookies.delete(name);
    else session.cookies.set(name, cookieValue);
  }
  if (session.cookies.has('venex_csrf')) session.csrf = session.cookies.get('venex_csrf');
  const payload = await response.json();
  if (response.status !== expectedStatus) throw new Error(`${method} ${route}: expected ${expectedStatus}, got ${response.status} (${payload?.error?.message || response.statusText})`);
  return payload.data;
}

async function main() {
  const publicSession = newSession();
  const health = await request(publicSession, '/health');
  if (health.status !== 'healthy') throw new Error('API health check failed.');
  const catalog = await request(publicSession, '/products?limit=12');
  const categories = await request(publicSession, '/categories');
  if (catalog.products.length < 8 || categories.categories.length < 4) throw new Error('Demo catalog seed is incomplete.');
  const product = catalog.products[0];

  const customer = newSession();
  await request(customer, '/auth/csrf');
  const email = `smoke-${Date.now()}@example.test`;
  const registration = await request(customer, '/auth/register', { method: 'POST', body: { name: 'VENEX Smoke Test', email, password: 'Smoke-test-Pass-9284' }, expectedStatus: 200 });
  if (registration.user.role !== 'customer') throw new Error('Registration did not create a customer account.');
  const profile = await request(customer, '/auth/me');
  if (profile.user.email !== email) throw new Error('Authenticated profile did not match the new account.');
  await request(customer, '/cart/items', { method: 'POST', body: { productId: product._id, quantity: 1 }, expectedStatus: 200 });
  const cart = await request(customer, '/cart');
  if (!cart.cart.items.length || cart.cart.totals.subtotal !== product.price) throw new Error('Cart subtotal did not match the catalog price.');

  const shippingAddress = { fullName: 'VENEX Smoke Test', email, phone: '+8801712345678', line1: '12 Example Road', city: 'Dhaka', district: 'Dhaka', postalCode: '1207' };
  await request(customer, '/orders', { method: 'POST', body: { paymentMethod: 'bkash', shippingAddress }, expectedStatus: 503 });
  const checkout = await request(customer, '/orders', { method: 'POST', body: { paymentMethod: 'cod', shippingAddress }, expectedStatus: 201 });
  if (!checkout.order.orderNumber || checkout.order.status !== 'pending') throw new Error('Cash-on-delivery checkout did not create a pending order.');
  const tracked = await request(customer, `/orders/track/${encodeURIComponent(checkout.order.orderNumber)}?email=${encodeURIComponent(email)}`);
  if (tracked.order.orderNumber !== checkout.order.orderNumber) throw new Error('Order tracking did not return the created order.');
  await request(customer, `/orders/${checkout.order._id}/cancel`, { method: 'POST', body: {}, expectedStatus: 200 });

  const admin = newSession();
  await request(admin, '/auth/csrf');
  const login = await request(admin, '/auth/login', { method: 'POST', body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
  if (login.user.role !== 'admin') throw new Error('Seeded administrator credentials did not grant admin access.');
  for (const route of ['/admin/dashboard', '/admin/products', '/admin/categories', '/admin/orders', '/admin/customers', '/admin/coupons', '/admin/payments', '/admin/reviews', '/admin/reports', '/admin/content', '/admin/newsletter', '/admin/messages']) await request(admin, route);
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    const image = new FormData();
    image.append('image', new Blob([await readFile(new URL('../frontend/public/images/bottle.jpg', import.meta.url))], { type: 'image/jpeg' }), 'smoke-upload.jpg');
    const cookie = [...admin.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    const upload = await fetch(`${apiBase}/admin/upload`, { method: 'POST', headers: { Cookie: cookie, 'x-session-id': admin.id, 'x-csrf-token': admin.csrf }, body: image });
    const uploaded = await upload.json();
    if (upload.status !== 201 || uploaded?.data?.storage !== 'local' || !(await fetch(uploaded.data.url)).ok) throw new Error('Admin image upload did not return a working local image URL.');
  }

  const [storefront, hero] = await Promise.all([fetch('http://localhost:5173/'), fetch('http://localhost:5173/images/hero-v2.jpg')]);
  if (!storefront.ok || !hero.ok) throw new Error('Storefront or local image did not load.');
  console.log(`Smoke passed: ${catalog.products.length} products, ${categories.categories.length} collections, customer register/cart/checkout/track/cancel, disabled payment guard, 12 admin reads, storefront and image HTTP checks${process.env.CLOUDINARY_CLOUD_NAME ? '' : ', local admin image upload'}.`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
