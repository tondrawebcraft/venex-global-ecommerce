import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ArrowRight, Heart, Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import { Brand } from './Brand';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import api, { unwrap } from '../services/api';

const links = [{ to: '/shop', label: 'Shop all' }, { to: '/categories', label: 'Collections' }, { to: '/about', label: 'Our story' }];

export default function StoreLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { user } = useAuth();
  const { cart, wishlist } = useStore();
  const navigate = useNavigate();
  const submitSearch = (event) => { event.preventDefault(); const value = query.trim(); if (value) navigate(`/search?q=${encodeURIComponent(value)}`); setSearchOpen(false); setMenuOpen(false); };
  return <div className="site-shell">
    <div className="announcement"><span>A softer kind of everyday.</span><span className="announcement-center">Complimentary delivery on orders over ৳5,000</span><Link to="/shop">Discover <ArrowRight size={12} /></Link></div>
    <header className="site-header">
      <button className="icon-button mobile-menu-trigger" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>{menuOpen ? <X /> : <Menu />}</button>
      <Brand />
      <nav className="desktop-nav" aria-label="Main navigation">{links.map((link) => <NavLink key={link.to} to={link.to}>{link.label}</NavLink>)}</nav>
      <div className="header-actions"><button className="icon-button search-trigger" aria-label="Search" onClick={() => setSearchOpen(!searchOpen)}><Search /></button><Link className="icon-button wishlist-trigger" to="/wishlist" aria-label="Wishlist"><Heart /><span className="count-dot">{wishlist.length || ''}</span></Link><Link className="icon-button account-trigger" to={user ? '/account' : '/login'} aria-label="Account"><UserRound /></Link><Link className="icon-button bag-trigger" to="/cart" aria-label="Shopping bag"><ShoppingBag /><span className="count-dot">{cart.items.reduce((sum, line) => sum + line.quantity, 0) || ''}</span></Link></div>
      {searchOpen && <form className="header-search" onSubmit={submitSearch}><Search size={17} /><input autoFocus placeholder="What are you looking for?" value={query} onChange={(e) => setQuery(e.target.value)} /><button type="submit">Search</button></form>}
    </header>
    {menuOpen && <div className="mobile-menu"><div className="mobile-menu-links">{links.map((link) => <NavLink key={link.to} to={link.to} onClick={() => setMenuOpen(false)}>{link.label}</NavLink>)}<NavLink to="/wishlist" onClick={() => setMenuOpen(false)}>Wishlist</NavLink><NavLink to="/faq" onClick={() => setMenuOpen(false)}>Help & FAQs</NavLink></div><div className="mobile-menu-foot"><span>Thoughtfully chosen. Made to last.</span><Link to={user ? '/account' : '/login'} onClick={() => setMenuOpen(false)}>Your account <ArrowRight size={15} /></Link></div></div>}
    <main>{children}</main>
    <footer className="site-footer"><div className="footer-main"><div className="footer-brand-col"><Brand light /><p>Less noise. Better things.<br />For wherever the day takes you.</p><div className="social-row"><a href="https://instagram.com" aria-label="Instagram">ig.</a><a href="https://facebook.com" aria-label="Facebook">f.</a><a href="https://pinterest.com" aria-label="Pinterest">p.</a></div></div><div><h3>Explore</h3><Link to="/shop">Shop all</Link><Link to="/categories">Collections</Link><Link to="/about">Our story</Link><Link to="/contact">Get in touch</Link></div><div><h3>Help</h3><Link to="/faq">FAQs</Link><Link to="/track-order">Track your order</Link><Link to="/returns">Returns & exchanges</Link><Link to="/account/orders">Your orders</Link></div><div className="footer-newsletter"><h3>A little note from us</h3><p>New things, good stories, and 10% off your first order.</p><FooterSignup /></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} VENEX GLOBAL. Made for everyday.</span><div><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/returns">Returns</Link></div><span>Dhaka, Bangladesh&nbsp; · &nbsp;BDT ৳</span></div></footer>
  </div>;
}

function FooterSignup() {
  const [email, setEmail] = useState(''); const [done, setDone] = useState(false);
  const submit = async (event) => { event.preventDefault(); try { await unwrap(api.post('/newsletter', { email })); setDone(true); } catch { setDone(false); } };
  return <form className="newsletter-form" onSubmit={submit}><input type="email" required placeholder="Your email address" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" /><button aria-label="Subscribe">{done ? 'Thank you' : <ArrowRight size={18} />}</button></form>;
}

