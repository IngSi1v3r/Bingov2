/**
 * ============================================================
 * admin_dashboard.js
 * ============================================================
 *
 * Zweck:
 * Dieses Skript verwaltet den Dashboard-Tab im Adminpanel.
 *
 * Das Dashboard ist bewusst kompakt gehalten und dient als
 * schneller Lagebericht fuer den Admin:
 * - globale Uebersicht
 * - Schnellinfos zum aktuell ausgewaehlten Spiel
 * - Mini-Grid des aktuellen Spiels
 * - aktive Live-Challenge
 * - Top-5 Leaderboard
 * - letzte 5 Logeintraege
 * - Polling-Einstellungen
 * - Session-Passwort aendern
 *
 * Wichtige Eigenschaften:
 * - wichtige Elemente enthalten Quick Links in die passenden Tabs
 * - reine Ladefunktionen laufen ueber data_service.js
 * - HTML fuer Dashboard-spezifische Elemente wird hier erzeugt
 */

/* ============================================================
 * STATE
 * ============================================================ */

let adminDashboardInitialized = false;
let adminDashboardActiveGames = [];
let adminDashboardCurrentGame = null;
let adminDashboardLogs = [];
let adminDashboardLiveChallenges = [];
let adminDashboardSessionPasswordAdminPassword = "";

/* ============================================================
 * INITIALISIERUNG
 * ============================================================ */

async function initializeAdminDashboardTab() {
  ensureAdminDashboardLayout();
  ensureAdminDashboardSessionPasswordModal();
  await loadAdminDashboardData();
  renderAdminDashboard();
  adminDashboardInitialized = true;
}

function ensureAdminDashboardLayout() {
  const tabEl = document.getElementById("tab-dashboard");
  if (!tabEl) return;

  const alreadyBuilt = document.getElementById("adminDashboardLayout");
  if (alreadyBuilt) return;

  tabEl.innerHTML = `
    <h2>Dashboard</h2>

    <div id="adminDashboardLayout">
      <div id="adminDashboardGlobalStats" class="admin-dashboard-global-stats"></div>

      <div class="admin-dashboard-main-grid">
        <div class="admin-panel">
          <div class="admin-panel-header">
            <h3>Aktuelles Spiel</h3>
          </div>

          <div id="adminDashboardCurrentGameBlock"></div>
        </div>

        <div class="admin-panel">
          <div class="admin-panel-header">
            <h3>Live-Challenge</h3>
          </div>

          <div id="adminDashboardLiveBlock"></div>
        </div>
      </div>

      <div class="admin-dashboard-main-grid">
        <div class="admin-panel">
          <div class="admin-panel-header">
            <h3>Top 5 Leaderboard</h3>
          </div>

          <div id="adminDashboardLeaderboard"></div>
        </div>

        <div class="admin-panel">
          <div class="admin-panel-header">
            <h3>Letzte 5 Logs</h3>
          </div>

          <div id="adminDashboardLogs"></div>
        </div>
      </div>

      <div id="adminDashboardPollingSettings" class="admin-panel" style="margin-bottom: 20px;"></div>

      <div id="adminDashboardSessionPassword" class="admin-panel" style="margin-bottom: 20px;"></div>
    </div>
  `;
}

function ensureAdminDashboardSessionPasswordModal() {
  if (document.getElementById("adminDashboardSessionPasswordOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "adminDashboardSessionPasswordOverlay";
  overlay.className = "modal-overlay hidden";

  overlay.innerHTML = `
    <div class="modal">
      <button id="closeAdminDashboardSessionPasswordBtn" class="modal-close-btn" type="button">×</button>

      <h2>Session-Passwort ändern</h2>

      <div class="rules-content">
        <p>
          Dieses Passwort wird bei der Registrierung neuer Spieler abgefragt.
          Bestehende Spieler bleiben davon unberührt.
        </p>

        <div class="admin-form-group">
          <label for="adminDashboardSessionPasswordInput"><strong>Neues Session-Passwort</strong></label>
          <input id="adminDashboardSessionPasswordInput" type="password" placeholder="Neues Session-Passwort" />
        </div>

        <div class="admin-form-group">
          <label for="adminDashboardSessionPasswordRepeatInput"><strong>Wiederholen</strong></label>
          <input id="adminDashboardSessionPasswordRepeatInput" type="password" placeholder="Session-Passwort wiederholen" />
        </div>

        <p id="adminDashboardSessionPasswordStatus" class="admin-details-empty"></p>
      </div>

      <div class="modal-actions">
        <button id="cancelAdminDashboardSessionPasswordBtn" type="button" class="secondary-btn">Abbrechen</button>
        <button id="saveAdminDashboardSessionPasswordBtn" type="button">Speichern</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document
    .getElementById("closeAdminDashboardSessionPasswordBtn")
    ?.addEventListener("click", closeAdminDashboardSessionPasswordModal);

  document
    .getElementById("cancelAdminDashboardSessionPasswordBtn")
    ?.addEventListener("click", closeAdminDashboardSessionPasswordModal);

  document
    .getElementById("saveAdminDashboardSessionPasswordBtn")
    ?.addEventListener("click", handleAdminDashboardSaveSessionPassword);
}

/* ============================================================
 * DATEN LADEN
 * ============================================================ */

async function loadAdminDashboardData() {
  const bundle = await DataService.bundles.loadAdminDashboard({
    gameId: adminCurrentGameId,
    logLimit: 5
  });

  adminPlayers = bundle.players || [];
  adminGames = bundle.games || [];
  adminPlayerStates = bundle.playerStates || [];
  adminPlayerChallenges = bundle.playerChallenges || [];
  adminPlayerBingos = bundle.playerBingos || [];
  adminChallenges = bundle.challenges || [];

  adminDashboardActiveGames = bundle.activeGames || [];
  adminDashboardCurrentGame = bundle.currentGame || null;
  adminDashboardLiveChallenges = bundle.liveChallenges || [];
  adminDashboardLogs = bundle.logs || [];
}

/* ============================================================
 * NAVIGATION / QUICK LINKS
 * ============================================================ */

async function openAdminTab(tabName) {
  const tabBtn = document.querySelector(`.admin-tab[data-tab="${tabName}"]`);
  const content = document.getElementById(`tab-${tabName}`);
  if (!tabBtn || !content) return;

  document.querySelectorAll(".admin-tab").forEach(tab => tab.classList.remove("active"));
  document.querySelectorAll(".admin-tab-content").forEach(el => el.classList.remove("active"));

  tabBtn.classList.add("active");
  content.classList.add("active");

  if (typeof handleAdminTabActivated === "function") {
    await handleAdminTabActivated(tabName);
  }
}

async function openAdminPlayerFromDashboard(playerId) {
  selectedAdminPlayerId = playerId;
  await openAdminTab("players");
}

async function openAdminCurrentGameFromDashboard() {
  if (typeof selectedAdminGameDetailsId !== "undefined") {
    selectedAdminGameDetailsId = adminCurrentGameId || null;
  }

  await openAdminTab("games");
}

async function openAdminLiveChallengeFromDashboard(liveChallengeId = null) {
  if (typeof selectedAdminLiveChallengeId !== "undefined") {
    selectedAdminLiveChallengeId = liveChallengeId || null;
  }

  await openAdminTab("live");
}

async function openAdminLogsFromDashboard() {
  await openAdminTab("logs");
}

/* ============================================================
 * HELPER / STATISTIKEN
 * ============================================================ */

function getAdminDashboardCurrentGameStates() {
  if (!adminCurrentGameId) return [];

  return adminPlayerStates.filter(
    row => Number(row.game_id) === Number(adminCurrentGameId)
  );
}

function getAdminDashboardCompletedRowsForCurrentGame() {
  if (!adminCurrentGameId) return [];

  return adminPlayerChallenges.filter(
    row =>
      Number(row.game_id) === Number(adminCurrentGameId) &&
      row.status === "completed"
  );
}

function getAdminDashboardBingosForCurrentGame() {
  if (!adminCurrentGameId) return [];

  return adminPlayerBingos.filter(
    row => Number(row.game_id) === Number(adminCurrentGameId)
  );
}

function getAdminDashboardActiveLiveChallengeForCurrentGame() {
  if (!adminCurrentGameId) return null;

  return adminDashboardLiveChallenges.find(
    row =>
      Number(row.game_id) === Number(adminCurrentGameId) &&
      row.status === "active"
  ) || null;
}

function getAdminDashboardGlobalActiveLiveChallengeCount() {
  return adminDashboardLiveChallenges.filter(row => row.status === "active").length;
}

function getAdminDashboardTopPlayers() {
  const states = getAdminDashboardCurrentGameStates();

  return states
    .map(state => {
      const player = adminPlayers.find(p => p.id === state.player_id);

      return {
        playerId: state.player_id,
        playerName: player?.display_name || player?.username || `Spieler ${state.player_id}`,
        score: state.score ?? 0,
        activeChallengeId: state.active_challenge_id,
        cooldownUntil: state.cooldown_until
      };
    })
    .sort((a, b) => {
      if ((b.score ?? 0) !== (a.score ?? 0)) {
        return (b.score ?? 0) - (a.score ?? 0);
      }

      return String(a.playerName).localeCompare(String(b.playerName), "de");
    })
    .slice(0, 5);
}

function buildAdminDashboardWarnings() {
  const warnings = [];

  if (!adminDashboardCurrentGame) {
    warnings.push("Kein aktuelles Spiel ausgewaehlt.");
    return warnings;
  }

  if (adminDashboardCurrentGame.is_active !== true) {
    warnings.push("Das aktuell ausgewaehlte Spiel ist nicht aktiv.");
  }

  const activeLiveForCurrentGame = adminDashboardLiveChallenges.filter(
    row =>
      Number(row.game_id) === Number(adminCurrentGameId) &&
      row.status === "active"
  );

  if (activeLiveForCurrentGame.length > 1) {
    warnings.push("Im ausgewaehlten Spiel sind mehrere Live-Challenges gleichzeitig aktiv.");
  }

  const playersWithoutStateInCurrentGame = adminPlayers.filter(player => {
    return !adminPlayerStates.some(
      row =>
        Number(row.player_id) === Number(player.id) &&
        Number(row.game_id) === Number(adminCurrentGameId)
    );
  });

  if (playersWithoutStateInCurrentGame.length > 0) {
    warnings.push(`${playersWithoutStateInCurrentGame.length} Spieler ohne Spielstand im ausgewaehlten Spiel.`);
  }

  return warnings;
}

function buildAdminDashboardCurrentGameStats() {
  const states = getAdminDashboardCurrentGameStates();
  const completedRows = getAdminDashboardCompletedRowsForCurrentGame();
  const bingoRows = getAdminDashboardBingosForCurrentGame();

  const activePlayersCount = states.length;

  const cooldownPlayersCount = states.filter(
    row => isCooldownActiveAdmin(row.cooldown_until)
  ).length;

  const solvedFieldCount = new Set(
    completedRows.map(row => row.challenge_id)
  ).size;

  const completedTaskCount = completedRows.length;
  const bingosCount = bingoRows.length;

  return {
    activePlayersCount,
    cooldownPlayersCount,
    solvedFieldCount,
    completedTaskCount,
    bingosCount
  };
}

function buildAdminDashboardCurrentGameMiniGrid() {
  const game = adminDashboardCurrentGame;
  if (!game) return `<p class="admin-details-empty">Kein Spiel ausgewaehlt.</p>`;

  const gridSize = game.grid_size || 5;
  const expectedCount = gridSize * gridSize;

  const gameChallenges = adminChallenges
    .filter(challenge => Number(challenge.game_id) === Number(game.id));

  const completedRows = getAdminDashboardCompletedRowsForCurrentGame();
  const completedChallengeIds = new Set(completedRows.map(row => row.challenge_id));

  const challengeByPosition = {};

  gameChallenges.forEach(challenge => {
    challengeByPosition[Number(challenge.position)] = challenge;
  });

  let html = `
    <div
      class="admin-dashboard-game-grid clickable"
      id="adminDashboardGameGrid"
      style="grid-template-columns: repeat(${gridSize}, 1fr);"
      title="Zum Spiele-Tab wechseln"
    >
  `;

  for (let position = 1; position <= expectedCount; position++) {
    const challenge = challengeByPosition[position];

    if (!challenge) {
      html += `<div class="admin-dashboard-game-cell placeholder"></div>`;
      continue;
    }

    let cls = "admin-dashboard-game-cell";

    if (challenge.is_active === false) {
      cls += " inactive";
    } else if (completedChallengeIds.has(challenge.id)) {
      cls += " solved";
    } else {
      cls += " open";
    }

    html += `<div class="${cls}" title="${challenge.title || `Feld ${position}`}"></div>`;
  }

  html += `</div>`;
  return html;
}

/* ============================================================
 * RENDERING
 * ============================================================ */

function renderAdminDashboard() {
  renderAdminDashboardGlobalStats();
  renderAdminDashboardCurrentGameBlock();
  renderAdminDashboardLiveBlock();
  renderAdminDashboardLeaderboard();
  renderAdminDashboardLogs();
  renderAdminDashboardPollingSettings();
  renderAdminDashboardSessionPassword();
}

function renderAdminDashboardGlobalStats() {
  const wrapper = document.getElementById("adminDashboardGlobalStats");
  if (!wrapper) return;

  const activeGamesText = adminDashboardActiveGames.length
    ? adminDashboardActiveGames.map(game => game.name).join(", ")
    : "Keine";

  const warnings = buildAdminDashboardWarnings();

  wrapper.innerHTML = `
    <div class="admin-details-grid">
      <div class="admin-detail-card admin-dashboard-clickable-card" id="adminDashboardActiveGamesCard">
        <div class="admin-detail-label">Aktive Spiele</div>
        <div class="admin-detail-value">${adminDashboardActiveGames.length}</div>
        <div class="admin-dashboard-subtext">${activeGamesText}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Spieler gesamt</div>
        <div class="admin-detail-value">${adminPlayers.length}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Aktive Live-Challenges</div>
        <div class="admin-detail-value">${getAdminDashboardGlobalActiveLiveChallengeCount()}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Auffaelligkeiten</div>
        <div class="admin-detail-value">${warnings.length}</div>
        <div class="admin-dashboard-subtext">
          ${warnings.length ? warnings.join(" | ") : "Keine"}
        </div>
      </div>
    </div>
  `;

  document.getElementById("adminDashboardActiveGamesCard")?.addEventListener("click", async () => {
    await openAdminTab("games");
  });
}

function renderAdminDashboardCurrentGameBlock() {
  const wrapper = document.getElementById("adminDashboardCurrentGameBlock");
  if (!wrapper) return;

  if (!adminDashboardCurrentGame) {
    wrapper.innerHTML = `<p class="admin-details-empty">Kein aktuelles Spiel ausgewaehlt.</p>`;
    return;
  }

  const stats = buildAdminDashboardCurrentGameStats();

  wrapper.innerHTML = `
    <div class="admin-dashboard-current-game-layout">
      <div class="admin-dashboard-grid-wrap">
        ${buildAdminDashboardCurrentGameMiniGrid()}
      </div>

      <div class="admin-details-grid">
        <div class="admin-detail-card">
          <div class="admin-detail-label">Spiel</div>
          <div class="admin-detail-value">${adminDashboardCurrentGame.name || "-"}</div>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Grid</div>
          <div class="admin-detail-value">${adminDashboardCurrentGame.grid_size || "-"}x${adminDashboardCurrentGame.grid_size || "-"}</div>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Aktive Spieler</div>
          <div class="admin-detail-value">${stats.activePlayersCount}</div>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Im Cooldown</div>
          <div class="admin-detail-value">${stats.cooldownPlayersCount}</div>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Geloeste Felder</div>
          <div class="admin-detail-value">${stats.solvedFieldCount}</div>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Abgeschlossene Aufgaben</div>
          <div class="admin-detail-value">${stats.completedTaskCount}</div>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Bingos</div>
          <div class="admin-detail-value">${stats.bingosCount}</div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("adminDashboardGameGrid")?.addEventListener("click", async () => {
    await openAdminCurrentGameFromDashboard();
  });
}

function renderAdminDashboardLiveBlock() {
  const wrapper = document.getElementById("adminDashboardLiveBlock");
  if (!wrapper) return;

  const activeLive = getAdminDashboardActiveLiveChallengeForCurrentGame();

  if (!activeLive) {
    wrapper.innerHTML = `
      <div class="admin-dashboard-link-card" id="adminDashboardLiveCard">
        <div class="admin-details-grid">
          <div class="admin-detail-card admin-detail-wide">
            <div class="admin-detail-label">Aktuell</div>
            <div class="admin-detail-value">Keine aktive Live-Challenge</div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("adminDashboardLiveCard")?.addEventListener("click", async () => {
      await openAdminLiveChallengeFromDashboard(null);
    });

    return;
  }

  const remainingText =
    activeLive.expires_at
      ? formatAdminCooldown(activeLive.expires_at)
      : "Ohne Limit";

  wrapper.innerHTML = `
    <div class="admin-dashboard-link-card" id="adminDashboardLiveCard">
      <div class="admin-details-grid">
        <div class="admin-detail-card admin-detail-wide">
          <div class="admin-detail-label">Titel</div>
          <div class="admin-detail-value">${activeLive.title || "-"}</div>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Punkte</div>
          <div class="admin-detail-value">${activeLive.points ?? 0}</div>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Foto erforderlich</div>
          <div class="admin-detail-value">${activeLive.requires_photo_proof ? "Ja" : "Nein"}</div>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Status</div>
          <div class="admin-detail-value">${activeLive.status || "-"}</div>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Restzeit</div>
          <div class="admin-detail-value">${remainingText}</div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("adminDashboardLiveCard")?.addEventListener("click", async () => {
    await openAdminLiveChallengeFromDashboard(activeLive.id);
  });
}

function renderAdminDashboardLeaderboard() {
  const wrapper = document.getElementById("adminDashboardLeaderboard");
  if (!wrapper) return;

  const rows = getAdminDashboardTopPlayers();

  if (!rows.length) {
    wrapper.innerHTML = `<p class="admin-details-empty">Noch keine Spieler im ausgewaehlten Spiel.</p>`;
    return;
  }

  let html = `<div class="admin-dashboard-list">`;

  rows.forEach((row, index) => {
    const badges = [];
    if (row.activeChallengeId) badges.push("Aktiv");
    if (isCooldownActiveAdmin(row.cooldownUntil)) badges.push("Cooldown");

    html += `
      <div class="admin-dashboard-row admin-dashboard-clickable-row" data-player-id="${row.playerId}">
        <div class="admin-dashboard-row-left">
          <div class="admin-dashboard-row-title">#${index + 1} ${row.playerName}</div>
          <div class="admin-dashboard-row-meta">${badges.length ? badges.join(" - ") : " "}</div>
        </div>
        <div class="admin-dashboard-row-right">${row.score}P</div>
      </div>
    `;
  });

  html += `</div>`;
  wrapper.innerHTML = html;

  wrapper.querySelectorAll(".admin-dashboard-clickable-row").forEach(el => {
    el.addEventListener("click", async () => {
      const playerId = Number(el.dataset.playerId);
      await openAdminPlayerFromDashboard(playerId);
    });
  });
}

function renderAdminDashboardLogs() {
  const wrapper = document.getElementById("adminDashboardLogs");
  if (!wrapper) return;

  if (!adminDashboardLogs.length) {
    wrapper.innerHTML = `<p class="admin-details-empty">Noch keine Logs im ausgewaehlten Spiel.</p>`;
    return;
  }

  let html = `<div class="admin-dashboard-list admin-dashboard-link-card" id="adminDashboardLogsCard">`;

  adminDashboardLogs.forEach(log => {
    const timeText =
      typeof formatActivityDateTime === "function"
        ? formatActivityDateTime(log.created_at)
        : formatAdminDateTime(log.created_at);

    const messageText =
      typeof formatActivityLogMessage === "function"
        ? formatActivityLogMessage(log)
        : (log.message || log.event_type || "Event");

    html += `
      <div class="admin-dashboard-row compact">
        <div class="admin-dashboard-row-left">
          <div class="admin-dashboard-row-title">${messageText}</div>
          <div class="admin-dashboard-row-meta">${timeText}</div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  wrapper.innerHTML = html;

  document.getElementById("adminDashboardLogsCard")?.addEventListener("click", async () => {
    await openAdminLogsFromDashboard();
  });
}

/* ============================================================
 * POLLING-EINSTELLUNGEN
 * ============================================================ */

function renderAdminDashboardPollingSettings() {
  const wrapper = document.getElementById("adminDashboardPollingSettings");
  if (!wrapper) return;

  if (typeof PollingService === "undefined") {
    wrapper.innerHTML = `
      <div class="admin-panel-header">
        <h3>Polling</h3>
      </div>
      <p class="admin-details-empty">PollingService nicht geladen.</p>
    `;
    return;
  }

  const settings = PollingService.getSettings();
  const intervals = settings.intervals || {};

  const fastSeconds = Math.round((intervals.fast || 5000) / 1000);
  const slowSeconds = Math.round((intervals.slow || 60000) / 1000);
  const adminSeconds = Math.round((intervals.admin || 10000) / 1000);

  wrapper.innerHTML = `
    <div class="admin-panel-header">
      <h3>Polling</h3>
    </div>

    <div class="admin-details-grid">
      <div class="admin-detail-card">
        <div class="admin-detail-label">Preset</div>
        <div class="admin-detail-value">${settings.preset || "normal"}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Fast</div>
        <div class="admin-detail-value">${fastSeconds} s</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Slow</div>
        <div class="admin-detail-value">${slowSeconds} s</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Admin</div>
        <div class="admin-detail-value">${adminSeconds} s</div>
      </div>
    </div>

    <div class="admin-player-action-bar" style="margin-top: 12px;">
      <button id="adminPollingPresetSlowBtn" type="button" class="secondary-btn">Langsam</button>
      <button id="adminPollingPresetNormalBtn" type="button" class="secondary-btn">Normal</button>
      <button id="adminPollingPresetFastBtn" type="button" class="secondary-btn">Schnell</button>
      <button id="adminPollingCustomBtn" type="button" class="secondary-btn">Manuell</button>
      <button id="adminPollingDefaultBtn" type="button" class="secondary-btn">Default</button>
    </div>
  `;

  document.getElementById("adminPollingPresetSlowBtn")?.addEventListener("click", () => {
    PollingService.setPreset("slow");
    renderAdminDashboardPollingSettings();
  });

  document.getElementById("adminPollingPresetNormalBtn")?.addEventListener("click", () => {
    PollingService.setPreset("normal");
    renderAdminDashboardPollingSettings();
  });

  document.getElementById("adminPollingPresetFastBtn")?.addEventListener("click", () => {
    PollingService.setPreset("fast");
    renderAdminDashboardPollingSettings();
  });

  document.getElementById("adminPollingDefaultBtn")?.addEventListener("click", () => {
    PollingService.resetSettingsToDefault();
    renderAdminDashboardPollingSettings();
  });

  document.getElementById("adminPollingCustomBtn")?.addEventListener("click", () => {
    const fastInput = prompt("Fast-Polling in Sekunden:", String(fastSeconds));
    if (fastInput === null) return;

    const slowInput = prompt("Slow-Polling in Sekunden:", String(slowSeconds));
    if (slowInput === null) return;

    const adminInput = prompt("Admin-Polling in Sekunden:", String(adminSeconds));
    if (adminInput === null) return;

    const fastMs = Number(fastInput) * 1000;
    const slowMs = Number(slowInput) * 1000;
    const adminMs = Number(adminInput) * 1000;

    if (
      !Number.isFinite(fastMs) ||
      !Number.isFinite(slowMs) ||
      !Number.isFinite(adminMs) ||
      fastMs < 1000 ||
      slowMs < 1000 ||
      adminMs < 1000
    ) {
      alert("Bitte gueltige Werte groesser/gleich 1 Sekunde eingeben.");
      return;
    }

    PollingService.setCustomIntervals({
      fast: fastMs,
      slow: slowMs,
      admin: adminMs
    });

    renderAdminDashboardPollingSettings();
  });
}

/* ============================================================
 * SESSION-PASSWORT
 * ============================================================ */

function renderAdminDashboardSessionPassword() {
  const wrapper = document.getElementById("adminDashboardSessionPassword");
  if (!wrapper) return;

  wrapper.innerHTML = `
    <div class="admin-panel-header">
      <h3>Session-Passwort</h3>
    </div>

    <p class="admin-details-empty">
      Dieses Passwort wird nur bei der Registrierung neuer Spieler abgefragt.
      Es wird nicht angezeigt und kann hier neu gesetzt werden.
    </p>

    <div class="admin-player-action-bar" style="margin-top: 12px;">
      <button id="adminDashboardChangeSessionPasswordBtn" type="button" class="secondary-btn">
        Session-Passwort ändern
      </button>
    </div>
  `;

  document
    .getElementById("adminDashboardChangeSessionPasswordBtn")
    ?.addEventListener("click", openAdminDashboardSessionPasswordModal);
}

async function openAdminDashboardSessionPasswordModal() {
  ensureAdminDashboardSessionPasswordModal();

  const status = document.getElementById("adminDashboardSessionPasswordStatus");

  if (typeof requireAdminPassword !== "function") {
    if (status) status.textContent = "Admin-Passwortpruefung ist nicht verfuegbar.";
    return;
  }

  const adminPassword = await requireAdminPassword();
  if (!adminPassword) return;

  adminDashboardSessionPasswordAdminPassword = adminPassword;

  const overlay = document.getElementById("adminDashboardSessionPasswordOverlay");
  const input = document.getElementById("adminDashboardSessionPasswordInput");
  const repeat = document.getElementById("adminDashboardSessionPasswordRepeatInput");

  if (input) input.value = "";
  if (repeat) repeat.value = "";
  if (status) status.textContent = "";

  overlay?.classList.remove("hidden");

  setTimeout(() => {
    input?.focus();
  }, 0);
}

function closeAdminDashboardSessionPasswordModal() {
  adminDashboardSessionPasswordAdminPassword = "";

  const overlay = document.getElementById("adminDashboardSessionPasswordOverlay");
  overlay?.classList.add("hidden");
}

async function handleAdminDashboardSaveSessionPassword() {
  const input = document.getElementById("adminDashboardSessionPasswordInput");
  const repeat = document.getElementById("adminDashboardSessionPasswordRepeatInput");
  const status = document.getElementById("adminDashboardSessionPasswordStatus");

  const newSessionPassword = String(input?.value || "");
  const newSessionPasswordRepeat = String(repeat?.value || "");

  if (!newSessionPassword || !newSessionPasswordRepeat) {
    if (status) status.textContent = "Bitte beide Felder ausfuellen.";
    return;
  }

  if (newSessionPassword.length < 4) {
    if (status) status.textContent = "Das Session-Passwort muss mindestens 4 Zeichen haben.";
    return;
  }

  if (newSessionPassword !== newSessionPasswordRepeat) {
    if (status) status.textContent = "Die beiden Passwoerter stimmen nicht ueberein.";
    return;
  }

  if (!adminDashboardSessionPasswordAdminPassword) {
    if (status) status.textContent = "Admin-Passwort fehlt. Bitte erneut oeffnen.";
    return;
  }

  if (status) status.textContent = "Speichere neues Session-Passwort...";

  try {
    const { data, error } = await supabaseClient.rpc(
      "update_bingo_session_password",
      {
        p_admin_user_id: adminPlayer?.id || null,
        p_admin_password: adminDashboardSessionPasswordAdminPassword,
        p_new_session_password: newSessionPassword,
        p_new_session_password_repeat: newSessionPasswordRepeat
      }
    );

    if (error) {
      throw error;
    }

    if (!data) {
      if (status) status.textContent = "Session-Passwort konnte nicht geaendert werden.";
      return;
    }

    adminDashboardSessionPasswordAdminPassword = "";

    alert("Session-Passwort wurde erfolgreich geaendert.");
    closeAdminDashboardSessionPasswordModal();
  } catch (error) {
    console.error("Fehler beim Aendern des Session-Passworts:", error);

    if (status) {
      status.textContent = error.message || "Session-Passwort konnte nicht geaendert werden.";
    }
  }
}