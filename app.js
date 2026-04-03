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



// =======================
// MODAL FUNKTIONEN
// =======================

function formatCompletedDateTime(isoString) {
  if (!isoString) return "-";

  const date = new Date(isoString);

  return date.toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function openChallengeModal(challenge) {
  modalTitle.textContent = challenge.title;
  modalTask.textContent = challenge.task;
  modalPoints.textContent = `Punkte: ${challenge.points}`;

  const hasDetails = challenge.details && challenge.details.trim() !== "";

  modalActions.innerHTML = `
    ${hasDetails ? `<button id="detailsBtn">Hinweise</button>` : ""}
    <button id="completeBtn">Bestanden</button>
    <button id="failBtn">Aufgeben</button>
  `;

  // Hinweise Button (nur wenn vorhanden)
  if (hasDetails) {
    document.getElementById("detailsBtn").onclick = () => {
      openDetailsModal(challenge.details);
    };
  }

  // Standard Buttons
    document.getElementById("completeBtn").onclick = async () => {
    if (challenge.requiresPhotoProof) {
      closeModal();
      openUploadModal(challenge);
      return;
    }

    await completeChallenge(challenge.boardId);
  };

  document.getElementById("failBtn").onclick = async () => {
    await failChallenge();
  };

  modalOverlay.classList.remove("hidden");
}

function openCompletedChallengeModal(challenge) {
  modalTitle.textContent = challenge.title;

  const solvedAt = gameState.completedAt[challenge.boardId];

  const imagePath = gameState.proofImagePaths[challenge.boardId];

let imageHtml = "";

if (imagePath) {
  const { data } = supabaseClient.storage
    .from("proof-photos")
    .getPublicUrl(imagePath);

  const imageUrl = data.publicUrl;

  imageHtml = `
    <div style="margin-top: 16px;">
      <img src="${imageUrl}" style="width: 100%; border-radius: 12px;" />
    </div>
  `;
}

  modalTask.innerHTML = `
  <p>${challenge.task}</p>
  <p><strong>Gelöst um:</strong> ${formatCompletedDateTime(solvedAt)}</p>
  ${imageHtml}
`;

  modalPoints.textContent = `Punkte: ${challenge.points}`;

  modalActions.innerHTML = `
    <button id="backBtn">Zurück</button>
  `;

  document.getElementById("backBtn").onclick = () => {
    closeModal();
  };

  modalOverlay.classList.remove("hidden");
}



function openCooldownModal() {
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
  modalOverlay.classList.remove("hidden");
}

function closeModal() {
  modalOverlay.classList.add("hidden");
}

function openRulesModal() {
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


let pendingUploadChallenge = null;

function openUploadModal(challenge) {
  pendingUploadChallenge = challenge;

  uploadChallengeTitle.innerHTML = `<strong>Aufgabe:</strong> ${challenge.title}`;
  uploadPhotoInput.value = "";
  uploadStatusText.textContent = "";

  uploadOverlay.classList.remove("hidden");
}

function closeUploadModal() {
  uploadOverlay.classList.add("hidden");
  pendingUploadChallenge = null;
  uploadPhotoInput.value = "";
  uploadStatusText.textContent = "";
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
// GRID RENDERN
// =======================

function renderGrid() {
  grid.innerHTML = "";

scoreDisplay.textContent = `Score: ${gameState.score}`;

if (currentPlayer) {
  playerDisplay.textContent = `Eingeloggt als: ${currentPlayer.username}`;
} else {
  playerDisplay.textContent = "Eingeloggt als: -";
}

  const cooldown = isCooldownActive();

  for (const challenge of challenges) {
    const cell = document.createElement("div");
    cell.className = "cell";

    const isCompleted = gameState.completed.includes(challenge.boardId);
    const isLocked = gameState.activeChallengeId !== null;
    const isActive = gameState.activeChallengeId === challenge.boardId;
    const isBingoCell = gameState.bingoCells.includes(challenge.boardId);
    const isFirstSolverCell = gameState.firstSolved.includes(challenge.boardId);
    const activeByOthers = challenge.activeCount > 0;

    // Style immer sauber neu setzen
    cell.style.background = "";
    cell.style.border = "";
    cell.style.opacity = "";
    cell.style.boxShadow = "";

    if (isCompleted) {
      cell.style.background = "#16a34a";
    } else if (isActive) {
      cell.style.border = "2px solid #3b82f6";
    }

    if (isBingoCell) {
    cell.style.boxShadow = "0 0 0 3px gold inset";
    }


    if (cooldown) {
      cell.style.opacity = "0.3";
    } else if (isLocked && !isActive && !isCompleted) {
      cell.style.opacity = "0.5";
    }

cell.innerHTML = `
  ${challenge.activeCount > 0 ? `<div class="cell-active-banner">Wird versucht (${challenge.activeCount})</div>` : ""}
  ${isFirstSolverCell ? `<div class="cell-first-solver">⭐</div>` : ""}
  ${challenge.categoryIcon ? `<div class="cell-category-icon">${challenge.categoryIcon}</div>` : ""}

  <div class="cell-title">${challenge.title}</div>
  <div class="cell-points">${challenge.points}P</div>
  <div class="cell-solved-count">${challenge.solvedCount}</div>
`;

        cell.addEventListener("click", async () => {
      if (isCompleted) {
        openCompletedChallengeModal(challenge);
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
// Buttons
// =======================

logoutBtn.addEventListener("click", logoutPlayer);
rulesBtn.addEventListener("click", openRulesModal);
closeRulesBtn.addEventListener("click", closeRulesModal);
closeDetailsBtn.addEventListener("click", closeDetailsModal);

// Foto-Upload:
cancelUploadBtn.addEventListener("click", () => {
  const challenge = pendingUploadChallenge;

  closeUploadModal();

  if (challenge) {
    openChallengeModal(challenge);
  }
});

doUploadBtn.addEventListener("click", async () => {
  if (!pendingUploadChallenge) return;

  const file = uploadPhotoInput.files[0];

  if (!file) {
    uploadStatusText.textContent = "Bitte zuerst ein Bild auswählen.";
    return;
  }

  uploadStatusText.textContent = "Lade Bild hoch...";

  const challenge = pendingUploadChallenge;

  if (!challenge || !currentPlayer) return;

  const fileExt = file.name.split(".").pop();
  const fileName = `game-${currentGameId}/player-${currentPlayer.id}/challenge-${challenge.boardId}-${Date.now()}.${fileExt}`;

  const { error } = await supabaseClient.storage
    .from("proof-photos")
    .upload(fileName, file);

  if (error) {
    console.error("Upload Fehler:", error);
    uploadStatusText.textContent = "Upload fehlgeschlagen.";
    return;
  }

  uploadStatusText.textContent = "Upload erfolgreich!";

  closeUploadModal();
  await completeChallenge(challenge.boardId, fileName);
});