import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import jwt from 'jsonwebtoken';
import test from 'node:test';
import adminRoutes from './adminRoutes.js';
import User from '../models/User.js';

test('Admin image uploads validate files and persist in the mounted uploads directory across app restarts', async (t) => {
  const originalCwd = process.cwd();
  const repoRoot = path.basename(originalCwd) === 'backend' ? path.resolve(originalCwd, '..') : originalCwd;
  const originalUserFindById = User.findById;
  const originalEnv = Object.fromEntries(['JWT_SECRET', 'API_URL', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].map((key) => [key, process.env[key]]));
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'venex-image-upload-'));
  let server;

  t.after(async () => {
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    }
    process.chdir(originalCwd);
    User.findById = originalUserFindById;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  const imageBytes = await readFile(path.join(repoRoot, 'frontend', 'public', 'images', 'bottle.jpg'));
  const compose = await readFile(path.join(repoRoot, 'docker-compose.yml'), 'utf8');
  assert.match(compose, /venex_uploads:\/app\/uploads/);
  process.chdir(tempDir);
  process.env.JWT_SECRET = 'image-upload-test-secret-at-least-32-characters';
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
  User.findById = async (_id) => ({ _id, role: 'admin', isActive: true });

  const app = express();
  app.use(express.json());
  app.use('/uploads', express.static(path.join(tempDir, 'uploads')));
  app.use('/api/admin', adminRoutes);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ success: false, error: { message: error.message } }));
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  process.env.API_URL = `${origin}/api`;
  const token = jwt.sign({ sub: '64b000000000000000000021', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '2m' });
  const headers = { Authorization: `Bearer ${token}` };

  const upload = async (route, file, name) => {
    const body = new FormData();
    body.append('image', new Blob([file], { type: 'image/jpeg' }), name);
    return fetch(`${origin}/api/admin${route}`, { method: 'POST', headers, body });
  };

  const productUpload = await upload('/upload', imageBytes, 'product.jpg');
  assert.equal(productUpload.status, 201);
  const productResult = (await productUpload.json()).data;
  assert.equal(productResult.storage, 'local');
  assert.match(productResult.url, /^http:\/\/127\.0\.0\.1:\d+\/uploads\/[\w-]+\.jpg$/);

  const collectionUpload = await upload('/upload/collections', imageBytes, 'collection.jpeg');
  assert.equal(collectionUpload.status, 201);
  const collectionResult = (await collectionUpload.json()).data;
  assert.equal(collectionResult.storage, 'local');
  assert.notEqual(productResult.url, collectionResult.url);

  const badFormat = await upload('/upload', Buffer.from('not an image'), 'fake.jpg');
  assert.equal(badFormat.status, 400);
  assert.match((await badFormat.json()).error.message, /JPG, JPEG, PNG, WEBP or AVIF/);

  const oversizedBytes = Buffer.concat([imageBytes, Buffer.alloc(5 * 1024 * 1024 + 1 - imageBytes.length)]);
  const oversized = await upload('/upload/collections', oversizedBytes, 'too-large.jpg');
  assert.equal(oversized.status, 413);
  assert.match((await oversized.json()).error.message, /5 MB or smaller/);

  const storedProductImage = await readFile(path.join(tempDir, 'uploads', new URL(productResult.url).pathname.split('/').pop()));
  assert.deepEqual(storedProductImage, imageBytes);
  const servedBeforeRestart = await fetch(productResult.url);
  assert.equal(servedBeforeRestart.status, 200);
  assert.deepEqual(Buffer.from(await servedBeforeRestart.arrayBuffer()), imageBytes);
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
  const restartedApp = express();
  restartedApp.use('/uploads', express.static(path.join(tempDir, 'uploads')));
  server = restartedApp.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const restartedOrigin = `http://127.0.0.1:${server.address().port}`;
  const afterRestart = await fetch(restartedOrigin + new URL(productResult.url).pathname);
  assert.equal(afterRestart.status, 200);
  assert.deepEqual(Buffer.from(await afterRestart.arrayBuffer()), imageBytes);
});
