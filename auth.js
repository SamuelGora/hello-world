let currentUser = null;
let accessToken = null;
let csrfToken = null;
const listeners = new Set();

const notify = () => {
  listeners.forEach((listener) => listener(currentUser));
};

const getAccessToken = () => accessToken;

const setSession = ({ token, csrfToken: newCsrfToken, user }) => {
  accessToken = token ?? null;
  csrfToken = newCsrfToken ?? csrfToken;
  currentUser = user ?? currentUser;
  updateAuthUi(currentUser);
  enforceGuards(currentUser);
  notify();
};

const clearSession = () => {
  accessToken = null;
  csrfToken = null;
  currentUser = null;
};

const onSessionChange = (listener) => {
  listeners.add(listener);
  listener(currentUser);
  return () => listeners.delete(listener);
};

const updateAuthUi = (user) => {
  const signInLinks = document.querySelectorAll('[data-auth-signin]');
  const logoutButtons = document.querySelectorAll('[data-auth-logout]');
  const userLabels = document.querySelectorAll('[data-auth-user]');

  signInLinks.forEach((link) => link.classList.toggle('is-hidden', Boolean(user)));
  logoutButtons.forEach((button) => button.classList.toggle('is-hidden', !user));

  userLabels.forEach((label) => {
    if (user) {
      label.textContent = `Signed in as ${user.displayName}`;
      label.classList.remove('is-hidden');
    } else {
      label.textContent = '';
      label.classList.add('is-hidden');
    }
  });
};

const enforceGuards = (user) => {
  const guardTarget = document.querySelector('[data-requires-auth="true"]');
  const gate = document.querySelector('[data-auth-gate]');
  const protectedSection = document.querySelector('[data-auth-protected]');

  const requiredRoles = guardTarget?.dataset.requiredRoles
    ? guardTarget.dataset.requiredRoles.split(',').map((role) => role.trim())
    : [];

  if (guardTarget && !user) {
    if (gate) {
      gate.classList.remove('is-hidden');
    }
    if (protectedSection) {
      protectedSection.classList.add('is-hidden');
    }
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const redirectTo = `login.html?returnTo=${encodeURIComponent(returnTo)}`;
    window.location.replace(redirectTo);
    return;
  }

  const hasRole =
    requiredRoles.length === 0 ||
    requiredRoles.some((role) => user?.roles?.includes(role));

  if (guardTarget && gate && protectedSection) {
    if (hasRole) {
      gate.classList.add('is-hidden');
      protectedSection.classList.remove('is-hidden');
    } else {
      gate.classList.remove('is-hidden');
      protectedSection.classList.add('is-hidden');
    }
  }

  document.querySelectorAll('[data-required-roles]').forEach((element) => {
    const roles = element.dataset.requiredRoles
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean);
    const allowed = roles.some((role) => user?.roles?.includes(role));
    element.classList.toggle('is-hidden', !allowed);
  });
};

const loadSession = async () => {
  const response = await fetch('/api/auth/session', {
    credentials: 'include',
  });

  if (!response.ok) {
    clearSession();
    updateAuthUi(null);
    enforceGuards(null);
    notify();
    return;
  }

  const data = await response.json();
  setSession(data);
};

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-auth-logout]');
  if (!target) {
    return;
  }
  event.preventDefault();
  fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken ?? '',
    },
  })
    .catch(() => null)
    .finally(() => {
      clearSession();
      updateAuthUi(null);
      notify();
      window.location.href = 'index.html';
    });
});

document.addEventListener('DOMContentLoaded', () => {
  loadSession();
});

window.ArcadiaAuth = {
  getAccessToken,
  getCsrfToken: () => csrfToken,
  setSession,
  clearSession,
  loadSession,
  onSessionChange,
  authenticatedFetch: async (url, options = {}) => {
    const token = getAccessToken();
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (options.method && options.method !== 'GET' && csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }

    return fetch(url, {
      credentials: 'include',
      ...options,
      headers,
    });
  },
};
