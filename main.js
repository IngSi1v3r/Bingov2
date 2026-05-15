/**
 * ============================================================
 * main.js
 * ============================================================
 *
 * Zweck:
 * Start- und Ablaufsteuerung der normalen Spielerseite (index.html).
 *
 * Diese Datei kuemmert sich um:
 * - Welcome-Overlay fuer neue Spieler
 * - Spielauswahl-Overlay
 * - Laden des aktuell gewaehlten Spiels
 * - Start der App nach Auth-Bootstrap
 * - zentrales spielerseitiges Polling ueber PollingService
 * - Behandlung deaktivierter oder geloeschter Spiele
 *
 * Nicht hier enthalten:
 * - Auth-Logik -> auth.js
 * - Supabase-Ladefunktionen -> data.js / data_service.js
 * - Gameplay-Aktionen -> game.js
 * - UI-Modals und Profil -> app.js
 * - Live-Challenge-Details -> live-challenges.js
 */

/* ============================================================
 * DOM
 * ============================================================ */

const welcomeOverlay = document.getElementById("welcomeOverlay");
const welcomeStartBtn = document.getElementById("welcomeStartBtn");

const gameNameEl = document.getElementById("gameName");
const gameSelectOverlay = document.getElementById("gameSelectOverlay");
const gameList = document.getElementById("gameList");
const closeGameSelectBtn = document.getElementById("closeGameSelectBtn");
const gameSelectBtn = document.getElementById("gameSelectBtn");

/* ============================================================
 * STATE
 * ============================================================ */

let inactiveGameHandled = false;

/* ============================================================
 * WELCOME OVERLAY
 * ============================================================ */

function openWelcomeOverlay() {
  if (!welcomeOverlay) return;
  welcomeOverlay.classList.remove("hidden");
}

function closeWelcomeOverlay() {
  if (!welcomeOverlay) return;
  welcomeOverlay.classList.add("hidden");
}

/* ============================================================
 * GAME SELECT OVERLAY
 * ============================================================ */

function openGameSelectOverlay() {
  if (!gameSelectOverlay) return;
  gameSelectOverlay.classList.remove("hidden");
}

function closeGameSelectOverlay() {
  if (!gameSelectOverlay) return;
  gameSelectOverlay.classList.add("hidden");
}

/**
 * Rendert die Liste aller aktiven Spiele.
 * Der eigentliche Spielwechsel erfolgt beim Klick auf ein Spiel.
 */
async function renderGameList() {
  if (!gameList) return;

  const result = await loadAllGames();
  const myGames = result.myGames || [];
  const availableGames = result.availableGames || [];

  gameList.innerHTML = "";

  if (!myGames.length && !availableGames.length) {
    gameList.innerHTML = `<p>Keine aktiven Spiele gefunden.</p>`;
    return;
  }

  gameList.innerHTML = `
    <div class="game-select-section">
      <h3>Meine Spiele</h3>
      <div id="myGamesList" class="game-select-list"></div>
    </div>

    <div class="game-select-section">
      <h3>Verfügbare Spiele</h3>
      <div id="availableGamesList" class="game-select-list"></div>
    </div>
  `;

  const myGamesList = document.getElementById("myGamesList");
  const availableGamesList = document.getElementById("availableGamesList");

  if (myGamesList) {
    if (!myGames.length) {
      myGamesList.innerHTML = `<p class="auth-hint">Noch keine eigenen Spiele.</p>`;
    } else {
      myGames.forEach(game => {
        const btn = document.createElement("button");
        btn.className = "secondary-btn game-select-entry game-select-entry-rich";

        const state = game.playerState || {};
        const score = state.score ?? 0;
        const playerCount = game.playerCount ?? "-";
        const gridSize = game.grid_size || 5;
        const lastActive = formatGameSelectLastActive(state.updated_at || state.created_at);
        const isCurrent = Number(game.id) === Number(currentGameId);

        btn.innerHTML = `
          <div class="game-select-main-row">
            <strong>${game.name || `Spiel ${game.id}`}</strong>
            <span class="game-select-score">${score}P</span>
          </div>

          <div class="game-select-meta-row">
            ${gridSize}x${gridSize} · ${playerCount} Spieler · zuletzt aktiv: ${lastActive}
            ${isCurrent ? " · aktuell geöffnet" : ""}
          </div>
        `;

        btn.onclick = async () => {
          setCurrentGameId(game.id);
          closeGameSelectOverlay();
          await loadCurrentGameIntoApp();
        };

        myGamesList.appendChild(btn);
      });
    }
  }

  if (availableGamesList) {
    if (!availableGames.length) {
      availableGamesList.innerHTML = `<p class="auth-hint">Keine weiteren Spiele verfügbar.</p>`;
    } else {
      availableGames.forEach(game => {
        const btn = document.createElement("button");
        btn.className = "secondary-btn game-select-entry game-select-entry-rich";

        const gridSize = game.grid_size || 5;
        const playerCount = game.playerCount ?? "-";
        const isProtected = !!game.game_password_hash;

        btn.innerHTML = `
          <div class="game-select-main-row">
            <strong>${game.name || `Spiel ${game.id}`}</strong>
            <span class="game-select-score">${isProtected ? "🔒" : ""}</span>
          </div>

          <div class="game-select-meta-row">
            ${gridSize}x${gridSize} · ${playerCount} Spieler
          </div>
        `;

        btn.onclick = async () => {
          await handleJoinGameFromSelect(game);
        };

        availableGamesList.appendChild(btn);
      });
    }
  }
}

function formatGameSelectLastActive(isoString) {
  if (!isoString) return "-";

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function handleJoinGameFromSelect(game) {
  if (!game || !currentPlayer) return;

  let password = "";

  const isProtected = !!game.game_password_hash;

  if (isProtected) {
    password = prompt(`Passwort für "${game.name}" eingeben:`);
    if (password === null) return;
  }

  try {
    setCurrentGameId(game.id);

    const state = await joinCurrentGame(currentPlayer.id, password);

    if (!state) {
      alert("Spiel konnte nicht betreten werden.");
      return;
    }

    closeGameSelectOverlay();
    await loadCurrentGameIntoApp();
  } catch (error) {
    if (error.message?.includes("GAME_PASSWORD_INVALID")) {
      alert("Das Spielpasswort ist falsch.");
      return;
    }

    if (error.message?.includes("GAME_PRIVATE")) {
      alert("Dieses Spiel ist privat.");
      return;
    }

    if (error.message?.includes("GAME_INACTIVE")) {
      alert("Dieses Spiel ist nicht aktiv.");
      return;
    }

    alert(error.message || "Spiel konnte nicht betreten werden.");
  }
}

/* ============================================================
 * POLLING - PLAYER FAST
 * ============================================================ */

/**
 * Stoppt alle spielerseitigen Polling-Jobs.
 * Der Funktionsname bleibt absichtlich gleich wie bisher,
 * damit bestehende Aufrufe nicht angepasst werden muessen.
 */
function stopGlobalStatsPolling() {
  if (typeof PollingService === "undefined") return;

  PollingService.stopJob("player-fast");
}

/**
 * Startet das schnelle Polling der Spielerseite.
 *
 * Inhalt:
 * - Spieler weiterhin erlaubt?
 * - aktuelles Spiel weiterhin aktiv?
 * - ueberfaellige Live-Challenges ablaufen lassen
 * - Challenge-Stammdaten nachladen
 * - Spielerstatus synchronisieren
 * - globale Challenge-Stats laden
 * - Grid, Leaderboard und Live-Challenge-Status aktualisieren
 *
 * Das Intervall kommt aus polling_service.js.
 */
function startGlobalStatsPolling() {
  stopGlobalStatsPolling();

  if (typeof PollingService === "undefined") {
    console.error("PollingService nicht gefunden. Bitte polling_service.js einbinden.");
    return;
  }

  PollingService.registerOrUpdateJob({
    id: "player-fast",
    level: "fast",
    description: "Spielerseite: State, Stats, Leaderboard und Live-Challenges",
    runImmediately: false,
    callback: async () => {
      if (!currentPlayer) return;

      const stillAllowed = await checkCurrentPlayerStillAllowed();
      if (!stillAllowed) return;

      const gameStillActive = await checkCurrentGameStillActive();
      if (!gameStillActive) return;

      await expireOverdueLiveChallenges();

      const challengesLoaded = await loadChallengesFromDatabase();
      if (!challengesLoaded) return;

      const stateSynced = await syncPlayerStateFromDatabase();
      if (!stateSynced) return;

      const statsLoaded = await loadGlobalChallengeStats();
      if (!statsLoaded) return;

      await loadGlobalBingoLineStats();

      renderGrid();
      await renderLeaderboard();
      await checkLiveChallengeStatus();
    }
  });

  PollingService.startJob("player-fast");
}

/* ============================================================
 * INACTIVE GAME HANDLING
 * ============================================================ */

/**
 * Schliesst alle offenen Overlays.
 * Wird verwendet, wenn das aktuelle Spiel nicht mehr verfuegbar ist.
 */
function closeAllGameOverlaysSafely() {
  try {
    if (typeof closeModal === "function") closeModal();
    if (typeof closeUploadModal === "function") closeUploadModal();
    if (typeof closePhotoViewer === "function") closePhotoViewer();
    if (typeof closeRulesModal === "function") closeRulesModal();
    if (typeof closeDetailsModal === "function") closeDetailsModal();
    if (typeof closeFinalOverlay === "function") closeFinalOverlay();
    if (typeof closePlayerProfileModal === "function") closePlayerProfileModal();
    if (typeof closeFailConfirmModal === "function") closeFailConfirmModal();
    if (typeof closeLiveChallengeOverlay === "function") closeLiveChallengeOverlay();
    if (typeof closeWelcomeOverlay === "function") closeWelcomeOverlay();
  } catch (err) {
    console.warn("Fehler beim Schliessen der Overlays:", err);
  }
}

/**
 * Stoppt den lokalen Cooldown-Loop, falls er gerade laeuft.
 */
function stopCooldownLoopIfRunning() {
  if (typeof cooldownInterval !== "undefined" && cooldownInterval) {
    clearInterval(cooldownInterval);
    cooldownInterval = null;
  }
}

function showInactiveGameOverlay(message) {
  const overlay = document.getElementById("blockedOverlay");
  const titleEl = document.getElementById("blockedOverlayTitle");
  const textEl = document.getElementById("blockedOverlayText");
  const button = document.getElementById("blockedBackToLoginBtn");

  if (!overlay) {
    alert(message);
    return;
  }

  if (titleEl) {
    titleEl.textContent = "Spiel nicht verfügbar";
  }

  if (textEl) {
    textEl.textContent = message;
  }

  if (button) {
    button.textContent = "Anderes Spiel auswählen";
    button.onclick = async () => {
      overlay.classList.add("hidden");
      await renderGameList();
      openGameSelectOverlay();

  setTimeout(async () => {
    const freshGame = await loadCurrentGameFresh();

    if (!freshGame || freshGame.is_active !== true) {
      showInactiveGameOverlay(message);
    }
  }, 3000);
};
  }

  overlay.classList.remove("hidden");
}

/**
 * Reagiert darauf, dass das aktuelle Spiel deaktiviert oder geloescht wurde.
 */
function handleInactiveCurrentGame(message = "Dieses Spiel wurde deaktiviert.") {
  inactiveGameHandled = true;

  closeAllGameOverlaysSafely();
  stopGlobalStatsPolling();
  stopCooldownLoopIfRunning();

  showInactiveGameOverlay(message);
}

/**
 * Prueft, ob das aktuelle Spiel weiterhin existiert und aktiv ist.
 */
async function checkCurrentGameStillActive() {
  if (!currentPlayer || !currentGameId) return true;

  const freshGame = await loadCurrentGameFresh();

  if (!freshGame) {
    handleInactiveCurrentGame("Das aktuell geoeffnete Spiel ist nicht mehr verfuegbar.");
    return false;
  }

  if (freshGame.is_active !== true) {
    handleInactiveCurrentGame("Dieses Spiel wurde soeben deaktiviert. Bitte waehle ein anderes Spiel aus.");
    return false;
  }

  currentGame = freshGame;
  return true;
}

/* ============================================================
 * APP-INHALT LADEN
 * ============================================================ */

/**
 * Laedt das aktuell ausgewaehlte Spiel vollstaendig in die App.
 *
 * Ablauf:
 * 1. Polling stoppen
 * 2. Spiel laden
 * 3. Challenges laden
 * 4. Spielerstatus laden
 * 5. globale Stats laden
 * 6. UI rendern
 * 7. Polling wieder starten
 */
async function loadCurrentGameIntoApp() {
  stopGlobalStatsPolling();
  inactiveGameHandled = false;

  const gameLoaded = await loadGame();

  if (!gameLoaded) {
    alert("Spiel konnte nicht geladen werden.");
    return;
  }

  if (currentGame && gameNameEl) {
    gameNameEl.textContent = currentGame.name;
  }

  const challengesLoaded = await loadChallengesFromDatabase();

  if (!challengesLoaded) {
    alert("Challenges konnten nicht aus Supabase geladen werden.");
    return;
  }

  const stateLoaded = await initializePlayerStateFromDatabase();

  if (!stateLoaded) {
    alert("Spielstand konnte nicht geladen werden.");
    return;
  }

  const statsLoaded = await loadGlobalChallengeStats();

  await loadGlobalBingoLineStats();

  if (!statsLoaded) {
    alert("Globale Feldinformationen konnten nicht geladen werden.");
    return;
  }

  renderGrid();
  clearFinalSeenIfNeeded();
  await renderLeaderboard();

  startGlobalStatsPolling();

  if (isCooldownActive()) {
    updateCooldownDisplay();
    startCooldownLoop();
    return;
  }

  if (gameState.activeChallengeId !== null) {
    const activeChallenge = getChallengeByBoardId(gameState.activeChallengeId);

    if (activeChallenge) {
      openChallengeModal(activeChallenge);
    }
  }
}

/* ============================================================
 * APP START
 * ============================================================ */

/**
 * Startet die Spielerseite:
 * - Auth pruefen
 * - Spiel laden
 * - bei neuer Registrierung Welcome-Overlay anzeigen
 */
async function startGameApp() {
  const boot = await authBootstrapForGamePage();
  if (!boot?.allowed) return;

  await loadCurrentGameIntoApp();

  if (typeof initializePlayerPushService === "function") {
    await initializePlayerPushService({
      justRegistered: boot.justRegistered === true
    });
  }

  if (boot.justRegistered) {
    openWelcomeOverlay();
  }
}

/* ============================================================
 * EVENTS
 * ============================================================ */

if (welcomeStartBtn) {
  welcomeStartBtn.addEventListener("click", () => {
    closeWelcomeOverlay();

    if (typeof maybeShowPlayerPushRegistrationPrompt === "function") {
      maybeShowPlayerPushRegistrationPrompt();
    }
  });
}

if (gameSelectBtn) {
  gameSelectBtn.addEventListener("click", async () => {
    await renderGameList();
    openGameSelectOverlay();
  });
}

if (closeGameSelectBtn) {
  closeGameSelectBtn.addEventListener("click", () => {
    closeGameSelectOverlay();
  });
}

/* ============================================================
 * INIT
 * ============================================================ */

startGameApp();