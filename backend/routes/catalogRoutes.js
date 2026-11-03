import { Router } from 'express';
import { body } from 'express-validator';
import { listProducts, getProduct, listCategories, getCategory, addReview, getSiteContent } from '../controllers/catalogController.js';
import { protect } from '../middleware/auth.js';
const router = Router();
router.get('/products', listProducts);
router.get('/products/:slug', getProduct);
router.post('/products/:id/reviews', protect, body('rating').isInt({ min: 1, max: 5 }), addReview);
router.get('/categories', listCategories);
router.get('/categories/:slug', getCategory);
router.get('/content/:key', getSiteContent);
export default router;

