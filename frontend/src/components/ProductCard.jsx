import { Heart, ShoppingBag, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';

export function money(value) { return `৳${Number(value || 0).toLocaleString('en-BD')}`; }

export default function ProductCard({ product, compact = false, onAdded }) {
  const { wishlist, toggleWishlist, addToCart } = useStore();
  const saved = wishlist.some((item) => item._id === product._id);
  const image = product.images?.[0] || '/images/weekender.jpg';
  return <article className={`product-card ${compact ? 'product-card-compact' : ''}`}>
    <div className="product-image-wrap">
      <Link to={`/product/${product.slug}`} className="product-image-link" aria-label={`View ${product.name}`}><img className="product-image" src={image} alt={product.name} loading="lazy" /></Link>
      {product.compareAtPrice > product.price && <span className="product-badge">Just a little less</span>}
      {product.newArrival && <span className="product-badge product-badge-new">New</span>}
      <button className={`icon-button wishlist-button ${saved ? 'is-saved' : ''}`} onClick={() => toggleWishlist(product._id).catch(() => {})} aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}><Heart size={17} fill={saved ? 'currentColor' : 'none'} /></button>
      <button className="quick-add" disabled={product.stock === 0} onClick={() => addToCart(product._id).then(() => onAdded?.()).catch(() => {})}><ShoppingBag size={15} /> <span>{product.stock === 0 ? 'Out of stock' : 'Add to bag'}</span></button>
    </div>
    <div className="product-meta"><div><Link to={`/product/${product.slug}`} className="product-title">{product.name}</Link><span className="product-category">{product.category?.name || 'Everyday essentials'}</span></div><div className="product-price">{money(product.price)}{product.compareAtPrice > product.price && <s>{money(product.compareAtPrice)}</s>}</div></div>
    {product.rating > 0 && <div className="rating-line"><Star size={13} fill="currentColor" /> <span>{product.rating.toFixed(1)}</span><span className="muted">({product.reviewCount || 0})</span></div>}
    {product.stock <= 5 && product.stock > 0 && <span className="stock-note">Only {product.stock} left</span>}
    {product.stock === 0 && <span className="stock-note sold-out">Out of stock</span>}
  </article>;
}

