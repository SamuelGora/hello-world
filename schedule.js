const scheduleList = document.querySelector('#schedule-list');
const scheduleStatus = document.querySelector('#schedule-status');

const POLL_INTERVAL_MS = 20000;
let pollHandle;

const setStatus = (message, type = 'info') => {
  if (!scheduleStatus) {
    return;
  }
  scheduleStatus.textContent = message;
  if (type === 'error' || type === 'success') {
    scheduleStatus.dataset.status = type;
  } else {
    scheduleStatus.removeAttribute('data-status');
  }
};

const formatScheduleDate = (value) => {
  if (!value) {
    return { day: 'TBD', time: 'Time TBD' };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { day: 'TBD', time: 'Time TBD' };
  }

  const day = date.toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
  });
  const time = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return { day, time };
};

const formatStatus = (status) => {
  const normalized = (status ?? 'scheduled').toLowerCase();
  switch (normalized) {
    case 'live':
    case 'in_progress':
      return { label: 'Live now', className: 'status-pill open' };
    case 'complete':
    case 'completed':
      return { label: 'Completed', className: 'status-pill' };
    case 'final':
      return { label: 'Final', className: 'status-pill' };
    case 'scheduled':
    default:
      return { label: 'Scheduled', className: 'status-pill open' };
  }
};

const renderSchedule = (items) => {
  if (!scheduleList) {
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    scheduleList.innerHTML = `
      <article class="schedule-row">
        <div class="schedule-date">
          <span class="day">TBD</span>
          <span class="time">Awaiting schedule</span>
        </div>
        <div class="schedule-info">
          <h2>No matches scheduled</h2>
          <p>Check back soon for updated match times.</p>
        </div>
        <div class="schedule-meta">
          <span class="status-pill">Pending</span>
          <button class="btn ghost" disabled>Await update</button>
        </div>
      </article>
    `;
    setStatus('Waiting for schedule updates.', 'info');
    return;
  }

  scheduleList.innerHTML = items
    .map((item) => {
      const { day, time } = formatScheduleDate(item.scheduled_at);
      const status = formatStatus(item.status);
      const eventTitle = item.event_name ?? 'Main Stage';
      const tournamentName = item.tournament_name ?? 'Arcadia Clash';
      const format = item.format ?? 'Match';
      const matchup =
        item.home_team_name && item.away_team_name
          ? `${item.home_team_name} vs ${item.away_team_name}`
          : 'Teams TBD';

      return `
        <article class="schedule-row">
          <div class="schedule-date">
            <span class="day">${day}</span>
            <span class="time">${time}</span>
          </div>
          <div class="schedule-info">
            <h2>${eventTitle}</h2>
            <p>${format} · ${tournamentName} · ${matchup}</p>
          </div>
          <div class="schedule-meta">
            <span class="${status.className}">${status.label}</span>
            <button class="btn ghost">View details</button>
          </div>
        </article>
      `;
    })
    .join('');

  setStatus(`Schedule updated at ${new Date().toLocaleTimeString()}.`, 'success');
};

const loadSchedule = async () => {
  if (!scheduleList) {
    return;
  }

  try {
    const response = await fetch('/api/schedule');
    if (!response.ok) {
      renderSchedule([]);
      setStatus('Schedule is unavailable right now.', 'error');
      return;
    }

    const items = await response.json();
    renderSchedule(items);
  } catch (error) {
    renderSchedule([]);
    setStatus('Schedule is unavailable right now.', 'error');
  }
};

const startPolling = () => {
  if (pollHandle) {
    return;
  }
  pollHandle = window.setInterval(() => {
    loadSchedule();
  }, POLL_INTERVAL_MS);
};

const stopPolling = () => {
  if (!pollHandle) {
    return;
  }
  window.clearInterval(pollHandle);
  pollHandle = null;
};

loadSchedule();
startPolling();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopPolling();
  } else {
    loadSchedule();
    startPolling();
  }
});
