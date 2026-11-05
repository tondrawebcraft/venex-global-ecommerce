import assert from 'node:assert/strict';
import test from 'node:test';
import { addImage, moveImage, removeImage, replaceImage, validateImageFile } from './adminImageUploadUtils.js';

test('image validation accepts JPG, JPEG, PNG and WEBP within the size limit', () => {
  for (const [name, type] of [['cover.jpg', 'image/jpeg'], ['cover.jpeg', 'image/jpeg'], ['cover.png', 'image/png'], ['cover.webp', 'image/webp']]) {
    assert.equal(validateImageFile({ name, type, size: 5 * 1024 * 1024 }), '');
  }
  assert.equal(validateImageFile({ name: 'cover.jpeg', type: '', size: 100 }), '');
  assert.equal(validateImageFile({ name: 'product.avif', type: 'image/avif', size: 100 }, true), '');
  assert.match(validateImageFile({ name: 'cover.avif', type: 'image/avif', size: 100 }), /JPG, JPEG, PNG or WEBP/);
  assert.match(validateImageFile({ name: 'cover.gif', type: 'image/gif', size: 100 }), /JPG, JPEG, PNG or WEBP/);
  assert.match(validateImageFile({ name: 'cover.webp', type: 'image/png', size: 100 }), /JPG, JPEG, PNG or WEBP/);
  assert.match(validateImageFile({ name: 'large.jpg', type: 'image/jpeg', size: 5 * 1024 * 1024 + 1 }), /5 MB or smaller/);
});

test('image list controls add, replace, remove and reorder stored URLs', () => {
  const initial = ['/images/front.jpg', '/images/side.jpg'];
  assert.deepEqual(addImage(initial, 'https://cdn.example/detail.webp'), [...initial, 'https://cdn.example/detail.webp']);
  assert.deepEqual(addImage(initial, 'https://cdn.example/cover.webp', true), ['https://cdn.example/cover.webp']);
  assert.deepEqual(replaceImage(initial, 1, 'https://cdn.example/side.webp'), ['/images/front.jpg', 'https://cdn.example/side.webp']);
  assert.deepEqual(removeImage(initial, 0), ['/images/side.jpg']);
  assert.deepEqual(moveImage(initial, 1, 0), ['/images/side.jpg', '/images/front.jpg']);
  assert.equal(moveImage(initial, 0, 2), initial);
});
