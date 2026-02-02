const createForm = document.querySelector('#team-create-form');
const createStatus = document.querySelector('#team-create-status');
const memberForm = document.querySelector('#team-member-form');
const memberStatus = document.querySelector('#team-member-status');
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

if (createForm) {
  createForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!authClient?.getAccessToken()) {
      setStatus(createStatus, 'Sign in to create a team.', 'error');
      return;
    }

    const formData = new FormData(createForm);
    const teamName = formData.get('teamName')?.toString().trim();

    if (!teamName) {
      setStatus(createStatus, 'Please enter a team name.', 'error');
      return;
    }

    const response = await authClient.authenticatedFetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: teamName }),
    });

    if (!response.ok) {
      const error = await response.json();
      setStatus(createStatus, error?.error ?? 'Unable to create team.', 'error');
      return;
    }

    createForm.reset();
    setStatus(createStatus, 'Team created. Save the Team ID for roster updates.', 'success');
  });
}

if (memberForm) {
  memberForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!authClient?.getAccessToken()) {
      setStatus(memberStatus, 'Sign in to update the roster.', 'error');
      return;
    }

    const formData = new FormData(memberForm);
    const teamId = formData.get('teamId')?.toString().trim();
    const userId = formData.get('userId')?.toString().trim();
    const role = formData.get('role')?.toString().trim();

    const response = await authClient.authenticatedFetch(`/api/teams/${teamId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, role }),
    });

    if (!response.ok) {
      const error = await response.json();
      setStatus(memberStatus, error?.error ?? 'Unable to add member.', 'error');
      return;
    }

    memberForm.reset();
    setStatus(memberStatus, 'Member added to the roster.', 'success');
  });
}
