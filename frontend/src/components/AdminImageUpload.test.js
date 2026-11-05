import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import { createServer } from 'vite';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('collection and product uploaders render previews and the expected image controls', async (t) => {
  const vite = await createServer({
    configFile: path.join(frontendRoot, 'vite.config.js'),
    root: frontendRoot,
    logLevel: 'silent',
    server: { middlewareMode: true },
    appType: 'custom'
  });
  t.after(() => vite.close());

  const [{ default: AdminImageUpload }, { StoreProvider }] = await Promise.all([
    vite.ssrLoadModule('/src/components/AdminImageUpload.jsx'),
    vite.ssrLoadModule('/src/context/StoreContext.jsx')
  ]);
  const render = (props) => renderToStaticMarkup(createElement(StoreProvider, null, createElement(AdminImageUpload, { onChange: () => {}, onBusyChange: () => {}, ...props })));

  const collection = render({ single: true, folder: 'collections', value: ['https://cdn.example/collection-cover.webp'] });
  assert.match(collection, /src="https:\/\/cdn\.example\/collection-cover\.webp"/);
  assert.match(collection, /Replace image/);
  assert.match(collection, /Remove image/);
  assert.match(collection, /Drop one cover image here/);

  const product = render({ folder: 'products', value: ['https://cdn.example/product-front.jpg', '/images/product-side.png'] });
  assert.match(product, /src="https:\/\/cdn\.example\/product-front\.jpg"/);
  assert.match(product, /src="\/images\/product-side\.png"/);
  for (const action of ['Move up', 'Move down', 'Replace', 'Remove']) assert.ok(product.includes(action));
  assert.match(product, /multiple=""/);
  assert.match(product, /\.jpg,\.jpeg,\.png,\.webp/);
  assert.match(product, /\.avif,image\/avif/);
});
