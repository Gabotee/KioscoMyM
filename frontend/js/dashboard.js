// dashboard.js — Panel principal

(async function init() {
  const user = await requireAuth();
  if (!user) return;

  // Setear nombre de usuario
  document.getElementById('sidebar-username').textContent = user.username;
  document.getElementById('user-avatar').textContent = user.username[0].toUpperCase();

  // Greeting y fecha
  const hour = new Date().getHours();
  const greeting = hour < 12 ? '☀️ Buenos días' : hour < 18 ? '🌤️ Buenas tardes' : '🌙 Buenas noches';
  document.getElementById('greeting').textContent = `${greeting}, ${user.username}`;

  const now = new Date();
  document.getElementById('current-date').textContent = now.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  // Marcar nav activo
  document.getElementById('nav-dashboard').classList.add('active');

  // Cargar todo en paralelo
  try {
    const [stats, recent, lowStock] = await Promise.all([
      api.getStats(),
      api.getRecentMovements(),
      api.getLowStock()
    ]);

    renderStats(stats);
    renderRecentMovements(recent);
    renderLowStock(lowStock);
  } catch (e) {
    showToast('Error al cargar el dashboard', 'error');
  }
})();

function renderStats(stats) {
  document.getElementById('stat-total').textContent = stats.totalProducts;
  document.getElementById('stat-low').textContent = stats.lowStockProducts;
  document.getElementById('stat-ingresos').textContent = stats.todayIngresos;
  document.getElementById('stat-egresos').textContent = stats.todayEgresos;
  document.getElementById('stat-out').textContent = stats.outOfStock;
  document.getElementById('stat-sales').textContent = formatCurrency(stats.todaySalesValue);
}

function renderRecentMovements(movements) {
  const body = document.getElementById('recent-body');

  // Mostrar solo los últimos 5 movimientos
  movements = movements.slice(0, 5);

  if (!movements.length) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-title">Sin movimientos</div>
        <div class="empty-state-text">Aún no hay movimientos registrados hoy</div>
      </div>`;
    return;
  }

  body.innerHTML = `
    <div class="table-wrapper" style="border:none; border-radius:0;">
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Tipo</th>
            <th>Cantidad</th>
            <th>Hora</th>
          </tr>
        </thead>
        <tbody>
          ${movements.map(m => `
            <tr>
              <td>
                <div style="font-weight:500; font-size:13px;">${escHtml(m.product_name)}</div>
                <div style="font-size:11px; color:var(--text-muted); font-family:monospace;">${escHtml(m.product_barcode)}</div>
              </td>
              <td>
                ${m.type === 'ingreso'
      ? '<span class="badge badge-success">Ingreso</span>'
      : '<span class="badge badge-accent">Egreso</span>'}
              </td>
              <td style="font-weight:600;">${m.quantity}</td>
              <td style="font-size:12px; color:var(--text-secondary);">${formatDate(m.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderLowStock(products) {
  const body = document.getElementById('low-stock-body');

  // Mostrar solo los primeros 5 productos con stock crítico
  products = products.slice(0, 5);

  if (!products.length) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-title">Todo en orden</div>
        <div class="empty-state-text">No hay productos con stock crítico</div>
      </div>`;
    return;
  }

  body.innerHTML = `
    <div class="table-wrapper" style="border:none; border-radius:0;">
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => {
    const isOut = p.stock === 0;
    const colorClass = isOut ? 'var(--danger)' : 'var(--warning)';
    return `
            <tr>
              <td>
                <div style="font-weight:500; font-size:13px;">${escHtml(p.name)}</div>
                <div style="font-size:11px; color:var(--text-muted); font-family:monospace;">${escHtml(p.category)} · ${escHtml(p.barcode)}</div>
              </td>
              <td>
                <div style="font-weight:600; color:${colorClass};">${p.stock} unid.</div>
                <div style="font-size:11px; color:var(--text-muted);">Mínimo: ${p.min_stock}</div>
              </td>
            </tr>
          `;
  }).join('')}
        </tbody>
      </table>
    </div>`;
}


function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
