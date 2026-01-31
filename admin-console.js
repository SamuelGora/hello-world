const actionForm = document.querySelector('#admin-action-form');
const actionStatus = document.querySelector('#admin-action-status');
const tournamentForm = document.querySelector('#admin-tournament-form');
const tournamentStatus = document.querySelector('#admin-tournament-status');
const authStatus = document.querySelector('#admin-auth-status');

const authClient = window.ArcadiaAuth;

const setStatus = (element, message, type = 'info') => {
  if (!element) {
    return;
  }
  element.textContent = message;
  if (type === 'error' || type === 'success') {
    element.dataset.status = type;
  } else {
    element.removeAttribute('data-status');
  }
};

const setAuthStatus = (message, type = 'info') => setStatus(authStatus, message, type);

const updateAccessStatus = (user) => {
  if (!user) {
    setAuthStatus('Sign in with an organizer or admin token to unlock admin actions.', 'error');
    return;
  }

  const roles = user?.roles ?? [];
  const hasAccess = roles.includes('Admin/Staff') || roles.includes('Organizer');
  if (!hasAccess) {
    setAuthStatus('Access denied. Admin or Organizer role required.', 'error');
    return;
  }

  setAuthStatus(`Access confirmed for ${user.displayName}.`, 'success');
};

if (actionForm) {
  actionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!authClient?.getAccessToken()) {
      setStatus(actionStatus, 'Sign in to log an admin action.', 'error');
      return;
    }

    const formData = new FormData(actionForm);
    const payload = {
      action: formData.get('action')?.toString().trim(),
      targetType: formData.get('targetType')?.toString().trim() || null,
      targetId: formData.get('targetId')?.toString().trim() || null,
      notes: formData.get('notes')?.toString().trim() || null,
    };

    const response = await authClient.authenticatedFetch('/api/admin/actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      setStatus(actionStatus, error?.error ?? 'Unable to log admin action.', 'error');
      return;
    }

    actionForm.reset();
    setStatus(actionStatus, 'Admin action logged.', 'success');
    authClient?.loadSession();
  });
}

if (tournamentForm) {
  tournamentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!authClient?.getAccessToken()) {
      setStatus(tournamentStatus, 'Sign in to create a tournament.', 'error');
      return;
    }

    const formData = new FormData(tournamentForm);
    const payload = {
      name: formData.get('name')?.toString().trim(),
      status: formData.get('status')?.toString().trim() || 'draft',
      startsAt: formData.get('startsAt')?.toString() || null,
      endsAt: formData.get('endsAt')?.toString() || null,
    };

    const response = await authClient.authenticatedFetch('/api/tournaments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      setStatus(tournamentStatus, error?.error ?? 'Unable to create tournament.', 'error');
      return;
    }

    tournamentForm.reset();
    setStatus(tournamentStatus, 'Tournament created successfully.', 'success');
    authClient?.loadSession();
  });
}

if (authClient) {
  authClient.onSessionChange((user) => {
    updateAccessStatus(user);
  });
} else {
  updateAccessStatus(null);
}
