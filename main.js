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

function openLoginOverlay() {
  loginOverlay.classList.remove("hidden");
  showAuthChoiceView();
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
    const loaded = await loadGlobalChallengeStats();

    if (loaded) {
      renderGrid();
    }

    await renderLeaderboard();
  }, 1000);
}

// =======================
// APP-INHALT LADEN
// =======================

async function loadCurrentGameIntoApp() {
  stopGlobalStatsPolling();

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
  await renderLeaderboard();
  startGlobalStatsPolling();

  if (isCooldownActive()) {
    openCooldownModal();
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

      if (!player) {
        return;
      }

      closeLoginOverlay();
      resolve();
    }

    async function handleRegister() {
      const username = registerNameInput.value;
      const pin = registerPinInput.value;

      const player = await registerPlayer(username, pin);

      if (!player) {
        return;
      }

      closeLoginOverlay();
      resolve();
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
      if (event.key === "Enter") {
        handleLogin();
      }
    };

    loginPinInput.onkeydown = (event) => {
      if (event.key === "Enter") {
        handleLogin();
      }
    };

    registerNameInput.onkeydown = (event) => {
      if (event.key === "Enter") {
        handleRegister();
      }
    };

    registerPinInput.onkeydown = (event) => {
      if (event.key === "Enter") {
        handleRegister();
      }
    };
  });
}

// =======================
// APP START
// =======================

async function startApp() {
  console.log("App startet...");

  const savedPlayer = loadPlayerFromLocalStorage();

  if (savedPlayer) {
    currentPlayer = savedPlayer;
    console.log("Spieler aus Local Storage geladen:", currentPlayer.username);
  } else {
    await openAuthFlow();
  }

  await loadCurrentGameIntoApp();
}

// =======================
// EVENTS
// =======================

gameNameEl.addEventListener("click", async () => {
  await renderGameList();
  openGameSelectOverlay();
});

closeGameSelectBtn.addEventListener("click", () => {
  closeGameSelectOverlay();
});

// =======================
// START
// =======================

startApp();