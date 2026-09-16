/* ============================
   api.js — API client utility
   ============================ */

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function getAuthHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

async function apiRequest(method, endpoint, body = null) {
  const config = {
    method,
    headers: getAuthHeaders()
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && data.expired) {
    // Token expirado o inválido → redirigir al login
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
    return;
  }

  if (!response.ok) {
    const error = new Error(data.error || `Error ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

const api = {
  // Auth
  login: (username, password) => apiRequest('POST', '/auth/login', { username, password }),
  verify: () => apiRequest('GET', '/auth/verify'),
  changePassword: (currentPassword, newPassword) =>
    apiRequest('PUT', '/auth/change-password', { currentPassword, newPassword }),

  // Products
  getProducts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest('GET', `/products${query ? '?' + query : ''}`);
  },
  getProductByBarcode: (barcode) => apiRequest('GET', `/products/barcode/${encodeURIComponent(barcode)}`),
  getProductById: (id) => apiRequest('GET', `/products/${id}`),
  getCategories: () => apiRequest('GET', '/products/categories'),
  createProduct: (data) => apiRequest('POST', '/products', data),
  updateProduct: (id, data) => apiRequest('PUT', `/products/${id}`, data),
  deleteProduct: (id) => apiRequest('DELETE', `/products/${id}`),

  // Movements
  getMovements: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest('GET', `/movements${query ? '?' + query : ''}`);
  },
  createMovement: (data) => apiRequest('POST', '/movements', data),
  deleteMovement: (id) => apiRequest('DELETE', `/movements/${id}`),

  // Sales
  createSale: (data) => apiRequest('POST', '/sales', data),

  // Dashboard
  getStats: () => apiRequest('GET', '/dashboard/stats'),
  getRecentMovements: () => apiRequest('GET', '/dashboard/recent-movements'),
  getLowStock: () => apiRequest('GET', '/dashboard/low-stock'),
  getMovementsChart: () => apiRequest('GET', '/dashboard/movements-chart'),
};

// === Toast notifications ===
function showToast(message, type = 'success', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// === Auth guard (para páginas protegidas) ===
async function requireAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = '/index.html';
    return null;
  }

  try {
    const data = await api.verify();
    return data.user;
  } catch (e) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
    return null;
  }
}

// === Logout ===
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/index.html';
}

// === Format helpers ===
function formatCurrency(value) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

function getStockBadge(stock, minStock) {
  if (stock === 0) return `<span class="stock-badge stock-out">📦 Sin stock</span>`;
  if (stock <= minStock) return `<span class="stock-badge stock-low">⚠️ ${stock}</span>`;
  return `<span class="stock-badge stock-ok">✓ ${stock}</span>`;
}

// Resalta el nav link activo
function setActiveNav() {
  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href.includes(currentPage) || (currentPage === '' && href.includes('dashboard'))) {
      link.classList.add('active');
    }
  });
}
