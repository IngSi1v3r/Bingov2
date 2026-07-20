/**
 * ============================================================
 * admin_games.js
 * ============================================================
 *
 * Zweck:
 * Verwaltung des "Spiele"-Tabs im Adminpanel.
 *
 * Enthaltene Hauptfunktionen:
 *
 * 1) Tab-Initialisierung
 *    - Aufbau des Games-Tabs
 *    - Laden aller relevanten Daten
 *    - Rendern von Liste, Details, Grid und Leaderboard
 *
 * 2) Spielverwaltung
 *    - Neues Spiel per Formular erstellen
 *    - Spielparameter bearbeiten
 *    - Spiel duplizieren
 *    - Spiel löschen
 *
 * 3) Challenge-Verwaltung innerhalb eines Spiels
 *    - Grid-Darstellung aller Aufgaben
 *    - Challenge-Details öffnen
 *    - Titel, Beschreibung, Hinweise, Punkte, Kategorie usw. bearbeiten
 *    - Aktiv/Inaktiv und Foto erforderlich toggeln
 *
 * 4) Challenge-Setup-Wizard
 *    - ist in admin_games_setup_wizard.js ausgelagert
 *    - admin_games.js ruft die Wizard-Funktionen weiterhin global auf
 *
 * 5) Hilfsfunktionen
 *    - Galerie für Beweisbilder
 *    - Leaderboards
 *    - Unvollständige Aufgaben erkennen
 *
 * Hinweise:
 * - Diese Datei nutzt globale Collections und Helper aus admin.js
 *   (adminGames, adminPlayers, adminPlayerStates, adminPlayerChallenges,
 *    adminChallenges, adminCurrentGame, adminCurrentGameId, ...)
 * - Reine Ladefunktionen laufen ueber data_service.js.
 * - Schreib-/Bearbeitungsaktionen bleiben in dieser Datei.
 * - Die Datei ist absichtlich in logisch getrennte Abschnitte gegliedert.
 * - Der Challenge-Setup-Wizard liegt bewusst in admin_games_setup_wizard.js,
 *   damit diese Datei uebersichtlicher bleibt.
 */

/* ============================================================
 * STATE
 * ============================================================ */

/** Aktuell im Games-Tab ausgewähltes Spiel */
let selectedAdminGameDetailsId = null;

/** Galerie-Status für das Challenge-Detailmodal im Games-Tab */
let currentAdminGameChallengeGalleryEntries = [];
let currentAdminGameChallengeGalleryIndex = 0;

/** Auswahl für die Gridgröße im "Neues Spiel"-Modal */
let selectedGridSize = 5;

/** Mobiler Drawer-Status im Spiele-Tab */
let adminGameDrawerOpen = false;
let adminGameDrawerGlobalEventsBound = false;

/* ============================================================
 * TAB INITIALISIERUNG
 * ============================================================ */

/**
 * Initialisiert den kompletten Games-Tab:
 * - baut Layout und Modals auf
 * - lädt alle relevanten Daten
 * - rendert Liste und Details des aktuell gewählten Spiels
 */
async function initializeAdminGamesTab() {
  ensureAdminGamesTabLayout();
  ensureAdminGameChallengeModal();
  ensureAdminTextEditModal();
  ensureAdminCreateGameModal();
  ensureAdminChallengeSetupModal();
  ensureAdminGamePasswordModal();
  ensureAdminChallengeImageModal();
  ensureAdminGamePlayersListModal();

  await loadAdminGamesTabData();

  /*
   * Der global im Header gewählte Spielkontext ist führend.
   * Dadurch springt der Games-Tab nach einem Header-Wechsel automatisch
   * zum passenden Spiel und aktualisiert Rail, Liste und Details.
   */
  if (adminCurrentGameId && adminGames.some(game => Number(game.id) === Number(adminCurrentGameId))) {
    selectedAdminGameDetailsId = Number(adminCurrentGameId);
  } else if (!selectedAdminGameDetailsId) {
    selectedAdminGameDetailsId = adminGames[0]?.id || null;
  }

  const selectedStillExists = adminGames.some(
    game => Number(game.id) === Number(selectedAdminGameDetailsId)
  );

  if (!selectedStillExists) {
    selectedAdminGameDetailsId = adminGames[0]?.id || null;
  }

  renderAdminGamesList();
  updateAdminGameRailLabel();
  requestAnimationFrame(updateAdminGameDrawerTopOffset);

  const selectedGame = adminGames.find(game => game.id === selectedAdminGameDetailsId) || null;
  await renderAdminGameDetails(selectedGame);
}

/**
 * Laedt alle Daten, die der Games-Tab braucht.
 *
 * Die eigentlichen Supabase-Reads liegen zentral in data_service.js.
 * Die globalen Collections bleiben vorerst erhalten, damit die bestehenden
 * Render- und Helperfunktionen unveraendert weiterarbeiten.
 */
async function loadAdminGamesTabData() {
  const bundle = await DataService.bundles.loadAdminGamesTab();

  adminPlayers = bundle.players || [];
  adminGames = bundle.games || [];
  adminPlayerStates = bundle.playerStates || [];
  adminPlayerChallenges = bundle.playerChallenges || [];
  adminChallenges = bundle.challenges || [];
  adminPlayerBingos = bundle.playerBingos || [];
}

/* ============================================================
 * LAYOUT / TAB-GRUNDSTRUKTUR
 * ============================================================ */

/**
 * Baut die Grundstruktur des Games-Tabs einmalig auf.
 * Enthält:
 * - linke Spiel-Liste
 * - rechte Detailansicht
 * - Grid
 * - Leaderboard
 * - Aktionsbuttons unten
 */
function ensureAdminGamesTabLayout() {
  const tabEl = document.getElementById("tab-games");
  if (!tabEl) return;

  if (document.getElementById("adminGamesSplitLayout")) {
    attachAdminGameDrawerEvents();
    updateAdminGameRailLabel();
    requestAnimationFrame(updateAdminGameDrawerTopOffset);
    return;
  }

  tabEl.innerHTML = `
    <h2>Spiele</h2>

    <div
      class="admin-split-layout admin-games-layout"
      id="adminGamesSplitLayout"
    >
      <div
        id="adminGameDrawerBackdrop"
        class="admin-game-drawer-backdrop hidden"
        aria-hidden="true"
      ></div>

      <aside
        id="adminGameListPanel"
        class="admin-panel admin-game-list-panel"
      >
        <button
          id="adminGameRailCurrent"
          class="admin-game-rail-current"
          type="button"
          aria-label="Spieleliste öffnen"
          aria-expanded="false"
        >
          <span id="adminGameRailName" class="admin-game-rail-name">Spiel</span>
        </button>

        <div class="admin-panel-header admin-game-list-header">
          <h3>Alle Spiele</h3>
        </div>

        <div class="admin-player-action-bar admin-game-list-actions">
          <button id="adminCreateGameBtn" type="button">Neues Spiel</button>
        </div>

        <div id="adminGamesList" class="admin-list admin-game-drawer-list">
          <p>Spiele werden geladen...</p>
        </div>
      </aside>

      <div class="admin-panel admin-game-detail-panel">
        <div class="admin-panel-header">
          <h3>Spiel-Details</h3>
        </div>

        <div id="adminGameDetails">
          <p class="admin-details-empty">Wähle links ein Spiel aus.</p>
        </div>

        <div id="adminGameGridWrapper" class="admin-mini-grid-wrapper hidden">
          
          <div class="admin-bingo-board-shell">
            <div class="admin-bingo-board-top">
              <div></div>
              <div id="adminBingoDiagonalTopIndicator" class="admin-bingo-diagonal-single"></div>
            </div>

            <div class="admin-bingo-board-main">
              <div id="adminGameGrid" class="admin-game-grid"></div>
              <div id="adminBingoRowIndicators" class="admin-bingo-row-indicators"></div>
            </div>

            <div class="admin-bingo-board-bottom">
              <div id="adminBingoColumnIndicators" class="admin-bingo-column-indicators"></div>
              <div id="adminBingoDiagonalBottomIndicator" class="admin-bingo-diagonal-single"></div>
            </div>
          </div>
        </div>

        <div id="adminGameLeaderboardWrapper" class="admin-completed-wrapper hidden">
          <div id="adminGameLeaderboard"></div>
        </div>

        <div id="adminGameDeleteWrapper" class="admin-player-action-bar hidden admin-game-detail-actions">
          <button id="adminDuplicateGameBtn" type="button" class="secondary-btn">
            Spiel duplizieren
          </button>
          <button id="adminCheckGameChallengesBtn" type="button" class="secondary-btn">
            Aufgaben prüfen
          </button>
          <button id="adminDeleteGameBtn" type="button" class="danger-btn">
            Spiel löschen
          </button>
        </div>
      </div>
    </div>
  `;

  attachAdminGameDrawerEvents();
  updateAdminGameRailLabel();
  requestAnimationFrame(updateAdminGameDrawerTopOffset);

  const createBtn = document.getElementById("adminCreateGameBtn");
  const deleteBtn = document.getElementById("adminDeleteGameBtn");
  const duplicateBtn = document.getElementById("adminDuplicateGameBtn");
  const checkBtn = document.getElementById("adminCheckGameChallengesBtn");

  if (createBtn) {
    createBtn.addEventListener("click", event => {
      event.stopPropagation();
      openAdminCreateGameModal();
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      const selectedGame = adminGames.find(game => game.id === selectedAdminGameDetailsId) || null;
      await handleAdminDeleteGame(selectedGame);
    });
  }

  if (duplicateBtn) {
    duplicateBtn.addEventListener("click", async () => {
      const selectedGame = adminGames.find(game => game.id === selectedAdminGameDetailsId) || null;
      await handleAdminDuplicateGame(selectedGame);
    });
  }

  if (checkBtn) {
    checkBtn.addEventListener("click", async () => {
      const selectedGame = adminGames.find(game => game.id === selectedAdminGameDetailsId) || null;
      await handleAdminCheckIncompleteChallenges(selectedGame);
    });
  }
}

/* ============================================================
 * MOBILE GAME DRAWER
 * ============================================================ */

function isAdminGameMobileLayout() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function updateAdminGameDrawerTopOffset() {
  const header = document.querySelector(".admin-sticky-header");
  const headerHeight = header
    ? Math.ceil(header.getBoundingClientRect().height)
    : 100;

  document.documentElement.style.setProperty(
    "--admin-game-drawer-top",
    `${headerHeight}px`
  );
}

function getSelectedAdminGameForRail() {
  return adminGames.find(
    game => Number(game.id) === Number(selectedAdminGameDetailsId)
  ) || adminCurrentGame || null;
}

function updateAdminGameRailLabel() {
  const label = document.getElementById("adminGameRailName");
  if (!label) return;

  const game = getSelectedAdminGameForRail();
  label.textContent = game?.name || "Spiel";
}

function openAdminGameDrawer() {
  if (!isAdminGameMobileLayout()) return;

  const layout = document.getElementById("adminGamesSplitLayout");
  const backdrop = document.getElementById("adminGameDrawerBackdrop");
  const panel = document.getElementById("adminGameListPanel");
  const rail = document.getElementById("adminGameRailCurrent");

  if (!layout || !panel) return;

  updateAdminGameDrawerTopOffset();
  adminGameDrawerOpen = true;
  layout.classList.add("drawer-open");
  panel.classList.add("drawer-open");
  backdrop?.classList.remove("hidden");
  rail?.setAttribute("aria-expanded", "true");
}

function closeAdminGameDrawer() {
  const layout = document.getElementById("adminGamesSplitLayout");
  const backdrop = document.getElementById("adminGameDrawerBackdrop");
  const panel = document.getElementById("adminGameListPanel");
  const rail = document.getElementById("adminGameRailCurrent");

  adminGameDrawerOpen = false;
  layout?.classList.remove("drawer-open");
  panel?.classList.remove("drawer-open");
  backdrop?.classList.add("hidden");
  rail?.setAttribute("aria-expanded", "false");
}

function attachAdminGameDrawerEvents() {
  const rail = document.getElementById("adminGameRailCurrent");
  const backdrop = document.getElementById("adminGameDrawerBackdrop");

  if (rail && !rail.dataset.drawerBound) {
    rail.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      openAdminGameDrawer();
    });
    rail.dataset.drawerBound = "true";
  }

  if (backdrop && !backdrop.dataset.drawerBound) {
    backdrop.addEventListener("click", closeAdminGameDrawer);
    backdrop.dataset.drawerBound = "true";
  }

  if (!adminGameDrawerGlobalEventsBound) {
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && adminGameDrawerOpen) {
        closeAdminGameDrawer();
      }
    });

    window.addEventListener("resize", () => {
      updateAdminGameDrawerTopOffset();
      if (!isAdminGameMobileLayout() && adminGameDrawerOpen) {
        closeAdminGameDrawer();
      }
    });

    adminGameDrawerGlobalEventsBound = true;
  }
}


/* ============================================================
 * SPIELERLISTEN-MODAL / NAVIGATION
 * ============================================================ */

function ensureAdminGamePlayersListModal() {
  if (document.getElementById("adminGamePlayersListOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "adminGamePlayersListOverlay";
  overlay.className = "modal-overlay hidden";
  overlay.innerHTML = `
    <div class="modal admin-game-players-list-modal">
      <button id="closeAdminGamePlayersListBtn" class="modal-close-btn" type="button">×</button>
      <h2 id="adminGamePlayersListTitle">Spieler</h2>
      <div id="adminGamePlayersListContent" class="admin-game-players-list"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  document
    .getElementById("closeAdminGamePlayersListBtn")
    ?.addEventListener("click", closeAdminGamePlayersListModal);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) closeAdminGamePlayersListModal();
  });
}

function closeAdminGamePlayersListModal() {
  document.getElementById("adminGamePlayersListOverlay")?.classList.add("hidden");
}

async function openAdminGamePlayerInPlayersTab(playerId, game) {
  if (!playerId || !game) return;

  selectedAdminPlayerId = Number(playerId);
  adminCurrentGameId = game.id;
  adminCurrentGame = game;
  saveGameIdToLocalStorageAdmin(adminCurrentGameId);
  updateAdminCurrentGameDisplay();
  closeAdminGamePlayersListModal();

  if (typeof activateAdminTabByName === "function") {
    await activateAdminTabByName("players");
  } else {
    document.querySelector('.admin-tab[data-tab="players"]')?.click();
  }
}

function openAdminGamePlayersListModal(title, rows, game) {
  ensureAdminGamePlayersListModal();

  const overlay = document.getElementById("adminGamePlayersListOverlay");
  const titleEl = document.getElementById("adminGamePlayersListTitle");
  const contentEl = document.getElementById("adminGamePlayersListContent");
  if (!overlay || !titleEl || !contentEl) return;

  titleEl.textContent = title;
  contentEl.innerHTML = "";

  if (!rows.length) {
    contentEl.innerHTML = `<p class="admin-details-empty">Keine Spieler vorhanden.</p>`;
  } else {
    rows.forEach(row => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "admin-game-player-list-row";
      button.innerHTML = `
        <span class="admin-game-player-list-name">${row.name}</span>
        ${row.meta ? `<span class="admin-game-player-list-meta">${row.meta}</span>` : ""}
      `;
      button.addEventListener("click", async () => {
        await openAdminGamePlayerInPlayersTab(row.playerId, game);
      });
      contentEl.appendChild(button);
    });
  }

  overlay.classList.remove("hidden");
}

function formatAdminGameCooldownSeconds(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  if (seconds < 60) return `${seconds} s`;

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")} min`;
}

function parseAdminGameCooldownInput(input) {
  if (input === null || input === undefined) return null;

  const trimmed = String(input).trim().toLowerCase();
  if (!trimmed) return null;

  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    if (parts.length === 2) {
      const minutes = Number(parts[0]);
      const seconds = Number(parts[1]);
      if (
        Number.isInteger(minutes) && minutes >= 0 &&
        Number.isInteger(seconds) && seconds >= 0 && seconds < 60
      ) {
        return minutes * 60 + seconds;
      }
    }
    return null;
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.round(numeric);
}

/* ============================================================
 * DATEN LADEN / HELFER
 * ============================================================ */

/**
 * Lädt alle Challenges vollständig, inklusive aller bearbeitbaren Felder.
 * Diese Funktion überschreibt adminChallenges global.
 */
async function loadAllChallengesForAdminDetailed() {
  adminChallenges = await DataService.challenges.loadAllDetailed();
}

/** Liefert alle player_game_state Einträge für ein Spiel */
function getAdminGamePlayerStates(gameId) {
  return adminPlayerStates.filter(row => row.game_id === gameId);
}

/** Liefert alle completed player_challenges eines Spiels */
function getAdminGameCompletedRows(gameId) {
  return adminPlayerChallenges.filter(
    row => row.game_id === gameId && row.status === "completed"
  );
}

/** Liefert alle active player_challenges eines Spiels */
function getAdminGameActiveRows(gameId) {
  return adminPlayerChallenges.filter(
    row => row.game_id === gameId && row.status === "active"
  );
}

/** Liefert alle Challenges eines Spiels, nach Position sortiert */
function getAdminGameChallenges(gameId) {
  return adminChallenges
    .filter(challenge => challenge.game_id === gameId)
    .sort((a, b) => Number(a.position) - Number(b.position));
}

/** Liefert nur aktive Challenges eines Spiels, nach Position sortiert */
function getAdminGameActiveChallenges(gameId) {
  return adminChallenges
    .filter(challenge => challenge.game_id === gameId && challenge.is_active !== false)
    .sort((a, b) => Number(a.position) - Number(b.position));
}

/**
 * Baut das Leaderboard für ein Spiel aus player_game_state + players.
 */
function getAdminGameLeaderboardRows(gameId) {
  const states = getAdminGamePlayerStates(gameId);

  return states
    .map(state => {
      const player = adminPlayers.find(p => p.id === state.player_id);

      return {
        playerId: state.player_id,
        name: player?.display_name || player?.username || `Spieler ${state.player_id}`,
        score: state.score || 0,
        activeChallengeId: state.active_challenge_id || null,
        cooldownUntil: state.cooldown_until || null,
        isBlocked: player?.is_blocked === true
      };
    })
    .sort((a, b) => {
      if ((b.score || 0) !== (a.score || 0)) {
        return (b.score || 0) - (a.score || 0);
      }
      return String(a.name).localeCompare(String(b.name), "de");
    });
}

/** Liefert alle completed rows für genau eine Challenge */
function getAdminChallengeCompletedRows(gameId, challengeId) {
  return adminPlayerChallenges
    .filter(row =>
      row.game_id === gameId &&
      row.challenge_id === challengeId &&
      row.status === "completed"
    )
    .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));
}

/** Liefert alle active rows für genau eine Challenge */
function getAdminChallengeActiveRows(gameId, challengeId) {
  return adminPlayerChallenges.filter(row =>
    row.game_id === gameId &&
    row.challenge_id === challengeId &&
    row.status === "active"
  );
}

/** Liefert Solve-/Active-Zahlen für eine einzelne Challenge */
function getAdminChallengeStats(gameId, challengeId) {
  const completedRows = getAdminChallengeCompletedRows(gameId, challengeId);
  const activeRows = getAdminChallengeActiveRows(gameId, challengeId);

  return {
    solvedCount: completedRows.length,
    activeCount: activeRows.length
  };
}

/** Liefert den Namen eines Players */
function getAdminPlayerName(playerId) {
  const player = adminPlayers.find(p => p.id === playerId);
  return player?.display_name || player?.username || `Spieler ${playerId}`;
}

function getAdminChallengeSuccessVariants(challenge) {
  if (!challenge) return [];

  return [
    { points: 1, label: challenge.success_variant_1 || "" },
    { points: 2, label: challenge.success_variant_2 || "" },
    { points: 3, label: challenge.success_variant_3 || "" }
  ].filter(variant => String(variant.label || "").trim() !== "");
}

function isAdminVariablePointsChallenge(challenge) {
  return (
    !!challenge &&
    (challenge.points === null || challenge.points === undefined) &&
    getAdminChallengeSuccessVariants(challenge).length > 0
  );
}

function getAdminChallengePointsDisplay(challenge) {
  if (isAdminVariablePointsChallenge(challenge)) return "?";
  return `${challenge?.points ?? 0}P`;
}

function getAdminChallengePointsValueDisplay(challenge) {
  if (isAdminVariablePointsChallenge(challenge)) return "Variable Punkte (?)";
  return String(challenge?.points ?? 0);
}

/**
 * Prüft, ob eine Challenge als unvollständig gilt.
 * Aktuell Pflichtfelder:
 * - title
 * - task
 * - points
 */
function isAdminChallengeIncomplete(challenge) {
  if (!challenge) return true;

  const hasTitle = !!String(challenge.title || "").trim();
  const hasTask = !!String(challenge.task || "").trim();
  const hasFixedPoints = challenge.points !== null && challenge.points !== undefined && String(challenge.points) !== "";
  const hasVariablePoints = isAdminVariablePointsChallenge(challenge);

  return !(hasTitle && hasTask && (hasFixedPoints || hasVariablePoints));
}

/**
 * Baut zusammenfassende Stats für ein Spiel.
 */
function buildAdminGameBasicStats(game) {
  const allStates = getAdminGamePlayerStates(game.id);
  const completedRows = getAdminGameCompletedRows(game.id);
  const activeRows = getAdminGameActiveRows(game.id);
  const activeChallenges = getAdminGameActiveChallenges(game.id);
  const allChallenges = getAdminGameChallenges(game.id);
  const leaderboard = getAdminGameLeaderboardRows(game.id);

  const gridSize = game.grid_size || 5;
  const expectedFields = gridSize * gridSize;

  const uniquePlayersWithState = allStates.length;
  const playersWithActiveChallenge = allStates.filter(row => row.active_challenge_id !== null).length;
  const playersInCooldown = allStates.filter(row => isCooldownActiveAdmin(row.cooldown_until)).length;

  const solvedFieldsUnique = new Set(
    completedRows.map(row => row.challenge_id)
  ).size;

  const totalAwardedPoints = leaderboard.reduce((sum, row) => sum + (row.score || 0), 0);
  const incompleteChallengesCount = allChallenges.filter(challenge => isAdminChallengeIncomplete(challenge)).length;

  return {
    uniquePlayersWithState,
    playersWithActiveChallenge,
    playersInCooldown,
    completedRowsCount: completedRows.length,
    activeRowsCount: activeRows.length,
    solvedFieldsUnique,
    unsolvedFields: Math.max(0, expectedFields - solvedFieldsUnique),
    totalAwardedPoints,
    activeChallengesCount: activeChallenges.length,
    allChallengesCount: allChallenges.length,
    incompleteChallengesCount
  };
}

/* ============================================================
 * SPIEL-LISTE LINKS
 * ============================================================ */

/**
 * Rendert die linke Liste aller Spiele.
 */
function renderAdminGamesList() {
  const listEl = document.getElementById("adminGamesList");
  if (!listEl) return;

  if (!adminGames.length) {
    listEl.innerHTML = `<p>Keine Spiele gefunden.</p>`;
    return;
  }

  listEl.innerHTML = "";

  adminGames.forEach(game => {
    const item = document.createElement("div");
    item.className = "admin-list-item";

    if (game.id === selectedAdminGameDetailsId) {
      item.classList.add("active");
    }

    const stats = buildAdminGameBasicStats(game);
    const isCurrentAdminGame = game.id === adminCurrentGameId;

    item.innerHTML = `
      <div class="admin-list-card">
        <div class="admin-list-card-left">
          <div class="admin-list-name">${game.name || `Spiel ${game.id}`}</div>
          <div class="admin-list-meta">ID ${game.id}</div>

          <div class="admin-status-row">
              ${game.is_active ? `<span class="admin-badge ingame">Aktiv</span>` : `<span class="admin-badge blocked">Inaktiv</span>`}

              ${(game.visibility || "public") === "private"
                ? `<span class="admin-badge blocked">Privat</span>`
                : `<span class="admin-badge ingame">Öffentlich</span>`
              }

              ${game.game_password_hash
                ? `<span class="admin-badge cooldown">Gesperrt</span>`
                : `<span class="admin-badge ingame">Offen</span>`
              }

              ${isCurrentAdminGame ? `<span class="admin-badge cooldown">Ausgewählt</span>` : ""}
            </div>

          <div class="admin-list-subinfo">
            <div><strong>Grid:</strong> ${game.grid_size || 5}x${game.grid_size || 5}</div>
            <div><strong>Spieler:</strong> ${stats.uniquePlayersWithState}</div>
            <div><strong>Aktiv:</strong> ${stats.playersWithActiveChallenge}</div>
            <div><strong>Gelöst:</strong> ${stats.solvedFieldsUnique}</div>
          </div>
        </div>

        <div class="admin-list-card-right">
          <div class="admin-list-score">${stats.totalAwardedPoints}P</div>
        </div>
      </div>
    `;

    item.addEventListener("click", async event => {
      event.stopPropagation();

      selectedAdminGameDetailsId = game.id;

      adminCurrentGameId = game.id;
      adminCurrentGame = game;
      saveGameIdToLocalStorageAdmin(adminCurrentGameId);
      updateAdminCurrentGameDisplay();

      renderAdminGamesList();
      updateAdminGameRailLabel();
      await renderAdminGameDetails(game);

      if (isAdminGameMobileLayout()) {
        closeAdminGameDrawer();
      }
    });

    listEl.appendChild(item);
  });
}

/* ============================================================
 * SPIEL-DETAILANSICHT RECHTS
 * ============================================================ */

/**
 * Rendert die rechte Detailansicht für das ausgewählte Spiel.
 */
async function renderAdminGameDetails(game) {
  const detailsEl = document.getElementById("adminGameDetails");
  const deleteWrapper = document.getElementById("adminGameDeleteWrapper");
  const gridWrapper = document.getElementById("adminGameGridWrapper");
  const leaderboardWrapper = document.getElementById("adminGameLeaderboardWrapper");

  if (!detailsEl) return;

  if (!game) {
    detailsEl.innerHTML = `<p class="admin-details-empty">Wähle links ein Spiel aus.</p>`;

    if (deleteWrapper) deleteWrapper.classList.add("hidden");
    if (gridWrapper) gridWrapper.classList.add("hidden");
    if (leaderboardWrapper) leaderboardWrapper.classList.add("hidden");

    return;
  }

  const stats = buildAdminGameBasicStats(game);

  detailsEl.innerHTML = `
  <div class="admin-details-grid admin-game-details-grid">

    <div class="admin-detail-card">
      <div class="admin-detail-label">ID</div>
      <div class="admin-detail-value">${game.id}</div>
    </div>

    <div class="admin-detail-card">
      <div class="admin-detail-label">Größe</div>
      <div class="admin-detail-value">
        ${game.grid_size || 5}×${game.grid_size || 5}
      </div>
    </div>

    <div class="admin-detail-card">
      <div class="admin-detail-label">Status</div>
      <div
        id="adminToggleGameActiveBtn"
        class="admin-detail-value clickable ${
          game.is_active ? "success-state" : "danger-state"
        }"
        title="Zum Umschalten klicken"
      >
        ${game.is_active ? "Aktiv" : "Inaktiv"}
      </div>
    </div>

    <div class="admin-detail-card">
      <div class="admin-detail-label">Sichtbar</div>
      <div
        id="adminEditGameVisibilityBtn"
        class="admin-detail-value clickable"
        title="Zum Bearbeiten klicken"
      >
        ${(game.visibility || "public") === "private" ? "Privat" : "Öffent."}
      </div>
    </div>

    <div class="admin-detail-card">
      <div class="admin-detail-label">Passwort</div>
      <div
        id="adminEditGamePasswordBtn"
        class="admin-detail-value clickable ${
          game.game_password_hash ? "" : "muted"
        }"
        title="Zum Bearbeiten klicken"
      >
        ${game.game_password_hash ? "Gesetzt" : "Keines"}
      </div>
    </div>

    <div class="admin-detail-card">
      <div class="admin-detail-label">Single Use</div>
      <div
        id="adminToggleSingleUseChallengesBtn"
        class="admin-detail-value clickable ${
          game.single_use_challenges ? "success-state" : "muted"
        }"
        title="Zum Umschalten klicken"
      >
        ${game.single_use_challenges ? "Ja" : "Nein"}
      </div>
    </div>

    <div class="admin-detail-card">
      <div class="admin-detail-label">Cooldown</div>
      <div
        id="adminEditGameCooldownBtn"
        class="admin-detail-value clickable"
        title="Zum Bearbeiten klicken"
      >
        ${formatAdminGameCooldownSeconds(game.cooldown_seconds ?? 0)}
      </div>
    </div>

    <div class="admin-detail-card">
      <div class="admin-detail-label">Bingo</div>
      <div
        id="adminEditGameBingoBtn"
        class="admin-detail-value clickable"
        title="Zum Bearbeiten klicken"
      >
        ${game.bingo_bonus_points ?? 0} P
      </div>
    </div>

    <div class="admin-detail-card">
      <div class="admin-detail-label">First</div>
      <div
        id="adminEditGameFirstBingoBtn"
        class="admin-detail-value clickable"
        title="Zum Bearbeiten klicken"
      >
        ${game.first_bingo_bonus_points ?? 3} P
      </div>
    </div>

    <div class="admin-detail-card">
      <div class="admin-detail-label">Spieler</div>
      <div id="adminGamePlayersBtn" class="admin-detail-value clickable" title="Spielerliste anzeigen">
        ${stats.uniquePlayersWithState}
      </div>
    </div>

    <div class="admin-detail-card">
      <div class="admin-detail-label">Aktiv</div>
      <div id="adminGameActivePlayersBtn" class="admin-detail-value clickable" title="Aktive Spieler anzeigen">
        ${stats.playersWithActiveChallenge}
      </div>
    </div>

    <div class="admin-detail-card">
      <div class="admin-detail-label">Cooldown</div>
      <div id="adminGameCooldownPlayersBtn" class="admin-detail-value clickable" title="Spieler im Cooldown anzeigen">
        ${stats.playersInCooldown}
      </div>
    </div>

    <div class="admin-detail-card">
      <div class="admin-detail-label">Gelöst</div>
      <div class="admin-detail-value">
        ${stats.solvedFieldsUnique}
      </div>
    </div>

    <div class="admin-detail-card">
      <div class="admin-detail-label">Offen</div>
      <div class="admin-detail-value">
        ${stats.unsolvedFields}
      </div>
    </div>

    <div class="admin-detail-card">
      <div class="admin-detail-label">Punkte</div>
      <div class="admin-detail-value points-state">
        ${stats.totalAwardedPoints}
      </div>
    </div>

  </div>

  ${
    stats.incompleteChallengesCount > 0
      ? `
        <div class="admin-game-incomplete-warning">
          <span>⚠</span>
          <strong>${stats.incompleteChallengesCount}</strong>
          unvollständige Aufgabe${
            stats.incompleteChallengesCount === 1 ? "" : "n"
          }
        </div>
      `
      : ""
  }
`;

  const editNameBtn = document.getElementById("adminEditGameNameBtn");
  const editCooldownBtn = document.getElementById("adminEditGameCooldownBtn");
  const editBingoBtn = document.getElementById("adminEditGameBingoBtn");
  const editFirstBingoBtn = document.getElementById("adminEditGameFirstBingoBtn");
  const toggleActiveBtn = document.getElementById("adminToggleGameActiveBtn");
  const editVisibilityBtn = document.getElementById("adminEditGameVisibilityBtn");
  const editPasswordBtn = document.getElementById("adminEditGamePasswordBtn");
  const singleUseBtn = document.getElementById("adminToggleSingleUseChallengesBtn");
  const playersBtn = document.getElementById("adminGamePlayersBtn");
  const activePlayersBtn = document.getElementById("adminGameActivePlayersBtn");
  const cooldownPlayersBtn = document.getElementById("adminGameCooldownPlayersBtn");

  if (editNameBtn) {
    editNameBtn.addEventListener("click", async () => {
      await handleAdminEditGameName(game);
    });
  }

  if (editCooldownBtn) {
    editCooldownBtn.addEventListener("click", async () => {
      await handleAdminEditGameCooldown(game);
    });
  }

  if (editBingoBtn) {
    editBingoBtn.addEventListener("click", async () => {
      await handleAdminEditGameBingoBonus(game);
    });
  }

  if (editFirstBingoBtn) {
    editFirstBingoBtn.addEventListener("click", async () => {
      await handleAdminEditGameFirstBingoBonus(game);
    });
  }

  if (toggleActiveBtn) {
    toggleActiveBtn.addEventListener("click", async () => {
      await handleAdminToggleGameActive(game);
    });
  }

  if (editVisibilityBtn) {
    editVisibilityBtn.addEventListener("click", async () => {
      await handleAdminEditGameVisibility(game);
    });
  }

  if (editPasswordBtn) {
    editPasswordBtn.addEventListener("click", async () => {
      await openAdminGamePasswordModal(game);
    });
  }

  const gameStates = getAdminGamePlayerStates(game.id);

  if (playersBtn) {
    playersBtn.addEventListener("click", () => {
      openAdminGamePlayersListModal(
        `Spieler – ${game.name || `Spiel ${game.id}`}`,
        gameStates
          .map(state => ({
            playerId: state.player_id,
            name: getAdminPlayerName(state.player_id),
            meta: `${state.score ?? 0}P`
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "de")),
        game
      );
    });
  }

  if (activePlayersBtn) {
    activePlayersBtn.addEventListener("click", () => {
      openAdminGamePlayersListModal(
        `Aktive Spieler – ${game.name || `Spiel ${game.id}`}`,
        gameStates
          .filter(state => state.active_challenge_id !== null)
          .map(state => ({
            playerId: state.player_id,
            name: getAdminPlayerName(state.player_id),
            meta: typeof getChallengeTitleByIdAdmin === "function"
              ? getChallengeTitleByIdAdmin(state.active_challenge_id)
              : "Aktive Aufgabe"
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "de")),
        game
      );
    });
  }

  if (cooldownPlayersBtn) {
    cooldownPlayersBtn.addEventListener("click", () => {
      openAdminGamePlayersListModal(
        `Spieler im Cooldown – ${game.name || `Spiel ${game.id}`}`,
        gameStates
          .filter(state => isCooldownActiveAdmin(state.cooldown_until))
          .map(state => ({
            playerId: state.player_id,
            name: getAdminPlayerName(state.player_id),
            meta: formatAdminCooldown(state.cooldown_until)
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "de")),
        game
      );
    });
  }

  if (deleteWrapper) deleteWrapper.classList.remove("hidden");

  renderAdminGameGrid(game);
  renderAdminGameLeaderboard(game);

  if (gridWrapper) gridWrapper.classList.remove("hidden");
  if (leaderboardWrapper) leaderboardWrapper.classList.remove("hidden");

  if (singleUseBtn) {
  singleUseBtn.onclick = async () => {
    const updated = await updateAdminGameFields(game.id, {
      single_use_challenges: !game.single_use_challenges
    });

    if (!updated) return;

    await logAdminGameUpdated({
      gameId: game.id,
      adminPlayerId: adminPlayer?.id || null,
      metadata: {
        admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
        game_name: game.name || null,
        field: "single_use_challenges",
        old_value: game.single_use_challenges,
        new_value: !game.single_use_challenges
      }
    });

    await loadAllGamesForAdmin();
    renderAdminGamesList();

    const refreshedGame = adminGames.find(g => g.id === game.id);

    if (refreshedGame) {
      renderAdminGameDetails(refreshedGame);
    }
  };
}
}

/* ============================================================
 * SPIEL-BEARBEITUNG
 * ============================================================ */

/**
 * Aktualisiert ein Spiel in der DB und liefert die aktualisierte Zeile zurück.
 */
async function updateAdminGameFields(gameId, updates) {
  const { data, error } = await supabaseClient
    .from("games")
    .update(updates)
    .eq("id", gameId)
    .select()
    .single();

  if (error) {
    console.error("Fehler beim Aktualisieren des Spiels:", error);
    alert("Spiel konnte nicht aktualisiert werden.");
    return null;
  }

  return data;
}

function getAdminGameVisibilityLabel(visibility) {
  if (visibility === "private") return "Privat";
  return "Öffentlich";
}

async function handleAdminEditGameVisibility(game) {
  if (!game) return;

  const current = game.visibility || "public";
  const nextValue = current === "private" ? "public" : "private";

  const confirmed = confirm(
    `"${game.name}" wirklich auf ${nextValue === "private" ? "Privat" : "Öffentlich"} setzen?`
  );

  if (!confirmed) return;

  const updated = await updateAdminGameFields(game.id, {
    visibility: nextValue
  });

  if (!updated) return;

  await logAdminGameUpdated({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    metadata: {
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      game_name: updated.name || game.name || null,
      field: "visibility",
      old_value: current,
      new_value: nextValue
    }
  });

  if (adminCurrentGameId === game.id) {
    adminCurrentGame = updated;
    updateAdminCurrentGameDisplay();
  }

  await initializeAdminGamesTab();
}

/** Bearbeitet den Spielnamen */
async function handleAdminEditGameName(game) {
  if (!game) return;

    const oldName = game.name || "";

  const input = prompt("Neuen Spielnamen eingeben:", game.name || "");
  if (input === null) return;

  const trimmed = input.trim();
  if (!trimmed) {
    alert("Bitte einen gültigen Namen eingeben.");
    return;
  }

  const updated = await updateAdminGameFields(game.id, { name: trimmed });
  if (!updated) return;

    await logAdminGameUpdated({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    metadata: {
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      game_name: updated.name || null,
      field: "name",
      old_value: oldName,
      new_value: trimmed
    }
  });

  if (adminCurrentGameId === game.id) {
    adminCurrentGame = updated;
    updateAdminCurrentGameDisplay();
  }

  await initializeAdminGamesTab();
}

/** Bearbeitet den Cooldown eines Spiels */
async function handleAdminEditGameCooldown(game) {
  if (!game) return;

  const oldCooldown = game.cooldown_seconds ?? 0;
  const input = prompt(
    `Cooldown für "${game.name}" eingeben.\n\n` +
    `Formate:\n` +
    `- Sekunden: 90\n` +
    `- Minuten:Sekunden: 1:30`,
    oldCooldown >= 60
      ? `${Math.floor(oldCooldown / 60)}:${String(oldCooldown % 60).padStart(2, "0")}`
      : String(oldCooldown)
  );
  if (input === null) return;

  const value = parseAdminGameCooldownInput(input);
  if (value === null) {
    alert("Ungültiger Cooldown. Beispiele: 90 oder 1:30");
    return;
  }

  const updated = await updateAdminGameFields(game.id, {
    cooldown_seconds: value
  });
  if (!updated) return;

  if (adminCurrentGameId === game.id) {
    adminCurrentGame = updated;
    updateAdminCurrentGameDisplay();
  }

  await logAdminGameUpdated({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    metadata: {
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      game_name: updated.name || game.name || null,
      field: "cooldown_seconds",
      old_value: oldCooldown,
      new_value: value
    }
  });

  await initializeAdminGamesTab();
}

/** Bearbeitet den Bingo-Bonus eines Spiels */
async function handleAdminEditGameBingoBonus(game) {
  if (!game) return;

  const oldBingoBonus = game.bingo_bonus_points ?? 0;

  const input = prompt(
    `Bingo-Bonus in Punkten für "${game.name}" eingeben:`,
    String(game.bingo_bonus_points ?? 0)
  );
  if (input === null) return;

  const value = Number(input);
  if (!Number.isFinite(value) || value < 0) {
    alert("Ungültiger Bingo-Bonus.");
    return;
  }

  const updated = await updateAdminGameFields(game.id, {
    bingo_bonus_points: value
  });
  if (!updated) return;

  if (adminCurrentGameId === game.id) {
    adminCurrentGame = updated;
    updateAdminCurrentGameDisplay();
  }

  await logAdminGameUpdated({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    metadata: {
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      game_name: updated.name || game.name || null,
      field: "bingo_bonus_points",
      old_value: oldBingoBonus,
      new_value: value
    }
  });

  await initializeAdminGamesTab();
}

async function handleAdminEditGameFirstBingoBonus(game) {
  if (!game) return;

  const oldBonus = game.first_bingo_bonus_points ?? 3;

  const input = prompt(
    `First-Bingo-Bonus in Punkten für "${game.name}" eingeben:`,
    String(oldBonus)
  );

  if (input === null) return;

  const value = Number(input);

  if (!Number.isFinite(value) || value < 0) {
    alert("Ungültiger First-Bingo-Bonus.");
    return;
  }

  const updated = await updateAdminGameFields(game.id, {
    first_bingo_bonus_points: value
  });

  if (!updated) return;

  if (adminCurrentGameId === game.id) {
    adminCurrentGame = updated;
    updateAdminCurrentGameDisplay();
  }

  await logAdminGameUpdated({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    metadata: {
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      game_name: updated.name || game.name || null,
      field: "first_bingo_bonus_points",
      old_value: oldBonus,
      new_value: value
    }
  });

  await initializeAdminGamesTab();
}

/** Schaltet das Spiel aktiv/inaktiv */
async function handleAdminToggleGameActive(game) {
  if (!game) return;

    const oldActive = game.is_active === true;

  const nextValue = !game.is_active;
  const confirmed = confirm(
    `"${game.name}" wirklich ${nextValue ? "aktiv" : "inaktiv"} setzen?`
  );
  if (!confirmed) return;

  const updated = await updateAdminGameFields(game.id, {
    is_active: nextValue
  });
  if (!updated) return;

  if (adminCurrentGameId === game.id) {
    adminCurrentGame = updated;
    updateAdminCurrentGameDisplay();
  }

    await logAdminGameUpdated({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    metadata: {
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      game_name: updated.name || game.name || null,
      field: "is_active",
      old_value: oldActive,
      new_value: nextValue
    }
  });

  if (!oldActive && nextValue && typeof pushAutomationSendGameActivated === "function") {
    await pushAutomationSendGameActivated(updated);
  }

  await initializeAdminGamesTab();
}

/* ============================================================
 * GRID DES SPIELS
 * ============================================================ */

/**
 * Rendert das Grid eines Spiels.
 * Deaktivierte oder unvollständige Aufgaben werden entsprechend markiert.
 */
function renderAdminGameGrid(game) {
  const gridEl = document.getElementById("adminGameGrid");
  if (!gridEl || !game) return;

  const gridSize = game.grid_size || 5;
  renderAdminBingoLineIndicators(game);
  const expectedCount = gridSize * gridSize;

    gridEl.classList.remove(
      "grid-size-3",
      "grid-size-4",
      "grid-size-5",
      "grid-size-6",
      "grid-size-7"
    );

gridEl.classList.add(`grid-size-${gridSize}`);

  const challenges = getAdminGameChallenges(game.id);
  const challengeByPosition = {};

  challenges.forEach(challenge => {
    challengeByPosition[Number(challenge.position)] = challenge;
  });

  gridEl.style.gridTemplateColumns =
  `repeat(${gridSize}, minmax(0, 1fr))`;
  gridEl.innerHTML = "";

  for (let position = 1; position <= expectedCount; position++) {
    const challenge = challengeByPosition[position];

    if (!challenge) {
      const placeholder = document.createElement("div");
      placeholder.className = "admin-game-grid-cell placeholder";
      placeholder.innerHTML = `<div class="admin-game-grid-title">Leer</div>`;
      gridEl.appendChild(placeholder);
      continue;
    }

    const challengeStats = getAdminChallengeStats(game.id, challenge.id);
    const isSolved = challengeStats.solvedCount > 0;
    const isInactive = challenge.is_active === false;
    const isCurrentlyActive = challengeStats.activeCount > 0;
    const isIncomplete = isAdminChallengeIncomplete(challenge);

    const cell = document.createElement("div");
    cell.className = "admin-game-grid-cell";

    if (isSolved) cell.classList.add("solved");
    if (isInactive) cell.classList.add("inactive");

    cell.innerHTML = `
      ${isCurrentlyActive ? `<div class="admin-game-grid-banner">Wird versucht (${challengeStats.activeCount})</div>` : ""}
      ${challenge.category_icon ? `<div class="admin-game-grid-category">${challenge.category_icon}</div>` : ""}
      ${challenge.requires_photo_proof ? `<div class="admin-game-grid-photo">📷</div>` : ""}
      ${isIncomplete ? `<div class="admin-game-grid-warning">!</div>` : ""}

      <div class="admin-game-grid-title">${challenge.title || `Feld ${position}`}</div>
      <div class="admin-game-grid-points">${getAdminChallengePointsDisplay(challenge)}</div>
      <div class="admin-game-grid-count">${challengeStats.solvedCount}</div>
    `;

    cell.title = challenge.title || `Feld ${position}`;
    cell.addEventListener("click", async () => {
      await openAdminGameChallengeDetails(game, challenge);
    });

    gridEl.appendChild(cell);
  }
}

/* ============================================================
 * BINGO INFORMATIONEN
 * ============================================================ */

function formatAdminBingoLineName(lineKey, gridSize = 5) {
  const lineIndex = Number(lineKey);

  if (!Number.isInteger(lineIndex)) return `Bingo ${lineKey}`;

  if (lineIndex < gridSize) {
    return `Reihe ${lineIndex + 1}`;
  }

  if (lineIndex < gridSize * 2) {
    return `Spalte ${lineIndex - gridSize + 1}`;
  }

  if (lineIndex === gridSize * 2) return "Diagonale ↘";
  if (lineIndex === gridSize * 2 + 1) return "Diagonale ↙";

  return `Bingo ${lineIndex}`;
}

function getAdminGameBingoRows(gameId) {
  return adminPlayerBingos
    .filter(row => Number(row.game_id) === Number(gameId))
    .sort((a, b) => new Date(a.awarded_at) - new Date(b.awarded_at));
}

function renderAdminGameBingoOverview(game) {
  const wrapper = document.getElementById("adminGameBingosWrapper");
  const listEl = document.getElementById("adminGameBingosList");

  if (!wrapper || !listEl || !game) return;

  const gridSize = game.grid_size || 5;
  const rows = getAdminGameBingoRows(game.id);

  if (!rows.length) {
    wrapper.classList.remove("hidden");
    listEl.innerHTML = `<p class="admin-details-empty">Noch keine Bingos erreicht.</p>`;
    return;
  }

  let html = `<div class="admin-completion-list">`;

  rows.forEach(row => {
    const playerName = getAdminPlayerName(row.player_id);
    const lineName = formatAdminBingoLineName(row.line_key, gridSize);

    const firstRowForLine = rows.find(
      r => String(r.line_key) === String(row.line_key)
    );

    const isFirstForLine =
      firstRowForLine && Number(firstRowForLine.id) === Number(row.id);

    html += `
      <div class="admin-completion-row">
        <div class="admin-completion-left">
          <div class="admin-completion-name">
            ${lineName} Bingo
            ${isFirstForLine ? `<span class="admin-completion-star">⭐</span>` : ""}
          </div>
          <div class="admin-completion-meta">
            ${playerName} · ${formatAdminDateTime(row.awarded_at)}
          </div>
        </div>

        <div class="admin-completion-right">
          <div class="admin-completion-points">${row.bonus_points || 0}P</div>
        </div>
      </div>
    `;
  });

  html += `</div>`;

  listEl.innerHTML = html;
  wrapper.classList.remove("hidden");
}

function renderAdminBingoLineIndicators(game) {
  const columnContainer = document.getElementById("adminBingoColumnIndicators");
  const rowContainer = document.getElementById("adminBingoRowIndicators");
  const diagonalTopContainer = document.getElementById("adminBingoDiagonalTopIndicator");
  const diagonalBottomContainer = document.getElementById("adminBingoDiagonalBottomIndicator");

  if (
    !game ||
    !columnContainer ||
    !rowContainer ||
    !diagonalTopContainer ||
    !diagonalBottomContainer
  ) return;

  const gridSize = game.grid_size || 5;

  columnContainer.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
  rowContainer.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;

  columnContainer.innerHTML = "";
  rowContainer.innerHTML = "";
  diagonalTopContainer.innerHTML = "";
  diagonalBottomContainer.innerHTML = "";

  // Spalten unten
  for (let col = 0; col < gridSize; col++) {
    const lineIndex = gridSize + col;
    columnContainer.appendChild(
      createAdminBingoLineIndicator(game, lineIndex, `Spalte ${col + 1}`)
    );
  }

  // Reihen rechts
  for (let row = 0; row < gridSize; row++) {
    const lineIndex = row;
    rowContainer.appendChild(
      createAdminBingoLineIndicator(game, lineIndex, `Reihe ${row + 1}`)
    );
  }

  // Diagonale rechts oben nach links unten
  diagonalTopContainer.appendChild(
    createAdminBingoLineIndicator(game, gridSize * 2 + 1, "Diagonale ↙")
  );

  // Diagonale links oben nach rechts unten
  diagonalBottomContainer.appendChild(
    createAdminBingoLineIndicator(game, gridSize * 2, "Diagonale ↘")
  );
}

function ensureAdminBingoLineModal() {
  if (document.getElementById("adminBingoLineOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "adminBingoLineOverlay";
  overlay.className = "modal-overlay hidden";

  overlay.innerHTML = `
    <div class="modal">
      <button id="closeAdminBingoLineBtn" class="modal-close-btn" type="button">×</button>
      <h2 id="adminBingoLineTitle">Bingo</h2>

      <div id="adminBingoLineContent" class="rules-content">
        <p>Lade Bingo-Details...</p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("closeAdminBingoLineBtn")
    ?.addEventListener("click", closeAdminBingoLineModal);
}

function closeAdminBingoLineModal() {
  document.getElementById("adminBingoLineOverlay")?.classList.add("hidden");
}

function openAdminBingoLineDetails(game, lineIndex, title) {
  ensureAdminBingoLineModal();

  const overlay = document.getElementById("adminBingoLineOverlay");
  const titleEl = document.getElementById("adminBingoLineTitle");
  const contentEl = document.getElementById("adminBingoLineContent");

  if (!overlay || !titleEl || !contentEl || !game) return;

  const rows = adminPlayerBingos
    .filter(row =>
      Number(row.game_id) === Number(game.id) &&
      String(row.line_key) === String(lineIndex)
    )
    .sort((a, b) => new Date(a.awarded_at) - new Date(b.awarded_at));

  titleEl.textContent = `${title} Bingo`;

  if (!rows.length) {
    contentEl.innerHTML = `<p class="admin-details-empty">Dieses Bingo wurde noch nicht erreicht.</p>`;
    overlay.classList.remove("hidden");
    return;
  }

  let html = `<div class="admin-completion-list">`;

  rows.forEach((row, index) => {
    const playerName = getAdminPlayerName(row.player_id);
    const isFirst = index === 0;

    html += `
      <div class="admin-completion-row">
        <div class="admin-completion-left">
          <div class="admin-completion-name">
            ${index + 1}. ${playerName}
            ${isFirst ? `<span class="admin-completion-star">⭐</span>` : ""}
          </div>

          <div class="admin-completion-meta">
            ${formatAdminDateTime(row.awarded_at)}
          </div>
        </div>

        <div class="admin-completion-right">
          <div class="admin-completion-points">
            ${row.bonus_points || 0}P
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  contentEl.innerHTML = html;

  overlay.classList.remove("hidden");
}


/* ============================================================
 * CHALLENGE-DETAILMODAL IM GAMES-TAB
 * ============================================================ */

/**
 * Baut Galerieeinträge für eine Challenge aus den completed rows.
 */
function buildAdminGameChallengeGalleryEntries(gameId, challengeId) {
  return getAdminChallengeCompletedRows(gameId, challengeId)
    .filter(row => row.proof_image_path)
    .map(row => ({
      playerId: row.player_id,
      playerName: getAdminPlayerName(row.player_id),
      completedAt: row.completed_at,
      proofImagePath: row.proof_image_path,
      pointsAwarded: row.points_awarded || 0,
      wasFirstSolver: row.was_first_solver === true
    }));
}

/** Baut das Challenge-Modal einmalig auf */
function ensureAdminGameChallengeModal() {
  if (document.getElementById("adminGameChallengeOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "adminGameChallengeOverlay";
  overlay.className = "modal-overlay hidden";

  overlay.innerHTML = `
    <div class="modal admin-game-challenge-modal">
      <button id="closeAdminGameChallengeBtn" class="modal-close-btn" type="button">×</button>

      <div id="adminGameChallengeModalContent" class="rules-content admin-game-challenge-modal-content">
        <p>Lade Challenge-Details...</p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const closeBtn = document.getElementById("closeAdminGameChallengeBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      closeAdminGameChallengeModal();
    });
  }
}

let adminGamePasswordContext = null;
let adminGamePasswordAdminPassword = "";

function ensureAdminGamePasswordModal() {
  if (document.getElementById("adminGamePasswordOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "adminGamePasswordOverlay";
  overlay.className = "modal-overlay hidden";

  overlay.innerHTML = `
    <div class="modal">
      <button id="closeAdminGamePasswordBtn" class="modal-close-btn" type="button">×</button>

      <h2>Spielpasswort ändern</h2>

      <div class="rules-content">
        <p id="adminGamePasswordInfo" class="admin-details-empty">
          Leer speichern entfernt das Spielpasswort.
        </p>

        <div class="admin-form-group">
          <label for="adminGamePasswordInput"><strong>Neues Spielpasswort</strong></label>
          <input id="adminGamePasswordInput" type="password" placeholder="Leer = Passwort entfernen" />
        </div>

        <div class="admin-form-group">
          <label for="adminGamePasswordRepeatInput"><strong>Wiederholen</strong></label>
          <input id="adminGamePasswordRepeatInput" type="password" placeholder="Wiederholen" />
        </div>

        <p id="adminGamePasswordStatus" class="admin-details-empty"></p>
      </div>

      <div class="modal-actions">
        <button id="cancelAdminGamePasswordBtn" type="button" class="secondary-btn">Abbrechen</button>
        <button id="saveAdminGamePasswordBtn" type="button">Speichern</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("closeAdminGamePasswordBtn")?.addEventListener("click", closeAdminGamePasswordModal);
  document.getElementById("cancelAdminGamePasswordBtn")?.addEventListener("click", closeAdminGamePasswordModal);
  document.getElementById("saveAdminGamePasswordBtn")?.addEventListener("click", handleAdminSaveGamePassword);
}

async function openAdminGamePasswordModal(game) {
  if (!game) return;

  const adminPassword = await requireAdminPassword();
  if (!adminPassword) return;

  adminGamePasswordAdminPassword = adminPassword;
  adminGamePasswordContext = game;

  ensureAdminGamePasswordModal();

  document.getElementById("adminGamePasswordInput").value = "";
  document.getElementById("adminGamePasswordRepeatInput").value = "";
  document.getElementById("adminGamePasswordStatus").textContent = "";
  document.getElementById("adminGamePasswordInfo").textContent =
    `Spiel: ${game.name || `Spiel ${game.id}`}. Leer speichern entfernt das Spielpasswort.`;

  document.getElementById("adminGamePasswordOverlay")?.classList.remove("hidden");

  setTimeout(() => {
    document.getElementById("adminGamePasswordInput")?.focus();
  }, 0);
}

function closeAdminGamePasswordModal() {
  adminGamePasswordContext = null;
  adminGamePasswordAdminPassword = "";

  document.getElementById("adminGamePasswordOverlay")?.classList.add("hidden");
}

async function handleAdminSaveGamePassword() {
  const game = adminGamePasswordContext;
  if (!game) return;

  const password = document.getElementById("adminGamePasswordInput")?.value || "";
  const repeat = document.getElementById("adminGamePasswordRepeatInput")?.value || "";
  const status = document.getElementById("adminGamePasswordStatus");

  if (password !== repeat) {
    if (status) status.textContent = "Die beiden Passwörter stimmen nicht überein.";
    return;
  }

  if (password.trim() && password.length < 4) {
    if (status) status.textContent = "Das Spielpasswort muss mindestens 4 Zeichen haben.";
    return;
  }

  if (!adminGamePasswordAdminPassword) {
    if (status) status.textContent = "Admin-Passwort fehlt. Bitte erneut öffnen.";
    return;
  }

  if (status) status.textContent = "Speichere Spielpasswort...";

  try {
    const { data, error } = await supabaseClient.rpc(
      "update_bingo_game_password",
      {
        p_admin_user_id: adminPlayer?.id || null,
        p_admin_password: adminGamePasswordAdminPassword,
        p_game_id: game.id,
        p_new_game_password: password,
        p_new_game_password_repeat: repeat
      }
    );

    if (error) throw error;

    if (!data) {
      if (status) status.textContent = "Spielpasswort konnte nicht gespeichert werden.";
      return;
    }

    await logAdminGameUpdated({
      gameId: game.id,
      adminPlayerId: adminPlayer?.id || null,
      metadata: {
        admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
        game_name: game.name || null,
        field: "game_password_hash",
        action: password.trim() ? "set_game_password" : "remove_game_password"
      }
    });

    alert(password.trim() ? "Spielpasswort wurde gespeichert." : "Spielpasswort wurde entfernt.");

    closeAdminGamePasswordModal();
    await initializeAdminGamesTab();
  } catch (error) {
    console.error("Fehler beim Speichern des Spielpassworts:", error);
    if (status) status.textContent = error.message || "Spielpasswort konnte nicht gespeichert werden.";
  }
}

/** Öffnet das Challenge-Modal */
function openAdminGameChallengeModal() {
  const overlay = document.getElementById("adminGameChallengeOverlay");
  if (!overlay) return;
  overlay.classList.remove("hidden");
}

/** Schließt das Challenge-Modal und setzt Galerie-State zurück */
function closeAdminGameChallengeModal() {
  const overlay = document.getElementById("adminGameChallengeOverlay");
  if (!overlay) return;

  overlay.classList.add("hidden");
  currentAdminGameChallengeGalleryEntries = [];
  currentAdminGameChallengeGalleryIndex = 0;
}

/** Rendert das aktuell gewählte Galerie-Bild */
function renderAdminGameChallengeGalleryCurrent() {
  const container = document.getElementById("adminGameChallengeGallery");
  if (!container) return;

  if (!currentAdminGameChallengeGalleryEntries.length) {
    container.innerHTML = `
      <div class="admin-game-challenge-gallery-stage empty">
        <p class="admin-details-empty">Noch keine Bilder vorhanden.</p>
      </div>
    `;
    return;
  }

  const entry = currentAdminGameChallengeGalleryEntries[currentAdminGameChallengeGalleryIndex];
  const imageUrl = getPublicImageUrl(entry.proofImagePath);

  container.innerHTML = `
    <div class="admin-game-challenge-gallery-stage">
      ${currentAdminGameChallengeGalleryIndex > 0 ? `<button class="admin-gallery-arrow left" id="adminGameChallengeGalleryPrevBtn" type="button" aria-label="Vorheriges Bild">‹</button>` : ""}
      <img src="${imageUrl}" class="admin-game-challenge-gallery-image" alt="Beweisfoto" />
      ${currentAdminGameChallengeGalleryIndex < currentAdminGameChallengeGalleryEntries.length - 1 ? `<button class="admin-gallery-arrow right" id="adminGameChallengeGalleryNextBtn" type="button" aria-label="Nächstes Bild">›</button>` : ""}

      <div class="admin-game-challenge-gallery-caption">
        <strong>${entry.playerName}</strong>
        <span>${formatAdminDateTime(entry.completedAt)}</span>
      </div>
    </div>
  `;

  document.getElementById("adminGameChallengeGalleryPrevBtn")?.addEventListener("click", () => {
    if (currentAdminGameChallengeGalleryIndex > 0) {
      currentAdminGameChallengeGalleryIndex--;
      renderAdminGameChallengeGalleryCurrent();
    }
  });

  document.getElementById("adminGameChallengeGalleryNextBtn")?.addEventListener("click", () => {
    if (currentAdminGameChallengeGalleryIndex < currentAdminGameChallengeGalleryEntries.length - 1) {
      currentAdminGameChallengeGalleryIndex++;
      renderAdminGameChallengeGalleryCurrent();
    }
  });
}

/** Springt in der Galerie zum Bild eines bestimmten Players */
function setAdminGameChallengeGalleryToPlayer(playerId) {
  const index = currentAdminGameChallengeGalleryEntries.findIndex(entry => entry.playerId === playerId);
  if (index >= 0) {
    currentAdminGameChallengeGalleryIndex = index;
    renderAdminGameChallengeGalleryCurrent();
  }
}

async function loadAdminChallengeFailedLogs(gameId, challengeId) {
  try {
    if (DataService?.logs?.loadActivityLogs) {
      const rows = await DataService.logs.loadActivityLogs({
        gameId,
        eventType: "challenge_failed",
        limit: 1000
      });

      return (rows || [])
        .filter(row => Number(row.challenge_id) === Number(challengeId))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    const { data, error } = await supabaseClient
      .from("activity_logs")
      .select("id, game_id, player_id, challenge_id, event_type, created_at, metadata")
      .eq("game_id", gameId)
      .eq("challenge_id", challengeId)
      .eq("event_type", "challenge_failed")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.warn("Aufgabenabbrüche konnten nicht geladen werden:", error);
    return [];
  }
}

function openAdminChallengePlayerRows(title, rows, game) {
  openAdminGamePlayersListModal(
    title,
    rows.map(row => ({
      playerId: row.playerId,
      name: getAdminPlayerName(row.playerId),
      meta: row.meta || ""
    })),
    game
  );
}

/**
 * Öffnet die Detailansicht einer einzelnen Challenge im Games-Tab.
 * Enthält:
 * - editierbare Eigenschaften
 * - Statistik
 * - Galerie
 * - Leaderboard / Completion-Liste
 */
async function openAdminGameChallengeDetails(game, challenge) {
  if (!game || !challenge) return;

  const contentEl = document.getElementById("adminGameChallengeModalContent");
  if (!contentEl) return;

  const completions = getAdminChallengeCompletedRows(game.id, challenge.id);
  const activeRows = getAdminChallengeActiveRows(game.id, challenge.id);
  const failedLogs = await loadAdminChallengeFailedLogs(game.id, challenge.id);

  currentAdminGameChallengeGalleryEntries = buildAdminGameChallengeGalleryEntries(game.id, challenge.id);
  currentAdminGameChallengeGalleryIndex = 0;

  let leaderboardHtml = `
    <div class="admin-completed-wrapper admin-game-challenge-leaderboard">
      <h3>Leaderboard dieser Aufgabe</h3>
      <div class="admin-completion-list">
  `;

  if (!completions.length) {
    leaderboardHtml += `<p class="admin-details-empty">Noch niemand.</p>`;
  } else {
    completions.forEach((row, index) => {
      const playerName = getAdminPlayerName(row.player_id);
      const clickable = row.proof_image_path ? "clickable" : "";

      leaderboardHtml += `
        <div class="admin-completion-row">
          <div class="admin-completion-left">
            <div class="admin-completion-name ${clickable}" data-player-id="${row.player_id}">
              ${index + 1}. ${playerName}
              ${index === 0 ? `<span class="admin-completion-star">⭐</span>` : ""}
            </div>
            <div class="admin-completion-meta">
              ${row.success_variant_label ? `${row.success_variant_label} · ` : ""}${formatAdminDateTime(row.completed_at)}
            </div>
          </div>
          <div class="admin-completion-right">
            <div class="admin-completion-points">${row.points_awarded || 0}P</div>
          </div>
        </div>
      `;
    });
  }

  leaderboardHtml += `</div></div>`;

  contentEl.innerHTML = `
    <div class="admin-game-challenge-cards admin-game-challenge-detail-grid">
      <div id="adminEditChallengeTitleBtn" class="admin-game-challenge-card editable admin-game-challenge-title-card admin-game-challenge-card-wide">
        <div class="admin-game-challenge-card-label">Titel</div>
        <div class="admin-game-challenge-card-value clickable-value">${challenge.title || "–"}</div>
      </div>

      <div id="adminEditChallengeTaskBtn" class="admin-game-challenge-card editable compact-text-card">
        <div class="admin-game-challenge-card-label">Beschreibung</div>
        <div class="admin-game-challenge-card-value muted clickable-value"><span class="admin-one-line-preview">${getFirstLinePreview(challenge.task)}</span></div>
      </div>
      <div id="adminEditChallengeDetailsBtn" class="admin-game-challenge-card editable compact-text-card">
        <div class="admin-game-challenge-card-label">Hinweistext</div>
        <div class="admin-game-challenge-card-value muted clickable-value"><span class="admin-one-line-preview">${getFirstLinePreview(challenge.details)}</span></div>
      </div>
      <div id="adminEditChallengeSuccessBtn" class="admin-game-challenge-card editable compact-text-card">
        <div class="admin-game-challenge-card-label">Erfolgstext</div>
        <div class="admin-game-challenge-card-value muted clickable-value"><span class="admin-one-line-preview">${getFirstLinePreview(challenge.success_text)}</span></div>
      </div>

      <div id="adminEditChallengePointsBtn" class="admin-game-challenge-card editable">
        <div class="admin-game-challenge-card-label">Punkte</div>
        <div class="admin-game-challenge-card-value clickable-value">${getAdminChallengePointsValueDisplay(challenge)}</div>
      </div>
      <div id="adminToggleChallengePhotoBtn" class="admin-game-challenge-card editable">
        <div class="admin-game-challenge-card-label">Foto-Modus</div>
        <div class="admin-game-challenge-card-value clickable-value ${getAdminChallengePhotoMode(challenge) === "none" ? "muted" : ""}">${getAdminChallengePhotoModeLabel(challenge)}</div>
      </div>
      <div id="adminEditChallengeCategoryBtn" class="admin-game-challenge-card editable">
        <div class="admin-game-challenge-card-label">Kategorie</div>
        <div class="admin-game-challenge-card-value clickable-value">${challenge.category_icon || "–"}</div>
      </div>

      <div id="adminEditChallengeVariant1Btn" class="admin-game-challenge-card editable">
        <div class="admin-game-challenge-card-label">Variante 1</div>
        <div class="admin-game-challenge-card-value muted clickable-value">${challenge.success_variant_1 || "–"}</div>
      </div>
      <div id="adminEditChallengeVariant2Btn" class="admin-game-challenge-card editable">
        <div class="admin-game-challenge-card-label">Variante 2</div>
        <div class="admin-game-challenge-card-value muted clickable-value">${challenge.success_variant_2 || "–"}</div>
      </div>
      <div id="adminEditChallengeVariant3Btn" class="admin-game-challenge-card editable">
        <div class="admin-game-challenge-card-label">Variante 3</div>
        <div class="admin-game-challenge-card-value muted clickable-value">${challenge.success_variant_3 || "–"}</div>
      </div>

      <div id="adminEditChallengeImageBtn" class="admin-game-challenge-card editable">
        <div class="admin-game-challenge-card-label">Aufgabenbild</div>
        <div class="admin-game-challenge-card-value clickable-value ${challenge.description_image_path ? "" : "muted"}">${challenge.description_image_path ? "Vorhanden" : "Keines"}</div>
      </div>
      <div id="adminToggleChallengeActiveBtn" class="admin-game-challenge-card editable">
        <div class="admin-game-challenge-card-label">Status</div>
        <div class="admin-game-challenge-card-value clickable-value ${challenge.is_active ? "success-state" : "muted"}">${challenge.is_active ? "Aktiv" : "Inaktiv"}</div>
      </div>
      <div class="admin-game-challenge-card">
        <div class="admin-game-challenge-card-label">Gridposition</div>
        <div class="admin-game-challenge-card-value">${challenge.position ?? "-"}</div>
      </div>

      <div id="adminChallengeSolvedStatsBtn" class="admin-game-challenge-card stat-card clickable-stat">
        <div class="admin-game-challenge-card-label">Gelöst</div>
        <div class="admin-game-challenge-card-value clickable-value">${completions.length}</div>
      </div>
      <div id="adminChallengeActiveStatsBtn" class="admin-game-challenge-card stat-card clickable-stat">
        <div class="admin-game-challenge-card-label">Gerade aktiv</div>
        <div class="admin-game-challenge-card-value clickable-value">${activeRows.length}</div>
      </div>
      <div id="adminChallengeFailedStatsBtn" class="admin-game-challenge-card stat-card clickable-stat">
        <div class="admin-game-challenge-card-label">Aufgegeben</div>
        <div class="admin-game-challenge-card-value clickable-value">${failedLogs.length}</div>
      </div>
    </div>

    <div id="adminGameChallengeGallery" class="admin-game-challenge-gallery"></div>
    ${leaderboardHtml}
  `;

  const handlers = {
    adminEditChallengeTitleBtn: () => handleAdminEditChallengeTitle(game, challenge),
    adminEditChallengeTaskBtn: () => handleAdminEditChallengeTask(game, challenge),
    adminEditChallengeDetailsBtn: () => handleAdminEditChallengeDetails(game, challenge),
    adminEditChallengePointsBtn: () => handleAdminEditChallengePoints(game, challenge),
    adminEditChallengeSuccessBtn: () => handleAdminEditChallengeSuccessText(game, challenge),
    adminEditChallengeImageBtn: () => openAdminChallengeImageModal(game, challenge),
    adminEditChallengeVariant1Btn: () => handleAdminEditChallengeSuccessVariant(game, challenge, 1),
    adminEditChallengeVariant2Btn: () => handleAdminEditChallengeSuccessVariant(game, challenge, 2),
    adminEditChallengeVariant3Btn: () => handleAdminEditChallengeSuccessVariant(game, challenge, 3),
    adminToggleChallengePhotoBtn: () => handleAdminToggleChallengePhoto(game, challenge),
    adminToggleChallengeActiveBtn: () => handleAdminToggleChallengeActive(game, challenge),
    adminEditChallengeCategoryBtn: () => handleAdminEditChallengeCategory(game, challenge)
  };

  Object.entries(handlers).forEach(([id, handler]) => {
    document.getElementById(id)?.addEventListener("click", handler);
  });

  document.getElementById("adminChallengeSolvedStatsBtn")?.addEventListener("click", () => {
    openAdminChallengePlayerRows(
      `Gelöst – ${challenge.title || `Feld ${challenge.position}`}`,
      completions.map(row => ({
        playerId: row.player_id,
        meta: formatAdminDateTime(row.completed_at)
      })),
      game
    );
  });

  document.getElementById("adminChallengeActiveStatsBtn")?.addEventListener("click", () => {
    openAdminChallengePlayerRows(
      `Gerade aktiv – ${challenge.title || `Feld ${challenge.position}`}`,
      activeRows.map(row => ({
        playerId: row.player_id,
        meta: row.started_at ? formatAdminDateTime(row.started_at) : "Aktiv"
      })),
      game
    );
  });

  document.getElementById("adminChallengeFailedStatsBtn")?.addEventListener("click", () => {
    openAdminChallengePlayerRows(
      `Aufgegeben – ${challenge.title || `Feld ${challenge.position}`}`,
      failedLogs.map(row => ({
        playerId: row.player_id,
        meta: formatAdminDateTime(row.created_at)
      })),
      game
    );
  });

  contentEl.querySelectorAll(".admin-completion-name.clickable").forEach(el => {
    el.addEventListener("click", () => {
      setAdminGameChallengeGalleryToPlayer(Number(el.dataset.playerId));
    });
  });

  renderAdminGameChallengeGalleryCurrent();
  openAdminGameChallengeModal();
}


/* ============================================================
 * AUFGABENBILD-MODAL
 * ============================================================ */

let adminChallengeImageContext = null;

function ensureAdminChallengeImageModal() {
  if (document.getElementById("adminChallengeImageOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "adminChallengeImageOverlay";
  overlay.className = "modal-overlay hidden";

  overlay.innerHTML = `
    <div class="modal">
      <button id="closeAdminChallengeImageBtn" class="modal-close-btn" type="button">×</button>
      <h2>Aufgabenbild</h2>

      <div class="rules-content">
        <p id="adminChallengeImageInfo" class="admin-details-empty"></p>

        <div id="adminChallengeImageCurrentPreview" class="admin-challenge-image-preview-wrap"></div>

        <div class="admin-form-group">
          <label for="adminChallengeImageInput"><strong>Neues Bild hochladen</strong></label>
          <input id="adminChallengeImageInput" type="file" accept="image/*" />
        </div>

        <p id="adminChallengeImageStatus" class="admin-details-empty"></p>
      </div>

      <div class="modal-actions">
        <button id="removeAdminChallengeImageBtn" type="button" class="danger-btn-soft">Bild entfernen</button>
        <button id="cancelAdminChallengeImageBtn" type="button" class="secondary-btn">Abbrechen</button>
        <button id="saveAdminChallengeImageBtn" type="button">Bild hochladen</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("closeAdminChallengeImageBtn")?.addEventListener("click", closeAdminChallengeImageModal);
  document.getElementById("cancelAdminChallengeImageBtn")?.addEventListener("click", closeAdminChallengeImageModal);
  document.getElementById("saveAdminChallengeImageBtn")?.addEventListener("click", handleAdminSaveChallengeImage);
  document.getElementById("removeAdminChallengeImageBtn")?.addEventListener("click", handleAdminRemoveChallengeImage);
}

function openAdminChallengeImageModal(game, challenge) {
  if (!game || !challenge) return;

  ensureAdminChallengeImageModal();

  adminChallengeImageContext = { game, challenge };

  const overlay = document.getElementById("adminChallengeImageOverlay");
  const infoEl = document.getElementById("adminChallengeImageInfo");
  const inputEl = document.getElementById("adminChallengeImageInput");
  const statusEl = document.getElementById("adminChallengeImageStatus");
  const previewEl = document.getElementById("adminChallengeImageCurrentPreview");
  const removeBtn = document.getElementById("removeAdminChallengeImageBtn");

  if (infoEl) {
    infoEl.textContent = `${challenge.title || `Feld ${challenge.position}`} · ${game.name || `Spiel ${game.id}`}`;
  }

  if (inputEl) inputEl.value = "";
  if (statusEl) statusEl.textContent = "";

  const imageUrl = getAdminChallengeImagePublicUrl(challenge.description_image_path);

  if (previewEl) {
    previewEl.innerHTML = imageUrl
      ? `<img src="${imageUrl}" class="admin-challenge-description-image-preview" alt="Aufgabenbild" />`
      : `<p class="admin-details-empty">Noch kein Aufgabenbild gesetzt.</p>`;
  }

  if (removeBtn) {
    removeBtn.classList.toggle("hidden", !challenge.description_image_path);
  }

  overlay?.classList.remove("hidden");
}

function closeAdminChallengeImageModal() {
  adminChallengeImageContext = null;
  document.getElementById("adminChallengeImageOverlay")?.classList.add("hidden");
}

function getAdminChallengeImagePublicUrl(path) {
  if (!path) return null;

  if (typeof DataService !== "undefined" && DataService.storage?.getChallengeImagePublicUrl) {
    return DataService.storage.getChallengeImagePublicUrl(path);
  }

  const { data } = supabaseClient.storage
    .from("challenge-images")
    .getPublicUrl(path);

  return data?.publicUrl || null;
}

function buildAdminChallengeImagePath(gameId, challengeId, file) {
  const extension = String(file?.name || "image.jpg")
    .split(".")
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") || "jpg";

  return `game-${gameId}/challenge-${challengeId}/description-${Date.now()}.${extension}`;
}

async function uploadAdminChallengeImageFile(gameId, challengeId, file) {
  if (!file) return null;

  if (!file.type || !file.type.startsWith("image/")) {
    alert("Bitte eine Bilddatei auswählen.");
    return null;
  }

  const path = buildAdminChallengeImagePath(gameId, challengeId, file);

  const { error } = await supabaseClient.storage
    .from("challenge-images")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg"
    });

  if (error) {
    console.error("Fehler beim Hochladen des Aufgabenbildes:", error);
    alert("Aufgabenbild konnte nicht hochgeladen werden.");
    return null;
  }

  return path;
}

async function handleAdminSaveChallengeImage() {
  const context = adminChallengeImageContext;
  if (!context?.game || !context?.challenge) return;

  const { game, challenge } = context;
  const inputEl = document.getElementById("adminChallengeImageInput");
  const statusEl = document.getElementById("adminChallengeImageStatus");
  const file = inputEl?.files?.[0] || null;

  if (!file) {
    if (statusEl) statusEl.textContent = "Bitte zuerst ein Bild auswählen.";
    return;
  }

  if (statusEl) statusEl.textContent = "Bild wird hochgeladen...";

  const imagePath = await uploadAdminChallengeImageFile(game.id, challenge.id, file);
  if (!imagePath) {
    if (statusEl) statusEl.textContent = "Upload fehlgeschlagen.";
    return;
  }

  const updated = await updateAdminChallengeFields(challenge.id, {
    description_image_path: imagePath
  });

  if (!updated) return;

  await logAdminChallengeUpdated({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    challengeId: challenge.id,
    metadata: {
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      challenge_title: challenge.title || null,
      position: challenge.position ?? null,
      game_name: game.name || null,
      field: "description_image_path",
      old_value: challenge.description_image_path || null,
      new_value: imagePath
    }
  });

  closeAdminChallengeImageModal();
  await refreshAdminGamesChallengeModal(game.id, challenge.id);
}

async function handleAdminRemoveChallengeImage() {
  const context = adminChallengeImageContext;
  if (!context?.game || !context?.challenge) return;

  const { game, challenge } = context;

  if (!challenge.description_image_path) return;

  const confirmed = confirm("Aufgabenbild wirklich entfernen? Die Datei bleibt im Storage erhalten, wird aber nicht mehr angezeigt.");
  if (!confirmed) return;

  const updated = await updateAdminChallengeFields(challenge.id, {
    description_image_path: null
  });

  if (!updated) return;

  await logAdminChallengeUpdated({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    challengeId: challenge.id,
    metadata: {
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      challenge_title: challenge.title || null,
      position: challenge.position ?? null,
      game_name: game.name || null,
      field: "description_image_path",
      old_value: challenge.description_image_path || null,
      new_value: null
    }
  });

  closeAdminChallengeImageModal();
  await refreshAdminGamesChallengeModal(game.id, challenge.id);
}

/* ============================================================
 * CHALLENGE-BEARBEITUNG
 * ============================================================ */

/**
 * Aktualisiert eine Challenge in der DB und liefert die aktualisierte Zeile zurück.
 */
async function updateAdminChallengeFields(challengeId, updates) {
  const { data, error } = await supabaseClient
    .from("challenges")
    .update(updates)
    .eq("id", challengeId)
    .select()
    .single();

  if (error) {
    console.error("Fehler beim Aktualisieren der Challenge:", error);
    alert("Challenge konnte nicht aktualisiert werden.");
    return null;
  }

  return data;
}

/**
 * Lädt nach Änderungen das Modal und die Spielansicht sauber neu.
 */
async function refreshAdminGamesChallengeModal(gameId, challengeId) {
  await Promise.all([
    loadAllPlayerChallengesForAdmin(),
    loadAllChallengesForAdminDetailed()
  ]);

  const game = adminGames.find(g => g.id === gameId);
  const challenge = adminChallenges.find(c => c.id === challengeId);

  if (!game || !challenge) {
    closeAdminGameChallengeModal();
    await initializeAdminGamesTab();
    return;
  }

  await renderAdminGameDetails(game);
  await openAdminGameChallengeDetails(game, challenge);
}

/** Challenge-Titel bearbeiten */
async function handleAdminEditChallengeTitle(game, challenge) {

  const oldTitle = challenge.title || "";

  const input = prompt("Neuen Namen der Challenge eingeben:", challenge.title || "");
  if (input === null) return;

  const value = input.trim();
  if (!value) {
    alert("Bitte einen gültigen Namen eingeben.");
    return;
  }

  const updated = await updateAdminChallengeFields(challenge.id, { title: value });
  if (!updated) return;

  await logAdminChallengeUpdated({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    challengeId: challenge.id,
    metadata: {
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      challenge_title: value,
      position: challenge.position ?? null,
      game_name: game.name || null,
      field: "title",
      old_value: oldTitle,
      new_value: value
    }
  });

  await refreshAdminGamesChallengeModal(game.id, challenge.id);
}

/** Challenge-Beschreibung bearbeiten */
async function handleAdminEditChallengeTask(game, challenge) {

  const oldTask = challenge.task || "";
  openAdminTextEditModal({
    title: "Beschreibung bearbeiten",
    initialValue: challenge.task || "",
    onSave: async (value) => {
      const trimmed = value.trim();
      if (!trimmed) {
        alert("Bitte eine gültige Beschreibung eingeben.");
        return;
      }

      const updated = await updateAdminChallengeFields(challenge.id, {
        task: trimmed
      });
      if (!updated) return;

      await logAdminChallengeUpdated({
        gameId: game.id,
        adminPlayerId: adminPlayer?.id || null,
        challengeId: challenge.id,
        metadata: {
          admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
          challenge_title: challenge.title || null,
          position: challenge.position ?? null,
          game_name: game.name || null,
          field: "task",
          old_value: oldTask,
          new_value: trimmed
        }
      });

      closeAdminTextEditModal();
      await refreshAdminGamesChallengeModal(game.id, challenge.id);
    }
  });
}

/** Hinweistext bearbeiten */
async function handleAdminEditChallengeDetails(game, challenge) {

  const oldDetails = challenge.details || "";
  openAdminTextEditModal({
    title: "Hinweistext bearbeiten",
    initialValue: challenge.details || "",
    onSave: async (value) => {
      const updated = await updateAdminChallengeFields(challenge.id, {
        details: value.trim() ? value : null
      });
      if (!updated) return;


            await logAdminChallengeUpdated({
        gameId: game.id,
        adminPlayerId: adminPlayer?.id || null,
        challengeId: challenge.id,
        metadata: {
          admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
          challenge_title: challenge.title || null,
          position: challenge.position ?? null,
          game_name: game.name || null,
          field: "details",
          old_value: oldDetails,
          new_value: value.trim() ? value : null
        }
      });
      closeAdminTextEditModal();
      await refreshAdminGamesChallengeModal(game.id, challenge.id);
    }
  });
}

/** Congratulation/Erfolgstext bearbeiten */
async function handleAdminEditChallengeSuccessText(game, challenge) {
  const oldSuccessText = challenge.success_text || "";
  openAdminTextEditModal({
    title: "Erfolgstext bearbeiten",
    initialValue: challenge.success_text || "",
    onSave: async (value) => {
      const updated = await updateAdminChallengeFields(challenge.id, {
        success_text: value.trim() ? value : null
      });
      if (!updated) return;

            await logAdminChallengeUpdated({
        gameId: game.id,
        adminPlayerId: adminPlayer?.id || null,
        challengeId: challenge.id,
        metadata: {
          admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
          challenge_title: challenge.title || null,
          position: challenge.position ?? null,
          game_name: game.name || null,
          field: "success_text",
          old_value: oldSuccessText,
          new_value: value.trim() ? value : null
        }
      });
      closeAdminTextEditModal();
      await refreshAdminGamesChallengeModal(game.id, challenge.id);
    }
  });
}

/** Punkte bearbeiten */
async function handleAdminEditChallengePoints(game, challenge) {
  const oldPoints = challenge.points ?? null;
  const input = prompt(
    "Neue Punktzahl eingeben (leer = variable Punkte / ?):",
    challenge.points === null || challenge.points === undefined ? "" : String(challenge.points)
  );

  if (input === null) return;

  const trimmed = input.trim();
  const value = trimmed === "" ? null : Number(trimmed);

  if (value !== null && (!Number.isFinite(value) || value < 0)) {
    alert("Ungültige Punktzahl.");
    return;
  }

  const updated = await updateAdminChallengeFields(challenge.id, { points: value });
  if (!updated) return;

  await logAdminChallengeUpdated({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    challengeId: challenge.id,
    metadata: {
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      challenge_title: challenge.title || null,
      position: challenge.position ?? null,
      game_name: game.name || null,
      field: "points",
      old_value: oldPoints,
      new_value: value
    }
  });

  await refreshAdminGamesChallengeModal(game.id, challenge.id);
}

async function handleAdminEditChallengeSuccessVariant(game, challenge, variantNumber) {
  if (![1, 2, 3].includes(Number(variantNumber))) return;

  const field = `success_variant_${variantNumber}`;
  const oldValue = challenge[field] || "";

  const input = prompt(
    `Text für Variante ${variantNumber} eingeben (leer = entfernen):`,
    oldValue
  );

  if (input === null) return;

  const value = input.trim();

  const updated = await updateAdminChallengeFields(challenge.id, {
    [field]: value || null
  });

  if (!updated) return;

  await logAdminChallengeUpdated({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    challengeId: challenge.id,
    metadata: {
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      challenge_title: challenge.title || null,
      position: challenge.position ?? null,
      game_name: game.name || null,
      field,
      old_value: oldValue || null,
      new_value: value || null
    }
  });

  await refreshAdminGamesChallengeModal(game.id, challenge.id);
}

/** Foto erforderlich toggeln */
async function handleAdminToggleChallengePhoto(game, challenge) {
  const oldMode = getAdminChallengePhotoMode(challenge);
  const newMode = getNextAdminChallengePhotoMode(challenge);

  const updated = await updateAdminChallengeFields(challenge.id, {
    photo_mode: newMode,
    requires_photo_proof: newMode === "required"
  });

  if (!updated) return;

  await logAdminChallengeUpdated({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    challengeId: challenge.id,
    metadata: {
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      challenge_title: challenge.title || null,
      position: challenge.position ?? null,
      game_name: game.name || null,
      field: "photo_mode",
      old_value: oldMode,
      new_value: newMode
    }
  });

  await refreshAdminGamesChallengeModal(game.id, challenge.id);
}

/** Challenge aktiv/inaktiv toggeln */
async function handleAdminToggleChallengeActive(game, challenge) {
  const oldActive = challenge.is_active === true;
  const newActive = !oldActive;
  const updated = await updateAdminChallengeFields(challenge.id, {
    is_active: !(challenge.is_active === true)
  });
  if (!updated) return;

    await logAdminChallengeUpdated({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    challengeId: challenge.id,
    metadata: {
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      challenge_title: challenge.title || null,
      position: challenge.position ?? null,
      game_name: game.name || null,
      field: "is_active",
      old_value: oldActive,
      new_value: newActive
    }
  });
  await refreshAdminGamesChallengeModal(game.id, challenge.id);
}

/** Kategorie bearbeiten */
async function handleAdminEditChallengeCategory(game, challenge) {
  const oldCategory = challenge.category_icon || null;
  const input = prompt(
    "Kategorie-Icon / Text bearbeiten (leer = entfernen):",
    challenge.category_icon || ""
  );
  if (input === null) return;

  const value = input.trim();

  const updated = await updateAdminChallengeFields(challenge.id, {
    category_icon: value || null
  });
  if (!updated) return;

    await logAdminChallengeUpdated({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    challengeId: challenge.id,
    metadata: {
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      challenge_title: challenge.title || null,
      position: challenge.position ?? null,
      game_name: game.name || null,
      field: "category_icon",
      old_value: oldCategory,
      new_value: value || null
    }
  });
  await refreshAdminGamesChallengeModal(game.id, challenge.id);
}

function getAdminChallengePhotoMode(challenge) {
  if (!challenge) return "none";

  if (challenge.photo_mode) {
    return challenge.photo_mode;
  }

  return challenge.requires_photo_proof === true ? "required" : "none";
}

function getAdminChallengePhotoModeLabel(challenge) {
  const mode = getAdminChallengePhotoMode(challenge);

  if (mode === "required") return "Pflicht";
  if (mode === "optional") return "Optional";
  return "Kein Foto";
}

function getNextAdminChallengePhotoMode(challenge) {
  const mode = getAdminChallengePhotoMode(challenge);

  if (mode === "none") return "optional";
  if (mode === "optional") return "required";
  return "none";
}

/* ============================================================
 * GENERISCHES TEXT-EDIT-MODAL
 * ============================================================ */

/** Baut das generische Text-Modal einmalig auf */
function ensureAdminTextEditModal() {
  if (document.getElementById("adminTextEditOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "adminTextEditOverlay";
  overlay.className = "modal-overlay hidden";

  overlay.innerHTML = `
    <div class="modal">
      <button id="closeAdminTextEditBtn" class="modal-close-btn" type="button">×</button>
      <h2 id="adminTextEditTitle">Text bearbeiten</h2>

      <div class="rules-content">
        <textarea id="adminTextEditTextarea" class="admin-text-edit-textarea"></textarea>
      </div>

      <div class="modal-actions">
        <button id="cancelAdminTextEditBtn" type="button" class="secondary-btn">Abbrechen</button>
        <button id="saveAdminTextEditBtn" type="button">Speichern</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const closeBtn = document.getElementById("closeAdminTextEditBtn");
  const cancelBtn = document.getElementById("cancelAdminTextEditBtn");

  if (closeBtn) {
    closeBtn.addEventListener("click", closeAdminTextEditModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", closeAdminTextEditModal);
  }
}

/** Öffnet das Text-Edit-Modal */
function openAdminTextEditModal({ title, initialValue, onSave }) {
  ensureAdminTextEditModal();

  const overlay = document.getElementById("adminTextEditOverlay");
  const titleEl = document.getElementById("adminTextEditTitle");
  const textarea = document.getElementById("adminTextEditTextarea");
  const saveBtn = document.getElementById("saveAdminTextEditBtn");

  if (!overlay || !titleEl || !textarea || !saveBtn) return;

  titleEl.textContent = title || "Text bearbeiten";
  textarea.value = initialValue || "";

  saveBtn.onclick = async () => {
    await onSave(textarea.value);
  };

  overlay.classList.remove("hidden");

  setTimeout(() => {
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, 0);
}

/** Schließt das Text-Edit-Modal */
function closeAdminTextEditModal() {
  const overlay = document.getElementById("adminTextEditOverlay");
  if (!overlay) return;
  overlay.classList.add("hidden");
}

/** Liefert für Vorschaukacheln nur die erste Zeile */
function getFirstLinePreview(text) {
  if (!text) return "–";

  const normalized = String(text).replace(/\r/g, "").trim();
  if (!normalized) return "–";

  const firstLine = normalized.split("\n")[0].trim();
  return firstLine || "–";
}

/* ============================================================
 * LEADERBOARD DES SPIELS
 * ============================================================ */

/**
 * Rendert das Leaderboard eines Spiels.
 */
function renderAdminGameLeaderboard(game) {
  const listEl = document.getElementById("adminGameLeaderboard");
  if (!listEl || !game) return;

  const leaderboard = getAdminGameLeaderboardRows(game.id);

  if (!leaderboard.length) {
    listEl.innerHTML = `<p class="admin-details-empty">Noch keine Spieler in diesem Spiel.</p>`;
    return;
  }

  let html = `<div class="admin-completion-list">`;

  leaderboard.forEach((entry, index) => {
    html += `
      <div class="admin-completion-row">
        <div class="admin-completion-left">
          <div class="admin-completion-name">
            #${index + 1} ${entry.name}
          </div>
          <div class="admin-completion-meta">
            ${entry.activeChallengeId ? "Aktive Aufgabe" : "Keine aktive Aufgabe"}
            ${isCooldownActiveAdmin(entry.cooldownUntil) ? " · Cooldown" : ""}
            ${entry.isBlocked ? " · Gesperrt" : ""}
          </div>
        </div>

        <div class="admin-completion-right">
          <div class="admin-completion-points">${entry.score}P</div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  listEl.innerHTML = html;
}

/* ============================================================
 * SPIEL ERSTELLEN - MODAL
 * ============================================================ */

/** Baut das "Neues Spiel"-Modal einmalig auf */
function ensureAdminCreateGameModal() {
  if (document.getElementById("adminCreateGameOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "adminCreateGameOverlay";
  overlay.className = "modal-overlay hidden";

  overlay.innerHTML = `
    <div class="modal">
      <button id="closeAdminCreateGameBtn" class="modal-close-btn">×</button>

      <h2>Neues Spiel erstellen</h2>

      <div class="rules-content">

        <div class="admin-form-group">
          <label>Name</label>
          <input id="adminCreateGameName" type="text" placeholder="z.B. Festival Bingo 2026">
        </div>

        <div class="admin-form-group">
          <label>Gridgröße</label>
          <div id="adminGridSizeSelector" class="admin-grid-size-selector"></div>
        </div>

        <div class="admin-form-group">
          <label>Cooldown</label>
          <div class="admin-time-input">
            <input id="adminCooldownMinutes" type="number" min="0" value="1"> min
            <input id="adminCooldownSeconds" type="number" min="0" max="59" value="0"> sek
          </div>
        </div>

        <div class="admin-form-group">
          <label>Bingo Bonus</label>
          <input id="adminCreateGameBingo" type="number" min="0" value="5">
        </div>

        <div class="admin-form-group">
          <label>
            <input id="adminCreateGameActive" type="checkbox" checked>
            Spiel aktiv
          </label>
        </div>

        <div id="adminCreateGameSummary" class="admin-create-summary">
          Es werden 25 Aufgaben erstellt
        </div>

      </div>

      <div class="modal-actions">
        <button id="adminCreateGameSubmitBtn">Spiel erstellen</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("closeAdminCreateGameBtn")
    .addEventListener("click", closeAdminCreateGameModal);

  document.getElementById("adminCreateGameSubmitBtn")
    .addEventListener("click", handleAdminCreateGameFromModal);
}

/** Rendert die wählbaren Gridgrößen 3x3 bis 7x7 */
function renderGridSizeSelector() {
  const container = document.getElementById("adminGridSizeSelector");
  if (!container) return;

  container.innerHTML = "";

  for (let i = 3; i <= 7; i++) {
    const btn = document.createElement("div");
    btn.className = "admin-grid-size-option";
    if (i === selectedGridSize) btn.classList.add("active");

    btn.textContent = `${i}x${i}`;

    btn.addEventListener("click", () => {
      selectedGridSize = i;
      renderGridSizeSelector();
      updateCreateGameSummary();
    });

    container.appendChild(btn);
  }
}

/** Aktualisiert die Zusammenfassung im Create-Game-Modal */
function updateCreateGameSummary() {
  const el = document.getElementById("adminCreateGameSummary");
  if (!el) return;

  const count = selectedGridSize * selectedGridSize;
  el.textContent = `Es werden ${count} Aufgaben erstellt`;
}

/** Öffnet das Create-Game-Modal */
function openAdminCreateGameModal() {
  ensureAdminCreateGameModal();

  selectedGridSize = 5;
  renderGridSizeSelector();
  updateCreateGameSummary();

  document.getElementById("adminCreateGameOverlay").classList.remove("hidden");
}

/** Schließt das Create-Game-Modal */
function closeAdminCreateGameModal() {
  document.getElementById("adminCreateGameOverlay").classList.add("hidden");
}

/**
 * Erstellt ein neues Spiel und legt automatisch alle Challenges an.
 * Startet danach direkt den Setup-Wizard.
 */
async function handleAdminCreateGameFromModal() {
  const name = document.getElementById("adminCreateGameName").value.trim();
  const minutes = Number(document.getElementById("adminCooldownMinutes").value || 0);
  const seconds = Number(document.getElementById("adminCooldownSeconds").value || 0);
  const bingo = Number(document.getElementById("adminCreateGameBingo").value || 0);
  const active = document.getElementById("adminCreateGameActive").checked;

  if (!name) {
    alert("Bitte Namen eingeben");
    return;
  }

  const cooldownSeconds = minutes * 60 + seconds;

  const { data: game, error } = await supabaseClient
    .from("games")
    .insert({
      name,
      grid_size: selectedGridSize,
      cooldown_seconds: cooldownSeconds,
      bingo_bonus_points: bingo,
      is_active: active,
      visibility: "public",
      game_password_hash: null
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    alert("Fehler beim Erstellen");
    return;
  }

   await logAdminGameCreated({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    metadata: {
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      game_name: game.name || null,
      grid_size: game.grid_size || null,
      cooldown_seconds: game.cooldown_seconds ?? null,
      bingo_bonus_points: game.bingo_bonus_points ?? null,
      is_active: game.is_active === true
    }
  });

  const challenges = [];
  const total = selectedGridSize * selectedGridSize;

  for (let i = 1; i <= total; i++) {
    challenges.push({
      game_id: game.id,
      position: i,
      title: `Feld ${i}`,
      task: "",
      points: 1,
      description_image_path: null,
      photo_mode: "none",
      requires_photo_proof: false,
      is_active: true
    });
  }

  const { error: challengeError } = await supabaseClient
    .from("challenges")
    .insert(challenges);

  if (challengeError) {
    console.error(challengeError);
    alert("Fehler beim Erstellen der Aufgaben");
    return;
  }

  closeAdminCreateGameModal();

  selectedAdminGameDetailsId = game.id;
  adminCurrentGameId = game.id;
  adminCurrentGame = game;
  saveGameIdToLocalStorageAdmin(adminCurrentGameId);
  updateAdminCurrentGameDisplay();

  await loadAllGamesForAdmin();
  await loadAllChallengesForAdminDetailed();
  await initializeAdminGamesTab();

  startAdminChallengeSetup(game.id);
}

/* ============================================================
 * SPIEL DUPLIZIEREN / AUFGABEN PRÜFEN / SPIEL LÖSCHEN
 * ============================================================ */

/**
 * Dupliziert ein Spiel inklusive aller Challenges.
 * Spielerfortschritte werden bewusst NICHT übernommen.
 */
async function handleAdminDuplicateGame(game) {
  if (!game) {
    alert("Kein Spiel ausgewählt.");
    return;
  }

  const suggestedName = `${game.name} Kopie`;
  const input = prompt("Name für die Kopie:", suggestedName);
  if (input === null) return;

  const newName = input.trim();
  if (!newName) {
    alert("Bitte einen gültigen Namen eingeben.");
    return;
  }

  const { data: newGame, error: gameError } = await supabaseClient
    .from("games")
    .insert({
      name: newName,
      grid_size: game.grid_size,
      cooldown_seconds: game.cooldown_seconds ?? 0,
      bingo_bonus_points: game.bingo_bonus_points ?? 0,
      first_bingo_bonus_points: game.first_bingo_bonus_points ?? 3,
      single_use_challenges: game.single_use_challenges === true,
      visibility: game.visibility || "public",
      game_password_hash: game.game_password_hash || null,

      // Eine Kopie startet weiterhin bewusst inaktiv. Alle übrigen
      // Spielregeln und Zugangseinstellungen werden vollständig übernommen.
      is_active: false
    })
    .select()
    .single();

  if (gameError || !newGame) {
    console.error("Fehler beim Duplizieren des Spiels:", gameError);
    alert("Spiel konnte nicht dupliziert werden.");
    return;
  }

    await logAdminGameDuplicated({
    gameId: newGame.id,
    adminPlayerId: adminPlayer?.id || null,
    metadata: {
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      source_game_id: game.id,
      source_game_name: game.name || null,
      game_name: newGame.name || null,
      grid_size: newGame.grid_size || null,
      cooldown_seconds: newGame.cooldown_seconds ?? null,
      bingo_bonus_points: newGame.bingo_bonus_points ?? null,
      first_bingo_bonus_points: newGame.first_bingo_bonus_points ?? null,
      single_use_challenges: newGame.single_use_challenges === true,
      visibility: newGame.visibility || "public",
      has_game_password: !!newGame.game_password_hash,
      is_active: newGame.is_active === true
    }
  });

  const sourceChallenges = adminChallenges
    .filter(challenge => challenge.game_id === game.id)
    .sort((a, b) => Number(a.position) - Number(b.position));

  const challengePayload = sourceChallenges.map(challenge => ({
    game_id: newGame.id,
    position: challenge.position,
    title: challenge.title,
    task: challenge.task,
    points: challenge.points,
    is_active: challenge.is_active,
    category_icon: challenge.category_icon || null,
    details: challenge.details || null,
    success_text: challenge.success_text || null,
    description_image_path: challenge.description_image_path || null,
    requires_photo_proof: challenge.requires_photo_proof === true,
    photo_mode: challenge.photo_mode || (challenge.requires_photo_proof ? "required" : "none"),
    success_variant_1: challenge.success_variant_1 || null,
    success_variant_2: challenge.success_variant_2 || null,
    success_variant_3: challenge.success_variant_3 || null
  }));

  if (challengePayload.length > 0) {
    const { error: challengeError } = await supabaseClient
      .from("challenges")
      .insert(challengePayload);

    if (challengeError) {
      console.error("Fehler beim Kopieren der Challenges:", challengeError);
      alert("Spiel wurde erstellt, aber die Aufgaben konnten nicht kopiert werden.");
      return;
    }
  }

  selectedAdminGameDetailsId = newGame.id;
  adminCurrentGameId = newGame.id;
  adminCurrentGame = newGame;
  saveGameIdToLocalStorageAdmin(adminCurrentGameId);
  updateAdminCurrentGameDisplay();

  await initializeAdminGamesTab();
}

/**
 * Startet den Setup-Wizard nur für unvollständige Aufgaben.
 */
async function handleAdminCheckIncompleteChallenges(game) {
  if (!game) {
    alert("Kein Spiel ausgewählt.");
    return;
  }

  await loadAllChallengesForAdminDetailed();

  const incompleteChallenges = adminChallenges
    .filter(challenge => challenge.game_id === game.id)
    .filter(challenge => isAdminChallengeIncomplete(challenge))
    .sort((a, b) => Number(a.position) - Number(b.position));

  if (!incompleteChallenges.length) {
    alert("Alle Aufgaben sind vollständig befüllt.");
    return;
  }

  const positions = incompleteChallenges.map(challenge => Number(challenge.position));
  startAdminChallengeSetup(game.id, positions);
}

/**
 * Löscht ein Spiel samt aller zugehörigen Daten.
 */
async function handleAdminDeleteGame(game) {
  if (!game) {
    alert("Kein Spiel ausgewählt.");
    return;
  }

  const confirmed = confirm(
    `Spiel "${game.name}" wirklich löschen?\n\n` +
    `Achtung: Das löscht auch Challenges, Spielstände, Challenge-Fortschritte und Bingos dieses Spiels.`
  );
  if (!confirmed) return;

    await logAdminGameDeleted({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    metadata: {
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      game_name: game.name || null,
      grid_size: game.grid_size || null,
      cooldown_seconds: game.cooldown_seconds ?? null,
      bingo_bonus_points: game.bingo_bonus_points ?? null,
      is_active: game.is_active === true
    }
  });

  const deletions = [
    { table: "player_bingos", column: "game_id" },
    { table: "player_challenges", column: "game_id" },
    { table: "player_live_challenges", column: "game_id" },
    { table: "player_game_state", column: "game_id" },
    { table: "live_challenges", column: "game_id" },
    { table: "challenges", column: "game_id" }
  ];

  for (const entry of deletions) {
    const { error } = await supabaseClient
      .from(entry.table)
      .delete()
      .eq(entry.column, game.id);

    if (error) {
      console.error(`Fehler beim Löschen aus ${entry.table}:`, error);
      alert(`Fehler beim Löschen aus ${entry.table}.`);
      return;
    }
  }

  const { error: gameError } = await supabaseClient
    .from("games")
    .delete()
    .eq("id", game.id);

  if (gameError) {
    console.error("Fehler beim Löschen des Spiels:", gameError);
    alert("Spiel konnte nicht gelöscht werden.");
    return;
  }

  if (adminCurrentGameId === game.id) {
    adminCurrentGameId = null;
    adminCurrentGame = null;
  }

  selectedAdminGameDetailsId = null;

  await loadAdminCurrentGame();
  await initializeAdminGamesTab();
}

function getAdminBingoLineCount(gameId, lineIndex) {
  return adminPlayerBingos.filter(row =>
    Number(row.game_id) === Number(gameId) &&
    String(row.line_key) === String(lineIndex)
  ).length;
}

function createAdminBingoLineIndicator(game, lineIndex, title) {
  const count = getAdminBingoLineCount(game.id, lineIndex);

  const el = document.createElement("div");
  el.className = "admin-bingo-line-indicator";
  el.title = `${title} Bingo`;

  if (count > 0) {
    el.classList.add("solved");
  }

  el.textContent = `(${count})`;

  el.addEventListener("click", () => {
    openAdminBingoLineDetails(game, lineIndex, title);
  });

  return el;
}

