const { getDb } = require('../config/database');

// GET /api/products
exports.getAll = async (req, res) => {
  const db = getDb();
  const { search, category, lowStock } = req.query;

  let query = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (name LIKE ? OR barcode LIKE ? OR category LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (lowStock === 'true') {
    query += ' AND stock <= min_stock';
  }
  query += ' ORDER BY name ASC';

  try {
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Error getAll products:', err.message);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

// GET /api/products/categories
exports.getCategories = async (req, res) => {
  const db = getDb();
  try {
    const [rows] = await db.query('SELECT DISTINCT category FROM products ORDER BY category');
    res.json(rows.map(r => r.category));
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};

// GET /api/products/barcode/:barcode
exports.getByBarcode = async (req, res) => {
  const db = getDb();
  try {
    const [rows] = await db.query('SELECT * FROM products WHERE barcode = ?', [req.params.barcode]);
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al buscar el producto' });
  }
};

// GET /api/products/:id
exports.getById = async (req, res) => {
  const db = getDb();
  try {
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al buscar el producto' });
  }
};

// POST /api/products
exports.create = async (req, res) => {
  const { barcode, name, marca, category, buy_price, sell_price, stock, min_stock, transfer_surcharge, qr_surcharge } = req.body;

  if (!barcode || !name) {
    return res.status(400).json({ error: 'Código de barras y nombre son requeridos' });
  }

  const db = getDb();
  try {
    // Verificar duplicado de código de barras
    const [existing] = await db.query('SELECT id FROM products WHERE barcode = ?', [barcode.trim()]);
    if (existing.length) {
      return res.status(409).json({ error: 'Ya existe un producto con ese código de barras' });
    }

    const [result] = await db.query(
      `INSERT INTO products (barcode, name, marca, category, buy_price, sell_price, stock, min_stock, transfer_surcharge, qr_surcharge)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        barcode.trim(),
        name.trim(),
        (marca || '').trim(),
        category || 'General',
        parseFloat(buy_price) || 0,
        parseFloat(sell_price) || 0,
        parseInt(stock) || 0,
        parseInt(min_stock) || 5,
        parseFloat(transfer_surcharge) || 0,
        parseFloat(qr_surcharge) || 0
      ]
    );

    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);

  } catch (err) {
    console.error('Error creando producto:', err.message);
    res.status(500).json({ error: 'Error al crear el producto' });
  }
};

// PUT /api/products/:id
exports.update = async (req, res) => {
  const { barcode, name, marca, category, buy_price, sell_price, stock, min_stock, transfer_surcharge, qr_surcharge } = req.body;
  const { id } = req.params;

  if (!barcode || !name) {
    return res.status(400).json({ error: 'Código de barras y nombre son requeridos' });
  }

  const db = getDb();
  try {
    const [existing] = await db.query('SELECT id FROM products WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Producto no encontrado' });

    const [conflict] = await db.query(
      'SELECT id FROM products WHERE barcode = ? AND id != ?',
      [barcode.trim(), id]
    );
    if (conflict.length) {
      return res.status(409).json({ error: 'Ese código de barras ya está en uso por otro producto' });
    }

    await db.query(
      `UPDATE products
       SET barcode = ?, name = ?, marca = ?, category = ?, buy_price = ?, sell_price = ?, stock = ?, min_stock = ?, transfer_surcharge = ?, qr_surcharge = ?
       WHERE id = ?`,
      [
        barcode.trim(),
        name.trim(),
        (marca || '').trim(),
        category || 'General',
        parseFloat(buy_price) || 0,
        parseFloat(sell_price) || 0,
        parseInt(stock) || 0,
        parseInt(min_stock) || 5,
        parseFloat(transfer_surcharge) || 0,
        parseFloat(qr_surcharge) || 0,
        id
      ]
    );

    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    res.json(rows[0]);

  } catch (err) {
    console.error('Error actualizando producto:', err.message);
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
};

// DELETE /api/products/:id
exports.remove = async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  try {
    const [existing] = await db.query('SELECT id FROM products WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Producto no encontrado' });

    const [movCount] = await db.query(
      'SELECT COUNT(*) as count FROM movements WHERE product_id = ?',
      [id]
    );
    if (movCount[0].count > 0) {
      return res.status(409).json({
        error: `No se puede eliminar. El producto tiene ${movCount[0].count} movimiento(s) registrado(s)`
      });
    }

    await db.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: 'Producto eliminado correctamente' });

  } catch (err) {
    console.error('Error eliminando producto:', err.message);
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
};
