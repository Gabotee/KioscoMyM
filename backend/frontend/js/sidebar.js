// -- Sidebar toggle (compartido en todas las paginas) --

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
}

function closeSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
}

document.addEventListener('DOMContentLoaded', function () {
  // Overlay del sidebar cierra al hacer click
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) overlay.addEventListener('click', closeSidebar);

  // Boton hamburguesa abre/cierra sidebar
  const hamburger = document.getElementById('hamburger-btn');
  if (hamburger) hamburger.addEventListener('click', toggleSidebar);

  // Boton de cerrar sesion
  const logoutBtn = document.querySelector('[data-action="logout"]');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  // Boton de cambiar tema
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Cerrar sidebar al hacer click en un nav-link (mobile)
  document.querySelectorAll('.nav-link').forEach(function (link) {
    link.addEventListener('click', function () {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });
});
