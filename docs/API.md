# VENEX GLOBAL API

Base URL: `http://localhost:5001/api`

Responses use `{ "success": true, "data": ... }`. Errors use `{ "success": false, "error": { "message": ... } }`. Paginated catalog and admin lists include a `pagination` object.

## Public

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | API health check |
| GET | `/content/:key` | Published website content |
| GET | `/products` | Search, filter, sort and paginate active products |
| GET | `/products/:slug` | Product, related products and approved reviews |
| GET | `/categories` | Active collections with product counts |
| GET | `/categories/:slug` | Collection-specific product listing |
| POST | `/newsletter` | Subscribe an email address |
| POST | `/contact` | Save a customer message |
| GET | `/orders/track/:orderNumber?email=...` | Track an order using order number and checkout email |
| GET/POST | `/payments/callback/:provider` | Gateway callback placeholder; returns 501 until signed provider verification is configured |

## Authentication and customer

`POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `PATCH /auth/profile`, `PATCH /auth/password`, `POST /auth/forgot-password`, and `POST /auth/reset-password` manage accounts. JWTs use HttpOnly cookies; mutating requests with an auth cookie must send the `x-csrf-token` header matching `venex_csrf`.

Customer endpoints include `GET /cart`, `POST /cart/items`, `PATCH/DELETE /cart/items/:itemId`, `POST/DELETE /cart/coupon`, `GET /wishlist`, `POST /wishlist/:productId`, `POST /orders`, `GET /orders`, `GET /orders/:id`, `POST /orders/:id/cancel`, and address endpoints under `/addresses`. Guest cart and wishlist requests use the `x-session-id` header; these are merged into the account on sign-in.

## Admin

All `/admin/*` endpoints require an authenticated `admin` role. The API includes dashboard analytics, product and category CRUD, validated image uploads, order updates, customer account controls, inventory, coupon management, payment records, review moderation, date-range reports, content records, newsletter subscribers and contact messages.

## Database models

`User`, `Product`, `Category`, `Cart`, `Wishlist`, `Order`, `Payment`, `Coupon`, `Review`, `Address`, `Newsletter`, `SiteContent` and `ContactMessage` use Mongoose timestamps and schema validation. Order prices are copied from live database product records at checkout; submitted client prices are ignored. On a MongoDB replica set or sharded cluster, stock, coupon use, order, payment and cart changes run in a multi-document transaction. Standalone local MongoDB falls back to atomic stock updates with compensating writes if a later order write fails. Online payment choices return 503 until provider creation and verified callback flows are active.

