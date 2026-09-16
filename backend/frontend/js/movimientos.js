// movimientos.js — Historial de movimientos

(async function init() {
  const user = await requireAuth();
  if (!user) return;

  document.getElementById('sidebar-username').textContent = user.username;
  document.getElementById('user-avatar').textContent = user.username[0].toUpperCase();

  // Setear fecha de hoy por defecto en filtros
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('filter-date-from').value = today;
  document.getElementById('filter-date-to').value = today;

  await loadHistory();
})();

async function loadHistory() {
  const historyBody = document.getElementById('history-body');
  historyBody.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  const params = {};
  const filterType = document.getElementById('filter-type').value;
  const dateFrom = document.getElementById('filter-date-from').value;
  const dateTo = document.getElementById('filter-date-to').value;

  if (filterType) params.type = filterType;
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;
  params.limit = 100;

  try {
    const movements = await api.getMovements(params);
    document.getElementById('history-count').textContent = `${movements.length} resultado(s)`;
    renderHistory(movements);
  } catch (e) {
    historyBody.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-text">${e.message}</div></div>`;
  }
}

function renderHistory(movements) {
  const body = document.getElementById('history-body');

  if (!movements.length) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-title">Sin movimientos</div>
        <div class="empty-state-text">No hay movimientos con ese criterio</div>
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
            <th>Cant.</th>
            <th>Precio Unit.</th>
            <th>Recargo</th>
            <th>Total</th>
            <th>Fecha</th>
            <th>Notas</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${movements.map(m => `
            <tr>
              <td>
                <div style="font-weight:500; font-size:13px;">${esc(m.product_name)}</div>
                <div style="font-size:11px; color:var(--text-muted); font-family:monospace;">${esc(m.product_barcode)}</div>
              </td>
              <td>
                ${m.type === 'ingreso'
      ? '<span class="badge badge-success">Ingreso</span>'
      : '<span class="badge badge-accent">Egreso</span>'}
              </td>
              <td style="font-weight:700; font-size:15px;">${m.quantity}</td>
              <td style="font-family:monospace; color:var(--text-primary)">${formatCurrency(m.price)}</td>
              <td style="font-family:monospace; color:${parseFloat(m.surcharge || 0) > 0 ? '#f0b429' : 'var(--text-muted)'}; font-size:13px;">${parseFloat(m.surcharge || 0) > 0 ? '+' + formatCurrency(parseFloat(m.surcharge)) : '—'}</td>
              <td style="font-family:monospace; font-weight:700; font-size:14px; color:var(--text-primary)">${formatCurrency((m.quantity || 0) * (parseFloat(m.price || 0) + parseFloat(m.surcharge || 0)))}</td>
              <td style="font-size:12px; color:var(--text-secondary); white-space:nowrap">${formatDate(m.created_at)}</td>
              <td style="font-size:12px; color:var(--text-secondary)">${esc(m.notes || '—')}</td>
              <td>
                <button
                  class="btn btn-danger btn-icon-sm"
                  title="Reversar movimiento"
                  data-action="reverse"
                  data-id="${m.id}"
                  data-name="${esc(m.product_name)}"
                  data-qty="${m.quantity}"
                  data-type="${m.type}"
                >↩</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

async function reverseMovement(id, productName, qty, type) {
  const action = type === 'ingreso' ? 'el ingreso' : 'la venta';
  if (!confirm(`¿Reversar ${action} de ${qty} unidad(es) de "${productName}"?\n\nEsto actualizará el stock automáticamente.`)) return;

  try {
    await api.deleteMovement(id);
    showToast(`↩️ Movimiento reversado correctamente`, 'success');
    await loadHistory();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Listeners de botones estáticos
document.addEventListener('DOMContentLoaded', function () {
  const btnFiltrar = document.getElementById('btn-filtrar');
  if (btnFiltrar) btnFiltrar.addEventListener('click', loadHistory);
});

// Event delegation para botones de reversar (generados dinámicamente)
document.getElementById('history-body').addEventListener('click', function (e) {
  const btn = e.target.closest('[data-action="reverse"]');
  if (!btn) return;
  const id = parseInt(btn.dataset.id);
  const name = btn.dataset.name;
  const qty = parseInt(btn.dataset.qty);
  const type = btn.dataset.type;
  reverseMovement(id, name, qty, type);
});
