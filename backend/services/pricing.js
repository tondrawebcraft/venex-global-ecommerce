export const SHIPPING_FEE = 120;

export function calculateDiscount(coupon, subtotal) {
  if (!coupon || subtotal < coupon.minimumSpend) return 0;
  const raw = coupon.type === 'percentage' ? subtotal * coupon.value / 100 : coupon.value;
  return Math.min(subtotal, coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw);
}

export function calculateTotals(items, coupon) {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const shipping = subtotal >= 5000 || subtotal === 0 ? 0 : SHIPPING_FEE;
  const discount = calculateDiscount(coupon, subtotal);
  return { subtotal, shipping, discount, total: Math.max(0, subtotal + shipping - discount) };
}

