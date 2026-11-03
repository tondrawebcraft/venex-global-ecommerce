import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTotals, SHIPPING_FEE } from './pricing.js';

test('adds standard delivery below the free-delivery threshold', () => {
  const totals = calculateTotals([{ unitPrice: 1200, quantity: 1 }]);
  assert.deepEqual(totals, { subtotal: 1200, shipping: SHIPPING_FEE, discount: 0, total: 1320 });
});

test('waives delivery at five thousand taka', () => {
  const totals = calculateTotals([{ unitPrice: 2500, quantity: 2 }]);
  assert.deepEqual(totals, { subtotal: 5000, shipping: 0, discount: 0, total: 5000 });
});

test('applies a capped percentage coupon to the server calculated subtotal', () => {
  const totals = calculateTotals([{ unitPrice: 3000, quantity: 2 }], { type: 'percentage', value: 20, maxDiscount: 700, minimumSpend: 1000 });
  assert.deepEqual(totals, { subtotal: 6000, shipping: 0, discount: 700, total: 5300 });
});

test('ignores a coupon that misses its minimum spend and never discounts below zero', () => {
  const totals = calculateTotals([{ unitPrice: 500, quantity: 1 }], { type: 'fixed', value: 900, minimumSpend: 1000 });
  assert.deepEqual(totals, { subtotal: 500, shipping: SHIPPING_FEE, discount: 0, total: 620 });
});
