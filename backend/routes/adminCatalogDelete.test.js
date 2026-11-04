import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import test from 'node:test';
import adminRoutes from './adminRoutes.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import User from '../models/User.js';

test('Admin can archive, restore, and permanently delete a product without changing order or payment history', async (t) => {
  const originals = {
    categoryFindByIdAndUpdate: Category.findByIdAndUpdate,
    categoryFindByIdAndDelete: Category.findByIdAndDelete,
    productFindByIdAndUpdate: Product.findByIdAndUpdate,
    productFindOneAndUpdate: Product.findOneAndUpdate,
    productFindByIdAndDelete: Product.findByIdAndDelete,
    productExists: Product.exists,
    userFindById: User.findById,
    jwtSecret: process.env.JWT_SECRET
  };
  const category = { _id: '64b000000000000000000011', name: 'Test collection', slug: 'test-collection' };
  const product = { _id: '64b000000000000000000012', name: 'Test product', slug: 'test-product', category: category._id, isActive: true };
  const order = { orderNumber: 'VG-TEST-ORDER', items: [{ product: product._id, name: product.name, sku: 'TEST-001', quantity: 1, unitPrice: 1250 }] };
  const payment = { order: '64b000000000000000000013', provider: 'cod', amount: 1250, status: 'pending' };
  const orderSnapshot = structuredClone(order);
  const paymentSnapshot = structuredClone(payment);
  let productExists = true;
  let categoryExists = true;

  Category.findByIdAndUpdate = async (id, update) => id === category._id && categoryExists ? { ...category, ...update } : null;
  Category.findByIdAndDelete = async (id) => {
    if (id !== category._id || !categoryExists) return null;
    categoryExists = false;
    return { ...category };
  };
  Product.findByIdAndUpdate = async (id, update) => {
    if (id !== product._id || !productExists) return null;
    Object.assign(product, update.$set || update);
    return { ...product };
  };
  Product.findOneAndUpdate = async (filter, update) => {
    if (filter._id !== product._id || !productExists || (filter.isActive === false && product.isActive !== false)) return null;
    Object.assign(product, update.$set || update);
    return { ...product };
  };
  Product.findByIdAndDelete = async (id) => {
    if (id !== product._id || !productExists) return null;
    productExists = false;
    return { ...product };
  };
  Product.exists = async (filter) => productExists && product.category === filter.category ? { _id: product._id } : null;
  User.findById = async (_id) => ({ _id, role: 'admin', isActive: true });
  process.env.JWT_SECRET = 'catalog-delete-test-secret-at-least-32-characters';

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    Category.findByIdAndUpdate = originals.categoryFindByIdAndUpdate;
    Category.findByIdAndDelete = originals.categoryFindByIdAndDelete;
    Product.findByIdAndUpdate = originals.productFindByIdAndUpdate;
    Product.findOneAndUpdate = originals.productFindOneAndUpdate;
    Product.findByIdAndDelete = originals.productFindByIdAndDelete;
    Product.exists = originals.productExists;
    User.findById = originals.userFindById;
    if (originals.jwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originals.jwtSecret;
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}/api/admin`;
  const token = jwt.sign({ sub: '64b000000000000000000014', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '2m' });
  const headers = { Authorization: `Bearer ${token}` };

  const archived = await fetch(`${baseUrl}/products/${product._id}`, { method: 'DELETE', headers });
  assert.equal(archived.status, 200);
  assert.equal(product.isActive, false);

  const restored = await fetch(`${baseUrl}/products/${product._id}/restore`, { method: 'PATCH', headers });
  assert.equal(restored.status, 200);
  assert.equal(product.isActive, true);

  const blockedCollectionDelete = await fetch(`${baseUrl}/categories/${category._id}/permanent`, { method: 'DELETE', headers });
  assert.equal(blockedCollectionDelete.status, 409);
  assert.equal(productExists, true);
  assert.equal(categoryExists, true);

  const deletedProduct = await fetch(`${baseUrl}/products/${product._id}/permanent`, { method: 'DELETE', headers });
  assert.equal(deletedProduct.status, 200);
  assert.equal(productExists, false);
  assert.deepEqual(order, orderSnapshot);
  assert.deepEqual(payment, paymentSnapshot);

  const deletedCategory = await fetch(`${baseUrl}/categories/${category._id}/permanent`, { method: 'DELETE', headers });
  assert.equal(deletedCategory.status, 200);
  assert.equal(categoryExists, false);
  assert.equal(productExists, false);
  assert.deepEqual(order, orderSnapshot);
  assert.deepEqual(payment, paymentSnapshot);
});
