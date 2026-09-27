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
  const { name, category, price, tag, image, description, images, isPromotion, sizes, colors } = req.body || {};
  const numericPrice = Number(price);

  if (!name || !category || !Number.isFinite(numericPrice) || numericPrice <= 0 || !description || !image) {
    return res.status(400).json({ error: 'Tous les champs obligatoires sont requis.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO products (id, name, category, price, tag, image, description, images, sizes, colors, is_promotion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        Date.now(),
        String(name).trim(),
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
