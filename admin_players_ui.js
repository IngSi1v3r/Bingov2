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
let adminPlayerDrawerOpen = false;
let adminPlayerDrawerEventsBound = false;

let currentAdminPlayerGallerySelectedChallengeId = null;
let currentAdminPlayerGalleryPlayerId = null;
let currentAdminPlayerGalleryGameId = null;
let adminPlayerDetailsRenderToken = 0;

/* ============================================================
 * LAYOUT / GRUNDSTRUKTUR
 * ============================================================ */

function ensureAdminPlayersTabLayout() {
  const tabEl = document.getElementById("tab-players");
  if (!tabEl) return;

  if (document.getElementById("adminPlayersSplitLayout")) {
    ensureAdminPlayerStatesModal();
    attachAdminPlayerDrawerEvents();
    updateAdminPlayerRailLabel();
    requestAnimationFrame(updateAdminPlayerDrawerTopOffset);
    return;
  }

  tabEl.innerHTML = `
    <h2>Spieler</h2>

    <div
      class="admin-split-layout admin-players-layout"
      id="adminPlayersSplitLayout"
    >
      <div
        id="adminPlayerDrawerBackdrop"
        class="admin-player-drawer-backdrop hidden"
        aria-hidden="true"
      ></div>

      <aside
        id="adminPlayerListPanel"
        class="admin-panel admin-player-list-panel"
      >
        <button
          id="adminPlayerRailCurrent"
          class="admin-player-rail-current"
          type="button"
          aria-label="Spielerliste öffnen"
          aria-expanded="false"
        >
          <span
            id="adminPlayerRailName"
            class="admin-player-rail-name"
          >
            Spieler
          </span>
        </button>

        <div class="admin-panel-header admin-player-list-header">
          <h3>Alle Spieler</h3>
        </div>

        <div
          id="adminPlayersList"
          class="admin-list admin-player-drawer-list"
        >
          <p>Spieler werden geladen...</p>
        </div>
      </aside>

      <div class="admin-panel admin-player-detail-panel">
        <div class="admin-panel-header">
          <h3>Spieler-Details</h3>
        </div>

        <div id="adminPlayerDetails" class="admin-details">
          <p>Wähle links einen Spieler aus.</p>
        </div>

        <div
          id="adminPlayerCreateStateBar"
          class="admin-player-action-bar hidden"
        >
          <button id="adminCreatePlayerStateBtn" type="button">
            Spielstand anlegen
          </button>
        </div>

        <div
          id="adminPlayerGameMiniGrid"
          class="admin-mini-grid-wrapper hidden"
        >
          <div
            id="adminPlayerMiniGrid"
            class="admin-mini-grid"
          ></div>
        </div>

        <div
          id="adminPlayerGalleryWrapper"
          class="admin-gallery-wrapper hidden"
        >
          <div id="adminPlayerGallery"></div>
        </div>

        <div
          id="adminPlayerCompletedWrapper"
          class="admin-completed-wrapper hidden"
        >
          

          <div id="adminPlayerCompletedList"></div>
        </div>

        <div
          id="adminPlayerActionBar"
          class="admin-player-action-bar hidden"
        >
          <button
            id="adminPromotePlayerBtn"
            type="button"
            class="secondary-btn"
          >
            Zu Admin machen
          </button>

          <button
            id="adminResetPlayerPasswordBtn"
            type="button"
            class="secondary-btn"
          >
            Passwort zurücksetzen
          </button>

          <button
            id="adminResetPlayerGameBtn"
            type="button"
          >
            Fortschritt zurücksetzen
          </button>

          <button
            id="adminDeletePlayerBtn"
            type="button"
            class="danger-btn"
          >
            Spieler löschen
          </button>
        </div>
      </div>
    </div>
  `;

  ensureAdminPlayerStatesModal();
  attachAdminPlayerDrawerEvents();
  updateAdminPlayerRailLabel();
  requestAnimationFrame(updateAdminPlayerDrawerTopOffset);
}


function ensureAdminPlayerStatesModal() {
  if (document.getElementById("adminPlayerStatesOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "adminPlayerStatesOverlay";
  overlay.className = "modal-overlay hidden";

  overlay.innerHTML = `
    <div class="modal admin-player-states-modal">
      <button id="closeAdminPlayerStatesBtn" class="modal-close-btn" type="button">×</button>
      <h2 id="adminPlayerStatesTitle">Spielstände</h2>
      <div id="adminPlayerStatesContent" class="rules-content"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  document
    .getElementById("closeAdminPlayerStatesBtn")
    ?.addEventListener("click", closeAdminPlayerStatesModal);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) closeAdminPlayerStatesModal();
  });
}

function closeAdminPlayerStatesModal() {
  document.getElementById("adminPlayerStatesOverlay")?.classList.add("hidden");
}

function openAdminPlayerStatesModal(player, playerGames) {
  ensureAdminPlayerStatesModal();

  const overlay = document.getElementById("adminPlayerStatesOverlay");
  const titleEl = document.getElementById("adminPlayerStatesTitle");
  const contentEl = document.getElementById("adminPlayerStatesContent");
  if (!overlay || !titleEl || !contentEl) return;

  const playerName = player?.display_name || player?.username || `Spieler ${player?.id ?? ""}`;
  titleEl.textContent = `Spielstände – ${playerName}`;
  contentEl.innerHTML = "";

  if (!playerGames.length) {
    const empty = document.createElement("p");
    empty.className = "admin-details-empty";
    empty.textContent = "Für diesen Spieler sind noch keine Spielstände vorhanden.";
    contentEl.appendChild(empty);
  } else {
    const list = document.createElement("div");
    list.className = "admin-player-state-game-list";

    playerGames.forEach(game => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "admin-player-state-game-row";
      row.textContent = game.name || `Spiel ${game.id}`;
      row.title = `${game.name || `Spiel ${game.id}`} im Adminpanel auswählen`;

      row.addEventListener("click", async () => {
        adminCurrentGameId = game.id;
        adminCurrentGame = game;
        saveGameIdToLocalStorageAdmin(adminCurrentGameId);
        updateAdminCurrentGameDisplay();
        closeAdminPlayerStatesModal();

        await initializeAdminPlayersTab();
      });

      list.appendChild(row);
    });

    contentEl.appendChild(list);
  }

  overlay.classList.remove("hidden");
}

async function loadLastGlobalActivityLogForPlayer(playerId) {
  const { data, error } = await supabaseClient
    .from("activity_logs")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("Globale letzte Aktivität konnte nicht geladen werden:", error);
    return null;
  }

  return data || null;
}

function attachAdminPlayerStatesCard(player, playerGames) {
  const statesBtn = document.getElementById("adminPlayerStatesBtn");
  if (!statesBtn) return;

  statesBtn.onclick = () => {
    openAdminPlayerStatesModal(player, playerGames);
  };
}

function attachAdminPlayerGlobalActivityCard(globalActivityLog) {
  const activityBtn = document.getElementById("adminPlayerGlobalActivityBtn");
  if (!activityBtn || !globalActivityLog) return;

  activityBtn.onclick = async () => {
    if (typeof openAdminLogEntry === "function") {
      await openAdminLogEntry(globalActivityLog);
    }
  };
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

      <div class="modal-actions admin-player-challenge-actions" id="adminChallengeActions">
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
 * MOBILE PLAYER DRAWER
 * ============================================================ */

function isAdminPlayerMobileLayout() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function updateAdminPlayerDrawerTopOffset() {
  const header = document.querySelector(".admin-sticky-header");

  const headerHeight = header
    ? Math.ceil(header.getBoundingClientRect().height)
    : 100;

  document.documentElement.style.setProperty(
    "--admin-player-drawer-top",
    `${headerHeight}px`
  );
}

function updateAdminPlayerRailLabel() {
  const railNameEl = document.getElementById("adminPlayerRailName");
  const railButton = document.getElementById("adminPlayerRailCurrent");

  if (!railNameEl) return;

  const selectedPlayer = Array.isArray(adminPlayers)
    ? adminPlayers.find(
        player => Number(player.id) === Number(selectedAdminPlayerId)
      )
    : null;

  const displayName = selectedPlayer
    ? (selectedPlayer.display_name || selectedPlayer.username || `Spieler ${selectedPlayer.id}`)
    : "Spieler";

  railNameEl.textContent = displayName;

  if (railButton) {
    railButton.setAttribute(
      "aria-label",
      selectedPlayer
        ? `Spielerliste öffnen. Aktuell ausgewählt: ${displayName}`
        : "Spielerliste öffnen"
    );
    railButton.setAttribute("aria-expanded", adminPlayerDrawerOpen ? "true" : "false");
  }
}

function openAdminPlayerDrawer() {
  if (!isAdminPlayerMobileLayout()) return;

  const layout = document.getElementById("adminPlayersSplitLayout");
  const backdrop = document.getElementById("adminPlayerDrawerBackdrop");
  const panel = document.getElementById("adminPlayerListPanel");

  if (!layout || !panel) return;

  updateAdminPlayerDrawerTopOffset();

  adminPlayerDrawerOpen = true;
  layout.classList.add("drawer-open");
  panel.classList.add("drawer-open");
  document.getElementById("adminPlayerRailCurrent")?.setAttribute("aria-expanded", "true");

  if (backdrop) {
    backdrop.classList.remove("hidden");
  }
}

function closeAdminPlayerDrawer() {
  const layout = document.getElementById("adminPlayersSplitLayout");
  const backdrop = document.getElementById("adminPlayerDrawerBackdrop");
  const panel = document.getElementById("adminPlayerListPanel");

  adminPlayerDrawerOpen = false;

  layout?.classList.remove("drawer-open");
  panel?.classList.remove("drawer-open");
  backdrop?.classList.add("hidden");
  document.getElementById("adminPlayerRailCurrent")?.setAttribute("aria-expanded", "false");
}

function toggleAdminPlayerDrawer() {
  if (adminPlayerDrawerOpen) {
    closeAdminPlayerDrawer();
  } else {
    openAdminPlayerDrawer();
  }
}

function attachAdminPlayerDrawerEvents() {
  if (adminPlayerDrawerEventsBound) return;

  const railButton = document.getElementById("adminPlayerRailCurrent");
  const backdrop = document.getElementById("adminPlayerDrawerBackdrop");

  if (!railButton || !backdrop) return;

  railButton.addEventListener("click", event => {
    if (!isAdminPlayerMobileLayout()) return;

    event.preventDefault();
    event.stopPropagation();
    toggleAdminPlayerDrawer();
  });

  backdrop.addEventListener("click", () => {
    closeAdminPlayerDrawer();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && adminPlayerDrawerOpen) {
      closeAdminPlayerDrawer();
    }
  });

  window.addEventListener("resize", () => {
    updateAdminPlayerDrawerTopOffset();

    if (!isAdminPlayerMobileLayout() && adminPlayerDrawerOpen) {
      closeAdminPlayerDrawer();
    }
  });

  adminPlayerDrawerEventsBound = true;
}

window.addEventListener("resize", () => {
  updateAdminPlayerDrawerTopOffset();

  if (!isAdminPlayerMobileLayout() && adminPlayerDrawerOpen) {
    closeAdminPlayerDrawer();
  }
});


/* ============================================================
 * CLEAR / EMPTY STATE
 * ============================================================ */

function clearAdminPlayerDetailsView() {
  adminPlayerDetailsRenderToken++;
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

  currentAdminPlayerGallerySelectedChallengeId = null;
  currentAdminPlayerGalleryPlayerId = null;
  currentAdminPlayerGalleryGameId = null;
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
    updateAdminPlayerRailLabel();
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
            ${player.role === "admin" ? `<span class="admin-badge admin-role">Admin</span>` : ""}
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

    item.addEventListener("click", async event => {
  event.stopPropagation();

  /*
   * Im geschlossenen mobilen Zustand öffnet der erste Klick
   * nur die breite Spielerliste. Er wählt noch keinen Spieler.
   */
  if (isAdminPlayerMobileLayout() && !adminPlayerDrawerOpen) {
    openAdminPlayerDrawer();
    return;
  }

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

  if (isAdminPlayerMobileLayout()) {
    closeAdminPlayerDrawer();
  }
});

    listEl.appendChild(item);
  });

  updateAdminPlayerRailLabel();
}

/* ============================================================
 * RECHTE DETAILANSICHT
 * ============================================================ */

function renderAdminPlayerBaseDetails({
  player,
  relevantGame,
  currentState,
  playerGames,
  globalActivityText,
  globalActivityLog
}) {
  return `
    <div class="admin-details-grid admin-player-details-grid">
      <div class="admin-detail-card">
        <div class="admin-detail-label">ID</div>
        <div class="admin-detail-value">${player.id}</div>
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
        <div class="admin-detail-label">Spielstände</div>
        <div
          id="adminPlayerStatesBtn"
          class="admin-detail-value clickable"
          title="Spielstände anzeigen"
        >
          ${playerGames.length} ${playerGames.length === 1 ? "Spiel" : "Spiele"}
        </div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Zuletzt aktiv</div>
        <div
          id="adminPlayerGlobalActivityBtn"
          class="admin-detail-value admin-player-activity-value ${globalActivityLog ? "clickable" : ""}"
          title="${globalActivityLog ? "Logeintrag öffnen" : ""}"
        >${globalActivityText}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Erstellt</div>
        <div class="admin-detail-value admin-player-date-value">${formatAdminDateTime(player.created_at)}</div>
      </div>

      ${!currentState ? `
        <div class="admin-detail-card admin-player-detail-full">
          <div class="admin-detail-label">Info</div>
          <div class="admin-detail-value admin-player-info-value">
            Im aktuell ausgewählten Spiel ${relevantGame?.name || "-"}
            ist noch kein Spielstand vorhanden.
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

async function renderAdminPlayerDetails(player) {
  const renderToken = ++adminPlayerDetailsRenderToken;
  const requestedPlayerId = Number(player?.id);
  const requestedGameId = Number(adminCurrentGame?.id ?? adminCurrentGameId);

  const isStaleRender = () =>
    renderToken !== adminPlayerDetailsRenderToken ||
    Number(selectedAdminPlayerId) !== requestedPlayerId ||
    Number(adminCurrentGame?.id ?? adminCurrentGameId) !== requestedGameId;
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

  let globalActivityLog = null;
  try {
    globalActivityLog = await loadLastGlobalActivityLogForPlayer(player.id);
  } catch (error) {
    console.warn("Globale letzte Aktivität konnte nicht geladen werden:", error);
  }

  if (isStaleRender()) return;

  const globalActivityText = globalActivityLog
    ? formatAdminDateTime(globalActivityLog.created_at)
    : "Noch keine Aktivität";

  if (!relevantGame || !currentState) {
    detailsEl.innerHTML = renderAdminPlayerBaseDetails({
      player,
      relevantGame,
      currentState: null,
      playerGames,
      globalActivityText,
      globalActivityLog
    });

    attachAdminPlayerAlwaysAvailableActions(player);
    attachAdminPlayerStatesCard(player, playerGames);
    attachAdminPlayerGlobalActivityCard(globalActivityLog);

    if (miniGridWrapper) miniGridWrapper.classList.add("hidden");
    renderAdminPlayerGallery(player, relevantGame);
    if (completedWrapper) completedWrapper.classList.add("hidden");
    if (actionBar) actionBar.classList.remove("hidden");

    const resetGameBtn = document.getElementById("adminResetPlayerGameBtn");
    if (resetGameBtn) resetGameBtn.classList.add("hidden");

    if (createStateBar) createStateBar.classList.remove("hidden");

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
    console.warn("Letzte Aktivität im Spiel konnte nicht geladen werden:", error);
  }

  if (isStaleRender()) return;

  const lastActivityText = lastActivityLog
    ? formatLastActivityShort(lastActivityLog)
    : "Noch keine Aktivität";

  detailsEl.innerHTML = `
    <div class="admin-details-grid admin-player-details-grid">
      <div class="admin-detail-card">
        <div class="admin-detail-label">ID</div>
        <div class="admin-detail-value">${player.id}</div>
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
        <div class="admin-detail-label">Spielstände</div>
        <div
          id="adminPlayerStatesBtn"
          class="admin-detail-value clickable"
          title="Spielstände anzeigen"
        >
          ${playerGames.length} ${playerGames.length === 1 ? "Spiel" : "Spiele"}
        </div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Zuletzt aktiv</div>
        <div
          id="adminPlayerGlobalActivityBtn"
          class="admin-detail-value admin-player-activity-value ${globalActivityLog ? "clickable" : ""}"
          title="${globalActivityLog ? "Logeintrag öffnen" : ""}"
        >${globalActivityText}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Erstellt</div>
        <div class="admin-detail-value admin-player-date-value">${formatAdminDateTime(player.created_at)}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Score</div>
        <div id="adminEditScoreBtn" class="admin-detail-value clickable" title="Zum Bearbeiten klicken">${score}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Aufgabe</div>
        <div class="admin-detail-value" title="${activeChallengeText}">${activeChallengeText}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Cooldown</div>
        <div id="adminEditCooldownBtn" class="admin-detail-value clickable" title="Zum Bearbeiten klicken">${cooldownText}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Abgeschlossen</div>
        <div class="admin-detail-value">${completedRows.length}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">First</div>
        <div class="admin-detail-value">${firstSolverCount}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Bingos</div>
        <div class="admin-detail-value">${bingoCount}</div>
      </div>

      <div class="admin-detail-card admin-player-detail-full">
        <div class="admin-detail-label">Letzte Aktivität im Spiel</div>
        <div class="admin-detail-value admin-player-activity-value">${lastActivityText}</div>
      </div>
    </div>
  `;

  attachAdminPlayerAlwaysAvailableActions(player);
  attachAdminPlayerStatesCard(player, playerGames);
  attachAdminPlayerGlobalActivityCard(globalActivityLog);
  attachAdminPlayerGameActions(player, relevantGame);
  attachAdminPlayerStatesCard(player, playerGames);

  if (actionBar) actionBar.classList.remove("hidden");
  if (createStateBar) createStateBar.classList.add("hidden");

  const resetGameBtn = document.getElementById("adminResetPlayerGameBtn");
  if (resetGameBtn) resetGameBtn.classList.remove("hidden");

  if (isStaleRender()) return;

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
  const promotePlayerBtn = document.getElementById("adminPromotePlayerBtn");


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

  if (promotePlayerBtn) {
    promotePlayerBtn.onclick = async () => {
      await handleAdminPromotePlayer(player);
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

  gridEl.classList.remove(
    "grid-size-3",
    "grid-size-4",
    "grid-size-5",
    "grid-size-6",
    "grid-size-7"
  );

  gridEl.classList.add(`grid-size-${gridSize}`);
  gridEl.style.gridTemplateColumns =
    `repeat(${gridSize}, minmax(0, 1fr))`;
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

      <div class="admin-mini-cell-points">
        ${
          challenge.points === null || challenge.points === undefined
            ? "?"
            : `${challenge.points}P`
        }
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

/**
 * Öffnet die zugehörige Aufnahme im globalen Galerie-Tab.
 *
 * Der Galerie-Tab wird zuerst aktiviert und nötigenfalls initialisiert.
 * Anschließend werden bestehende Filter zurückgesetzt, damit der gesuchte
 * Eintrag sicher Teil der sichtbaren Galerie ist, und der Viewer wird direkt
 * auf das betreffende Bild gesetzt.
 */
async function openAdminPlayerChallengeImageInGallery(row) {
  if (!row?.id) return;

  closeAdminPlayerChallengeModal();

  if (typeof activateAdminTabByName === "function") {
    await activateAdminTabByName("grid");
  } else {
    document.querySelector('.admin-tab[data-tab="grid"]')?.click();
  }

  if (typeof initializeAdminGalleryTab === "function") {
    await initializeAdminGalleryTab();
  }

  if (!Array.isArray(adminGalleryEntries)) return;

  const entryId = `normal-${row.id}`;
  const targetEntry = adminGalleryEntries.find(entry => entry.id === entryId);
  if (!targetEntry) {
    console.warn("Galeriebild für Player-Challenge nicht gefunden:", row.id);
    return;
  }

  /*
   * Alte Filter dürfen das direkt angesprungene Bild nicht ausblenden.
   * Deshalb wird für den Sprung einmal die vollständige Galerie verwendet.
   */
  if (typeof resetAdminGalleryFilters === "function") {
    resetAdminGalleryFilters();
  } else {
    adminGalleryFilteredEntries = adminGalleryEntries.slice();
    if (typeof renderAdminGalleryFilterOptions === "function") {
      renderAdminGalleryFilterOptions();
    }
    if (typeof renderAdminGalleryGrid === "function") {
      renderAdminGalleryGrid();
    }
  }

  adminGallerySelectedEntryId = entryId;
  adminGallerySelectedIndex = adminGalleryFilteredEntries.findIndex(
    entry => entry.id === entryId
  );

  if (adminGallerySelectedIndex < 0) {
    adminGalleryFilteredEntries = adminGalleryEntries.slice();
    adminGallerySelectedIndex = adminGalleryFilteredEntries.findIndex(
      entry => entry.id === entryId
    );
  }

  if (typeof openAdminGalleryViewer === "function") {
    openAdminGalleryViewer();
  }
}

/**
 * Rendert das Info-Modal für ein einzelnes Feld im Spieler-Grid.
 *
 * Die Informationen unterscheiden bewusst zwischen bereits abgeschlossenem
 * und noch offenem Feld. Bei offenen Feldern wird zusätzlich geprüft, ob die
 * Aufgabe im Spiel global schon von jemandem gelöst wurde. Solange das nicht
 * der Fall ist, werden die möglichen First-Solver-Punkte doppelt angezeigt.
 */
async function showAdminPlayerChallengeDetails(player, game, challenge) {
  if (!player || !game || !challenge) return;

  const titleEl = document.getElementById("adminPlayerChallengeModalTitle");
  const contentEl = document.getElementById("adminPlayerChallengeModalContent");
  const actionsEl = document.getElementById("adminChallengeActions");

  const markBtn = document.getElementById("adminMarkChallengeCompletedBtn");
  const setActiveBtn = document.getElementById("adminSetChallengeActiveBtn");
  const setInactiveBtn = document.getElementById("adminSetChallengeInactiveBtn");
  const resetBtn = document.getElementById("adminResetChallengeBtn");

  if (!titleEl || !contentEl || !actionsEl || !markBtn || !setActiveBtn || !setInactiveBtn || !resetBtn) {
    console.error("Admin Player Challenge Modal DOM fehlt.");
    return;
  }

  const row = getPlayerChallengeRow(player.id, game.id, challenge.id);
  const isCompleted = row?.status === "completed";
  const isActive = row?.status === "active";

  const isGloballyCompleted = adminPlayerChallenges.some(candidate =>
    Number(candidate.game_id) === Number(game.id) &&
    Number(candidate.challenge_id) === Number(challenge.id) &&
    candidate.status === "completed"
  );

  const basePoints = Number(challenge.points) || 0;
  const possiblePoints = isGloballyCompleted ? basePoints : basePoints * 2;

  const statusText = isCompleted
    ? "Bestanden"
    : isActive
      ? "Aktiv"
      : "Nicht bestanden";

  const statusClass = isCompleted
    ? "completed"
    : isActive
      ? "active"
      : "open";

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
    <div class="admin-challenge-info-list">
      <div class="admin-challenge-info-row">
        <span class="admin-challenge-info-label">Status</span>
        <span class="admin-challenge-status ${statusClass}">${statusText}</span>
      </div>

      ${isCompleted ? `
        <div class="admin-challenge-info-row">
          <span class="admin-challenge-info-label">Abgeschlossen am</span>
          <span class="admin-challenge-info-value">${
            row?.completed_at ? formatAdminDateTime(row.completed_at) : "-"
          }</span>
        </div>

        <div class="admin-challenge-info-row">
          <span class="admin-challenge-info-label">Punkte</span>
          <span class="admin-challenge-info-value">${row?.points_awarded ?? 0}</span>
        </div>

        <div class="admin-challenge-info-row">
          <span class="admin-challenge-info-label">First Solver</span>
          <span class="admin-challenge-info-value">${row?.was_first_solver ? "Ja" : "Nein"}</span>
        </div>
      ` : `
        <div class="admin-challenge-info-row">
          <span class="admin-challenge-info-label">Mögliche Punkte</span>
          <span class="admin-challenge-info-value admin-challenge-points-value">${possiblePoints}</span>
        </div>

        <div class="admin-challenge-info-row">
          <span class="admin-challenge-info-label">Aufgabe bereits gelöst</span>
          <span class="admin-challenge-info-value">${isGloballyCompleted ? "Ja" : "Nein"}</span>
        </div>
      `}
    </div>

    ${imageUrl ? `
      <div
        id="adminPlayerChallengeImageLink"
        class="admin-challenge-image-frame"
        role="button"
        tabindex="0"
        title="Bild in der Galerie öffnen"
        aria-label="Bild in der Galerie öffnen"
      >
        <div class="admin-challenge-image-loading visible" aria-hidden="true">
          <div class="admin-challenge-image-spinner"></div>
        </div>
        <img
          id="adminPlayerChallengeImage"
          src="${imageUrl}"
          class="admin-challenge-image loading"
          alt="Beweisfoto zu ${String(challenge.title || "Aufgabe").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")}"
        />
      </div>
    ` : ""}
  `;

  if (imageUrl) {
    const imageLink = document.getElementById("adminPlayerChallengeImageLink");
    const imageEl = document.getElementById("adminPlayerChallengeImage");
    const loadingEl = imageLink?.querySelector(".admin-challenge-image-loading");

    const finishImageLoading = () => {
      imageEl?.classList.remove("loading");
      loadingEl?.classList.remove("visible");
    };

    if (imageEl?.complete) {
      finishImageLoading();
    } else {
      imageEl?.addEventListener("load", finishImageLoading, { once: true });
      imageEl?.addEventListener("error", finishImageLoading, { once: true });
    }

    const openImageInGallery = async () => {
      await openAdminPlayerChallengeImageInGallery(row);
    };

    imageLink?.addEventListener("click", openImageInGallery);
    imageLink?.addEventListener("keydown", async event => {
      if (event.key !== "Enter" && event.key !== " ") return;

      event.preventDefault();
      await openImageInGallery();
    });
  }

  /* Zuerst alle Aktionen ausblenden, danach nur sinnvolle freigeben. */
  [markBtn, setActiveBtn, setInactiveBtn, resetBtn].forEach(button => {
    button.style.display = "none";
  });

  if (isCompleted) {
    resetBtn.style.display = "inline-flex";
  } else if (isActive) {
    setInactiveBtn.style.display = "inline-flex";
    markBtn.style.display = "inline-flex";
  } else {
    setActiveBtn.style.display = "inline-flex";
    markBtn.style.display = "inline-flex";
  }

  const visibleButtons = [markBtn, setActiveBtn, setInactiveBtn, resetBtn]
    .filter(button => button.style.display !== "none");

  actionsEl.classList.toggle("two-actions", visibleButtons.length === 2);

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

  let html = `<div class="admin-completion-list admin-player-completion-list">`;

combined.forEach((entry, index) => {
  const clickable = entry.proofImagePath ? "clickable" : "";

  /*
   * combined ist nach Datum absteigend sortiert.
   * Dadurch erhält der älteste Eintrag unten die Nummer 1
   * und der neueste Eintrag oben die höchste Nummer.
   */
  const sequenceNumber = combined.length - index;

  html += `
      <div
        class="admin-completion-row admin-player-completion-row"
        ${entry.challengeId ? `data-challenge-id="${entry.challengeId}"` : ""}
      >
        <div class="admin-player-completion-number">
          ${sequenceNumber}
        </div>

        <div
          class="admin-completion-name admin-player-completion-title ${clickable}"
          ${entry.challengeId ? `data-challenge-id="${entry.challengeId}"` : ""}
          title="${entry.title}"
        >
          ${entry.type === "bingo" ? "🏆 " : ""}
          <span class="admin-player-completion-title-text">${entry.title}</span>
          ${entry.wasFirst ? `<span class="admin-completion-star">⭐</span>` : ""}
        </div>

        <div class="admin-completion-meta admin-player-completion-date">
          ${formatAdminDateTime(entry.completedAt)}
        </div>

        <div class="admin-completion-points admin-player-completion-points">
          ${entry.points}P
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

function buildAdminPlayerGalleryEntries(playerId, gameId) {
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
    currentAdminPlayerGallerySelectedChallengeId = null;
    currentAdminPlayerGalleryPlayerId = null;
    currentAdminPlayerGalleryGameId = null;

    return;
  }

  const playerChanged =
    Number(currentAdminPlayerGalleryPlayerId) !== Number(player.id);

  const gameChanged =
    Number(currentAdminPlayerGalleryGameId) !== Number(game.id);

  /*
   * Bei einem echten Spieler- oder Spielwechsel
   * darf die alte Bildauswahl nicht übernommen werden.
   */
  if (playerChanged || gameChanged) {
    currentAdminPlayerGallerySelectedChallengeId = null;
    currentAdminPlayerGalleryIndex = 0;
  }

  currentAdminPlayerGalleryPlayerId = player.id;
  currentAdminPlayerGalleryGameId = game.id;

  currentAdminPlayerGalleryEntries = buildAdminPlayerGalleryEntries(
    player.id,
    game.id
  );

  if (!currentAdminPlayerGalleryEntries.length) {
    wrapperEl.classList.remove("hidden");
    const playerName = player.display_name || player.username || `Spieler ${player.id}`;
    const gameName = game.name || `Spiel ${game.id}`;

    galleryEl.innerHTML = `
      <div class="admin-player-gallery-frame admin-player-gallery-empty">
        ${playerName} hat im Spiel „${gameName}“ noch keine Bilder hochgeladen.
      </div>
    `;

    currentAdminPlayerGalleryIndex = 0;
    currentAdminPlayerGallerySelectedChallengeId = null;
    return;
  }

  /*
   * Nach einem Polling-Refresh wieder dasselbe Bild auswählen.
   */
  if (currentAdminPlayerGallerySelectedChallengeId !== null) {
    const preservedIndex = currentAdminPlayerGalleryEntries.findIndex(
      entry =>
        Number(entry.challengeId) ===
        Number(currentAdminPlayerGallerySelectedChallengeId)
    );

    currentAdminPlayerGalleryIndex =
      preservedIndex >= 0 ? preservedIndex : 0;
  } else {
    currentAdminPlayerGalleryIndex = 0;
  }

  const selectedEntry =
    currentAdminPlayerGalleryEntries[currentAdminPlayerGalleryIndex];

  currentAdminPlayerGallerySelectedChallengeId =
    selectedEntry?.challengeId ?? null;

  wrapperEl.classList.remove("hidden");
  renderAdminPlayerGalleryCurrent();
}

function renderAdminPlayerGalleryCurrent() {
  const galleryEl = document.getElementById("adminPlayerGallery");
  if (!galleryEl) return;

  if (!currentAdminPlayerGalleryEntries.length) {
    galleryEl.innerHTML = `
      <div class="admin-player-gallery-frame admin-player-gallery-empty">
        Keine Bilder vorhanden.
      </div>
    `;
    return;
  }

  const entry =
    currentAdminPlayerGalleryEntries[currentAdminPlayerGalleryIndex];

  const imageUrl = getPublicImageUrl(entry.proofImagePath);

  /*
   * Grundstruktur nur beim ersten Rendern aufbauen.
   * Beim Weiterklicken werden danach nur Bild und Beschriftung geändert.
   */
  let frame = galleryEl.querySelector(".admin-player-gallery-frame");

  /*
   * Ein zuvor angezeigter Leerzustand besitzt ebenfalls die Frame-Klasse,
   * enthält aber noch keine Bild-, Caption- oder Pfeilelemente. Beim Wechsel
   * zu einem Spieler mit Bildern muss die Galerie deshalb vollständig neu
   * aufgebaut werden.
   */
  const needsGalleryStructure =
    !frame ||
    frame.classList.contains("admin-player-gallery-empty") ||
    !galleryEl.querySelector("#adminPlayerGalleryImage") ||
    !galleryEl.querySelector("#adminPlayerGalleryCaption");

  if (needsGalleryStructure) {
    galleryEl.innerHTML = `
      <div class="admin-player-gallery-frame">
        <div class="admin-player-gallery-loading" aria-hidden="true">
          <div class="admin-player-gallery-spinner"></div>
        </div>

        <img
          id="adminPlayerGalleryImage"
          class="admin-player-gallery-image"
          alt="Beweisfoto"
        />

        <div
          id="adminPlayerGalleryCaption"
          class="admin-player-gallery-caption"
        ></div>

        <button
          id="adminPlayerGalleryPrevBtn"
          class="admin-player-gallery-arrow admin-player-gallery-arrow-left"
          type="button"
          aria-label="Vorheriges Bild"
        >
          ‹
        </button>

        <button
          id="adminPlayerGalleryNextBtn"
          class="admin-player-gallery-arrow admin-player-gallery-arrow-right"
          type="button"
          aria-label="Nächstes Bild"
        >
          ›
        </button>
      </div>
    `;

    frame = galleryEl.querySelector(".admin-player-gallery-frame");

    document
      .getElementById("adminPlayerGalleryPrevBtn")
      ?.addEventListener("click", () => {
        if (currentAdminPlayerGalleryIndex <= 0) return;

        currentAdminPlayerGalleryIndex--;

        currentAdminPlayerGallerySelectedChallengeId =
          currentAdminPlayerGalleryEntries[
            currentAdminPlayerGalleryIndex
          ]?.challengeId ?? null;

        renderAdminPlayerGalleryCurrent();
      });

    document
      .getElementById("adminPlayerGalleryNextBtn")
      ?.addEventListener("click", () => {
        if (
          currentAdminPlayerGalleryIndex >=
          currentAdminPlayerGalleryEntries.length - 1
        ) {
          return;
        }

        currentAdminPlayerGalleryIndex++;

        currentAdminPlayerGallerySelectedChallengeId =
          currentAdminPlayerGalleryEntries[
            currentAdminPlayerGalleryIndex
          ]?.challengeId ?? null;

        renderAdminPlayerGalleryCurrent();
      });
  }

  const imageEl = document.getElementById("adminPlayerGalleryImage");
  const captionEl = document.getElementById("adminPlayerGalleryCaption");
  const prevBtn = document.getElementById("adminPlayerGalleryPrevBtn");
  const nextBtn = document.getElementById("adminPlayerGalleryNextBtn");
  const loadingEl = frame?.querySelector(".admin-player-gallery-loading");

  if (!imageEl || !captionEl || !prevBtn || !nextBtn || !loadingEl) {
    return;
  }

  captionEl.textContent = entry.challengeTitle || "Aufgabe";

  prevBtn.classList.toggle(
    "hidden",
    currentAdminPlayerGalleryIndex <= 0
  );

  nextBtn.classList.toggle(
    "hidden",
    currentAdminPlayerGalleryIndex >=
      currentAdminPlayerGalleryEntries.length - 1
  );

  loadingEl.classList.add("visible");
  imageEl.classList.add("loading");

  const nextImage = new Image();

  nextImage.onload = () => {
    imageEl.src = imageUrl;
    imageEl.alt = entry.challengeTitle || "Beweisfoto";

    requestAnimationFrame(() => {
      imageEl.classList.remove("loading");
      loadingEl.classList.remove("visible");
    });
  };

  nextImage.onerror = () => {
    imageEl.removeAttribute("src");
    imageEl.alt = "Bild konnte nicht geladen werden";

    imageEl.classList.remove("loading");
    loadingEl.classList.remove("visible");
  };

  nextImage.src = imageUrl;
}

function setAdminGalleryToChallenge(playerId, gameId, challengeId) {
  currentAdminPlayerGalleryPlayerId = playerId;
  currentAdminPlayerGalleryGameId = gameId;
  currentAdminPlayerGallerySelectedChallengeId = challengeId;

  currentAdminPlayerGalleryEntries = buildAdminPlayerGalleryEntries(
    playerId,
    gameId
  );

  const index = currentAdminPlayerGalleryEntries.findIndex(
    entry => Number(entry.challengeId) === Number(challengeId)
  );

  if (index >= 0) {
    currentAdminPlayerGalleryIndex = index;
    renderAdminPlayerGalleryCurrent();
  }
}