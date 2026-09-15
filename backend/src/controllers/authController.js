const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../config/database');

const MAX_ATTEMPTS = 3;
const LOCK_DURATION_MINUTES = 15;

// POST /api/auth/login
exports.login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  const db = getDb();

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username.trim()]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas', attemptsLeft: null });
    }

    // Verificar si la cuenta está bloqueada
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(403).json({
        error: `Cuenta bloqueada. Intentá nuevamente en ${minutesLeft} minuto(s)`,
        locked: true,
        minutesLeft
      });
    }

    // El bloqueo expiró → resetear
    if (user.locked_until && new Date() >= new Date(user.locked_until)) {
      await db.query('UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?', [user.id]);
      user.login_attempts = 0;
      user.locked_until = null;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      const newAttempts = user.login_attempts + 1;

      if (newAttempts >= MAX_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60000);
        await db.query(
          'UPDATE users SET login_attempts = ?, locked_until = ? WHERE id = ?',
          [newAttempts, lockedUntil, user.id]
        );
        return res.status(403).json({
          error: `Demasiados intentos fallidos. Cuenta bloqueada por ${LOCK_DURATION_MINUTES} minutos`,
          locked: true,
          minutesLeft: LOCK_DURATION_MINUTES
        });
      }

      await db.query('UPDATE users SET login_attempts = ? WHERE id = ?', [newAttempts, user.id]);
      const attemptsLeft = MAX_ATTEMPTS - newAttempts;
      return res.status(401).json({
        error: `Contraseña incorrecta. Te ${attemptsLeft === 1 ? 'queda' : 'quedan'} ${attemptsLeft} intento(s)`,
        attemptsLeft
      });
    }

    // Login exitoso
    await db.query('UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?', [user.id]);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });

  } catch (err) {
    console.error('Error en login:', err.message);
    res.status(500).json({ error: 'Error de servidor' });
  }
};

// GET /api/auth/verify
exports.verifyToken = (req, res) => {
  res.json({ valid: true, user: req.user });
};

// PUT /api/auth/change-password
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
  }

  const db = getDb();
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = rows[0];

    if (!await bcrypt.compare(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);
    res.json({ message: 'Contraseña actualizada exitosamente' });

  } catch (err) {
    console.error('Error cambiando contraseña:', err.message);
    res.status(500).json({ error: 'Error de servidor' });
  }
};
