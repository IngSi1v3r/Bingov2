/**
 * ============================================================
 * admin_players_ui.js
 * ============================================================
 *
 * Zweck:
 * UI- und Rendering-Ebene fuer den "Spieler"-Tab im Adminpanel.
 *
 * Diese Datei enthaelt:
 * - Aufbau des Players-Tab-HTML
 * - Aufbau des Challenge-Modals
 * - Rendering der linken Spielerliste
 * - Rendering der rechten Detailansicht
 * - Mini-Grids
 * - Galerie
 * - abgeschlossene Aufgaben
 * - UI-Eventlistener
 *
 * Die Logik-, Daten- und Schreibfunktionen liegen in:
 * - admin_players.js
 */

/* ============================================================
 * UI STATE
 * ============================================================ */

let currentAdminPlayerGalleryEntries = [];
let currentAdminPlayerGalleryIndex = 0;

/* ============================================================
 * LAYOUT / GRUNDSTRUKTUR
 * ============================================================ */

function ensureAdminPlayersTabLayout() {
  const tabEl = document.getElementById("tab-players");
  if (!tabEl) return;

  if (document.getElementById("adminPlayersSplitLayout")) return;

  tabEl.innerHTML = `
    <h2>Spieler</h2>

    <div class="admin-split-layout" id="adminPlayersSplitLayout">
      <div class="admin-panel">
        <div class="admin-panel-header">
          <h3>Alle Spieler</h3>
        </div>

        <div id="adminPlayersList" class="admin-list">
          <p>Spieler werden geladen...</p>
        </div>
      </div>

      <div class="admin-panel">
        <div class="admin-panel-header">
          <h3>Spieler-Details</h3>
        </div>

        <div id="adminPlayerDetails" class="admin-details">
          <p>Wähle links einen Spieler aus.</p>
        </div>

        <div id="adminPlayerCreateStateBar" class="admin-player-action-bar hidden">
          <button id="adminCreatePlayerStateBtn" type="button">Spielstand anlegen</button>
        </div>

        <div id="adminPlayerGameMiniGrid" class="admin-mini-grid-wrapper hidden">
          <h3 class="admin-section-title">Fortschritt im aktuellen Spiel</h3>
          <div id="adminPlayerMiniGrid" class="admin-mini-grid"></div>
        </div>

        <div id="adminPlayerGalleryWrapper" class="admin-gallery-wrapper hidden">
          <h3 class="admin-section-title">Galerie</h3>
          <div id="adminPlayerGallery"></div>
        </div>

        <div id="adminPlayerCompletedWrapper" class="admin-completed-wrapper hidden">
          <h3 class="admin-section-title">Abgeschlossene Aufgaben</h3>
          <div id="adminPlayerCompletedList"></div>
        </div>

        <div id="adminPlayerActionBar" class="admin-player-action-bar hidden">
          <button id="adminResetPlayerPasswordBtn" type="button" class="secondary-btn">
            Passwort zurücksetzen
          </button>
          <button id="adminResetPlayerGameBtn" type="button">
            Fortschritt zurücksetzen
          </button>
          <button id="adminDeletePlayerBtn" type="button" class="danger-btn">
            Spieler löschen
          </button>
        </div>
      </div>
    </div>
  `;
}

function ensureAdminPlayerChallengeModal() {
  if (document.getElementById("adminPlayerChallengeOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "adminPlayerChallengeOverlay";
  overlay.className = "modal-overlay hidden";

  overlay.innerHTML = `
    <div class="modal">
      <button id="closeAdminPlayerChallengeBtn" class="modal-close-btn" type="button">×</button>

      <h2 id="adminPlayerChallengeModalTitle">Challenge</h2>

      <div id="adminPlayerChallengeModalContent" class="rules-content">
        <p>Lade Challenge-Details...</p>
      </div>

      <div class="modal-actions" id="adminChallengeActions">
        <button id="adminMarkChallengeCompletedBtn" type="button">Als bestanden markieren</button>
        <button id="adminSetChallengeActiveBtn" type="button">Als aktiv setzen</button>
        <button id="adminSetChallengeInactiveBtn" type="button">Inaktiv setzen</button>
        <button id="adminResetChallengeBtn" type="button">Challenge aberkennen</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document
    .getElementById("closeAdminPlayerChallengeBtn")
    ?.addEventListener("click", closeAdminPlayerChallengeModal);

  document
    .getElementById("adminMarkChallengeCompletedBtn")
    ?.addEventListener("click", adminMarkChallengeAsCompleted);

  document
    .getElementById("adminSetChallengeInactiveBtn")
    ?.addEventListener("click", adminSetChallengeInactiveFromModal);

  document
    .getElementById("adminResetChallengeBtn")
    ?.addEventListener("click", adminResetChallengeFromModal);

  document
    .getElementById("adminSetChallengeActiveBtn")
    ?.addEventListener("click", adminSetChallengeActiveFromModal);
}

/* ============================================================
 * CLEAR / EMPTY STATE
 * ============================================================ */

function clearAdminPlayerDetailsView() {
  const detailsEl = document.getElementById("adminPlayerDetails");
  const miniGridWrapper = document.getElementById("adminPlayerGameMiniGrid");
  const galleryWrapper = document.getElementById("adminPlayerGalleryWrapper");
  const completedWrapper = document.getElementById("adminPlayerCompletedWrapper");
  const actionBar = document.getElementById("adminPlayerActionBar");
  const createStateBar = document.getElementById("adminPlayerCreateStateBar");

  if (detailsEl) {
    detailsEl.innerHTML = `<p class="admin-details-empty">Wähle links einen Spieler aus.</p>`;
  }

  if (miniGridWrapper) miniGridWrapper.classList.add("hidden");
  if (galleryWrapper) galleryWrapper.classList.add("hidden");
  if (completedWrapper) completedWrapper.classList.add("hidden");
  if (actionBar) actionBar.classList.add("hidden");
  if (createStateBar) createStateBar.classList.add("hidden");

  currentAdminPlayerGalleryEntries = [];
  currentAdminPlayerGalleryIndex = 0;
}

/* ============================================================
 * LINKE SPIELERLISTE
 * ============================================================ */

function buildSmallMiniGrid(playerId, game) {
  if (!game) return "";

  const gridSize = game.grid_size || 5;
  const expected = gridSize * gridSize;

  const gameChallenges = adminChallenges
    .filter(c => Number(c.game_id) === Number(game.id) && c.is_active !== false);

  const rows = getChallengeRowsForPlayerInGame(playerId, game.id);
  const rowMap = {};

  rows.forEach(row => {
    rowMap[Number(row.challenge_id)] = row;
  });

  let html = `
    <div
      class="admin-mini-grid-small"
      style="grid-template-columns: repeat(${gridSize}, 1fr);"
    >
  `;

  for (let i = 1; i <= expected; i++) {
    const challenge = gameChallenges.find(c => Number(c.position) === i);
    const row = challenge ? rowMap[Number(challenge.id)] : null;

    let cls = "admin-mini-cell-small";

    if (row?.status === "completed") cls += " completed";
    if (row?.status === "active") cls += " active";
    if (row?.was_first_solver) cls += " first";

    html += `<div class="${cls}"></div>`;
  }

  html += `</div>`;
  return html;
}

function renderAdminPlayersList() {
  const listEl = document.getElementById("adminPlayersList");
  if (!listEl) return;

  if (!adminPlayers.length) {
    listEl.innerHTML = `<p>Keine Spieler gefunden.</p>`;
    return;
  }

  listEl.innerHTML = "";

  adminPlayers.forEach(player => {
    const item = document.createElement("div");
    item.className = "admin-list-item";

    if (Number(player.id) === Number(selectedAdminPlayerId)) {
      item.classList.add("active");
    }

    const displayName = player.display_name || player.username || `Spieler ${player.id}`;
    const displayState = getDisplayStateForPlayer(player.id);
    const displayGame = displayState ? getGameByIdAdmin(displayState.game_id) : null;

    const adminGameState = getStateForPlayerInAdminGame(player.id);
    const score = adminGameState?.score ?? 0;

    const cooldownActive = adminGameState
      ? isCooldownActiveAdmin(adminGameState.cooldown_until)
      : false;

    let activeChallengeText = "-";

    if (adminGameState?.active_challenge_id) {
      activeChallengeText = getChallengeTitleByIdAdmin(adminGameState.active_challenge_id);
    }

    const gameStateCount = getAdminGameStateCountForPlayer(player.id);

    const firstSolverCount = adminCurrentGameId
      ? getFirstSolverCountForPlayerInGame(player.id, adminCurrentGameId)
      : 0;

    const completedCount = adminCurrentGameId
      ? getCompletedRowsForPlayerInGame(player.id, adminCurrentGameId).length
      : 0;

    const miniGridHtml = adminCurrentGame
      ? buildSmallMiniGrid(player.id, adminCurrentGame)
      : "";

    item.innerHTML = `
      <div class="admin-list-card">
        <div class="admin-list-card-left">
          <div class="admin-list-name">${displayName}</div>
          <div class="admin-list-meta">@${player.username || "-"}</div>

          <div class="admin-status-row">
            ${player.is_blocked ? `<span class="admin-badge blocked">Gesperrt</span>` : ""}
            ${displayGame ? `<span class="admin-badge ingame">${displayGame.name}</span>` : ""}
            ${cooldownActive ? `<span class="admin-badge cooldown">Cooldown</span>` : ""}
          </div>

          <div class="admin-list-subinfo">
            <div><strong>Aktiv:</strong> ${activeChallengeText}</div>
            <div><strong>Gelöst:</strong> ${completedCount}</div>
            <div><strong>First:</strong> ${firstSolverCount}</div>
            <div><strong>Spiele:</strong> ${gameStateCount}</div>
          </div>
        </div>

        <div class="admin-list-card-right">
          <div class="admin-list-score">${score}P</div>
          ${miniGridHtml}
        </div>
      </div>
    `;

    item.addEventListener("click", async () => {
      selectedAdminPlayerId = Number(player.id);

      renderAdminPlayersList();

      const freshPlayer = adminPlayers.find(
        p => Number(p.id) === Number(selectedAdminPlayerId)
      );

      if (freshPlayer) {
        await renderAdminPlayerDetails(freshPlayer);
      } else {
        clearAdminPlayerDetailsView();
      }
    });

    listEl.appendChild(item);
  });
}

/* ============================================================
 * RECHTE DETAILANSICHT
 * ============================================================ */

function renderAdminPlayerBaseDetails({ player, relevantGame, currentState, playerGamesText }) {
  const displayName = player.display_name || player.username || "-";

  return `
    <div class="admin-details-grid">
      <div class="admin-detail-card">
        <div class="admin-detail-label">Name</div>
        <div class="admin-detail-value">${displayName}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Username</div>
        <div class="admin-detail-value">${player.username || "-"}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Rolle</div>
        <div class="admin-detail-value">${player.role || "-"}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Gesperrt</div>
        <div
          id="adminToggleBlockedBtn"
          class="admin-detail-value clickable ${player.is_blocked ? "danger-state" : ""}"
          title="Zum Umschalten klicken"
        >
          ${player.is_blocked ? "Ja" : "Nein"}
        </div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Player ID</div>
        <div class="admin-detail-value">${player.id}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Erstellt am</div>
        <div class="admin-detail-value">${formatAdminDateTime(player.created_at)}</div>
      </div>

      <div class="admin-detail-card admin-detail-wide">
        <div class="admin-detail-label">Spielstände vorhanden in</div>
        <div class="admin-detail-value">${playerGamesText}</div>
      </div>

      ${!currentState ? `
        <div class="admin-detail-card admin-detail-wide">
          <div class="admin-detail-label">Info</div>
          <div class="admin-detail-value">
            Für diesen Spieler gibt es im aktuell ausgewählten Spiel
            <strong>${relevantGame?.name || "-"}</strong> noch keinen Spielstand.
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

async function renderAdminPlayerDetails(player) {
  const detailsEl = document.getElementById("adminPlayerDetails");
  const miniGridWrapper = document.getElementById("adminPlayerGameMiniGrid");
  const galleryWrapper = document.getElementById("adminPlayerGalleryWrapper");
  const completedWrapper = document.getElementById("adminPlayerCompletedWrapper");
  const actionBar = document.getElementById("adminPlayerActionBar");
  const createStateBar = document.getElementById("adminPlayerCreateStateBar");

  if (!detailsEl) return;

  if (!player) {
    clearAdminPlayerDetailsView();
    return;
  }

  const relevantGame = adminCurrentGame || null;
  const currentState = getStateForPlayerInAdminGame(player.id);

  const playerGames = getAdminGameStateGamesForPlayer(player.id);
  const playerGamesText = playerGames.length
    ? playerGames.map(game => game.name).join(", ")
    : "-";

  if (!relevantGame || !currentState) {
    detailsEl.innerHTML = renderAdminPlayerBaseDetails({
      player,
      relevantGame,
      currentState: null,
      playerGamesText
    });

    attachAdminPlayerAlwaysAvailableActions(player);

    if (miniGridWrapper) miniGridWrapper.classList.add("hidden");
    if (galleryWrapper) galleryWrapper.classList.add("hidden");
    if (completedWrapper) completedWrapper.classList.add("hidden");

    if (actionBar) {
      actionBar.classList.remove("hidden");
    }

    const resetGameBtn = document.getElementById("adminResetPlayerGameBtn");
    if (resetGameBtn) resetGameBtn.classList.add("hidden");

    if (createStateBar) {
      createStateBar.classList.remove("hidden");
    }

    const createStateBtn = document.getElementById("adminCreatePlayerStateBtn");
    if (createStateBtn) {
      createStateBtn.onclick = async () => {
        await adminCreatePlayerState(player, relevantGame);
      };
    }

    return;
  }

  let activeChallengeText = "-";

  if (currentState.active_challenge_id) {
    activeChallengeText = getChallengeTitleByIdAdmin(currentState.active_challenge_id);
  }

  const score = currentState.score ?? 0;
  const cooldownText = formatAdminCooldown(currentState.cooldown_until);

  const completedRows = getCompletedRowsForPlayerInGame(player.id, relevantGame.id);
  const firstSolverCount = getFirstSolverCountForPlayerInGame(player.id, relevantGame.id);
  const bingoCount = getBingoCountForPlayerInGame(player.id, relevantGame.id);

  let lastActivityLog = null;

  try {
    lastActivityLog = await loadLastActivityLogForPlayerInGame(player.id, relevantGame.id);
  } catch (error) {
    console.warn("Letzte Aktivität konnte nicht geladen werden:", error);
  }

  const lastActivityText = lastActivityLog
    ? formatLastActivityShort(lastActivityLog)
    : "Noch keine Aktivität";

  detailsEl.innerHTML = `
    <div class="admin-details-grid">
      <div class="admin-detail-card">
        <div class="admin-detail-label">Name</div>
        <div class="admin-detail-value">${player.display_name || player.username || "-"}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Username</div>
        <div class="admin-detail-value">${player.username || "-"}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Rolle</div>
        <div class="admin-detail-value">${player.role || "-"}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Gesperrt</div>
        <div
          id="adminToggleBlockedBtn"
          class="admin-detail-value clickable ${player.is_blocked ? "danger-state" : ""}"
          title="Zum Umschalten klicken"
        >
          ${player.is_blocked ? "Ja" : "Nein"}
        </div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Player ID</div>
        <div class="admin-detail-value">${player.id}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Erstellt am</div>
        <div class="admin-detail-value">${formatAdminDateTime(player.created_at)}</div>
      </div>

      <div class="admin-detail-card admin-detail-wide">
        <div class="admin-detail-label">Spielstände vorhanden in</div>
        <div class="admin-detail-value">${playerGamesText}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Ausgewähltes Spiel</div>
        <div class="admin-detail-value">${relevantGame?.name || "-"}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Score</div>
        <div
          id="adminEditScoreBtn"
          class="admin-detail-value clickable"
          title="Zum Bearbeiten klicken"
        >
          ${score}
        </div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Aktive Aufgabe</div>
        <div class="admin-detail-value">${activeChallengeText}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Cooldown</div>
        <div
          id="adminEditCooldownBtn"
          class="admin-detail-value clickable"
          title="Zum Bearbeiten klicken"
        >
          ${cooldownText}
        </div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Abgeschlossene Aufgaben</div>
        <div class="admin-detail-value">${completedRows.length}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">First Solver</div>
        <div class="admin-detail-value">${firstSolverCount}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Bingos</div>
        <div class="admin-detail-value">${bingoCount}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Letzte Aktivität</div>
        <div class="admin-detail-value">${lastActivityText}</div>
      </div>
    </div>
  `;

  attachAdminPlayerAlwaysAvailableActions(player);
  attachAdminPlayerGameActions(player, relevantGame);

  if (actionBar) actionBar.classList.remove("hidden");
  if (createStateBar) createStateBar.classList.add("hidden");

  const resetGameBtn = document.getElementById("adminResetPlayerGameBtn");
  if (resetGameBtn) resetGameBtn.classList.remove("hidden");

  renderAdminPlayerMiniGrid(player, relevantGame);
  renderAdminCompletedChallenges(player, relevantGame);
  renderAdminPlayerGallery(player, relevantGame);
}

/* ============================================================
 * DETAIL EVENT HANDLER
 * ============================================================ */

function attachAdminPlayerAlwaysAvailableActions(player) {
  const toggleBlockedBtn = document.getElementById("adminToggleBlockedBtn");
  const resetPasswordBtn = document.getElementById("adminResetPlayerPasswordBtn");
  const deletePlayerBtn = document.getElementById("adminDeletePlayerBtn");

  if (toggleBlockedBtn) {
    toggleBlockedBtn.onclick = async () => {
      await handleAdminToggleBlocked(player);
    };
  }

  if (resetPasswordBtn) {
    resetPasswordBtn.onclick = async () => {
      await handleAdminResetPlayerPassword(player);
    };
  }

  if (deletePlayerBtn) {
    deletePlayerBtn.onclick = async () => {
      await adminDeletePlayerCompletely(player);
    };
  }
}

function attachAdminPlayerGameActions(player, game) {
  const editScoreBtn = document.getElementById("adminEditScoreBtn");
  const editCooldownBtn = document.getElementById("adminEditCooldownBtn");
  const resetGameBtn = document.getElementById("adminResetPlayerGameBtn");

  if (editScoreBtn) {
    editScoreBtn.onclick = async () => {
      await handleAdminEditScore(player, game);
    };
  }

  if (editCooldownBtn) {
    editCooldownBtn.onclick = async () => {
      await handleAdminEditCooldown(player, game);
    };
  }

  if (resetGameBtn) {
    resetGameBtn.onclick = async () => {
      await adminResetPlayerGameProgress(player, game);
    };
  }
}

/* ============================================================
 * MINI-GRID GROSS
 * ============================================================ */

function renderAdminPlayerMiniGrid(player, game) {
  const wrapperEl = document.getElementById("adminPlayerGameMiniGrid");
  const gridEl = document.getElementById("adminPlayerMiniGrid");

  if (!wrapperEl || !gridEl) return;

  if (!player || !game) {
    wrapperEl.classList.add("hidden");
    gridEl.innerHTML = "";
    return;
  }

  const gameChallenges = adminChallenges
    .filter(challenge => Number(challenge.game_id) === Number(game.id) && challenge.is_active !== false)
    .sort((a, b) => Number(a.position) - Number(b.position));

  const challengeRows = getChallengeRowsForPlayerInGame(player.id, game.id);
  const challengeRowMap = {};

  challengeRows.forEach(row => {
    challengeRowMap[Number(row.challenge_id)] = row;
  });

  const gridSize = game.grid_size || 5;
  const expectedCount = gridSize * gridSize;

  const challengeByPosition = {};
  gameChallenges.forEach(challenge => {
    challengeByPosition[Number(challenge.position)] = challenge;
  });

  gridEl.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
  gridEl.innerHTML = "";

  for (let position = 1; position <= expectedCount; position++) {
    const challenge = challengeByPosition[position];

    if (!challenge) {
      const placeholder = document.createElement("div");
      placeholder.className = "admin-mini-cell placeholder";
      placeholder.innerHTML = `<div class="admin-mini-cell-title"></div>`;
      gridEl.appendChild(placeholder);
      continue;
    }

    const row = challengeRowMap[Number(challenge.id)];
    const isCompleted = row?.status === "completed";
    const isActive = row?.status === "active";
    const isFirstSolver = row?.was_first_solver === true;

    const cell = document.createElement("div");
    cell.className = "admin-mini-cell";

    if (isCompleted) cell.classList.add("completed");
    if (isActive) cell.classList.add("active");
    if (isFirstSolver) cell.classList.add("first-solver");

    cell.innerHTML = `
      <div class="admin-mini-cell-title">
        ${shortenTitle(challenge.title || String(position), 22)}
      </div>
    `;

    cell.title = challenge.title || `Feld ${position}`;
    cell.style.cursor = "pointer";

    cell.addEventListener("click", async () => {
      await showAdminPlayerChallengeDetails(player, game, challenge);
    });

    gridEl.appendChild(cell);
  }

  wrapperEl.classList.remove("hidden");
}

/* ============================================================
 * CHALLENGE DETAIL MODAL
 * ============================================================ */

function openAdminPlayerChallengeModal() {
  const overlay = document.getElementById("adminPlayerChallengeOverlay");
  overlay?.classList.remove("hidden");
}

function closeAdminPlayerChallengeModal() {
  const overlay = document.getElementById("adminPlayerChallengeOverlay");
  overlay?.classList.add("hidden");
  selectedAdminPlayerChallengeContext = null;
}

async function showAdminPlayerChallengeDetails(player, game, challenge) {
  if (!player || !game || !challenge) return;

  const titleEl = document.getElementById("adminPlayerChallengeModalTitle");
  const contentEl = document.getElementById("adminPlayerChallengeModalContent");

  const markBtn = document.getElementById("adminMarkChallengeCompletedBtn");
  const setActiveBtn = document.getElementById("adminSetChallengeActiveBtn");
  const setInactiveBtn = document.getElementById("adminSetChallengeInactiveBtn");
  const resetBtn = document.getElementById("adminResetChallengeBtn");

  if (!titleEl || !contentEl || !markBtn || !setActiveBtn || !setInactiveBtn || !resetBtn) {
    console.error("Admin Player Challenge Modal DOM fehlt.");
    return;
  }

  const row = getPlayerChallengeRow(player.id, game.id, challenge.id);
  const isCompleted = row?.status === "completed";
  const isActive = row?.status === "active";
  const imageUrl = row?.proof_image_path
    ? getPublicImageUrl(row.proof_image_path)
    : null;

  selectedAdminPlayerChallengeContext = {
    player,
    game,
    challenge,
    row
  };

  titleEl.textContent = challenge.title || `Challenge ${challenge.position}`;

  contentEl.innerHTML = `
    <p><strong>Status:</strong> ${
      isCompleted ? "Bestanden" :
      isActive ? "Aktiv" :
      "Nicht bestanden"
    }</p>

    <div class="admin-challenge-meta">
      <div class="admin-challenge-meta-row">
        <strong>Position:</strong> ${challenge.position ?? "-"}
      </div>

      <div class="admin-challenge-meta-row">
        <strong>Abgeschlossen am:</strong> ${
          row?.completed_at ? formatAdminDateTime(row.completed_at) : "-"
        }
      </div>

      <div class="admin-challenge-meta-row">
        <strong>Punkte:</strong> ${row?.points_awarded ?? 0}
      </div>

      <div class="admin-challenge-meta-row">
        <strong>First Solver:</strong> ${row?.was_first_solver ? "Ja" : "Nein"}
      </div>
    </div>

    ${imageUrl ? `<img src="${imageUrl}" class="admin-challenge-image" alt="Beweisfoto" />` : ""}
  `;

  markBtn.style.display = "none";
  setActiveBtn.style.display = "none";
  setInactiveBtn.style.display = "none";
  resetBtn.style.display = "none";

  if (isCompleted) {
    resetBtn.style.display = "inline-block";
  } else if (isActive) {
    setInactiveBtn.style.display = "inline-block";
    markBtn.style.display = "inline-block";
  } else {
    setActiveBtn.style.display = "inline-block";
    markBtn.style.display = "inline-block";
  }

  openAdminPlayerChallengeModal();
}

/* ============================================================
 * COMPLETED LISTE
 * ============================================================ */

function renderAdminCompletedChallenges(player, game) {
  const wrapperEl = document.getElementById("adminPlayerCompletedWrapper");
  const listEl = document.getElementById("adminPlayerCompletedList");

  if (!wrapperEl || !listEl) return;

  if (!player || !game) {
    wrapperEl.classList.add("hidden");
    listEl.innerHTML = "";
    return;
  }

  const completedRows = getCompletedRowsForPlayerInGame(player.id, game.id);
  const bingoRows = adminPlayerBingos.filter(
    row =>
      Number(row.player_id) === Number(player.id) &&
      Number(row.game_id) === Number(game.id)
  );

  const combined = [];

  completedRows.forEach(row => {
    const challenge = getChallengeByIdAdmin(row.challenge_id);

    combined.push({
      type: "challenge",
      title: challenge?.title || `Challenge ${row.challenge_id}`,
      completedAt: row.completed_at,
      points: row.points_awarded || 0,
      wasFirst: row.was_first_solver === true,
      proofImagePath: row.proof_image_path || null,
      challengeId: row.challenge_id
    });
  });

  const allGameBingos = adminPlayerBingos
    .filter(row => Number(row.game_id) === Number(game.id))
    .sort((a, b) => new Date(a.awarded_at) - new Date(b.awarded_at));

  bingoRows.forEach(row => {
    const firstRowForLine = allGameBingos.find(
      r => String(r.line_key) === String(row.line_key)
    );

    combined.push({
      type: "bingo",
      title: `${formatAdminBingoLineName(row.line_key, game.grid_size || 5)} Bingo`,
      completedAt: row.awarded_at,
      points: row.bonus_points || 0,
      wasFirst: firstRowForLine && Number(firstRowForLine.id) === Number(row.id),
      proofImagePath: null,
      challengeId: null
    });
  });

  combined.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  if (!combined.length) {
    wrapperEl.classList.remove("hidden");
    listEl.innerHTML = `<p class="admin-details-empty">Noch keine Aufgaben oder Bingos abgeschlossen.</p>`;
    return;
  }

  let html = `<div class="admin-completion-list">`;

  combined.forEach(entry => {
    const clickable = entry.proofImagePath ? "clickable" : "";

    html += `
      <div class="admin-completion-row">
        <div class="admin-completion-left">
          <div
            class="admin-completion-name ${clickable}"
            ${entry.challengeId ? `data-challenge-id="${entry.challengeId}"` : ""}
          >
            ${entry.type === "bingo" ? "🏆 " : ""}${entry.title}
            ${entry.wasFirst ? `<span class="admin-completion-star">⭐</span>` : ""}
          </div>
          <div class="admin-completion-meta">
            ${formatAdminDateTime(entry.completedAt)}
          </div>
        </div>

        <div class="admin-completion-right">
          <div class="admin-completion-points">${entry.points}P</div>
        </div>
      </div>
    `;
  });

  html += `</div>`;

  listEl.innerHTML = html;
  wrapperEl.classList.remove("hidden");

  listEl.querySelectorAll(".admin-completion-name.clickable").forEach(el => {
    el.addEventListener("click", () => {
      const challengeId = Number(el.dataset.challengeId);
      if (!challengeId) return;
      setAdminGalleryToChallenge(player.id, game.id, challengeId);
    });
  });
}

/* ============================================================
 * GALERIE
 * ============================================================ */

function buildAdminGalleryEntries(playerId, gameId) {
  return getCompletedRowsForPlayerInGame(playerId, gameId)
    .filter(row => row.proof_image_path)
    .map(row => {
      const challenge = getChallengeByIdAdmin(row.challenge_id);

      return {
        challengeId: row.challenge_id,
        challengeTitle: challenge?.title || `Challenge ${row.challenge_id}`,
        completedAt: row.completed_at,
        proofImagePath: row.proof_image_path,
        pointsAwarded: row.points_awarded || 0,
        wasFirstSolver: row.was_first_solver === true
      };
    });
}

function renderAdminPlayerGallery(player, game) {
  const wrapperEl = document.getElementById("adminPlayerGalleryWrapper");
  const galleryEl = document.getElementById("adminPlayerGallery");

  if (!wrapperEl || !galleryEl) return;

  if (!player || !game) {
    wrapperEl.classList.add("hidden");
    galleryEl.innerHTML = "";
    currentAdminPlayerGalleryEntries = [];
    currentAdminPlayerGalleryIndex = 0;
    return;
  }

  currentAdminPlayerGalleryEntries = buildAdminGalleryEntries(player.id, game.id);
  currentAdminPlayerGalleryIndex = 0;

  if (!currentAdminPlayerGalleryEntries.length) {
    wrapperEl.classList.remove("hidden");
    galleryEl.innerHTML = `<p class="admin-details-empty">Keine Bilder im relevanten Spiel vorhanden.</p>`;
    return;
  }

  wrapperEl.classList.remove("hidden");
  renderAdminGalleryCurrent();
}

function renderAdminGalleryCurrent() {
  const galleryEl = document.getElementById("adminPlayerGallery");
  if (!galleryEl) return;

  if (!currentAdminPlayerGalleryEntries.length) {
    galleryEl.innerHTML = `<p class="admin-details-empty">Keine Bilder vorhanden.</p>`;
    return;
  }

  const entry = currentAdminPlayerGalleryEntries[currentAdminPlayerGalleryIndex];
  const imageUrl = getPublicImageUrl(entry.proofImagePath);

  galleryEl.innerHTML = `
    <div class="admin-gallery-caption">
      <strong>${entry.challengeTitle}</strong>
      <span class="admin-gallery-time">(${formatAdminDateTime(entry.completedAt)})</span>
    </div>

    <div class="admin-gallery-image-container">
      ${currentAdminPlayerGalleryIndex > 0 ? `<div class="admin-gallery-arrow left" id="adminGalleryPrevBtn">‹</div>` : ""}
      <img src="${imageUrl}" class="admin-gallery-image" alt="Beweisfoto" />
      ${currentAdminPlayerGalleryIndex < currentAdminPlayerGalleryEntries.length - 1 ? `<div class="admin-gallery-arrow right" id="adminGalleryNextBtn">›</div>` : ""}
    </div>
  `;

  document.getElementById("adminGalleryPrevBtn")?.addEventListener("click", () => {
    if (currentAdminPlayerGalleryIndex > 0) {
      currentAdminPlayerGalleryIndex--;
      renderAdminGalleryCurrent();
    }
  });

  document.getElementById("adminGalleryNextBtn")?.addEventListener("click", () => {
    if (currentAdminPlayerGalleryIndex < currentAdminPlayerGalleryEntries.length - 1) {
      currentAdminPlayerGalleryIndex++;
      renderAdminGalleryCurrent();
    }
  });
}

function setAdminGalleryToChallenge(playerId, gameId, challengeId) {
  currentAdminPlayerGalleryEntries = buildAdminGalleryEntries(playerId, gameId);

  const index = currentAdminPlayerGalleryEntries.findIndex(
    entry => Number(entry.challengeId) === Number(challengeId)
  );

  if (index >= 0) {
    currentAdminPlayerGalleryIndex = index;
    renderAdminGalleryCurrent();
  }
}