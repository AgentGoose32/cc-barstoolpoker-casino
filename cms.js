(function () {
  const totalEl = document.getElementById('todayTotal');
  const metaEl = document.getElementById('todayMeta');
  const listEl = document.getElementById('gameList');
  const deepDiveTitleEl = document.getElementById('deepDiveTitle');
  const deepDiveBodyEl = document.getElementById('deepDiveBody');
  const clearAllBtn = document.getElementById('clearAllBtn');

  let selectedGameId = null;
  let expandedEventIds = new Set();

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

  function houseValue(value) {
    return 0 - Number(value || 0);
  }

  function normalizeGame(game) {
    const events = (game.events || []).map((event) => ({
      ...event,
      houseDelta: houseValue(event.delta),
      houseNet: event.net == null ? null : houseValue(event.net),
      details: event.details || null
    }));

    return {
      ...game,
      houseNet: houseValue(game.totals.net || 0),
      lastHouseNet: game.totals.lastNet == null ? null : houseValue(game.totals.lastNet),
      events
    };
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseAmountText(amountText) {
    const cleaned = String(amountText || '').replace(/[^0-9.+-]/g, '');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  }

  function renderPlayerGroup(title, players, emptyText) {
    if (!players.length) {
      return `<div class="player-group"><div class="player-group-title">${escapeHtml(title)}</div><div class="event-detail-empty">${escapeHtml(emptyText)}</div></div>`;
    }

    return `
      <div class="player-group">
        <div class="player-group-title">${escapeHtml(title)} <span>${players.length}</span></div>
        <div class="player-list">
          ${players.map((player) => {
            const amount = player.amountText || '—';
            const amountValue = parseAmountText(amount);
            const amountClass = amountValue < 0 ? 'metric-negative' : 'metric-positive';
            return `
              <div class="player-card ${amountValue < 0 ? 'player-card-loss' : 'player-card-win'}">
                <div class="player-card-top">
                  <strong>${escapeHtml(player.name || 'Unknown')}</strong>
                  <span class="${amountClass}">${escapeHtml(amount)}</span>
                </div>
                <div class="player-card-meta">
                  ${escapeHtml(player.detailText || '')}
                  ${player.multiplierText ? `, ${escapeHtml(player.multiplierText)}` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderPlayerBreakdown(event) {
    const players = event.details && Array.isArray(event.details.players) ? event.details.players : [];
    if (!players.length) {
      return '<div class="event-detail-empty">No individual player breakdown stored for this event.</div>';
    }

    const winners = players.filter((player) => parseAmountText(player.amountText) > 0);
    const losers = players.filter((player) => parseAmountText(player.amountText) < 0);
    const playerWinTotal = winners.reduce((sum, player) => sum + parseAmountText(player.amountText), 0);
    const playerLossTotal = losers.reduce((sum, player) => sum + Math.abs(parseAmountText(player.amountText)), 0);
    const playerNet = players.reduce((sum, player) => sum + parseAmountText(player.amountText), 0);
    const houseNet = 0 - playerNet;

    return `
      <div class="player-breakdown">
        <div class="player-breakdown-top">
          <div class="player-breakdown-title">Players in this event</div>
          <div class="player-breakdown-sub">${players.length} total players tracked</div>
        </div>
        <div class="player-summary-grid">
          <div class="player-summary-card">
            <div class="player-summary-label">Player wins paid out</div>
            <div class="player-summary-value metric-negative">${fmt(0 - playerWinTotal)}</div>
          </div>
          <div class="player-summary-card">
            <div class="player-summary-label">Player losses collected</div>
            <div class="player-summary-value metric-positive">${fmt(playerLossTotal)}</div>
          </div>
          <div class="player-summary-card">
            <div class="player-summary-label">House net for this event</div>
            <div class="player-summary-value ${metricClass(houseNet)}">${fmt(houseNet)}</div>
          </div>
        </div>
        <div class="player-groups-grid">
          ${renderPlayerGroup('Winners', winners, 'No winners captured in this event.')}
          ${renderPlayerGroup('Losers', losers, 'No losers captured in this event.')}
        </div>
      </div>
    `;
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
          const deltaClass = metricClass(event.houseDelta || 0);
          const canExpand = !!(event.details && Array.isArray(event.details.players) && event.details.players.length);
          const isExpanded = expandedEventIds.has(event.id);
          const mainRowClass = canExpand ? 'expandable-row' : '';
          const detailRow = canExpand ? `
            <tr class="detail-row ${isExpanded ? 'open' : ''}">
              <td colspan="7">
                <div class="detail-panel ${isExpanded ? 'open' : ''}">
                  ${renderPlayerBreakdown(event)}
                </div>
              </td>
            </tr>
          ` : '';
          return `
            <tr class="${mainRowClass}" data-event-id="${event.id}">
              <td>${time}</td>
              <td>${event.type || 'event'}</td>
              <td class="${deltaClass}">${fmt(event.houseDelta || 0)}</td>
              <td>${event.balance == null ? '—' : fmt(event.balance)}</td>
              <td>${event.houseNet == null ? '—' : fmt(event.houseNet)}</td>
              <td>${event.round == null ? '—' : event.round}</td>
              <td>${event.note || '—'}${canExpand ? '<div class="expand-hint">Click to view players</div>' : ''}</td>
            </tr>
            ${detailRow}
          `;
        }).join('')
      : '<tr><td colspan="7" class="empty-state">No tracked events yet for this game today.</td></tr>';

    deepDiveBodyEl.innerHTML = `
      <div class="deep-dive-summary">
        <div>
          <div class="metric-total ${metricClass(game.houseNet || 0)}">${fmt(game.houseNet || 0)}</div>
          <div class="metric-sub">${game.totals.eventCount || 0} tracked events today</div>
        </div>
        <div class="event-meta">
          Last player balance: ${game.totals.lastBalance == null ? '—' : fmt(game.totals.lastBalance)}<br>
          Last house net: ${game.lastHouseNet == null ? '—' : fmt(game.lastHouseNet)}
        </div>
      </div>
      <table class="events-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Type</th>
            <th>House Delta</th>
            <th>Player Balance</th>
            <th>House Net</th>
            <th>Round</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    deepDiveBodyEl.querySelectorAll('tr.expandable-row').forEach((row) => {
      row.addEventListener('click', function () {
        const eventId = this.getAttribute('data-event-id');
        if (!eventId) return;
        if (expandedEventIds.has(eventId)) expandedEventIds.delete(eventId);
        else expandedEventIds.add(eventId);
        renderDeepDive(game);
      });
    });
  }

  function render() {
    const summary = window.CasinoStats.getTodaySummary();
    const games = (summary.games || []).map(normalizeGame).sort((a, b) => (b.houseNet || 0) - (a.houseNet || 0));
    const totalHouseNet = games.reduce((sum, game) => sum + (Number(game.houseNet) || 0), 0);

    totalEl.textContent = fmt(totalHouseNet || 0);
    totalEl.className = `metric-total ${metricClass(totalHouseNet || 0)}`;
    metaEl.textContent = `${summary.eventCount || 0} tracked events across ${summary.games.length || 0} games today (${summary.dayKey}).`;

    if (!games.length) {
      listEl.innerHTML = '<div class="empty-state">No game stats tracked yet today. Play a game, then refresh this page.</div>';
      renderDeepDive(null);
      return;
    }

    if (!selectedGameId || !games.some((game) => game.id === selectedGameId)) {
      selectedGameId = games[0].id;
    }

    listEl.innerHTML = games.map((game) => {
      const active = game.id === selectedGameId ? 'active' : '';
      return `
        <button class="game-card ${active}" type="button" data-game-id="${game.id}">
          <div class="game-card-top">
            <strong>${game.label}</strong>
            <span class="${metricClass(game.houseNet || 0)}">${fmt(game.houseNet || 0)}</span>
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

    renderDeepDive(games.find((game) => game.id === selectedGameId) || null);
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
