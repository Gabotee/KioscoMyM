// ventas.js — Punto de Venta (Carrito)

let cart = JSON.parse(localStorage.getItem('ventas_cart')) || [];
let paymentMethod = localStorage.getItem('ventas_paymentMethod') || 'efectivo';
let barcodeTimeout = null;

function saveState() {
  localStorage.setItem('ventas_cart', JSON.stringify(cart));
  localStorage.setItem('ventas_paymentMethod', paymentMethod);
}

(async function init() {
  const user = await requireAuth();
  if (!user) return;

  document.getElementById('sidebar-username').textContent = user.username;
  document.getElementById('user-avatar').textContent = user.username[0].toUpperCase();

  // Escuchar enter en el input de scanner
  const barcodeInput = document.getElementById('barcode-input');
  barcodeInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = barcodeInput.value.trim();
      if (code) await handleScan(code);
    }
  });

  // Animacion del input al escanear
  barcodeInput.addEventListener('input', () => {
    barcodeInput.classList.add('scanning');
    clearTimeout(barcodeTimeout);
    barcodeTimeout = setTimeout(() => {
      barcodeInput.classList.remove('scanning');
    }, 200);
  });

  setPaymentMethod(paymentMethod);
})();

async function handleScan(barcode) {
  const errorEl = document.getElementById('scan-error');
  errorEl.classList.add('hidden');
  const input = document.getElementById('barcode-input');

  try {
    const product = await api.getProductByBarcode(barcode);

    // Si ya esta en el carrito, sumar cantidad
    const existingIndex = cart.findIndex(item => item.product_id === product.id);
    if (existingIndex >= 0) {
      if (cart[existingIndex].quantity >= product.stock) {
        showToast(`Stock maximo alcanzado para ${product.name}`, 'warning');
      } else {
        cart[existingIndex].quantity += 1;
      }
    } else {
      if (product.stock > 0) {
        cart.push({
          product_id: product.id,
          name: product.name,
          barcode: product.barcode,
          price: product.sell_price,
          transfer_surcharge: parseFloat(product.transfer_surcharge) || 0,
          qr_surcharge: parseFloat(product.qr_surcharge) || 0,
          quantity: 1,
          max_stock: product.stock
        });
      } else {
        showToast(`El producto "${product.name}" no tiene stock disponible`, 'warning');
      }
    }

    input.value = '';
    saveState();
    renderCart();

  } catch (e) {
    if (e.status === 404) {
      errorEl.innerHTML = `No encontrado: "${barcode}". <a href="/stock.html?add=${barcode}" style="color:var(--text-primary); text-decoration:underline; font-weight:600; margin-left:4px;">Queres darlo de alta?</a>`;
    } else {
      errorEl.textContent = e.message;
    }
    errorEl.classList.remove('hidden');
    input.value = '';
  }
}

function updateQuantity(index, newQty) {
  const item = cart[index];
  let qty = parseInt(newQty) || 1;
  if (qty > item.max_stock) {
    qty = item.max_stock;
    showToast(`Stock maximo alcanzado: ${item.max_stock}`, 'warning');
  }
  if (qty < 1) qty = 1;
  cart[index].quantity = qty;
  saveState();
  renderCart();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  saveState();
  renderCart();
}

function clearCart() {
  if (cart.length === 0) return;
  if (confirm('Estas seguro de limpiar el carrito?')) {
    cart = [];
    saveState();
    renderCart();
  }
}

function setPaymentMethod(method) {
  paymentMethod = method;
  document.getElementById('btn-pay-efectivo').classList.remove('active');
  document.getElementById('btn-pay-transferencia').classList.remove('active');
  document.getElementById('btn-pay-qr').classList.remove('active');
  document.getElementById(`btn-pay-${method}`).classList.add('active');
  saveState();
  renderCart();
}

function calcTotals() {
  let subtotal = 0;
  let surcharge = 0;
  cart.forEach(item => {
    const lineSubtotal = item.price * item.quantity;
    subtotal += lineSubtotal;
    if (paymentMethod === 'transferencia') {
      surcharge += lineSubtotal * ((item.transfer_surcharge || 0) / 100);
    } else if (paymentMethod === 'qr') {
      surcharge += lineSubtotal * ((item.qr_surcharge || 0) / 100);
    }
  });
  return { subtotal, surcharge, total: subtotal + surcharge };
}

function renderCart() {
  const body = document.getElementById('cart-body');
  const footer = document.getElementById('cart-footer');

  if (cart.length === 0) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#x1F6D2;</div>
        <div class="empty-state-title">Lista vacia</div>
        <div class="empty-state-text">Escanea un producto para empezar</div>
      </div>`;
    footer.classList.add('hidden');
    return;
  }

  const isTransfer = ['transferencia', 'qr'].includes(paymentMethod);

  let html = `
    <div class="table-wrapper" style="border:none; border-radius:0;">
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th style="width:100px; text-align:center;">Cant.</th>
            <th style="text-align:right;">Subtotal</th>
            ${isTransfer ? '<th style="text-align:right; color:#f59e0b;">Recargo</th>' : ''}
            <th></th>
          </tr>
        </thead>
        <tbody>
  `;

  cart.forEach((item, index) => {
    const lineSubtotal = item.price * item.quantity;
    const activeSurchargePct = paymentMethod === 'qr' ? (item.qr_surcharge || 0) : (item.transfer_surcharge || 0);
    const lineSurcharge = isTransfer ? lineSubtotal * (activeSurchargePct / 100) : 0;

    html += `
      <tr>
        <td>
          <div style="font-weight:500; font-size:14px;">${esc(item.name)}</div>
          <div style="font-size:11px; color:var(--text-muted); font-family:monospace;">${esc(item.barcode)}</div>
          ${isTransfer && activeSurchargePct > 0
            ? `<div style="font-size:11px; color:#f59e0b; margin-top:2px;">+${activeSurchargePct}% ${paymentMethod === 'qr' ? 'QR' : 'transf.'}</div>`
            : ''}
        </td>
        <td>
          <div class="qty-controls-small" style="justify-content:center;">
            <button class="qty-btn-small" onclick="updateQuantity(${index}, ${item.quantity - 1})">-</button>
            <input type="number" class="cart-qty-input" value="${item.quantity}" onchange="updateQuantity(${index}, this.value)" min="1" max="${item.max_stock}" />
            <button class="qty-btn-small" onclick="updateQuantity(${index}, ${item.quantity + 1})">+</button>
          </div>
        </td>
        <td style="text-align:right; font-weight:600; color:var(--accent2);">${formatCurrency(lineSubtotal)}</td>
        ${isTransfer ? `<td style="text-align:right; font-size:13px; color:#f59e0b;">${lineSurcharge > 0 ? '+' + formatCurrency(lineSurcharge) : '-'}</td>` : ''}
        <td style="text-align:right;">
          <button class="btn btn-danger btn-icon-sm" onclick="removeFromCart(${index})" title="Quitar">X</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  body.innerHTML = html;

  const { subtotal, surcharge, total } = calcTotals();
  const totalEl = document.getElementById('cart-total');
  const surchargeRow = document.getElementById('cart-surcharge-row');

  if (isTransfer && surcharge > 0) {
    surchargeRow.classList.remove('hidden');
    document.getElementById('cart-subtotal-val').textContent = formatCurrency(subtotal);
    document.getElementById('cart-surcharge-val').textContent = '+' + formatCurrency(surcharge);
    // Actualizar etiqueta del badge
    const badgeEl = document.getElementById('surcharge-badge-label');
    if (badgeEl) {
      const icon = badgeEl.querySelector('svg') ? badgeEl.querySelector('svg').outerHTML : '';
      badgeEl.innerHTML = icon + (paymentMethod === 'qr' ? ' QR' : ' Transf.');
    }
  } else {
    surchargeRow.classList.add('hidden');
  }

  totalEl.textContent = formatCurrency(total);
  footer.classList.remove('hidden');
}

async function checkout() {
  if (cart.length === 0) return;

  const btn = document.getElementById('btn-checkout');
  const spinner = document.getElementById('checkout-spinner');
  const text = document.getElementById('checkout-text');

  btn.disabled = true;
  spinner.classList.remove('hidden');
  text.textContent = 'Procesando...';

  try {
    const payload = {
      items: cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity
      })),
      payment_method: paymentMethod
    };

    const res = await api.createSale(payload);

    let toastMsg = `Venta registrada. Total: ${formatCurrency(res.total)}`;
    if (res.surcharge > 0) {
      toastMsg += ` (incl. recargo transferencia: ${formatCurrency(res.surcharge)})`;
    }
    showToast(toastMsg, 'success', 5000);

    cart = [];
    saveState();
    renderCart();
    document.getElementById('barcode-input').focus();

  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    btn.disabled = false;
    spinner.classList.add('hidden');
    text.textContent = 'Finalizar Venta';
  }
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
