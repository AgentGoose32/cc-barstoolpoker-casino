(function () {
  const totalEl = document.getElementById('todayTotal');
  const metaEl = document.getElementById('todayMeta');
  const listEl = document.getElementById('gameList');
  const deepDiveTitleEl = document.getElementById('deepDiveTitle');
  const deepDiveBodyEl = document.getElementById('deepDiveBody');
  const clearAllBtn = document.getElementById('clearAllBtn');

  let selectedGameId = null;

  function fmt(value) {
    const num = Number(value || 0);
    const prefix = num > 0 ? '+' : '';
    return `${prefix}${Math.round(num).toLocaleString()}g`;
  }

  function metricClass(value) {
    if (value > 0) return 'metric-positive';
    if (value < 0) return 'metric-negative';
    return 'metric-neutral';
  }

  function renderDeepDive(game) {
    if (!game) {
      deepDiveTitleEl.textContent = 'Deep dive';
      deepDiveBodyEl.innerHTML = '<div class="empty-state">Click a game to inspect today’s tracked events.</div>';
      return;
    }

    const events = [...(game.events || [])].sort((a, b) => b.ts - a.ts);
    deepDiveTitleEl.textContent = `${game.label} deep dive`;

    const rows = events.length
      ? events.map((event) => {
          const time = new Date(event.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
          const deltaClass = metricClass(event.delta || 0);
          return `
            <tr>
              <td>${time}</td>
              <td>${event.type || 'event'}</td>
              <td class="${deltaClass}">${fmt(event.delta || 0)}</td>
              <td>${event.balance == null ? '—' : fmt(event.balance)}</td>
              <td>${event.net == null ? '—' : fmt(event.net)}</td>
              <td>${event.round == null ? '—' : event.round}</td>
              <td>${event.note || '—'}</td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="7" class="empty-state">No tracked events yet for this game today.</td></tr>';

    deepDiveBodyEl.innerHTML = `
      <div class="deep-dive-summary">
        <div>
          <div class="metric-total ${metricClass(game.totals.net || 0)}">${fmt(game.totals.net || 0)}</div>
          <div class="metric-sub">${game.totals.eventCount || 0} tracked events today</div>
        </div>
        <div class="event-meta">
          Last balance: ${game.totals.lastBalance == null ? '—' : fmt(game.totals.lastBalance)}<br>
          Last net: ${game.totals.lastNet == null ? '—' : fmt(game.totals.lastNet)}
        </div>
      </div>
      <table class="events-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Type</th>
            <th>Delta</th>
            <th>Balance</th>
            <th>Net</th>
            <th>Round</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function render() {
    const summary = window.CasinoStats.getTodaySummary();
    totalEl.textContent = fmt(summary.totalNet || 0);
    totalEl.className = `metric-total ${metricClass(summary.totalNet || 0)}`;
    metaEl.textContent = `${summary.eventCount || 0} tracked events across ${summary.games.length || 0} games today (${summary.dayKey}).`;

    if (!summary.games.length) {
      listEl.innerHTML = '<div class="empty-state">No game stats tracked yet today. Play a game, then refresh this page.</div>';
      renderDeepDive(null);
      return;
    }

    if (!selectedGameId || !summary.games.some((game) => game.id === selectedGameId)) {
      selectedGameId = summary.games[0].id;
    }

    listEl.innerHTML = summary.games.map((game) => {
      const active = game.id === selectedGameId ? 'active' : '';
      return `
        <button class="game-card ${active}" type="button" data-game-id="${game.id}">
          <div class="game-card-top">
            <strong>${game.label}</strong>
            <span class="${metricClass(game.totals.net || 0)}">${fmt(game.totals.net || 0)}</span>
          </div>
          <small>${game.totals.eventCount || 0} events today</small>
        </button>
      `;
    }).join('');

    listEl.querySelectorAll('[data-game-id]').forEach((button) => {
      button.addEventListener('click', function () {
        selectedGameId = this.getAttribute('data-game-id');
        render();
      });
    });

    renderDeepDive(summary.games.find((game) => game.id === selectedGameId) || null);
  }

  clearAllBtn.addEventListener('click', function () {
    const ok = window.confirm('Clear all tracked casino CMS stats from this browser?');
    if (!ok) return;
    window.CasinoStats.clearAll();
    selectedGameId = null;
    render();
  });

  render();
})();
