const form = document.querySelector('#user-signup-form');
const statusEl = document.querySelector('#user-signup-status');

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
    const firstName = formData.get('firstName')?.toString().trim();
    const lastName = formData.get('lastName')?.toString().trim();
    const gamerTag = formData.get('gamerTag')?.toString().trim();
    const email = formData.get('email')?.toString().trim();
    const password = formData.get('password')?.toString();
    const confirmPassword = formData.get('confirmPassword')?.toString();

    if (!firstName || !lastName || !gamerTag || !email || !password) {
      setStatus('Please fill out all required fields.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      setStatus('Passwords do not match. Please re-enter them.', 'error');
      return;
    }

    const displayName = `${firstName} ${lastName}`;

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, displayName, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      setStatus(error?.error ?? 'Unable to create account.', 'error');
      return;
    }

    form.reset();
    setStatus('Account created! You can now sign in.', 'success');
  });
}
