const form = document.querySelector('#login-form');
const statusEl = document.querySelector('#login-status');

const setStatus = (message, type = 'info') => {
  if (!statusEl) {
    return;
  }
  statusEl.textContent = message;
  if (type === 'error' || type === 'success') {
    statusEl.dataset.status = type;
  } else {
    statusEl.removeAttribute('data-status');
  }
};

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const email = formData.get('email')?.toString().trim();
    const password = formData.get('password')?.toString();

    if (!email || !password) {
      setStatus('Enter your email and password to sign in.', 'error');
      return;
    }

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      setStatus(error?.error ?? 'Unable to sign in.', 'error');
      return;
    }

    const data = await response.json();
    if (data?.token && window.ArcadiaAuth) {
      window.ArcadiaAuth.setSession(data);
    }

    setStatus('Signed in. Redirecting now...', 'success');
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('returnTo');
    const safeReturnTo =
      returnTo && !returnTo.includes('://') && !returnTo.startsWith('//') ? returnTo : 'index.html';
    window.location.href = safeReturnTo || 'index.html';
  });
}
