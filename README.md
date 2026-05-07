# Printshop Designer

A Next.js + TypeScript app that lets customers design business cards,
postcards, envelopes, and flyers in the browser, check out through Shopify,
and (on `orders/paid`) drop a 300-DPI print-ready PDF onto ZooPrinting's
SFTP for production.

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Fabric.js 6** for the canvas editor
- **pdf-lib** for vector PDF assembly (text, shapes, raster images)
- **Prisma** + **PostgreSQL** for designs / orders / fulfillment attempts
- **Shopify** Storefront + Admin GraphQL (draft orders) for checkout
- **ssh2-sftp-client** for the ZooPrinting drop (stubbed in v1)
- Hosted on **Opalstack** — filesystem-based storage rooted at `STORAGE_ROOT`

## Layout

```
app/
  layout.tsx, page.tsx                 # shell + landing/product picker
  design/[product]/                    # editor page + Editor.client.tsx
  cart/                                # cart UI + checkout call
  api/
    designs                            # save / list / read / delete designs
    uploads                            # multipart image upload + serve
    checkout                           # build Shopify draft order
    webhooks/shopify                   # HMAC + render + fulfill
lib/
  products/specs.ts                    # the source of truth for sizes & paper
  editor/                              # Fabric init, font whitelist, JSON shape
  pdf/render.ts                        # design JSON → vector 300 DPI PDF
  shopify/                             # Admin/Storefront clients + HMAC verify
  fulfillment/                         # PrintFulfiller + Zoo SFTP + Stub
  storage/fs.ts                        # Opalstack filesystem helpers
  db.ts                                # Prisma singleton
prisma/schema.prisma
scripts/render-test.ts                 # CLI: render a saved design to PDF
```

## Local setup

```bash
npm install
cp .env.example .env
# fill DATABASE_URL etc.
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Then visit `http://localhost:3000`, pick a product, place text/shapes/images,
and watch autosave hit `/api/designs`.

## Verification end-to-end

1. **Editor**: open `/design/business-card`. Confirm bleed (red dashed),
   trim (solid black), and safe (blue dashed) guides at the right sizes.
2. **PDF**: `npm run render-test -- <designId>` → opens at 300 DPI in Acrobat,
   includes bleed, fonts embedded.
3. **Shopify**: with a dev store + `SHOPIFY_ADMIN_TOKEN`, hit `/api/checkout`
   with a fixture design and assert the returned `invoiceUrl` opens a Shopify
   checkout containing line-item properties (`design_id`, `product_key`,
   `paper`, `print_quantity`).
4. **Webhook**: configure Shopify to POST `orders/paid` to
   `${APP_ORIGIN}/api/webhooks/shopify`. Trigger and confirm:
   - HMAC verifies (401 on tamper).
   - Order, OrderItem, FulfillmentAttempt rows exist.
   - PDFs land under `storage/orders/<orderName>/...`
   - With `FULFILLER=stub`, copies appear in `storage/outbox/<orderName>/`.
5. **SFTP (later)**: set `FULFILLER=zoo`, fill `ZOO_SFTP_*`, trigger again,
   confirm files on the remote.

## Deploying to Opalstack

- Create a Node 22 app via Opalstack control panel.
- Set `DATABASE_URL` to the Opalstack-managed Postgres connection string.
- Set `STORAGE_ROOT` to a writable directory in the app's home dir.
- Set Shopify env vars (Admin + Storefront token + webhook secret).
- Build: `npm install --omit=dev` then `npm run build`.
- Start: `npm run start` (port supplied by Opalstack via `$PORT`).

## v1 scope notes

- ZooPrinting SFTP is **stubbed** — wire is complete, but the remote naming
  convention / job ticket format is a placeholder. See
  `lib/fulfillment/ZooSftpFulfiller.ts`.
- The renderer covers text, rect, circle, line, image, and group; rotated
  artwork is intentionally not honored yet (see comment in `lib/pdf/render.ts`).
- No admin dashboard in v1 — operators rely on Shopify admin + the Order /
  FulfillmentAttempt tables.
