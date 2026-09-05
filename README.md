# Elevore LTD Store

A complete responsive storefront with a built-in Node.js + SQLite backend.

## Included

- Elevore LTD branded responsive storefront
- 23 named products imported from `Products.xlsx`
- Product search and category filters
- Shopping cart saved in the browser
- Order-enquiry checkout (saved to SQLite)
- Contact form (saved to SQLite)
- Public API that hides internal buying cost / fee / profit fields
- Admin API for internal product, order and message data
- Owner/contact information:
  - Muhammad Musaddiq Arbi
  - +92 322 2934631
  - musaddiq2606@gmail.com

## Run locally

Requires **Node.js 22.5+** (the project uses Node's built-in SQLite module).

```bash
cd elevore-ltd-store
node server.js
```

Then open: `http://localhost:3000`

No `npm install` is required.

## Admin API

Set a secure admin key before production:

**macOS/Linux**
```bash
ADMIN_KEY="your-long-secret" node server.js
```

**Windows PowerShell**
```powershell
$env:ADMIN_KEY="your-long-secret"
node server.js
```

Protected endpoints use the `x-admin-key` header:

- `GET /api/admin/products`
- `GET /api/admin/orders`
- `GET /api/admin/messages`

The fallback development key is `change-me-before-production`; do not use it in production.

## Public API

- `GET /api/health`
- `GET /api/products`
- `GET /api/products?q=mug`
- `GET /api/products?category=Mugs`
- `GET /api/categories`
- `POST /api/messages`
- `POST /api/orders`

## Important product-data note

The workbook contains one named product (`Fresh Cup of Cawfee Raven Mug`) without a retail price or SKU. It is imported into the database but shown as **Price on request** and cannot be added to cart until a retail price is provided.

Product artwork is intentionally abstract because the workbook did not contain product image files. You can replace the generated card artwork with your real product photos later without changing the backend data model.
