/**
 * ============================================================
 * admin_galerie.js
 * ============================================================
 *
 * Zweck:
 * Zentrale Galerie für alle Beweisfotos im Adminpanel.
 *
 * Der Tab nutzt bewusst den bestehenden "grid"-Tab-Slot
 * (id="tab-grid"), damit er den bisherigen leeren Grid-Tab ersetzt.
 *
 * Features:
 * - Alle Bilder aus normalen Challenges + Live-Challenges
 * - Gridansicht, neueste zuerst
 * - Filter nach Spiel, Spieler, Aufgabe, Typ, Zeitraum
 * - Freitextsuche (z. B. "Peter Flo")
 * - Viewer-Modal mit Vor/Zurück
 * - Klickbare Metadaten:
 *   - Spieler -> Spieler-Tab
 *   - Aufgabe -> Games-Tab (normale Challenge)
 *   - Live-Challenge -> Live-Tab
 *   - Spiel -> Games-Tab
 * - "Bild öffnen" und "Link kopieren"
 *
 * Voraussetzungen:
 * - admin.js
 * - admin_players.js
 * - admin_games.js
 * - admin_live.js
 * - supabase-client.js
 *
 * Hinweise:
 * - Der Tab rendert in #tab-grid
 * - Für die Aktivierung muss admin.js bei tabName === "grid"
 *   initializeAdminGalleryTab() aufrufen
 */

/* ============================================================
 * STATE
 * ============================================================
 */

let adminGalleryInitialized = false;

let adminGalleryEntries = [];
let adminGalleryFilteredEntries = [];

let adminGallerySelectedEntryId = null;
let adminGallerySelectedIndex = 0;

let adminGallerySelectionMode = false;
let adminGallerySelectedIds = new Set();

let adminGalleryFilters = {
  gameId: "",
  playerId: "",
  challengeKey: "",
  type: "",
  search: "",
  dateFrom: "",
  dateTo: ""
};

/* ============================================================
 * INIT
 * ============================================================
 */

async function initializeAdminGalleryTab() {
  ensureAdminGalleryLayout();
  ensureAdminGalleryViewerModal();

  await loadAdminGalleryBaseData();
  adminGalleryEntries = buildAdminGalleryEntries();
  renderAdminGalleryFilterOptions();
  renderAdminGalleryGrid();

  adminGalleryInitialized = true;
}

/* ============================================================
 * DATA LOAD
 * ============================================================
 */

async function loadAdminGalleryBaseData() {
  const bundle = await DataService.bundles.loadAdminGallery();

  adminPlayers = bundle.players || [];
  adminGames = bundle.games || [];
  adminPlayerChallenges = bundle.playerChallenges || [];
  adminChallenges = bundle.challenges || [];
  adminLiveChallenges = bundle.liveChallenges || [];
  adminPlayerLiveChallenges = bundle.playerLiveChallenges || [];
}


/* ============================================================
 * LAYOUT / STYLES
 * ============================================================
 */


function ensureAdminGalleryLayout() {
  const tabEl = document.getElementById("tab-grid");
  if (!tabEl) return;

  const alreadyBuilt = document.getElementById("adminGalleryLayout");
  if (alreadyBuilt) return;

  tabEl.innerHTML = `
    <div id="adminGalleryLayout" class="admin-gallery-layout">

      <div class="admin-gallery-filter-grid">
        <div class="admin-detail-card">
          <div class="admin-detail-label">Spiel</div>
          <select id="adminGalleryGameFilter" class="admin-gallery-select">
            <option value="">Alle Spiele</option>
          </select>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Spieler</div>
          <select id="adminGalleryPlayerFilter" class="admin-gallery-select">
            <option value="">Alle Spieler</option>
          </select>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Aufgabe</div>
          <select id="adminGalleryChallengeFilter" class="admin-gallery-select">
            <option value="">Alle Aufgaben</option>
          </select>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Typ</div>
          <select id="adminGalleryTypeFilter" class="admin-gallery-select">
            <option value="">Alle</option>
            <option value="normal">Normal</option>
            <option value="live">Live</option>
          </select>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Von</div>
          <input id="adminGalleryDateFromFilter" class="admin-gallery-input" type="date" />
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Bis</div>
          <input id="adminGalleryDateToFilter" class="admin-gallery-input" type="date" />
        </div>

        <div class="admin-detail-card admin-gallery-search-card">
          <div class="admin-detail-label">Suche</div>
          <input
            id="adminGallerySearchFilter"
            class="admin-gallery-input"
            type="text"
            placeholder="z. B. Peter Flo oder Bier"
          />
        </div>
      </div>

      <div class="admin-gallery-main-actions">
        <button id="adminGalleryResetFiltersBtn" type="button" class="secondary-btn">
          Filter zurücksetzen
        </button>

        <button id="adminGallerySelectModeBtn" type="button" class="secondary-btn">
          Bilder auswählen
        </button>
      </div>

      <div id="adminGalleryResultsInfo" class="admin-details-empty admin-gallery-results-info"></div>

      <div class="admin-gallery-selection-toolbar">
        <button id="adminGallerySelectAllVisibleBtn" type="button" class="secondary-btn hidden">
          Alle sichtbaren auswählen
        </button>
        <button id="adminGalleryShareSelectedBtn" type="button" class="secondary-btn hidden">
          Auswahl teilen
        </button>
        <button id="adminGalleryDownloadSelectedBtn" type="button" class="secondary-btn hidden">
          Auswahl downloaden
        </button>
        <button id="adminGalleryCancelSelectionBtn" type="button" class="secondary-btn hidden">
          Abbrechen
        </button>
        <span id="adminGallerySelectionInfo" class="admin-gallery-selection-info hidden">
          0 Bilder ausgewählt
        </span>
      </div>

      <div id="adminGalleryGrid" class="admin-gallery-grid"></div>
    </div>
  `;

  const resetBtn = document.getElementById("adminGalleryResetFiltersBtn");

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      resetAdminGalleryFilters();
      exitAdminGallerySelectionMode();
      renderAdminGalleryFilterOptions();
      renderAdminGalleryGrid();
    });
  }

  document.getElementById("adminGallerySelectModeBtn")?.addEventListener("click", () => {
    enterAdminGallerySelectionMode();
  });

  document.getElementById("adminGallerySelectAllVisibleBtn")?.addEventListener("click", () => {
    selectAllVisibleAdminGalleryEntries();
  });

  document.getElementById("adminGalleryShareSelectedBtn")?.addEventListener("click", async () => {
    await shareSelectedAdminGalleryImages();
  });

  document.getElementById("adminGalleryDownloadSelectedBtn")?.addEventListener("click", async () => {
    await downloadSelectedAdminGalleryImages();
  });

  document.getElementById("adminGalleryCancelSelectionBtn")?.addEventListener("click", () => {
    exitAdminGallerySelectionMode();
  });

  const autoApplyIds = [
    "adminGalleryGameFilter",
    "adminGalleryPlayerFilter",
    "adminGalleryChallengeFilter",
    "adminGalleryTypeFilter",
    "adminGalleryDateFromFilter",
    "adminGalleryDateToFilter"
  ];

  autoApplyIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener("change", () => {
      readAdminGalleryFiltersFromUI();
      renderAdminGalleryFilterOptions();
      renderAdminGalleryGrid();
    });
  });

  const searchInput = document.getElementById("adminGallerySearchFilter");
  if (searchInput) {
    searchInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        readAdminGalleryFiltersFromUI();
        renderAdminGalleryGrid();
      }
    });

    searchInput.addEventListener("input", () => {
      readAdminGalleryFiltersFromUI();
      renderAdminGalleryGrid();
    });
  }
}

function ensureAdminGalleryViewerModal() {
  if (document.getElementById("adminGalleryViewerOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "adminGalleryViewerOverlay";
  overlay.className = "modal-overlay hidden";

  overlay.innerHTML = `
    <div class="modal admin-gallery-viewer-modal">
      <button id="closeAdminGalleryViewerBtn" class="modal-close-btn" type="button">×</button>

      <div id="adminGalleryViewerImageWrap" class="admin-gallery-viewer-image-wrap">
        <div
          id="adminGalleryViewerLoading"
          class="admin-gallery-viewer-loading"
          aria-hidden="true"
        >
          <div class="admin-gallery-viewer-spinner"></div>
        </div>

        <img
          id="adminGalleryViewerImage"
          class="admin-gallery-viewer-image"
          alt="Beweisfoto"
        />

        <button
          id="adminGalleryImagePrevBtn"
          class="admin-gallery-arrow left hidden"
          type="button"
          aria-label="Vorheriges Bild"
        >
          ‹
        </button>

        <button
          id="adminGalleryImageNextBtn"
          class="admin-gallery-arrow right hidden"
          type="button"
          aria-label="Nächstes Bild"
        >
          ›
        </button>
      </div>

      <div id="adminGalleryViewerMeta" class="admin-gallery-viewer-info-grid"></div>

      <div class="modal-actions">
        <button id="adminGalleryOpenImageBtn" type="button" class="secondary-btn">Bild öffnen</button>
        <button id="adminGalleryCopyLinkBtn" type="button">Link kopieren</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("closeAdminGalleryViewerBtn")?.addEventListener("click", closeAdminGalleryViewer);
  document.getElementById("adminGalleryOpenImageBtn")?.addEventListener("click", openCurrentAdminGalleryImageInNewTab);
  document.getElementById("adminGalleryCopyLinkBtn")?.addEventListener("click", copyCurrentAdminGalleryImageLink);

  document.getElementById("adminGalleryImagePrevBtn")?.addEventListener("click", event => {
    event.stopPropagation();
    showPreviousAdminGalleryEntry();
  });

  document.getElementById("adminGalleryImageNextBtn")?.addEventListener("click", event => {
    event.stopPropagation();
    showNextAdminGalleryEntry();
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeAdminGalleryViewer();
    }
  });

  document.addEventListener("keydown", (event) => {
    const overlayEl = document.getElementById("adminGalleryViewerOverlay");
    if (!overlayEl || overlayEl.classList.contains("hidden")) return;

    if (event.key === "Escape") {
      closeAdminGalleryViewer();
    }

    if (event.key === "ArrowLeft") {
      showPreviousAdminGalleryEntry();
    }

    if (event.key === "ArrowRight") {
      showNextAdminGalleryEntry();
    }
  });
}



/* ============================================================
 * ENTRY BUILDING
 * ============================================================
 */

function buildAdminGalleryEntries() {
  const normalEntries = buildAdminGalleryNormalEntries();
  const liveEntries = buildAdminGalleryLiveEntries();

  return [...normalEntries, ...liveEntries]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function buildAdminGalleryNormalEntries() {
  if (!Array.isArray(adminPlayerChallenges)) return [];
  if (!Array.isArray(adminChallenges)) return [];

  return adminPlayerChallenges
    .filter(row =>
      row.status === "completed" &&
      row.proof_image_path
    )
    .map(row => {
      const challenge = adminChallenges.find(c => c.id === row.challenge_id);
      const player = adminPlayers.find(p => p.id === row.player_id);
      const game = adminGames.find(g => g.id === row.game_id);

      if (!challenge || !player || !game) return null;

      return {
        id: `normal-${row.id}`,
        sourceId: row.id,
        type: "normal",
        gameId: game.id,
        gameName: game.name || `Spiel ${game.id}`,
        playerId: player.id,
        playerName: player.display_name || player.username || `Spieler ${player.id}`,
        playerUsername: player.username || "",
        challengeId: challenge.id,
        challengeTitle: challenge.title || `Challenge ${challenge.position ?? challenge.id}`,
        challengePosition: challenge.position ?? null,
        createdAt: row.completed_at,
        proofImagePath: row.proof_image_path,
        imageUrl: DataService.storage.getProofPhotoPublicUrl(row.proof_image_path),
        isLive: false
      };
    })
    .filter(Boolean);
}

function buildAdminGalleryLiveEntries() {
  const liveChallenges =
    typeof adminLiveChallenges !== "undefined" && Array.isArray(adminLiveChallenges)
      ? adminLiveChallenges
      : [];

  const playerLiveRows =
    typeof adminPlayerLiveChallenges !== "undefined" && Array.isArray(adminPlayerLiveChallenges)
      ? adminPlayerLiveChallenges
      : [];

  return playerLiveRows
    .filter(row =>
      row.status === "completed" &&
      row.proof_image_path
    )
    .map(row => {
      const live = liveChallenges.find(l => Number(l.id) === Number(row.live_challenge_id));
      const player = adminPlayers.find(p => Number(p.id) === Number(row.player_id));
      const game = adminGames.find(g => Number(g.id) === Number(row.game_id));

      if (!live || !player || !game) return null;

      return {
        id: `live-${row.id}`,
        sourceId: row.id,
        type: "live",
        gameId: game.id,
        gameName: game.name || `Spiel ${game.id}`,
        playerId: player.id,
        playerName: player.display_name || player.username || `Spieler ${player.id}`,
        playerUsername: player.username || "",
        challengeId: live.id,
        challengeTitle: live.title || `Live-Challenge ${live.id}`,
        challengePosition: null,
        createdAt: row.completed_at,
        proofImagePath: row.proof_image_path,
        imageUrl: DataService.storage.getProofPhotoPublicUrl(row.proof_image_path),
        isLive: true
      };
    })
    .filter(Boolean);
}

/* ============================================================
 * FILTERS
 * ============================================================
 */

function resetAdminGalleryFilters() {
  adminGalleryFilters = {
    gameId: "",
    playerId: "",
    challengeKey: "",
    type: "",
    search: "",
    dateFrom: "",
    dateTo: ""
  };
}

function readAdminGalleryFiltersFromUI() {
  adminGalleryFilters.gameId = document.getElementById("adminGalleryGameFilter")?.value || "";
  adminGalleryFilters.playerId = document.getElementById("adminGalleryPlayerFilter")?.value || "";
  adminGalleryFilters.challengeKey = document.getElementById("adminGalleryChallengeFilter")?.value || "";
  adminGalleryFilters.type = document.getElementById("adminGalleryTypeFilter")?.value || "";
  adminGalleryFilters.search = document.getElementById("adminGallerySearchFilter")?.value || "";
  adminGalleryFilters.dateFrom = document.getElementById("adminGalleryDateFromFilter")?.value || "";
  adminGalleryFilters.dateTo = document.getElementById("adminGalleryDateToFilter")?.value || "";
}

function renderAdminGalleryFilterOptions() {
  const gameSelect = document.getElementById("adminGalleryGameFilter");
  const playerSelect = document.getElementById("adminGalleryPlayerFilter");
  const challengeSelect = document.getElementById("adminGalleryChallengeFilter");
  const typeSelect = document.getElementById("adminGalleryTypeFilter");
  const searchInput = document.getElementById("adminGallerySearchFilter");
  const dateFromInput = document.getElementById("adminGalleryDateFromFilter");
  const dateToInput = document.getElementById("adminGalleryDateToFilter");

  if (gameSelect) {
    const oldValue = adminGalleryFilters.gameId || "";
    gameSelect.innerHTML = `<option value="">Alle Spiele</option>`;

    adminGames
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "de"))
      .forEach(game => {
        const option = document.createElement("option");
        option.value = String(game.id);
        option.textContent = game.name || `Spiel ${game.id}`;
        if (String(oldValue) === String(game.id)) {
          option.selected = true;
        }
        gameSelect.appendChild(option);
      });
  }

  if (playerSelect) {
    const oldValue = adminGalleryFilters.playerId || "";
    playerSelect.innerHTML = `<option value="">Alle Spieler</option>`;

    const playerMap = new Map();
    adminGalleryEntries.forEach(entry => {
      if (!playerMap.has(entry.playerId)) {
        playerMap.set(entry.playerId, entry.playerName);
      }
    });

    [...playerMap.entries()]
      .sort((a, b) => String(a[1]).localeCompare(String(b[1]), "de"))
      .forEach(([playerId, playerName]) => {
        const option = document.createElement("option");
        option.value = String(playerId);
        option.textContent = playerName;
        if (String(oldValue) === String(playerId)) {
          option.selected = true;
        }
        playerSelect.appendChild(option);
      });
  }

  if (challengeSelect) {
    const oldValue = adminGalleryFilters.challengeKey || "";
    challengeSelect.innerHTML = `<option value="">Alle Aufgaben</option>`;

    const currentGameId = adminGalleryFilters.gameId ? Number(adminGalleryFilters.gameId) : null;
    const currentType = adminGalleryFilters.type || "";

    const optionsMap = new Map();

    adminGalleryEntries.forEach(entry => {
      if (currentGameId && Number(entry.gameId) !== currentGameId) return;
      if (currentType && entry.type !== currentType) return;

      const key = `${entry.type}:${entry.challengeId}`;
      if (!optionsMap.has(key)) {
        optionsMap.set(key, {
          key,
          label: entry.type === "live"
            ? `⚡ ${entry.challengeTitle}`
            : entry.challengeTitle
        });
      }
    });

    [...optionsMap.values()]
      .sort((a, b) => String(a.label).localeCompare(String(b.label), "de"))
      .forEach(entry => {
        const option = document.createElement("option");
        option.value = entry.key;
        option.textContent = entry.label;

        if (oldValue === entry.key) {
          option.selected = true;
        }

        challengeSelect.appendChild(option);
      });
  }

  if (typeSelect) {
    typeSelect.value = adminGalleryFilters.type || "";
  }

  if (searchInput) {
    searchInput.value = adminGalleryFilters.search || "";
  }

  if (dateFromInput) {
    dateFromInput.value = adminGalleryFilters.dateFrom || "";
  }

  if (dateToInput) {
    dateToInput.value = adminGalleryFilters.dateTo || "";
  }
}

function getFilteredAdminGalleryEntries() {
  const {
    gameId,
    playerId,
    challengeKey,
    type,
    search,
    dateFrom,
    dateTo
  } = adminGalleryFilters;

  const tokens = normalizeAdminGallerySearchTokens(search);

  return adminGalleryEntries.filter(entry => {
    if (gameId && String(entry.gameId) !== String(gameId)) {
      return false;
    }

    if (playerId && String(entry.playerId) !== String(playerId)) {
      return false;
    }

    if (type && entry.type !== type) {
      return false;
    }

    if (challengeKey) {
      const entryKey = `${entry.type}:${entry.challengeId}`;
      if (entryKey !== challengeKey) {
        return false;
      }
    }

    if (dateFrom) {
      const entryDate = new Date(entry.createdAt);
      const fromDate = new Date(`${dateFrom}T00:00:00`);
      if (entryDate < fromDate) {
        return false;
      }
    }

    if (dateTo) {
      const entryDate = new Date(entry.createdAt);
      const toDate = new Date(`${dateTo}T23:59:59.999`);
      if (entryDate > toDate) {
        return false;
      }
    }

    if (tokens.length) {
      const haystack = [
        entry.playerName,
        entry.playerUsername,
        entry.challengeTitle,
        entry.gameName,
        entry.type
      ]
        .join(" ")
        .toLowerCase();

      const matches = tokens.some(token => haystack.includes(token));
      if (!matches) {
        return false;
      }
    }

    return true;
  });
}

function normalizeAdminGallerySearchTokens(text) {
  if (!text) return [];

  return String(text)
    .toLowerCase()
    .split(/[,\s]+/)
    .map(token => token.trim())
    .filter(Boolean);
}

/* ============================================================
 * GRID RENDER
 * ============================================================
 */

function renderAdminGalleryGrid() {
  const gridEl = document.getElementById("adminGalleryGrid");
  const infoEl = document.getElementById("adminGalleryResultsInfo");

  if (!gridEl) return;

  adminGalleryFilteredEntries = getFilteredAdminGalleryEntries();
  pruneAdminGallerySelectionToFilteredEntries();
  updateAdminGallerySelectionToolbar();

  if (infoEl) {
    infoEl.textContent = `${adminGalleryFilteredEntries.length} Bild${adminGalleryFilteredEntries.length === 1 ? "" : "er"} gefunden`;
  }

  if (!adminGalleryFilteredEntries.length) {
    gridEl.innerHTML = `
      <div class="admin-gallery-empty">
        Keine Bilder für die aktuellen Filter gefunden.
      </div>
    `;
    return;
  }

  gridEl.innerHTML = "";

  adminGalleryFilteredEntries.forEach((entry, index) => {
    const card = document.createElement("div");
    card.className = "admin-gallery-card";
    card.title = `${entry.playerName} – ${entry.challengeTitle}`;

    if (adminGallerySelectionMode) {
      card.classList.add("selection-mode");
    }

    if (adminGallerySelectedIds.has(entry.id)) {
      card.classList.add("selected");
    }

    card.innerHTML = `
      <div class="admin-gallery-card-image-wrap">
        <img src="${entry.imageUrl}" class="admin-gallery-card-image" alt="Beweisfoto" loading="lazy" />
      </div>

      ${adminGallerySelectionMode ? `<div class="admin-gallery-card-check">${adminGallerySelectedIds.has(entry.id) ? "✓" : ""}</div>` : ""}
      ${entry.isLive ? `<div class="admin-gallery-card-live-badge">⚡</div>` : ""}

      <div class="admin-gallery-card-overlay">
        <div class="admin-gallery-card-player">${escapeHtmlAdminGallery(entry.playerName)}</div>
        <div class="admin-gallery-card-challenge">${escapeHtmlAdminGallery(entry.challengeTitle)}</div>
      </div>
    `;

    card.addEventListener("click", () => {
      if (adminGallerySelectionMode) {
        toggleAdminGalleryEntrySelection(entry.id);
        return;
      }

      adminGallerySelectedEntryId = entry.id;
      adminGallerySelectedIndex = index;
      openAdminGalleryViewer();
    });

    gridEl.appendChild(card);
  });
}

/* ============================================================
 * VIEWER
 * ============================================================
 */

function openAdminGalleryViewer() {
  const overlay = document.getElementById("adminGalleryViewerOverlay");
  if (!overlay) return;

  if (!adminGalleryFilteredEntries.length) return;

  if (adminGallerySelectedEntryId) {
    const foundIndex = adminGalleryFilteredEntries.findIndex(entry => entry.id === adminGallerySelectedEntryId);
    if (foundIndex >= 0) {
      adminGallerySelectedIndex = foundIndex;
    }
  }

  renderAdminGalleryViewerCurrent();
  overlay.classList.remove("hidden");
}

function closeAdminGalleryViewer() {
  const overlay = document.getElementById("adminGalleryViewerOverlay");
  if (!overlay) return;
  overlay.classList.add("hidden");
}

function renderAdminGalleryViewerCurrent() {
  const imageEl = document.getElementById("adminGalleryViewerImage");
  const loadingEl = document.getElementById("adminGalleryViewerLoading");
  const prevBtn = document.getElementById("adminGalleryImagePrevBtn");
  const nextBtn = document.getElementById("adminGalleryImageNextBtn");
  const metaEl = document.getElementById("adminGalleryViewerMeta");

  const entry = adminGalleryFilteredEntries[adminGallerySelectedIndex];

  if (!entry || !imageEl || !loadingEl || !prevBtn || !nextBtn) {
    return;
  }

  adminGallerySelectedEntryId = entry.id;

  prevBtn.classList.toggle("hidden", adminGallerySelectedIndex <= 0);
  nextBtn.classList.toggle(
    "hidden",
    adminGallerySelectedIndex >= adminGalleryFilteredEntries.length - 1
  );

  loadingEl.classList.add("visible");
  imageEl.classList.add("loading");

  const requestedEntryId = entry.id;
  const nextImage = new Image();

  nextImage.onload = () => {
    if (adminGallerySelectedEntryId !== requestedEntryId) return;

    imageEl.src = entry.imageUrl;
    imageEl.alt = entry.challengeTitle || "Beweisfoto";

    requestAnimationFrame(() => {
      imageEl.classList.remove("loading");
      loadingEl.classList.remove("visible");
    });
  };

  nextImage.onerror = () => {
    if (adminGallerySelectedEntryId !== requestedEntryId) return;

    imageEl.removeAttribute("src");
    imageEl.alt = "Bild konnte nicht geladen werden";
    imageEl.classList.remove("loading");
    loadingEl.classList.remove("visible");
  };

  nextImage.src = entry.imageUrl;

  if (metaEl) {
    metaEl.innerHTML = `
      <div class="admin-gallery-viewer-info-card admin-gallery-viewer-info-wide">
        <div class="admin-gallery-viewer-info-label">
          ${entry.type === "live" ? "Live" : "Aufgabe"}
        </div>
        <div
          class="admin-gallery-viewer-info-value clickable"
          id="adminGalleryMetaChallengeLink"
        >
          ${escapeHtmlAdminGallery(entry.challengeTitle)}
        </div>
      </div>

      <div class="admin-gallery-viewer-info-card">
        <div class="admin-gallery-viewer-info-label">Spieler</div>
        <div
          class="admin-gallery-viewer-info-value clickable"
          id="adminGalleryMetaPlayerLink"
        >
          ${escapeHtmlAdminGallery(entry.playerName)}
        </div>
      </div>

      <div class="admin-gallery-viewer-info-card">
        <div class="admin-gallery-viewer-info-label">Zeit</div>
        <div class="admin-gallery-viewer-info-value">
          ${formatAdminDateTime(entry.createdAt)}
        </div>
      </div>

      <div class="admin-gallery-viewer-info-card">
        <div class="admin-gallery-viewer-info-label">Spiel</div>
        <div
          class="admin-gallery-viewer-info-value clickable"
          id="adminGalleryMetaGameLink"
        >
          ${escapeHtmlAdminGallery(entry.gameName)}
        </div>
      </div>

      <div class="admin-gallery-viewer-info-card">
        <div class="admin-gallery-viewer-info-label">Typ</div>
        <div class="admin-gallery-viewer-info-value">
          ${entry.type === "live" ? "Live-Challenge" : "Normale Challenge"}
        </div>
      </div>
    `;

    document.getElementById("adminGalleryMetaPlayerLink")?.addEventListener("click", async () => {
      await openAdminGalleryPlayerLink(entry);
    });

    document.getElementById("adminGalleryMetaChallengeLink")?.addEventListener("click", async () => {
      await openAdminGalleryChallengeLink(entry);
    });

    document.getElementById("adminGalleryMetaGameLink")?.addEventListener("click", async () => {
      await openAdminGalleryGameLink(entry);
    });
  }
}

function showPreviousAdminGalleryEntry() {
  if (adminGallerySelectedIndex <= 0) return;
  adminGallerySelectedIndex--;
  renderAdminGalleryViewerCurrent();
}

function showNextAdminGalleryEntry() {
  if (adminGallerySelectedIndex >= adminGalleryFilteredEntries.length - 1) return;
  adminGallerySelectedIndex++;
  renderAdminGalleryViewerCurrent();
}

function getCurrentAdminGalleryEntry() {
  return adminGalleryFilteredEntries[adminGallerySelectedIndex] || null;
}

function openCurrentAdminGalleryImageInNewTab() {
  const entry = getCurrentAdminGalleryEntry();
  if (!entry?.imageUrl) return;

  window.open(entry.imageUrl, "_blank", "noopener,noreferrer");
}

async function copyCurrentAdminGalleryImageLink() {
  const entry = getCurrentAdminGalleryEntry();
  if (!entry?.imageUrl) return;

  const copied = await copyTextAdminGallery(entry.imageUrl);

  if (copied) {
    alert("Bildlink kopiert.");
  } else {
    prompt("Link konnte nicht automatisch kopiert werden. Du kannst ihn hier manuell kopieren:", entry.imageUrl);
  }
}


/* ============================================================
 * MULTI SELECT / SHARE / DOWNLOAD
 * ============================================================
 */

function enterAdminGallerySelectionMode() {
  adminGallerySelectionMode = true;
  adminGallerySelectedIds = new Set();
  renderAdminGalleryGrid();
}

function exitAdminGallerySelectionMode() {
  adminGallerySelectionMode = false;
  adminGallerySelectedIds = new Set();
  renderAdminGalleryGrid();
}

function toggleAdminGalleryEntrySelection(entryId) {
  if (!entryId) return;

  if (adminGallerySelectedIds.has(entryId)) {
    adminGallerySelectedIds.delete(entryId);
  } else {
    adminGallerySelectedIds.add(entryId);
  }

  renderAdminGalleryGrid();
}

function selectAllVisibleAdminGalleryEntries() {
  if (!adminGallerySelectionMode) return;

  const visibleIds = (adminGalleryFilteredEntries || []).map(entry => entry.id);
  if (!visibleIds.length) return;

  const allVisibleSelected = visibleIds.every(id => adminGallerySelectedIds.has(id));

  if (allVisibleSelected) {
    visibleIds.forEach(id => adminGallerySelectedIds.delete(id));
  } else {
    visibleIds.forEach(id => adminGallerySelectedIds.add(id));
  }

  renderAdminGalleryGrid();
}

function pruneAdminGallerySelectionToFilteredEntries() {
  if (!adminGallerySelectionMode) return;

  const visibleIds = new Set(
    (adminGalleryFilteredEntries || []).map(entry => entry.id)
  );

  adminGallerySelectedIds = new Set(
    [...adminGallerySelectedIds].filter(id => visibleIds.has(id))
  );
}

function updateAdminGallerySelectionToolbar() {
  const selectBtn = document.getElementById("adminGallerySelectModeBtn");
  const selectAllBtn = document.getElementById("adminGallerySelectAllVisibleBtn");
  const shareBtn = document.getElementById("adminGalleryShareSelectedBtn");
  const downloadBtn = document.getElementById("adminGalleryDownloadSelectedBtn");
  const cancelBtn = document.getElementById("adminGalleryCancelSelectionBtn");
  const infoEl = document.getElementById("adminGallerySelectionInfo");

  const selectedCount = adminGallerySelectedIds.size;
  const inSelectionMode = adminGallerySelectionMode === true;

  if (selectBtn) {
    selectBtn.classList.toggle("hidden", inSelectionMode);
  }

  [selectAllBtn, shareBtn, downloadBtn, cancelBtn, infoEl].forEach(el => {
    if (!el) return;
    el.classList.toggle("hidden", !inSelectionMode);
  });

  if (infoEl) {
    infoEl.textContent = `${selectedCount} Bild${selectedCount === 1 ? "" : "er"} ausgewählt`;
  }

  if (selectAllBtn) {
    selectAllBtn.disabled = !adminGalleryFilteredEntries.length;
    selectAllBtn.textContent = selectedCount === adminGalleryFilteredEntries.length && selectedCount > 0
      ? "Alle sichtbaren abwählen"
      : "Alle sichtbaren auswählen";
  }

  if (shareBtn) {
    shareBtn.disabled = selectedCount === 0;
  }

  if (downloadBtn) {
    downloadBtn.disabled = selectedCount === 0;
  }
}

function getSelectedAdminGalleryEntries() {
  return (adminGalleryFilteredEntries || []).filter(entry =>
    adminGallerySelectedIds.has(entry.id)
  );
}

async function shareSelectedAdminGalleryImages() {
  const entries = getSelectedAdminGalleryEntries();

  if (!entries.length) {
    alert("Bitte zuerst mindestens ein Bild auswählen.");
    return;
  }

  try {
    const files = await buildAdminGalleryImageFiles(entries);

    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files })
    ) {
      await navigator.share({ files });
      return;
    }

    alert("Direktes Teilen wird von diesem Browser nicht unterstützt. Die Bilder werden stattdessen heruntergeladen.");
    await downloadAdminGalleryFiles(files);
  } catch (error) {
    console.error("Fehler beim Teilen der Bilder:", error);
    alert("Teilen ist fehlgeschlagen. Die Bilder werden stattdessen heruntergeladen.");
    await downloadSelectedAdminGalleryImages();
  }
}

async function downloadSelectedAdminGalleryImages() {
  const entries = getSelectedAdminGalleryEntries();

  if (!entries.length) {
    alert("Bitte zuerst mindestens ein Bild auswählen.");
    return;
  }

  try {
    const files = await buildAdminGalleryImageFiles(entries);
    await downloadAdminGalleryFiles(files);
  } catch (error) {
    console.error("Fehler beim Download der Bilder:", error);
    alert("Bilder konnten nicht heruntergeladen werden.");
  }
}

async function buildAdminGalleryImageFiles(entries) {
  const files = [];

  for (const entry of entries) {
    const response = await fetch(entry.imageUrl);

    if (!response.ok) {
      throw new Error(`Bild konnte nicht geladen werden: ${entry.imageUrl}`);
    }

    const blob = await response.blob();
    const filename = buildAdminGalleryImageFileName(entry, blob.type);

    files.push(new File([blob], filename, {
      type: blob.type || "image/jpeg"
    }));
  }

  return files;
}

function buildAdminGalleryImageFileName(entry, mimeType = "") {
  const extensionFromPath = String(entry.proofImagePath || "")
    .split("?")[0]
    .split(".")
    .pop();

  const extension = extensionFromPath && extensionFromPath.length <= 5
    ? extensionFromPath
    : getAdminGalleryExtensionFromMimeType(mimeType);

  const datePart = entry.createdAt
    ? new Date(entry.createdAt).toISOString().slice(0, 10)
    : "bild";

  const safePlayer = sanitizeAdminGalleryFileName(entry.playerName || "spieler");
  const safeChallenge = sanitizeAdminGalleryFileName(entry.challengeTitle || "aufgabe");

  return `${datePart}_${safePlayer}_${safeChallenge}.${extension || "jpg"}`;
}

function getAdminGalleryExtensionFromMimeType(mimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/heic") return "heic";
  return "jpg";
}

function sanitizeAdminGalleryFileName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "bild";
}

async function downloadAdminGalleryFiles(files) {
  for (const file of files) {
    const objectUrl = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);

    // Kleiner Abstand, damit mobile Browser mehrere Downloads besser verarbeiten.
    await new Promise(resolve => setTimeout(resolve, 180));
  }
}

async function copyTextAdminGallery(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";

    document.body.appendChild(textarea);
    textarea.select();

    const ok = document.execCommand("copy");
    textarea.remove();

    return ok;
  } catch (_) {
    return false;
  }
}

/* ============================================================
 * INTERNAL NAVIGATION
 * ============================================================
 */

async function switchAdminTabProgrammatically(tabName) {
  const tabButton = document.querySelector(`.admin-tab[data-tab="${tabName}"]`);
  const content = document.getElementById(`tab-${tabName}`);

  if (!tabButton || !content) return;

  document.querySelectorAll(".admin-tab").forEach(tab => tab.classList.remove("active"));
  document.querySelectorAll(".admin-tab-content").forEach(tabContent => tabContent.classList.remove("active"));

  tabButton.classList.add("active");
  content.classList.add("active");

  if (typeof handleAdminTabActivated === "function") {
    await handleAdminTabActivated(tabName);
  }
}

async function openAdminGalleryPlayerLink(entry) {
  if (!entry) return;

  closeAdminGalleryViewer();

  if (typeof selectedAdminPlayerId !== "undefined") {
    selectedAdminPlayerId = entry.playerId;
  }

  await switchAdminTabProgrammatically("players");

  if (typeof renderAdminPlayerDetails === "function") {
    const player = adminPlayers.find(p => p.id === entry.playerId) || null;
    if (player) {
      await renderAdminPlayerDetails(player);
    }
  }
}

async function openAdminGalleryGameLink(entry) {
  if (!entry) return;

  closeAdminGalleryViewer();

  adminCurrentGameId = entry.gameId;
  adminCurrentGame = adminGames.find(game => game.id === entry.gameId) || null;

  if (typeof saveGameIdToLocalStorageAdmin === "function") {
    saveGameIdToLocalStorageAdmin(adminCurrentGameId);
  }

  if (typeof updateAdminCurrentGameDisplay === "function") {
    updateAdminCurrentGameDisplay();
  }

  if (typeof selectedAdminGameDetailsId !== "undefined") {
    selectedAdminGameDetailsId = entry.gameId;
  }

  await switchAdminTabProgrammatically("games");
}

async function openAdminGalleryChallengeLink(entry) {
  if (!entry) return;

  closeAdminGalleryViewer();

  adminCurrentGameId = entry.gameId;
  adminCurrentGame = adminGames.find(game => game.id === entry.gameId) || null;

  if (typeof saveGameIdToLocalStorageAdmin === "function") {
    saveGameIdToLocalStorageAdmin(adminCurrentGameId);
  }

  if (typeof updateAdminCurrentGameDisplay === "function") {
    updateAdminCurrentGameDisplay();
  }

  if (entry.type === "normal") {
    if (typeof selectedAdminGameDetailsId !== "undefined") {
      selectedAdminGameDetailsId = entry.gameId;
    }

    await switchAdminTabProgrammatically("games");

    if (typeof openAdminGameChallengeDetails === "function") {
      const game = adminGames.find(g => g.id === entry.gameId) || null;
      const challenge = adminChallenges.find(c => c.id === entry.challengeId) || null;

      if (game && challenge) {
        await openAdminGameChallengeDetails(game, challenge);
      }
    }

    return;
  }

  if (entry.type === "live") {
    if (typeof selectedAdminLiveChallengeId !== "undefined") {
      selectedAdminLiveChallengeId = entry.challengeId;
    }

    await switchAdminTabProgrammatically("live");
  }
}

/* ============================================================
 * HELPERS
 * ============================================================
 */

function escapeHtmlAdminGallery(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}