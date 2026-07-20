/**
 * ============================================================================
 * DATEI: admin_dashboard.js
 * ============================================================================
 *
 * ZWECK
 * -----
 * Diese Datei steuert den Dashboard-Tab des Adminpanels. Das Dashboard dient
 * als kompakte, überwiegend globale Systemübersicht und gleichzeitig als
 * Schnellnavigation zu den Detail-Tabs für Spieler, Spiele, Live-Challenges
 * und Logs.
 *
 * ENTHALTENE BEREICHE
 * ------------------
 * 1. Initialisierung und Grundlayout
 *    - erzeugt die Dashboard-Struktur einmalig im DOM
 *    - lädt die benötigten Daten
 *    - stößt das vollständige Rendering an
 *
 * 2. Modals
 *    - generisches Listenmodal für Kennzahlen und Auffälligkeiten
 *    - Informationsmodal für Polling-Intervalle
 *    - Modal zum Ändern des Session-Passworts
 *
 * 3. Datenbeschaffung und Aufbereitung
 *    - lädt das Dashboard-Bundle über den DataService
 *    - lädt zusätzlich die global letzten fünf Activity-Logs
 *    - bereitet Kennzahlen, Warnungen, Rangliste und Mini-Grid auf
 *
 * 4. Navigation
 *    - öffnet andere Admin-Tabs
 *    - setzt bei Bedarf den ausgewählten Spieler, das Spiel oder die
 *      Live-Challenge vor dem Tabwechsel
 *
 * 5. Rendering
 *    - globale Statistik-Kacheln
 *    - Mini-Grid des aktuell ausgewählten Spiels
 *    - Top-5-Rangliste dieses Spiels
 *    - global letzte fünf Logs
 *    - Polling-Einstellungen und externe Zugänge
 *
 * 6. Einstellungen und Hilfsfunktionen
 *    - Polling-Presets und manuelle Intervalle
 *    - Änderung des Session-Passworts
 *    - HTML-Escaping für dynamische Inhalte
 *
 * ABHÄNGIGKEITEN
 * --------------
 * Die Datei ist kein eigenständiges Modul und erwartet folgende globale
 * Bestandteile der Admin-Anwendung:
 *
 * - DataService.bundles.loadAdminDashboard(...)
 * - supabaseClient
 * - PollingService
 * - globale Datenvariablen wie adminPlayers, adminGames,
 *   adminPlayerStates, adminPlayerChallenges, adminPlayerBingos und
 *   adminChallenges
 * - Auswahlvariablen wie adminCurrentGameId, adminCurrentGame,
 *   selectedAdminPlayerId, selectedAdminGameDetailsId und
 *   selectedAdminLiveChallengeId
 * - Navigations- und Formatierungsfunktionen wie activateAdminTabByName,
 *   openAdminLogEntry, formatActivityLogMessage, formatActivityDateTime,
 *   formatAdminDateTime, formatAdminCooldown und isCooldownActiveAdmin
 * - Passwortfunktionen und Supabase-RPC update_bingo_session_password
 * - globale CSS-Klassen für Modals, Buttons, Formulare und Detailkarten
 *
 * WICHTIGE DESIGNENTSCHEIDUNGEN
 * ----------------------------
 * - Die Kennzahlen und letzten Logs sind global.
 * - Mini-Grid und Rangliste beziehen sich auf das aktuell ausgewählte Spiel.
 * - DOM-Grundstrukturen und Modals werden nur einmal erzeugt.
 * - Dynamische Texte werden vor der Ausgabe escaped.
 * - Bestehende globale Admin-Funktionen werden, wo sinnvoll, optional über
 *   typeof- oder Optional-Chaining-Prüfungen aufgerufen.
 *
 * ZUGEHÖRIGE DATEIEN
 * ------------------
 * - admin_dashboard.css: Desktop- und Komponenten-Styling dieses Tabs
 * - admin_responsive.css: übergreifende responsive Anpassungen
 * ============================================================================
 */

/* ============================================================================
 * KAPITEL 1: LOKALER DASHBOARD-ZUSTAND
 * ============================================================================ */

let adminDashboardInitialized = false;
let adminDashboardActiveGames = [];
let adminDashboardCurrentGame = null;
let adminDashboardLogs = [];
let adminDashboardLiveChallenges = [];
let adminDashboardSessionPasswordAdminPassword = "";

/* ============================================================================
 * KAPITEL 2: INITIALISIERUNG UND GRUNDLAYOUT
 * ============================================================================ */

/** Initialisiert den Dashboard-Tab, lädt Daten und rendert alle Bereiche. */
async function initializeAdminDashboardTab() {
  // DOM-Strukturen werden idempotent angelegt und daher nicht dupliziert.
  ensureAdminDashboardLayout();
  ensureAdminDashboardListModal();
  ensureAdminDashboardSessionPasswordModal();

  // Erst nach erfolgreichem Laden wird das Dashboard vollständig gerendert.
  await loadAdminDashboardData();
  renderAdminDashboard();
  adminDashboardInitialized = true;
}

/** Erzeugt das statische Dashboard-Grundlayout genau einmal im Dashboard-Tab. */
function ensureAdminDashboardLayout() {
  const tabEl = document.getElementById("tab-dashboard");
  if (!tabEl || document.getElementById("adminDashboardLayout")) return;

  tabEl.innerHTML = `
    <div id="adminDashboardLayout" class="admin-dashboard-layout">
      <div id="adminDashboardGlobalStats"></div>

      <div class="admin-dashboard-overview-grid">
        <section class="admin-dashboard-section admin-dashboard-grid-section">
          <div id="adminDashboardMiniGrid"></div>
        </section>

        <section class="admin-dashboard-section admin-dashboard-leaderboard-section">
          <div id="adminDashboardLeaderboard"></div>
        </section>
      </div>

      <section class="admin-dashboard-section admin-dashboard-logs-section">
        <div id="adminDashboardLogs"></div>
      </section>

      <div class="admin-dashboard-settings-grid">
        <section id="adminDashboardPollingSettings" class="admin-dashboard-section"></section>
        <section id="adminDashboardSessionPassword" class="admin-dashboard-section"></section>
      </div>
    </div>
  `;
}

/* ============================================================================
 * KAPITEL 3: GENERISCHES LISTENMODAL
 * ============================================================================ */

/** Legt das wiederverwendbare Listenmodal für Detailansichten im DOM an. */
function ensureAdminDashboardListModal() {
  if (document.getElementById("adminDashboardListOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "adminDashboardListOverlay";
  overlay.className = "modal-overlay hidden";
  overlay.innerHTML = `
    <div class="modal admin-dashboard-list-modal">
      <button id="closeAdminDashboardListBtn" class="modal-close-btn" type="button">×</button>
      <h2 id="adminDashboardListTitle">Details</h2>
      <div id="adminDashboardListContent" class="admin-dashboard-modal-list"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("closeAdminDashboardListBtn")?.addEventListener("click", closeAdminDashboardListModal);
  overlay.addEventListener("click", event => {
    if (event.target === overlay) closeAdminDashboardListModal();
  });
}

/** Befüllt und öffnet das Listenmodal mit anklickbaren, frei definierten Zeilen. */
function openAdminDashboardListModal(title, rows) {
  ensureAdminDashboardListModal();

  const overlay = document.getElementById("adminDashboardListOverlay");
  const titleEl = document.getElementById("adminDashboardListTitle");
  const contentEl = document.getElementById("adminDashboardListContent");
  if (!overlay || !titleEl || !contentEl) return;

  titleEl.textContent = title;
  contentEl.innerHTML = "";

  if (!rows.length) {
    contentEl.innerHTML = `<p class="admin-details-empty">Keine Eintraege vorhanden.</p>`;
  } else {
    rows.forEach(row => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "admin-dashboard-modal-row";
      button.innerHTML = `
        <span class="admin-dashboard-modal-row-main">${escapeAdminDashboardHtml(row.label)}</span>
        ${row.meta ? `<span class="admin-dashboard-modal-row-meta">${escapeAdminDashboardHtml(row.meta)}</span>` : ""}
      `;
      button.addEventListener("click", async () => {
        closeAdminDashboardListModal();
        await row.onClick?.();
      });
      contentEl.appendChild(button);
    });
  }

  overlay.classList.remove("hidden");
}

/** Schließt das generische Listenmodal. */
function closeAdminDashboardListModal() {
  document.getElementById("adminDashboardListOverlay")?.classList.add("hidden");
}

/* ============================================================================
 * KAPITEL 4: SESSION-PASSWORT-MODAL – DOM-STRUKTUR
 * ============================================================================ */

/** Erzeugt das Modal zur Änderung des Session-Passworts samt Event-Handlern. */
function ensureAdminDashboardSessionPasswordModal() {
  if (document.getElementById("adminDashboardSessionPasswordOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "adminDashboardSessionPasswordOverlay";
  overlay.className = "modal-overlay hidden";
  overlay.innerHTML = `
    <div class="modal">
      <button id="closeAdminDashboardSessionPasswordBtn" class="modal-close-btn" type="button">×</button>
      <h2>Session-Passwort aendern</h2>

      <div class="rules-content">
        <p>Dieses Passwort wird bei der Registrierung neuer Spieler abgefragt.</p>

        <div class="admin-form-group">
          <label for="adminDashboardSessionPasswordInput"><strong>Neues Session-Passwort</strong></label>
          <input id="adminDashboardSessionPasswordInput" type="password" />
        </div>

        <div class="admin-form-group">
          <label for="adminDashboardSessionPasswordRepeatInput"><strong>Wiederholen</strong></label>
          <input id="adminDashboardSessionPasswordRepeatInput" type="password" />
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
  document.getElementById("closeAdminDashboardSessionPasswordBtn")?.addEventListener("click", closeAdminDashboardSessionPasswordModal);
  document.getElementById("cancelAdminDashboardSessionPasswordBtn")?.addEventListener("click", closeAdminDashboardSessionPasswordModal);
  document.getElementById("saveAdminDashboardSessionPasswordBtn")?.addEventListener("click", handleAdminDashboardSaveSessionPassword);
}

/* ============================================================================
 * KAPITEL 5: DATEN LADEN
 * ============================================================================ */

/** Lädt Dashboard-Daten und ergänzt sie um die global letzten fünf Logs. */
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

  adminDashboardActiveGames = bundle.activeGames || adminGames.filter(game => game.is_active === true);
  adminDashboardCurrentGame = bundle.currentGame || adminGames.find(game => Number(game.id) === Number(adminCurrentGameId)) || null;
  adminDashboardLiveChallenges = bundle.liveChallenges || [];

  // Das Dashboard zeigt bewusst die letzten Logs aller Spiele.
  // Dafür wird der zentrale Log-Loader verwendet, weil dieser neben den IDs
  // auch die verknüpften Spieler-, Admin-, Spiel- und Aufgabenobjekte lädt.
  // Ohne diese Relationen könnte der Formatter nur „Spieler 9“ bzw. „Spiel 4“
  // anzeigen. Falls die globale Abfrage fehlschlägt, bleiben die Bundle-Logs
  // des aktuell ausgewählten Spiels als Fallback erhalten.
  adminDashboardLogs = bundle.logs || [];
  try {
    if (DataService?.logs?.loadActivityLogs) {
      adminDashboardLogs = await DataService.logs.loadActivityLogs({
        limit: 5
      });
    } else if (typeof loadActivityLogs === "function") {
      adminDashboardLogs = await loadActivityLogs({
        limit: 5
      });
    }
  } catch (error) {
    console.warn("Globale Dashboard-Logs konnten nicht geladen werden:", error);
  }
}

/* ============================================================================
 * KAPITEL 6: NAVIGATION ZU ANDEREN ADMIN-TABS
 * ============================================================================ */

/** Öffnet einen Admin-Tab über die zentrale Navigation oder als Fallback per Klick. */
async function openAdminDashboardTab(tabName) {
  if (typeof activateAdminTabByName === "function") {
    await activateAdminTabByName(tabName);
    return;
  }

  const tab = document.querySelector(`.admin-tab[data-tab="${tabName}"]`);
  tab?.click();
}

/** Öffnet den Players-Tab und wählt den übergebenen Spieler vor. */
async function openAdminDashboardPlayer(playerId) {
  selectedAdminPlayerId = Number(playerId);
  await openAdminDashboardTab("players");
}

/** Setzt das gewünschte Spiel als aktuellen Kontext und öffnet den Games-Tab. */
async function openAdminDashboardGame(gameId) {
  const game = adminGames.find(row => Number(row.id) === Number(gameId));
  if (!game) return;

  adminCurrentGameId = game.id;
  adminCurrentGame = game;
  saveGameIdToLocalStorageAdmin?.(game.id);
  updateAdminCurrentGameDisplay?.();

  if (typeof selectedAdminGameDetailsId !== "undefined") {
    selectedAdminGameDetailsId = game.id;
  }

  await openAdminDashboardTab("games");
}

/** Setzt Spiel und Live-Challenge als Auswahl und öffnet den Live-Tab. */
async function openAdminDashboardLive(row) {
  if (!row) return;

  const game = adminGames.find(gameRow => Number(gameRow.id) === Number(row.game_id));
  if (game) {
    adminCurrentGameId = game.id;
    adminCurrentGame = game;
    saveGameIdToLocalStorageAdmin?.(game.id);
    updateAdminCurrentGameDisplay?.();
  }

  if (typeof selectedAdminLiveChallengeId !== "undefined") {
    selectedAdminLiveChallengeId = row.id;
  }

  await openAdminDashboardTab("live");
}

/** Öffnet einen konkreten Log-Eintrag oder wechselt ersatzweise in den Logs-Tab. */
async function openAdminDashboardLog(log) {
  if (typeof openAdminLogEntry === "function") {
    await openAdminLogEntry(log);
  } else {
    await openAdminDashboardTab("logs");
  }
}

/* ============================================================================
 * KAPITEL 7: DATENAUFBEREITUNG UND BERECHNUNGEN
 * ============================================================================ */

/** Liefert den bestmöglichen Anzeigenamen eines Spielers. */
function getAdminDashboardPlayerName(playerId) {
  const player = adminPlayers.find(row => Number(row.id) === Number(playerId));
  return player?.display_name || player?.username || `Spieler ${playerId}`;
}

/** Liefert den Spielnamen mit verständlichem Fallback. */
function getAdminDashboardGameName(gameId) {
  const game = adminGames.find(row => Number(row.id) === Number(gameId));
  return game?.name || `Spiel ${gameId}`;
}

/** Ermittelt global aktive Spieler und entfernt Mehrfachtreffer über mehrere Spiele. */
function getAdminDashboardGlobalActivePlayerRows() {
  // Ein Spieler kann Zustände in mehreren Spielen besitzen. Die Map sorgt dafür,
  // dass er in der globalen Kennzahl nur einmal gezählt wird.
  const byPlayer = new Map();

  adminPlayerStates
    .filter(row => row.active_challenge_id)
    .forEach(row => {
      if (!byPlayer.has(Number(row.player_id))) byPlayer.set(Number(row.player_id), row);
    });

  return [...byPlayer.values()];
}

/** Ermittelt global Spieler im Cooldown und entfernt Mehrfachtreffer. */
function getAdminDashboardGlobalCooldownRows() {
  // Auch hier wird pro Spieler nur ein repräsentativer Zustand gezählt.
  const byPlayer = new Map();

  adminPlayerStates
    .filter(row => isCooldownActiveAdmin(row.cooldown_until))
    .forEach(row => {
      if (!byPlayer.has(Number(row.player_id))) byPlayer.set(Number(row.player_id), row);
    });

  return [...byPlayer.values()];
}

/** Filtert alle derzeit aktiven Live-Challenges. */
function getAdminDashboardActiveLiveRows() {
  return adminDashboardLiveChallenges.filter(row => row.status === "active");
}

/** Baut die Liste der aktuellen Auffälligkeiten für die Warnungskachel auf. */
function buildAdminDashboardWarnings() {
  const warnings = [];

  if (!adminDashboardCurrentGame) {
    warnings.push({ label: "Kein aktuelles Spiel ausgewaehlt", tab: "games" });
  } else if (adminDashboardCurrentGame.is_active !== true) {
    warnings.push({ label: "Das ausgewaehlte Spiel ist inaktiv", gameId: adminDashboardCurrentGame.id });
  }

  adminGames.forEach(game => {
    const activeLiveCount = adminDashboardLiveChallenges.filter(
      row => Number(row.game_id) === Number(game.id) && row.status === "active"
    ).length;

    if (activeLiveCount > 1) {
      warnings.push({
        label: `${game.name || `Spiel ${game.id}`}: ${activeLiveCount} aktive Live-Challenges`,
        gameId: game.id,
        tab: "live"
      });
    }
  });

  const incompleteChallenges = adminChallenges.filter(challenge => {
    if (challenge.is_active === false) return false;
    return !String(challenge.title || "").trim() || !String(challenge.task || "").trim();
  });

  if (incompleteChallenges.length) {
    warnings.push({
      label: `${incompleteChallenges.length} unvollstaendige Aufgabe${incompleteChallenges.length === 1 ? "" : "n"}`,
      tab: "games"
    });
  }

  const blockedPlayers = adminPlayers.filter(player => player.is_blocked === true);
  if (blockedPlayers.length) {
    warnings.push({
      label: `${blockedPlayers.length} gesperrte${blockedPlayers.length === 1 ? "r" : ""} Spieler`,
      tab: "players"
    });
  }

  return warnings;
}

/** Liefert alle Spielerzustände des aktuell ausgewählten Spiels. */
function getAdminDashboardCurrentGameStates() {
  return adminPlayerStates.filter(row => Number(row.game_id) === Number(adminCurrentGameId));
}

/** Berechnet die nach Punkten sortierte Top-5 des aktuellen Spiels. */
function getAdminDashboardTopPlayers() {
  return getAdminDashboardCurrentGameStates()
    .map(state => ({
      playerId: state.player_id,
      playerName: getAdminDashboardPlayerName(state.player_id),
      score: state.score ?? 0
    }))
    .sort((a, b) => (b.score - a.score) || a.playerName.localeCompare(b.playerName, "de"))
    .slice(0, 5);
}

/** Erzeugt das farbcodierte, textlose Mini-Grid des aktuellen Spiels als HTML. */
function buildAdminDashboardCurrentGameMiniGrid() {
  const game = adminDashboardCurrentGame;
  if (!game) return `<p class="admin-details-empty">Kein Spiel ausgewaehlt.</p>`;

  const gridSize = Number(game.grid_size) || 5;
  const expectedCount = gridSize * gridSize;
  const gameChallenges = adminChallenges.filter(row => Number(row.game_id) === Number(game.id));
  const completedIds = new Set(
    adminPlayerChallenges
      .filter(row => Number(row.game_id) === Number(game.id) && row.status === "completed")
      .map(row => Number(row.challenge_id))
  );
  const activeIds = new Set(
    adminPlayerStates
      .filter(row => Number(row.game_id) === Number(game.id) && row.active_challenge_id)
      .map(row => Number(row.active_challenge_id))
  );
  // Direkter Positionszugriff verhindert verschachtelte Suchen beim Grid-Aufbau.
  const byPosition = new Map(gameChallenges.map(challenge => [Number(challenge.position), challenge]));

  let html = `
    <div
      id="adminDashboardGameGrid"
      class="admin-dashboard-game-grid"
      style="grid-template-columns:repeat(${gridSize}, minmax(0, 1fr));"
      title="Zum Spiele-Tab"
    >
  `;

  for (let position = 1; position <= expectedCount; position++) {
    const challenge = byPosition.get(position);
    let stateClass = "placeholder";

    if (challenge) {
      if (challenge.is_active === false) stateClass = "inactive";
      else if (activeIds.has(Number(challenge.id))) stateClass = "active";
      else if (completedIds.has(Number(challenge.id))) stateClass = "solved";
      else stateClass = "open";
    }

    html += `<div class="admin-dashboard-game-cell ${stateClass}"></div>`;
  }

  return html + `</div>`;
}

/* ============================================================================
 * KAPITEL 8: DASHBOARD RENDERN
 * ============================================================================ */

/** Rendert sämtliche dynamischen Dashboard-Bereiche in definierter Reihenfolge. */
function renderAdminDashboard() {
  renderAdminDashboardGlobalStats();
  renderAdminDashboardMiniGrid();
  renderAdminDashboardLeaderboard();
  renderAdminDashboardLogs();
  renderAdminDashboardPollingSettings();
  renderAdminDashboardSessionPassword();
}

/** Rendert globale Kennzahlen und verknüpft jede Kachel mit ihrer Detailaktion. */
function renderAdminDashboardGlobalStats() {
  const wrapper = document.getElementById("adminDashboardGlobalStats");
  if (!wrapper) return;

  const activePlayerRows = getAdminDashboardGlobalActivePlayerRows();
  const cooldownRows = getAdminDashboardGlobalCooldownRows();
  const activeLiveRows = getAdminDashboardActiveLiveRows();
  const warnings = buildAdminDashboardWarnings();

  wrapper.innerHTML = `
    <div class="admin-dashboard-stats-grid">
      ${buildAdminDashboardStatCard("adminDashboardPlayersAllCard", "Spieler global", adminPlayers.length)}
      ${buildAdminDashboardStatCard("adminDashboardPlayersActiveCard", "Spieler aktiv", activePlayerRows.length)}
      ${buildAdminDashboardStatCard("adminDashboardPlayersCooldownCard", "Spieler Cooldown", cooldownRows.length)}

      ${buildAdminDashboardStatCard("adminDashboardGamesAllCard", "Spiele global", adminGames.length)}
      ${buildAdminDashboardStatCard("adminDashboardGamesActiveCard", "Spiele aktiv", adminDashboardActiveGames.length)}
      ${buildAdminDashboardStatCard("adminDashboardLiveActiveCard", "Live aktiv", activeLiveRows.length)}

      <button id="adminDashboardWarningsCard" class="admin-detail-card admin-dashboard-stat-card admin-dashboard-warning-card" type="button">
        <span class="admin-detail-label">Auffaelligkeiten</span>
        <span class="admin-detail-value">${warnings.length}</span>
      </button>
    </div>
  `;

  document.getElementById("adminDashboardPlayersAllCard")?.addEventListener("click", () => {
    openAdminDashboardListModal("Alle Spieler", adminPlayers
      .slice()
      .sort((a, b) => getAdminDashboardPlayerName(a.id).localeCompare(getAdminDashboardPlayerName(b.id), "de"))
      .map(player => ({
        label: getAdminDashboardPlayerName(player.id),
        meta: player.is_blocked ? "Gesperrt" : "",
        onClick: () => openAdminDashboardPlayer(player.id)
      })));
  });

  document.getElementById("adminDashboardPlayersActiveCard")?.addEventListener("click", () => {
    openAdminDashboardListModal("Aktive Spieler", activePlayerRows.map(row => ({
      label: getAdminDashboardPlayerName(row.player_id),
      meta: getAdminDashboardGameName(row.game_id),
      onClick: () => openAdminDashboardPlayer(row.player_id)
    })));
  });

  document.getElementById("adminDashboardPlayersCooldownCard")?.addEventListener("click", () => {
    openAdminDashboardListModal("Spieler im Cooldown", cooldownRows.map(row => ({
      label: getAdminDashboardPlayerName(row.player_id),
      meta: `${getAdminDashboardGameName(row.game_id)} · ${formatAdminCooldown(row.cooldown_until)}`,
      onClick: () => openAdminDashboardPlayer(row.player_id)
    })));
  });

  document.getElementById("adminDashboardGamesAllCard")?.addEventListener("click", () => {
    openAdminDashboardListModal("Alle Spiele", adminGames.map(game => ({
      label: game.name || `Spiel ${game.id}`,
      meta: game.is_active ? "Aktiv" : "Inaktiv",
      onClick: () => openAdminDashboardGame(game.id)
    })));
  });

  document.getElementById("adminDashboardGamesActiveCard")?.addEventListener("click", () => {
    openAdminDashboardListModal("Aktive Spiele", adminDashboardActiveGames.map(game => ({
      label: game.name || `Spiel ${game.id}`,
      onClick: () => openAdminDashboardGame(game.id)
    })));
  });

  document.getElementById("adminDashboardLiveActiveCard")?.addEventListener("click", () => {
    openAdminDashboardListModal("Aktive Live-Challenges", activeLiveRows.map(row => ({
      label: row.title || `Live-Challenge ${row.id}`,
      meta: getAdminDashboardGameName(row.game_id),
      onClick: () => openAdminDashboardLive(row)
    })));
  });

  document.getElementById("adminDashboardWarningsCard")?.addEventListener("click", () => {
    openAdminDashboardListModal("Auffaelligkeiten", warnings.map(warning => ({
      label: warning.label,
      onClick: async () => {
        if (warning.gameId) {
          const game = adminGames.find(row => Number(row.id) === Number(warning.gameId));
          if (game) {
            adminCurrentGameId = game.id;
            adminCurrentGame = game;
            saveGameIdToLocalStorageAdmin?.(game.id);
            updateAdminCurrentGameDisplay?.();
          }
        }
        await openAdminDashboardTab(warning.tab || "dashboard");
      }
    })));
  });
}

/** Erstellt das gemeinsame HTML-Grundgerüst einer Statistik-Kachel. */
function buildAdminDashboardStatCard(id, label, value) {
  return `
    <button id="${id}" class="admin-detail-card admin-dashboard-stat-card" type="button">
      <span class="admin-detail-label">${label}</span>
      <span class="admin-detail-value">${value}</span>
    </button>
  `;
}

/** Rendert Spielname und Mini-Grid; ein Klick öffnet das betreffende Spiel. */
function renderAdminDashboardMiniGrid() {
  const wrapper = document.getElementById("adminDashboardMiniGrid");
  if (!wrapper) return;

  wrapper.innerHTML = `
    <div class="admin-dashboard-section-label">${escapeAdminDashboardHtml(adminDashboardCurrentGame?.name || "Aktuelles Spiel")}</div>
    <div class="admin-dashboard-grid-wrap">${buildAdminDashboardCurrentGameMiniGrid()}</div>
  `;

  document.getElementById("adminDashboardGameGrid")?.addEventListener("click", async () => {
    if (adminDashboardCurrentGame) await openAdminDashboardGame(adminDashboardCurrentGame.id);
  });
}

/** Rendert die Top-5 des aktuellen Spiels und verlinkt zu den Spielern. */
function renderAdminDashboardLeaderboard() {
  const wrapper = document.getElementById("adminDashboardLeaderboard");
  if (!wrapper) return;

  const rows = getAdminDashboardTopPlayers();
  let html = `<div class="admin-dashboard-section-label">Top 5</div>`;

  if (!rows.length) {
    wrapper.innerHTML = html + `<p class="admin-details-empty">Noch keine Spielstaende.</p>`;
    return;
  }

  html += `<div class="admin-dashboard-list">`;
  rows.forEach((row, index) => {
    html += `
      <button class="admin-dashboard-row admin-dashboard-leaderboard-row" data-player-id="${row.playerId}" type="button">
        <span class="admin-dashboard-rank">${index + 1}</span>
        <span class="admin-dashboard-row-title">${escapeAdminDashboardHtml(row.playerName)}</span>
        <span class="admin-dashboard-row-right">${row.score}P</span>
      </button>
    `;
  });
  html += `</div>`;
  wrapper.innerHTML = html;

  wrapper.querySelectorAll("[data-player-id]").forEach(button => {
    button.addEventListener("click", () => openAdminDashboardPlayer(Number(button.dataset.playerId)));
  });
}

/** Rendert die global letzten fünf Logs und macht jeden Eintrag anklickbar. */
function renderAdminDashboardLogs() {
  const wrapper = document.getElementById("adminDashboardLogs");
  if (!wrapper) return;

  let html = `<div class="admin-dashboard-section-label">Letzte 5 Logs</div>`;
  if (!adminDashboardLogs.length) {
    wrapper.innerHTML = html + `<p class="admin-details-empty">Keine Logs vorhanden.</p>`;
    return;
  }

  html += `<div class="admin-dashboard-list">`;
  adminDashboardLogs.slice(0, 5).forEach(log => {
    const message = typeof formatActivityLogMessage === "function"
      ? formatActivityLogMessage(log)
      : (log.message || log.event_type || "Event");
    const time = typeof formatActivityDateTime === "function"
      ? formatActivityDateTime(log.created_at)
      : formatAdminDateTime(log.created_at);

    html += `
      <button class="admin-dashboard-row admin-dashboard-log-row" data-log-id="${log.id}" type="button">
        <span class="admin-dashboard-row-title">${escapeAdminDashboardHtml(message)}</span>
        <span class="admin-dashboard-row-meta">${escapeAdminDashboardHtml(time)}</span>
      </button>
    `;
  });
  html += `</div>`;
  wrapper.innerHTML = html;

  wrapper.querySelectorAll("[data-log-id]").forEach(button => {
    button.addEventListener("click", async () => {
      const log = adminDashboardLogs.find(row => Number(row.id) === Number(button.dataset.logId));
      if (log) await openAdminDashboardLog(log);
    });
  });
}

/* ============================================================================
 * KAPITEL 9: POLLING-EINSTELLUNGEN
 * ============================================================================ */

/** Erzeugt das Informationsmodal für die aktuell verwendeten Polling-Intervalle. */
function ensureAdminDashboardPollingInfoModal() {
  if (document.getElementById("adminDashboardPollingInfoOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "adminDashboardPollingInfoOverlay";
  overlay.className = "modal-overlay hidden";
  overlay.innerHTML = `
    <div class="modal admin-dashboard-polling-info-modal">
      <button id="closeAdminDashboardPollingInfoBtn" class="modal-close-btn" type="button">×</button>
      <h2>Polling-Intervalle</h2>
      <div id="adminDashboardPollingInfoContent" class="admin-dashboard-polling-info-grid"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  document
    .getElementById("closeAdminDashboardPollingInfoBtn")
    ?.addEventListener("click", closeAdminDashboardPollingInfoModal);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) closeAdminDashboardPollingInfoModal();
  });
}

/** Schließt das Polling-Informationsmodal. */
function closeAdminDashboardPollingInfoModal() {
  document
    .getElementById("adminDashboardPollingInfoOverlay")
    ?.classList.add("hidden");
}

/** Liest die aktuellen Intervalle aus und zeigt sie kompakt im Modal an. */
function openAdminDashboardPollingInfoModal() {
  if (typeof PollingService === "undefined") return;

  ensureAdminDashboardPollingInfoModal();

  const settings = PollingService.getSettings();
  const intervals = settings.intervals || {};
  const content = document.getElementById("adminDashboardPollingInfoContent");

  const fastSeconds = Math.round((intervals.fast || 5000) / 1000);
  const slowSeconds = Math.round((intervals.slow || 60000) / 1000);
  const adminSeconds = Math.round((intervals.admin || 10000) / 1000);

  if (content) {
    content.innerHTML = `
      <div class="admin-detail-card">
        <div class="admin-detail-label">Spiel schnell</div>
        <div class="admin-detail-value">${fastSeconds} s</div>
      </div>
      <div class="admin-detail-card">
        <div class="admin-detail-label">Spiel langsam</div>
        <div class="admin-detail-value">${slowSeconds} s</div>
      </div>
      <div class="admin-detail-card">
        <div class="admin-detail-label">Admin</div>
        <div class="admin-detail-value">${adminSeconds} s</div>
      </div>
    `;
  }

  document
    .getElementById("adminDashboardPollingInfoOverlay")
    ?.classList.remove("hidden");
}

/** Normalisiert das aktive Polling-Preset für die Darstellung im Dashboard. */
function getAdminDashboardPollingPreset() {
  if (typeof PollingService === "undefined") return "normal";

  const preset = String(PollingService.getSettings()?.preset || "normal").toLowerCase();
  return ["slow", "normal", "fast"].includes(preset) ? preset : "custom";
}

/** Fragt manuelle Intervalle ab, validiert sie und speichert sie im PollingService. */
function openAdminDashboardCustomPollingDialog() {
  if (typeof PollingService === "undefined") return;

  const settings = PollingService.getSettings();
  const intervals = settings.intervals || {};
  const fastSeconds = Math.round((intervals.fast || 5000) / 1000);
  const slowSeconds = Math.round((intervals.slow || 60000) / 1000);
  const adminSeconds = Math.round((intervals.admin || 10000) / 1000);

  const fastInput = prompt("Fast-Polling in Sekunden:", String(fastSeconds));
  if (fastInput === null) return;

  const slowInput = prompt("Slow-Polling in Sekunden:", String(slowSeconds));
  if (slowInput === null) return;

  const adminInput = prompt("Admin-Polling in Sekunden:", String(adminSeconds));
  if (adminInput === null) return;

  const fast = Number(fastInput) * 1000;
  const slow = Number(slowInput) * 1000;
  const admin = Number(adminInput) * 1000;

  if (![fast, slow, admin].every(value => Number.isFinite(value) && value >= 1000)) {
    alert("Bitte gültige Werte ab 1 Sekunde eingeben.");
    return;
  }

  PollingService.setCustomIntervals({ fast, slow, admin });
  renderAdminDashboardPollingSettings();
}

/** Rendert die vier Polling-Optionen und behandelt Presetwechsel bzw. Infoklicks. */
function renderAdminDashboardPollingSettings() {
  const wrapper = document.getElementById("adminDashboardPollingSettings");
  if (!wrapper) return;

  if (typeof PollingService === "undefined") {
    wrapper.innerHTML = `
      <div class="admin-dashboard-section-label">Polling</div>
      <p class="admin-details-empty">Nicht verfügbar.</p>
    `;
    return;
  }

  const currentPreset = getAdminDashboardPollingPreset();

  wrapper.innerHTML = `
    <div class="admin-dashboard-section-label">Polling</div>
    <div class="admin-dashboard-polling-buttons">
      <button type="button" class="secondary-btn ${currentPreset === "slow" ? "active" : ""}" data-polling-preset="slow">Langsam</button>
      <button type="button" class="secondary-btn ${currentPreset === "normal" ? "active" : ""}" data-polling-preset="normal">Normal</button>
      <button type="button" class="secondary-btn ${currentPreset === "fast" ? "active" : ""}" data-polling-preset="fast">Schnell</button>
      <button type="button" class="secondary-btn ${currentPreset === "custom" ? "active" : ""}" data-polling-preset="custom">Manuell</button>
    </div>
  `;

  wrapper.querySelectorAll("[data-polling-preset]").forEach(button => {
    button.addEventListener("click", () => {
      const requestedPreset = button.dataset.pollingPreset;

      // Ein erneuter Klick auf das bereits aktive Preset zeigt dessen Intervalle.
      if (requestedPreset === currentPreset) {
        openAdminDashboardPollingInfoModal();
        return;
      }

      if (requestedPreset === "custom") {
        openAdminDashboardCustomPollingDialog();
        return;
      }

      PollingService.setPreset(requestedPreset);
      renderAdminDashboardPollingSettings();
    });
  });
}

/* ============================================================================
 * KAPITEL 10: ZUGÄNGE UND SESSION-PASSWORT
 * ============================================================================ */

/** Rendert Session-Passwort, Supabase- und OneSignal-Zugangskarten. */
function renderAdminDashboardSessionPassword() {
  const wrapper = document.getElementById("adminDashboardSessionPassword");
  if (!wrapper) return;

  wrapper.innerHTML = `
    <div class="admin-dashboard-section-label">Zugänge</div>

    <div class="admin-dashboard-access-grid">
      <button id="adminDashboardChangeSessionPasswordBtn" type="button" class="admin-dashboard-access-card">
        <span class="admin-dashboard-access-label">Session-Passwort</span>
        <strong>Ändern</strong>
      </button>

      <button id="adminDashboardDatabaseBtn" type="button" class="admin-dashboard-access-card">
        <span class="admin-dashboard-access-label">Datenbank</span>
        <strong>Öffnen ↗</strong>
      </button>

      <button id="adminDashboardOneSignalBtn" type="button" class="admin-dashboard-access-card">
        <span class="admin-dashboard-access-label">OneSignal</span>
        <strong>Öffnen ↗</strong>
      </button>
    </div>
  `;

  document
    .getElementById("adminDashboardChangeSessionPasswordBtn")
    ?.addEventListener("click", openAdminDashboardSessionPasswordModal);

  document
    .getElementById("adminDashboardDatabaseBtn")
    ?.addEventListener("click", () => {
      window.open("https://supabase.com/dashboard", "_blank", "noopener,noreferrer");
    });

  document
    .getElementById("adminDashboardOneSignalBtn")
    ?.addEventListener("click", () => {
      window.open("https://dashboard.onesignal.com/apps", "_blank", "noopener,noreferrer");
    });
}

/** Fordert zuerst das Admin-Passwort an und öffnet danach das Änderungsmodal. */
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
  const input = document.getElementById("adminDashboardSessionPasswordInput");
  const repeat = document.getElementById("adminDashboardSessionPasswordRepeatInput");
  if (input) input.value = "";
  if (repeat) repeat.value = "";
  if (status) status.textContent = "";

  document.getElementById("adminDashboardSessionPasswordOverlay")?.classList.remove("hidden");
  setTimeout(() => input?.focus(), 0);
}

/** Schließt das Passwortmodal und verwirft das zwischengespeicherte Admin-Passwort. */
function closeAdminDashboardSessionPasswordModal() {
  adminDashboardSessionPasswordAdminPassword = "";
  document.getElementById("adminDashboardSessionPasswordOverlay")?.classList.add("hidden");
}

/** Validiert die Eingaben und ändert das Session-Passwort über eine Supabase-RPC. */
async function handleAdminDashboardSaveSessionPassword() {
  const input = document.getElementById("adminDashboardSessionPasswordInput");
  const repeat = document.getElementById("adminDashboardSessionPasswordRepeatInput");
  const status = document.getElementById("adminDashboardSessionPasswordStatus");
  const password = String(input?.value || "");
  const repeated = String(repeat?.value || "");

  if (!password || !repeated) {
    if (status) status.textContent = "Bitte beide Felder ausfuellen.";
    return;
  }
  if (password.length < 4) {
    if (status) status.textContent = "Mindestens 4 Zeichen erforderlich.";
    return;
  }
  if (password !== repeated) {
    if (status) status.textContent = "Die Passwoerter stimmen nicht ueberein.";
    return;
  }
  if (!adminDashboardSessionPasswordAdminPassword) {
    if (status) status.textContent = "Admin-Passwort fehlt.";
    return;
  }

  if (status) status.textContent = "Speichere...";

  try {
    const { data, error } = await supabaseClient.rpc("update_bingo_session_password", {
      p_admin_user_id: adminPlayer?.id || null,
      p_admin_password: adminDashboardSessionPasswordAdminPassword,
      p_new_session_password: password,
      p_new_session_password_repeat: repeated
    });

    if (error) throw error;
    if (!data) {
      if (status) status.textContent = "Session-Passwort konnte nicht geaendert werden.";
      return;
    }

    alert("Session-Passwort wurde geaendert.");
    closeAdminDashboardSessionPasswordModal();
  } catch (error) {
    console.error("Fehler beim Aendern des Session-Passworts:", error);
    if (status) status.textContent = error.message || "Aenderung fehlgeschlagen.";
  }
}

/* ============================================================================
 * KAPITEL 11: ALLGEMEINE HILFSFUNKTIONEN
 * ============================================================================ */

/** Escaped dynamische Texte vor der Ausgabe in innerHTML. */
function escapeAdminDashboardHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
