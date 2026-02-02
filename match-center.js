const resultForm = document.querySelector('#match-result-form');
const resultStatus = document.querySelector('#match-result-status');
const authClient = window.ArcadiaAuth;
const matchTitle = document.querySelector('#match-title');
const matchMeta = document.querySelector('#match-meta');
const matchTag = document.querySelector('#match-tag');
const matchStatus = document.querySelector('#match-data-status');
const homeName = document.querySelector('#match-home-name');
const awayName = document.querySelector('#match-away-name');
const homeScore = document.querySelector('#match-home-score');
const awayScore = document.querySelector('#match-away-score');

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

const setMatchStatus = (message, type = 'info') => setStatus(matchStatus, message, type);

const POLL_INTERVAL_MS = 15000;
let pollHandle;

const loadLatestMatch = async () => {
  if (!matchTitle || !matchMeta || !matchStatus) {
    return;
  }

  const response = await fetch('/api/matches/latest');
  if (!response.ok) {
    setMatchStatus('Live match data unavailable.', 'error');
    return;
  }

  const match = await response.json();
  const homeTeam = match.home_team_name ?? 'TBD';
  const awayTeam = match.away_team_name ?? 'TBD';

  if (matchTag) {
    matchTag.textContent = `${match.status ?? 'Scheduled'} • Round ${match.round ?? 1}`;
  }
  matchTitle.textContent = `${homeTeam} vs ${awayTeam}`;
  matchMeta.textContent = `${match.event_name ?? 'Main Event'} · Round ${match.round ?? 1}`;

  if (homeName) {
    homeName.textContent = homeTeam;
  }
  if (awayName) {
    awayName.textContent = awayTeam;
  }
  if (homeScore) {
    homeScore.textContent = match.home_score ?? 0;
  }
  if (awayScore) {
    awayScore.textContent = match.away_score ?? 0;
  }

  setMatchStatus('Live match data synced.', 'success');
};

const startPolling = () => {
  if (pollHandle) {
    return;
  }
  pollHandle = window.setInterval(() => {
    loadLatestMatch();
  }, POLL_INTERVAL_MS);
};

const stopPolling = () => {
  if (!pollHandle) {
    return;
  }
  window.clearInterval(pollHandle);
  pollHandle = null;
};

if (resultForm) {
  resultForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!authClient?.getAccessToken()) {
      setStatus(resultStatus, 'Sign in to submit a match result.', 'error');
      return;
    }

    const formData = new FormData(resultForm);
    const matchId = formData.get('matchId')?.toString().trim();
    const homeScore = formData.get('homeScore')?.toString().trim();
    const awayScore = formData.get('awayScore')?.toString().trim();
    const winnerTeamId = formData.get('winnerTeamId')?.toString().trim();
    const notes = formData.get('notes')?.toString().trim();

    const response = await authClient.authenticatedFetch(`/api/matches/${matchId}/result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        homeScore: Number(homeScore),
        awayScore: Number(awayScore),
        winnerTeamId: winnerTeamId ? Number(winnerTeamId) : null,
        notes: notes || null,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      setStatus(resultStatus, error?.error ?? 'Unable to submit match result.', 'error');
      return;
    }

    resultForm.reset();
    setStatus(resultStatus, 'Match result submitted.', 'success');
  });
}

loadLatestMatch();
startPolling();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopPolling();
  } else {
    loadLatestMatch();
    startPolling();
  }
});
