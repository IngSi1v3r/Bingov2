// =======================
// LOGIN OVERLAY
// =======================

const loginOverlay = document.getElementById("loginOverlay");

const authChoiceView = document.getElementById("authChoiceView");
const loginView = document.getElementById("loginView");
const registerView = document.getElementById("registerView");

const showLoginBtn = document.getElementById("showLoginBtn");
const showRegisterBtn = document.getElementById("showRegisterBtn");

const loginNameInput = document.getElementById("loginNameInput");
const loginPinInput = document.getElementById("loginPinInput");
const doLoginBtn = document.getElementById("doLoginBtn");
const backToChoiceFromLoginBtn = document.getElementById("backToChoiceFromLoginBtn");

const registerNameInput = document.getElementById("registerNameInput");
const registerPinInput = document.getElementById("registerPinInput");
const doRegisterBtn = document.getElementById("doRegisterBtn");
const backToChoiceFromRegisterBtn = document.getElementById("backToChoiceFromRegisterBtn");

const welcomeOverlay = document.getElementById("welcomeOverlay");
const welcomeStartBtn = document.getElementById("welcomeStartBtn");

function openLoginOverlay() {
  loginOverlay.classList.remove("hidden");
  showAuthChoiceView();
  setRandomLoginTagline(); // 🔥
}

function closeLoginOverlay() {
  loginOverlay.classList.add("hidden");
}

function showAuthChoiceView() {
  authChoiceView.classList.remove("hidden");
  loginView.classList.add("hidden");
  registerView.classList.add("hidden");
}

function showLoginView() {
  authChoiceView.classList.add("hidden");
  loginView.classList.remove("hidden");
  registerView.classList.add("hidden");

  loginNameInput.value = "";
  loginPinInput.value = "";
  loginNameInput.focus();
}

function showRegisterView() {
  authChoiceView.classList.add("hidden");
  loginView.classList.add("hidden");
  registerView.classList.remove("hidden");

  registerNameInput.value = "";
  registerPinInput.value = "";
  registerNameInput.focus();
}

const loginTaglines = [
  "Heute wird eskaliert.",
  "Wer holt sich das erste Bingo?",
  "Ehre oder Untergang.",
  "Alles oder nichts.",
  "Bier in der einen, Punkte in der anderen Hand.",
  "Möge das Chaos beginnen.",
  "Freunde werden zu Rivalen.",
  "Nur einer wird dominieren.",
  "Level: Festival-Gott.",
  "Mal schauen, wer heute carried."
];

function setRandomLoginTagline() {
  const el = document.getElementById("loginTagline");
  if (!el) return;

  const randomIndex = Math.floor(Math.random() * loginTaglines.length);
  el.textContent = loginTaglines[randomIndex];
}


// =======================
// FIRST GAME START
// =======================


function openWelcomeOverlay() {
  if (!welcomeOverlay) return;
  welcomeOverlay.classList.remove("hidden");
}

function closeWelcomeOverlay() {
  if (!welcomeOverlay) return;
  welcomeOverlay.classList.add("hidden");
}

if (welcomeStartBtn) {
  welcomeStartBtn.addEventListener("click", () => {
    closeWelcomeOverlay();
  });
}





// =======================
// GAME SELECT OVERLAY
// =======================

const gameNameEl = document.getElementById("gameName");
const gameSelectOverlay = document.getElementById("gameSelectOverlay");
const gameList = document.getElementById("gameList");
const closeGameSelectBtn = document.getElementById("closeGameSelectBtn");

function openGameSelectOverlay() {
  gameSelectOverlay.classList.remove("hidden");
}

function closeGameSelectOverlay() {
  gameSelectOverlay.classList.add("hidden");
}

async function renderGameList() {
  const games = await loadAllGames();

  gameList.innerHTML = "";

  for (const game of games) {
    const btn = document.createElement("button");
    btn.textContent = `${game.name}${game.id === currentGameId ? " (aktiv)" : ""}`;

    btn.onclick = async () => {
      setCurrentGameId(game.id);
      closeGameSelectOverlay();
      await loadCurrentGameIntoApp();
    };

    gameList.appendChild(btn);
  }
}

// =======================
// GLOBALE STATS POLLING
// =======================

let globalStatsInterval = null;

function stopGlobalStatsPolling() {
  if (globalStatsInterval) {
    clearInterval(globalStatsInterval);
    globalStatsInterval = null;
  }
}

function startGlobalStatsPolling() {
  stopGlobalStatsPolling();

  globalStatsInterval = setInterval(async () => {
    if (!currentPlayer) return;

    const stillAllowed = await checkCurrentPlayerStillAllowed();
    if (!stillAllowed) return;

    const gameStillActive = await checkCurrentGameStillActive();
    if (!gameStillActive) return;

    await expireOverdueLiveChallenges();

    // Wichtig: Spiel + Challenges + eigener State live nachziehen
    const challengesLoaded = await loadChallengesFromDatabase();
    if (!challengesLoaded) return;

    const stateSynced = await syncPlayerStateFromDatabase();
    if (!stateSynced) return;

    const statsLoaded = await loadGlobalChallengeStats();
    if (!statsLoaded) return;

    renderGrid();
    await renderLeaderboard();
    await checkLiveChallengeStatus();
  }, 1000);
}

let inactiveGameHandled = false;

function handleInactiveCurrentGame(message = "Dieses Spiel wurde deaktiviert.") {
  if (inactiveGameHandled) return;
  inactiveGameHandled = true;

  console.log("Aktuelles Spiel ist nicht mehr aktiv:", message);

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
    console.warn("Fehler beim Schließen der Overlays:", err);
  }

  stopGlobalStatsPolling();

  if (typeof cooldownInterval !== "undefined" && cooldownInterval) {
    clearInterval(cooldownInterval);
    cooldownInterval = null;
  }

  alert(message);

  openGameSelectOverlay();
  renderGameList();
}

async function checkCurrentGameStillActive() {
  if (!currentPlayer || !currentGameId || inactiveGameHandled) return true;

  const freshGame = await loadCurrentGameFresh();

  if (!freshGame) {
    handleInactiveCurrentGame("Das aktuell geöffnete Spiel ist nicht mehr verfügbar.");
    return false;
  }

  if (freshGame.is_active !== true) {
    handleInactiveCurrentGame("Dieses Spiel wurde soeben deaktiviert. Bitte wähle ein anderes Spiel aus.");
    return false;
  }

  currentGame = freshGame;
  return true;
}

// =======================
// APP-INHALT LADEN
// =======================

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
  } else if (gameState.activeChallengeId !== null) {
    const activeChallenge = getChallengeByBoardId(gameState.activeChallengeId);

    if (activeChallenge) {
      openChallengeModal(activeChallenge);
    }
  }
}

// =======================
// AUTH FLOW
// =======================

async function openAuthFlow() {
  openLoginOverlay();

  return new Promise((resolve) => {
    async function handleLogin() {
      const username = loginNameInput.value;
      const pin = loginPinInput.value;

      const player = await loginPlayer(username, pin);

      if (!player) return;

      closeLoginOverlay();
      resolve({ mode: "login" });
    }

    async function handleRegister() {
      const username = registerNameInput.value;
      const pin = registerPinInput.value;

      const player = await registerPlayer(username, pin);

      if (!player) return;

      closeLoginOverlay();
      resolve({ mode: "register" });
    }

    showLoginBtn.onclick = () => {
      showLoginView();
    };

    showRegisterBtn.onclick = () => {
      showRegisterView();
    };

    backToChoiceFromLoginBtn.onclick = () => {
      showAuthChoiceView();
    };

    backToChoiceFromRegisterBtn.onclick = () => {
      showAuthChoiceView();
    };

    doLoginBtn.onclick = handleLogin;
    doRegisterBtn.onclick = handleRegister;

    loginNameInput.onkeydown = (event) => {
      if (event.key === "Enter") handleLogin();
    };

    loginPinInput.onkeydown = (event) => {
      if (event.key === "Enter") handleLogin();
    };

    registerNameInput.onkeydown = (event) => {
      if (event.key === "Enter") handleRegister();
    };

    registerPinInput.onkeydown = (event) => {
      if (event.key === "Enter") handleRegister();
    };
  });
}

// =======================
// APP START
// =======================

async function startApp() {
  console.log("App startet...");

  const savedPlayer = loadPlayerFromLocalStorage();
  let justRegistered = false;

  if (savedPlayer) {
    currentPlayer = savedPlayer;
    console.log("Spieler aus Local Storage geladen:", currentPlayer.username);
  } else {
    const authResult = await openAuthFlow();
    justRegistered = authResult?.mode === "register";
  }

  await loadCurrentGameIntoApp();

  if (justRegistered) {
    openWelcomeOverlay();
  }
}

// =======================
// EVENTS
// =======================

const gameSelectBtn = document.getElementById("gameSelectBtn");

if (gameSelectBtn) {
  gameSelectBtn.addEventListener("click", async () => {
    await renderGameList();
    openGameSelectOverlay();
  });
}

closeGameSelectBtn.addEventListener("click", () => {
  closeGameSelectOverlay();
});

// =======================
// START
// =======================

startApp();