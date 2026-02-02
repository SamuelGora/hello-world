const standingsRows = document.querySelector('#standings-rows');
const standingsStatus = document.querySelector('#standings-status');
const standingsMeta = document.querySelector('#standings-meta');

const setStatus = (message, type = 'info') => {
  if (!standingsStatus) {
    return;
  }
  standingsStatus.textContent = message;
  if (type === 'error' || type === 'success') {
    standingsStatus.dataset.status = type;
  } else {
    standingsStatus.removeAttribute('data-status');
  }
};

const trendClass = (streak) => {
  if (!streak) {
    return 'trend';
  }
  if (streak.startsWith('W')) {
    return 'trend up';
  }
  if (streak.startsWith('L')) {
    return 'trend down';
  }
  return 'trend';
};

const POLL_INTERVAL_MS = 15000;
let pollHandle;

const loadStandings = async () => {
  if (!standingsRows) {
    return;
  }

  const response = await fetch('/api/standings');
  if (!response.ok) {
    setStatus('Standings are unavailable right now.', 'error');
    return;
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    standingsRows.innerHTML = `
      <div class="table-row">
        <span class="rank">—</span>
        <span>No standings data yet.</span>
        <span>—</span>
        <span>—</span>
        <span class="trend">—</span>
      </div>
    `;
    setStatus('Waiting for standings updates.', 'info');
    return;
  }

  standingsRows.innerHTML = rows
    .slice(0, 10)
    .map((row, index) => {
      const record = `${row.wins}-${row.losses}`;
      const streak = row.streak ?? '—';
      return `
        <div class="table-row">
          <span class="rank">#${index + 1}</span>
          <span>${row.team_name}</span>
          <span>${record}</span>
          <span>${row.seed_points}</span>
          <span class="${trendClass(streak)}">${streak}</span>
        </div>
      `;
    })
    .join('');

  if (standingsMeta) {
    standingsMeta.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  }
  setStatus('Live standings loaded.', 'success');
};

const startPolling = () => {
  if (pollHandle) {
    return;
  }
  pollHandle = window.setInterval(() => {
    loadStandings();
  }, POLL_INTERVAL_MS);
};

const stopPolling = () => {
  if (!pollHandle) {
    return;
  }
  window.clearInterval(pollHandle);
  pollHandle = null;
};

loadStandings();
startPolling();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopPolling();
  } else {
    loadStandings();
    startPolling();
  }
});
