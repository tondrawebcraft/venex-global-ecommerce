import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import test from 'node:test';
import adminRoutes from './adminRoutes.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import User from '../models/User.js';

test('Admin catalog APIs preserve public image URLs and reject temporary computer paths', async (t) => {
  const originals = {
    categoryCreate: Category.create,
    productCreate: Product.create,
    userFindById: User.findById,
    jwtSecret: process.env.JWT_SECRET
  };
  const saved = { categories: [], products: [] };
  Category.create = async (value) => { saved.categories.push(value); return value; };
  Product.create = async (value) => { saved.products.push(value); return value; };
  User.findById = async (_id) => ({ _id, role: 'admin', isActive: true });
  process.env.JWT_SECRET = 'image-reference-test-secret-at-least-32-characters';

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    Category.create = originals.categoryCreate;
    Product.create = originals.productCreate;
    User.findById = originals.userFindById;
    if (originals.jwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originals.jwtSecret;
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}/api/admin`;
  const token = jwt.sign({ sub: '64b000000000000000000031', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '2m' });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const product = { name: 'Uploaded product', description: 'A sufficiently long product description.', price: 1200, stock: 2, category: '64b000000000000000000032', sku: 'UPLOAD-01', images: ['/images/bottle.jpg', 'https://cdn.example/product.webp'] };

  const createdProduct = await fetch(`${baseUrl}/products`, { method: 'POST', headers, body: JSON.stringify(product) });
  assert.equal(createdProduct.status, 201);
  assert.deepEqual(saved.products[0].images, product.images);

  const rejectedProductPath = await fetch(`${baseUrl}/products`, { method: 'POST', headers, body: JSON.stringify({ ...product, images: ['C:\\Users\\Customer\\Desktop\\bottle.jpg'] }) });
  assert.equal(rejectedProductPath.status, 400);
  assert.equal(saved.products.length, 1);

  const collection = await fetch(`${baseUrl}/categories`, { method: 'POST', headers, body: JSON.stringify({ name: 'Test collection', image: 'https://cdn.example/cover.jpg' }) });
  assert.equal(collection.status, 201);
  assert.equal(saved.categories[0].image, 'https://cdn.example/cover.jpg');

  const missingCollectionCover = await fetch(`${baseUrl}/categories`, { method: 'POST', headers, body: JSON.stringify({ name: 'No cover' }) });
  assert.equal(missingCollectionCover.status, 400);
  assert.equal(saved.categories.length, 1);

  const rejectedCollectionPath = await fetch(`${baseUrl}/categories`, { method: 'POST', headers, body: JSON.stringify({ name: 'No local path', image: 'C:\\Users\\Customer\\Desktop\\cover.jpg' }) });
  assert.equal(rejectedCollectionPath.status, 400);
  assert.equal(saved.categories.length, 1);
});
