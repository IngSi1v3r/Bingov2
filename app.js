
/**
 * ============================================================
 * app.js
 * ============================================================
 *
 * Zweck:
 * Zentrale UI-Datei der normalen Spielerseite.
 *
 * Diese Datei kuemmert sich um:
 * - Grid-Rendering
 * - Challenge-Modals
 * - Foto-Upload und Fotoanzeige
 * - Regeln / Hinweise / Profil
 * - Leaderboard-Rendering
 * - Animationen
 * - Profilgalerie
 * - Reset- und Loeschaktionen fuer den Spieler
 *
 * Reine Ladefunktionen liegen inzwischen in data.js / data_service.js.
 * Gameplay-Logik liegt in game.js.
 * Live-Challenge-Logik liegt in live-challenges.js.
 */


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
const uploadPhotoCameraInput = document.getElementById("uploadPhotoCameraInput");
const uploadPhotoGalleryInput = document.getElementById("uploadPhotoGalleryInput");
const chooseCameraBtn = document.getElementById("chooseCameraBtn");
const chooseGalleryBtn = document.getElementById("chooseGalleryBtn");
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
const playerProfileStats = document.getElementById("playerProfileStats");
const playerProfileGallery = document.getElementById("playerProfileGallery");
const closePlayerProfileBtn = document.getElementById("closePlayerProfileBtn");
const playerProfileCompletedList = document.getElementById("playerProfileCompletedList");
const playerSettingsOverlay = document.getElementById("playerSettingsOverlay");
const playerSettingsName = document.getElementById("playerSettingsName");
const closePlayerSettingsBtn = document.getElementById("closePlayerSettingsBtn");
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
let pendingUploadType = null; // "normal" | "live"
let pendingUploadSuccessVariant = null;

let currentCompletionGallery = [];
let currentGalleryIndex = 0;

let currentPlayerProfileGallery = [];
let currentPlayerProfileGalleryIndex = 0;

let displayedScore = 0;
let freezeScoreDisplay = false;

let selectedUploadFile = null;



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

function renderChallengeDescriptionImage(challenge) {
  const imageUrl = challenge?.descriptionImagePath && DataService?.storage?.getChallengeImagePublicUrl
    ? DataService.storage.getChallengeImagePublicUrl(challenge.descriptionImagePath)
    : null;

  if (!imageUrl) return "";

  return `
    <div class="challenge-description-image-frame">
      <img src="${imageUrl}" class="challenge-description-image" alt="Aufgabenbild" loading="lazy" />
    </div>
  `;
}

function openChallengeModal(challenge) {
  modalCloseBtn.classList.add("hidden");

  modalTitle.textContent = challenge.title;

  const photoMode = challenge.photoMode || (challenge.requiresPhotoProof ? "required" : "none");
  const photoRequired = photoMode === "required";
  const photoOptional = photoMode === "optional";

  const hasCooldownPenalty = (currentGame?.cooldown_seconds ?? 0) > 0;
  const failButtonLabel = hasCooldownPenalty ? "Aufgeben" : "Später";

  const descriptionImageUrl =
    challenge.descriptionImagePath &&
    DataService?.storage?.getChallengeImagePublicUrl
      ? DataService.storage.getChallengeImagePublicUrl(challenge.descriptionImagePath)
      : null;

  modalTask.innerHTML = `
    <div class="challenge-description-wrapper">
      <div class="challenge-description-text">
        ${challenge.task}
      </div>

      ${photoRequired ? `
        <div class="challenge-photo-icon">📷</div>
      ` : ""}

      ${photoOptional ? `
        <div class="challenge-photo-icon">📷?</div>
      ` : ""}
    </div>

    ${descriptionImageUrl ? `
      <div class="challenge-description-image-frame">
        <img
          src="${descriptionImageUrl}"
          class="challenge-description-image"
          alt="Aufgabenbild"
        />
      </div>
    ` : ""}
  `;

  const isVariable = isVariablePointsChallenge(challenge);
  const successVariants = getChallengeSuccessVariants(challenge);

  modalPoints.textContent = isVariable
    ? "Punkte: je nach Erfolgsstufe"
    : `Punkte: ${challenge.points}`;

  const hasDetails = challenge.details && challenge.details.trim() !== "";

  if (isVariable) {
    modalActions.innerHTML = `
      ${hasDetails ? `<button id="detailsBtn">Hinweise</button>` : ""}

      <div class="success-variant-actions">
        <div class="success-variant-heading">Welche Stufe hast du geschafft?</div>

        ${successVariants.map((variant, index) => `
          <div class="success-variant-row">
            <button
              id="successVariantBtn${index}"
              class="success-variant-btn"
              type="button"
            >
              ${variant.points}P · ${variant.label}
            </button>

            ${photoOptional ? `
              <button
                id="successVariantPhotoBtn${index}"
                class="success-variant-photo-btn secondary-btn"
                type="button"
                title="Mit Foto abschließen"
              >
                📷
              </button>
            ` : ""}
          </div>
        `).join("")}
      </div>

      <button id="failBtn">${failButtonLabel}</button>
    `;
  } else {
    modalActions.innerHTML = `
      ${hasDetails ? `<button id="detailsBtn">Hinweise</button>` : ""}

      ${photoRequired ? `
        <button id="completeBtn">Foto hochladen</button>
      ` : `
        <button id="completeBtn">Bestanden</button>
        ${photoOptional ? `<button id="optionalPhotoBtn" type="button" class="secondary-btn">Optional Foto hochladen</button>` : ""}
      `}

      <button id="failBtn">${failButtonLabel}</button>
    `;
  }

  if (hasDetails) {
    document.getElementById("detailsBtn").onclick = () => {
      openDetailsModal(challenge.details);
    };
  }

  if (isVariable) {
    successVariants.forEach((variant, index) => {
      const btn = document.getElementById(`successVariantBtn${index}`);
      const photoBtn = document.getElementById(`successVariantPhotoBtn${index}`);

      if (btn) {
        btn.onclick = async () => {
          if (photoRequired) {
            closeModal();
            openUploadModal(challenge, "normal", variant);
            return;
          }

          await completeChallenge(challenge.boardId, null, variant);
        };
      }

      if (photoBtn) {
        photoBtn.onclick = () => {
          closeModal();
          openUploadModal(challenge, "normal", variant);
        };
      }
    });
  } else {
    document.getElementById("completeBtn").onclick = async () => {
      if (photoRequired) {
        closeModal();
        openUploadModal(challenge);
        return;
      }

      await completeChallenge(challenge.boardId);
    };

    const optionalPhotoBtn = document.getElementById("optionalPhotoBtn");

    if (optionalPhotoBtn) {
      optionalPhotoBtn.onclick = () => {
        closeModal();
        openUploadModal(challenge);
      };
    }
  }

  document.getElementById("failBtn").onclick = async () => {
    if (!hasCooldownPenalty) {
      await failChallenge();
      return;
    }

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

  const imageUrl = DataService.storage.getProofPhotoPublicUrl(entry.proofImagePath);

  galleryContainer.innerHTML = `
    <div class="gallery-wrapper gallery-fade-in">
      <p class="gallery-caption">
        <strong>Foto von:</strong> ${entry.display_name || entry.username}
        <span class="gallery-time">(${entry.successVariantLabel ? `${entry.successVariantLabel} · ` : ""}${formatCompletedDateTime(entry.completedAt)})</span>
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
            ${index + 1}. ${entry.display_name || entry.username}${index === 0 ? `<span class="completion-star">⭐</span>` : ""}
          </div>
          <div class="completion-time">
            ${entry.successVariantLabel ? `${entry.successVariantLabel} · ` : ""}${formatCompletedDateTime(entry.completedAt)}
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
  ${renderChallengeDescriptionImage(challenge)}
  <p><strong>Punkte:</strong> ${getChallengePointsDisplay(challenge)}</p>
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

function isChallengeModalOpen() {
  return modalOverlay && !modalOverlay.classList.contains("hidden");
}

function getOpenChallengeBoardIdFromModal() {
  if (!isChallengeModalOpen()) return null;

  const title = modalTitle?.textContent?.trim();
  if (!title) return null;

  const challenge = challenges.find(c => (c.title || "").trim() === title);
  return challenge ? challenge.boardId : null;
}

function openRulesModal() {
    renderRulesContent();
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





function openUploadModal(challenge, type = "normal", successVariant = null) {
  pendingUploadChallenge = challenge;
  pendingUploadType = type;
  pendingUploadSuccessVariant = successVariant;

  uploadChallengeTitle.innerHTML = `
    <strong>Aufgabe:</strong> ${challenge.title}
    ${successVariant ? `<br><strong>Stufe:</strong> ${successVariant.points}P · ${successVariant.label}` : ""}
  `;
  selectedUploadFile = null;
    if (uploadPhotoCameraInput) uploadPhotoCameraInput.value = "";
    if (uploadPhotoGalleryInput) uploadPhotoGalleryInput.value = "";
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
  pendingUploadType = null;
  pendingUploadSuccessVariant = null;
  selectedUploadFile = null;
    if (uploadPhotoCameraInput) uploadPhotoCameraInput.value = "";
    if (uploadPhotoGalleryInput) uploadPhotoGalleryInput.value = "";
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

  const completedRows = await loadCompletedChallengesForCurrentPlayer(currentPlayer.id);
  const liveRows = await loadCompletedLiveChallengesForPlayer(currentPlayer.id);

  const normalGalleryEntries = completedRows
    .filter(row => row.proof_image_path)
    .map(row => {
      const challenge = getChallengeByDbId(row.challenge_id);
      return challenge
        ? {
            type: "normal",
            challengeId: row.challenge_id,
            challengeTitle: challenge.title,
            completedAt: row.completed_at,
            proofImagePath: row.proof_image_path,
            wasFirstSolver: row.was_first_solver,
            pointsAwarded: row.points_awarded,
            successVariantLabel: row.success_variant_label || null,
            successVariantPoints: row.success_variant_points ?? null
          }
        : null;
    })
    .filter(Boolean);

  const liveGalleryEntries = liveRows
    .filter(row => row.proofImagePath)
    .map(row => ({
      type: "live",
      challengeId: row.challengeId,
      challengeTitle: row.title,
      completedAt: row.completedAt,
      proofImagePath: row.proofImagePath,
      wasFirstSolver: false,
      pointsAwarded: row.points || 0
    }));

  currentPlayerProfileGallery = [
    ...normalGalleryEntries,
    ...liveGalleryEntries
  ].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  currentPlayerProfileGalleryIndex = 0;

  await renderPlayerProfileStats();
  renderPlayerProfileGallery();
  await renderPlayerProfileCompletedList();

  lockBodyScroll();
  playerProfileOverlay.classList.remove("hidden");
}

function closePlayerProfileModal() {
  if (!playerProfileOverlay) return;

  playerProfileOverlay.classList.add("hidden");
  unlockBodyScroll();
}

function openPlayerSettingsModal() {
  if (!currentPlayer || !playerSettingsOverlay) return;

  if (playerSettingsName) {
    playerSettingsName.innerHTML = `
      <strong>Spieler:</strong>
      ${currentPlayer.display_name || currentPlayer.username}
    `;
  }

  const adminPanelBtn = document.getElementById("openAdminPanelBtn");

  if (adminPanelBtn) {
    const isAdmin = currentPlayer?.role === "admin";

    adminPanelBtn.classList.toggle("hidden", !isAdmin);
    adminPanelBtn.onclick = () => {
      window.location.href = "admin.html";
    };
  }

  lockBodyScroll();
  playerSettingsOverlay.classList.remove("hidden");
}

function closePlayerSettingsModal() {
  if (!playerSettingsOverlay) return;

  playerSettingsOverlay.classList.add("hidden");
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

function showBingoAnimation(points = null, isFirstForLine = false) {
  return new Promise((resolve) => {
    const titleEl = document.getElementById("bingoBannerTitle");
    const textEl = document.getElementById("bingoBannerText");

    if (titleEl) {
      titleEl.textContent = isFirstForLine ? "FIRST BINGO!" : "BINGO!";
    }

    if (textEl) {
      textEl.textContent = points !== null
        ? `+${points} Punkte`
        : "";
    }

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

    let nameText = entry.display_name || entry.username;

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
  const liveStats = await loadLiveChallengeStatsForPlayer(currentPlayer.id);
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

    <!-- NEU -->
    <div class="profile-stat-card">
      <div class="profile-stat-label">⚡ Live Challenges</div>
      <div class="profile-stat-value">${liveStats.won} / ${liveStats.total}</div>
    </div>

    <div class="profile-stat-card">
      <div class="profile-stat-label">⚡ Punkte</div>
      <div class="profile-stat-value">${liveStats.points}</div>
    </div>
  </div>
`;
}



function renderPlayerProfileGallery() {
  if (!playerProfileGallery) return;

  if (!currentPlayerProfileGallery.length) {
    playerProfileGallery.innerHTML = `<p>Noch keine Bilder vorhanden.</p>`;
    return;
  }

  const entry = currentPlayerProfileGallery[currentPlayerProfileGalleryIndex];

  const imageUrl = DataService.storage.getProofPhotoPublicUrl(entry.proofImagePath);

  playerProfileGallery.innerHTML = `
    <div class="gallery-wrapper gallery-fade-in">
      <p class="gallery-caption">
        <strong>${entry.challengeTitle}</strong>, ${entry.successVariantLabel ? `${entry.successVariantLabel} · ` : ""}${formatCompletedDateTime(entry.completedAt)}
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

function setPlayerProfileGalleryToChallenge(challengeId, type = "normal") {
  const index = currentPlayerProfileGallery.findIndex(
    entry => entry.challengeId === challengeId && entry.type === type
  );

  if (index >= 0) {
    currentPlayerProfileGalleryIndex = index;
    renderPlayerProfileGallery();
  }
}

async function renderPlayerProfileCompletedList() {
  if (!currentPlayer) return;

  const normalRows = await loadCompletedChallengesForCurrentPlayer(currentPlayer.id);
  const liveRows = await loadCompletedLiveChallengesForPlayer(currentPlayer.id);
  const bingoRows = await loadPlayerBingos(currentPlayer.id);

  const combined = [];

  // Normale Challenges
  normalRows.forEach(row => {
    const challenge = getChallengeByDbId(row.challenge_id);
    if (!challenge) return;

    combined.push({
      type: "normal",
      challengeId: row.challenge_id,
      title: challenge.title,
      completedAt: row.completed_at,
      points: row.points_awarded || 0,
      wasFirstSolver: row.was_first_solver === true,
      proofImagePath: row.proof_image_path || null,
      successVariantLabel: row.success_variant_label || null,
      successVariantPoints: row.success_variant_points ?? null
    });
  });

  // Live-Challenges
  liveRows.forEach(row => {
    combined.push({
      type: "live",
      challengeId: row.challengeId,
      title: row.title,
      completedAt: row.completedAt,
      points: row.points || 0,
      wasFirstSolver: false,
      proofImagePath: row.proofImagePath || null
    });
  });

  // Bingos
bingoRows.forEach(row => {
  combined.push({
    type: "bingo",
    challengeId: null,
    title: formatBingoLineName(row.line_key),
    completedAt: row.awarded_at,
    points: row.bonus_points || 0,
    wasFirstSolver: isFirstBingoForLine(row),
    proofImagePath: null
  });
});

  // Nach Datum sortieren, neueste zuerst
  combined.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  if (!combined.length) {
    playerProfileCompletedList.innerHTML = `<p>Noch keine Aufgaben abgeschlossen.</p>`;
    return;
  }

  let html = `<div class="completion-list">`;
  const total = combined.length;

  combined.forEach((entry, index) => {
    const isClickable = !!entry.proofImagePath;
    const icon =
      entry.type === "live"
        ? `<span class="completion-live">⚡</span>`
        : entry.type === "bingo"
          ? `<span class="completion-live">🏆</span>`
          : "";
    const number = total - index;

    html += `
      <div class="completion-row">
        <div 
          class="completion-name ${isClickable ? "clickable" : ""}"
          data-challenge-id="${entry.challengeId}"
          data-challenge-type="${entry.type}"
        >
          ${number}. ${entry.title}${entry.successVariantLabel ? ` – ${entry.successVariantLabel}` : ""}, ${formatCompletedDateTime(entry.completedAt)}
          ${entry.wasFirstSolver ? `<span class="completion-star">⭐</span>` : ""}
          ${icon}
        </div>

        <div class="completion-points">
          ${entry.points}P
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
      const challengeType = el.dataset.challengeType || "normal";

      if (!challengeId) return;

      setPlayerProfileGalleryToChallenge(challengeId, challengeType);
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
      proof_image_path: null,
      success_variant_label: null,
      success_variant_points: null
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

  const deleteLiveChallengesOk = await deleteAllPlayerLiveChallengesForCurrentGame(playerId);
  if (!deleteLiveChallengesOk) {
    alert("Die Spontanchallenges konnten nicht zurückgesetzt werden.");
    return;
  }

  const deleteLiveChallengeViewsOk = await deleteAllPlayerLiveChallengeViewsForCurrentGame(playerId);
  if (!deleteLiveChallengeViewsOk) {
    alert("Die Ansichtsdaten der Spontanchallenges konnten nicht zurückgesetzt werden.");
    return;
  }

  const initLiveViewsOk = await initializeLiveChallengeViewsForNewPlayerInGame(playerId);
  if (!initLiveViewsOk) {
    alert("Die Ansichtsdaten der Spontanchallenges konnten nicht neu initialisiert werden.");
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

  currentPlayerProfileGallery = [];
  currentPlayerProfileGalleryIndex = 0;

  await loadGlobalChallengeStats();
  await renderLeaderboard();
  renderGrid();

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
  closePlayerSettingsModal();
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

async function deleteAllPlayerLiveChallengesForCurrentGame(playerId) {
  const { error } = await supabaseClient
    .from("player_live_challenges")
    .delete()
    .eq("player_id", playerId)
    .eq("game_id", currentGameId);

  if (error) {
    console.error("Fehler beim Löschen der Live-Challenges des Spielers:", error);
    return false;
  }

  return true;
}

async function deleteAllPlayerLiveChallengeViewsForCurrentGame(playerId) {
  const { data: liveChallenges, error: loadError } = await supabaseClient
    .from("live_challenges")
    .select("id")
    .eq("game_id", currentGameId);

  if (loadError) {
    console.error("Fehler beim Laden der Live-Challenges für View-Reset:", loadError);
    return false;
  }

  const liveChallengeIds = (liveChallenges || []).map(row => row.id);

  if (!liveChallengeIds.length) {
    return true;
  }

  const { error } = await supabaseClient
    .from("player_live_challenge_views")
    .delete()
    .eq("player_id", playerId)
    .in("live_challenge_id", liveChallengeIds);

  if (error) {
    console.error("Fehler beim Löschen der Live-Challenge-Views des Spielers:", error);
    return false;
  }

  return true;
}


// =======================
// GRID RENDERN
// =======================

function renderBingoLineIndicators() {
  const columnContainer = document.getElementById("bingoColumnIndicators");
  const rowContainer = document.getElementById("bingoRowIndicators");
  const diagonalTopContainer = document.getElementById("bingoDiagonalTopIndicator");
  const diagonalBottomContainer = document.getElementById("bingoDiagonalBottomIndicator");

  if (
    !columnContainer ||
    !rowContainer ||
    !diagonalTopContainer ||
    !diagonalBottomContainer
  ) return;

  const gridSize = currentGame?.grid_size || 5;

  columnContainer.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
  rowContainer.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;

  columnContainer.innerHTML = "";
  rowContainer.innerHTML = "";
  diagonalTopContainer.innerHTML = "";
  diagonalBottomContainer.innerHTML = "";

  // Spalten unten
  for (let col = 0; col < gridSize; col++) {
    const lineIndex = gridSize + col;
    columnContainer.appendChild(
      createBingoLineIndicator(lineIndex, `Spalte ${col + 1}`)
    );
  }

  // Reihen rechts
  for (let row = 0; row < gridSize; row++) {
    const lineIndex = row;
    rowContainer.appendChild(
      createBingoLineIndicator(lineIndex, `Reihe ${row + 1}`)
    );
  }

  // Diagonale von rechts oben nach links unten
  diagonalTopContainer.appendChild(
    createBingoLineIndicator(gridSize * 2 + 1, "Diagonale ↙")
  );

  // Diagonale von links oben nach rechts unten
  diagonalBottomContainer.appendChild(
    createBingoLineIndicator(gridSize * 2, "Diagonale ↘")
  );
}

function createBingoLineIndicator(lineIndex, title) {
  const info = getBingoLineDisplayInfo(lineIndex);

  const el = document.createElement("div");
  el.className = "bingo-line-indicator";
  el.title = title;

  if (info.ownCompleted) {
    el.classList.add("own");
  }

  el.innerHTML = `
    <span class="bingo-line-points">${info.availablePoints}P</span>
    <span class="bingo-line-count">(${info.count})</span>
  `;

  return el;
}

function renderGrid(updateScore = true) {
  grid.innerHTML = "";

  const gridSize = currentGame?.grid_size || 5;

  grid.classList.remove(
    "grid-size-3",
    "grid-size-4",
    "grid-size-5",
    "grid-size-6",
    "grid-size-7"
  );

  grid.classList.add(`grid-size-${gridSize}`);
  grid.style.gridTemplateColumns = `repeat(${gridSize}, minmax(0, 1fr))`;

  const showBingoIndicators =
    (currentGame?.bingo_bonus_points ?? 0) > 0 ||
    (currentGame?.first_bingo_bonus_points ?? 0) > 0;

  const bingoShell = document.querySelector(".bingo-board-shell");

  if (bingoShell) {
    bingoShell.classList.toggle("no-bingo-indicators", !showBingoIndicators);
  }

  if (showBingoIndicators) {
    renderBingoLineIndicators();
  }

  const expectedCount = gridSize * gridSize;
  if (challenges.length !== expectedCount) {
    console.warn(`⚠️ Challenge-Anzahl stimmt nicht: ${challenges.length} statt ${expectedCount}`);
  }

  updateCooldownDisplay();

  if (updateScore && !freezeScoreDisplay) {
    displayedScore = gameState.score;
  }

  setScoreDisplay(displayedScore);

  const gameNameInline = document.getElementById("gameNameInline");
  const playerNameInline = document.getElementById("playerNameInline");

  if (gameNameInline) {
    gameNameInline.textContent = currentGame?.name || "-";
  }

  if (playerNameInline) {
    playerNameInline.textContent = currentPlayer
      ? (currentPlayer.display_name || currentPlayer.username)
      : "-";
  }

  const cooldown = isCooldownActive();
  const hasActiveChallenge = gameState.activeChallengeId !== null;

  for (const challenge of challenges) {
    const cell = document.createElement("div");
    cell.dataset.boardId = challenge.boardId;
    cell.className = "cell";

    const isCompleted = gameState.completed.includes(challenge.boardId);
    const isActive = gameState.activeChallengeId === challenge.boardId;
    const isBingoCell = gameState.bingoCells.includes(challenge.boardId);
    const isFirstSolverCell = gameState.firstSolved.includes(challenge.boardId);
    const isChallengeDisabled = challenge.isActive === false;
    const solvedCount = challenge.solvedCount || 0;
    const isSolvedByOtherPlayer =
      solvedCount > (isCompleted ? 1 : 0);

    const isGloballySolvedByOther =
      currentGame?.single_use_challenges === true &&
      challenge.solvedCount > 0 &&
      !isCompleted;

    if (isSolvedByOtherPlayer) {
      cell.classList.add("solved-by-others");
    }

    cell.style.background = "";
    cell.style.border = "";
    cell.style.opacity = "";
    cell.style.boxShadow = "";
    cell.style.cursor = "";

    if (isCompleted) {
      cell.classList.add("completed");
      cell.style.opacity = "1";
    } else if (isActive) {
      cell.style.border = "2px solid #3b82f6";
    }

    if (isBingoCell) {
      cell.classList.add("bingo-cell");
    }

    if ((isChallengeDisabled || isGloballySolvedByOther) && !isCompleted) {
      cell.classList.add("single-use-locked");
      cell.style.opacity = "0.28";
      cell.style.background = "#1f2937";
      cell.style.cursor = "not-allowed";
    } else if (cooldown && !isCompleted) {
      cell.style.opacity = "0.3";
    } else if (hasActiveChallenge && !isActive && !isCompleted) {
      cell.style.opacity = "0.5";
    }

    cell.innerHTML = `
      ${challenge.activeCount > 0 ? `<div class="cell-active-banner">Wird versucht (${challenge.activeCount})</div>` : ""}
      ${isFirstSolverCell ? `<div class="cell-first-solver">⭐</div>` : ""}
      ${challenge.categoryIcon ? `<div class="cell-category-icon">${challenge.categoryIcon}</div>` : ""}
      ${cooldown && !isCompleted && !isActive ? `<div class="cell-lock-icon">🔒</div>` : ""}
      ${isChallengeDisabled && !isCompleted ? `<div class="cell-lock-icon">🚫</div>` : ""}
      

      <div class="cell-title">${challenge.title}</div>
      <div class="cell-points">${getChallengePointsDisplay(challenge)}</div>
    `;

    cell.addEventListener("click", async () => {
      if (isCompleted || isGloballySolvedByOther) {
        await openCompletedChallengeModal(challenge);
        return;
      }

      if (isChallengeDisabled) return;
      if (isCooldownActive()) return;

      if (gameState.activeChallengeId !== null) {
        const activeChallenge = getChallengeByBoardId(gameState.activeChallengeId);

        if (activeChallenge) {
          if (!isChallengeModalOpen()) {
            openChallengeModal(activeChallenge);
          }
        }

        return;
      }

      await activateChallenge(challenge.boardId);
    });

    grid.appendChild(cell);
  }
}

// =======================
// Foto-Viewer
// =======================


function openPhotoViewer(username, imagePath) {
  const imageUrl = DataService.storage.getProofPhotoPublicUrl(imagePath);

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


if (rulesBtn) {
  rulesBtn.addEventListener("click", openRulesModal);
}

const profileRulesBtn = document.getElementById("profileRulesBtn");

if (profileRulesBtn) {
  profileRulesBtn.addEventListener("click", openRulesModal);
}


closeRulesBtn.addEventListener("click", closeRulesModal);
closeDetailsBtn.addEventListener("click", closeDetailsModal);
closePhotoViewerBtn.addEventListener("click", closePhotoViewer);
modalCloseBtn.addEventListener("click", closeModal);
closeFinalBtn.addEventListener("click", closeFinalOverlay);

if (closePlayerProfileBtn) {
  closePlayerProfileBtn.addEventListener("click", closePlayerProfileModal);
}

if (closePlayerSettingsBtn) {
  closePlayerSettingsBtn.addEventListener("click", closePlayerSettingsModal);
}

const playerProfileBtn = document.getElementById("playerProfileBtn");

if (playerProfileBtn) {
  playerProfileBtn.addEventListener("click", openPlayerSettingsModal);
}

if (scoreDisplay) {
  scoreDisplay.addEventListener("click", openPlayerProfileModal);
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", logoutPlayer);
}

if (playerProfileLogoutBtn) {
  playerProfileLogoutBtn.addEventListener("click", () => {
    closePlayerSettingsModal();
    logoutPlayer();
  });
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
  const uploadType = pendingUploadType;
  const successVariant = pendingUploadSuccessVariant;

  closeUploadModal();

  if (!challenge) return;

  if (uploadType === "live") {
    currentLiveChallenge = challenge;
    renderLiveChallengeModal(challenge);
    openLiveChallengeOverlay();
  } else {
    openChallengeModal(challenge);
  }
});


// =======================
// FOTO-UPLOAD - STARTEN
// =======================

doUploadBtn.addEventListener("click", async () => {
  if (!pendingUploadChallenge) return;

  const file = selectedUploadFile;

  if (!file) {
    uploadStatusText.textContent = "Bitte zuerst ein Bild auswählen.";
    return;
  }

  const challenge = pendingUploadChallenge;
  const uploadType = pendingUploadType;
  const successVariant = pendingUploadSuccessVariant;

  if (!challenge || !currentPlayer) return;

  setUploadButtonsDisabled(true);
  doUploadBtn.textContent = "Lädt...";
  uploadStatusText.textContent = "Lade Bild hoch...";

  try {
    const fileExt = file.name.split(".").pop();

    const fileName =
      uploadType === "live"
        ? `game-${currentGameId}/live/player-${currentPlayer.id}/challenge-${challenge.id}-${Date.now()}.${fileExt}`
        : `game-${currentGameId}/player-${currentPlayer.id}/challenge-${challenge.boardId}-${Date.now()}.${fileExt}`;

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

    // Erst lokale Werte benutzen, dann Modal schließen
    if (uploadType === "live") {
      const latest = await loadLatestLiveChallenge();
      if (!latest) {
        closeUploadModal();
        return;
      }

      closeUploadModal();
      await handleCompleteLiveChallenge(latest, fileName);
    } else {
      closeUploadModal();
      await completeChallenge(challenge.boardId, fileName, successVariant);
    }

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



if (chooseCameraBtn && uploadPhotoCameraInput) {
  chooseCameraBtn.addEventListener("click", () => {
    uploadPhotoCameraInput.click();
  });
}

if (chooseGalleryBtn && uploadPhotoGalleryInput) {
  chooseGalleryBtn.addEventListener("click", () => {
    uploadPhotoGalleryInput.click();
  });
}

if (uploadPhotoCameraInput) {
  uploadPhotoCameraInput.addEventListener("change", () => {
    selectedUploadFile = uploadPhotoCameraInput.files?.[0] || null;
    if (selectedUploadFile) {
      handleUploadFileSelected(selectedUploadFile);
    }
  });
}

if (uploadPhotoGalleryInput) {
  uploadPhotoGalleryInput.addEventListener("change", () => {
    selectedUploadFile = uploadPhotoGalleryInput.files?.[0] || null;
    if (selectedUploadFile) {
      handleUploadFileSelected(selectedUploadFile);
    }
  });
}

function handleUploadFileSelected(file) {
  if (!file) return;

  uploadStatusText.textContent = `Ausgewählt: ${file.name}`;

  if (!file.type.startsWith("image/")) {
    uploadStatusText.textContent = "Bitte ein Bild auswählen.";
    selectedUploadFile = null;
    resetUploadPreview();
    return;
  }

  const previewUrl = URL.createObjectURL(file);
  uploadPreviewImage.src = previewUrl;
  uploadPreviewContainer.classList.remove("hidden");
}