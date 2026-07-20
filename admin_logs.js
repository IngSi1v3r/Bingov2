/**
 * ============================================================
 * admin_logs.js
 * ============================================================
 *
 * Zweck:
 * - Zentrale Logging-/Activity-Helfer
 * - Activity Logs schreiben
 * - Activity Logs laden
 * - Texte / Labels / Zeit formatieren
 * - Wichtige Wrapper für Gameplay, Live und Admin
 * - Logs-Tab im Adminpanel rendern
 *
 * Hinweise:
 * - Diese Datei ist generisch aufgebaut, obwohl sie admin_logs.js heißt.
 * - Sie kann vom Spiel und vom Adminpanel verwendet werden.
 * - Vorausgesetzt wird ein global verfügbarer supabaseClient.
 * - admin.js soll für den Logs-Tab initializeAdminLogsTab() sowie
 *   refreshAdminLogsListIfNeeded() aufrufen.
 */

/* ============================================================
 * LOGS TAB STATE
 * ============================================================ */

let adminLogsFilterPlayerId = "";
let adminLogsFilterEventType = "";
let adminLogsFilterGameId = "";
let adminLogsQuickFilter = "all";
let adminLogsSearch = "";
let adminLogsDateFrom = "";
let adminLogsDateTo = "";
const ADMIN_LOGS_FETCH_LIMIT = 500;

let adminLogsInitialized = false;
let lastAdminLogsSignature = null;

let adminLogsCurrentRows = [];

/* ============================================================
 * EVENT TYPES
 * ============================================================ */

const ACTIVITY_EVENT_TYPES = {
  // Gameplay
  CHALLENGE_STARTED: "challenge_started",
  CHALLENGE_COMPLETED: "challenge_completed",
  CHALLENGE_FAILED: "challenge_failed",
  CHALLENGE_RESET: "challenge_reset",
  BINGO_AWARDED: "bingo_awarded",
  POINTS_AWARDED: "points_awarded",
  PHOTO_UPLOADED: "photo_uploaded",

  // Live challenges
  LIVE_CHALLENGE_CREATED: "live_challenge_created",
  LIVE_CHALLENGE_COMPLETED: "live_challenge_completed",
  LIVE_CHALLENGE_EXPIRED: "live_challenge_expired",
  LIVE_CHALLENGE_MANUALLY_ENDED: "live_challenge_manually_ended",

  // Admin
  ADMIN_PLAYER_BLOCKED: "admin_player_blocked",
  ADMIN_PLAYER_UNBLOCKED: "admin_player_unblocked",
  ADMIN_SCORE_CHANGED: "admin_score_changed",
  ADMIN_COOLDOWN_CHANGED: "admin_cooldown_changed",
  ADMIN_PLAYER_GAME_RESET: "admin_player_game_reset",
  ADMIN_PLAYER_DELETED: "admin_player_deleted",

  ADMIN_GAME_CREATED: "admin_game_created",
  ADMIN_GAME_DELETED: "admin_game_deleted",
  ADMIN_GAME_DUPLICATED: "admin_game_duplicated",
  ADMIN_GAME_UPDATED: "admin_game_updated",

  ADMIN_CHALLENGE_UPDATED: "admin_challenge_updated"
};

/* ============================================================
 * EVENT GROUPS / QUICK FILTERS
 * ============================================================ */

const ACTIVITY_EVENT_GROUPS = {
  gameplay: [
    ACTIVITY_EVENT_TYPES.CHALLENGE_STARTED,
    ACTIVITY_EVENT_TYPES.CHALLENGE_COMPLETED,
    ACTIVITY_EVENT_TYPES.CHALLENGE_FAILED,
    ACTIVITY_EVENT_TYPES.CHALLENGE_RESET,
    ACTIVITY_EVENT_TYPES.BINGO_AWARDED,
    ACTIVITY_EVENT_TYPES.POINTS_AWARDED,
    ACTIVITY_EVENT_TYPES.PHOTO_UPLOADED
  ],

  live: [
    ACTIVITY_EVENT_TYPES.LIVE_CHALLENGE_CREATED,
    ACTIVITY_EVENT_TYPES.LIVE_CHALLENGE_COMPLETED,
    ACTIVITY_EVENT_TYPES.LIVE_CHALLENGE_EXPIRED,
    ACTIVITY_EVENT_TYPES.LIVE_CHALLENGE_MANUALLY_ENDED
  ],

  admin: [
    ACTIVITY_EVENT_TYPES.ADMIN_PLAYER_BLOCKED,
    ACTIVITY_EVENT_TYPES.ADMIN_PLAYER_UNBLOCKED,
    ACTIVITY_EVENT_TYPES.ADMIN_SCORE_CHANGED,
    ACTIVITY_EVENT_TYPES.ADMIN_COOLDOWN_CHANGED,
    ACTIVITY_EVENT_TYPES.ADMIN_PLAYER_GAME_RESET,
    ACTIVITY_EVENT_TYPES.ADMIN_PLAYER_DELETED,
    ACTIVITY_EVENT_TYPES.ADMIN_GAME_CREATED,
    ACTIVITY_EVENT_TYPES.ADMIN_GAME_DELETED,
    ACTIVITY_EVENT_TYPES.ADMIN_GAME_DUPLICATED,
    ACTIVITY_EVENT_TYPES.ADMIN_GAME_UPDATED,
    ACTIVITY_EVENT_TYPES.ADMIN_CHALLENGE_UPDATED
  ]
};

/* ============================================================
 * CORE WRITE
 * ============================================================ */

/**
 * Schreibt genau einen Activity-Log-Eintrag.
 */
async function insertActivityLog({
  gameId = null,
  playerId = null,
  adminPlayerId = null,
  challengeId = null,
  liveChallengeId = null,
  eventType,
  entityType = null,
  entityId = null,
  pointsDelta = null,
  message = null,
  metadata = {}
}) {
  if (!eventType) {
    console.error("insertActivityLog: eventType fehlt.");
    return false;
  }

  const payload = {
    game_id: gameId,
    player_id: playerId,
    admin_player_id: adminPlayerId,
    challenge_id: challengeId,
    live_challenge_id: liveChallengeId,
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    points_delta: pointsDelta,
    message,
    metadata: metadata || {}
  };

  const { error } = await supabaseClient
    .from("activity_logs")
    .insert(payload);

  if (error) {
    console.error("Fehler beim Schreiben des Activity-Logs:", error, payload);
    return false;
  }

  return true;
}

/* ============================================================
 * CORE READ
 * ============================================================ */

/**
 * Lädt Activity-Logs mit optionalen Filtern.
 */
async function loadActivityLogs({
  gameId = null,
  playerId = null,
  adminPlayerId = null,
  eventType = null,
  limit = 100,
  beforeCreatedAt = null
} = {}) {
  return await DataService.logs.loadActivityLogs({
    gameId,
    playerId,
    adminPlayerId,
    eventType,
    limit,
    beforeCreatedAt
  });
}

/* ============================================================
 * NAME / LABEL HELPERS
 * ============================================================ */

function getActivityPlayerName(player) {
  if (!player) return "Unbekannt";
  return player.display_name || player.username || `Spieler ${player.id || "?"}`;
}

function getActivityPlayerNameFromLogOrMetadata(log) {
  if (log?.player) {
    return getActivityPlayerName(log.player);
  }

  if (log?.metadata?.player_name) {
    return log.metadata.player_name;
  }

  if (log?.player_id) {
    return `Spieler ${log.player_id}`;
  }

  return "Unbekannt";
}

function getActivityAdminNameFromLogOrMetadata(log) {
  if (log?.admin_player) {
    return getActivityPlayerName(log.admin_player);
  }

  if (log?.metadata?.admin_name) {
    return log.metadata.admin_name;
  }

  if (log?.admin_player_id) {
    return `Admin ${log.admin_player_id}`;
  }

  return "Admin";
}

function getActivityChallengeLabel(log) {
  if (log?.challenge?.title) {
    return log.challenge.title;
  }

  if (log?.metadata?.challenge_title) {
    return log.metadata.challenge_title;
  }

  if (log?.metadata?.position) {
    return `Feld ${log.metadata.position}`;
  }

  if (log?.challenge_id) {
    return `Challenge ${log.challenge_id}`;
  }

  return "Challenge";
}

function getActivityLiveChallengeLabel(log) {
  if (log?.live_challenge?.title) {
    return log.live_challenge.title;
  }

  if (log?.metadata?.live_challenge_title) {
    return log.metadata.live_challenge_title;
  }

  if (log?.live_challenge_id) {
    return `Live-Challenge ${log.live_challenge_id}`;
  }

  return "Live-Challenge";
}

function getActivityEventLabel(eventType) {
  switch (eventType) {
    case ACTIVITY_EVENT_TYPES.CHALLENGE_STARTED:
      return "Challenge gestartet";

    case ACTIVITY_EVENT_TYPES.CHALLENGE_COMPLETED:
      return "Challenge abgeschlossen";

    case ACTIVITY_EVENT_TYPES.CHALLENGE_FAILED:
      return "Challenge aufgegeben";

    case ACTIVITY_EVENT_TYPES.CHALLENGE_RESET:
      return "Challenge zurückgesetzt";

    case ACTIVITY_EVENT_TYPES.BINGO_AWARDED:
      return "Bingo erreicht";

    case ACTIVITY_EVENT_TYPES.POINTS_AWARDED:
      return "Punkte vergeben";

    case ACTIVITY_EVENT_TYPES.PHOTO_UPLOADED:
      return "Foto hochgeladen";

    case ACTIVITY_EVENT_TYPES.LIVE_CHALLENGE_CREATED:
      return "Live-Challenge erstellt";

    case ACTIVITY_EVENT_TYPES.LIVE_CHALLENGE_COMPLETED:
      return "Live-Challenge gewonnen";

    case ACTIVITY_EVENT_TYPES.LIVE_CHALLENGE_EXPIRED:
      return "Live-Challenge abgelaufen";

    case ACTIVITY_EVENT_TYPES.LIVE_CHALLENGE_MANUALLY_ENDED:
      return "Live-Challenge beendet";

    case ACTIVITY_EVENT_TYPES.ADMIN_PLAYER_BLOCKED:
      return "Spieler gesperrt";

    case ACTIVITY_EVENT_TYPES.ADMIN_PLAYER_UNBLOCKED:
      return "Spieler entsperrt";

    case ACTIVITY_EVENT_TYPES.ADMIN_SCORE_CHANGED:
      return "Score geändert";

    case ACTIVITY_EVENT_TYPES.ADMIN_COOLDOWN_CHANGED:
      return "Cooldown geändert";

    case ACTIVITY_EVENT_TYPES.ADMIN_PLAYER_GAME_RESET:
      return "Spielstand zurückgesetzt";

    case ACTIVITY_EVENT_TYPES.ADMIN_PLAYER_DELETED:
      return "Spieler gelöscht";

    case ACTIVITY_EVENT_TYPES.ADMIN_GAME_CREATED:
      return "Spiel erstellt";

    case ACTIVITY_EVENT_TYPES.ADMIN_GAME_DELETED:
      return "Spiel gelöscht";

    case ACTIVITY_EVENT_TYPES.ADMIN_GAME_DUPLICATED:
      return "Spiel dupliziert";

    case ACTIVITY_EVENT_TYPES.ADMIN_GAME_UPDATED:
      return "Spiel geändert";

    case ACTIVITY_EVENT_TYPES.ADMIN_CHALLENGE_UPDATED:
      return "Challenge geändert";

    default:
      return eventType || "Unbekanntes Event";
  }
}

function getActivityGameLabel(log) {
  if (log?.game?.name) {
    return log.game.name;
  }

  if (log?.metadata?.game_name) {
    return log.metadata.game_name;
  }

  if (log?.game_id) {
    return `Spiel ${log.game_id}`;
  }

  return "Unbekanntes Spiel";
}

/* ============================================================
 * DATE / TIME FORMAT
 * ============================================================ */

function formatActivityDateTime(isoString) {
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

/* ============================================================
 * FEED TEXT FORMAT
 * ============================================================ */

/**
 * Kompakte Feed-Zeile im Stil:
 * "Peter hat Aufgabe Bier abgeschlossen (Festival Bingo)"
 */
function formatActivityLogMessage(log) {
  if (!log) return "-";

  if (log.message && String(log.message).trim()) {
    return log.message;
  }

  const playerName = getActivityPlayerNameFromLogOrMetadata(log);
  const adminName = getActivityAdminNameFromLogOrMetadata(log);
  const challengeLabel = getActivityChallengeLabel(log);
  const liveLabel = getActivityLiveChallengeLabel(log);
  const gameName = getActivityGameLabel(log);

  const action = log?.metadata?.action || null;

  switch (log.event_type) {
    case ACTIVITY_EVENT_TYPES.CHALLENGE_STARTED:
      return `${playerName} hat ${challengeLabel} gestartet (${gameName})`;

    case ACTIVITY_EVENT_TYPES.CHALLENGE_COMPLETED: {
      const pointsText =
        log.points_delta !== null && log.points_delta !== undefined
          ? ` (+${log.points_delta}P)`
          : "";

      const variantText = log?.metadata?.success_variant_label
        ? `: ${log.metadata.success_variant_label}`
        : "";

      return `${playerName} hat ${challengeLabel} abgeschlossen${variantText}${pointsText} (${gameName})`;
    }

    case ACTIVITY_EVENT_TYPES.CHALLENGE_FAILED:
      return `${playerName} hat ${challengeLabel} aufgegeben (${gameName})`;

    case ACTIVITY_EVENT_TYPES.CHALLENGE_RESET:
      return `${playerName} hat ${challengeLabel} zurückgesetzt (${gameName})`;

    case ACTIVITY_EVENT_TYPES.BINGO_AWARDED: {
      const lineLabel = getActivityBingoLineLabel(log);

      const pointsText =
        log.points_delta !== null && log.points_delta !== undefined
          ? ` (+${log.points_delta}P)`
          : "";

      const firstText = log?.metadata?.is_first_for_line
        ? " als Erster"
        : "";

      return `${playerName} hat ${lineLabel} Bingo${firstText} erreicht${pointsText} (${gameName})`;
    }

    case ACTIVITY_EVENT_TYPES.POINTS_AWARDED:
      return `${playerName} hat ${log.points_delta >= 0 ? "+" : ""}${log.points_delta || 0} Punkte erhalten (${gameName})`;

    case ACTIVITY_EVENT_TYPES.PHOTO_UPLOADED:
      if (log.live_challenge_id || log?.metadata?.live_challenge_title) {
        return `${playerName} hat ein Foto für ${liveLabel} hochgeladen (${gameName})`;
      }

      return `${playerName} hat ein Foto für ${challengeLabel} hochgeladen (${gameName})`;

    case ACTIVITY_EVENT_TYPES.LIVE_CHALLENGE_CREATED:
      return `${adminName} hat die Live-Challenge ${liveLabel} erstellt (${gameName})`;

    case ACTIVITY_EVENT_TYPES.LIVE_CHALLENGE_COMPLETED:
      return `${playerName} hat die Live-Challenge ${liveLabel} gewonnen (${gameName})`;

    case ACTIVITY_EVENT_TYPES.LIVE_CHALLENGE_EXPIRED:
      return `Live-Challenge ${liveLabel} ist abgelaufen (${gameName})`;

    case ACTIVITY_EVENT_TYPES.LIVE_CHALLENGE_MANUALLY_ENDED:
      return `${adminName} hat die Live-Challenge ${liveLabel} beendet (${gameName})`;

    case ACTIVITY_EVENT_TYPES.ADMIN_PLAYER_BLOCKED:
      return `${adminName} hat ${playerName} gesperrt (${gameName})`;

    case ACTIVITY_EVENT_TYPES.ADMIN_PLAYER_UNBLOCKED:
      return `${adminName} hat ${playerName} entsperrt (${gameName})`;

    case ACTIVITY_EVENT_TYPES.ADMIN_SCORE_CHANGED: {
      const oldScore = log?.metadata?.old_score;
      const newScore = log?.metadata?.new_score;

      if (oldScore !== undefined && newScore !== undefined) {
        return `${adminName} hat den Score von ${playerName} von ${oldScore} auf ${newScore} geändert (${gameName})`;
      }

      return `${adminName} hat den Score von ${playerName} geändert (${gameName})`;
    }

    case ACTIVITY_EVENT_TYPES.ADMIN_COOLDOWN_CHANGED: {
      const oldCooldown = log?.metadata?.old_cooldown_seconds;
      const newCooldown = log?.metadata?.new_cooldown_seconds;

      if (oldCooldown !== undefined && newCooldown !== undefined) {
        return `${adminName} hat den Cooldown von ${playerName} von ${oldCooldown}s auf ${newCooldown}s geändert (${gameName})`;
      }

      return `${adminName} hat den Cooldown von ${playerName} geändert (${gameName})`;
    }

    case ACTIVITY_EVENT_TYPES.ADMIN_PLAYER_GAME_RESET:
      return `${adminName} hat den Spielstand von ${playerName} zurückgesetzt (${gameName})`;

    case ACTIVITY_EVENT_TYPES.ADMIN_PLAYER_DELETED:
      return `${adminName} hat ${playerName} gelöscht (${gameName})`;

    case ACTIVITY_EVENT_TYPES.ADMIN_GAME_CREATED:
      return `${adminName} hat ein Spiel erstellt (${gameName})`;

    case ACTIVITY_EVENT_TYPES.ADMIN_GAME_DELETED:
      return `${adminName} hat ein Spiel gelöscht (${gameName})`;

    case ACTIVITY_EVENT_TYPES.ADMIN_GAME_DUPLICATED:
      return `${adminName} hat ein Spiel dupliziert (${gameName})`;

    case ACTIVITY_EVENT_TYPES.ADMIN_GAME_UPDATED:
      return `${adminName} hat ein Spiel geändert (${gameName})`;

    case ACTIVITY_EVENT_TYPES.ADMIN_CHALLENGE_UPDATED: {
      switch (action) {
        case "admin_mark_completed":
          return `${adminName} hat für ${playerName} ${challengeLabel} abgeschlossen (${gameName})`;

        case "admin_reset_player_challenge":
          return `${adminName} hat für ${playerName} ${challengeLabel} aberkannt (${gameName})`;

        case "admin_set_player_challenge_inactive":
          return `${adminName} hat für ${playerName} ${challengeLabel} inaktiv gesetzt (${gameName})`;

        case "admin_set_player_challenge_active":
          return `${adminName} hat für ${playerName} ${challengeLabel} gestartet (${gameName})`;

        default: {
          const field = log?.metadata?.field;
          const oldValue = log?.metadata?.old_value;
          const newValue = log?.metadata?.new_value;

          if (field) {
            const fieldLabel = formatActivityFieldLabel(field);
            return `${adminName} hat bei ${challengeLabel} ${fieldLabel} von ${formatActivityValue(oldValue)} auf ${formatActivityValue(newValue)} geändert (${gameName})`;
          }

          return `${adminName} hat ${challengeLabel} geändert (${gameName})`;
        }
      }
    }

    default:
      return getActivityEventLabel(log.event_type);
  }
}

/* ============================================================
 * IMPORTANT WRAPPERS - GAMEPLAY
 * ============================================================ */

async function logChallengeStarted({ gameId, playerId, challengeId, metadata = {} }) {
  return await insertActivityLog({
    gameId,
    playerId,
    challengeId,
    eventType: ACTIVITY_EVENT_TYPES.CHALLENGE_STARTED,
    entityType: "challenge",
    entityId: challengeId,
    metadata
  });
}

async function logChallengeCompleted({
  gameId,
  playerId,
  challengeId,
  pointsDelta = null,
  metadata = {}
}) {
  return await insertActivityLog({
    gameId,
    playerId,
    challengeId,
    eventType: ACTIVITY_EVENT_TYPES.CHALLENGE_COMPLETED,
    entityType: "challenge",
    entityId: challengeId,
    pointsDelta,
    metadata
  });
}

async function logChallengeFailed({ gameId, playerId, challengeId, metadata = {} }) {
  return await insertActivityLog({
    gameId,
    playerId,
    challengeId,
    eventType: ACTIVITY_EVENT_TYPES.CHALLENGE_FAILED,
    entityType: "challenge",
    entityId: challengeId,
    metadata
  });
}

async function logChallengeReset({ gameId, playerId, challengeId, metadata = {} }) {
  return await insertActivityLog({
    gameId,
    playerId,
    challengeId,
    eventType: ACTIVITY_EVENT_TYPES.CHALLENGE_RESET,
    entityType: "challenge",
    entityId: challengeId,
    metadata
  });
}

async function logBingoAwarded({
  gameId,
  playerId,
  pointsDelta = null,
  metadata = {}
}) {
  return await insertActivityLog({
    gameId,
    playerId,
    eventType: ACTIVITY_EVENT_TYPES.BINGO_AWARDED,
    entityType: "bingo",
    pointsDelta,
    metadata
  });
}

async function logPointsAwarded({
  gameId,
  playerId,
  challengeId = null,
  pointsDelta = null,
  metadata = {}
}) {
  return await insertActivityLog({
    gameId,
    playerId,
    challengeId,
    eventType: ACTIVITY_EVENT_TYPES.POINTS_AWARDED,
    entityType: challengeId ? "challenge" : "score",
    entityId: challengeId,
    pointsDelta,
    metadata
  });
}

async function logPhotoUploaded({
  gameId,
  playerId,
  challengeId = null,
  liveChallengeId = null,
  metadata = {}
}) {
  return await insertActivityLog({
    gameId,
    playerId,
    challengeId,
    liveChallengeId,
    eventType: ACTIVITY_EVENT_TYPES.PHOTO_UPLOADED,
    entityType: liveChallengeId ? "live_challenge" : "challenge",
    entityId: liveChallengeId || challengeId,
    metadata
  });
}

/* ============================================================
 * IMPORTANT WRAPPERS - LIVE
 * ============================================================ */

async function logLiveChallengeCreated({
  gameId,
  adminPlayerId = null,
  liveChallengeId,
  metadata = {}
}) {
  return await insertActivityLog({
    gameId,
    adminPlayerId,
    liveChallengeId,
    eventType: ACTIVITY_EVENT_TYPES.LIVE_CHALLENGE_CREATED,
    entityType: "live_challenge",
    entityId: liveChallengeId,
    metadata
  });
}

async function logLiveChallengeCompleted({
  gameId,
  playerId,
  liveChallengeId,
  pointsDelta = null,
  metadata = {}
}) {
  return await insertActivityLog({
    gameId,
    playerId,
    liveChallengeId,
    eventType: ACTIVITY_EVENT_TYPES.LIVE_CHALLENGE_COMPLETED,
    entityType: "live_challenge",
    entityId: liveChallengeId,
    pointsDelta,
    metadata
  });
}

async function logLiveChallengeExpired({
  gameId,
  liveChallengeId,
  metadata = {}
}) {
  return await insertActivityLog({
    gameId,
    liveChallengeId,
    eventType: ACTIVITY_EVENT_TYPES.LIVE_CHALLENGE_EXPIRED,
    entityType: "live_challenge",
    entityId: liveChallengeId,
    metadata
  });
}

async function logLiveChallengeManuallyEnded({
  gameId,
  adminPlayerId = null,
  liveChallengeId,
  metadata = {}
}) {
  return await insertActivityLog({
    gameId,
    adminPlayerId,
    liveChallengeId,
    eventType: ACTIVITY_EVENT_TYPES.LIVE_CHALLENGE_MANUALLY_ENDED,
    entityType: "live_challenge",
    entityId: liveChallengeId,
    metadata
  });
}

/* ============================================================
 * IMPORTANT WRAPPERS - ADMIN
 * ============================================================ */

async function logAdminPlayerBlocked({
  gameId,
  adminPlayerId,
  playerId,
  metadata = {}
}) {
  return await insertActivityLog({
    gameId,
    playerId,
    adminPlayerId,
    eventType: ACTIVITY_EVENT_TYPES.ADMIN_PLAYER_BLOCKED,
    entityType: "player",
    entityId: playerId,
    metadata
  });
}

async function logAdminPlayerUnblocked({
  gameId,
  adminPlayerId,
  playerId,
  metadata = {}
}) {
  return await insertActivityLog({
    gameId,
    playerId,
    adminPlayerId,
    eventType: ACTIVITY_EVENT_TYPES.ADMIN_PLAYER_UNBLOCKED,
    entityType: "player",
    entityId: playerId,
    metadata
  });
}

async function logAdminScoreChanged({
  gameId,
  adminPlayerId,
  playerId,
  metadata = {}
}) {
  return await insertActivityLog({
    gameId,
    playerId,
    adminPlayerId,
    eventType: ACTIVITY_EVENT_TYPES.ADMIN_SCORE_CHANGED,
    entityType: "player_game_state",
    entityId: playerId,
    metadata
  });
}

async function logAdminCooldownChanged({
  gameId,
  adminPlayerId,
  playerId,
  metadata = {}
}) {
  return await insertActivityLog({
    gameId,
    playerId,
    adminPlayerId,
    eventType: ACTIVITY_EVENT_TYPES.ADMIN_COOLDOWN_CHANGED,
    entityType: "player_game_state",
    entityId: playerId,
    metadata
  });
}

async function logAdminPlayerGameReset({
  gameId,
  adminPlayerId,
  playerId,
  metadata = {}
}) {
  return await insertActivityLog({
    gameId,
    playerId,
    adminPlayerId,
    eventType: ACTIVITY_EVENT_TYPES.ADMIN_PLAYER_GAME_RESET,
    entityType: "player_game_state",
    entityId: playerId,
    metadata
  });
}

async function logAdminPlayerDeleted({
  gameId = null,
  adminPlayerId,
  playerId,
  metadata = {}
}) {
  return await insertActivityLog({
    gameId,
    playerId,
    adminPlayerId,
    eventType: ACTIVITY_EVENT_TYPES.ADMIN_PLAYER_DELETED,
    entityType: "player",
    entityId: playerId,
    metadata
  });
}

async function logAdminGameCreated({
  gameId,
  adminPlayerId,
  metadata = {}
}) {
  return await insertActivityLog({
    gameId,
    adminPlayerId,
    eventType: ACTIVITY_EVENT_TYPES.ADMIN_GAME_CREATED,
    entityType: "game",
    entityId: gameId,
    metadata
  });
}

async function logAdminGameDeleted({
  gameId,
  adminPlayerId,
  metadata = {}
}) {
  return await insertActivityLog({
    gameId,
    adminPlayerId,
    eventType: ACTIVITY_EVENT_TYPES.ADMIN_GAME_DELETED,
    entityType: "game",
    entityId: gameId,
    metadata
  });
}

async function logAdminGameDuplicated({
  gameId,
  adminPlayerId,
  metadata = {}
}) {
  return await insertActivityLog({
    gameId,
    adminPlayerId,
    eventType: ACTIVITY_EVENT_TYPES.ADMIN_GAME_DUPLICATED,
    entityType: "game",
    entityId: gameId,
    metadata
  });
}

async function logAdminGameUpdated({
  gameId,
  adminPlayerId,
  metadata = {}
}) {
  return await insertActivityLog({
    gameId,
    adminPlayerId,
    eventType: ACTIVITY_EVENT_TYPES.ADMIN_GAME_UPDATED,
    entityType: "game",
    entityId: gameId,
    metadata
  });
}

async function logAdminChallengeUpdated({
  gameId,
  adminPlayerId,
  challengeId,
  metadata = {}
}) {
  return await insertActivityLog({
    gameId,
    adminPlayerId,
    challengeId,
    eventType: ACTIVITY_EVENT_TYPES.ADMIN_CHALLENGE_UPDATED,
    entityType: "challenge",
    entityId: challengeId,
    metadata
  });
}

/* ============================================================
 * LOGS TAB - DATA LOAD
 * ============================================================ */

async function loadAllPlayersForAdminLogs() {
  adminPlayers = await DataService.players.loadAllSafe();
}

async function loadAllGamesForAdminLogs() {
  adminGames = await DataService.games.loadAll();
}

/* ============================================================
 * LOGS TAB - INIT
 * ============================================================ */

async function initializeAdminLogsTab() {
  if (!adminLogsInitialized) {
    ensureAdminLogsTabLayout();

    await Promise.all([
      loadAllPlayersForAdminLogs(),
      loadAllGamesForAdminLogs()
    ]);

    if (!adminLogsFilterGameId && typeof adminCurrentGameId !== "undefined" && adminCurrentGameId) {
      adminLogsFilterGameId = String(adminCurrentGameId);
    }

    renderAdminLogsFilterOptions();
    attachAdminLogsFilterEvents();

    adminLogsInitialized = true;
  }

  await renderAdminLogsList();
}

/* ============================================================
 * LOGS TAB - LAYOUT
 * ============================================================ */


function ensureAdminLogsTabLayout() {
  const tabEl = document.getElementById("tab-logs");
  if (!tabEl) return;

  const alreadyBuilt = document.getElementById("adminLogsLayout");
  if (alreadyBuilt) return;

  tabEl.innerHTML = `
    <div id="adminLogsLayout" class="admin-logs-layout">
      <div class="admin-logs-filter-grid">
        <div class="admin-detail-card">
          <div class="admin-detail-label">Spiel</div>
          <select id="adminLogsGameFilter" class="admin-logs-select">
            <option value="">Alle Spiele</option>
          </select>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Spieler</div>
          <select id="adminLogsPlayerFilter" class="admin-logs-select">
            <option value="">Alle Spieler</option>
          </select>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Event-Typ</div>
          <select id="adminLogsEventTypeFilter" class="admin-logs-select">
            <option value="">Alle Events</option>
          </select>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Kategorie</div>
          <select id="adminLogsCategoryFilter" class="admin-logs-select">
            <option value="all">Alle</option>
            <option value="gameplay">Gameplay</option>
            <option value="live">Live</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Von</div>
          <input id="adminLogsDateFromFilter" class="admin-logs-select" type="date" />
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Bis</div>
          <input id="adminLogsDateToFilter" class="admin-logs-select" type="date" />
        </div>

        <div class="admin-detail-card admin-logs-search-card">
          <div class="admin-detail-label">Suche</div>
          <input
            id="adminLogsSearchFilter"
            class="admin-logs-select"
            type="search"
            placeholder="Spieler, Spiel, Aufgabe oder Ereignis"
          />
        </div>
      </div>

      <div class="admin-logs-controls">
        <button id="adminLogsResetFiltersBtn" type="button" class="secondary-btn">
          Filter zurücksetzen
        </button>

        <div id="adminLogsResultsInfo" class="admin-logs-results-info">
          Logs werden geladen...
        </div>
      </div>

      <div id="adminLogsList">
        <p class="admin-details-empty">Logs werden geladen...</p>
      </div>
    </div>
  `;
}

function renderAdminLogsFilterOptions() {
  const gameSelect = document.getElementById("adminLogsGameFilter");
  const playerSelect = document.getElementById("adminLogsPlayerFilter");
  const eventTypeSelect = document.getElementById("adminLogsEventTypeFilter");
  const categorySelect = document.getElementById("adminLogsCategoryFilter");
  const searchInput = document.getElementById("adminLogsSearchFilter");
  const dateFromInput = document.getElementById("adminLogsDateFromFilter");
  const dateToInput = document.getElementById("adminLogsDateToFilter");

  if (gameSelect) {
    gameSelect.innerHTML = `<option value="">Alle Spiele</option>`;

    adminGames
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "de"))
      .forEach(game => {
        const option = document.createElement("option");
        option.value = String(game.id);
        option.textContent = game.name || `Spiel ${game.id}`;
        option.selected = String(adminLogsFilterGameId) === String(game.id);
        gameSelect.appendChild(option);
      });
  }

  if (playerSelect) {
    playerSelect.innerHTML = `<option value="">Alle Spieler</option>`;

    adminPlayers
      .slice()
      .sort((a, b) => {
        const aName = a.display_name || a.username || "";
        const bName = b.display_name || b.username || "";
        return String(aName).localeCompare(String(bName), "de");
      })
      .forEach(player => {
        const option = document.createElement("option");
        option.value = String(player.id);
        option.textContent = player.display_name || player.username || `Spieler ${player.id}`;
        option.selected = String(adminLogsFilterPlayerId) === String(player.id);
        playerSelect.appendChild(option);
      });
  }

  if (eventTypeSelect) {
    eventTypeSelect.innerHTML = `<option value="">Alle Events</option>`;

    Object.values(ACTIVITY_EVENT_TYPES)
      .slice()
      .sort((a, b) =>
        getActivityEventLabel(a).localeCompare(getActivityEventLabel(b), "de")
      )
      .forEach(eventType => {
        const option = document.createElement("option");
        option.value = eventType;
        option.textContent = getActivityEventLabel(eventType);
        option.selected = adminLogsFilterEventType === eventType;
        eventTypeSelect.appendChild(option);
      });
  }

  if (categorySelect) categorySelect.value = adminLogsQuickFilter || "all";
  if (searchInput) searchInput.value = adminLogsSearch || "";
  if (dateFromInput) dateFromInput.value = adminLogsDateFrom || "";
  if (dateToInput) dateToInput.value = adminLogsDateTo || "";
}

function attachAdminLogsFilterEvents() {
  const gameSelect = document.getElementById("adminLogsGameFilter");
  const playerSelect = document.getElementById("adminLogsPlayerFilter");
  const eventTypeSelect = document.getElementById("adminLogsEventTypeFilter");
  const categorySelect = document.getElementById("adminLogsCategoryFilter");
  const searchInput = document.getElementById("adminLogsSearchFilter");
  const dateFromInput = document.getElementById("adminLogsDateFromFilter");
  const dateToInput = document.getElementById("adminLogsDateToFilter");
  const resetBtn = document.getElementById("adminLogsResetFiltersBtn");

  const bindChange = (element, update) => {
    if (!element || element.dataset.logsBound === "true") return;

    element.addEventListener("change", async () => {
      update(element.value || "");
      await renderAdminLogsList();
    });

    element.dataset.logsBound = "true";
  };

  bindChange(gameSelect, value => {
    adminLogsFilterGameId = value;
  });

  bindChange(playerSelect, value => {
    adminLogsFilterPlayerId = value;
  });

  bindChange(eventTypeSelect, value => {
    adminLogsFilterEventType = value;
  });

  bindChange(categorySelect, value => {
    adminLogsQuickFilter = value || "all";
  });

  bindChange(dateFromInput, value => {
    adminLogsDateFrom = value;
  });

  bindChange(dateToInput, value => {
    adminLogsDateTo = value;
  });

  if (searchInput && searchInput.dataset.logsBound !== "true") {
    let searchTimer = null;

    searchInput.addEventListener("input", () => {
      adminLogsSearch = searchInput.value || "";

      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        renderAdminLogsList();
      }, 180);
    });

    searchInput.addEventListener("keydown", async event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      adminLogsSearch = searchInput.value || "";
      await renderAdminLogsList();
    });

    searchInput.dataset.logsBound = "true";
  }

  if (resetBtn && resetBtn.dataset.logsBound !== "true") {
    resetBtn.addEventListener("click", async () => {
      adminLogsFilterGameId = "";
      adminLogsFilterPlayerId = "";
      adminLogsFilterEventType = "";
      adminLogsQuickFilter = "all";
      adminLogsSearch = "";
      adminLogsDateFrom = "";
      adminLogsDateTo = "";

      renderAdminLogsFilterOptions();
      await renderAdminLogsList();
    });

    resetBtn.dataset.logsBound = "true";
  }
}

function getEffectiveAdminLogsEventFilter() {
  const dropdownFilter = adminLogsFilterEventType || "";

  if (dropdownFilter) return dropdownFilter;
  if (adminLogsQuickFilter === "gameplay") return ACTIVITY_EVENT_GROUPS.gameplay;
  if (adminLogsQuickFilter === "live") return ACTIVITY_EVENT_GROUPS.live;
  if (adminLogsQuickFilter === "admin") return ACTIVITY_EVENT_GROUPS.admin;

  return null;
}

function filterAdminLogsClientSide(logs) {
  const searchTokens = String(adminLogsSearch || "")
    .toLowerCase()
    .split(/[,\s]+/)
    .map(token => token.trim())
    .filter(Boolean);

  const fromTime = adminLogsDateFrom
    ? new Date(`${adminLogsDateFrom}T00:00:00`).getTime()
    : null;

  const toTime = adminLogsDateTo
    ? new Date(`${adminLogsDateTo}T23:59:59.999`).getTime()
    : null;

  return (logs || []).filter(log => {
    const createdTime = new Date(log.created_at).getTime();

    if (fromTime !== null && createdTime < fromTime) return false;
    if (toTime !== null && createdTime > toTime) return false;

    if (searchTokens.length) {
      const haystack = [
        formatActivityLogMessage(log),
        getActivityEventLabel(log.event_type),
        getActivityPlayerNameFromLogOrMetadata(log),
        getActivityAdminNameFromLogOrMetadata(log),
        getActivityChallengeLabel(log),
        getActivityLiveChallengeLabel(log),
        getActivityGameLabel(log),
        log.event_type
      ]
        .join(" ")
        .toLowerCase();

      if (!searchTokens.every(token => haystack.includes(token))) {
        return false;
      }
    }

    return true;
  });
}

async function loadFilteredAdminLogs() {
  const effectiveEventFilter = getEffectiveAdminLogsEventFilter();

  const logs = await loadActivityLogs({
    gameId: adminLogsFilterGameId || null,
    playerId: adminLogsFilterPlayerId || null,
    eventType: effectiveEventFilter,
    limit: ADMIN_LOGS_FETCH_LIMIT
  });

  return filterAdminLogsClientSide(logs);
}

async function renderAdminLogsList() {
  const logs = await loadFilteredAdminLogs();
  await renderAdminLogsListFromData(logs);
}

async function renderAdminLogsListFromData(logs) {
  const listEl = document.getElementById("adminLogsList");
  const infoEl = document.getElementById("adminLogsResultsInfo");

  if (!listEl) return;

  adminLogsCurrentRows = logs || [];

  const signature = JSON.stringify(
    adminLogsCurrentRows.map(log => [log.id, log.created_at])
  );
  lastAdminLogsSignature = signature;

  if (infoEl) {
    const count = adminLogsCurrentRows.length;
    infoEl.textContent = `${count} Log${count === 1 ? "" : "s"} gefunden`;
  }

  if (!adminLogsCurrentRows.length) {
    listEl.innerHTML = `<p class="admin-details-empty">Keine Logs gefunden.</p>`;
    return;
  }

  let html = "";

  adminLogsCurrentRows.forEach(log => {
    const timeText = formatActivityDateTime(log.created_at);
    const message = formatActivityLogMessage(log);

    html += `
      <div class="admin-log-row" data-log-id="${log.id}">
        <div class="admin-log-main">${escapeActivityHtml(message)}</div>

        <div class="admin-log-side">
          <div class="admin-log-time">${escapeActivityHtml(timeText)}</div>

          <button
            type="button"
            class="admin-log-push-btn"
            data-log-id="${log.id}"
            title="Als Push teilen"
            aria-label="Logeintrag als Push teilen"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="18" cy="5" r="2.5"></circle>
              <circle cx="6" cy="12" r="2.5"></circle>
              <circle cx="18" cy="19" r="2.5"></circle>
              <path d="M8.2 10.9 15.8 6.2"></path>
              <path d="M8.2 13.1 15.8 17.8"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  });

  listEl.innerHTML = html;
  attachAdminLogPushShareEvents();
}

async function openAdminLogEntry(log) {
  if (!log) return;

  adminLogsFilterPlayerId = log.player_id ? String(log.player_id) : "";
  adminLogsFilterGameId = log.game_id ? String(log.game_id) : "";
  adminLogsFilterEventType = "";
  adminLogsQuickFilter = "all";
  adminLogsSearch = "";
  adminLogsDateFrom = "";
  adminLogsDateTo = "";

  if (typeof activateAdminTabByName === "function") {
    await activateAdminTabByName("logs");
  } else {
    await initializeAdminLogsTab();
  }

  renderAdminLogsFilterOptions();
  await renderAdminLogsList();

  requestAnimationFrame(() => {
    const row = document.querySelector(`.admin-log-row[data-log-id="${log.id}"]`);
    if (!row) return;

    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.add("admin-log-row-highlight");
    window.setTimeout(() => row.classList.remove("admin-log-row-highlight"), 2200);
  });
}

async function refreshAdminLogsListIfNeeded() {
  const logs = await loadFilteredAdminLogs();

  const signature = JSON.stringify(
    (logs || []).map(log => [log.id, log.created_at])
  );

  if (signature === lastAdminLogsSignature) return;
  await renderAdminLogsListFromData(logs);
}

/* ============================================================
 * LOGS TAB - PUSH SHARE
 * ============================================================ */

function attachAdminLogPushShareEvents() {
  document.querySelectorAll(".admin-log-push-btn").forEach(btn => {
    if (btn.dataset.bound === "true") return;

    btn.addEventListener("click", async (event) => {
      event.stopPropagation();

      const logId = Number(btn.dataset.logId);
      if (!logId) return;

      await handleAdminShareLogAsPush(logId);
    });

    btn.dataset.bound = "true";
  });
}

async function handleAdminShareLogAsPush(logId) {
  const log = adminLogsCurrentRows.find(row => Number(row.id) === Number(logId));

  if (!log) {
    alert("Logeintrag konnte nicht gefunden werden.");
    return;
  }

  const payload = buildAdminPushPrefillFromLog(log);

  if (typeof activateAdminTabByName === "function") {
    await activateAdminTabByName("push");
  }

  if (typeof prefillAdminPushFormFromLog === "function") {
    await prefillAdminPushFormFromLog(payload);
    return;
  }

  alert("Push-Tab konnte nicht vorausgefüllt werden. Bitte prüfe, ob admin_push.js geladen ist.");
}

function buildAdminPushPrefillFromLog(log) {
  const eventLabel = getActivityEventLabel(log.event_type);
  const message = formatActivityLogMessage(log);
  const gameName = getActivityGameLabel(log);

  let title = eventLabel || "Bingo Update";

  if (log.event_type === ACTIVITY_EVENT_TYPES.LIVE_CHALLENGE_CREATED) {
    title = `Neue Live-Challenge: ${getActivityLiveChallengeLabel(log)}`;
  } else if (log.event_type === ACTIVITY_EVENT_TYPES.LIVE_CHALLENGE_COMPLETED) {
    title = `Live-Challenge gewonnen: ${getActivityLiveChallengeLabel(log)}`;
  } else if (log.event_type === ACTIVITY_EVENT_TYPES.BINGO_AWARDED) {
    title = "Bingo erreicht!";
  } else if (log.event_type === ACTIVITY_EVENT_TYPES.ADMIN_GAME_UPDATED) {
    title = `Spiel geändert: ${gameName}`;
  }

  return {
    title,
    message,
    targetType: log.game_id ? "game" : "all",
    targetGameId: log.game_id || null,
    targetPlayerId: null,
    launchUrl: "https://ingsi1v3r.github.io/Bingov2/",
    metadata: {
      source: "admin_logs_share",
      activity_log_id: log.id,
      event_type: log.event_type || null,
      game_id: log.game_id || null,
      player_id: log.player_id || null,
      challenge_id: log.challenge_id || null,
      live_challenge_id: log.live_challenge_id || null
    }
  };
}

function escapeActivityHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ============================================================
 * PLAYER LAST ACTIVITY
 * ============================================================ */

/**
 * Lädt den letzten relevanten Activity-Log-Eintrag
 * für einen Spieler in einem bestimmten Spiel.
 */
async function loadLastActivityLogForPlayerInGame(playerId, gameId) {
  return await DataService.logs.loadLastForPlayerInGame(playerId, gameId);
}

function formatLastActivityShort(log) {
  if (!log) return "Noch keine Aktivität";

  const challengeLabel = getActivityChallengeLabel(log);
  const liveLabel = getActivityLiveChallengeLabel(log);
  const timeText = formatActivityDateTime(log.created_at);

  switch (log.event_type) {
    case ACTIVITY_EVENT_TYPES.CHALLENGE_STARTED:
      return `${challengeLabel} gestartet, ${timeText}`;

    case ACTIVITY_EVENT_TYPES.CHALLENGE_COMPLETED: {
      const pointsText =
        log.points_delta !== null && log.points_delta !== undefined
          ? ` (+${log.points_delta}P)`
          : "";

      const variantText = log?.metadata?.success_variant_label
        ? `: ${log.metadata.success_variant_label}`
        : "";

      return `${challengeLabel} abgeschlossen${variantText}${pointsText}, ${timeText}`;
    }

    case ACTIVITY_EVENT_TYPES.CHALLENGE_FAILED:
      return `${challengeLabel} aufgegeben, ${timeText}`;

    case ACTIVITY_EVENT_TYPES.CHALLENGE_RESET:
      return `${challengeLabel} zurückgesetzt, ${timeText}`;

    case ACTIVITY_EVENT_TYPES.BINGO_AWARDED: {
      const lineLabel = getActivityBingoLineLabel(log);

      const pointsText =
        log.points_delta !== null && log.points_delta !== undefined
          ? ` (+${log.points_delta}P)`
          : "";

      const firstText = log?.metadata?.is_first_for_line
        ? " als Erster"
        : "";

      return `${lineLabel} Bingo${firstText} erreicht${pointsText}, ${timeText}`;
    }

    case ACTIVITY_EVENT_TYPES.PHOTO_UPLOADED:
      return `Foto für ${challengeLabel} hochgeladen, ${timeText}`;

    case ACTIVITY_EVENT_TYPES.LIVE_CHALLENGE_COMPLETED:
      return `${liveLabel} gewonnen, ${timeText}`;

    case ACTIVITY_EVENT_TYPES.LIVE_CHALLENGE_CREATED:
      return `${liveLabel} erstellt, ${timeText}`;

    case ACTIVITY_EVENT_TYPES.ADMIN_SCORE_CHANGED:
      return `Score geändert, ${timeText}`;

    case ACTIVITY_EVENT_TYPES.ADMIN_COOLDOWN_CHANGED:
      return `Cooldown geändert, ${timeText}`;

    case ACTIVITY_EVENT_TYPES.ADMIN_PLAYER_GAME_RESET:
      return `Spielstand zurückgesetzt, ${timeText}`;

    case ACTIVITY_EVENT_TYPES.ADMIN_CHALLENGE_UPDATED: {
      const action = log?.metadata?.action || null;

      switch (action) {
        case "admin_mark_completed":
          return `${challengeLabel} abgeschlossen, ${timeText}`;
        case "admin_reset_player_challenge":
          return `${challengeLabel} aberkannt, ${timeText}`;
        case "admin_set_player_challenge_inactive":
          return `${challengeLabel} inaktiv gesetzt, ${timeText}`;
        case "admin_set_player_challenge_active":
          return `${challengeLabel} gestartet, ${timeText}`;
        default:
          return `${challengeLabel} geändert, ${timeText}`;
      }
    }

    default:
      return `${getActivityEventLabel(log.event_type)}, ${timeText}`;
  }
}

/* ============================================================
 * VALUE FORMAT HELPERS
 * ============================================================ */

function formatActivityValue(value) {
  if (value === null || value === undefined || value === "") {
    return "leer";
  }

  if (typeof value === "boolean") {
    return value ? "Ja" : "Nein";
  }

  return String(value);
}

function formatActivityFieldLabel(field) {
  switch (field) {
    case "name":
      return "Namen";
    case "cooldown_seconds":
      return "Cooldown";
    case "bingo_bonus_points":
      return "Bingo-Bonus";
    case "first_bingo_bonus_points":
      return "First-Bingo-Bonus";
    case "is_active":
      return "Status";
    case "visibility":
      return "Sichtbarkeit";
    case "game_password_hash":
      return "Spielpasswort";
    case "title":
      return "Namen";
    case "task":
      return "Beschreibung";
    case "details":
      return "Hinweistext";
    case "success_text":
      return "Congratulation Text";
    case "points":
      return "Punkte";
    case "success_variant_1":
      return "Variante 1";
    case "success_variant_2":
      return "Variante 2";
    case "success_variant_3":
      return "Variante 3";
    case "requires_photo_proof":
      return "Foto erforderlich";
    case "category_icon":
      return "Kategorie";
    default:
      return field || "Feld";
  }
}

function getActivityBingoLineLabel(log) {
  const lineKey =
    log?.metadata?.line_key ??
    log?.metadata?.line_index ??
    null;

  const gridSize =
    log?.metadata?.grid_size ||
    log?.game?.grid_size ||
    5;

  if (typeof formatAdminBingoLineName === "function") {
    return formatAdminBingoLineName(lineKey, gridSize);
  }

  return `Bingo ${lineKey}`;
}