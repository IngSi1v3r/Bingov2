/**
 * ============================================================
 * admin_live.js
 * ============================================================
 *
 * Zweck:
 * Dieses Skript verwaltet den "Live"-Tab im Adminpanel.
 *
 * Es kümmert sich um:
 * - Laden und Anzeigen aller Live-Challenges
 * - globale und spielbezogene Statistik
 * - Filterung der linken Liste nach Status
 * - Erstellen neuer Live-Challenges
 * - geplante automatische Starts
 * - Aktivieren, Pausieren und manuelles Beenden
 * - Bearbeiten von Titel, Beschreibung, Punkten, Dauer, Foto-Pflicht und geplantem Start
 * - Anzeige von Teilnehmern / Gewinnern / Sichtbarkeitsstatus
 * - Löschen kompletter Live-Challenges
 *
 * Wichtige Grundlogik:
 * - Live-Challenges gehören immer zu genau einem Spiel
 * - pro Spiel soll maximal eine Live-Challenge gleichzeitig aktiv sein
 * - neue Challenges werden standardmäßig als "inactive" angelegt
 * - Aktivierung kann sofort, manuell später oder automatisch per geplanter Startzeit erfolgen
 * - bei aktiven Challenges wird expires_at genutzt
 * - bei pausierten Challenges wird die verbleibende Zeit zurück in duration_minutes geschrieben
 *
 * Inhaltsübersicht:
 * 1. State
 * 2. Initialisierung / Layout / UI-Bindings
 * 3. Daten laden
 * 4. Allgemeine Helper
 * 5. Statistiken / Teilnahme / Countdown
 * 6. Erstellen / Aktivieren / Beenden / Löschen
 * 7. Rendering: Statistik / Liste / Details
 * 8. Edit-Actions
 * 9. Geplante automatische Starts
 *
 * Hinweis:
 * - Reine Ladefunktionen laufen ueber data_service.js.
 * - Schreib-/Bearbeitungsaktionen bleiben in dieser Datei.
*/

/* ============================================================
 * STATE
 * ============================================================
 */

let selectedAdminLiveChallengeId = null;

let adminLiveChallenges = [];
let adminPlayerLiveChallenges = [];
let adminLiveChallengeViews = [];

let adminLiveInitialized = false;
let adminLiveDetailsCountdownInterval = null;

/**
 * Statusfilter für die linke Liste.
 * Alle Status sind standardmäßig sichtbar.
 */
let adminLiveStatusFilters = {
  active: true,
  inactive: true,
  completed: true,
  expired: true
};

/* ============================================================
 * INITIALISIERUNG
 * ============================================================
 */

/**
 * Initialisiert den Live-Tab vollständig:
 * - Layout sicherstellen
 * - geplante Challenges ggf. automatisch aktivieren
 * - Daten laden
 * - Statistik / Liste / Details rendern
 * - Event-Handler binden
 */
async function initializeAdminLiveTab() {
  ensureAdminLiveTabLayout();
  ensureAdminCreateLiveChallengeModal();

  await autoActivateScheduledLiveChallenges();
  await loadAdminLiveTabData();

  const visibleRows = getVisibleAdminLiveChallenges();

  if (!selectedAdminLiveChallengeId) {
    selectedAdminLiveChallengeId = visibleRows[0]?.id || null;
  }

  const selectedStillVisible = visibleRows.some(
    row => row.id === selectedAdminLiveChallengeId
  );

  if (!selectedStillVisible) {
    selectedAdminLiveChallengeId = visibleRows[0]?.id || null;
  }

  renderAdminLiveGlobalStats();
  renderAdminLiveList();

  const selectedLive =
    visibleRows.find(row => row.id === selectedAdminLiveChallengeId) || null;

  await renderAdminLiveDetails(selectedLive);

  attachAdminLiveTopActionEvents();
  attachAdminLiveFilterEvents();

  adminLiveInitialized = true;
}

/* ============================================================
 * LAYOUT / MODALS
 * ============================================================
 */

/**
 * Baut das Grundlayout des Live-Tabs genau einmal auf.
 */
function ensureAdminLiveTabLayout() {
  const tabEl = document.getElementById("tab-live");
  if (!tabEl) return;

  const alreadyBuilt = document.getElementById("adminLiveSplitLayout");
  if (alreadyBuilt) return;

  tabEl.innerHTML = `
    <h2>Live Challenges</h2>

    <div class="admin-player-action-bar" style="margin-top: 0; margin-bottom: 16px;">
      <button id="adminCreateLiveChallengeBtn" type="button">Neue Live-Challenge</button>
      <button id="adminEndActiveLiveChallengeBtn" type="button" class="secondary-btn">Aktive beenden</button>
    </div>

    <div id="adminLiveGlobalStatsWrapper" style="margin-bottom: 20px;"></div>

    <div class="admin-split-layout" id="adminLiveSplitLayout">
      <div class="admin-panel">
        <div class="admin-panel-header">
          <h3>Live-Challenges im ausgewählten Spiel</h3>
        </div>

        <div class="admin-live-filter-bar">
          <label><input type="checkbox" id="adminLiveFilterActive" checked /> Aktiv</label>
          <label><input type="checkbox" id="adminLiveFilterInactive" checked /> Inaktiv</label>
          <label><input type="checkbox" id="adminLiveFilterCompleted" checked /> Beendet</label>
          <label><input type="checkbox" id="adminLiveFilterExpired" checked /> Expired</label>
        </div>

        <div id="adminLiveList" class="admin-list">
          <p>Live-Challenges werden geladen...</p>
        </div>
      </div>

      <div class="admin-panel">
        <div class="admin-panel-header">
          <h3>Details</h3>
        </div>

        <div id="adminLiveDetails">
          <p class="admin-details-empty">Wähle links eine Live-Challenge aus.</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Baut das Create-Modal für Live-Challenges genau einmal auf.
 */
function ensureAdminCreateLiveChallengeModal() {
  if (document.getElementById("adminCreateLiveChallengeOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "adminCreateLiveChallengeOverlay";
  overlay.className = "modal-overlay hidden";

  overlay.innerHTML = `
    <div class="modal">
      <button id="closeAdminCreateLiveChallengeBtn" class="modal-close-btn" type="button">×</button>

      <h2>Live-Challenge erstellen</h2>

      <div class="rules-content">
        <div class="admin-form-group">
          <label for="adminCreateLiveChallengeTitleInput"><strong>Name</strong></label>
          <input
            id="adminCreateLiveChallengeTitleInput"
            type="text"
            placeholder="z. B. Selfie mit 3 Fremden"
          />
        </div>

        <div class="admin-form-group">
          <label for="adminCreateLiveChallengeDescriptionInput"><strong>Beschreibung</strong></label>
          <textarea
            id="adminCreateLiveChallengeDescriptionInput"
            class="admin-text-edit-textarea"
            style="min-height: 120px;"
            placeholder="Kurze Beschreibung der Aufgabe"
          ></textarea>
        </div>

        <div class="admin-game-challenge-cards">
          <div class="admin-game-challenge-card">
            <div class="admin-game-challenge-card-label">Punkte</div>
            <input id="adminCreateLiveChallengePointsInput" type="number" min="1" value="5" />
          </div>

          <div class="admin-game-challenge-card">
            <div class="admin-game-challenge-card-label">Dauer (Minuten)</div>
            <input id="adminCreateLiveChallengeDurationInput" type="number" min="0" value="0" />
          </div>

          <div class="admin-game-challenge-card">
            <label>
              <input id="adminCreateLiveChallengePhotoInput" type="checkbox" />
              Foto erforderlich
            </label>
          </div>

          <div class="admin-game-challenge-card">
            <label>
              <input id="adminCreateLiveChallengeActivateNowInput" type="checkbox" />
              Aufgabe gleich aktiv setzen
            </label>
          </div>

          <div class="admin-game-challenge-card admin-game-challenge-card-wide">
            <div class="admin-game-challenge-card-label">Geplanter Start</div>
            <input id="adminCreateLiveChallengeScheduledStartInput" type="datetime-local" />
            <div class="admin-detail-label" style="margin-top: 8px;">
              Leer lassen = kein automatischer Start
            </div>
          </div>
        </div>

        <p id="adminCreateLiveChallengeStatusText" class="admin-details-empty" style="margin-top: 12px;"></p>
      </div>

      <div class="modal-actions">
        <button id="cancelAdminCreateLiveChallengeBtn" type="button" class="secondary-btn">Abbrechen</button>
        <button id="submitAdminCreateLiveChallengeBtn" type="button">Live-Challenge erstellen</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document
    .getElementById("closeAdminCreateLiveChallengeBtn")
    ?.addEventListener("click", closeAdminCreateLiveChallengeModal);

  document
    .getElementById("cancelAdminCreateLiveChallengeBtn")
    ?.addEventListener("click", closeAdminCreateLiveChallengeModal);

  document
    .getElementById("submitAdminCreateLiveChallengeBtn")
    ?.addEventListener("click", handleAdminCreateLiveChallengeFromModal);
}

/**
 * Öffnet das Create-Modal und setzt alle Felder zurück.
 */
function openAdminCreateLiveChallengeModal() {
  ensureAdminCreateLiveChallengeModal();

  const overlay = document.getElementById("adminCreateLiveChallengeOverlay");
  if (!overlay) return;

  document.getElementById("adminCreateLiveChallengeTitleInput").value = "";
  document.getElementById("adminCreateLiveChallengeDescriptionInput").value = "";
  document.getElementById("adminCreateLiveChallengePointsInput").value = "5";
  document.getElementById("adminCreateLiveChallengeDurationInput").value = "0";
  document.getElementById("adminCreateLiveChallengePhotoInput").checked = false;
  document.getElementById("adminCreateLiveChallengeActivateNowInput").checked = false;
  document.getElementById("adminCreateLiveChallengeScheduledStartInput").value = "";
  document.getElementById("adminCreateLiveChallengeStatusText").textContent = "";

  overlay.classList.remove("hidden");

  setTimeout(() => {
    document.getElementById("adminCreateLiveChallengeTitleInput")?.focus();
  }, 0);
}

/**
 * Schließt das Create-Modal.
 */
function closeAdminCreateLiveChallengeModal() {
  const overlay = document.getElementById("adminCreateLiveChallengeOverlay");
  if (!overlay) return;

  overlay.classList.add("hidden");
}

/* ============================================================
 * EVENT BINDINGS
 * ============================================================
 */

/**
 * Bindet die oberen Aktionsbuttons (Erstellen / Aktive beenden).
 * Durch dataset.bound werden Doppelpbindungen verhindert.
 */
function attachAdminLiveTopActionEvents() {
  const createBtn = document.getElementById("adminCreateLiveChallengeBtn");
  const endBtn = document.getElementById("adminEndActiveLiveChallengeBtn");

  if (createBtn && !createBtn.dataset.bound) {
    createBtn.addEventListener("click", () => {
      openAdminCreateLiveChallengeModal();
    });
    createBtn.dataset.bound = "true";
  }

  if (endBtn && !endBtn.dataset.bound) {
    endBtn.addEventListener("click", async () => {
      await handleAdminEndActiveLiveChallenge();
    });
    endBtn.dataset.bound = "true";
  }
}

/**
 * Bindet die Statusfilter links oberhalb der Liste.
 */
function attachAdminLiveFilterEvents() {
  const mapping = [
    { id: "adminLiveFilterActive", key: "active" },
    { id: "adminLiveFilterInactive", key: "inactive" },
    { id: "adminLiveFilterCompleted", key: "completed" },
    { id: "adminLiveFilterExpired", key: "expired" }
  ];

  mapping.forEach(entry => {
    const el = document.getElementById(entry.id);
    if (!el || el.dataset.bound) return;

    el.checked = !!adminLiveStatusFilters[entry.key];

    el.addEventListener("change", async () => {
      adminLiveStatusFilters[entry.key] = el.checked;

      renderAdminLiveList();

      const visibleRows = getVisibleAdminLiveChallenges();
      const selectedStillVisible = visibleRows.some(
        row => row.id === selectedAdminLiveChallengeId
      );

      if (!selectedStillVisible) {
        selectedAdminLiveChallengeId = visibleRows[0]?.id || null;
      }

      const selectedLive =
        visibleRows.find(row => row.id === selectedAdminLiveChallengeId) || null;

      await renderAdminLiveDetails(selectedLive);
    });

    el.dataset.bound = "true";
  });
}

/* ============================================================
 * DATA LOAD
 * ============================================================ */

/**
 * Laedt alle Daten, die der Live-Tab braucht.
 *
 * Die eigentlichen Supabase-Reads liegen zentral in data_service.js.
 * Die globalen Collections bleiben vorerst erhalten, damit die bestehenden
 * Render- und Helperfunktionen unveraendert weiterarbeiten.
 */
async function loadAdminLiveTabData() {
  const bundle = await DataService.bundles.loadAdminLiveTab();

  adminPlayers = bundle.players || [];
  adminGames = bundle.games || [];
  adminPlayerStates = bundle.playerStates || [];
  adminLiveChallenges = bundle.liveChallenges || [];
  adminPlayerLiveChallenges = bundle.playerLiveChallenges || [];
  adminLiveChallengeViews = bundle.liveChallengeViews || [];
}

/**
 * Kompatibilitaets-Wrapper fuer bestehende Aufrufe.
 */
async function loadAllLiveChallengesForAdmin() {
  adminLiveChallenges = await DataService.live.loadAllWithWinner();
}

async function loadAllPlayerLiveChallengesForAdmin() {
  adminPlayerLiveChallenges = await DataService.live.loadAllPlayerLiveChallenges();
}

async function loadAllLiveChallengeViewsForAdmin() {
  adminLiveChallengeViews = await DataService.liveViews.loadAll();
}

/* ============================================================
 * ALLGEMEINE HELPER
 * ============================================================
 */

/**
 * Liefert die aktuell sichtbaren Live-Challenges:
 * - nur für das global gewählte Admin-Spiel
 * - nach gesetzten Statusfiltern
 * - sortiert: active -> inactive -> Rest
 */
function getVisibleAdminLiveChallenges() {
  const currentGameId = Number(adminCurrentGameId);

  if (!Number.isFinite(currentGameId)) {
    return [];
  }

  return adminLiveChallenges
    .filter(row => Number(row.game_id) === currentGameId)
    .filter(row => adminLiveStatusFilters[row.status] === true)
    .sort((a, b) => {
      const getGroup = status => {
        if (status === "active") return 1;
        if (status === "inactive") return 2;
        return 3;
      };

      const ga = getGroup(a.status);
      const gb = getGroup(b.status);

      if (ga !== gb) return ga - gb;
      return new Date(b.created_at) - new Date(a.created_at);
    });
}

/**
 * Schöne lesbare Statusbezeichnung für UI-Texte.
 */
function getAdminLiveStatusLabel(row) {
  if (!row) return "Unbekannt";
  if (row.status === "inactive") return "Inaktiv";
  if (row.status === "active") return "Aktiv";
  if (row.status === "completed") return "Beendet";
  if (row.status === "expired") return "Expired";
  return row.status || "Unbekannt";
}

/**
 * Ordnet den Status einem bestehenden Badge-Stil zu.
 */
function getAdminLiveStatusBadgeClass(row) {
  if (!row) return "blocked";
  if (row.status === "inactive") return "blocked";
  if (row.status === "active") return "ingame";
  if (row.status === "completed") return "cooldown";
  if (row.status === "expired") return "blocked";
  return "blocked";
}

/**
 * Liefert die aktuell aktive Live-Challenge im global ausgewählten Spiel.
 * Optional kann eine Challenge-ID ausgeschlossen werden.
 */
function getAdminActiveLiveChallengeForCurrentGame(excludeLiveChallengeId = null) {
  return adminLiveChallenges.find(row =>
    Number(row.game_id) === Number(adminCurrentGameId) &&
    row.status === "active" &&
    Number(row.id) !== Number(excludeLiveChallengeId)
  ) || null;
}

/**
 * Liefert den Anzeigenamen eines Spiels.
 */
function getAdminLiveGameName(gameId) {
  const game = adminGames.find(g => g.id === gameId);
  return game?.name || `Spiel ${gameId}`;
}

/**
 * Liefert den Anzeigenamen des Gewinners einer Live-Challenge.
 */
function getAdminLiveWinnerName(row) {
  if (!row?.winner_player_id) return "-";

  if (row.players?.display_name || row.players?.username) {
    return row.players.display_name || row.players.username;
  }

  const player = adminPlayers.find(p => p.id === row.winner_player_id);
  return player?.display_name || player?.username || `Spieler ${row.winner_player_id}`;
}

/**
 * Liefert alle player_game_state-Einträge eines Spiels.
 */
function getAdminLivePlayerStateRowsForGame(gameId) {
  return adminPlayerStates.filter(row => row.game_id === gameId);
}

/**
 * Liefert alle Spieler, die im betreffenden Spiel überhaupt einen State haben
 * und damit als relevante Live-Challenge-Teilnehmer gelten.
 */
function getAdminEligiblePlayersForLiveChallenge(row) {
  if (!row) return [];

  return getAdminLivePlayerStateRowsForGame(row.game_id)
    .map(state => adminPlayers.find(p => p.id === state.player_id))
    .filter(Boolean);
}

/**
 * Liefert alle View-Einträge zu einer Live-Challenge.
 */
function getAdminLiveViewRows(liveChallengeId) {
  return adminLiveChallengeViews.filter(
    row => row.live_challenge_id === liveChallengeId
  );
}

/**
 * Liefert alle player_live_challenges-Einträge zu einer Live-Challenge,
 * sortiert nach Abschlusszeit.
 */
function getAdminLiveCompletionRows(liveChallengeId) {
  return adminPlayerLiveChallenges
    .filter(row => row.live_challenge_id === liveChallengeId)
    .sort((a, b) => new Date(a.completed_at || 0) - new Date(b.completed_at || 0));
}

/**
 * Liefert die verbleibenden Sekunden bis expires_at.
 */
function getAdminLiveRemainingSeconds(row) {
  if (!row?.expires_at) return null;

  const endMs = new Date(row.expires_at).getTime();
  const diffSeconds = Math.ceil((endMs - Date.now()) / 1000);

  return Math.max(0, diffSeconds);
}

/**
 * Formatiert Sekunden als MM:SS.
 */
function formatAdminLiveRemaining(seconds) {
  if (seconds === null || seconds === undefined) return null;

  const sec = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(sec / 60);
  const restSeconds = sec % 60;

  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
}

/**
 * Aktualisiert beliebige Felder einer Live-Challenge und gibt den
 * aktualisierten Datensatz zurück.
 */
async function updateAdminLiveChallengeFields(liveChallengeId, updates) {
  const { data, error } = await supabaseClient
    .from("live_challenges")
    .update(updates)
    .eq("id", liveChallengeId)
    .select(`
      *,
      players:winner_player_id (
        id,
        username,
        display_name
      )
    `)
    .single();

  if (error) {
    console.error("Fehler beim Aktualisieren der Live-Challenge:", error);
    alert("Live-Challenge konnte nicht aktualisiert werden.");
    return null;
  }

  return data;
}

/**
 * Lädt alle relevanten Daten neu und rendert den Tab anschließend erneut.
 * Optional kann eine bevorzugte ausgewählte Challenge-ID erhalten bleiben.
 */
async function refreshAdminLiveAfterMutation(preferredLiveId = null) {
  await loadAdminLiveTabData();

  const visibleRows = getVisibleAdminLiveChallenges();

  if (preferredLiveId && visibleRows.some(row => row.id === preferredLiveId)) {
    selectedAdminLiveChallengeId = preferredLiveId;
  } else if (!visibleRows.some(row => row.id === selectedAdminLiveChallengeId)) {
    selectedAdminLiveChallengeId = visibleRows[0]?.id || null;
  }

  renderAdminLiveGlobalStats();
  renderAdminLiveList();

  const selectedLive =
    visibleRows.find(row => row.id === selectedAdminLiveChallengeId) || null;

  await renderAdminLiveDetails(selectedLive);
}

/* ============================================================
 * TEILNAHME / AUSWERTUNG / COUNTDOWN
 * ============================================================
 */

/**
 * Baut zusammenfassende Teilnahme-Statistiken für eine Live-Challenge.
 */
function getAdminLiveParticipationStats(row) {
  const eligiblePlayers = getAdminEligiblePlayersForLiveChallenge(row);
  const eligibleIds = eligiblePlayers.map(p => p.id);

  const views = getAdminLiveViewRows(row.id).filter(v =>
    eligibleIds.includes(v.player_id)
  );

  const completions = getAdminLiveCompletionRows(row.id).filter(v =>
    eligibleIds.includes(v.player_id)
  );

  const seenStartIds = new Set(
    views.filter(v => !!v.seen_start_at).map(v => v.player_id)
  );

  const seenEndIds = new Set(
    views.filter(v => !!v.seen_end_at).map(v => v.player_id)
  );

  const dismissedIds = new Set(
    views.filter(v => !!v.dismissed_at).map(v => v.player_id)
  );

  const completedIds = new Set(
    completions.filter(v => v.status === "completed").map(v => v.player_id)
  );

  const unseenCount = eligiblePlayers.filter(
    p => !seenStartIds.has(p.id)
  ).length;

  const seenCount = seenStartIds.size;
  const completedCount = completedIds.size;
  const seenWithoutCompletionCount = [...seenStartIds].filter(
    id => !completedIds.has(id)
  ).length;

  const endSeenCount = seenEndIds.size;

  return {
    eligiblePlayers,
    eligibleIds,
    views,
    completions,
    seenStartIds,
    seenEndIds,
    dismissedIds,
    completedIds,
    unseenCount,
    seenCount,
    completedCount,
    seenWithoutCompletionCount,
    endSeenCount,
    dismissedCount: dismissedIds.size
  };
}

/**
 * Baut die Teilnehmerliste für die Detailansicht:
 * Gewinner / gesehen / weggeklickt / nicht gesehen.
 */
function buildAdminLiveParticipantRows(row) {
  const stats = getAdminLiveParticipationStats(row);

  return stats.eligiblePlayers
    .map(player => {
      const view = stats.views.find(v => v.player_id === player.id) || null;
      const completion = stats.completions.find(v => v.player_id === player.id) || null;

      let status = "Nicht gesehen";

      if (completion?.status === "completed" && (completion.points_awarded || 0) > 0) {
        status = "Gewonnen";
      } else if (completion?.status === "completed") {
        status = "Abgeschlossen";
      } else if (view?.dismissed_at) {
        status = "Weggeklickt";
      } else if (view?.seen_start_at) {
        status = "Gesehen";
      }

      return {
        playerId: player.id,
        playerName: player.display_name || player.username || `Spieler ${player.id}`,
        seenStartAt: view?.seen_start_at || null,
        dismissedAt: view?.dismissed_at || null,
        seenEndAt: view?.seen_end_at || null,
        completion,
        status
      };
    })
    .sort((a, b) => {
      const order = {
        "Gewonnen": 1,
        "Abgeschlossen": 2,
        "Gesehen": 3,
        "Weggeklickt": 4,
        "Nicht gesehen": 5
      };

      const oa = order[a.status] || 99;
      const ob = order[b.status] || 99;

      if (oa !== ob) return oa - ob;
      return String(a.playerName).localeCompare(String(b.playerName), "de");
    });
}

/**
 * Zählt "aktive Spieler" für die linke Liste:
 * - Start gesehen
 * - nicht weggeklickt
 * - noch nicht abgeschlossen
 */
function getAdminLiveActiveViewerCount(row) {
  const stats = getAdminLiveParticipationStats(row);

  return stats.eligiblePlayers.filter(player => {
    const view = stats.views.find(v => v.player_id === player.id);
    const completion = stats.completions.find(v => v.player_id === player.id);

    const hasSeen = !!view?.seen_start_at;
    const wasDismissed = !!view?.dismissed_at;
    const hasCompleted = !!completion;

    return hasSeen && !wasDismissed && !hasCompleted;
  }).length;
}

/**
 * Stoppt den laufenden Countdown der Detailansicht.
 */
function stopAdminLiveDetailsCountdown() {
  if (adminLiveDetailsCountdownInterval) {
    clearInterval(adminLiveDetailsCountdownInterval);
    adminLiveDetailsCountdownInterval = null;
  }
}

/**
 * Startet einen Sekundencountdown für die Dauer-Anzeige
 * in der rechten Detailansicht, solange die Challenge aktiv ist.
 */
function startAdminLiveDetailsCountdown(row) {
  stopAdminLiveDetailsCountdown();

  if (!row || row.status !== "active" || !row.expires_at) {
    return;
  }

  adminLiveDetailsCountdownInterval = setInterval(() => {
    const valueEl = document.getElementById("adminEditLiveDurationBtn");
    if (!valueEl) {
      stopAdminLiveDetailsCountdown();
      return;
    }

    const remaining = getAdminLiveRemainingSeconds(row);
    valueEl.textContent = formatAdminLiveRemaining(remaining);

    if (remaining !== null && remaining <= 0) {
      stopAdminLiveDetailsCountdown();
      valueEl.textContent = "00:00";
    }
  }, 1000);
}

/* ============================================================
 * STATISTIK-RENDERING
 * ============================================================
 */

/**
 * Baut einfache Statusstatistiken für beliebige Live-Challenge-Listen.
 */
function buildAdminLiveStatsForRows(rows) {
  const totalCount = rows.length;
  const activeRows = rows.filter(row => row.status === "active");
  const completedRows = rows.filter(row => row.status === "completed");
  const expiredRows = rows.filter(row => row.status === "expired");

  return {
    totalCount,
    activeCount: activeRows.length,
    completedCount: completedRows.length,
    expiredCount: expiredRows.length
  };
}

/**
 * Rendert die obere Statistik:
 * - global über alle Spiele
 * - zusätzlich für das aktuell ausgewählte Spiel
 */
function renderAdminLiveGlobalStats() {
  const wrapper = document.getElementById("adminLiveGlobalStatsWrapper");
  if (!wrapper) return;

  const globalStats = buildAdminLiveStatsForRows(adminLiveChallenges);
  const visibleRows = getVisibleAdminLiveChallenges();
  const currentGameStats = buildAdminLiveStatsForRows(visibleRows);

  const activeGames = adminLiveChallenges
    .filter(row => row.status === "active")
    .map(row => getAdminLiveGameName(row.game_id))
    .filter((value, index, arr) => arr.indexOf(value) === index);

  wrapper.innerHTML = `
    <div class="admin-details-grid">
      <div class="admin-detail-card">
        <div class="admin-detail-label">Global gesamt</div>
        <div class="admin-detail-value">${globalStats.totalCount}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Global aktiv</div>
        <div class="admin-detail-value">${globalStats.activeCount}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Global beendet</div>
        <div class="admin-detail-value">${globalStats.completedCount}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Global expired</div>
        <div class="admin-detail-value">${globalStats.expiredCount}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Ausgewähltes Spiel gesamt</div>
        <div class="admin-detail-value">${currentGameStats.totalCount}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Ausgewähltes Spiel aktiv</div>
        <div class="admin-detail-value">${currentGameStats.activeCount}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Ausgewähltes Spiel beendet</div>
        <div class="admin-detail-value">${currentGameStats.completedCount}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Ausgewähltes Spiel expired</div>
        <div class="admin-detail-value">${currentGameStats.expiredCount}</div>
      </div>

      <div class="admin-detail-card admin-detail-wide">
        <div class="admin-detail-label">Spiele mit aktiven Live-Challenges</div>
        <div class="admin-detail-value">
          ${activeGames.length ? activeGames.join(", ") : "Aktuell keine"}
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
 * CREATE / ACTIVATE / PAUSE / END
 * ============================================================
 */

/**
 * Erstellt eine neue Live-Challenge aus dem Modal.
 * Standardmäßig wird sie als inactive gespeichert.
 * Optional kann sie direkt aktiviert oder geplant werden.
 */
async function handleAdminCreateLiveChallengeFromModal() {
  if (!adminCurrentGameId) {
    alert("Kein aktives Spiel ausgewählt.");
    return;
  }

  const title =
    document.getElementById("adminCreateLiveChallengeTitleInput")?.value?.trim() || "";

  const description =
    document.getElementById("adminCreateLiveChallengeDescriptionInput")?.value?.trim() || "";

  const points = Number(
    document.getElementById("adminCreateLiveChallengePointsInput")?.value || 5
  );

  const durationMinutes = Number(
    document.getElementById("adminCreateLiveChallengeDurationInput")?.value || 0
  );

  const requiresPhoto =
    document.getElementById("adminCreateLiveChallengePhotoInput")?.checked === true;

  const activateNow =
    document.getElementById("adminCreateLiveChallengeActivateNowInput")?.checked === true;

  const scheduledStartRaw =
    document.getElementById("adminCreateLiveChallengeScheduledStartInput")?.value || "";

  const statusEl = document.getElementById("adminCreateLiveChallengeStatusText");

  if (!title) {
    if (statusEl) statusEl.textContent = "Bitte einen Namen eingeben.";
    return;
  }

  if (!description) {
    if (statusEl) statusEl.textContent = "Bitte eine Beschreibung eingeben.";
    return;
  }

  if (!Number.isFinite(points) || points < 0) {
    if (statusEl) statusEl.textContent = "Ungültige Punktzahl.";
    return;
  }

  if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
    if (statusEl) statusEl.textContent = "Ungültige Dauer.";
    return;
  }

  let scheduledStartAt = null;

  if (scheduledStartRaw) {
    const parsed = new Date(scheduledStartRaw);
    if (Number.isNaN(parsed.getTime())) {
      if (statusEl) statusEl.textContent = "Ungültige geplante Startzeit.";
      return;
    }
    scheduledStartAt = parsed.toISOString();
  }

  if (activateNow && scheduledStartAt) {
    if (statusEl) {
      statusEl.textContent =
        "Bitte entweder sofort aktivieren oder einen geplanten Start setzen, nicht beides.";
    }
    return;
  }

  if (statusEl) {
    statusEl.textContent = activateNow
      ? "Live-Challenge wird erstellt und aktiviert..."
      : scheduledStartAt
        ? "Live-Challenge wird geplant..."
        : "Live-Challenge wird erstellt...";
  }

  const { data, error } = await supabaseClient
    .from("live_challenges")
    .insert({
      game_id: adminCurrentGameId,
      title,
      description,
      points,
      requires_photo_proof: requiresPhoto,
      status: "inactive",
      scheduled_start_at: scheduledStartAt,
      duration_minutes: durationMinutes > 0 ? durationMinutes : null,
      expires_at: null
    })
    .select()
    .single();

  if (error) {
    console.error("Fehler beim Erstellen der Live-Challenge:", error);
    if (statusEl) statusEl.textContent = "Live-Challenge konnte nicht erstellt werden.";
    return;
  }

  if (typeof logLiveChallengeCreated === "function") {
    await logLiveChallengeCreated({
      gameId: adminCurrentGameId,
      adminPlayerId: adminPlayer?.id || null,
      liveChallengeId: data.id,
      metadata: {
        live_challenge_title: data.title || null,
        description: data.description || null,
        points: data.points ?? 0,
        requires_photo_proof: data.requires_photo_proof === true,
        scheduled_start_at: data.scheduled_start_at || null,
        duration_minutes: data.duration_minutes ?? null,
        initial_status: "inactive",
        admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
        game_name: getAdminLiveGameName(adminCurrentGameId)
      }
    });
  }

  if (activateNow) {
    const activated = await activateAdminLiveChallenge(data);

    if (!activated) {
      if (statusEl) {
        statusEl.textContent = "Challenge wurde erstellt, aber nicht aktiviert.";
      }
      await refreshAdminLiveAfterMutation(data.id);
      return;
    }
  }

  closeAdminCreateLiveChallengeModal();
  await refreshAdminLiveAfterMutation(data.id);
}

/**
 * Aktiviert eine bestehende inactive-Challenge.
 * Falls bereits eine andere aktiv ist, wird eine Confirm-Abfrage gezeigt
 * und die alte ggf. automatisch auf expired gesetzt.
 */
async function activateAdminLiveChallenge(row) {
  if (!row) return false;

  const existingActive = getAdminActiveLiveChallengeForCurrentGame(row.id);

  if (existingActive) {
    const confirmed = confirm(
      `Achtung: Die Live-Challenge "${existingActive.title || "Ohne Titel"}" ist noch aktiv.\n\n` +
      `Willst du sie beenden und stattdessen "${row.title || "Ohne Titel"}" aktiv setzen?`
    );

    if (!confirmed) {
      return false;
    }

    const { error: expireError } = await supabaseClient
      .from("live_challenges")
      .update({
        status: "expired",
        completed_at: new Date().toISOString()
      })
      .eq("id", existingActive.id)
      .eq("status", "active");

    if (expireError) {
      console.error("Fehler beim automatischen Beenden der alten Live-Challenge:", expireError);
      alert("Die bisher aktive Live-Challenge konnte nicht beendet werden.");
      return false;
    }

    if (typeof logLiveChallengeExpired === "function") {
      await logLiveChallengeExpired({
        gameId: existingActive.game_id,
        liveChallengeId: existingActive.id,
        metadata: {
          live_challenge_title: existingActive.title || null,
          game_name: getAdminLiveGameName(existingActive.game_id)
        }
      });
    }
  }

  const expiresAt =
    row.duration_minutes && Number(row.duration_minutes) > 0
      ? new Date(Date.now() + Number(row.duration_minutes) * 60 * 1000).toISOString()
      : null;

  const { data, error } = await supabaseClient
    .from("live_challenges")
    .update({
      status: "active",
      scheduled_start_at: null,
      expires_at: expiresAt,
      completed_at: null,
      winner_player_id: null,
      winner_completed_at: null
    })
    .eq("id", row.id)
    .eq("status", "inactive")
    .select()
    .single();

  if (error) {
    console.error("Fehler beim Aktivieren der Live-Challenge:", error);
    alert("Live-Challenge konnte nicht aktiviert werden.");
    return false;
  }

  if (data && typeof pushAutomationSendLiveCreated === "function") {
    await pushAutomationSendLiveCreated(data);
  }

  return !!data;
}

/**
 * Beendet die aktuell aktive Live-Challenge des ausgewählten Spiels manuell.
 */
async function handleAdminEndActiveLiveChallenge() {
  if (!adminCurrentGameId) {
    alert("Kein aktives Spiel ausgewählt.");
    return;
  }

  const activeRow = adminLiveChallenges.find(
    row =>
      Number(row.game_id) === Number(adminCurrentGameId) &&
      row.status === "active"
  );

  if (!activeRow) {
    alert("Im aktuell ausgewählten Spiel gibt es keine aktive Live-Challenge.");
    return;
  }

  const confirmed = confirm(
    `Die aktive Live-Challenge "${activeRow.title}" wirklich manuell beenden?`
  );

  if (!confirmed) return;

  const { data, error } = await supabaseClient
    .from("live_challenges")
    .update({
      status: "expired",
      completed_at: new Date().toISOString()
    })
    .eq("id", activeRow.id)
    .eq("status", "active")
    .select(`
      *,
      players:winner_player_id (
        id,
        username,
        display_name
      )
    `)
    .single();

  if (error) {
    console.error("Fehler beim manuellen Beenden der Live-Challenge:", error);
    alert("Live-Challenge konnte nicht beendet werden.");
    return;
  }

  if (typeof logLiveChallengeManuallyEnded === "function") {
    await logLiveChallengeManuallyEnded({
      gameId: activeRow.game_id,
      adminPlayerId: adminPlayer?.id || null,
      liveChallengeId: activeRow.id,
      metadata: {
        live_challenge_title: activeRow.title || null,
        description: activeRow.description || null,
        admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
        game_name: getAdminLiveGameName(activeRow.game_id)
      }
    });
  }

  if (typeof pushAutomationSendLiveFinished === "function") {
    await pushAutomationSendLiveFinished(data || activeRow, {
      status: "manually_ended"
    });
  }

  await refreshAdminLiveAfterMutation(data.id);
}

/* ============================================================
 * AUTO-AKTIVIERUNG GEPLANTER CHALLENGES
 * ============================================================
 */

/**
 * Aktiviert geplante Live-Challenges automatisch, sobald ihre geplante
 * Startzeit erreicht ist.
 *
 * Verhalten:
 * - nur inactive-Challenges mit scheduled_start_at in der Vergangenheit
 * - ggf. bestehende aktive Challenge desselben Spiels automatisch beenden
 * - Status anschließend auf active setzen
 */
async function autoActivateScheduledLiveChallenges() {
  const now = new Date().toISOString();
  let changed = false;

  const { data, error } = await supabaseClient
    .from("live_challenges")
    .select("*")
    .eq("status", "inactive")
    .not("scheduled_start_at", "is", null)
    .lte("scheduled_start_at", now)
    .order("scheduled_start_at", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden geplanter Live-Challenges:", error);
    return false;
  }

  const dueChallenges = data || [];
  if (!dueChallenges.length) return false;

  for (const challenge of dueChallenges) {
    const { data: existingActive, error: activeError } = await supabaseClient
      .from("live_challenges")
      .select("id, title, game_id")
      .eq("game_id", challenge.game_id)
      .eq("status", "active")
      .neq("id", challenge.id)
      .limit(1)
      .maybeSingle();

    if (activeError) {
      console.error("Fehler beim Prüfen aktiver Live-Challenges:", activeError);
      continue;
    }

    if (existingActive) {
      const { error: expireError } = await supabaseClient
        .from("live_challenges")
        .update({
          status: "expired",
          completed_at: new Date().toISOString()
        })
        .eq("id", existingActive.id)
        .eq("status", "active");

      if (expireError) {
        console.error("Fehler beim automatischen Beenden alter Live-Challenge:", expireError);
        continue;
      }

      if (typeof logLiveChallengeExpired === "function") {
        await logLiveChallengeExpired({
          gameId: existingActive.game_id,
          liveChallengeId: existingActive.id,
          metadata: {
            live_challenge_title: existingActive.title || null,
            game_name: getAdminLiveGameName(existingActive.game_id)
          }
        });
      }

      changed = true;
    }

    const expiresAt =
      challenge.duration_minutes && Number(challenge.duration_minutes) > 0
        ? new Date(Date.now() + Number(challenge.duration_minutes) * 60 * 1000).toISOString()
        : null;

    const { error: activateError } = await supabaseClient
      .from("live_challenges")
      .update({
        status: "active",
        scheduled_start_at: null,
        expires_at: expiresAt,
        completed_at: null,
        winner_player_id: null,
        winner_completed_at: null
      })
      .eq("id", challenge.id)
      .eq("status", "inactive");

    if (activateError) {
      console.error("Fehler beim automatischen Aktivieren:", activateError);
      continue;
    }

    if (typeof pushAutomationSendLiveCreated === "function") {
      await pushAutomationSendLiveCreated({
        ...challenge,
        status: "active",
        scheduled_start_at: null,
        expires_at: expiresAt,
        completed_at: null,
        winner_player_id: null,
        winner_completed_at: null
      });
    }

    if (typeof logLiveChallengeCreated === "function") {
      await logLiveChallengeCreated({
        gameId: challenge.game_id,
        adminPlayerId: adminPlayer?.id || null,
        liveChallengeId: challenge.id,
        metadata: {
          live_challenge_title: challenge.title || null,
          description: challenge.description || null,
          points: challenge.points ?? 0,
          requires_photo_proof: challenge.requires_photo_proof === true,
          scheduled_start_at: challenge.scheduled_start_at || null,
          duration_minutes: challenge.duration_minutes ?? null,
          auto_activated: true,
          admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
          game_name: getAdminLiveGameName(challenge.game_id)
        }
      });
    }

    changed = true;
  }

  return changed;
}

/* ============================================================
 * LINKS: LISTE
 * ============================================================
 */

/**
 * Rendert die linke Challenge-Liste.
 * Die Liste zeigt bewusst nur kompakte Kerninfos.
 */
function renderAdminLiveList() {
  const listEl = document.getElementById("adminLiveList");
  if (!listEl) return;

  const rows = getVisibleAdminLiveChallenges();

  if (!rows.length) {
    const totalLiveCount = adminLiveChallenges.length;

    listEl.innerHTML = `
      <p>Keine Live-Challenges im aktuell ausgewählten Spiel.</p>
      <p class="admin-details-empty">
        Global vorhanden: ${totalLiveCount} · Aktuelles Spiel: ${adminCurrentGameId ?? "-"}
      </p>
    `;
    return;
  }

  listEl.innerHTML = "";

  rows.forEach(row => {
    const item = document.createElement("div");
    item.className = "admin-list-item";

    if (row.id === selectedAdminLiveChallengeId) {
      item.classList.add("active");
    }

    const activeViewerCount = getAdminLiveActiveViewerCount(row);
    const winnerName = getAdminLiveWinnerName(row);
    const remaining = getAdminLiveRemainingSeconds(row);

    const showRemaining = row.status === "active" && !!row.expires_at;
    const showScheduled = row.status === "inactive" && !!row.scheduled_start_at;

    item.innerHTML = `
      <div class="admin-list-card">
        <div class="admin-list-card-left">
          <div class="admin-list-name">${row.title || "Ohne Titel"}</div>
          <div class="admin-list-meta">${getAdminLiveGameName(row.game_id)}</div>

          <div class="admin-status-row">
            <span class="admin-badge ${getAdminLiveStatusBadgeClass(row)}">${getAdminLiveStatusLabel(row)}</span>
          </div>

          <div class="admin-list-subinfo">
            <div><strong>Punkte:</strong> ${row.points ?? 0}</div>

            ${activeViewerCount > 0 ? `
              <div><strong>Aktive Spieler:</strong> ${activeViewerCount}</div>
            ` : ""}

            ${row.status === "completed" ? `
              <div><strong>Gewinner:</strong> ${winnerName}</div>
            ` : ""}

            ${showRemaining ? `
              <div class="admin-live-time-row">⏱ ${formatAdminLiveRemaining(remaining)}</div>
            ` : ""}

            ${showScheduled ? `
              <div class="admin-live-time-row">🕒 ${formatAdminDateTime(row.scheduled_start_at)}</div>
            ` : ""}
          </div>
        </div>

        <div class="admin-list-card-right">
          <div class="admin-list-score">${row.points ?? 0}P</div>
        </div>
      </div>
    `;

    item.addEventListener("click", async () => {
      selectedAdminLiveChallengeId = row.id;
      renderAdminLiveList();
      await renderAdminLiveDetails(row);
    });

    listEl.appendChild(item);
  });
}

/* ============================================================
 * RECHTS: DETAILANSICHT
 * ============================================================
 */

/**
 * Rendert die rechte Detailansicht der ausgewählten Live-Challenge.
 */
async function renderAdminLiveDetails(row) {
  stopAdminLiveDetailsCountdown();

  const detailsEl = document.getElementById("adminLiveDetails");
  if (!detailsEl) return;

  if (!row) {
    detailsEl.innerHTML = `<p class="admin-details-empty">Wähle links eine Live-Challenge aus.</p>`;
    return;
  }

  const stats = getAdminLiveParticipationStats(row);
  const participants = buildAdminLiveParticipantRows(row);
  const winnerName = getAdminLiveWinnerName(row);

  const imageUrl = (() => {
    const winnerCompletion = getAdminLiveCompletionRows(row.id).find(
      r => r.proof_image_path
    );

    return winnerCompletion?.proof_image_path
      ? getPublicImageUrl(winnerCompletion.proof_image_path)
      : null;
  })();

  let participantHtml = `<div class="admin-completion-list">`;

  if (!participants.length) {
    participantHtml += `<p class="admin-details-empty">Keine relevanten Spieler für dieses Spiel gefunden.</p>`;
  } else {
    participants.forEach(entry => {
      const completionPoints = entry.completion?.points_awarded ?? 0;
      const isDismissed = entry.status === "Weggeklickt";
      const hasSeenEnd = !!entry.seenEndAt;

      participantHtml += `
        <div class="admin-completion-row ${isDismissed ? "admin-live-row-dismissed" : ""}">
          <div class="admin-completion-left">
            <div class="admin-completion-name ${isDismissed ? "admin-live-name-dismissed" : ""}">
              ${entry.playerName}
              ${hasSeenEnd ? `<span class="admin-live-end-badge">Ende gesehen</span>` : ""}
            </div>
            <div class="admin-completion-meta">
              ${entry.seenStartAt ? `Start gesehen: ${formatAdminDateTime(entry.seenStartAt)}` : "Nicht gesehen"}
              ${entry.dismissedAt ? ` · Weggeklickt: ${formatAdminDateTime(entry.dismissedAt)}` : ""}
              ${entry.seenEndAt ? ` · Ende gesehen: ${formatAdminDateTime(entry.seenEndAt)}` : ""}
            </div>
          </div>

          <div class="admin-completion-right">
            <div class="admin-completion-points">
              ${entry.status}${completionPoints > 0 ? ` · ${completionPoints}P` : ""}
            </div>
          </div>
        </div>
      `;
    });
  }

  participantHtml += `</div>`;

  detailsEl.innerHTML = `
    <div class="admin-details-grid">
      <div class="admin-detail-card">
        <div class="admin-detail-label">Titel</div>
        <div id="adminEditLiveTitleBtn" class="admin-detail-value clickable" title="Zum Bearbeiten klicken">
          ${row.title || "-"}
        </div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Punkte</div>
        <div id="adminEditLivePointsBtn" class="admin-detail-value clickable" title="Zum Bearbeiten klicken">
          ${row.points ?? 0}
        </div>
      </div>

      <div class="admin-detail-card admin-detail-wide">
        <div class="admin-detail-label">Beschreibung</div>
        <div id="adminEditLiveDescriptionBtn" class="admin-detail-value clickable">
          ${row.description ? row.description : "–"}
        </div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Status</div>
        <div
          id="adminToggleLiveStatusBtn"
          class="admin-detail-value clickable ${row.status === "inactive" ? "danger-state" : ""}"
        >
          ${getAdminLiveStatusLabel(row)}
        </div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Foto erforderlich</div>
        <div id="adminToggleLivePhotoBtn" class="admin-detail-value clickable">
          ${row.requires_photo_proof ? "Ja" : "Nein"}
        </div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Dauer</div>
        <div id="adminEditLiveDurationBtn" class="admin-detail-value clickable" title="Zum Bearbeiten klicken">
          ${
            row.status === "active"
              ? (row.expires_at
                  ? formatAdminLiveRemaining(getAdminLiveRemainingSeconds(row))
                  : "Kein Zeitlimit")
              : (row.duration_minutes
                  ? `${row.duration_minutes} min`
                  : "Kein Zeitlimit")
          }
        </div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Geplanter Start</div>
        <div id="adminEditLiveScheduledStartBtn" class="admin-detail-value clickable">
          ${row.scheduled_start_at ? formatAdminDateTime(row.scheduled_start_at) : "Nicht geplant"}
        </div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Spiel</div>
        <div class="admin-detail-value">${getAdminLiveGameName(row.game_id)}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Erstellt</div>
        <div class="admin-detail-value">${formatAdminDateTime(row.created_at)}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Beendet</div>
        <div class="admin-detail-value">${row.completed_at ? formatAdminDateTime(row.completed_at) : "-"}</div>
      </div>

      ${row.status === "completed" ? `
        <div class="admin-detail-card">
          <div class="admin-detail-label">Gewinner</div>
          <div class="admin-detail-value">${winnerName}</div>
        </div>
      ` : ""}

      <div class="admin-detail-card">
        <div class="admin-detail-label">Teilnahmebasis</div>
        <div class="admin-detail-value">${stats.eligiblePlayers.length}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Gesehen</div>
        <div class="admin-detail-value">${stats.seenCount}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Gesehen ohne Abschluss</div>
        <div class="admin-detail-value">${stats.seenWithoutCompletionCount}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Nicht gesehen</div>
        <div class="admin-detail-value">${stats.unseenCount}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Weggeklickt</div>
        <div class="admin-detail-value">${stats.dismissedCount}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Ende gesehen</div>
        <div class="admin-detail-value">${stats.endSeenCount}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Abschlüsse</div>
        <div class="admin-detail-value">${stats.completedCount}</div>
      </div>
    </div>

    ${imageUrl ? `
      <div class="admin-gallery-wrapper">
        <h3 class="admin-section-title">Gewinnerbild</h3>
        <img src="${imageUrl}" class="admin-gallery-image" alt="Gewinnerbild" />
      </div>
    ` : ""}

    <div class="admin-completed-wrapper">
      <h3 class="admin-section-title">Teilnehmer / Sichtbarkeit</h3>
      ${participantHtml}
    </div>

    <div class="admin-player-action-bar" style="margin-top: 16px;">
      <button id="adminDeleteLiveChallengeBtn" class="danger-btn">
        Live-Challenge löschen
      </button>
    </div>
  `;

  const editTitleBtn = document.getElementById("adminEditLiveTitleBtn");
  const editPointsBtn = document.getElementById("adminEditLivePointsBtn");
  const editDescriptionBtn = document.getElementById("adminEditLiveDescriptionBtn");
  const togglePhotoBtn = document.getElementById("adminToggleLivePhotoBtn");
  const toggleStatusBtn = document.getElementById("adminToggleLiveStatusBtn");
  const editDurationBtn = document.getElementById("adminEditLiveDurationBtn");
  const editScheduledStartBtn = document.getElementById("adminEditLiveScheduledStartBtn");
  const deleteBtn = document.getElementById("adminDeleteLiveChallengeBtn");

  if (editTitleBtn) {
    editTitleBtn.addEventListener("click", async () => {
      await handleAdminEditLiveTitle(row);
    });
  }

  if (editPointsBtn) {
    editPointsBtn.addEventListener("click", async () => {
      await handleAdminEditLivePoints(row);
    });
  }

  if (editDescriptionBtn) {
    editDescriptionBtn.addEventListener("click", async () => {
      await handleAdminEditLiveDescription(row);
    });
  }

  if (togglePhotoBtn) {
    togglePhotoBtn.addEventListener("click", async () => {
      await handleAdminToggleLivePhoto(row);
    });
  }

  if (editDurationBtn) {
    editDurationBtn.addEventListener("click", async () => {
      await handleAdminEditLiveDuration(row);
    });
  }

  if (editScheduledStartBtn) {
    editScheduledStartBtn.addEventListener("click", async () => {
      await handleAdminEditLiveScheduledStart(row);
    });
  }

  if (toggleStatusBtn) {
    toggleStatusBtn.addEventListener("click", async () => {
      await handleAdminToggleLiveStatus(row);
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      await handleAdminDeleteLiveChallenge(row);
    });
  }

  startAdminLiveDetailsCountdown(row);
}

/* ============================================================
 * EDIT ACTIONS
 * ============================================================
 */

/**
 * Bearbeitet den Titel einer Live-Challenge.
 */
async function handleAdminEditLiveTitle(row) {
  if (!row) return;

  const input = prompt("Neuen Titel eingeben:", row.title || "");
  if (input === null) return;

  const value = input.trim();
  if (!value) {
    alert("Bitte einen gültigen Titel eingeben.");
    return;
  }

  const updated = await updateAdminLiveChallengeFields(row.id, { title: value });
  if (!updated) return;

  await refreshAdminLiveAfterMutation(row.id);
}

/**
 * Bearbeitet die Punktzahl einer Live-Challenge.
 */
async function handleAdminEditLivePoints(row) {
  if (!row) return;

  const input = prompt("Neue Punktzahl eingeben:", String(row.points ?? 0));
  if (input === null) return;

  const value = Number(input);
  if (!Number.isFinite(value) || value < 0) {
    alert("Ungültige Punktzahl.");
    return;
  }

  const updated = await updateAdminLiveChallengeFields(row.id, { points: value });
  if (!updated) return;

  await refreshAdminLiveAfterMutation(row.id);
}

/**
 * Bearbeitet die Beschreibung einer Live-Challenge.
 */
async function handleAdminEditLiveDescription(row) {
  if (!row) return;

  const input = prompt("Neue Beschreibung eingeben:", row.description || "");
  if (input === null) return;

  const value = input.trim();

  const updated = await updateAdminLiveChallengeFields(row.id, {
    description: value || null
  });
  if (!updated) return;

  await refreshAdminLiveAfterMutation(row.id);
}

/**
 * Schaltet die Foto-Pflicht um.
 */
async function handleAdminToggleLivePhoto(row) {
  if (!row) return;

  const updated = await updateAdminLiveChallengeFields(row.id, {
    requires_photo_proof: !(row.requires_photo_proof === true)
  });
  if (!updated) return;

  await refreshAdminLiveAfterMutation(row.id);
}

/**
 * Bearbeitet die Dauer der Challenge.
 *
 * Verhalten:
 * - inactive: nur duration_minutes ändern
 * - active: expires_at sofort passend anpassen
 */
async function handleAdminEditLiveDuration(row) {
  if (!row) return;

  const input = prompt(
    "Dauer in Minuten eingeben.\n\n0 oder leer = kein Zeitlimit.",
    row.duration_minutes ? String(row.duration_minutes) : "0"
  );

  if (input === null) return;

  const trimmed = input.trim();

  let durationMinutes = null;
  let expiresAt = row.expires_at || null;

  if (trimmed !== "" && trimmed !== "0") {
    durationMinutes = Number(trimmed);

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      alert("Ungültige Dauer.");
      return;
    }
  }

  if (row.status === "active") {
    if (durationMinutes && durationMinutes > 0) {
      expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    } else {
      expiresAt = null;
    }
  }

  const updated = await updateAdminLiveChallengeFields(row.id, {
    duration_minutes: durationMinutes,
    expires_at: expiresAt
  });

  if (!updated) return;

  await refreshAdminLiveAfterMutation(row.id);
}

/**
 * Bearbeitet die geplante Startzeit.
 * Für aktive Challenges ist das absichtlich nicht erlaubt.
 */
async function handleAdminEditLiveScheduledStart(row) {
  if (!row) return;

  if (row.status === "active") {
    alert("Bei aktiven Live-Challenges kann kein geplanter Start gesetzt werden.");
    return;
  }

  const input = prompt(
    "Geplanten Start eingeben.\n\nFormat: YYYY-MM-DD HH:MM\nLeer oder 0 = entfernen",
    row.scheduled_start_at
      ? new Date(row.scheduled_start_at).toISOString().slice(0, 16).replace("T", " ")
      : ""
  );

  if (input === null) return;

  const trimmed = input.trim();
  let scheduledStartAt = null;

  if (trimmed !== "" && trimmed !== "0") {
    const normalized = trimmed.replace(" ", "T");
    const parsed = new Date(normalized);

    if (Number.isNaN(parsed.getTime())) {
      alert("Ungültiges Datumsformat.");
      return;
    }

    scheduledStartAt = parsed.toISOString();
  }

  const updated = await updateAdminLiveChallengeFields(row.id, {
    scheduled_start_at: scheduledStartAt
  });

  if (!updated) return;

  await refreshAdminLiveAfterMutation(row.id);
}

/**
 * Schaltet eine Challenge zwischen active und inactive um.
 *
 * Verhalten:
 * - inactive -> active: Aktivierung mit bestehender Aktiv-Logik
 * - active -> inactive: pausiert die Challenge und speichert
 *   die verbleibende Zeit zurück in duration_minutes
 */
async function handleAdminToggleLiveStatus(row) {
  if (!row) return;

  if (row.status === "inactive") {
    const ok = await activateAdminLiveChallenge(row);
    if (!ok) return;

    await refreshAdminLiveAfterMutation(row.id);
    return;
  }

  if (row.status === "active") {
    const confirmed = confirm(
      `Live-Challenge "${row.title || "Ohne Titel"}" pausieren?\n\n` +
      `Die verbleibende Zeit wird gespeichert und kann später fortgesetzt werden.`
    );

    if (!confirmed) return;

    const remainingSeconds = row.expires_at
      ? Math.max(0, getAdminLiveRemainingSeconds(row))
      : null;

    const remainingMinutes = remainingSeconds !== null
      ? Math.ceil(remainingSeconds / 60)
      : null;

    const updated = await updateAdminLiveChallengeFields(row.id, {
      status: "inactive",
      expires_at: null,
      duration_minutes: remainingMinutes
    });

    if (!updated) return;

    await refreshAdminLiveAfterMutation(row.id);
    return;
  }

  alert("Nur inaktive oder aktive Live-Challenges können direkt umgeschaltet werden.");
}

/* ============================================================
 * LÖSCHEN
 * ============================================================
 */

/**
 * Analysiert, ob eine Live-Challenge bereits Gewinner / Punkte / Teilnehmer hatte.
 * Daraus wird später die Warnung beim Löschen gebaut.
 */
function getAdminLiveDeleteInfo(row) {
  const completions = getAdminLiveCompletionRows(row.id);

  const hasWinner = !!row.winner_player_id;
  const hasPoints = completions.some(c => (c.points_awarded || 0) > 0);
  const participantCount = completions.length;

  return {
    hasWinner,
    hasPoints,
    participantCount
  };
}

/**
 * Löscht eine Live-Challenge vollständig aus der DB:
 * - player_live_challenge_views
 * - player_live_challenges
 * - live_challenges
 *
 * Logs werden bewusst nicht gelöscht.
 * Bereits vergebene Punkte werden NICHT automatisch zurückgerechnet.
 */
async function handleAdminDeleteLiveChallenge(row) {
  if (!row) return;

  const info = getAdminLiveDeleteInfo(row);

  let message = `Live-Challenge "${row.title || "Ohne Titel"}" wirklich löschen?\n\n`;

  if (info.hasWinner || info.hasPoints) {
    message +=
      "⚠️ Diese Challenge wurde bereits gespielt!\n\n" +
      "- Es gibt einen Gewinner oder vergebene Punkte\n" +
      "- Die Challenge wird vollständig aus der DB entfernt\n" +
      "- Spieler behalten ihre Punkte (keine automatische Korrektur)\n\n" +
      "Falls nötig musst du Punkte manuell anpassen.\n\n";
  } else if (info.participantCount > 0) {
    message += "Diese Challenge hatte bereits Teilnehmer, aber keine Punkte.\n\n";
  }

  message += "Dieser Vorgang kann nicht rückgängig gemacht werden.";

  const confirmed = confirm(message);
  if (!confirmed) return;

  try {
    const { error: viewsError } = await supabaseClient
      .from("player_live_challenge_views")
      .delete()
      .eq("live_challenge_id", row.id);

    if (viewsError) throw viewsError;

    const { error: completionsError } = await supabaseClient
      .from("player_live_challenges")
      .delete()
      .eq("live_challenge_id", row.id);

    if (completionsError) throw completionsError;

    const { error: challengeError } = await supabaseClient
      .from("live_challenges")
      .delete()
      .eq("id", row.id);

    if (challengeError) throw challengeError;

    if (typeof logAdminAction === "function") {
      await logAdminAction({
        gameId: row.game_id,
        adminPlayerId: adminPlayer?.id || null,
        eventType: "live_challenge_deleted",
        metadata: {
          live_challenge_id: row.id,
          live_challenge_title: row.title || null,
          had_winner: info.hasWinner,
          had_points: info.hasPoints,
          participant_count: info.participantCount,
          admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
          game_name: getAdminLiveGameName(row.game_id)
        }
      });
    }

    selectedAdminLiveChallengeId = null;
    await refreshAdminLiveAfterMutation();

  } catch (err) {
    console.error("Fehler beim Löschen der Live-Challenge:", err);
    alert("Live-Challenge konnte nicht gelöscht werden.");
  }
}