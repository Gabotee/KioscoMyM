const { getDb } = require('../config/database');

// GET /api/dashboard/stats
exports.getStats = async (req, res) => {
  const db = getDb();
  try {
    const [[{ totalProducts }]] = await db.query(
      'SELECT COUNT(*) AS totalProducts FROM products'
    );
    const [[{ lowStockProducts }]] = await db.query(
      'SELECT COUNT(*) AS lowStockProducts FROM products WHERE stock <= min_stock'
    );
    const [[{ outOfStock }]] = await db.query(
      'SELECT COUNT(*) AS outOfStock FROM products WHERE stock = 0'
    );
    const [[{ todayMovements }]] = await db.query(
      "SELECT COUNT(*) AS todayMovements FROM movements WHERE DATE(created_at) = CURDATE()"
    );
    const [[{ todayIngresos }]] = await db.query(
      "SELECT COALESCE(SUM(quantity), 0) AS todayIngresos FROM movements WHERE type = 'ingreso' AND DATE(created_at) = CURDATE()"
    );
    const [[{ todayEgresos }]] = await db.query(
      "SELECT COALESCE(SUM(quantity), 0) AS todayEgresos FROM movements WHERE type = 'egreso' AND DATE(created_at) = CURDATE()"
    );
    const [[{ todaySalesValue }]] = await db.query(
      "SELECT COALESCE(SUM(quantity * price), 0) AS todaySalesValue FROM movements WHERE type = 'egreso' AND DATE(created_at) = CURDATE()"
    );

    res.json({
      totalProducts,
      lowStockProducts,
      outOfStock,
      todayMovements,
      todayIngresos,
      todayEgresos,
      todaySalesValue
    });
  } catch (err) {
    console.error('Error getStats:', err.message);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};

// GET /api/dashboard/recent-movements
exports.getRecentMovements = async (req, res) => {
  const db = getDb();
  try {
    const [rows] = await db.query(`
      SELECT m.id, m.type, m.quantity, m.price, m.created_at,
             p.name AS product_name, p.barcode AS product_barcode
      FROM movements m
      JOIN products p ON m.product_id = p.id
      ORDER BY m.created_at DESC
      LIMIT 10
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error getRecentMovements:', err.message);
    res.status(500).json({ error: 'Error al obtener movimientos recientes' });
  }
};

// GET /api/dashboard/low-stock
exports.getLowStock = async (req, res) => {
  const db = getDb();
  try {
    const [rows] = await db.query(`
      SELECT * FROM products
      WHERE stock <= min_stock
      ORDER BY (stock - min_stock) ASC
      LIMIT 10
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error getLowStock:', err.message);
    res.status(500).json({ error: 'Error al obtener stock crítico' });
  }
};

// GET /api/dashboard/movements-chart
exports.getMovementsChart = async (req, res) => {
  const db = getDb();
  try {
    const [rows] = await db.query(`
      SELECT
        DATE(created_at)  AS date,
        type,
        COUNT(*)          AS count,
        SUM(quantity)     AS total_quantity
      FROM movements
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at), type
      ORDER BY date ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error getMovementsChart:', err.message);
    res.status(500).json({ error: 'Error al obtener datos del gráfico' });
  }
};
