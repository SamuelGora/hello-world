const individualForm = document.querySelector('#individual-signup-form');
const teamForm = document.querySelector('#team-signup-form');
const individualStatus = document.querySelector('#individual-signup-status');
const teamStatus = document.querySelector('#team-signup-status');

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

const submitSignup = async (payload) => {
  const response = await fetch('/api/tournament-signups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error?.error ?? 'Unable to submit signup.');
  }

  return response.json();
};

if (individualForm) {
  individualForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(individualForm);
    const payload = {
      type: 'individual',
      playerHandle: formData.get('playerHandle')?.toString().trim(),
      email: formData.get('email')?.toString().trim(),
      region: formData.get('region')?.toString().trim(),
      rolePreference: formData.get('rolePreference')?.toString().trim(),
      availability: formData.get('availability')?.toString().trim(),
    };

    try {
      await submitSignup(payload);
      individualForm.reset();
      setStatus(individualStatus, 'Registration submitted. We will confirm by email.', 'success');
    } catch (error) {
      setStatus(individualStatus, error.message, 'error');
    }
  });
}

if (teamForm) {
  teamForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(teamForm);
    const payload = {
      type: 'team',
      teamName: formData.get('teamName')?.toString().trim(),
      captainName: formData.get('captainName')?.toString().trim(),
      captainEmail: formData.get('captainEmail')?.toString().trim(),
      teamSize: formData.get('teamSize')?.toString().trim(),
      timeSlot: formData.get('timeSlot')?.toString().trim(),
      contactHandle: formData.get('contactHandle')?.toString().trim(),
    };

    try {
      await submitSignup(payload);
      teamForm.reset();
      setStatus(teamStatus, 'Team registration received. We will follow up soon.', 'success');
    } catch (error) {
      setStatus(teamStatus, error.message, 'error');
    }
  });
}
