const form = document.querySelector('#support-ticket-form');
const statusEl = document.querySelector('#support-ticket-status');
const profileButton = document.querySelector('#profile-refresh');
const profileSummary = document.querySelector('#profile-summary');
const authClient = window.ArcadiaAuth;

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

const updateProfileSummary = (user) => {
  if (!profileSummary) {
    return;
  }
  if (!user) {
    profileSummary.innerHTML = `
      <div>
        <h3>Status</h3>
        <p>Sign in to view account details.</p>
      </div>
    `;
    return;
  }
  profileSummary.innerHTML = `
    <div>
      <h3>Signed in as</h3>
      <p>${user.displayName} · ${user.email}</p>
    </div>
    <div>
      <h3>Member since</h3>
      <p>${new Date(user.created_at).toLocaleDateString()}</p>
    </div>
  `;
};

const fetchProfile = async () => {
  const token = authClient?.getAccessToken();
  if (!token) {
    updateProfileSummary(null);
    setStatus('Sign in to load your profile.', 'error');
    return;
  }

  const response = await authClient.authenticatedFetch('/api/me');

  if (!response.ok) {
    updateProfileSummary(null);
    setStatus('Unable to load profile. Please sign in again.', 'error');
    return;
  }

  const data = await response.json();
  updateProfileSummary(data.user);
  setStatus('Profile loaded.', 'success');
};

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = authClient?.getAccessToken();
    const subject = form.elements.subject?.value.trim();
    const message = form.elements.message?.value.trim();

    if (!token) {
      setStatus('Sign in before submitting a ticket.', 'error');
      return;
    }

    const response = await authClient.authenticatedFetch('/api/support/tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subject, message }),
    });

    if (!response.ok) {
      const error = await response.json();
      setStatus(error?.error ?? 'Unable to submit ticket.', 'error');
      return;
    }

    form.reset();
    setStatus('Ticket submitted. Support will follow up shortly.', 'success');
  });
}

if (profileButton) {
  profileButton.addEventListener('click', fetchProfile);
}
