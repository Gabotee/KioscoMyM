// -- Logica de la pagina de login --

// Boton de cambiar tema (no usa sidebar.js, así que lo manejamos aqui)
document.addEventListener('DOMContentLoaded', function () {
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
});

// Si ya hay token valido, redirigir al dashboard
(async function checkExistingAuth() {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      await api.verify();
      window.location.href = '/dashboard.html';
    } catch (e) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
})();

const form = document.getElementById('login-form');
const errorMsg = document.getElementById('error-msg');
const errorText = document.getElementById('error-text');
const loginBtn = document.getElementById('login-btn');
const btnText = document.getElementById('btn-text');
const btnSpinner = document.getElementById('btn-spinner');
const attemptsContainer = document.getElementById('attempts-container');
const MAX = 3;

function setLoading(loading) {
  loginBtn.disabled = loading;
  btnText.textContent = loading ? 'Verificando...' : 'Iniciar sesion';
  btnSpinner.classList.toggle('hidden', !loading);
}

function showError(message, isLock = false) {
  document.getElementById('error-svg-warning').classList.toggle('hidden', isLock);
  document.getElementById('error-svg-lock').classList.toggle('hidden', !isLock);
  errorText.textContent = message;
  errorMsg.classList.remove('hidden');
}

function hideError() {
  errorMsg.classList.add('hidden');
}

function updateAttemptsBar(attemptsLeft) {
  attemptsContainer.classList.remove('hidden');
  for (let i = 1; i <= MAX; i++) {
    const dot = document.getElementById(`dot-${i}`);
    dot.classList.toggle('empty', i > attemptsLeft);
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  setLoading(true);

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const data = await api.login(username, password);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    btnText.textContent = 'Redirigiendo...';
    setTimeout(() => { window.location.href = '/dashboard.html'; }, 400);

  } catch (err) {
    setLoading(false);
    const errData = err.data || {};

    if (errData.locked) {
      showError(err.message, true);
      attemptsContainer.classList.add('hidden');
      loginBtn.disabled = true;

      if (errData.minutesLeft) {
        setTimeout(() => {
          loginBtn.disabled = false;
          hideError();
          attemptsContainer.classList.add('hidden');
          updateAttemptsBar(MAX);
        }, errData.minutesLeft * 60 * 1000);
      }
    } else {
      showError(err.message);
      if (errData.attemptsLeft !== undefined) {
        updateAttemptsBar(errData.attemptsLeft);
      }
    }

    document.getElementById('password').value = '';
    document.getElementById('password').focus();
  }
});
