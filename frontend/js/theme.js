/* =============================================
   Kiosco MyM — Theme Manager
   ============================================= */

(function () {
  const STORAGE_KEY = 'kiosco-theme';

  /** Apply the saved (or system-preferred) theme as early as possible */
  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      // Respect OS preference on first visit
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
    _syncToggleIcon();
  }

  /** Toggle between light and dark themes */
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEY, next);
    _syncToggleIcon();
  }

  /** Update all toggle button icons to reflect the current theme */
  function _syncToggleIcon() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      btn.textContent = isDark ? '☀️' : '🌙';
      btn.setAttribute('title', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
      btn.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    });
  }

  // Run immediately so there's no flash of wrong theme
  initTheme();

  // Expose globals
  window.toggleTheme = toggleTheme;
  window.initTheme = initTheme;
})();
