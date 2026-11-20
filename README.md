# Made by Myra — storefront

A full-stack e-commerce app for **Made by Myra**: custom apparel, accessories and personalized gifts. Customers can **upload their own design** or **describe the design they want**, preview it on the product, pay with Stripe, approve design proofs, and track their order. The owner manages everything from a private dashboard.

> **Status, plainly:** the code is complete for the features listed below, but it has **not yet been installed, built, or run against real services**. It was written in an environment without package-install access, so it has only been checked with a stubbed type-check and unit tests of the pricing/validation logic. Before launch you must install it, connect the services below, and walk through the test checklist in [Testing](#testing). Expect to fix a few small things on first build.

---

## Contents

1. [What's included](#whats-included)
2. [Tech stack](#tech-stack)
3. [External services you need](#external-services-you-need)
4. [Local setup](#local-setup)
5. [Creating the owner (admin) account](#creating-the-owner-admin-account)
6. [Service configuration details](#service-configuration-details)
7. [Testing](#testing)
8. [Deployment (Vercel)](#deployment-vercel)
9. [Owner guide](#owner-guide)
10. [Unfinished features & known limitations](#unfinished-features--known-limitations)
11. [Project structure](#project-structure)

---

## What's included

**Storefront**
- Announcement bar (editable), sticky navigation with search, account, wishlist and a live bag count; mobile menu
- Homepage: hero, shop by category, How It Works, featured products, genuine reviews only, newsletter with consent checkbox, full footer
- Shop with search (name, category, description, tags), filters (category, price, color, size, availability) and sorting (featured, price, newest, best-selling)
- Collection pages, "Our Creations" (ready-to-shop), "Customize Your Own"
- Product pages with JSON-LD structured data, size charts, quick view, wishlist
- About (owner-editable story + photos), Contact (categories + attachment), FAQ, five policy pages shown as **drafts** until you approve them

**Customization (the centerpiece)**
- Step flow: product → color → size → method → review, with progress indicator
- **"I Have My Own Design"**: PNG / JPG / PDF / SVG uploads straight to private cloud storage, with progress bars, size limits, real file-signature checks, SVG script/link rejection, preview, replace/remove, per-product print locations, drag/resize positioning (mouse, touch and keyboard), optional text, low-resolution warning, rights confirmation, special instructions
- **"Help Me Create a Design"**: the "Tell us what you're dreaming of ♡" request with text, colors, style, placement, occasion, inspiration images and notes. Per product, either a design fee charged at checkout or **quote first** (nothing charged)
- Preview uses the owner's real mockup for the exact color + view. When no mockup exists it shows a silhouette clearly labelled "Basic preview · color approximate". It never recolors photos with filters. Previews are labelled as approximations
- Integration point for a future AI concept generator (`src/lib/ai/design-concepts.ts`). **Nothing generates artwork today**

**Cart & checkout**
- Database-backed bag (guest and signed-in, merged when signing in): quantities, remove, save for later, customization details, artwork thumbnails, itemized pricing
- Prices are always recalculated on the server: base price, size surcharges, variant prices, print placements, design fees, discount codes
- Stripe Checkout: cards, Apple Pay / Google Pay (when enabled in Stripe), guest or account checkout, shipping and billing addresses, shipping rates, optional Stripe Tax
- Orders are marked **paid only by the verified Stripe webhook**, never by the success page. Webhooks are idempotent

**Accounts**
- Email + password, password reset by email, optional Google sign-in
- Order history and tracking timeline (Order Received → Awaiting Design → Awaiting Approval → In Production → Shipped → Delivered), carrier tracking links, proof approval or revision requests (included revisions + optional paid extras), order messages, reorder, saved addresses (default pre-fills checkout), wishlist, account details
- Guests get a secure order link by email to track orders and approve proofs

**Owner dashboard (`/admin`, admins only)**
- Overview: paid orders, confirmed revenue net of refunds, best sellers, pending design requests, awaiting approval, awaiting fulfillment
- Orders: searchable, sortable table → order page with artwork download, design request details, proof upload, messages, status updates with optional customer email, tracking, delivered, Stripe refunds (full or partial), cancellation with restock, printable packing slip, private notes
- Products: create and edit, photos and mockups per color and view, colors, sizes and surcharges, color × size variant matrix (stock, price, SKU, availability), print locations with a visual guide, featured/draft/hidden, size chart, customization options
- Categories and seasonal collections, pricing settings, shipping rates, discount codes, homepage editor (hero image, text, promo banner, announcement), About page, social links, FAQ, policies, review moderation, quote requests and contact messages

**Security**
- Server-side role checks on every admin page, action and API route (plus middleware)
- Zod validation on all inputs, Postgres-backed rate limiting, bcrypt passwords, signed short-lived URLs for private files, security headers, no secrets in client code, Stripe webhook signature verification

---

## Tech stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · PostgreSQL + Prisma · NextAuth (Auth.js v4) · Stripe · S3-compatible storage (AWS SDK v3) · Resend (email, via HTTP) · Zod

UI components are hand-built (accessible, keyboard-friendly) in the brand style rather than pulled from shadcn/ui, to keep dependencies small. Fonts: Caveat (handwritten) and DM Sans (via `next/font`).

---

## External services you need

| Service | What it's for | Suggested provider | Required? |
|---|---|---|---|
| PostgreSQL database | Products, orders, accounts | **Supabase** or Neon | Yes |
| Payments | Checkout, refunds | **Stripe** | Yes, for checkout |
| File storage (S3-compatible) | Customer artwork (private), product photos (public) | **Supabase Storage**, Cloudflare R2, or AWS S3 | Yes, for uploads and photos |
| Transactional email | Order confirmations, proofs, password resets | **Resend** | Strongly recommended (otherwise emails are only logged) |
| Hosting | Running the site | **Vercel** | Yes |
| Domain | Your web address + email sending domain | Any registrar | Yes for launch |
| Google OAuth | "Continue with Google" | Google Cloud Console | Optional |
| Stripe Tax | Automatic sales tax | Stripe | Optional (talk to an accountant) |

The dashboard shows a yellow banner listing anything not yet connected.

---

## Local setup

Requirements: **Node.js 20.9+**, npm, a PostgreSQL database (a free Supabase project is fine), and optionally the [Stripe CLI](https://stripe.com/docs/stripe-cli).

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file and fill it in (see .env.example for every variable)
cp .env.example .env

# 3. Create the database tables (creates the first migration)
npx prisma migrate dev --name init

# 4. Add demo data (all clearly marked "[Demo]")
npm run db:seed

# 5. Create your owner account
npm run create-admin -- you@example.com "A-strong-password-123" "Myra"

# 6. Start the site
npm run dev            # http://localhost:3000

# 7. In a second terminal, forward Stripe webhooks to your computer
npm run stripe:listen  # copy the whsec_… secret it prints into STRIPE_WEBHOOK_SECRET, then restart `npm run dev`
```

Useful commands:

| Command | What it does |
|---|---|
| `npm run dev` | Local development server |
| `npm test` | Pricing / validation logic tests |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:migrate` | Create & apply a new migration after editing `prisma/schema.prisma` |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:studio` | Browse the database in a GUI |

---

## Creating the owner (admin) account

```bash
npm run create-admin -- you@example.com "A-strong-password-123" "Myra"
```

- Creates the account with the **ADMIN** role, or promotes an existing account (for example one you made with Google)
- Sign in at `/login`, then open `/admin` (there's also an "Owner dashboard" link in your account menu)
- In production, run the same command with your production `DATABASE_URL` in your terminal's environment
- Regular customers can never reach `/admin`. Roles are checked against the database on every request

---

## Service configuration details

### Database (Supabase example)
1. Create a project → **Project Settings → Database → Connection string**
2. `DATABASE_URL` = the **Transaction pooler** URL (port 6543) with `?pgbouncer=true` appended
3. `DIRECT_DATABASE_URL` = the **direct / session** URL (port 5432), used for migrations

### File storage
You need **two buckets**:
- **Private** (`S3_PRIVATE_BUCKET`): customer artwork, inspiration images, proofs and attachments. Must **not** be public
- **Public** (`S3_PUBLIC_BUCKET`): product photos, mockups, homepage and About images. Set `S3_PUBLIC_BASE_URL` to its public URL

**Supabase Storage:** Storage → create both buckets (mark only the public one "Public") → Storage → Settings → S3 Connection: copy the endpoint (`S3_ENDPOINT`), region, and create access keys. Set `S3_FORCE_PATH_STYLE=true`. Public base URL looks like `https://<project>.supabase.co/storage/v1/object/public/<public-bucket>`.

**Cloudflare R2:** create both buckets, enable public access on the public one (r2.dev or a custom domain), create an API token with read/write, `S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com`, `S3_REGION=auto`.

**CORS (required, because browsers upload directly to storage):** allow `PUT` and `GET` from your site's origin(s) on **both** buckets, with header `Content-Type` allowed. Example rule:
```json
[{ "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"], "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["Content-Type"], "MaxAgeSeconds": 3600 }]
```

`S3_PUBLIC_BASE_URL` must be set **before building** because Next.js image optimization reads its hostname at build time.

### Stripe
1. Get your keys from **Developers → API keys** (use **test mode** first): `STRIPE_SECRET_KEY`
2. **Webhook:** Developers → Webhooks → Add endpoint → `https://yourdomain.com/api/webhooks/stripe`, with these events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
   - `charge.refunded`

   Copy the signing secret into `STRIPE_WEBHOOK_SECRET`
3. **Apple Pay / Google Pay:** Settings → Payment methods → enable them. Stripe Checkout shows them automatically on supported devices
4. **Tax (optional):** enable Stripe Tax, add your registrations, then set `STRIPE_AUTOMATIC_TAX=true`
5. `SHIPPING_COUNTRIES` controls which countries checkout accepts (default `US`)

### Email (Resend)
1. Create a Resend account, **verify your domain** (DNS records)
2. `RESEND_API_KEY`, `EMAIL_FROM="Made by Myra <hello@yourdomain.com>"`, `OWNER_NOTIFICATION_EMAIL=` where you want new-order alerts
3. Optional: create an Audience and set `RESEND_AUDIENCE_ID` so newsletter sign-ups sync there for campaigns

Without email configured, the site still works, but emails (receipts, proofs, password resets) are only written to the server log.

### Google sign-in (optional)
Google Cloud Console → APIs & Services → Credentials → OAuth client (Web). Authorized redirect URI: `https://yourdomain.com/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google` for local). Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Leave them blank to hide the button.

### Auth secret
`NEXTAUTH_SECRET`: generate with `openssl rand -base64 32`. `NEXTAUTH_URL` = your site URL.

---

## Testing

### Automated
```bash
npm test            # pricing, discounts, print resolution, file signature + SVG safety, customization validation
npm run typecheck
npm run lint
```

### Manual end-to-end checklist (Stripe test mode)
Use card `4242 4242 4242 4242`, any future date, any CVC.

**Upload-your-own flow**
- [ ] Home → Customize Your Own → open "[Demo] Classic Custom Tee"
- [ ] Pick a color and size; choose **I Have My Own Design**; add **Front center** and **Back center**
- [ ] Upload a PNG (watch the progress bar), drag and resize it, try a small image (you should see the low-resolution warning), add text, tick the rights box
- [ ] Try uploading a `.txt` renamed to `.png` → should be rejected
- [ ] Add to bag → the drawer opens and the bag count updates
- [ ] Bag page: change quantity, save for later, move back, check itemized prices and artwork thumbnail
- [ ] Checkout as a **guest** with a promo code you created in the dashboard → pay
- [ ] Success page shows "Almost there…" then "Thank you" once the webhook arrives (requires `npm run stripe:listen` locally)
- [ ] Confirmation email arrives (or is logged); the order link works without signing in

**Design request flow**
- [ ] Open "[Demo] Cozy Custom Hoodie" → **Help Me Create a Design** → describe an idea, add an inspiration image → the preview shows "pending creation" → checkout (design fee included)
- [ ] Dashboard → Orders → open it → status is **Awaiting Design** → upload a proof with a note
- [ ] As the customer: open the order → request a revision → owner uploads v2 → customer approves → status becomes **In Production**
- [ ] Use up the included revisions to check the extra-revision payment
- [ ] Owner: add tracking → customer gets the "Shipped" email and tracking link → mark delivered

**Quote flow**
- [ ] "[Demo] Custom Shorts" → design request → "Send my design request" (no payment) → appears in Dashboard → Requests → reply by email

**Accounts & dashboard**
- [ ] Register, sign out, reset password via email link, sign in with Google (if configured)
- [ ] Save addresses, set a default (pre-fills at Stripe), wishlist, reorder a past order
- [ ] Leave a review on a purchased product → approve it in Dashboard → Reviews → it appears on the product and homepage
- [ ] Issue a partial refund → payment status updates after Stripe's `charge.refunded` webhook
- [ ] Create a product with your own photos and mockups; edit pricing, shipping, homepage, About and policies
- [ ] Confirm a customer account **cannot** open `/admin`

**Responsive & accessible**
- [ ] Repeat the customizer on a phone; tab through checkout-related pages with the keyboard only; turn on "reduce motion" in your OS and confirm animations stop

---

## Deployment (Vercel)

1. Push the project to a GitHub repository (don't commit `.env`)
2. Vercel → New Project → import the repo. Framework: Next.js. Build command: `npm run build`
3. Add **every** variable from `.env.example` in Project Settings → Environment Variables, using your **live** values. Set `NEXT_PUBLIC_SITE_URL` and `NEXTAUTH_URL` to `https://yourdomain.com`
4. Apply the database schema to production once (and after future schema changes):
   ```bash
   DATABASE_URL="…" DIRECT_DATABASE_URL="…" npx prisma migrate deploy
   ```
5. Create your admin account against production (see above). Don't run the seed in production unless you want demo products
6. Add your domain in Vercel → Domains
7. Create the **live** Stripe webhook endpoint for your domain (see Stripe section) and update `STRIPE_WEBHOOK_SECRET`
8. Add your production domain to both storage buckets' CORS rules
9. Run through the checklist above in test mode first, then switch Stripe to live keys

---

## Owner guide

**Adding a product**
Dashboard → Products → New product → fill in basics, colors, sizes, variants and print locations → Create. Then upload images:
- **Product photo**: what shoppers see in the shop and on the product page
- **Customizer mockup**: a blank garment image for one **color + view** (e.g. Light Pink / Front). Upload **square** images with the garment centered. Colors without a mockup show a labelled basic preview
- After uploading mockups, open "Preview on store" and adjust the print location **X / Y / W / H** percentages so the dashed box sits where you actually print

**Design proofs**
Orders with a design request show "Upload a new proof". The customer is emailed and can approve it or request changes. Approval moves the order to In Production. Set included revisions and the extra-revision fee under Pricing.

**Policies**
Policy pages show a "Draft" notice until you edit them and tick **Reviewed & approved**. The starter text is a placeholder, not legal advice. Please have your policies reviewed.

**Demo data**
Seeded products are titled "[Demo] …" and marked "Demo product". Delete them (or edit them into real products) before launch. Demo shipping rates and FAQ answers should also be replaced.

---

## Unfinished features & known limitations

Be aware of these before launch:

1. **Not yet run.** The app hasn't been installed, built or run against real services. Expect to fix small issues on first `npm install` / `npm run build`, then complete the manual checklist.
2. **Migrations not generated.** Run `npx prisma migrate dev --name init` to create the first migration from the schema.
3. **No real imagery yet.** The hero shows an original illustration and products show labelled silhouettes until you upload photos and mockups.
4. **Policies, FAQ answers, demo prices and demo shipping rates are placeholders.** They are labelled as drafts or demo data and must be replaced.
5. **AI design assistant:** integration point only (`src/lib/ai/design-concepts.ts`). No image generation is connected or shown to customers.
6. **Shipping:** flat-rate options only. No live carrier rates or label purchasing (Shippo/EasyPost would be the next integration). Tracking numbers are entered by hand.
7. **Taxes:** calculated only if you enable Stripe Tax (`STRIPE_AUTOMATIC_TAX=true`). Otherwise no tax is charged.
8. **Newsletter:** stores sign-ups with consent timestamps and can sync to a Resend Audience. There's no on-site unsubscribe page (use your email tool's unsubscribe links) and no campaign editor.
9. **Email verification** for new accounts isn't implemented. Guest orders are deliberately **not** auto-linked to accounts created later with the same email (guests keep access through their emailed link).
10. **Inventory** is reserved when payment is confirmed, not when checkout starts. Two shoppers buying the very last item at the same moment could both succeed. Made-to-order items (blank stock) are unaffected.
11. **Admin security:** no two-factor authentication. Use a long, unique password.
12. **Rate limiting** is a simple database-backed limiter, fine for a small shop. Move to Upstash/Redis if traffic grows.
13. **Content-Security-Policy** header isn't set (other security headers are). Add one once your third-party domains are final.
14. **PDF artwork** is stored and downloadable, but customers see a file icon rather than a rendered preview.
15. **Abandoned uploads** (files uploaded but never ordered) aren't cleaned up automatically. Add a storage lifecycle rule (e.g. delete `artwork/` objects older than 90 days that aren't attached to orders) or a scheduled job.
16. **Automated tests** cover pricing and validation logic only. There are no browser end-to-end tests yet (Playwright would be the natural next step).
17. **Analytics** are basic counts. Add Vercel Analytics or similar for traffic data.

---

## Project structure

```
prisma/schema.prisma        Database models (users, products, variants, images, print locations, uploads,
                            carts, orders, design requests, proofs, payments, refunds, shipments, reviews,
                            wishlists, discounts, shipping rates, editable content, rate limits, webhook log)
prisma/seed.ts              Demo data (clearly marked)
scripts/create-admin.ts     Owner account setup
src/middleware.ts           Route protection for /admin and /account
src/app/(store)/…           Storefront pages (home, shop, products, cart, checkout, account, auth, info pages)
src/app/admin/…             Owner dashboard
src/app/api/…               Checkout, Stripe webhook, uploads, private file access, newsletter, auth
src/actions/…               Server actions (cart, orders, reviews, account, admin)
src/components/…            UI: header/cart drawer, product cards, customizer, order views, admin tools
src/lib/…                   Pricing, cart, auth, Stripe, storage, email, content, validation, labels
tests/logic.test.ts         Unit tests for pricing & validation
```
