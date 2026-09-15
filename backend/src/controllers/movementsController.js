const { getDb } = require('../config/database');

// GET /api/movements
exports.getAll = async (req, res) => {
  const db = getDb();
  const { type, product_id, dateFrom, dateTo, limit = 50 } = req.query;

  let query = `
    SELECT m.*, p.name AS product_name, p.barcode AS product_barcode, p.category AS product_category
    FROM movements m
    JOIN products p ON m.product_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (type)       { query += ' AND m.type = ?';              params.push(type); }
  if (product_id) { query += ' AND m.product_id = ?';        params.push(product_id); }
  if (dateFrom)   { query += ' AND DATE(m.created_at) >= ?'; params.push(dateFrom); }
  if (dateTo)     { query += ' AND DATE(m.created_at) <= ?'; params.push(dateTo); }

  query += ' ORDER BY m.created_at DESC LIMIT ?';
  const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 500);
  params.push(safeLimit);

  try {
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Error getAll movements:', err.message);
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
};

// POST /api/movements
exports.create = async (req, res) => {
  const { product_id, type, quantity, price, notes } = req.body;

  if (!product_id || !type || !quantity) {
    return res.status(400).json({ error: 'Producto, tipo y cantidad son requeridos' });
  }
  if (!['ingreso', 'egreso'].includes(type)) {
    return res.status(400).json({ error: 'Tipo debe ser "ingreso" o "egreso"' });
  }

  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: 'La cantidad debe ser un número positivo' });
  }

  const db = getDb();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // Obtener producto y bloquearlo para escritura
    const [productRows] = await conn.query(
      'SELECT * FROM products WHERE id = ? FOR UPDATE',
      [product_id]
    );
    const product = productRows[0];

    if (!product) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Validar stock para egreso
    if (type === 'egreso' && product.stock < qty) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        error: `Stock insuficiente. Stock actual: ${product.stock}, solicitado: ${qty}`
      });
    }

    // Precio: usar el del body si viene, sino el del producto
    const movPrice = price !== undefined
      ? parseFloat(price)
      : (type === 'egreso' ? product.sell_price : product.buy_price);

    // Insertar movimiento
    const [result] = await conn.query(
      'INSERT INTO movements (product_id, type, quantity, price, notes, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [product_id, type, qty, movPrice, notes || null, req.user.id]
    );

    // Actualizar stock
    const stockChange = type === 'ingreso' ? qty : -qty;
    await conn.query(
      'UPDATE products SET stock = stock + ? WHERE id = ?',
      [stockChange, product_id]
    );

    await conn.commit();
    conn.release();

    // Devolver el movimiento completo y el nuevo stock
    const [movRows] = await db.query(
      `SELECT m.*, p.name AS product_name, p.barcode AS product_barcode
       FROM movements m
       JOIN products p ON m.product_id = p.id
       WHERE m.id = ?`,
      [result.insertId]
    );
    const [[{ stock: newStock }]] = await db.query(
      'SELECT stock FROM products WHERE id = ?',
      [product_id]
    );

    res.status(201).json({ movement: movRows[0], newStock });

  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('Error creando movimiento:', err.message);
    res.status(500).json({ error: 'Error al registrar el movimiento' });
  }
};

// DELETE /api/movements/:id (reversar movimiento)
exports.remove = async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [movRows] = await conn.query('SELECT * FROM movements WHERE id = ?', [id]);
    if (!movRows.length) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'Movimiento no encontrado' });
    }

    const movement = movRows[0];

    const [productRows] = await conn.query(
      'SELECT stock FROM products WHERE id = ? FOR UPDATE',
      [movement.product_id]
    );
    const product = productRows[0];

    // Si fue un ingreso, al revertirlo el stock baja — verificar que haya stock suficiente
    if (movement.type === 'ingreso' && product.stock < movement.quantity) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        error: 'No se puede reversar. El stock actual es menor a la cantidad del movimiento'
      });
    }

    const revert = movement.type === 'ingreso' ? -movement.quantity : movement.quantity;

    await conn.query('DELETE FROM movements WHERE id = ?', [id]);
    await conn.query(
      'UPDATE products SET stock = stock + ? WHERE id = ?',
      [revert, movement.product_id]
    );

    await conn.commit();
    conn.release();
    res.json({ message: 'Movimiento reversado correctamente' });

  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('Error reversando movimiento:', err.message);
    res.status(500).json({ error: 'Error al reversar el movimiento' });
  }
};
