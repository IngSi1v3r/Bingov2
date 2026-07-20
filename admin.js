/**
 * ============================================================
 * admin.js
 * ============================================================
 *
 * Zweck:
 * Zentrale Start- und Steuerdatei des Adminpanels.
 *
 * Diese Datei kuemmert sich um:
 * - Admin-Bootstrap nach Auth
 * - global ausgewaehltes Admin-Spiel
 * - Admin-Header
 * - Tabwechsel
 * - globales Admin-Polling ueber PollingService
 * - allgemeine Admin-Helfer fuer Datum, Cooldown, Bilder usw.
 *
 * Nicht hier enthalten:
 * - Auth-Logik -> auth.js
 * - Datenzugriffe -> data_service.js / Tab-Dateien
 * - Players-Tab -> admin_players.js
 * - Games-Tab -> admin_games.js
 * - Live-Tab -> admin_live.js
 * - Logs-Tab -> admin_logs.js
 * - Dashboard -> admin_dashboard.js
 * - Galerie -> admin_galerie.js
 */

/* ============================================================
 * KONSTANTEN
 * ============================================================ */

const ADMIN_GAME_STORAGE_KEY = "festival_bingo_game_id";
const ADMIN_POLLING_JOB_ID = "admin-active-tab";

const adminGoToGameBtn = document.getElementById("adminGoToGameBtn");

/* ============================================================
 * GLOBALER ADMIN-STATE
 * ============================================================ */

let adminPlayer = null;
let adminCurrentGameId = loadGameIdFromLocalStorageAdmin();
let adminCurrentGame = null;

let selectedAdminPlayerId = null;

/**
 * Zentrale Collections.
 * Diese werden aktuell weiterhin von den Tab-Dateien befuellt.
 */
let adminPlayers = [];
let adminGames = [];
let adminPlayerStates = [];
let adminPlayerChallenges = [];
let adminPlayerBingos = [];
let adminChallenges = [];

let currentAdminGalleryEntries = [];
let currentAdminGalleryIndex = 0;

/* ============================================================
 * DOM
 * ============================================================ */

const tabs = document.querySelectorAll(".admin-tab");
const contents = document.querySelectorAll(".admin-tab-content");

const adminLogoutBtn = document.getElementById("adminLogoutBtn");

const adminUserMenuBtn = document.getElementById("adminUserMenuBtn");
const adminUserMenu = document.getElementById("adminUserMenu");

const adminCurrentGameBtn = document.getElementById("adminCurrentGameBtn");
const adminCurrentGameText = document.getElementById("adminCurrentGame");

const adminGameSelectOverlay = document.getElementById("adminGameSelectOverlay");
const closeAdminGameSelectBtn = document.getElementById("closeAdminGameSelectBtn");
const adminGameList = document.getElementById("adminGameList");

/* ============================================================
 * LOCAL STORAGE
 * ============================================================ */

function saveGameIdToLocalStorageAdmin(gameId) {
  localStorage.setItem(ADMIN_GAME_STORAGE_KEY, String(gameId));
}

function loadGameIdFromLocalStorageAdmin() {
  const raw = localStorage.getItem(ADMIN_GAME_STORAGE_KEY);
  if (!raw) return 1;

  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : 1;
}

/* ============================================================
 * START / LOGOUT
 * ============================================================ */

/**
 * Startet das Adminpanel nach erfolgreicher Auth-Pruefung.
 */
async function startAdminApp() {
  const boot = await authBootstrapForAdminPage();
  if (!boot?.allowed) return;

  adminPlayer = boot.user;
  await startAdminPanelAfterLogin();
}

/**
 * Logout aus dem Adminpanel.
 */
function logoutAdmin() {
  stopAdminPolling();

  adminPlayer = null;
  selectedAdminPlayerId = null;

  authLogout({ redirectTo: AUTH_VIEW_GAME });
}

/**
 * Initialisiert Header, aktuelles Spiel, aktiven Tab und Polling.
 */
async function startAdminPanelAfterLogin() {
  renderAdminHeader();
  requestAnimationFrame(updateAdminHeaderHeight);
  await loadAdminCurrentGame();

  const activeTab = getActiveAdminTab();
  await handleAdminTabActivated(activeTab);

  startAdminPolling();
}

/* ============================================================
 * HEADER
 * ============================================================ */

/**
 * Rendert den Adminnamen im Header.
 */
function renderAdminHeader() {
  const nameEl = document.getElementById("adminName");

  if (nameEl && adminPlayer) {
    nameEl.textContent = adminPlayer.display_name || adminPlayer.username || "-";
  }
}

function updateAdminHeaderHeight() {
  const header = document.querySelector(".admin-sticky-header");
  if (!header) return;

  const height = Math.ceil(header.getBoundingClientRect().height);

  document.documentElement.style.setProperty(
    "--admin-header-height",
    `${height + 12}px`
  );
}

/**
 * Laedt das aktuell globale Admin-Spiel.
 * Falls es nicht mehr existiert, wird auf das erste aktive Spiel zurueckgefallen.
 */
async function loadAdminCurrentGame() {
  if (typeof DataService === "undefined") {
    console.error("DataService nicht gefunden. Bitte data_service.js einbinden.");
    adminCurrentGame = null;
    updateAdminCurrentGameDisplay();
    return;
  }

  adminCurrentGame = await DataService.games.loadById(adminCurrentGameId);

  if (!adminCurrentGame) {
    adminCurrentGame = await DataService.games.loadFirstActive();

    if (adminCurrentGame) {
      adminCurrentGameId = adminCurrentGame.id;
      saveGameIdToLocalStorageAdmin(adminCurrentGameId);
    }
  }

  updateAdminCurrentGameDisplay();
}

/**
 * Aktualisiert die Anzeige des aktuell ausgewaehlten Spiels.
 */
function updateAdminCurrentGameDisplay() {
  if (adminCurrentGameText) {
    adminCurrentGameText.textContent = adminCurrentGame?.name || "-";
  }
}

function updateAdminHeaderHeight() {
  const header = document.querySelector(".admin-sticky-header");
  if (!header) return;

  const height = Math.ceil(header.getBoundingClientRect().height);

  document.documentElement.style.setProperty(
    "--admin-header-height",
    `${height + 12}px`
  );
}

/* ============================================================
 * GLOBALE SPIELAUSWAHL
 * ============================================================ */

function openAdminGameSelectOverlay() {
  if (!adminGameSelectOverlay) return;
  adminGameSelectOverlay.classList.remove("hidden");
}

function closeAdminGameSelectOverlay() {
  if (!adminGameSelectOverlay) return;
  adminGameSelectOverlay.classList.add("hidden");
}

/**
 * Laedt alle Spiele fuer die globale Admin-Spielauswahl.
 */
async function loadAllGamesForHeader() {
  if (typeof DataService === "undefined") {
    console.error("DataService nicht gefunden. Bitte data_service.js einbinden.");
    return [];
  }

  return await DataService.games.loadAll();
}

/**
 * Rendert die globale Spielauswahl im Header.
 */
async function renderAdminGameList() {
  if (!adminGameList) return;

  const games = await loadAllGamesForHeader();

  adminGameList.innerHTML = "";

  if (!games.length) {
    adminGameList.innerHTML = `<p>Keine Spiele gefunden.</p>`;
    return;
  }

  games.forEach(game => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${game.name}${game.id === adminCurrentGameId ? " (aktiv)" : ""}`;

    btn.addEventListener("click", async () => {
      adminCurrentGameId = game.id;
      adminCurrentGame = game;

      saveGameIdToLocalStorageAdmin(adminCurrentGameId);
      updateAdminCurrentGameDisplay();
      closeAdminGameSelectOverlay();

      const activeTab = getActiveAdminTab();
      await handleAdminTabActivated(activeTab);
    });

    adminGameList.appendChild(btn);
  });
}

/* ============================================================
 * TAB-HELPER
 * ============================================================ */

/**
 * Liefert den aktuell aktiven Admin-Tab.
 */
function getActiveAdminTab() {
  const activeTab = document.querySelector(".admin-tab.active");
  return activeTab?.dataset.tab || "dashboard";
}

/**
 * Aktiviert einen Admin-Tab programmatisch.
 * Wird z.B. genutzt, um aus dem Logs-Tab direkt in den Push-Tab zu wechseln.
 */
async function activateAdminTabByName(tabName) {
  if (!tabName) return false;

  const tab = document.querySelector(`.admin-tab[data-tab="${tabName}"]`);
  const content = document.getElementById(`tab-${tabName}`);

  if (!tab || !content) {
    console.warn("Admin-Tab nicht gefunden:", tabName);
    return false;
  }

  tabs.forEach(t => t.classList.remove("active"));
  tab.classList.add("active");

  contents.forEach(c => c.classList.remove("active"));
  content.classList.add("active");

  scrollAdminTabIntoView(tab);
  await handleAdminTabActivated(tabName);
  return true;
}

/**
 * Initialisiert oder aktualisiert den gewaehlten Tab.
 */
async function handleAdminTabActivated(tabName) {
  if (tabName === "dashboard") {
    if (typeof initializeAdminDashboardTab === "function") {
      await initializeAdminDashboardTab();
    }
    return;
  }

  if (tabName === "players") {
    if (typeof initializeAdminPlayersTab === "function") {
      await initializeAdminPlayersTab();
    }
    return;
  }

  if (tabName === "games") {
    if (typeof initializeAdminGamesTab === "function") {
      await initializeAdminGamesTab();
    }
    return;
  }

  if (tabName === "logs") {
    if (typeof initializeAdminLogsTab === "function") {
      await initializeAdminLogsTab();
    }
    return;
  }

  if (tabName === "live") {
    if (typeof initializeAdminLiveTab === "function") {
      await initializeAdminLiveTab();
    }
    return;
  }

  if (tabName === "grid") {
    if (typeof initializeAdminGalleryTab === "function") {
      await initializeAdminGalleryTab();
    }
    return;
  }

  if (tabName === "push") {
    if (typeof initializeAdminPushTab === "function") {
      await initializeAdminPushTab();
    } else {
      console.warn("initializeAdminPushTab nicht gefunden. Bitte admin_push.js vor admin.js laden.");
    }
    return;
  }
}

function scrollAdminTabIntoView(tab) {
  if (!tab) return;

  tab.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
    inline: "center"
  });
}

/* ============================================================
 * ADMIN POLLING
 * ============================================================ */

/**
 * Stoppt das globale Admin-Polling.
 * Der Funktionsname bleibt aus Kompatibilitaetsgruenden bestehen.
 */
function stopAdminPolling() {
  if (typeof PollingService === "undefined") return;
  PollingService.stopJob(ADMIN_POLLING_JOB_ID);
}

/**
 * Startet das globale Admin-Polling.
 *
 * Logik:
 * - Logs-Tab nutzt refreshAdminLogsListIfNeeded(), um Flackern zu vermeiden.
 * - Live-Tab prueft zuerst geplante Starts.
 * - Alle anderen Tabs werden ueber handleAdminTabActivated() neu geladen.
 */
function startAdminPolling() {
  stopAdminPolling();

  if (typeof PollingService === "undefined") {
    console.error("PollingService nicht gefunden. Bitte polling_service.js einbinden.");
    return;
  }

  PollingService.registerOrUpdateJob({
    id: ADMIN_POLLING_JOB_ID,
    level: "admin",
    description: "Adminpanel: aktiven Tab aktualisieren",
    runImmediately: false,
    callback: async () => {
      if (!adminPlayer) return;

      const activeTab = getActiveAdminTab();

      if (activeTab === "logs") {
        if (typeof refreshAdminLogsListIfNeeded === "function") {
          await refreshAdminLogsListIfNeeded();
        }
        return;
      }

      if (activeTab === "live") {
        let changed = false;

        if (typeof autoActivateScheduledLiveChallenges === "function") {
          changed = await autoActivateScheduledLiveChallenges();
        }

        if (changed || typeof initializeAdminLiveTab === "function") {
          await initializeAdminLiveTab();
        }

        return;
      }

      await handleAdminTabActivated(activeTab);
    }
  });

  PollingService.startJob(ADMIN_POLLING_JOB_ID);
}

/* ============================================================
 * TAB EVENTS
 * ============================================================ */

tabs.forEach(tab => {
  tab.addEventListener("click", async () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    contents.forEach(c => c.classList.remove("active"));

    const target = tab.dataset.tab;
    const content = document.getElementById(`tab-${target}`);

    if (content) {
      content.classList.add("active");
    }

    scrollAdminTabIntoView(tab);
    closeAdminUserMenu();

    await handleAdminTabActivated(target);
  });
});

/* ============================================================
 * ADMIN USER MENU
 * ============================================================ */

function openAdminUserMenu() {
  if (!adminUserMenu || !adminUserMenuBtn) return;

  adminUserMenu.classList.remove("hidden");
  adminUserMenuBtn.setAttribute("aria-expanded", "true");
}

function closeAdminUserMenu() {
  if (!adminUserMenu || !adminUserMenuBtn) return;

  adminUserMenu.classList.add("hidden");
  adminUserMenuBtn.setAttribute("aria-expanded", "false");
}

function toggleAdminUserMenu() {
  if (!adminUserMenu) return;

  const isOpen = !adminUserMenu.classList.contains("hidden");

  if (isOpen) {
    closeAdminUserMenu();
  } else {
    openAdminUserMenu();
  }
}

/* ============================================================
 * HEADER / GLOBAL EVENTS
 * ============================================================ */



if (adminLogoutBtn) {
  adminLogoutBtn.addEventListener("click", () => {
    closeAdminUserMenu();
    logoutAdmin();
  });
}

if (adminGoToGameBtn) {
  adminGoToGameBtn.addEventListener("click", () => {
    closeAdminUserMenu();

    localStorage.setItem(AUTH_FORCE_GAME_VIEW_KEY, "true");
    saveAuthPreferredView(AUTH_VIEW_GAME);
    window.location.href = "index.html";
  });
}

if (adminCurrentGameBtn) {
  adminCurrentGameBtn.addEventListener("click", async () => {
    await renderAdminGameList();
    openAdminGameSelectOverlay();
  });
}

if (closeAdminGameSelectBtn) {
  closeAdminGameSelectBtn.addEventListener("click", () => {
    closeAdminGameSelectOverlay();
  });
}

if (adminUserMenuBtn) {
  adminUserMenuBtn.addEventListener("click", event => {
    event.stopPropagation();
    toggleAdminUserMenu();
  });
}

if (adminUserMenu) {
  adminUserMenu.addEventListener("click", event => {
    event.stopPropagation();
  });
}

document.addEventListener("click", event => {
  if (!adminUserMenu || adminUserMenu.classList.contains("hidden")) {
    return;
  }

  const clickedInsideMenu = adminUserMenu.contains(event.target);
  const clickedMenuButton = adminUserMenuBtn?.contains(event.target);

  if (!clickedInsideMenu && !clickedMenuButton) {
    closeAdminUserMenu();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeAdminUserMenu();
  }
});

window.addEventListener("resize", updateAdminHeaderHeight);


/* ============================================================
 * GENERISCHE HELPER
 * ============================================================ */

/**
 * Formatiert ein ISO-Datum fuer Admin-Ansichten.
 */
function formatAdminDateTime(isoString) {
  if (!isoString) return "-";

  const date = new Date(isoString);
  const now = new Date();

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = nowOnly - dateOnly;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const timeString = date.toLocaleTimeString("de-AT", {
    hour: "2-digit",
    minute: "2-digit"
  });

  if (diffDays === 0) return `heute ${timeString}`;
  if (diffDays === 1) return `gestern ${timeString}`;
  if (diffDays === 2) return `vorgestern ${timeString}`;

  return date.toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/**
 * Formatiert einen Cooldown-Zeitpunkt lesbar.
 */
function formatAdminCooldown(cooldownUntil) {
  if (!cooldownUntil) return "Nein";

  const endMs = new Date(cooldownUntil).getTime();
  const diffSeconds = Math.ceil((endMs - Date.now()) / 1000);

  if (diffSeconds <= 0) return "Nein";

  if (diffSeconds >= 60) {
    const minutes = Math.ceil(diffSeconds / 60);
    return `${minutes} min`;
  }

  return `${diffSeconds} s`;
}

/**
 * Prueft, ob ein Cooldown-Zeitpunkt noch in der Zukunft liegt.
 */
function isCooldownActiveAdmin(cooldownUntil) {
  if (!cooldownUntil) return false;
  return new Date(cooldownUntil).getTime() > Date.now();
}

/**
 * Kuerzt lange Titel fuer kompakte Anzeigen.
 */
function shortenTitle(title, maxLength = 20) {
  if (!title) return "";

  return title.length > maxLength
    ? title.substring(0, maxLength) + "..."
    : title;
}

/**
 * Liefert die public URL fuer ein Beweisfoto.
 */
function getPublicImageUrl(path) {
  if (!path) return null;

  if (typeof DataService !== "undefined") {
    return DataService.storage.getProofPhotoPublicUrl(path);
  }

  const { data } = supabaseClient.storage
    .from("proof-photos")
    .getPublicUrl(path);

  return data?.publicUrl || null;
}

/* ============================================================
 * INIT
 * ============================================================ */

startAdminApp();