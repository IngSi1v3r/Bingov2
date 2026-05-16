/**
 * ============================================================
 * push_automation.js
 * ============================================================
 *
 * Zweck:
 * - Kleine, zentrale Hook-Schicht fuer automatische Push-Nachrichten.
 * - Der eigentliche Versand passiert weiter ueber die Edge Function send-push.
 * - Diese Datei veraendert keine bestehende Spiellogik; sie wird nur nach
 *   erfolgreichen DB-Aktionen aufgerufen.
 *
 * Automatik Stufe 2:
 * - Neue Live-Challenge
 * - Live-Challenge beendet / expired / manuell beendet
 * - Spiel aktiviert
 * - Spieler zu Spiel hinzugefuegt
 * - Erstes Bingo im Spiel
 *
 * Noch nicht enthalten:
 * - Cooldown abgelaufen
 */

/* ============================================================
 * KONSTANTEN
 * ============================================================ */

const PUSH_AUTOMATION_DEFAULT_LAUNCH_URL = "https://ingsi1v3r.github.io/Bingov2/";

const PUSH_AUTOMATION_TYPES = {
  LIVE_CREATED: "automatic_live_created",
  LIVE_FINISHED: "automatic_live_finished",
  GAME_ACTIVATED: "automatic_game_activated",
  PLAYER_ADDED: "automatic_player_added",
  FIRST_GAME_BINGO: "automatic_first_game_bingo"
};

/* ============================================================
 * BASIS-HELPER
 * ============================================================ */

function pushAutomationCleanText(value) {
  return String(value || "").trim();
}

function pushAutomationGetPlayerName(player) {
  if (!player) return "Ein Spieler";
  return player.display_name || player.username || `Spieler ${player.id || "?"}`;
}

function pushAutomationGetGameName(game) {
  if (!game) return "deinem Spiel";
  return game.name || `Spiel ${game.id || "?"}`;
}

async function pushAutomationLoadGame(gameId) {
  if (!gameId) return null;

  if (typeof DataService !== "undefined" && DataService?.games?.loadById) {
    return await DataService.games.loadById(gameId);
  }

  const { data, error } = await supabaseClient
    .from("games")
    .select("*")
    .eq("id", gameId)
    .maybeSingle();

  if (error) {
    console.warn("Push-Automation: Spiel konnte nicht geladen werden:", error);
    return null;
  }

  return data || null;
}

async function pushAutomationLoadPlayer(playerId) {
  if (!playerId) return null;

  if (typeof DataService !== "undefined" && DataService?.players?.loadById) {
    return await DataService.players.loadById(playerId);
  }

  const { data, error } = await supabaseClient
    .from("players")
    .select("id, username, display_name, role, is_blocked")
    .eq("id", playerId)
    .maybeSingle();

  if (error) {
    console.warn("Push-Automation: Spieler konnte nicht geladen werden:", error);
    return null;
  }

  return data || null;
}

async function pushAutomationLoadSettings(gameId) {
  if (!gameId) return null;

  const { data, error } = await supabaseClient
    .from("game_push_settings")
    .select("*")
    .eq("game_id", gameId)
    .maybeSingle();

  if (error) {
    console.warn("Push-Automation: Einstellungen konnten nicht geladen werden:", error);
    return null;
  }

  return data || null;
}

async function pushAutomationIsEnabled(gameId, settingKey) {
  if (!gameId || !settingKey) return false;

  const settings = await pushAutomationLoadSettings(gameId);

  // Kein Settings-Datensatz = Default aktiv.
  if (!settings) return true;

  return settings[settingKey] !== false;
}

async function pushAutomationInvokeSendPush(payload) {
  try {
    if (!supabaseClient?.functions?.invoke) {
      console.warn("Push-Automation: supabaseClient.functions.invoke nicht verfuegbar.");
      return null;
    }

    const { data, error } = await supabaseClient.functions.invoke("send-push", {
      body: payload
    });

    if (error) {
      console.warn("Push-Automation: Edge Function Fehler:", error);
      return null;
    }

    if (!data?.ok) {
      console.warn("Push-Automation: Push nicht gesendet:", data?.error || data);
      return data || null;
    }

    return data;
  } catch (error) {
    console.warn("Push-Automation: Versand fehlgeschlagen:", error);
    return null;
  }
}

async function pushAutomationSendIfEnabled({
  gameId,
  settingKey,
  type,
  title,
  message,
  targetType = "game",
  targetGameId = null,
  targetPlayerId = null,
  liveChallengeId = null,
  launchUrl = PUSH_AUTOMATION_DEFAULT_LAUNCH_URL,
  metadata = {}
}) {
  const isEnabled = await pushAutomationIsEnabled(gameId, settingKey);
  if (!isEnabled) return null;

  const cleanTitle = pushAutomationCleanText(title);
  const cleanMessage = pushAutomationCleanText(message);

  if (!cleanTitle || !cleanMessage) return null;

  return await pushAutomationInvokeSendPush({
    type,
    title: cleanTitle,
    message: cleanMessage,
    targetType,
    targetGameId: targetGameId || gameId || null,
    targetPlayerId: targetPlayerId || null,
    liveChallengeId: liveChallengeId || null,
    launchUrl,
    createdByAdminId:
      typeof adminPlayer !== "undefined" && adminPlayer?.id
        ? adminPlayer.id
        : null,
    metadata: {
      source: "push_automation",
      ...metadata
    }
  });
}

/* ============================================================
 * AUTOMATIK: LIVE-CHALLENGE ERSTELLT / AKTIVIERT
 * ============================================================ */

async function pushAutomationSendLiveCreated(liveChallenge) {
  if (!liveChallenge?.id || !liveChallenge?.game_id) return null;

  const game = await pushAutomationLoadGame(liveChallenge.game_id);

  return await pushAutomationSendIfEnabled({
    gameId: liveChallenge.game_id,
    settingKey: "push_live_created_enabled",
    type: PUSH_AUTOMATION_TYPES.LIVE_CREATED,
    title: `Neue Live-Challenge: ${liveChallenge.title || "Spontanchallenge"}`,
    message: "Mach schnell mit - nur der/die Schnellste holt die Punkte!",
    targetType: "game",
    targetGameId: liveChallenge.game_id,
    metadata: {
      live_challenge_id: liveChallenge.id,
      live_challenge_title: liveChallenge.title || null,
      game_name: pushAutomationGetGameName(game),
      points: liveChallenge.points ?? null,
      requires_photo_proof: liveChallenge.requires_photo_proof === true
    }
  });
}

/* ============================================================
 * AUTOMATIK: LIVE-CHALLENGE BEENDET
 * ============================================================ */

async function pushAutomationSendLiveFinished(liveChallenge, options = {}) {
  if (!liveChallenge?.id || !liveChallenge?.game_id) return null;

  const game = await pushAutomationLoadGame(liveChallenge.game_id);
  const status = options.status || liveChallenge.status || "finished";

  const title = liveChallenge.title || "Spontanchallenge";

  let message = "Die Live-Challenge ist beendet.";

  if (status === "completed" && liveChallenge.winner_player_id) {
    const winner = await pushAutomationLoadPlayer(liveChallenge.winner_player_id);
    message = `${pushAutomationGetPlayerName(winner)} war am schnellsten.`;
  } else if (status === "expired" || status === "manually_ended") {
    message = "Die Live-Challenge wurde beendet. Schau nach, was passiert ist.";
  }

  return await pushAutomationSendIfEnabled({
    gameId: liveChallenge.game_id,
    settingKey: "push_live_finished_enabled",
    type: PUSH_AUTOMATION_TYPES.LIVE_FINISHED,
    title: `Live-Challenge beendet: ${title}`,
    message,
    targetType: "live_open",
    targetGameId: liveChallenge.game_id,
    liveChallengeId: liveChallenge.id,
    metadata: {
      live_challenge_id: liveChallenge.id,
      live_challenge_title: title,
      game_name: pushAutomationGetGameName(game),
      status,
      winner_player_id: liveChallenge.winner_player_id || null
    }
  });
}

/* ============================================================
 * AUTOMATIK: SPIEL AKTIVIERT
 * ============================================================ */

async function pushAutomationSendGameActivated(game) {
  if (!game?.id) return null;

  return await pushAutomationSendIfEnabled({
    gameId: game.id,
    settingKey: "push_game_activated_enabled",
    type: PUSH_AUTOMATION_TYPES.GAME_ACTIVATED,
    title: `Spiel verfügbar: ${game.name || "Bingo"}`,
    message: "Das Spiel ist jetzt aktiv. Du kannst loslegen!",
    targetType: "all",
    targetGameId: game.id,
    metadata: {
      game_name: game.name || null
    }
  });
}

/* ============================================================
 * AUTOMATIK: SPIELER ZU SPIEL HINZUGEFUEGT
 * ============================================================ */

async function pushAutomationSendPlayerAddedToGame({ playerId, gameId }) {
  if (!playerId || !gameId) return null;

  const game = await pushAutomationLoadGame(gameId);

  return await pushAutomationSendIfEnabled({
    gameId,
    settingKey: "push_player_added_enabled",
    type: PUSH_AUTOMATION_TYPES.PLAYER_ADDED,
    title: `Du wurdest zu ${pushAutomationGetGameName(game)} hinzugefügt`,
    message: "Das Spiel ist jetzt in deiner Spielauswahl verfügbar.",
    targetType: "player",
    targetGameId: gameId,
    targetPlayerId: playerId,
    metadata: {
      game_name: game?.name || null,
      player_id: playerId
    }
  });
}

/* ============================================================
 * AUTOMATIK: ERSTES BINGO IM SPIEL
 * ============================================================ */

async function pushAutomationHasFirstGameBingoPushAlreadyBeenSent(gameId) {
  if (!gameId) return true;

  const { count, error } = await supabaseClient
    .from("push_notifications")
    .select("id", { count: "exact", head: true })
    .eq("type", PUSH_AUTOMATION_TYPES.FIRST_GAME_BINGO)
    .eq("target_game_id", gameId)
    .eq("status", "sent");

  if (error) {
    console.warn("Push-Automation: First-Bingo-Historie konnte nicht geprueft werden:", error);
    return false;
  }

  return (count || 0) > 0;
}

async function pushAutomationSendFirstGameBingo({ gameId, playerId, lineKey = null }) {
  if (!gameId || !playerId) return null;

  const alreadySent = await pushAutomationHasFirstGameBingoPushAlreadyBeenSent(gameId);
  if (alreadySent) return null;

  const [game, player] = await Promise.all([
    pushAutomationLoadGame(gameId),
    pushAutomationLoadPlayer(playerId)
  ]);

  return await pushAutomationSendIfEnabled({
    gameId,
    settingKey: "push_first_game_bingo_enabled",
    type: PUSH_AUTOMATION_TYPES.FIRST_GAME_BINGO,
    title: "Erstes Bingo!",
    message: `${pushAutomationGetPlayerName(player)} hat das erste Bingo in ${pushAutomationGetGameName(game)} geschafft.`,
    targetType: "game",
    targetGameId: gameId,
    metadata: {
      game_name: game?.name || null,
      player_id: playerId,
      player_name: pushAutomationGetPlayerName(player),
      line_key: lineKey
    }
  });
}

/* ============================================================
 * TEST-TRIGGER: COOLDOWN-PUSH-CHECK
 * ============================================================
 * Hinweis:
 * - Die eigentliche Cooldown-Logik laeuft serverseitig in der Edge Function
 *   check-cooldowns.
 * - Fuer Tests wird diese Function alle 10 Sekunden vom Adminpanel aus
 *   angestossen, solange das Adminpanel offen ist.
 * - Durch die Tabelle cooldown_push_notifications ist der Check idempotent:
 *   Auch mehrere Tabs oder wiederholte Aufrufe erzeugen keine doppelten Pushs
 *   fuer denselben Cooldown.
 * - Fuer Produktion kann spaeter ein echter Supabase-Scheduler/Cron verwendet
 *   und dieser Frontend-Test-Trigger entfernt oder deaktiviert werden.
 */

const PUSH_COOLDOWN_TEST_CHECK_ENABLED = true;
const PUSH_COOLDOWN_TEST_CHECK_INTERVAL_MS = 10000;

let pushCooldownTestCheckIntervalId = null;
let pushCooldownTestCheckRunning = false;

function pushAutomationIsAdminPage() {
  return window.location.pathname.toLowerCase().includes("admin");
}

async function pushAutomationRunCooldownCheckOnce() {
  if (pushCooldownTestCheckRunning) return null;
  if (typeof supabaseClient === "undefined") return null;

  pushCooldownTestCheckRunning = true;

  try {
    const { data, error } = await supabaseClient.functions.invoke("check-cooldowns", {
      body: {
        source: "admin_test_poll_10s",
        limit: 100
      }
    });

    if (error) {
      console.warn("Cooldown-Push-Check fehlgeschlagen:", error);
      return null;
    }

    if (data?.sent > 0 || data?.failed > 0) {
      console.info("Cooldown-Push-Check:", data);
    }

    return data || null;
  } catch (error) {
    console.warn("Cooldown-Push-Check Fehler:", error);
    return null;
  } finally {
    pushCooldownTestCheckRunning = false;
  }
}

function startPushAutomationCooldownTestChecker() {
  if (!PUSH_COOLDOWN_TEST_CHECK_ENABLED) return;
  if (!pushAutomationIsAdminPage()) return;
  if (pushCooldownTestCheckIntervalId) return;

  // erster Lauf kurz nach dem Laden, danach alle 10 Sekunden
  setTimeout(() => {
    pushAutomationRunCooldownCheckOnce();
  }, 2500);

  pushCooldownTestCheckIntervalId = setInterval(() => {
    pushAutomationRunCooldownCheckOnce();
  }, PUSH_COOLDOWN_TEST_CHECK_INTERVAL_MS);

  console.info(
    `Cooldown-Push-Testchecker aktiv: alle ${PUSH_COOLDOWN_TEST_CHECK_INTERVAL_MS / 1000}s`
  );
}

function stopPushAutomationCooldownTestChecker() {
  if (!pushCooldownTestCheckIntervalId) return;
  clearInterval(pushCooldownTestCheckIntervalId);
  pushCooldownTestCheckIntervalId = null;
}

setTimeout(() => {
  startPushAutomationCooldownTestChecker();
}, 0);
