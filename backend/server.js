require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./src/routes/auth');
const productsRoutes = require('./src/routes/products');
const movementsRoutes = require('./src/routes/movements');
const dashboardRoutes = require('./src/routes/dashboard');
const salesRoutes = require('./src/routes/sales');
const { initDatabase } = require('./src/config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Trust proxy (necesario detrás del proxy del hosting) ───
app.set('trust proxy', 1);

// ── Seguridad HTTP headers (Helmet + CSP) ──────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com"],
      imgSrc:     ["'self'", "data:"],
      connectSrc: ["'self'"]
    }
  }
}));

// ── CORS restringido al origen configurado ─────────────────
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── Límite de tamaño de body ───────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Rate limiting en login (anti fuerza bruta por IP) ──────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ventana de 15 minutos
  max: 20,                   // máximo 20 intentos por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Intentá nuevamente en 15 minutos.' }
});
app.use('/api/auth/login', loginLimiter);

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, './frontend')));

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/movements', movementsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sales', salesRoutes);

// ── Rutas de páginas ──────────────────────────────────────
// Raíz e inicio de sesión
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, './frontend/index.html'));
});
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, './frontend/index.html'));
});

// Secciones de la app
app.get('/ventas', (req, res) => {
  res.sendFile(path.join(__dirname, './frontend/ventas.html'));
});
app.get('/stock', (req, res) => {
  res.sendFile(path.join(__dirname, './frontend/stock.html'));
});
app.get('/movimientos', (req, res) => {
  res.sendFile(path.join(__dirname, './frontend/movimientos.html'));
});
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, './frontend/dashboard.html'));
});

// Fallback → login
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, './frontend/index.html'));
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ─── Startup async ────────────────────────────────────────
async function startServer() {
  try {
    console.log('🔄 Iniciando base de datos...');
    await initDatabase();

    app.listen(PORT, () => {
      console.log('');
      console.log('╔══════════════════════════════════════╗');
      console.log('║       🏪 Kiosco MyM - Sistema         ║');
      console.log('╠══════════════════════════════════════╣');
      console.log(`║  🚀 Servidor: http://localhost:${PORT}   ║`);
      console.log('╚══════════════════════════════════════╝');
      console.log('');
    });
  } catch (err) {
    console.error('❌ Error iniciando el servidor:', err);
    process.exit(1);
  }
}

startServer();
