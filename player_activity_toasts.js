/**
 * ============================================================
 * player_activity_toasts.js
 * ============================================================
 *
 * Kleine Live-Toast-Benachrichtigungen für Spieler.
 *
 * Features:
 * - zeigt neue relevante Gameplay-Events als Toast
 * - nur aktuelles Spiel
 * - keine eigenen Events
 * - anonymisiert unbekannte Challenges
 * - optional Vibration + kurzer Sound
 *
 * Verwendet:
 * - activity_logs
 * - admin_logs.js Helper
 * - currentPlayer
 * - currentGame
 * - completedChallengeIds
 * - DataService.logs.loadActivityLogs()
 */

/* ============================================================
 * STATE
 * ============================================================ */

let playerActivityToastInitialized = false;
let lastSeenPlayerActivityTimestamp = null;

/* ============================================================
 * INIT
 * ============================================================ */

async function initializePlayerActivityToasts() {
  if (!currentGame?.id) return;

  const logs = await loadRecentPlayerActivityLogs();

  if (logs.length > 0) {
    lastSeenPlayerActivityTimestamp = logs[0].created_at;
  }

  ensurePlayerActivityToastContainer();

  playerActivityToastInitialized = true;
}

/* ============================================================
 * REFRESH
 * ============================================================ */

async function refreshPlayerActivityToasts() {
  if (!playerActivityToastInitialized) return;
  if (!currentGame?.id) return;
  if (!currentPlayer?.id) return;

  const logs = await loadRecentPlayerActivityLogs();

  if (!logs.length) return;

  const newLogs = logs
    .filter(log => {
      if (!lastSeenPlayerActivityTimestamp) return false;

      return log.created_at > lastSeenPlayerActivityTimestamp;
    })
    .reverse();

  if (logs[0]?.created_at) {
    lastSeenPlayerActivityTimestamp = logs[0].created_at;
  }

  for (const log of newLogs) {
    if (!shouldShowPlayerActivityToast(log)) continue;

    const toastData = buildPlayerActivityToast(log);

    if (!toastData) continue;

    showPlayerActivityToast(toastData.text, toastData.type);

    triggerPlayerActivityToastFeedback();
  }
}

/* ============================================================
 * LOAD
 * ============================================================ */

async function loadRecentPlayerActivityLogs() {
  try {
    return await DataService.logs.loadActivityLogs({
      gameId: currentGame.id,
      limit: 15
    });
  } catch (error) {
    console.error("Fehler beim Laden der Activity-Toasts:", error);
    return [];
  }
}

/* ============================================================
 * FILTER
 * ============================================================ */

function shouldShowPlayerActivityToast(log) {
  if (!log) return false;

  // Keine eigenen Events
  if (String(log.player_id) === String(currentPlayer.id)) {
    return false;
  }

  // Nur relevante Events
  switch (log.event_type) {
    case ACTIVITY_EVENT_TYPES.CHALLENGE_COMPLETED:
    case ACTIVITY_EVENT_TYPES.BINGO_AWARDED:
      return true;

    default:
      return false;
  }
}

/* ============================================================
 * BUILD TOAST
 * ============================================================ */

function buildPlayerActivityToast(log) {
  if (!log) return null;

  const playerName =
    getActivityPlayerNameFromLogOrMetadata(log);

  switch (log.event_type) {
    case ACTIVITY_EVENT_TYPES.CHALLENGE_COMPLETED:
      return buildChallengeCompletedToast(log, playerName);

    case ACTIVITY_EVENT_TYPES.BINGO_AWARDED:
      return buildBingoToast(log, playerName);

    default:
      return null;
  }
}

function buildChallengeCompletedToast(log, playerName) {
  const challengeId = log.challenge_id;

  const challenge =
    typeof getChallengeByDbId === "function"
      ? getChallengeByDbId(challengeId)
      : null;

  const hasCompletedChallenge =
    !!challenge &&
    Array.isArray(gameState?.completed) &&
    gameState.completed.includes(challenge.boardId);

  const points =
    log.points_delta !== null &&
    log.points_delta !== undefined
      ? ` (+${log.points_delta}P)`
      : "";

  if (!hasCompletedChallenge) {
    return {
      type: "challenge",
      text: `🎯 ${playerName} hat eine Aufgabe abgeschlossen${points}`
    };
  }

  const challengeLabel =
    challenge?.title ||
    getActivityChallengeLabel(log);

  const variantLabel =
    log?.metadata?.success_variant_label || "";

  let fullLabel = challengeLabel;

  if (variantLabel) {
    fullLabel += `: ${variantLabel}`;
  }

  return {
    type: "challenge",
    text: `🎯 ${playerName} hat "${fullLabel}" abgeschlossen${points}`
  };
}

function buildBingoToast(log, playerName) {
  const points =
    log.points_delta !== null &&
    log.points_delta !== undefined
      ? ` (+${log.points_delta}P)`
      : "";

  const isFirst =
    !!log?.metadata?.is_first_for_line;

  return {
    type: "bingo",
    text: isFirst
      ? `🏆 ${playerName} hat als Erste:r ein Bingo erreicht${points}`
      : `🎉 ${playerName} hat ein Bingo erreicht${points}`
  };
}

/* ============================================================
 * TOAST UI
 * ============================================================ */

function ensurePlayerActivityToastContainer() {
  let container = document.getElementById(
    "playerActivityToastContainer"
  );

  if (container) return container;

  container = document.createElement("div");
  container.id = "playerActivityToastContainer";
  container.className = "player-activity-toast-container";

  document.body.appendChild(container);

  return container;
}

function showPlayerActivityToast(text, type = "challenge") {
  const container = ensurePlayerActivityToastContainer();

  const toast = document.createElement("div");

  toast.className =
    `player-activity-toast ${type}`;

  toast.textContent = text;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.add("hide");

    setTimeout(() => {
      toast.remove();
    }, 250);
  }, 6200);
}

/* ============================================================
 * FEEDBACK
 * ============================================================ */

function triggerPlayerActivityToastFeedback() {
  triggerPlayerActivityToastVibration();
  triggerPlayerActivityToastSound();
}

function triggerPlayerActivityToastVibration() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(120);
    }
  } catch (_) {}
}

function triggerPlayerActivityToastSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();

    const oscillator =
      audioContext.createOscillator();

    const gainNode =
      audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;

    gainNode.gain.value = 0.015;

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();

    oscillator.stop(
      audioContext.currentTime + 0.08
    );
  } catch (_) {}
}