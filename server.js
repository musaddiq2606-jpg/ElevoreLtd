'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_KEY = process.env.ADMIN_KEY || 'change-me-before-production';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_PATH = path.join(__dirname, 'elevore.db');
const productsSeed = JSON.parse(fs.readFileSync(path.join(__dirname, 'products.json'), 'utf8'));

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    buying_price REAL,
    delivery_cost REAL,
    amazon_fees REAL,
    amazon_ppc REAL DEFAULT 0,
    retail_price REAL,
    profit REAL,
    units_sold INTEGER DEFAULT 0,
    profit_made REAL DEFAULT 0,
    sku TEXT,
    source_url TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    items_json TEXT NOT NULL,
    total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

function categoryFor(name) {
  const n = name.toLowerCase();
  if (n.includes('mug')) return 'Mugs';
  if (n.includes('burner') || n.includes('wax warmer')) return 'Oil Burners';
  if (n.includes('vase')) return 'Vases';
  if (n.includes('trinket') || n.includes('dish')) return 'Trinket Dishes';
  if (n.includes('doormat')) return 'Doormats';
  if (n.includes('mirror') || n.includes('shelf')) return 'Wall Decor';
  if (n.includes('bottle')) return 'Decor';
  return 'Home & Gifts';
}

const insertProduct = db.prepare(`
  INSERT OR IGNORE INTO products
  (name, category, buying_price, delivery_cost, amazon_fees, amazon_ppc, retail_price, profit, units_sold, profit_made, sku, source_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
for (const p of productsSeed.filter(x => x.name)) {
  insertProduct.run(p.name, categoryFor(p.name), p.buyingPrice, p.deliveryCost, p.amazonFees, p.amazonPpc, p.retailPrice, p.profit, p.unitsSold, p.profitMade, p.sku, p.sourceUrl);
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1_000_000) reject(new Error('Request too large'));
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function publicProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    retailPrice: row.retail_price,
    sku: row.sku,
    available: row.active === 1 && row.retail_price != null
  };
}

function serveStatic(req, res, pathname) {
  let requested = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(requested).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) return false;
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  const ext = path.extname(filePath).toLowerCase();
  const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon'};
  res.writeHead(200, {'Content-Type': types[ext] || 'application/octet-stream'});
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    if (req.method === 'GET' && pathname === '/api/health') {
      return json(res, 200, {ok:true, brand:'Elevore LTD'});
    }

    if (req.method === 'GET' && pathname === '/api/products') {
      const q = (url.searchParams.get('q') || '').trim().toLowerCase();
      const category = (url.searchParams.get('category') || '').trim();
      let rows = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY id').all();
      if (q) rows = rows.filter(r => r.name.toLowerCase().includes(q) || (r.sku || '').toLowerCase().includes(q));
      if (category && category !== 'All') rows = rows.filter(r => r.category === category);
      return json(res, 200, rows.map(publicProduct));
    }

    if (req.method === 'GET' && pathname === '/api/categories') {
      const rows = db.prepare('SELECT category, COUNT(*) AS count FROM products WHERE active = 1 GROUP BY category ORDER BY category').all();
      return json(res, 200, rows);
    }

    if (req.method === 'GET' && pathname === '/api/admin/products') {
      if (req.headers['x-admin-key'] !== ADMIN_KEY) return json(res, 401, {error:'Unauthorized'});
      return json(res, 200, db.prepare('SELECT * FROM products ORDER BY id').all());
    }

    if (req.method === 'POST' && pathname === '/api/messages') {
      const b = await readBody(req);
      if (!b.name || !b.email || !b.message) return json(res, 400, {error:'Name, email and message are required.'});
      const result = db.prepare('INSERT INTO messages (name,email,phone,message) VALUES (?,?,?,?)').run(String(b.name).trim(), String(b.email).trim(), String(b.phone || '').trim(), String(b.message).trim());
      return json(res, 201, {ok:true, id:Number(result.lastInsertRowid)});
    }

    if (req.method === 'POST' && pathname === '/api/orders') {
      const b = await readBody(req);
      if (!b.customerName || !b.email || !Array.isArray(b.items) || !b.items.length) return json(res, 400, {error:'Customer name, email and cart items are required.'});
      const getProduct = db.prepare('SELECT id,name,retail_price,active FROM products WHERE id = ?');
      const safeItems = [];
      let total = 0;
      for (const item of b.items) {
        const product = getProduct.get(Number(item.id));
        const qty = Math.max(1, Math.min(99, Number(item.qty) || 1));
        if (!product || !product.active || product.retail_price == null) return json(res, 400, {error:'One or more cart items are unavailable.'});
        total += Number(product.retail_price) * qty;
        safeItems.push({id:product.id,name:product.name,qty,unitPrice:Number(product.retail_price)});
      }
      total = Math.round(total * 100) / 100;
      const result = db.prepare('INSERT INTO orders (customer_name,email,phone,address,items_json,total) VALUES (?,?,?,?,?,?)').run(String(b.customerName).trim(),String(b.email).trim(),String(b.phone || '').trim(),String(b.address || '').trim(),JSON.stringify(safeItems),total);
      return json(res, 201, {ok:true, orderId:Number(result.lastInsertRowid), total});
    }

    if (req.method === 'GET' && pathname === '/api/admin/orders') {
      if (req.headers['x-admin-key'] !== ADMIN_KEY) return json(res, 401, {error:'Unauthorized'});
      return json(res, 200, db.prepare('SELECT * FROM orders ORDER BY id DESC').all());
    }

    if (req.method === 'GET' && pathname === '/api/admin/messages') {
      if (req.headers['x-admin-key'] !== ADMIN_KEY) return json(res, 401, {error:'Unauthorized'});
      return json(res, 200, db.prepare('SELECT * FROM messages ORDER BY id DESC').all());
    }

    if (req.method === 'GET' && serveStatic(req, res, pathname)) return;
    json(res, 404, {error:'Not found'});
  } catch (err) {
    console.error(err);
    json(res, 500, {error:'Server error'});
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Elevore LTD running at http://localhost:${PORT}`);
});
