// stock.js — Gestión de productos

let allProducts = [];
let editingId = null;
let deletingId = null;

(async function init() {
  const user = await requireAuth();
  if (!user) return;

  document.getElementById('sidebar-username').textContent = user.username;
  document.getElementById('user-avatar').textContent = user.username[0].toUpperCase();

  // Filtros con debounce
  let searchTimeout;
  document.getElementById('search-input').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(applyFilters, 300);
  });
  document.getElementById('category-filter').addEventListener('change', applyFilters);
  document.getElementById('low-stock-filter').addEventListener('change', applyFilters);

  // Verificar si venimos de un filtro de stock bajo o agregar producto
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('filter') === 'lowStock') {
    document.getElementById('low-stock-filter').checked = true;
  }

  await loadCategories();
  await loadProducts();

  const addBarcode = urlParams.get('add');
  if (addBarcode) {
    openModal(null, addBarcode);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Preview precio de venta en tiempo real
  function updateSellPreview() {
    const buy = parseFloat(document.getElementById('f-buy-price').value) || 0;
    const pct = parseFloat(document.getElementById('f-profit-pct').value) || 0;
    const sell = buy * (1 + pct / 100);
    document.getElementById('sell-price-preview').textContent =
      `Precio de venta: $${sell.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  document.getElementById('f-buy-price').addEventListener('input', updateSellPreview);
  document.getElementById('f-profit-pct').addEventListener('input', updateSellPreview);
})();

async function loadProducts() {
  try {
    allProducts = await api.getProducts();
    applyFilters();
    document.getElementById('product-count').textContent = `${allProducts.length} producto(s) registrado(s)`;
  } catch (e) {
    showToast('Error al cargar los productos', 'error');
    document.getElementById('table-wrapper').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">❌</div>
        <div class="empty-state-title">Error al cargar</div>
        <div class="empty-state-text">${e.message}</div>
      </div>`;
  }
}

async function loadCategories() {
  try {
    const cats = await api.getCategories();
    const sel = document.getElementById('category-filter');
    const datalist = document.getElementById('cat-list');
    cats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      sel.appendChild(opt.cloneNode(true));
      datalist.appendChild(opt);
    });
  } catch (e) { /* silencioso */ }
}

function applyFilters() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const category = document.getElementById('category-filter').value;
  const lowStock = document.getElementById('low-stock-filter').checked;

  let filtered = allProducts.filter(p => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search) ||
      p.barcode.toLowerCase().includes(search) ||
      (p.category || '').toLowerCase().includes(search);
    const matchCat = !category || p.category === category;
    const matchLow = !lowStock || p.stock <= p.min_stock;
    return matchSearch && matchCat && matchLow;
  });

  renderTable(filtered);
}

function renderTable(products) {
  const wrapper = document.getElementById('table-wrapper');

  if (!products.length) {
    wrapper.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <div class="empty-state-title">Sin productos</div>
        <div class="empty-state-text">No se encontraron productos con ese criterio</div>
      </div>`;
    return;
  }

  wrapper.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Cod.</th>
          <th>Nombre</th>
          <th>Marca</th>
          <th>Categoría</th>
          <th>$ Lista</th>
          <th>$ Venta</th>
          <th>% Transf.</th>
          <th>% QR</th>
          <th>Stock</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${products.map(p => `
          <tr>
            <td class="barcode-field" style="font-size:12px; color:var(--text-muted);">${esc(p.barcode)}</td>
            <td>
              <div class="product-name-cell">${esc(p.name)}</div>
            </td>
            <td>${esc(p.marca || '—')}</td>
            <td><span class="badge badge-info">${esc(p.category || 'General')}</span></td>
            <td class="price-cell">${formatCurrency(p.buy_price)}</td>
            <td class="price-cell">${formatCurrency(p.sell_price)}</td>
            <td style="text-align:center;">${(parseFloat(p.transfer_surcharge) || 0) > 0
      ? `<span class="badge badge-transfer">${parseFloat(p.transfer_surcharge)}%</span>`
      : `<span style="color:var(--text-muted); font-size:12px;">—</span>`
    }</td>
            <td style="text-align:center;">${(parseFloat(p.qr_surcharge) || 0) > 0
      ? `<span class="badge badge-qr">${parseFloat(p.qr_surcharge)}%</span>`
      : `<span style="color:var(--text-muted); font-size:12px;">—</span>`
    }</td>
            <td>${getStockBadge(p.stock, p.min_stock)}</td>
            <td>
              <div class="actions-cell">
                <button class="btn btn-secondary btn-icon-sm" title="Editar" onclick="openModal(${p.id})">✏️</button>
                <button class="btn btn-danger btn-icon-sm" title="Eliminar" onclick="openDeleteModal(${p.id}, '${esc(p.name)}')">🗑️</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

// === Modal Crear/Editar ===
async function openModal(id = null, defaultBarcode = null) {
  editingId = id;
  document.getElementById('modal-error').classList.add('hidden');
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-title').textContent = id ? 'Editar producto' : 'Nuevo producto';
  document.getElementById('save-text').textContent = id ? 'Guardar cambios' : 'Guardar producto';

  if (id) {
    // Cargar datos del producto
    try {
      const p = allProducts.find(x => x.id === id);
      if (p) fillForm(p);
    } catch (e) {
      showToast('Error al cargar el producto', 'error');
    }
  } else {
    clearForm();
    if (defaultBarcode) {
      document.getElementById('f-barcode').value = defaultBarcode;
    }
    setTimeout(() => document.getElementById('f-barcode').focus(), 100);
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  editingId = null;
  clearForm();
}

function fillForm(p) {
  document.getElementById('f-barcode').value = p.barcode;
  document.getElementById('f-name').value = p.name;
  document.getElementById('f-marca').value = p.marca || '';
  document.getElementById('f-category').value = p.category || '';
  document.getElementById('f-stock').value = p.stock;
  document.getElementById('f-buy-price').value = p.buy_price;
  // Calcular porcentaje de ganancia inverso
  const pct = p.buy_price > 0 ? Math.round(((p.sell_price - p.buy_price) / p.buy_price) * 100) : 0;
  document.getElementById('f-profit-pct').value = pct;
  document.getElementById('f-min-stock').value = p.min_stock;
  document.getElementById('f-transfer-surcharge').value = parseFloat(p.transfer_surcharge) || 0;
  document.getElementById('f-qr-surcharge').value = parseFloat(p.qr_surcharge) || 0;
  // Actualizar preview
  const sell = p.buy_price * (1 + pct / 100);
  document.getElementById('sell-price-preview').textContent =
    `Precio de venta: $${sell.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function clearForm() {
  ['f-barcode', 'f-name', 'f-marca', 'f-category'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-stock').value = '0';
  document.getElementById('f-buy-price').value = '0';
  document.getElementById('f-profit-pct').value = '0';
  document.getElementById('f-min-stock').value = '5';
  document.getElementById('f-transfer-surcharge').value = '0';
  document.getElementById('f-qr-surcharge').value = '0';
  document.getElementById('sell-price-preview').textContent = 'Precio de venta: $0.00';
}

async function saveProduct() {
  const errEl = document.getElementById('modal-error');
  errEl.classList.add('hidden');

  const buyPrice = parseFloat(document.getElementById('f-buy-price').value) || 0;
  const profitPct = parseFloat(document.getElementById('f-profit-pct').value) || 0;
  const sellPrice = buyPrice * (1 + profitPct / 100);

  const data = {
    barcode: document.getElementById('f-barcode').value.trim(),
    name: document.getElementById('f-name').value.trim(),
    marca: document.getElementById('f-marca').value.trim(),
    category: document.getElementById('f-category').value.trim() || 'General',
    stock: parseInt(document.getElementById('f-stock').value) || 0,
    buy_price: buyPrice,
    sell_price: parseFloat(sellPrice.toFixed(2)),
    min_stock: parseInt(document.getElementById('f-min-stock').value) || 5,
    transfer_surcharge: parseFloat(document.getElementById('f-transfer-surcharge').value) || 0,
    qr_surcharge: parseFloat(document.getElementById('f-qr-surcharge').value) || 0,
  };

  if (!data.barcode) {
    errEl.textContent = 'El código de barras es obligatorio';
    errEl.classList.remove('hidden');
    document.getElementById('f-barcode').focus();
    return;
  }

  if (!data.name) {
    errEl.textContent = 'El nombre del producto es obligatorio';
    errEl.classList.remove('hidden');
    document.getElementById('f-name').focus();
    return;
  }

  const saveBtn = document.getElementById('btn-save');
  const spinner = document.getElementById('save-spinner');
  const saveText = document.getElementById('save-text');
  saveBtn.disabled = true;
  spinner.classList.remove('hidden');

  try {
    if (editingId) {
      await api.updateProduct(editingId, data);
      showToast('Producto actualizado correctamente', 'success');
    } else {
      await api.createProduct(data);
      showToast('Producto creado correctamente', 'success');
    }
    closeModal();
    await loadProducts();
    await loadCategories();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
  } finally {
    saveBtn.disabled = false;
    spinner.classList.add('hidden');
  }
}

// === Modal Eliminar ===
function openDeleteModal(id, name) {
  deletingId = id;
  document.getElementById('delete-name').textContent = name;
  document.getElementById('delete-overlay').classList.remove('hidden');
}

function closeDeleteModal() {
  document.getElementById('delete-overlay').classList.add('hidden');
  deletingId = null;
}

async function confirmDelete() {
  const btn = document.getElementById('btn-confirm-delete');
  btn.disabled = true;
  btn.textContent = 'Eliminando...';

  try {
    await api.deleteProduct(deletingId);
    showToast('Producto eliminado correctamente', 'success');
    closeDeleteModal();
    await loadProducts();
  } catch (e) {
    showToast(e.message, 'error');
    closeDeleteModal();
  } finally {
    btn.disabled = false;
    btn.textContent = '🗑️ Eliminar';
  }
}

// Cerrar modales con Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!document.getElementById('modal-overlay').classList.contains('hidden')) closeModal();
    if (!document.getElementById('delete-overlay').classList.contains('hidden')) closeDeleteModal();
    if (!document.getElementById('ingreso-overlay').classList.contains('hidden')) closeIngresoModal();
    if (!document.getElementById('camera-overlay').classList.contains('hidden')) closeCameraScanner();
  }
});

// Cerrar modal clickeando fuera
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});
document.getElementById('delete-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('delete-overlay')) closeDeleteModal();
});
document.getElementById('ingreso-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('ingreso-overlay')) closeIngresoModal();
});
document.getElementById('camera-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('camera-overlay')) closeCameraScanner();
});

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// === Modal Ingreso ===
let ingCurrentProduct = null;
let ingBarcodeTimeout = null;

function openIngresoModal() {
  ingCurrentProduct = null;
  document.getElementById('ingreso-overlay').classList.remove('hidden');
  document.getElementById('ing-error').classList.add('hidden');
  document.getElementById('ing-preview').classList.add('hidden');
  document.getElementById('ing-barcode').value = '';
  document.getElementById('ing-qty').value = '1';

  document.getElementById('ing-confirm-btn').disabled = true;
  setTimeout(() => document.getElementById('ing-barcode').focus(), 100);

  // Scanner listeners (solo registrar una vez)
  const barcodeInput = document.getElementById('ing-barcode');
  barcodeInput.onkeydown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = barcodeInput.value.trim();
      if (code) await ingLookupProduct(code);
    }
  };
  barcodeInput.oninput = () => {
    barcodeInput.classList.add('scanning');
    clearTimeout(ingBarcodeTimeout);
    ingBarcodeTimeout = setTimeout(() => barcodeInput.classList.remove('scanning'), 200);
  };
  document.getElementById('ing-qty').onkeydown = (e) => {
    if (e.key === 'Enter') registerIngreso();
  };
}

function closeIngresoModal() {
  document.getElementById('ingreso-overlay').classList.add('hidden');
  ingCurrentProduct = null;
}

async function ingLookupProduct(barcode) {
  const errorEl = document.getElementById('ing-error');
  errorEl.classList.add('hidden');

  try {
    const product = await api.getProductByBarcode(barcode);
    ingCurrentProduct = product;

    // Mostrar preview
    document.getElementById('ing-preview').classList.remove('hidden');
    document.getElementById('ing-preview-name').textContent = product.name;
    document.getElementById('ing-preview-cat').textContent = product.category || 'General';
    document.getElementById('ing-preview-barcode').textContent = product.barcode;
    document.getElementById('ing-preview-buy').textContent = formatCurrency(product.buy_price);
    document.getElementById('ing-preview-sell').textContent = formatCurrency(product.sell_price);

    const stockEl = document.getElementById('ing-preview-stock');
    if (product.stock === 0) {
      stockEl.textContent = '0';
      stockEl.style.color = 'var(--danger)';
    } else if (product.stock <= product.min_stock) {
      stockEl.textContent = `${product.stock} (stock bajo, mín: ${product.min_stock})`;
      stockEl.style.color = 'var(--warning)';
    } else {
      stockEl.textContent = product.stock;
      stockEl.style.color = 'var(--success)';
    }

    document.getElementById('ing-confirm-btn').disabled = false;
    document.getElementById('ing-qty').focus();
    document.getElementById('ing-qty').select();

  } catch (e) {
    ingCurrentProduct = null;
    document.getElementById('ing-preview').classList.add('hidden');
    document.getElementById('ing-confirm-btn').disabled = true;

    if (e.status === 404) {
      errorEl.innerHTML = `❌ Producto no encontrado: "${barcode}". <a href="/stock.html?add=${barcode}" style="color:var(--text-primary); text-decoration:underline; font-weight:600; margin-left:4px;">¿Querés darlo de alta?</a>`;
    } else {
      errorEl.textContent = e.message;
    }
    errorEl.classList.remove('hidden');
  }
}

function ingAdjustQty(delta) {
  const input = document.getElementById('ing-qty');
  const current = parseInt(input.value) || 1;
  input.value = Math.max(1, current + delta);
}

async function registerIngreso() {
  if (!ingCurrentProduct) {
    showToast('Primero escanear un producto', 'warning');
    return;
  }

  const qty = parseInt(document.getElementById('ing-qty').value) || 1;

  if (qty <= 0) {
    showToast('La cantidad debe ser mayor a 0', 'warning');
    return;
  }

  const btn = document.getElementById('ing-confirm-btn');
  const spinner = document.getElementById('ing-spinner');
  const text = document.getElementById('ing-confirm-text');

  btn.disabled = true;
  spinner.classList.remove('hidden');
  text.textContent = 'Registrando...';

  try {
    const result = await api.createMovement({
      product_id: ingCurrentProduct.id,
      type: 'ingreso',
      quantity: qty
    });

    showToast(`📥 Ingreso de ${qty} unidad(es) de "${ingCurrentProduct.name}" registrado. Nuevo stock: ${result.newStock}`, 'success', 4000);
    closeIngresoModal();
    await loadProducts();

  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    spinner.classList.add('hidden');
    text.textContent = '📥 Registrar ingreso';
    if (ingCurrentProduct) btn.disabled = false;
  }
}

// === Modal de Cámara Scanner ===
let html5QrcodeScanner = null;

function openCameraScanner() {
  document.getElementById('camera-overlay').classList.remove('hidden');

  // Bloquear scroll del body para evitar que el browser haga zoom-out
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';

  if (!html5QrcodeScanner) {
    // Calcular tamaño del qrbox según el viewport (máx 250px en desktop, proporcional en mobile)
    const boxSize = Math.min(250, Math.round(window.innerWidth * 0.65));

    html5QrcodeScanner = new Html5QrcodeScanner(
      "reader",
      {
        fps: 10,
        qrbox: { width: boxSize, height: boxSize },
        rememberLastUsedCamera: true,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
      },
      /* verbose= */ false);
  }

  html5QrcodeScanner.render(onScanSuccess, onScanFailure);
}

function closeCameraScanner() {
  document.getElementById('camera-overlay').classList.add('hidden');

  // Restaurar scroll del body
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.width = '';

  if (html5QrcodeScanner) {
    html5QrcodeScanner.clear().catch(error => {
      console.error("Failed to clear html5QrcodeScanner. ", error);
    });
    html5QrcodeScanner = null; // Resetear para que recalcule el boxSize si cambia orientación
  }
}

async function onScanSuccess(decodedText, decodedResult) {
  // Detener el escáner
  closeCameraScanner();

  // Buscar si el producto ya existe
  const exists = allProducts.find(p => p.barcode === decodedText);

  if (exists) {
    // Abrir Modal de Ingresos con el código precargado
    openIngresoModal();
    document.getElementById('ing-barcode').value = decodedText;
    await ingLookupProduct(decodedText);
  } else {
    // Abrir Modal de Nuevo Producto con el código precargado
    openModal(null, decodedText);
  }
}

function onScanFailure(error) {
  // Ignorar errores de escaneo fallido constantes
}


