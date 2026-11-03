import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import StoreLayout from './components/StoreLayout';
import { AccountPage, AuthPage, CartPage, CategoriesPage, CategoryPage, CheckoutPage, ForgotPasswordPage, HomePage, InformationPage, NotFoundPage, OrderConfirmationPage, OrderDetailPage, OrdersPage, ProductPage, ResetPasswordPage, ShopPage, TrackOrderPage, WishlistPage } from './pages/StorePages';
import { AdminGate } from './pages/AdminPage';

function Public({ children }) { return <StoreLayout>{children}</StoreLayout>; }
export default function App() {
  return <BrowserRouter><AuthProvider><StoreProvider><Routes>
    <Route path="/" element={<Public><HomePage /></Public>} />
    <Route path="/shop" element={<Public><ShopPage /></Public>} />
    <Route path="/products" element={<Public><ShopPage /></Public>} />
    <Route path="/categories" element={<Public><CategoriesPage /></Public>} />
    <Route path="/category/:slug" element={<Public><CategoryPage /></Public>} />
    <Route path="/product/:slug" element={<Public><ProductPage /></Public>} />
    <Route path="/search" element={<Public><ShopPage search /></Public>} />
    <Route path="/cart" element={<Public><CartPage /></Public>} />
    <Route path="/wishlist" element={<Public><WishlistPage /></Public>} />
    <Route path="/checkout" element={<Public><CheckoutPage /></Public>} />
    <Route path="/order-confirmation" element={<Public><OrderConfirmationPage /></Public>} />
    <Route path="/login" element={<Public><AuthPage /></Public>} />
    <Route path="/register" element={<Public><AuthPage mode="register" /></Public>} />
    <Route path="/forgot-password" element={<Public><ForgotPasswordPage /></Public>} />
    <Route path="/reset-password" element={<Public><ResetPasswordPage /></Public>} />
    <Route path="/account" element={<Public><AccountPage /></Public>} />
    <Route path="/account/orders" element={<Public><OrdersPage /></Public>} />
    <Route path="/account/orders/:id" element={<Public><OrderDetailPage /></Public>} />
    <Route path="/track-order" element={<Public><TrackOrderPage /></Public>} />
    <Route path="/about" element={<Public><InformationPage type="about" /></Public>} />
    <Route path="/contact" element={<Public><InformationPage type="contact" /></Public>} />
    <Route path="/faq" element={<Public><InformationPage type="faq" /></Public>} />
    <Route path="/privacy" element={<Public><InformationPage type="privacy" /></Public>} />
    <Route path="/terms" element={<Public><InformationPage type="terms" /></Public>} />
    <Route path="/returns" element={<Public><InformationPage type="returns" /></Public>} />
    <Route path="/admin/*" element={<AdminGate />} />
    <Route path="/404" element={<Public><NotFoundPage /></Public>} />
    <Route path="*" element={<Public><NotFoundPage /></Public>} />
  </Routes></StoreProvider></AuthProvider></BrowserRouter>;
}

