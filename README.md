# SY Market

Responsive multi-category storefront and admin dashboard for SY Market, Jandaha, Vaishali, Bihar.

## Files
- `index.html` — customer storefront
- `styles.css` — responsive design
- `app.js` — product catalogue, cart and checkout UI
- `admin.html` — admin sign-in and product dashboard
- `admin.js` — admin authentication and product management UI

## Cloudflare deployment

This project uses only Cloudflare Pages, Workers and D1. Run these commands after logging in with Wrangler:

```sh
npx wrangler d1 migrations apply sy-cold-drinks-db --remote
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ADMIN_SETUP_TOKEN
npx wrangler deploy
```

Set `ALLOWED_ORIGIN` in `wrangler.toml` to the final Pages/custom-domain URL and deploy again. Connect this GitHub repository in Cloudflare Pages with production branch `main`, no build command, and `/` as the output directory. The Worker URL in `app.js` and `admin.js` is `https://sy-cold-drink.shivam65838.workers.dev`; update it if your Cloudflare account assigns a different URL.

Then open `/admin.html`, use the one-time setup token to create the first admin, and immediately delete `ADMIN_SETUP_TOKEN` from Worker secrets.

## Deploy the static site with Cloudflare Pages
Connect this repository to Cloudflare Pages:
- Production branch: `main`
- Build command: leave empty
- Build output directory: `/`

## Included capabilities

- Customer storefront, cart, stock-aware Cash-on-Delivery checkout and duplicate-submit protection
- Admin authentication, products, categories, orders/statuses and store settings
- D1 migration with schema, relationships, indexes and safe seed settings
- Worker-side validation, password hashing, signed short-lived admin tokens, origin allow-list support and parameterized SQL

Product images currently use image URLs; no upload storage is configured.

Never commit passwords, setup tokens or session tokens to this repository. Keep secrets in Cloudflare Worker Secrets.

