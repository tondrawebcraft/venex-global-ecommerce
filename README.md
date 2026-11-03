# VENEX GLOBAL

VENEX GLOBAL is a Bangladesh-focused commerce site with a responsive storefront, customer accounts and a protected admin workspace. The frontend is React and Vite; the REST API uses Express and MongoDB/Mongoose.

## Run the complete site

Requirements: Docker Desktop with Compose, or Node.js 22.12+ and MongoDB.

1. Copy `.env.example` to `.env` and set unique values for `JWT_SECRET`, `COOKIE_SECRET` and `ADMIN_PASSWORD`. Use at least 32 characters for the first two and 12 for the admin password.
2. Start the stack with `docker compose up --build -d`.
3. Seed the demo catalog and initial admin with `docker compose exec backend npm run seed`.
4. Open the storefront at [http://localhost:5173](http://localhost:5173). The API health check is at [http://localhost:5001/api/health](http://localhost:5001/api/health).

The admin signs in at `/login` using `ADMIN_EMAIL` and the password set in `.env`, then opens `/admin`. The default email is `admin@venex.global`. The password is never printed or committed. Change the default email and password for a shared environment.

Compose publishes the web app on port 5173, the API on 5001 and MongoDB on 27019. The Luna Fashion backend and database use 5000 and 27018, so VENEX keeps its own API and database ports separate. Override them with `FRONTEND_PORT`, `BACKEND_PORT` and `MONGO_PORT` in `.env` when needed.

## Local development

With Node.js 22.12+ and MongoDB running on the URI in `.env`:

```powershell
npm install
npm install --prefix backend
npm install --prefix frontend
npm run seed
npm run dev
```

Open the Vite app at `http://localhost:5173`. The API listens on `http://localhost:5001`. To use only the Compose database, run `docker compose up -d mongo` first.

## Storefront and admin features

- Responsive home, collection, search, product, cart, checkout, account, order tracking and policy pages.
- Catalog search, category filters, sorting, pagination, variants, reviews, wishlist and persistent guest carts.
- Checkout recalculates prices on the server, reserves inventory atomically and supports COD. MongoDB replica sets use a multi-document transaction; standalone local MongoDB uses compensated updates.
- Customer registration, login, profile and password changes, password reset, saved addresses, order history and order cancellation.
- Admin dashboard, products, collections, orders, customers, inventory, coupons, payments, review moderation, reports, site content and message inbox.
- Admin image uploads validate file contents and use a persistent local volume by default. Configured Cloudinary credentials enable hosted images.
- HTTP-only authentication cookies, CSRF protection, role checks, input validation, request limits, secure response headers and environment-based secrets.

The API surface and response format are documented in [docs/API.md](docs/API.md).

## Seed data and launch content

`backend/seed.js` creates the initial admin, sample collections, nine illustrative products and the `WELCOME10` demo coupon. It can be run again to refresh sample catalog fields. The seed will not silently promote an existing customer to admin.

Replace the demo catalog, stock counts, product copy and stock images with real business information before accepting public orders. The delivery threshold, fees, delivery estimates, return window, support email and policy text are sample values. The support address `hello@venex.global` is a placeholder. Update the visible content and verify your actual business policies before launch. Image notes are in [ASSET_CREDITS.md](ASSET_CREDITS.md).

## Payment and email activation

COD is the only active payment method. bKash, Nagad and SSLCommerz are displayed as pending and disabled; the API rejects these methods before changing inventory. Provider environment variables and a callback endpoint placeholder are present, but provider creation, signature validation, settlement/refund handling and live merchant callbacks must be implemented and verified before enabling online payments.

Password reset sends email only when valid SMTP settings are configured. `DEV_RESET_LINKS=true` exposes reset links only in non-production responses for local development; keep it false in shared environments.

## Checks

```powershell
npm run lint
npm test
npm run build
npm run smoke
```

`npm run smoke` checks the running Compose services at localhost, creates a temporary smoke-test account, completes and cancels a COD order, checks the admin read routes, uploads a local image when Cloudinary is not configured, and verifies the storefront and image URLs. It requires the stack to be running, seeded, and reachable on the default ports. The smoke order, test customer and uploaded test image remain in that development environment.

## Deployment

Use a managed MongoDB replica set or sharded cluster, HTTPS, strong production secrets, an explicit allowed frontend origin, persistent or hosted image storage, SMTP, backups and monitoring. Build the frontend with the public API URL in `VITE_API_URL`; set `API_URL` to the public API origin for uploaded local image URLs. Configure product/policy copy and support contact details. Keep `DEV_RESET_LINKS` false. Do not enable an online provider until its signed callback and full settlement flow have been implemented and tested.

The implementation roadmap and outstanding activation items are in [PROGRESS.md](PROGRESS.md).
