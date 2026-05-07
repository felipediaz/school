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

One-time setup, then `./bin/deploy.sh` for every release.

### One-time

1. **Create a Node app** in the Opalstack control panel (Node.js 22). Note the
   port Opalstack assigns — it's exposed to your `start` script as `$PORT`.
2. **Create a Postgres database** in the same control panel and grab the
   connection string.
3. **Create a site** that proxies to the Node app and attach a domain (with
   the included Let's Encrypt cert).
4. SSH in and clone the repo into the app directory:
   ```bash
   ssh <user>@<host>.opalstack.com
   cd ~/apps/printshop
   git clone <repo> .
   git checkout claude/printshop-design-app-SUDpz
   ```
5. Create the env file Opalstack sources before `start`:
   ```bash
   cp .env.example .env
   # edit .env and set:
   #   DATABASE_URL=<the postgres URL from step 2>
   #   STORAGE_ROOT=/home/<user>/apps/printshop/storage
   #   APP_ORIGIN=https://yourdomain.com
   #   SHOPIFY_SHOP / SHOPIFY_ADMIN_TOKEN / SHOPIFY_STOREFRONT_TOKEN /
   #   SHOPIFY_WEBHOOK_SECRET (when ready)
   #   FULFILLER=stub          # flip to "zoo" + fill ZOO_SFTP_* when live
   mkdir -p storage/uploads storage/orders storage/outbox
   ```
6. Make sure Opalstack's generated `start` script loads `.env` and runs
   `npm start` — the script is in `~/apps/printshop/start`. Add at the top:
   ```bash
   set -a; [ -f .env ] && . ./.env; set +a
   ```
7. First-time deploy:
   ```bash
   ./bin/deploy.sh
   ```

### Subsequent deploys

```bash
ssh <user>@<host>.opalstack.com
cd ~/apps/printshop
./bin/deploy.sh                 # uses current branch
./bin/deploy.sh some-branch     # deploys a different branch
```

The script pulls, runs `npm install` (postinstall regenerates Prisma),
applies migrations with `prisma migrate deploy`, rebuilds Next, then calls
Opalstack's generated `restart` script.

### Previewing on mobile

Open `https://yourdomain.com/design/business-card` on your phone — the
editor is touch-tuned (pinch-zoom, 36px handles, bottom dock with slide-up
sheets). For pre-DNS testing, use the temporary
`apps.<user>.opalstack.com` URL from the control panel.

## v1 scope notes

- ZooPrinting SFTP is **stubbed** — wire is complete, but the remote naming
  convention / job ticket format is a placeholder. See
  `lib/fulfillment/ZooSftpFulfiller.ts`.
- The renderer covers text, rect, circle, line, image, and group; rotated
  artwork is intentionally not honored yet (see comment in `lib/pdf/render.ts`).
- No admin dashboard in v1 — operators rely on Shopify admin + the Order /
  FulfillmentAttempt tables.
