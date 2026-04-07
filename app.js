// =======================
// DOM ELEMENTE
// =======================

const grid = document.getElementById("grid");
const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const modalTask = document.getElementById("modalTask");
const modalPoints = document.getElementById("modalPoints");
const modalActions = document.querySelector(".modal-actions");
const scoreDisplay = document.getElementById("scoreDisplay");
const bingoBanner = document.getElementById("bingoBanner");
const playerDisplay = document.getElementById("playerDisplay");
const logoutBtn = document.getElementById("logoutBtn");
const firstSolverBanner = document.getElementById("firstSolverBanner");
const leaderboardList = document.getElementById("leaderboardList");
const rulesBtn = document.getElementById("rulesBtn");
const rulesOverlay = document.getElementById("rulesOverlay");
const closeRulesBtn = document.getElementById("closeRulesBtn");
const detailsOverlay = document.getElementById("detailsOverlay");
const detailsContent = document.getElementById("detailsContent");
const closeDetailsBtn = document.getElementById("closeDetailsBtn");
const uploadOverlay = document.getElementById("uploadOverlay");
const uploadChallengeTitle = document.getElementById("uploadChallengeTitle");
const uploadPhotoInput = document.getElementById("uploadPhotoInput");
const uploadStatusText = document.getElementById("uploadStatusText");
const doUploadBtn = document.getElementById("doUploadBtn");
const cancelUploadBtn = document.getElementById("cancelUploadBtn");
const photoViewerOverlay = document.getElementById("photoViewerOverlay");
const photoViewerTitle = document.getElementById("photoViewerTitle");
const photoViewerContent = document.getElementById("photoViewerContent");
const closePhotoViewerBtn = document.getElementById("closePhotoViewerBtn");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const uploadPreviewContainer = document.getElementById("uploadPreviewContainer");
const uploadPreviewImage = document.getElementById("uploadPreviewImage");
const closeFinalBtn = document.getElementById("closeFinalBtn");
const finalOverlay = document.getElementById("finalOverlay");
const finalScoreText = document.getElementById("finalScoreText");
const playerProfileOverlay = document.getElementById("playerProfileOverlay");
const playerProfileName = document.getElementById("playerProfileName");
const playerProfileStats = document.getElementById("playerProfileStats");
const playerProfileGallery = document.getElementById("playerProfileGallery");
const closePlayerProfileBtn = document.getElementById("closePlayerProfileBtn");
const playerProfileCompletedList = document.getElementById("playerProfileCompletedList");
const playerProfileLogoutBtn = document.getElementById("playerProfileLogoutBtn");
const resetProgressBtn = document.getElementById("resetProgressBtn");
const deletePlayerBtn = document.getElementById("deletePlayerBtn");
const failConfirmOverlay = document.getElementById("failConfirmOverlay");
const failConfirmText = document.getElementById("failConfirmText");
const cancelFailBtn = document.getElementById("cancelFailBtn");
const confirmFailBtn = document.getElementById("confirmFailBtn");
const cooldownDisplay = document.getElementById("cooldownDisplay");
const cooldownTimerText = document.getElementById("cooldownTimerText");
const scoreValue = document.getElementById("scoreValue");

// =======================
// Globale Variablen
// =======================

let pendingUploadChallenge = null;

let currentCompletionGallery = [];
let currentGalleryIndex = 0;

let currentPlayerProfileGallery = [];
let currentPlayerProfileGalleryIndex = 0;

let displayedScore = 0;
let freezeScoreDisplay = false;

// =======================
// MODAL FUNKTIONEN
// =======================

function lockBodyScroll() {
  document.body.style.overflow = "hidden";
}

function unlockBodyScroll() {
  document.body.style.overflow = "";
}

function formatCompletedDateTime(isoString) {
  if (!isoString) return "-";

  const date = new Date(isoString);
  const now = new Date();

  // Nur Datum (ohne Uhrzeit) vergleichen
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = nowOnly - dateOnly;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const timeString = date.toLocaleTimeString("de-AT", {
    hour: "2-digit",
    minute: "2-digit"
  });

  if (diffDays === 0) {
    return `heute ${timeString}`;
  }

  if (diffDays === 1) {
    return `gestern ${timeString}`;
  }

  if (diffDays === 2) {
    return `vorgestern ${timeString}`;
  }

  // fallback: volles Datum
  return date.toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function openChallengeModal(challenge) {
  modalCloseBtn.classList.add("hidden");

  modalTitle.innerHTML = `
    ${challenge.title}
    ${challenge.requiresPhotoProof ? '<span class="photo-required-icon">📷</span>' : ''}
  `;

  modalTask.textContent = challenge.task;
  modalPoints.textContent = `Punkte: ${challenge.points}`;

  const hasDetails = challenge.details && challenge.details.trim() !== "";

  modalActions.innerHTML = `
    ${hasDetails ? `<button id="detailsBtn">Hinweise</button>` : ""}
    <button id="completeBtn">
      ${challenge.requiresPhotoProof ? "Foto hochladen" : "Bestanden"}
    </button>
    <button id="failBtn">Aufgeben</button>
  `;

  if (hasDetails) {
    document.getElementById("detailsBtn").onclick = () => {
      openDetailsModal(challenge.details);
    };
  }

  document.getElementById("completeBtn").onclick = async () => {
    if (challenge.requiresPhotoProof) {
      closeModal();
      openUploadModal(challenge);
      return;
    }

    await completeChallenge(challenge.boardId);
  };

    document.getElementById("failBtn").onclick = () => {
    openFailConfirmModal();
  };

  lockBodyScroll();
  modalOverlay.classList.remove("hidden");
}

function renderCompletionGallery() {
  const galleryContainer = document.getElementById("completionGallery");

  if (!galleryContainer) return;

  if (!currentCompletionGallery.length) {
    galleryContainer.innerHTML = "";
    return;
  }

  const entry = currentCompletionGallery[currentGalleryIndex];

  const { data } = supabaseClient.storage
    .from("proof-photos")
    .getPublicUrl(entry.proofImagePath);

  const imageUrl = data.publicUrl;

  galleryContainer.innerHTML = `
    <div class="gallery-wrapper gallery-fade-in">
      <p class="gallery-caption">
        <strong>Foto von:</strong> ${entry.username}
        <span class="gallery-time">(${formatCompletedDateTime(entry.completedAt)})</span>
      </p>

      <div class="gallery-image-container">
        ${currentGalleryIndex > 0 ? `<div class="gallery-arrow left" id="prevGalleryBtn">‹</div>` : ""}
        <img src="${imageUrl}" class="gallery-image" />
        ${currentGalleryIndex < currentCompletionGallery.length - 1 ? `<div class="gallery-arrow right" id="nextGalleryBtn">›</div>` : ""}
      </div>
    </div>
  `;

  const prevBtn = document.getElementById("prevGalleryBtn");
  const nextBtn = document.getElementById("nextGalleryBtn");

  if (prevBtn) {
    prevBtn.onclick = () => {
      if (currentGalleryIndex > 0) {
        currentGalleryIndex--;
        renderCompletionGallery();
      }
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      if (currentGalleryIndex < currentCompletionGallery.length - 1) {
        currentGalleryIndex++;
        renderCompletionGallery();
      }
    };
  }
}

function setGalleryToPlayer(playerId) {
  const index = currentCompletionGallery.findIndex(entry => entry.playerId === playerId);

  if (index >= 0) {
    currentGalleryIndex = index;
    renderCompletionGallery();
  }
}

async function openCompletedChallengeModal(challenge) {

    modalCloseBtn.classList.remove("hidden");

  modalTitle.textContent = challenge.title;

  const completions = await loadChallengeCompletions(challenge.dbId);

  const galleryEntries = completions.filter(entry => entry.proofImagePath);

  currentCompletionGallery = galleryEntries;
  currentGalleryIndex = 0;

  if (currentCompletionGallery.length > 0 && currentPlayer) {
    const ownIndex = currentCompletionGallery.findIndex(
      entry => entry.playerId === currentPlayer.id
    );

    if (ownIndex >= 0) {
      currentGalleryIndex = ownIndex;
    }
  }

  let completionsHtml = `
    <div id="completionGallery"></div>

    <div class="completion-list">
      <h3>Bereits gelöst von</h3>
  `;

  if (completions.length === 0) {
    completionsHtml += `<p>Noch niemand.</p>`;
  } else {
    completions.forEach((entry, index) => {
      const isCurrentPlayer = currentPlayer && entry.playerId === currentPlayer.id;
      const isClickable = !!entry.proofImagePath;

      completionsHtml += `
        <div class="completion-row ${isCurrentPlayer ? "current-player" : ""}">
          <div 
            class="completion-name ${isClickable ? "clickable" : ""}"
            data-player-id="${entry.playerId}"
          >
            ${index + 1}. ${entry.username}${index === 0 ? `<span class="completion-star">⭐</span>` : ""}
          </div>
          <div class="completion-time">
            ${formatCompletedDateTime(entry.completedAt)}
          </div>
        </div>
      `;
    });
  }

  completionsHtml += `</div>`;

  let successHtml = "";

if (challenge.successText && challenge.successText.trim() !== "") {
  successHtml = `
    <div class="success-text">
      ${challenge.successText}
    </div>
  `;
}

modalTask.innerHTML = `
  <p>${challenge.task}</p>
  <p><strong>Punkte:</strong> ${challenge.points}</p>
  ${successHtml}
  ${completionsHtml}
`;

  modalPoints.textContent = "";

  modalActions.innerHTML = `
    <button id="resetChallengeBtn" class="secondary-btn">Challenge zurücksetzen</button>
  `;

  document.getElementById("resetChallengeBtn").onclick = async () => {
    await resetCompletedChallenge(challenge.boardId);
  };

  const clickableNames = modalTask.querySelectorAll(".completion-name.clickable");

  clickableNames.forEach(el => {
    el.addEventListener("click", () => {
      const playerId = Number(el.dataset.playerId);
      setGalleryToPlayer(playerId);
    });
  });

  lockBodyScroll();
  modalOverlay.classList.remove("hidden");
  renderCompletionGallery();
}



function openCooldownModal() {

    modalCloseBtn.classList.add("hidden");

  modalTitle.textContent = "Cooldown aktiv";
  modalTask.innerHTML = `
    <div class="timer-box">
      <div class="timer-label">Bitte warten...</div>
      <div id="timerNumber" class="timer-number">${formatCooldownTime(getRemainingCooldownSeconds())}</div>
      <div class="timer-label">Sekunden bis zur nächsten Aufgabe</div>
    </div>
  `;
  modalPoints.textContent = "";

  modalActions.innerHTML = "";
  lockBodyScroll();
  modalOverlay.classList.remove("hidden");
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  modalCloseBtn.classList.add("hidden");
  unlockBodyScroll();
}

function openRulesModal() {
    modalCloseBtn.classList.remove("hidden");
  rulesOverlay.classList.remove("hidden");
}

function closeRulesModal() {
  rulesOverlay.classList.add("hidden");
}

function openDetailsModal(text) {
  detailsContent.innerHTML = `<p>${text}</p>`;
  detailsOverlay.classList.remove("hidden");
}

function closeDetailsModal() {
  detailsOverlay.classList.add("hidden");
}





function openUploadModal(challenge) {
  pendingUploadChallenge = challenge;

  uploadChallengeTitle.innerHTML = `<strong>Aufgabe:</strong> ${challenge.title}`;
  uploadPhotoInput.value = "";
  uploadStatusText.textContent = "";
  doUploadBtn.textContent = "Hochladen";
  setUploadButtonsDisabled(false);
  resetUploadPreview();

  lockBodyScroll();
  uploadOverlay.classList.remove("hidden");
}

function closeUploadModal() {
  uploadOverlay.classList.add("hidden");
  pendingUploadChallenge = null;
  uploadPhotoInput.value = "";
  uploadStatusText.textContent = "";
  doUploadBtn.textContent = "Hochladen";
  setUploadButtonsDisabled(false);
  resetUploadPreview();
  unlockBodyScroll();
}

function resetUploadPreview() {
  uploadPreviewImage.src = "";
  uploadPreviewContainer.classList.add("hidden");
}

function setUploadButtonsDisabled(disabled) {
  doUploadBtn.disabled = disabled;
  cancelUploadBtn.disabled = disabled;
}

async function openPlayerProfileModal() {
  if (!currentPlayer) return;

  playerProfileName.innerHTML = `<strong>Spieler:</strong> ${currentPlayer.username}`;

  const completedRows = await loadCompletedChallengesForCurrentPlayer(currentPlayer.id);

  currentPlayerProfileGallery = completedRows
    .filter(row => row.proof_image_path)
    .map(row => {
      const challenge = getChallengeByDbId(row.challenge_id);
      return challenge
        ? {
            challengeId: row.challenge_id,
            challengeTitle: challenge.title,
            completedAt: row.completed_at,
            proofImagePath: row.proof_image_path,
            wasFirstSolver: row.was_first_solver,
            pointsAwarded: row.points_awarded
          }
        : null;
    })
    .filter(Boolean);

  const logoutBtn = document.getElementById("playerProfileLogoutBtn");

    if (logoutBtn) {
    logoutBtn.onclick = () => {
    closePlayerProfileModal();
    logoutPlayer();
    };
    }

  currentPlayerProfileGalleryIndex = 0;

  // 👉 jetzt erst Stats (weil Bilderanzahl gebraucht wird)
  await renderPlayerProfileStats();

  renderPlayerProfileGallery();
  await renderPlayerProfileCompletedList();

  lockBodyScroll();
  playerProfileOverlay.classList.remove("hidden");
}

function closePlayerProfileModal() {
  playerProfileOverlay.classList.add("hidden");
  unlockBodyScroll();
}


function formatCooldownMinutesText(seconds) {
  const minutes = Math.ceil(seconds / 60);

  if (minutes === 1) {
    return "1 Minute";
  }

  return `${minutes} Minuten`;
}



// =======================
// BESTÄTIGUNG AUFGEBEN
// =======================


function openFailConfirmModal() {
  const cooldownSeconds = currentGame?.cooldown_seconds ?? 0;
  const cooldownText = formatCooldownMinutesText(cooldownSeconds);

  failConfirmText.innerHTML = `
    Bist du sicher, dass du diese Challenge aufgeben willst?<br><br>
    <strong>Achtung:</strong> Danach bist du für <strong>${cooldownText}</strong> für neue Aufgaben gesperrt.<br>
    Du kannst diese Challenge später erneut versuchen.
  `;

  failConfirmOverlay.classList.remove("hidden");
  lockBodyScroll();
}

function closeFailConfirmModal() {
  failConfirmOverlay.classList.add("hidden");
}

function updateCooldownDisplay() {
  if (!cooldownDisplay || !cooldownTimerText) return;

  if (isCooldownActive()) {
    cooldownDisplay.classList.remove("hidden");
    cooldownTimerText.textContent = formatCooldownTime(getRemainingCooldownSeconds());
  } else {
    cooldownDisplay.classList.add("hidden");
    cooldownTimerText.textContent = "00:00";
  }
}




// =======================
// Animationen
// =======================

function showBingoAnimation() {
  return new Promise((resolve) => {
    bingoBanner.classList.remove("hidden");
    bingoBanner.classList.add("show");

    setTimeout(() => {
      bingoBanner.classList.remove("show");
      bingoBanner.classList.add("hidden");
      resolve();
    }, 2300);
  });
}

function showFirstSolverAnimation() {
  return new Promise((resolve) => {
    firstSolverBanner.classList.remove("hidden");
    firstSolverBanner.classList.add("show");

    setTimeout(() => {
      firstSolverBanner.classList.remove("show");
      firstSolverBanner.classList.add("hidden");
      resolve();
    }, 2300);
  });
}

function animateScoreDisplay(newScore) {
  return new Promise((resolve) => {
    const animationDuration = 1100;
    const updateDelay = 420;

    if (scoreValue) {
      scoreValue.classList.remove("score-pop");
      void scoreValue.offsetWidth;
      scoreValue.classList.add("score-pop");

      setTimeout(() => {
        displayedScore = newScore;
        setScoreDisplay(displayedScore);
      }, updateDelay);

      setTimeout(() => {
        scoreValue.classList.remove("score-pop");
        resolve();
      }, animationDuration);
    } else {
      scoreDisplay.classList.remove("score-pop");
      void scoreDisplay.offsetWidth;
      scoreDisplay.classList.add("score-pop");

      setTimeout(() => {
        displayedScore = newScore;
        setScoreDisplay(displayedScore);
      }, updateDelay);

      setTimeout(() => {
        scoreDisplay.classList.remove("score-pop");
        resolve();
      }, animationDuration);
    }
  });
}

function showPointsPopup(boardId, awardedPoints) {
  return new Promise((resolve) => {
    const cell = document.querySelector(`.cell[data-board-id="${boardId}"]`);

    if (!cell) {
      resolve();
      return;
    }

    const popup = document.createElement("div");
    popup.className = "cell-points-popup";
    popup.textContent = `+${awardedPoints}P`;

    cell.appendChild(popup);

    setTimeout(() => {
      popup.remove();
      resolve();
    }, 3000);
  });
}

function setScoreDisplay(value) {
  if (scoreValue) {
    scoreValue.textContent = value;
  } else {
    scoreDisplay.textContent = `Score: ${value}`;
  }
}

// =======================
// Leaderboard
// =======================


async function renderLeaderboard() {
  if (!leaderboardList) return;

  const leaderboard = await loadLeaderboard();
  const now = Date.now();

  leaderboardList.innerHTML = "";

  if (leaderboard.length === 0) {
    leaderboardList.innerHTML = `
      <div class="leaderboard-row">
        <div class="leaderboard-rank">-</div>
        <div class="leaderboard-name">Noch keine Spieler</div>
        <div class="leaderboard-score">0</div>
      </div>
    `;
    return;
  }

  leaderboard.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className = "leaderboard-row";

    const isCurrentPlayer = currentPlayer && entry.playerId === currentPlayer.id;
    const isCooldownActive = entry.cooldownUntil && entry.cooldownUntil > now;
    const isActive = !isCooldownActive && entry.activeChallengeId !== null;

    if (isCurrentPlayer) {
      row.classList.add("current-player");
    }

    if (isActive) {
      row.classList.add("player-active");
    }

    if (isCooldownActive) {
      row.classList.add("player-cooldown");
    }

    let nameText = entry.username;

    if (isCooldownActive) {
      const remainingSeconds = Math.max(
        0,
        Math.ceil((entry.cooldownUntil - now) / 1000)
      );
      nameText += ` (${formatCooldownTime(remainingSeconds)})`;
    }

    row.innerHTML = `
      <div class="leaderboard-rank">#${index + 1}</div>
      <div class="leaderboard-name">${nameText}</div>
      <div class="leaderboard-score">${entry.score}</div>
    `;

    leaderboardList.appendChild(row);
  });
}

// =======================
// Statistik
// =======================

async function renderPlayerProfileStats() {
  const completedCount = gameState.completed.length;
  const totalCount = challenges.length;
  const firstSolverCount = gameState.firstSolved.length;
  const bingoCount = gameState.bingos.length;
  const score = gameState.score;

  // Bilder
  const imageCount = currentPlayerProfileGallery.length;

  // Rang berechnen
  let rankText = "-";

  try {
    const leaderboard = await loadLeaderboard();

    const index = leaderboard.findIndex(
      entry => entry.playerId === currentPlayer.id
    );

    if (index >= 0) {
      rankText = `${index + 1} / ${leaderboard.length}`;
    }
  } catch (err) {
    console.error("Fehler beim Laden des Leaderboards:", err);
  }

  playerProfileStats.innerHTML = `
    <div class="profile-stats-grid">
      <div class="profile-stat-card">
        <div class="profile-stat-label">Punkte</div>
        <div class="profile-stat-value">${score}</div>
      </div>

      <div class="profile-stat-card">
        <div class="profile-stat-label">Aufgaben</div>
        <div class="profile-stat-value">${completedCount} / ${totalCount}</div>
      </div>

      <div class="profile-stat-card">
        <div class="profile-stat-label">First Solver</div>
        <div class="profile-stat-value">${firstSolverCount}</div>
      </div>

      <div class="profile-stat-card">
        <div class="profile-stat-label">Bingos</div>
        <div class="profile-stat-value">${bingoCount}</div>
      </div>

      <div class="profile-stat-card">
        <div class="profile-stat-label">Bilder</div>
        <div class="profile-stat-value">${imageCount}</div>
      </div>

      <div class="profile-stat-card">
        <div class="profile-stat-label">Rang</div>
        <div class="profile-stat-value">${rankText}</div>
      </div>
    </div>
  `;
}


async function loadCompletedChallengesForCurrentPlayer(playerId) {
  const { data, error } = await supabaseClient
    .from("player_challenges")
    .select("challenge_id, completed_at, was_first_solver, points_awarded, proof_image_path")
    .eq("player_id", playerId)
    .eq("game_id", currentGameId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });

  if (error) {
    console.error("Fehler beim Laden der abgeschlossenen Aufgaben:", error);
    return [];
  }

  return data || [];
}

function renderPlayerProfileGallery() {
  if (!playerProfileGallery) return;

  if (!currentPlayerProfileGallery.length) {
    playerProfileGallery.innerHTML = `<p>Noch keine Bilder vorhanden.</p>`;
    return;
  }

  const entry = currentPlayerProfileGallery[currentPlayerProfileGalleryIndex];

  const { data } = supabaseClient.storage
    .from("proof-photos")
    .getPublicUrl(entry.proofImagePath);

  const imageUrl = data.publicUrl;

  playerProfileGallery.innerHTML = `
    <div class="gallery-wrapper gallery-fade-in">
      <p class="gallery-caption">
        <strong>${entry.challengeTitle}</strong>, ${formatCompletedDateTime(entry.completedAt)}
      </p>

      <div class="gallery-image-container">
        ${currentPlayerProfileGalleryIndex > 0 ? `<div class="gallery-arrow left" id="prevPlayerProfileGalleryBtn">‹</div>` : ""}
        <img src="${imageUrl}" class="gallery-image" />
        ${currentPlayerProfileGalleryIndex < currentPlayerProfileGallery.length - 1 ? `<div class="gallery-arrow right" id="nextPlayerProfileGalleryBtn">›</div>` : ""}
      </div>
    </div>
  `;

  const prevBtn = document.getElementById("prevPlayerProfileGalleryBtn");
  const nextBtn = document.getElementById("nextPlayerProfileGalleryBtn");

  if (prevBtn) {
    prevBtn.onclick = () => {
      if (currentPlayerProfileGalleryIndex > 0) {
        currentPlayerProfileGalleryIndex--;
        renderPlayerProfileGallery();
      }
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      if (currentPlayerProfileGalleryIndex < currentPlayerProfileGallery.length - 1) {
        currentPlayerProfileGalleryIndex++;
        renderPlayerProfileGallery();
      }
    };
  }
}

function setPlayerProfileGalleryToChallenge(challengeId) {
  const index = currentPlayerProfileGallery.findIndex(
    entry => entry.challengeId === challengeId
  );

  if (index >= 0) {
    currentPlayerProfileGalleryIndex = index;
    renderPlayerProfileGallery();
  }
}

async function renderPlayerProfileCompletedList() {
  if (!currentPlayer) return;

  const completedRows = await loadCompletedChallengesForCurrentPlayer(currentPlayer.id);

  if (!completedRows.length) {
    playerProfileCompletedList.innerHTML = `<p>Noch keine Aufgaben abgeschlossen.</p>`;
    return;
  }

  let html = `<div class="completion-list">`;

  completedRows.forEach((row, index) => {
    const challenge = getChallengeByDbId(row.challenge_id);
    if (!challenge) return;

    const isClickable = !!row.proof_image_path;

    html += `
      <div class="completion-row">
        <div 
          class="completion-name ${isClickable ? "clickable" : ""}"
          data-challenge-id="${row.challenge_id}"
        >
          ${index + 1}. ${challenge.title}, ${formatCompletedDateTime(row.completed_at)}
          ${row.was_first_solver ? `<span class="completion-star">⭐</span>` : ""}
        </div>

        <div class="completion-points">
          ${row.points_awarded}P
        </div>
      </div>
    `;
  });

  html += `</div>`;

  playerProfileCompletedList.innerHTML = html;

  const clickableEntries = playerProfileCompletedList.querySelectorAll(".completion-name.clickable");

  clickableEntries.forEach(el => {
    el.addEventListener("click", () => {
      const challengeId = Number(el.dataset.challengeId);
      if (!challengeId) return;

      setPlayerProfileGalleryToChallenge(challengeId);
    });
  });
}

// =======================
// ZURÜCKSETZEN UND LÖSCHEN
// =======================



async function resetAllCompletedChallengesForPlayer(playerId) {
  const { error } = await supabaseClient
    .from("player_challenges")
    .update({
      status: "hidden",
      completed_at: null,
      was_first_solver: false,
      points_awarded: null,
      proof_image_path: null
    })
    .eq("player_id", playerId)
    .eq("game_id", currentGameId)
    .eq("status", "completed");

  if (error) {
    console.error("Fehler beim Zurücksetzen aller Challenges:", error);
    return false;
  }

  return true;
}


async function deleteAllPlayerBingos(playerId) {
  const { error } = await supabaseClient
    .from("player_bingos")
    .delete()
    .eq("player_id", playerId)
    .eq("game_id", currentGameId);

  if (error) {
    console.error("Fehler beim Löschen der Bingos:", error);
    return false;
  }

  return true;
}

async function resetCurrentGameProgress() {
  if (!currentPlayer) return;

  const confirmed = confirm(
    "Willst du wirklich deinen gesamten Fortschritt in diesem Spiel zurücksetzen?"
  );

  if (!confirmed) return;

  const playerId = currentPlayer.id;

  const resetChallengesOk = await resetAllCompletedChallengesForPlayer(playerId);
  if (!resetChallengesOk) {
    alert("Die abgeschlossenen Aufgaben konnten nicht zurückgesetzt werden.");
    return;
  }

  const deleteBingosOk = await deleteAllPlayerBingos(playerId);
  if (!deleteBingosOk) {
    alert("Die Bingos konnten nicht zurückgesetzt werden.");
    return;
  }

  const updateStateOk = await updatePlayerGameState(playerId, {
    score: 0,
    active_challenge_id: null,
    cooldown_until: null
  });

  if (!updateStateOk) {
    alert("Der Spielstand konnte nicht aktualisiert werden.");
    return;
  }

  // Lokalen State zurücksetzen
  gameState.score = 0;
  gameState.completed = [];
  gameState.firstSolved = [];
  gameState.activeChallengeId = null;
  gameState.cooldownUntil = null;
  gameState.bingos = [];
  gameState.bingoCells = [];

  await loadGlobalChallengeStats();
  await renderLeaderboard();
  renderGrid();

  // Profilansicht neu aufbauen, damit Stats/Liste/Galerie sofort stimmen
  await renderPlayerProfileStats();
renderPlayerProfileGallery();
await renderPlayerProfileCompletedList();
}

async function deleteCurrentPlayerProfile() {
  if (!currentPlayer) return;

  const confirmed = confirm(
    "ACHTUNG!\n\nDein gesamtes Profil wird gelöscht.\nAlle Fortschritte in ALLEN Spielen gehen verloren.\n\nDiese Aktion kann NICHT rückgängig gemacht werden.\n\nWirklich löschen?"
  );

  if (!confirmed) return;

  const playerId = currentPlayer.id;

  const success = await deletePlayerProfile(playerId);

  if (!success) {
    alert("Profil konnte nicht gelöscht werden.");
    return;
  }

  // LocalStorage löschen
  localStorage.removeItem("festival_bingo_player");

  // Lokalen Zustand komplett zurücksetzen
  currentPlayer = null;

  gameState = {
    score: 0,
    completed: [],
    firstSolved: [],
    activeChallengeId: null,
    cooldownUntil: null,
    bingos: [],
    bingoCells: []
  };

  currentPlayerProfileGallery = [];
  currentPlayerProfileGalleryIndex = 0;

  // Alle offenen Overlays schließen
  closePlayerProfileModal();
  closeModal();
  closeUploadModal();
  closePhotoViewer();
  closeRulesModal();
  closeDetailsModal();
  closeFinalOverlay();

  // UI sofort neutral setzen
  displayedScore = 0;
  setScoreDisplay(0);
  playerDisplay.textContent = "Eingeloggt als: -";

  renderGrid();
  await renderLeaderboard();

  // Jetzt explizit Login anzeigen
  showLoginOverlay();

}

// =======================
// GRID RENDERN
// =======================

function renderGrid(updateScore = true) {
  grid.innerHTML = "";

  updateCooldownDisplay();

  if (updateScore && !freezeScoreDisplay) {
    displayedScore = gameState.score;
  }

  setScoreDisplay(displayedScore);

  if (currentPlayer) {
    playerDisplay.textContent = `Eingeloggt als: ${currentPlayer.username}`;
  } else {
    playerDisplay.textContent = "Eingeloggt als: -";
  }

  const cooldown = isCooldownActive();

  for (const challenge of challenges) {
    const cell = document.createElement("div");
    cell.dataset.boardId = challenge.boardId;
    cell.className = "cell";

    const isCompleted = gameState.completed.includes(challenge.boardId);
    const isLocked = gameState.activeChallengeId !== null;
    const isActive = gameState.activeChallengeId === challenge.boardId;
    const isBingoCell = gameState.bingoCells.includes(challenge.boardId);
    const isFirstSolverCell = gameState.firstSolved.includes(challenge.boardId);

    cell.style.background = "";
    cell.style.border = "";
    cell.style.opacity = "";
    cell.style.boxShadow = "";

    if (isCompleted) {
      cell.style.background = "#16a34a";
      cell.style.opacity = "1";
    } else if (isActive) {
      cell.style.border = "2px solid #3b82f6";
    }

    if (isBingoCell) {
      cell.style.boxShadow = "0 0 0 3px gold inset";
    }

    if (cooldown && !isCompleted) {
      cell.style.opacity = "0.3";
    } else if (isLocked && !isActive && !isCompleted) {
      cell.style.opacity = "0.5";
    }

    cell.innerHTML = `
      ${challenge.activeCount > 0 ? `<div class="cell-active-banner">Wird versucht (${challenge.activeCount})</div>` : ""}
      ${isFirstSolverCell ? `<div class="cell-first-solver">⭐</div>` : ""}
      ${challenge.categoryIcon ? `<div class="cell-category-icon">${challenge.categoryIcon}</div>` : ""}
      ${isCooldownActive() && !isCompleted && !isActive ? `<div class="cell-lock-icon">🔒</div>` : ""}

      <div class="cell-title">${challenge.title}</div>
      <div class="cell-points">${challenge.points}P</div>
      <div class="cell-solved-count">${challenge.solvedCount}</div>
    `;

    cell.addEventListener("click", async () => {
      if (isCompleted) {
        await openCompletedChallengeModal(challenge);
        return;
      }

      if (isCooldownActive()) return;
      if (gameState.activeChallengeId !== null) return;

      await activateChallenge(challenge.boardId);
    });

    grid.appendChild(cell);
  }
}

// =======================
// Foto-Viewer
// =======================


function openPhotoViewer(username, imagePath) {
  const { data } = supabaseClient.storage
    .from("proof-photos")
    .getPublicUrl(imagePath);

  const imageUrl = data.publicUrl;

  photoViewerTitle.textContent = `Beweisfoto von ${username}`;

  photoViewerContent.innerHTML = `
    <img src="${imageUrl}" style="width: 100%; border-radius: 12px;" />
  `;

  photoViewerOverlay.classList.remove("hidden");
}

function closePhotoViewer() {
  photoViewerOverlay.classList.add("hidden");
  photoViewerContent.innerHTML = "";
}


// =======================
// Hilfsfunktionen Spielende
// =======================

function getFinalSeenStorageKey() {
  if (!currentPlayer) return null;
  return `festival_bingo_final_seen_${currentGameId}_${currentPlayer.id}`;
}

function markFinalAsSeen() {
  const key = getFinalSeenStorageKey();
  if (!key) return;
  localStorage.setItem(key, "true");
}

function hasSeenFinal() {
  const key = getFinalSeenStorageKey();
  if (!key) return false;
  return localStorage.getItem(key) === "true";
}

function clearFinalSeenIfNeeded() {
  const key = getFinalSeenStorageKey();
  if (!key) return;

  if (gameState.completed.length < challenges.length) {
    localStorage.removeItem(key);
  }
}

function launchFinalConfetti() {
  for (let i = 0; i < 10; i++) { // mehr Wellen
    setTimeout(() => {
      for (let j = 0; j < 20; j++) {
        const piece = document.createElement("div");
        piece.textContent = ["🎉", "✨", "🎊", "⭐"][Math.floor(Math.random() * 4)];

        piece.style.position = "fixed";
        piece.style.left = `${Math.random() * 100}vw`;
        piece.style.top = "-20px";
        piece.style.fontSize = `${18 + Math.random() * 18}px`;
        piece.style.pointerEvents = "none";
        piece.style.zIndex = "5000";

        piece.style.transition = "transform 5s linear, opacity 5s ease";
        piece.style.opacity = "1";

        document.body.appendChild(piece);

        requestAnimationFrame(() => {
          piece.style.transform = `translateY(${window.innerHeight + 100}px) rotate(${Math.random() * 720 - 360}deg)`;
          piece.style.opacity = "0";
        });

        setTimeout(() => piece.remove(), 8200);
      }
    }, i * 250); // längerer Abstand
  }
}

function openFinalOverlay(finalScore) {
  finalScoreText.innerHTML = `<strong>Dein finaler Punktestand:</strong> ${finalScore}`;
  lockBodyScroll();
  finalOverlay.classList.remove("hidden");
  launchFinalConfetti();
  markFinalAsSeen();
}

function closeFinalOverlay() {
  finalOverlay.classList.add("hidden");
  unlockBodyScroll();
}



// =======================
// BUTTONS - ALLGEMEIN
// =======================


rulesBtn.addEventListener("click", openRulesModal);
closeRulesBtn.addEventListener("click", closeRulesModal);
closeDetailsBtn.addEventListener("click", closeDetailsModal);
closePhotoViewerBtn.addEventListener("click", closePhotoViewer);
modalCloseBtn.addEventListener("click", closeModal);
closeFinalBtn.addEventListener("click", closeFinalOverlay);
playerDisplay.addEventListener("click", openPlayerProfileModal);
closePlayerProfileBtn.addEventListener("click", closePlayerProfileModal);

if (logoutBtn) {
  logoutBtn.addEventListener("click", logoutPlayer);

  if (playerProfileLogoutBtn) {
  playerProfileLogoutBtn.addEventListener("click", () => {
    closePlayerProfileModal();
    logoutPlayer();
  });
}
}

if (resetProgressBtn) {
  resetProgressBtn.addEventListener("click", async () => {
    await resetCurrentGameProgress();
  });
}

if (deletePlayerBtn) {
  deletePlayerBtn.addEventListener("click", async () => {
    await deleteCurrentPlayerProfile();
  });
}

cancelFailBtn.addEventListener("click", () => {
  closeFailConfirmModal();
});

confirmFailBtn.addEventListener("click", async () => {
  closeFailConfirmModal();
  await failChallenge();
});

// =======================
// FOTO-UPLOAD - ABBRECHEN
// =======================

cancelUploadBtn.addEventListener("click", () => {
  const challenge = pendingUploadChallenge;

  closeUploadModal();

  if (challenge) {
    openChallengeModal(challenge);
  }
});


// =======================
// FOTO-UPLOAD - STARTEN
// =======================

doUploadBtn.addEventListener("click", async () => {
  if (!pendingUploadChallenge) return;

  const file = uploadPhotoInput.files[0];

  if (!file) {
    uploadStatusText.textContent = "Bitte zuerst ein Bild auswählen.";
    return;
  }

  const challenge = pendingUploadChallenge;

  if (!challenge || !currentPlayer) return;

  setUploadButtonsDisabled(true);
  doUploadBtn.textContent = "Lädt...";
  uploadStatusText.textContent = "Lade Bild hoch...";

  try {
    const fileExt = file.name.split(".").pop();
    const fileName = `game-${currentGameId}/player-${currentPlayer.id}/challenge-${challenge.boardId}-${Date.now()}.${fileExt}`;

    const { error } = await supabaseClient.storage
      .from("proof-photos")
      .upload(fileName, file);

    if (error) {
      console.error("Upload Fehler:", error);
      uploadStatusText.textContent = "Upload fehlgeschlagen.";
      setUploadButtonsDisabled(false);
      doUploadBtn.textContent = "Hochladen";
      return;
    }

    uploadStatusText.textContent = "Upload erfolgreich. Aufgabe wird abgeschlossen...";

    closeUploadModal();
    await completeChallenge(challenge.boardId, fileName);

  } catch (error) {
    console.error("Unerwarteter Upload-Fehler:", error);
    uploadStatusText.textContent = "Ein unerwarteter Fehler ist aufgetreten.";
    setUploadButtonsDisabled(false);
    doUploadBtn.textContent = "Hochladen";
  }
});


// =======================
// FOTO-UPLOAD - VORSCHAU
// =======================

uploadPhotoInput.addEventListener("change", () => {
  const file = uploadPhotoInput.files[0];

  resetUploadPreview();
  uploadStatusText.textContent = "";

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    uploadStatusText.textContent = "Bitte nur Bilddateien auswählen.";
    uploadPhotoInput.value = "";
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  uploadPreviewImage.src = objectUrl;
  uploadPreviewContainer.classList.remove("hidden");
});