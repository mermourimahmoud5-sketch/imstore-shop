const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'products.json');

app.use(express.json({ limit: '20mb' }));
app.use(express.static(__dirname));

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([
      {
        id: 1,
        name: 'Costume Signature',
        category: 'homme',
        price: 249,
        tag: 'Best seller',
        image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=900&q=80',
        description: 'Coupe structurée et finition impeccable pour un look premium au quotidien.'
      }
    ], null, 2));
  }
}

function readProducts() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeProducts(products) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2));
}

app.get('/api/products', (req, res) => {
  res.json(readProducts());
});

app.post('/api/products', (req, res) => {
  const { name, category, price, tag, image, description, images, isPromotion, sizes, colors } = req.body || {};

  if (!name || !category || !price || !description || !image) {
    return res.status(400).json({ error: 'Tous les champs obligatoires sont requis.' });
  }

  const products = readProducts();
  const newProduct = {
    id: Date.now(),
    name: String(name).trim(),
    category: String(category).trim(),
    price: Number(price),
    tag: String(tag || 'Nouveau').trim(),
    image: String(image),
    description: String(description).trim(),
    images: Array.isArray(images) && images.length ? images : [String(image)],
    sizes: Array.isArray(sizes) ? sizes.map(String) : [],
    colors: Array.isArray(colors) ? colors.map(String) : [],
    isPromotion: Boolean(isPromotion === true || isPromotion === 'true' || isPromotion === 1 || isPromotion === '1')
  };

  products.unshift(newProduct);
  writeProducts(products);
  return res.status(201).json(newProduct);
});

app.delete('/api/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const products = readProducts().filter(product => Number(product.id) !== id);
  writeProducts(products);
  res.json({ success: true, count: products.length });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`IMSTORE server running on http://localhost:${PORT}`);
});
