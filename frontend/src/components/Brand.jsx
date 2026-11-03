import { Link } from 'react-router-dom';

export function Brand({ light = false }) {
  return <Link className={`brand ${light ? 'brand-light' : ''}`} to="/" aria-label="VENEX GLOBAL home"><span className="brand-mark">V<span>.</span></span><span className="brand-name">VENEX<span>GLOBAL</span></span></Link>;
}

