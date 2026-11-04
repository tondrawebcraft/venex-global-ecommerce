import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import test from 'node:test';
import adminRoutes from './adminRoutes.js';
import catalogRoutes from './catalogRoutes.js';
import Category from '../models/Category.js';
import User from '../models/User.js';

test('Admin can archive and restore a collection, and the storefront reflects each state', async (t) => {
  const originals = {
    categoryFindByIdAndUpdate: Category.findByIdAndUpdate,
    categoryFindOneAndUpdate: Category.findOneAndUpdate,
    categoryAggregate: Category.aggregate,
    userFindById: User.findById,
    jwtSecret: process.env.JWT_SECRET
  };
  const category = {
    _id: '64b000000000000000000001',
    name: 'Test collection',
    slug: 'test-collection',
    description: 'Temporary in-memory collection used by this test.',
    image: '/images/weekender.jpg',
    isActive: true
  };
  const unchangedFields = { ...category };

  Category.findByIdAndUpdate = async (id, update) => {
    if (id !== category._id) return null;
    Object.assign(category, update.$set || update);
    return { ...category };
  };
  Category.findOneAndUpdate = async (filter, update) => {
    if (filter._id !== category._id || (filter.isActive === false && category.isActive !== false)) return null;
    Object.assign(category, update.$set || update);
    return { ...category };
  };
  Category.aggregate = async (pipeline) => {
    assert.deepEqual(pipeline[0], { $match: { isActive: true } });
    return category.isActive ? [{ ...category, productCount: 0 }] : [];
  };
  User.findById = async (_id) => ({ _id, role: 'admin', isActive: true });
  process.env.JWT_SECRET = 'category-restore-test-secret-at-least-32-characters';

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use('/api', catalogRoutes);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    Category.findByIdAndUpdate = originals.categoryFindByIdAndUpdate;
    Category.findOneAndUpdate = originals.categoryFindOneAndUpdate;
    Category.aggregate = originals.categoryAggregate;
    User.findById = originals.userFindById;
    if (originals.jwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originals.jwtSecret;
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const token = jwt.sign({ sub: '64b000000000000000000002', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '2m' });
  const adminHeaders = { Authorization: `Bearer ${token}` };

  const archived = await fetch(`${baseUrl}/api/admin/categories/${category._id}`, { method: 'DELETE', headers: adminHeaders });
  assert.equal(archived.status, 200);
  assert.equal(category.isActive, false);

  const hiddenFromStorefront = await fetch(`${baseUrl}/api/categories`);
  assert.equal(hiddenFromStorefront.status, 200);
  assert.deepEqual((await hiddenFromStorefront.json()).data.categories, []);

  const restored = await fetch(`${baseUrl}/api/admin/categories/${category._id}/restore`, { method: 'PATCH', headers: adminHeaders });
  assert.equal(restored.status, 200);
  const restoredBody = await restored.json();
  assert.equal(restoredBody.data.category.isActive, true);
  assert.equal(category.isActive, true);

  const visibleOnStorefront = await fetch(`${baseUrl}/api/categories`);
  assert.equal(visibleOnStorefront.status, 200);
  const storefrontCategories = (await visibleOnStorefront.json()).data.categories;
  assert.equal(storefrontCategories.length, 1);
  assert.equal(storefrontCategories[0].slug, category.slug);
  assert.deepEqual({ ...category, isActive: unchangedFields.isActive }, unchangedFields);
});
