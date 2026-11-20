# SY Cold Drinks

Responsive storefront and admin dashboard for SY Cold Drinks, Jandaha, Vaishali, Bihar.

## Files
- `index.html` — customer storefront
- `styles.css` — responsive design
- `app.js` — product catalogue, cart and checkout UI
- `admin.html` — admin sign-in and product dashboard
- `admin.js` — admin authentication and product management UI

## Cloudflare setup
- Worker API: `https://sy-cold-drinks-a.shivam65838.workers.dev`
- D1 binding: `DB`
- D1 database: `sy-cold-drinks-db`

## Deploy the static site with Cloudflare Pages
Connect this repository to Cloudflare Pages:
- Production branch: `main`
- Build command: leave empty
- Build output directory: `/`

## Important before accepting real orders
The current storefront can read the existing public store, product and category endpoints. Admin UI expects the secure admin endpoints to be deployed to the Worker. Checkout UI expects `POST /api/orders`, which still needs to be implemented and tested in the Worker. Do not accept live customer orders until this is completed.

Product images currently use image URLs; no upload storage is configured.

Never commit passwords, setup tokens or session tokens to this repository. Keep secrets in Cloudflare Worker Secrets.