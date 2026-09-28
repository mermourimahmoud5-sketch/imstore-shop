const express = require('express');
const path = require('path');
const { randomUUID } = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});

app.use(express.json({ limit: '20mb' }));
app.use(express.static(__dirname));

function formatProduct(row) {
  return {
    id: Number(row.id),
    name: row.name,
    productType: row.product_type || 'pret_a_porter',
    stockQuantity: Number(row.stock_quantity || 0),
    discountPercent: Number(row.discount_percent || 0),
    category: row.category,
    price: Number(row.price),
    tag: row.tag,
    image: row.image,
    description: row.description,
    images: row.images,
    sizes: row.sizes,
    colors: row.colors,
    isPromotion: row.is_promotion
  };
}

app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC, id DESC');
    res.json(result.rows.map(formatProduct));
  } catch (error) {
    console.error('Erreur de lecture des produits :', error);
    res.status(500).json({ error: 'Impossible de charger les produits.' });
  }
});

app.post('/api/products', async (req, res) => {
  const { name, productType, stockQuantity, category, price, tag, image, description, images, isPromotion, sizes, colors } = req.body || {};
  const numericPrice = Number(price);
  const numericStock = stockQuantity === undefined ? 0 : Number(stockQuantity);
  const normalizedProductType = productType || 'pret_a_porter';

  if (!name || !category || !Number.isFinite(numericPrice) || numericPrice <= 0 || !description || !image) {
    return res.status(400).json({ error: 'Tous les champs obligatoires sont requis.' });
  }
  if (!['pret_a_porter', 'vierge'].includes(normalizedProductType)) {
    return res.status(400).json({ error: 'Choisissez un type de produit valide.' });
  }
  if (!Number.isInteger(numericStock) || numericStock < 0) {
    return res.status(400).json({ error: 'Le stock doit être un nombre entier positif ou nul.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO products (id, name, product_type, stock_quantity, category, price, tag, image, description, images, sizes, colors, is_promotion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        Date.now(),
        String(name).trim(),
        normalizedProductType,
        numericStock,
        String(category).trim(),
        numericPrice,
        String(tag || 'Nouveau').trim(),
        String(image),
        String(description).trim(),
        JSON.stringify(Array.isArray(images) && images.length ? images : [String(image)]),
        JSON.stringify(Array.isArray(sizes) ? sizes.map(String) : []),
        JSON.stringify(Array.isArray(colors) ? colors.map(String) : []),
        Boolean(isPromotion === true || isPromotion === 'true' || isPromotion === 1 || isPromotion === '1')
      ]
    );
    return res.status(201).json(formatProduct(result.rows[0]));
  } catch (error) {
    console.error('Erreur de sauvegarde du produit :', error);
    return res.status(500).json({ error: 'Impossible d’enregistrer le produit.' });
  }
});

app.patch('/api/products/:id', async (req, res) => {
  const updates = [];
  const values = [];

  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'productType')) {
    if (!['pret_a_porter', 'vierge'].includes(req.body.productType)) {
      return res.status(400).json({ error: 'Choisissez un type de produit valide.' });
    }
    values.push(req.body.productType);
    updates.push(`product_type = $${values.length}`);
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'tag')) {
    if (typeof req.body.tag !== 'string' || req.body.tag.length > 60) {
      return res.status(400).json({ error: 'L’étiquette doit contenir au maximum 60 caractères.' });
    }
    values.push(req.body.tag.trim());
    updates.push(`tag = $${values.length}`);
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'Aucune modification valide à enregistrer.' });
  }

  try {
    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE products SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Produit introuvable.' });
    res.json(formatProduct(result.rows[0]));
  } catch (error) {
    console.error('Erreur de mise à jour du produit :', error);
    res.status(500).json({ error: 'Impossible de modifier le produit.' });
  }
});

app.patch('/api/products/:id/stock', async (req, res) => {
  const stockQuantity = Number(req.body && req.body.stockQuantity);
  if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
    return res.status(400).json({ error: 'Le stock doit être un nombre entier positif ou nul.' });
  }

  try {
    const result = await pool.query(
      'UPDATE products SET stock_quantity = $1 WHERE id = $2 RETURNING *',
      [stockQuantity, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Produit introuvable.' });
    res.json(formatProduct(result.rows[0]));
  } catch (error) {
    console.error('Erreur de mise à jour du stock :', error);
    res.status(500).json({ error: 'Impossible de mettre à jour le stock.' });
  }
});

app.patch('/api/products/:id/discount', async (req, res) => {
  const discountPercent = Number(req.body && req.body.discountPercent);
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    return res.status(400).json({ error: 'La réduction doit être comprise entre 0 et 100 %.' });
  }

  try {
    const result = await pool.query(
      'UPDATE products SET discount_percent = $1 WHERE id = $2 RETURNING *',
      [discountPercent, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Produit introuvable.' });
    res.json(formatProduct(result.rows[0]));
  } catch (error) {
    console.error('Erreur de mise à jour de la réduction :', error);
    res.status(500).json({ error: 'Impossible de mettre à jour la réduction.' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ success: true, count: result.rowCount });
  } catch (error) {
    console.error('Erreur de suppression du produit :', error);
    res.status(500).json({ error: 'Impossible de supprimer le produit.' });
  }
});

app.post('/api/designs', async (req, res) => {
  const dataUrl = req.body && req.body.imageData;
  const match = typeof dataUrl === 'string'
    ? dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/)
    : null;

  if (!match) {
    return res.status(400).json({ error: 'Choisissez une image PNG, JPG ou WebP valide.' });
  }

  const imageBuffer = Buffer.from(match[2], 'base64');
  if (!imageBuffer.length || imageBuffer.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'La photo doit faire moins de 5 Mo.' });
  }

  const id = randomUUID();
  try {
    await pool.query(
      'INSERT INTO design_uploads (id, content_type, image_data) VALUES ($1, $2, $3)',
      [id, match[1], imageBuffer]
    );
    res.status(201).json({ url: `/api/designs/${id}` });
  } catch (error) {
    console.error('Erreur de sauvegarde du design :', error);
    res.status(500).json({ error: 'Impossible d’enregistrer la photo du design.' });
  }
});

app.get('/api/designs/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT content_type, image_data FROM design_uploads WHERE id = $1',
      [req.params.id]
    );
    if (!result.rowCount) return res.status(404).send('Design introuvable.');

    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'private, max-age=3600');
    res.type(result.rows[0].content_type).send(result.rows[0].image_data);
  } catch (error) {
    console.error('Erreur de lecture du design :', error);
    res.status(500).send('Impossible de charger le design.');
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

async function startServer() {
  if (!process.env.DATABASE_URL) {
    throw new Error('La variable DATABASE_URL doit être configurée.');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id BIGINT PRIMARY KEY,
      name TEXT NOT NULL,
      product_type TEXT NOT NULL DEFAULT 'pret_a_porter',
      stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
      discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
      category TEXT NOT NULL,
      price NUMERIC(12, 2) NOT NULL,
      tag TEXT NOT NULL,
      image TEXT NOT NULL,
      description TEXT NOT NULL,
      images JSONB NOT NULL DEFAULT '[]'::jsonb,
      sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
      colors JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_promotion BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'pret_a_porter'
  `);

  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0
  `);

  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS design_uploads (
      id UUID PRIMARY KEY,
      content_type TEXT NOT NULL,
      image_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  app.listen(PORT, () => {
    console.log(`IMSTORE server running on http://localhost:${PORT}`);
  });
}

startServer().catch(error => {
  console.error('Impossible de démarrer IMSTORE :', error);
  process.exit(1);
});
