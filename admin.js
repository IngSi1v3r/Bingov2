// =======================
// ADMIN CONSTANTS
// =======================

const ADMIN_STORAGE_KEY = "festival_bingo_admin";
const ADMIN_GAME_STORAGE_KEY = "festival_bingo_game_id";

// =======================
// ADMIN STATE
// =======================

let adminPlayer = null;
let adminCurrentGameId = loadGameIdFromLocalStorageAdmin();
let adminCurrentGame = null;

let selectedAdminPlayerId = null;

// Diese Collections werden von Tab-Dateien befüllt
let adminPlayers = [];
let adminGames = [];
let adminPlayerStates = [];
let adminPlayerChallenges = [];
let adminPlayerBingos = [];
let adminChallenges = [];

let currentAdminGalleryEntries = [];
let currentAdminGalleryIndex = 0;

let adminPollingInterval = null;

// =======================
// DOM
// =======================

const tabs = document.querySelectorAll(".admin-tab");
const contents = document.querySelectorAll(".admin-tab-content");
const adminRefreshBtn = document.getElementById("adminRefreshBtn");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");

const adminLoginOverlay = document.getElementById("adminLoginOverlay");
const adminLoginNameInput = document.getElementById("adminLoginNameInput");
const adminLoginPinInput = document.getElementById("adminLoginPinInput");
const adminDoLoginBtn = document.getElementById("adminDoLoginBtn");
const adminLoginStatusText = document.getElementById("adminLoginStatusText");

const adminCurrentGameBtn = document.getElementById("adminCurrentGameBtn");
const adminCurrentGameText = document.getElementById("adminCurrentGame");

const adminGameSelectOverlay = document.getElementById("adminGameSelectOverlay");
const closeAdminGameSelectBtn = document.getElementById("closeAdminGameSelectBtn");
const adminGameList = document.getElementById("adminGameList");

// =======================
// LOCAL STORAGE
// =======================

function saveAdminToLocalStorage(admin) {
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(admin));
}

function loadAdminFromLocalStorage() {
  const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("Fehler beim Lesen des Admins aus dem LocalStorage:", error);
    return null;
  }
}

function clearAdminFromLocalStorage() {
  localStorage.removeItem(ADMIN_STORAGE_KEY);
}

function saveGameIdToLocalStorageAdmin(gameId) {
  localStorage.setItem(ADMIN_GAME_STORAGE_KEY, String(gameId));
}

function loadGameIdFromLocalStorageAdmin() {
  const raw = localStorage.getItem(ADMIN_GAME_STORAGE_KEY);
  if (!raw) return 1;

  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : 1;
}

// =======================
// ADMIN LOGIN
// =======================

function openAdminLoginOverlay() {
  adminLoginOverlay.classList.remove("hidden");
  adminLoginStatusText.textContent = "";
  adminLoginNameInput.value = "";
  adminLoginPinInput.value = "";

  setTimeout(() => {
    adminLoginNameInput.focus();
  }, 0);
}

function closeAdminLoginOverlay() {
  adminLoginOverlay.classList.add("hidden");
}

async function loginAdmin(username, pin) {
  const cleanUsername = username.trim().toLowerCase();
  const cleanPin = pin.trim();

  if (!cleanUsername) {
    return { success: false, message: "Bitte einen Namen eingeben." };
  }

  if (!cleanPin) {
    return { success: false, message: "Bitte eine PIN eingeben." };
  }

  const { data: player, error } = await supabaseClient
    .from("players")
    .select("*")
    .eq("username", cleanUsername)
    .maybeSingle();

  if (error) {
    console.error("Fehler beim Laden des Admins:", error);
    return { success: false, message: "Admin konnte nicht geladen werden." };
  }

  if (!player) {
    return { success: false, message: "Benutzer nicht gefunden." };
  }

  if (player.pin_hash !== cleanPin) {
    return { success: false, message: "Falsche PIN." };
  }

  if (player.is_blocked) {
    return { success: false, message: "Dieser Benutzer ist gesperrt." };
  }

  if (player.role !== "admin") {
    return { success: false, message: "Dieser Benutzer ist kein Admin." };
  }

  return { success: true, admin: player };
}

async function handleAdminLogin() {
  const username = adminLoginNameInput.value;
  const pin = adminLoginPinInput.value;

  adminLoginStatusText.textContent = "Prüfe Login...";

  const result = await loginAdmin(username, pin);

  if (!result.success) {
    adminLoginStatusText.textContent = result.message;
    return;
  }

  adminPlayer = result.admin;
  saveAdminToLocalStorage(adminPlayer);

  closeAdminLoginOverlay();
  await startAdminPanelAfterLogin();
}

function logoutAdmin() {
  stopAdminPolling();
  clearAdminFromLocalStorage();
  adminPlayer = null;
  selectedAdminPlayerId = null;
  openAdminLoginOverlay();
}

// =======================
// START
// =======================

async function startAdminApp() {
  const savedAdmin = loadAdminFromLocalStorage();

  if (!savedAdmin || savedAdmin.role !== "admin") {
    openAdminLoginOverlay();
    return;
  }

  adminPlayer = savedAdmin;
  await startAdminPanelAfterLogin();
}

async function startAdminPanelAfterLogin() {
  renderAdminHeader();
  await loadAdminCurrentGame();

  const activeTab = getActiveAdminTab();
  await handleAdminTabActivated(activeTab);

  startAdminPolling();
}

// =======================
// HEADER
// =======================

function renderAdminHeader() {
  const nameEl = document.getElementById("adminName");
  if (nameEl && adminPlayer) {
    nameEl.textContent = adminPlayer.display_name || adminPlayer.username || "-";
  }
}

async function loadAdminCurrentGame() {
  const { data, error } = await supabaseClient
    .from("games")
    .select("*")
    .eq("id", adminCurrentGameId)
    .maybeSingle();

  if (error) {
    console.error("Fehler beim Laden des aktuellen Admin-Spiels:", error);
    adminCurrentGame = null;
  } else {
    adminCurrentGame = data || null;
  }

  if (!adminCurrentGame) {
    const { data: fallbackGame, error: fallbackError } = await supabaseClient
      .from("games")
      .select("*")
      .eq("is_active", true)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fallbackError) {
      console.error("Fehler beim Laden des Fallback-Spiels:", fallbackError);
    }

    adminCurrentGame = fallbackGame || null;

    if (adminCurrentGame) {
      adminCurrentGameId = adminCurrentGame.id;
      saveGameIdToLocalStorageAdmin(adminCurrentGameId);
    }
  }

  updateAdminCurrentGameDisplay();
}

function updateAdminCurrentGameDisplay() {
  if (adminCurrentGameText) {
    adminCurrentGameText.textContent = adminCurrentGame?.name || "-";
  }
}

// =======================
// GLOBAL GAME SELECTION
// =======================

function openAdminGameSelectOverlay() {
  if (!adminGameSelectOverlay) return;
  adminGameSelectOverlay.classList.remove("hidden");
}

function closeAdminGameSelectOverlay() {
  if (!adminGameSelectOverlay) return;
  adminGameSelectOverlay.classList.add("hidden");
}

async function loadAllGamesForHeader() {
  const { data, error } = await supabaseClient
    .from("games")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden der Spiele für die Admin-Auswahl:", error);
    return [];
  }

  return data || [];
}

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

// =======================
// TAB HELPERS
// =======================

function getActiveAdminTab() {
  const activeTab = document.querySelector(".admin-tab.active");
  return activeTab?.dataset.tab || "dashboard";
}

async function handleAdminTabActivated(tabName) {
  if (tabName === "players") {
    if (typeof initializeAdminPlayersTab === "function") {
      await initializeAdminPlayersTab();
    }
  }

  if (tabName === "games") {
    if (typeof initializeAdminGamesTab === "function") {
      await initializeAdminGamesTab();
    }
  }

  if (tabName === "logs") {
    if (typeof initializeAdminLogsTab === "function") {
      await initializeAdminLogsTab();
    }
  }

  if (tabName === "live") {
    if (typeof initializeAdminLiveTab === "function") {
      await initializeAdminLiveTab();
    }
  }

  if (tabName === "grid") {
    if (typeof initializeAdminGalleryTab === "function") {
      await initializeAdminGalleryTab();
    }
  }

}

// =======================
// ADMIN POLLING
// =======================

function stopAdminPolling() {
  if (adminPollingInterval) {
    clearInterval(adminPollingInterval);
    adminPollingInterval = null;
  }
}

function startAdminPolling() {
  stopAdminPolling();

  adminPollingInterval = setInterval(async () => {
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
  }, 5000);
}

// =======================
// TABS
// =======================

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

    await handleAdminTabActivated(target);
  });
});

// =======================
// EVENTS
// =======================

if (adminRefreshBtn) {
  adminRefreshBtn.addEventListener("click", async () => {
    await loadAdminCurrentGame();

    const activeTab = getActiveAdminTab();
    await handleAdminTabActivated(activeTab);
  });
}

if (adminLogoutBtn) {
  adminLogoutBtn.addEventListener("click", () => {
    logoutAdmin();
  });
}

if (adminDoLoginBtn) {
  adminDoLoginBtn.addEventListener("click", async () => {
    await handleAdminLogin();
  });
}

if (adminLoginNameInput) {
  adminLoginNameInput.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      await handleAdminLogin();
    }
  });
}

if (adminLoginPinInput) {
  adminLoginPinInput.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      await handleAdminLogin();
    }
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

// =======================
// GENERIC HELPERS
// =======================

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

function isCooldownActiveAdmin(cooldownUntil) {
  if (!cooldownUntil) return false;
  return new Date(cooldownUntil).getTime() > Date.now();
}

function shortenTitle(title, maxLength = 20) {
  if (!title) return "";
  return title.length > maxLength
    ? title.substring(0, maxLength) + "…"
    : title;
}

function getPublicImageUrl(path) {
  if (!path) return null;

  const { data } = supabaseClient.storage
    .from("proof-photos")
    .getPublicUrl(path);

  return data?.publicUrl || null;
}

// =======================
// START
// =======================

startAdminApp();