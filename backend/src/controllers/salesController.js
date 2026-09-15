const { getDb } = require('../config/database');

// POST /api/sales
exports.createSale = async (req, res) => {
  const { items, payment_method } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El carrito está vacío' });
  }

  if (!['efectivo', 'transferencia', 'qr'].includes(payment_method)) {
    return res.status(400).json({ error: 'Método de pago inválido' });
  }

  const db = getDb();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    let totalAmount = 0;
    let totalSurcharge = 0;

    // 1. Validar stock e inventario de todos los productos primero
    const productsToUpdate = [];
    for (const item of items) {
      const { product_id, quantity } = item;
      const qty = parseInt(quantity);

      if (isNaN(qty) || qty <= 0) {
        throw new Error('Cantidad inválida para uno de los productos');
      }

      const [productRows] = await conn.query(
        'SELECT * FROM products WHERE id = ? FOR UPDATE',
        [product_id]
      );
      const product = productRows[0];

      if (!product) {
        throw new Error(`Producto ID ${product_id} no encontrado`);
      }

      if (product.stock < qty) {
        throw new Error(`Stock insuficiente para "${product.name}". Stock actual: ${product.stock}, solicitado: ${qty}`);
      }

      const lineTotal = product.sell_price * qty;

      // Calcular recargo según método de pago
      let surchargePct = 0;
      if (payment_method === 'transferencia') {
        surchargePct = parseFloat(product.transfer_surcharge) || 0;
      } else if (payment_method === 'qr') {
        surchargePct = parseFloat(product.qr_surcharge) || 0;
      }
      const lineSurcharge = lineTotal * (surchargePct / 100);

      totalAmount += lineTotal + lineSurcharge;
      totalSurcharge += lineSurcharge;

      // Recargo por unidad (para guardar en movimiento)
      const surchargePerUnit = product.sell_price * (surchargePct / 100);

      productsToUpdate.push({
        product_id,
        quantity: qty,
        price: product.sell_price,
        surchargePerUnit,
        surcharge_pct: surchargePct,
        lineSurcharge,
        productName: product.name
      });
    }

    // 2. Insertar Venta
    const [saleResult] = await conn.query(
      'INSERT INTO sales (total_amount, payment_method, surcharge_amount, user_id) VALUES (?, ?, ?, ?)',
      [totalAmount, payment_method, totalSurcharge, req.user.id]
    );
    const saleId = saleResult.insertId;

    // 3. Insertar items, actualizar stock y registrar movimientos
    for (const p of productsToUpdate) {
      // Insertar item de venta
      await conn.query(
        'INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [saleId, p.product_id, p.quantity, p.price]
      );

      // Descontar stock
      await conn.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [p.quantity, p.product_id]
      );

      // Registrar movimiento (price = precio base, surcharge = recargo por unidad)
      let surchargeNote = '';
      if (p.surcharge_pct > 0) {
        surchargeNote = payment_method === 'qr' ? ` (+${p.surcharge_pct}% QR)` : ` (+${p.surcharge_pct}% transf.)`;
      }
      await conn.query(
        'INSERT INTO movements (product_id, type, quantity, price, surcharge, notes, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [p.product_id, 'egreso', p.quantity, p.price, p.surchargePerUnit, `Venta #${saleId} - ${payment_method}${surchargeNote}`, req.user.id]
      );
    }

    await conn.commit();
    conn.release();

    res.status(201).json({
      message: 'Venta registrada correctamente',
      saleId,
      total: totalAmount,
      surcharge: totalSurcharge
    });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('Error registrando venta:', err.message);
    res.status(400).json({ error: err.message });
  }
};
