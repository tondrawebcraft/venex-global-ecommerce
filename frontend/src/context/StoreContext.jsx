import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { errorMessage, unwrap } from '../services/api';

const StoreContext = createContext(null);
export function StoreProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState({ items: [], totals: { subtotal: 0, shipping: 0, discount: 0, total: 0 }, couponCode: null });
  const [wishlist, setWishlist] = useState([]);
  const [toast, setToast] = useState(null);
  const [online, setOnline] = useState(true);
  const notify = useCallback((message, tone = 'success') => { setToast({ message, tone }); window.setTimeout(() => setToast(null), 3000); }, []);
  const run = useCallback(async (action) => {
    try { return await action(); }
    catch (error) { notify(errorMessage(error), 'error'); throw error; }
  }, [notify]);
  const refreshCategories = useCallback(async () => {
    const result = await unwrap(api.get('/categories'));
    setCategories(result.categories);
    return result.categories;
  }, []);
  const refreshCart = useCallback(async () => { const result = await unwrap(api.get('/cart')); setCart(result.cart); return result.cart; }, []);
  const refreshWishlist = useCallback(async () => { const result = await unwrap(api.get('/wishlist')); setWishlist(result.products); return result.products; }, []);
  useEffect(() => {
    Promise.all([refreshCategories(), refreshCart(), refreshWishlist()])
      .then(() => setOnline(true)).catch(() => setOnline(false));
  }, [refreshCategories, refreshCart, refreshWishlist]);
  const value = useMemo(() => ({
    categories, cart, wishlist, toast, online, notify, refreshCategories, refreshCart, refreshWishlist,
    async addToCart(productId, quantity = 1, variant = {}) { return run(async () => { const result = await unwrap(api.post('/cart/items', { productId, quantity, ...variant })); setCart(result.cart); notify('Added to your bag.'); return result.cart; }); },
    async updateCartItem(itemId, quantity) { return run(async () => { const result = await unwrap(api.patch(`/cart/items/${itemId}`, { quantity })); setCart(result.cart); return result.cart; }); },
    async removeCartItem(itemId) { return run(async () => { const result = await unwrap(api.delete(`/cart/items/${itemId}`)); setCart(result.cart); notify('Removed from your bag.'); }); },
    async applyCoupon(code) { return run(async () => { const result = await unwrap(api.post('/cart/coupon', { code })); setCart(result.cart); notify('Offer applied.'); return result.cart; }); },
    async removeCoupon() { return run(async () => { const result = await unwrap(api.delete('/cart/coupon')); setCart(result.cart); }); },
    async toggleWishlist(productId) { return run(async () => { const result = await unwrap(api.post(`/wishlist/${productId}`)); setWishlist(result.products); notify(result.added ? 'Saved to your wishlist.' : 'Removed from your wishlist.'); return result.added; }); },
    async checkout(order) { return run(async () => { const result = await unwrap(api.post('/orders', order)); await refreshCart(); return result; }); }
  }), [categories, cart, wishlist, toast, online, notify, run, refreshCategories, refreshCart, refreshWishlist]);
  return <StoreContext.Provider value={value}>{children}{toast && <div className={`toast toast-${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>{toast.message}</div>}</StoreContext.Provider>;
}
export function useStore() { return useContext(StoreContext); }
export { errorMessage };

