import { Router } from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { body } from 'express-validator';
import * as admin from '../controllers/adminController.js';
import * as catalog from '../controllers/catalogController.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { HttpError, asyncHandler, ok } from '../utils/http.js';

const router = Router();
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_SIZE, files: 1 } });
router.use(protect, adminOnly);
router.get('/dashboard', admin.dashboard);
router.get('/products', asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Number.parseInt(req.query.limit, 10) || 25);
  const [products, total] = await Promise.all([Product.find().populate('category', 'name slug').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Product.countDocuments()]);
  ok(res, { products, pagination: { page, pages: Math.ceil(total / limit), total } });
}));
router.post('/products', body('name').trim().isLength({ min: 2, max: 180 }), body('description').trim().isLength({ min: 10 }), body('price').isFloat({ min: 0 }), body('stock').isInt({ min: 0 }), body('category').isMongoId(), body('sku').trim().isLength({ min: 2, max: 50 }), catalog.createProduct);
router.patch('/products/:id', body('price').optional().isFloat({ min: 0 }), body('stock').optional().isInt({ min: 0 }), catalog.updateProduct);
router.patch('/products/:id/restore', catalog.restoreProduct);
router.delete('/products/:id/permanent', catalog.permanentlyDeleteProduct);
router.delete('/products/:id', catalog.deleteProduct);
function receiveImage(req, res, next) {
  upload.single('image')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      return next(new HttpError(tooLarge ? 413 : 400, tooLarge ? 'Images must be 5 MB or smaller.' : 'Upload one image at a time.'));
    }
    next(error);
  });
}

function uploadImage(folderName) {
  return asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Choose an image to upload.');
    const type = await fileTypeFromBuffer(req.file.buffer);
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', ...(folderName === 'products' ? ['image/avif'] : [])];
    if (!type || !allowedMimes.includes(type.mime)) throw new HttpError(400, folderName === 'products' ? 'Use a JPG, JPEG, PNG, WEBP or AVIF image.' : 'Use a JPG, JPEG, PNG or WEBP image.');
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
      const result = await new Promise((resolve, reject) => {
        const allowedFormats = ['jpg', 'jpeg', 'png', 'webp', ...(folderName === 'products' ? ['avif'] : [])];
        const stream = cloudinary.uploader.upload_stream({ folder: `venex/${folderName}`, resource_type: 'image', allowed_formats: allowedFormats }, (error, value) => error ? reject(error) : resolve(value));
        stream.end(req.file.buffer);
      });
      return ok(res.status(201), { url: result.secure_url, storage: 'cloudinary' });
    }
    const filename = `${crypto.randomUUID()}.${type.ext}`;
    const folder = path.resolve('uploads');
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(path.join(folder, filename), req.file.buffer, { flag: 'wx' });
    const apiOrigin = (process.env.API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, '').replace(/\/$/, '');
    ok(res.status(201), { url: `${apiOrigin}/uploads/${filename}`, storage: 'local' });
  });
}
router.post('/upload', receiveImage, uploadImage('products'));
router.post('/upload/collections', receiveImage, uploadImage('collections'));
router.get('/categories', asyncHandler(async (_req, res) => { ok(res, { categories: await Category.find().sort({ order: 1 }).lean() }); }));
router.post('/categories', body('name').trim().isLength({ min: 2, max: 80 }), catalog.createCategory);
router.patch('/categories/:id/restore', catalog.restoreCategory);
router.patch('/categories/:id', catalog.updateCategory);
router.delete('/categories/:id/permanent', catalog.permanentlyDeleteCategory);
router.delete('/categories/:id', catalog.deleteCategory);
router.get('/orders', admin.adminOrders);
router.patch('/orders/:id', admin.adminUpdateOrder);
router.get('/customers', admin.customers);
router.patch('/customers/:id', admin.updateCustomer);
router.get('/coupons', admin.coupons);
router.post('/coupons', body('code').trim().isLength({ min: 2, max: 40 }), body('type').isIn(['percentage', 'fixed']), body('value').isFloat({ gt: 0 }), admin.createCoupon);
router.patch('/coupons/:id', admin.updateCoupon);
router.delete('/coupons/:id', admin.deleteCoupon);
router.get('/payments', admin.payments);
router.get('/reviews', admin.reviews);
router.patch('/reviews/:id', admin.moderateReview);
router.get('/reports', admin.reports);
router.get('/content', admin.readContent);
router.put('/content/:key', admin.updateContent);
router.get('/newsletter', admin.newsletterSubscribers);
router.get('/messages', admin.contactMessages);
router.patch('/messages/:id', admin.updateContactMessage);
export default router;

