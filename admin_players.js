/**
 * ============================================================
 * admin_players.js
 * ============================================================
 *
 * Zweck:
 * Logik- und Datenebene fuer den "Spieler"-Tab im Adminpanel.
 *
 * Diese Datei enthaelt:
 * - State
 * - Initialisierung
 * - Datenladen
 * - allgemeine Player-/Game-/Challenge-Helper
 * - Passwortschutz fuer harte Admin-Aktionen
 * - Spieleraktionen
 * - Challenge-Aktionen
 * - Recompute von Score/Bingos
 *
 * Nicht mehr hier:
 * - HTML-Aufbau
 * - Rendering der Liste/Detailansicht
 * - Modals
 * - Galerie-Rendering
 *
 * Diese UI-Funktionen liegen in:
 * - admin_players_ui.js
 */

/* ============================================================
 * STATE
 * ============================================================ */

let selectedAdminPlayerChallengeContext = null;

/* ============================================================
 * INITIALISIERUNG / DATEN LADEN
 * ============================================================ */

async function initializeAdminPlayersTab() {
  if (typeof ensureAdminPlayersTabLayout === "function") {
    ensureAdminPlayersTabLayout();
  }

  if (typeof ensureAdminPlayerChallengeModal === "function") {
    ensureAdminPlayerChallengeModal();
  }

  await loadAdminPlayersTabData();

  if (typeof renderAdminPlayersList === "function") {
    renderAdminPlayersList();
  }

  if (selectedAdminPlayerId) {
    const selectedPlayer = adminPlayers.find(
      p => Number(p.id) === Number(selectedAdminPlayerId)
    );

    if (selectedPlayer && typeof renderAdminPlayerDetails === "function") {
      await renderAdminPlayerDetails(selectedPlayer);
      return;
    }
  }

  if (typeof clearAdminPlayerDetailsView === "function") {
    clearAdminPlayerDetailsView();
  }
}

async function loadAdminPlayersTabData() {
  const bundle = await DataService.bundles.loadAdminPlayersTab();

  adminPlayers = bundle.players || [];
  adminGames = bundle.games || [];
  adminPlayerStates = bundle.playerStates || [];
  adminPlayerChallenges = bundle.playerChallenges || [];
  adminPlayerBingos = bundle.playerBingos || [];
  adminChallenges = bundle.challenges || [];
}

/* ============================================================
 * KOMPATIBILITAETS-WRAPPER
 * ============================================================ */

async function loadAllPlayersForAdmin() {
  adminPlayers = await DataService.players.loadAllSafe();
}

async function loadAllGamesForAdmin() {
  adminGames = await DataService.games.loadAll();
}

async function loadAllPlayerStatesForAdmin() {
  adminPlayerStates = await DataService.playerState.loadAll();
}

async function loadAllPlayerChallengesForAdmin() {
  adminPlayerChallenges = await DataService.playerChallenges.loadAllActiveAndCompleted();
}

async function loadAllPlayerBingosForAdmin() {
  adminPlayerBingos = await DataService.playerBingos.loadAll();
}

async function loadAllChallengesForAdmin() {
  adminChallenges = await DataService.challenges.loadAllBasic();
}

/* ============================================================
 * ALLGEMEINE PLAYER-HELPER
 * ============================================================ */

function getGameByIdAdmin(gameId) {
  return adminGames.find(game => Number(game.id) === Number(gameId)) || null;
}

function getChallengeByIdAdmin(challengeId) {
  return adminChallenges.find(challenge => Number(challenge.id) === Number(challengeId)) || null;
}

function getChallengeTitleByIdAdmin(challengeId) {
  const challenge = getChallengeByIdAdmin(challengeId);
  return challenge ? challenge.title : `Challenge ${challengeId}`;
}

function getStatesForPlayer(playerId) {
  return adminPlayerStates.filter(row => Number(row.player_id) === Number(playerId));
}

function getAdminGameStateCountForPlayer(playerId) {
  return getStatesForPlayer(playerId).length;
}

function getAdminGameStateGamesForPlayer(playerId) {
  return getStatesForPlayer(playerId)
    .map(row => getGameByIdAdmin(row.game_id))
    .filter(Boolean);
}

function getDisplayStateForPlayer(playerId) {
  const states = getStatesForPlayer(playerId);
  if (!states.length) return null;

  const stateWithActiveChallenge = states.find(row => row.active_challenge_id !== null);
  if (stateWithActiveChallenge) return stateWithActiveChallenge;

  const stateWithCooldown = states.find(row => isCooldownActiveAdmin(row.cooldown_until));
  if (stateWithCooldown) return stateWithCooldown;

  if (adminCurrentGameId) {
    const currentGameState = states.find(
      row => Number(row.game_id) === Number(adminCurrentGameId)
    );
    if (currentGameState) return currentGameState;
  }

  return states[0] || null;
}

function getStateForPlayerInAdminGame(playerId) {
  if (!adminCurrentGameId) return null;

  return adminPlayerStates.find(
    row =>
      Number(row.player_id) === Number(playerId) &&
      Number(row.game_id) === Number(adminCurrentGameId)
  ) || null;
}

function getChallengeRowsForPlayerInGame(playerId, gameId) {
  return adminPlayerChallenges.filter(
    row =>
      Number(row.player_id) === Number(playerId) &&
      Number(row.game_id) === Number(gameId)
  );
}

function getCompletedRowsForPlayerInGame(playerId, gameId) {
  return getChallengeRowsForPlayerInGame(playerId, gameId)
    .filter(row => row.status === "completed")
    .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
}

function getFirstSolverCountForPlayerInGame(playerId, gameId) {
  return getCompletedRowsForPlayerInGame(playerId, gameId)
    .filter(row => row.was_first_solver === true).length;
}

function getBingoCountForPlayerInGame(playerId, gameId) {
  return adminPlayerBingos.filter(
    row =>
      Number(row.player_id) === Number(playerId) &&
      Number(row.game_id) === Number(gameId)
  ).length;
}

function getPlayerChallengeRow(playerId, gameId, challengeId) {
  return adminPlayerChallenges.find(
    row =>
      Number(row.player_id) === Number(playerId) &&
      Number(row.game_id) === Number(gameId) &&
      Number(row.challenge_id) === Number(challengeId)
  ) || null;
}

function parseCooldownInput(input) {
  if (!input) return null;

  const trimmed = input.trim().toLowerCase();

  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");

    if (parts.length === 2) {
      const minutes = Number(parts[0]);
      const seconds = Number(parts[1]);

      if (!Number.isNaN(minutes) && !Number.isNaN(seconds)) {
        return minutes * 60 + seconds;
      }
    }
  }

  const minuteMatch = trimmed.match(/(\d+)\s*m/);
  const secondMatch = trimmed.match(/(\d+)\s*s/);

  if (minuteMatch || secondMatch) {
    const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
    const seconds = secondMatch ? Number(secondMatch[1]) : 0;
    return minutes * 60 + seconds;
  }

  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }

  return null;
}

function formatCooldownMMSS(seconds) {
  if (!seconds || seconds <= 0) return "0:00";

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;

  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ============================================================
 * PASSWORTSCHUTZ FUER HARTE ADMIN-AKTIONEN
 * ============================================================ */

async function requireAdminPasswordOrAbort() {
  try {
    const ok = await requireAdminPassword();

    if (!ok) {
      return false;
    }

    return true;
  } catch (error) {
    console.error("Fehler bei der Admin-Passwortpruefung:", error);
    alert(error.message || "Admin-Passwort konnte nicht geprueft werden.");
    return false;
  }
}

async function handleAdminResetPlayerPassword(player) {
  if (!player) return;

  try {
    const ok = await runPreparedAdminPasswordResetFlow(player.id);

    if (!ok) {
      return;
    }

    alert(`Das Passwort von ${player.display_name || player.username} wurde erfolgreich geaendert.`);
  } catch (error) {
    console.error("Fehler beim Zuruecksetzen des Spielerpassworts:", error);
    alert(error.message || "Passwort konnte nicht zurueckgesetzt werden.");
  }
}

/* ============================================================
 * PLAYER-CHALLENGE SCHREIBZUGRIFFE
 * ============================================================ */

async function upsertAdminPlayerChallenge(playerId, gameId, challengeId, fields) {
  const payload = {
    player_id: playerId,
    game_id: gameId,
    challenge_id: challengeId,
    ...fields
  };

  const { data, error } = await supabaseClient
    .from("player_challenges")
    .upsert(payload, {
      onConflict: "player_id,challenge_id"
    })
    .select()
    .single();

  if (error) {
    console.error("Fehler beim Admin-Upsert von player_challenges:", error);
    return null;
  }

  return data;
}

/* ============================================================
 * CHALLENGE-AKTIONEN AUS DEM PLAYER-MODAL
 * ============================================================ */

async function adminMarkChallengeAsCompleted() {
  if (!selectedAdminPlayerChallengeContext) return;

  const { player, game, challenge } = selectedAdminPlayerChallengeContext;
  const completedAt = new Date().toISOString();

  const result = await upsertAdminPlayerChallenge(player.id, game.id, challenge.id, {
    status: "completed",
    completed_at: completedAt,
    was_first_solver: false,
    points_awarded: challenge.points || 0,
    proof_image_path: null
  });

  if (!result) {
    alert("Challenge konnte nicht als bestanden markiert werden.");
    return;
  }

  await logAdminChallengeUpdated({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    challengeId: challenge.id,
    metadata: {
      action: "admin_mark_completed",
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      player_name: player.display_name || player.username || null,
      challenge_title: challenge.title || null,
      position: challenge.position ?? null,
      points_awarded: challenge.points || 0,
      game_name: game.name || null
    }
  });

  await initializeAdminPlayersTab();

  const recomputeOk = await recomputeAdminPlayerGameProgress(player.id, game.id);
  if (!recomputeOk) {
    alert("Challenge gespeichert, aber Fortschritt konnte nicht sauber neu berechnet werden.");
  }

  await initializeAdminPlayersTab();

  const refreshedPlayer = adminPlayers.find(p => Number(p.id) === Number(player.id));
  if (refreshedPlayer && typeof renderAdminPlayerDetails === "function") {
    await renderAdminPlayerDetails(refreshedPlayer);
  }

  if (typeof closeAdminPlayerChallengeModal === "function") {
    closeAdminPlayerChallengeModal();
  }
}

async function adminResetChallengeFromModal() {
  if (!selectedAdminPlayerChallengeContext) return;

  const { player, game, challenge, row } = selectedAdminPlayerChallengeContext;
  if (!row || row.status !== "completed") return;

  const result = await upsertAdminPlayerChallenge(player.id, game.id, challenge.id, {
    status: "hidden",
    completed_at: null,
    was_first_solver: false,
    points_awarded: null,
    proof_image_path: null
  });

  if (!result) {
    alert("Challenge konnte nicht aberkannt werden.");
    return;
  }

  await logAdminChallengeUpdated({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    challengeId: challenge.id,
    metadata: {
      action: "admin_reset_player_challenge",
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      player_name: player.display_name || player.username || null,
      challenge_title: challenge.title || null,
      position: challenge.position ?? null,
      game_name: game.name || null
    }
  });

  await initializeAdminPlayersTab();

  const recomputeOk = await recomputeAdminPlayerGameProgress(player.id, game.id);
  if (!recomputeOk) {
    alert("Challenge zurueckgesetzt, aber Fortschritt konnte nicht sauber neu berechnet werden.");
  }

  await initializeAdminPlayersTab();

  const refreshedPlayer = adminPlayers.find(p => Number(p.id) === Number(player.id));
  if (refreshedPlayer && typeof renderAdminPlayerDetails === "function") {
    await renderAdminPlayerDetails(refreshedPlayer);
  }

  if (typeof closeAdminPlayerChallengeModal === "function") {
    closeAdminPlayerChallengeModal();
  }
}

async function adminSetChallengeInactiveFromModal() {
  if (!selectedAdminPlayerChallengeContext) return;

  const { player, game, challenge, row } = selectedAdminPlayerChallengeContext;
  if (!row || row.status !== "active") return;

  const result = await upsertAdminPlayerChallenge(player.id, game.id, challenge.id, {
    status: "hidden",
    completed_at: null,
    was_first_solver: false,
    points_awarded: null,
    proof_image_path: null
  });

  if (!result) {
    alert("Aktive Challenge konnte nicht zurueckgesetzt werden.");
    return;
  }

  await logAdminChallengeUpdated({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    challengeId: challenge.id,
    metadata: {
      action: "admin_set_player_challenge_inactive",
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      player_name: player.display_name || player.username || null,
      challenge_title: challenge.title || null,
      position: challenge.position ?? null,
      game_name: game.name || null
    }
  });

  const currentState = getStateForPlayerInAdminGame(player.id);

  if (currentState?.active_challenge_id === challenge.id) {
    const { error } = await supabaseClient
      .from("player_game_state")
      .update({
        active_challenge_id: null
      })
      .eq("player_id", player.id)
      .eq("game_id", game.id);

    if (error) {
      console.error("Fehler beim Zuruecksetzen von active_challenge_id:", error);
      alert("Challenge-Status wurde geaendert, aber active_challenge_id konnte nicht zurueckgesetzt werden.");
    }
  }

  if (typeof closeAdminPlayerChallengeModal === "function") {
    closeAdminPlayerChallengeModal();
  }

  await initializeAdminPlayersTab();

  const refreshedPlayer = adminPlayers.find(p => Number(p.id) === Number(player.id));
  if (refreshedPlayer && typeof renderAdminPlayerDetails === "function") {
    await renderAdminPlayerDetails(refreshedPlayer);
  }
}

async function adminSetChallengeActiveFromModal() {
  if (!selectedAdminPlayerChallengeContext) return;

  const { player, game, challenge } = selectedAdminPlayerChallengeContext;

  const result = await upsertAdminPlayerChallenge(player.id, game.id, challenge.id, {
    status: "active",
    completed_at: null,
    was_first_solver: false,
    points_awarded: null,
    proof_image_path: null
  });

  if (!result) {
    alert("Challenge konnte nicht aktiviert werden.");
    return;
  }

  await logAdminChallengeUpdated({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    challengeId: challenge.id,
    metadata: {
      action: "admin_set_player_challenge_active",
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      player_name: player.display_name || player.username || null,
      challenge_title: challenge.title || null,
      position: challenge.position ?? null,
      game_name: game.name || null
    }
  });

  const { error } = await supabaseClient
    .from("player_game_state")
    .update({
      active_challenge_id: challenge.id
    })
    .eq("player_id", player.id)
    .eq("game_id", game.id);

  if (error) {
    console.error("Fehler beim Setzen der aktiven Challenge:", error);
    alert("Challenge wurde aktiviert, aber active_challenge_id konnte nicht gesetzt werden.");
  }

  await initializeAdminPlayersTab();

  const refreshedPlayer = adminPlayers.find(p => Number(p.id) === Number(player.id));
  if (refreshedPlayer && typeof renderAdminPlayerDetails === "function") {
    await renderAdminPlayerDetails(refreshedPlayer);
  }

  if (typeof closeAdminPlayerChallengeModal === "function") {
    closeAdminPlayerChallengeModal();
  }
}

/* ============================================================
 * RECOMPUTE / BINGO / FORTSCHRITT
 * ============================================================ */

function generateAdminBingoLines(size) {
  const lines = [];

  for (let row = 0; row < size; row++) {
    const line = [];

    for (let col = 0; col < size; col++) {
      line.push(row * size + col + 1);
    }

    lines.push(line);
  }

  for (let col = 0; col < size; col++) {
    const line = [];

    for (let row = 0; row < size; row++) {
      line.push(row * size + col + 1);
    }

    lines.push(line);
  }

  const diagonal1 = [];
  for (let i = 0; i < size; i++) {
    diagonal1.push(i * size + i + 1);
  }
  lines.push(diagonal1);

  const diagonal2 = [];
  for (let i = 0; i < size; i++) {
    diagonal2.push(i * size + (size - 1 - i) + 1);
  }
  lines.push(diagonal2);

  return lines;
}

async function recomputeAdminPlayerGameProgress(playerId, gameId) {
  const game = getGameByIdAdmin(gameId);
  if (!game) {
    console.error("Spiel fuer Recompute nicht gefunden:", gameId);
    return false;
  }

  const completedRows = adminPlayerChallenges.filter(
    row =>
      Number(row.player_id) === Number(playerId) &&
      Number(row.game_id) === Number(gameId) &&
      row.status === "completed"
  );

  let rebuiltScore = completedRows.reduce((sum, row) => {
    return sum + (row.points_awarded || 0);
  }, 0);

  const completedPositions = completedRows
    .map(row => {
      const challenge = getChallengeByIdAdmin(row.challenge_id);
      return challenge ? Number(challenge.position) : null;
    })
    .filter(position => Number.isInteger(position));

  const bingoLines = generateAdminBingoLines(game.grid_size || 5);
  const bingoBonus = game.bingo_bonus_points ?? 5;
  const achievedLineIndexes = [];

  for (let i = 0; i < bingoLines.length; i++) {
    const line = bingoLines[i];
    const isComplete = line.every(position => completedPositions.includes(position));

    if (isComplete) {
      achievedLineIndexes.push(i);
      rebuiltScore += bingoBonus;
    }
  }

  const { error: deleteError } = await supabaseClient
    .from("player_bingos")
    .delete()
    .eq("player_id", playerId)
    .eq("game_id", gameId);

  if (deleteError) {
    console.error("Fehler beim Loeschen alter player_bingos:", deleteError);
    return false;
  }

  if (achievedLineIndexes.length > 0) {
    const bingoPayload = achievedLineIndexes.map(lineIndex => ({
      player_id: playerId,
      game_id: gameId,
      line_key: String(lineIndex),
      bonus_points: bingoBonus
    }));

    const { error: insertBingoError } = await supabaseClient
      .from("player_bingos")
      .insert(bingoPayload);

    if (insertBingoError) {
      console.error("Fehler beim Einfuegen neuer player_bingos:", insertBingoError);
      return false;
    }
  }

  const { error: updateStateError } = await supabaseClient
    .from("player_game_state")
    .update({
      score: rebuiltScore
    })
    .eq("player_id", playerId)
    .eq("game_id", gameId);

  if (updateStateError) {
    console.error("Fehler beim Aktualisieren des recomputed Scores:", updateStateError);
    return false;
  }

  return true;
}

/* ============================================================
 * SPIELERAKTIONEN - BASIS
 * ============================================================ */

async function updateAdminPlayerBlocked(playerId, shouldBlock) {
  const { error } = await supabaseClient
    .from("players")
    .update({
      is_blocked: shouldBlock
    })
    .eq("id", playerId);

  if (error) {
    console.error("Fehler beim Aktualisieren von is_blocked:", error);
    alert("Sperrstatus konnte nicht geaendert werden.");
    return false;
  }

  return true;
}

async function updateAdminPlayerScore(playerId, gameId, newScore) {
  const parsedScore = Number(newScore);

  if (!Number.isFinite(parsedScore)) {
    alert("Ungueltiger Score.");
    return false;
  }

  const { error } = await supabaseClient
    .from("player_game_state")
    .update({
      score: parsedScore
    })
    .eq("player_id", playerId)
    .eq("game_id", gameId);

  if (error) {
    console.error("Fehler beim Aktualisieren des Scores:", error);
    alert("Score konnte nicht geaendert werden.");
    return false;
  }

  return true;
}

async function updateAdminPlayerCooldown(playerId, gameId, cooldownSeconds) {
  let cooldownIso = null;
  const parsedSeconds = Number(cooldownSeconds);

  if (!Number.isFinite(parsedSeconds) || parsedSeconds < 0) {
    alert("Ungueltiger Cooldown.");
    return false;
  }

  if (parsedSeconds > 0) {
    cooldownIso = new Date(Date.now() + parsedSeconds * 1000).toISOString();
  }

  const { error } = await supabaseClient
    .from("player_game_state")
    .update({
      cooldown_until: cooldownIso
    })
    .eq("player_id", playerId)
    .eq("game_id", gameId);

  if (error) {
    console.error("Fehler beim Aktualisieren des Cooldowns:", error);
    alert("Cooldown konnte nicht geaendert werden.");
    return false;
  }

  return true;
}

/* ============================================================
 * SPIELERAKTIONEN - HANDLER
 * ============================================================ */

async function handleAdminToggleBlocked(player) {
  if (!player) return;

  const nextBlocked = !player.is_blocked;
  const ok = await updateAdminPlayerBlocked(player.id, nextBlocked);
  if (!ok) return;

  const adminName = adminPlayer
    ? (adminPlayer.display_name || adminPlayer.username || null)
    : null;

  const playerName = player.display_name || player.username || null;

  if (nextBlocked) {
    await logAdminPlayerBlocked({
      gameId: adminCurrentGameId || null,
      adminPlayerId: adminPlayer?.id || null,
      playerId: player.id,
      metadata: {
        admin_name: adminName,
        player_name: playerName,
        game_name: adminCurrentGame?.name || null
      }
    });
  } else {
    await logAdminPlayerUnblocked({
      gameId: adminCurrentGameId || null,
      adminPlayerId: adminPlayer?.id || null,
      playerId: player.id,
      metadata: {
        admin_name: adminName,
        player_name: playerName,
        game_name: adminCurrentGame?.name || null
      }
    });
  }

  await initializeAdminPlayersTab();

  const refreshedPlayer = adminPlayers.find(p => Number(p.id) === Number(player.id));
  if (refreshedPlayer && typeof renderAdminPlayerDetails === "function") {
    await renderAdminPlayerDetails(refreshedPlayer);
  }
}

async function handleAdminEditScore(player, game) {
  if (!player || !game) {
    alert("Kein relevantes Spiel vorhanden.");
    return;
  }

  const currentState = getStateForPlayerInAdminGame(player.id);
  const currentScore = currentState?.score ?? 0;

  const input = prompt(
    `Neuen Score fuer ${player.display_name || player.username} eingeben:`,
    String(currentScore)
  );

  if (input === null) return;

  const ok = await updateAdminPlayerScore(player.id, game.id, input);
  if (!ok) return;

  const newScore = Number(input);

  await logAdminScoreChanged({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    playerId: player.id,
    metadata: {
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      player_name: player.display_name || player.username || null,
      old_score: currentScore,
      new_score: newScore,
      game_name: game.name || null
    }
  });

  await initializeAdminPlayersTab();

  const refreshedPlayer = adminPlayers.find(p => Number(p.id) === Number(player.id));
  if (refreshedPlayer && typeof renderAdminPlayerDetails === "function") {
    await renderAdminPlayerDetails(refreshedPlayer);
  }
}

async function handleAdminEditCooldown(player, game) {
  if (!player || !game) {
    alert("Kein relevantes Spiel vorhanden.");
    return;
  }

  const currentState = getStateForPlayerInAdminGame(player.id);

  const currentCooldown = currentState?.cooldown_until
    ? Math.max(
        0,
        Math.ceil(
          (new Date(currentState.cooldown_until).getTime() - Date.now()) / 1000
        )
      )
    : 0;

  const input = prompt(
    `Cooldown fuer ${player.display_name || player.username} setzen.\n\n` +
    `Formate:\n` +
    `- Sekunden: 90\n` +
    `- Minuten:Sekunden: 1:30\n` +
    `- Kurz: 2m oder 2m 30s\n\n` +
    `Aktuell: ${formatCooldownMMSS(currentCooldown)}\n\n` +
    `0 = entfernen`,
    formatCooldownMMSS(currentCooldown)
  );

  if (input === null) return;

  const parsedSeconds = parseCooldownInput(input);

  if (parsedSeconds === null) {
    alert("Ungueltiges Format. Beispiele: 90, 1:30, 2m 30s");
    return;
  }

  const ok = await updateAdminPlayerCooldown(player.id, game.id, parsedSeconds);
  if (!ok) return;

  await logAdminCooldownChanged({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    playerId: player.id,
    metadata: {
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      player_name: player.display_name || player.username || null,
      old_cooldown_seconds: currentCooldown,
      new_cooldown_seconds: parsedSeconds,
      game_name: game.name || null
    }
  });

  await initializeAdminPlayersTab();

  const refreshedPlayer = adminPlayers.find(p => Number(p.id) === Number(player.id));
  if (refreshedPlayer && typeof renderAdminPlayerDetails === "function") {
    await renderAdminPlayerDetails(refreshedPlayer);
  }
}

async function adminResetPlayerGameProgress(player, game) {
  if (!player || !game) {
    alert("Kein relevantes Spiel vorhanden.");
    return;
  }

  const confirmed = confirm(
    `Fortschritt von ${player.display_name || player.username} im Spiel "${game.name}" wirklich zuruecksetzen?`
  );

  if (!confirmed) return;

  const adminConfirmed = await requireAdminPasswordOrAbort();
  if (!adminConfirmed) return;

  const { error: challengesError } = await supabaseClient
    .from("player_challenges")
    .delete()
    .eq("player_id", player.id)
    .eq("game_id", game.id);

  if (challengesError) {
    console.error("Fehler beim Loeschen von player_challenges:", challengesError);
    alert("player_challenges konnten nicht geloescht werden.");
    return;
  }

  const { error: bingosError } = await supabaseClient
    .from("player_bingos")
    .delete()
    .eq("player_id", player.id)
    .eq("game_id", game.id);

  if (bingosError) {
    console.error("Fehler beim Loeschen von player_bingos:", bingosError);
    alert("player_bingos konnten nicht geloescht werden.");
    return;
  }

  const { error: liveError } = await supabaseClient
    .from("player_live_challenges")
    .delete()
    .eq("player_id", player.id)
    .eq("game_id", game.id);

  if (liveError) {
    console.error("Fehler beim Loeschen von player_live_challenges:", liveError);
    alert("player_live_challenges konnten nicht geloescht werden.");
    return;
  }

  const { error: stateError } = await supabaseClient
    .from("player_game_state")
    .update({
      score: 0,
      active_challenge_id: null,
      cooldown_until: null
    })
    .eq("player_id", player.id)
    .eq("game_id", game.id);

  if (stateError) {
    console.error("Fehler beim Zuruecksetzen von player_game_state:", stateError);
    alert("player_game_state konnte nicht zurueckgesetzt werden.");
    return;
  }

  await logAdminPlayerGameReset({
    gameId: game.id,
    adminPlayerId: adminPlayer?.id || null,
    playerId: player.id,
    metadata: {
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      player_name: player.display_name || player.username || null,
      game_name: game.name || null
    }
  });

  await initializeAdminPlayersTab();

  const refreshedPlayer = adminPlayers.find(p => Number(p.id) === Number(player.id));
  if (refreshedPlayer && typeof renderAdminPlayerDetails === "function") {
    await renderAdminPlayerDetails(refreshedPlayer);
  }
}

async function adminDeletePlayerCompletely(player) {
  if (!player) return;

  const playerName = player.display_name || player.username || `Spieler ${player.id}`;

  const confirmed = confirm(
    `Spieler "${playerName}" wirklich komplett loeschen?\n\n` +
    `Diese Aktion entfernt den Spieler und alle zugehoerigen Daten dauerhaft.`
  );

  if (!confirmed) return;

  const adminConfirmed = await requireAdminPasswordOrAbort();
  if (!adminConfirmed) return;

  await logAdminPlayerDeleted({
    gameId: adminCurrentGameId || null,
    adminPlayerId: adminPlayer?.id || null,
    playerId: player.id,
    metadata: {
      admin_name: adminPlayer?.display_name || adminPlayer?.username || null,
      player_name: player.display_name || player.username || null,
      game_name: adminCurrentGame?.name || null
    }
  });

  const deletions = [
    { table: "player_live_challenge_views", column: "player_id" },
    { table: "player_live_challenges", column: "player_id" },
    { table: "player_bingos", column: "player_id" },
    { table: "player_challenges", column: "player_id" },
    { table: "player_game_state", column: "player_id" }
  ];

  for (const entry of deletions) {
    const { error } = await supabaseClient
      .from(entry.table)
      .delete()
      .eq(entry.column, player.id);

    if (error) {
      console.error(`Fehler beim Loeschen aus ${entry.table}:`, error);
      alert(`Fehler beim Loeschen aus ${entry.table}.`);
      return;
    }
  }

  const { error: playerError } = await supabaseClient
    .from("players")
    .delete()
    .eq("id", player.id);

  if (playerError) {
    console.error("Fehler beim Loeschen des Spielers:", playerError);
    alert("Spieler konnte nicht geloescht werden.");
    return;
  }

  selectedAdminPlayerId = null;
  await initializeAdminPlayersTab();
}

async function adminCreatePlayerState(player, game) {
  if (!player || !game) {
    alert("Kein Spiel ausgewaehlt.");
    return;
  }

  const existingState = getStateForPlayerInAdminGame(player.id);
  if (existingState) {
    alert("Fuer dieses Spiel existiert bereits ein Spielstand.");
    return;
  }

  const { error } = await supabaseClient
    .from("player_game_state")
    .insert({
      player_id: player.id,
      game_id: game.id,
      score: 0,
      active_challenge_id: null,
      cooldown_until: null
    });

  if (error) {
    console.error("Fehler beim Anlegen des player_game_state:", error);
    alert("Spielstand konnte nicht angelegt werden.");
    return;
  }

  if (typeof pushAutomationSendPlayerAddedToGame === "function") {
    await pushAutomationSendPlayerAddedToGame({
      playerId: player.id,
      gameId: game.id
    });
  }

  await initializeAdminPlayersTab();

  const refreshedPlayer = adminPlayers.find(p => Number(p.id) === Number(player.id));
  if (refreshedPlayer && typeof renderAdminPlayerDetails === "function") {
    await renderAdminPlayerDetails(refreshedPlayer);
  }
}



async function handleAdminPromotePlayer(player) {
  if (!player) return;

  if (player.role === "admin") {
    alert("Spieler ist bereits Admin.");
    return;
  }

  const confirmed = confirm(
    `${player.display_name || player.username} wirklich zum Admin machen?`
  );

  if (!confirmed) return;

  const adminConfirmed = await requireAdminPasswordOrAbort();
  if (!adminConfirmed) return;

  const { error } = await supabaseClient
    .from("players")
    .update({
      role: "admin"
    })
    .eq("id", player.id);

  if (error) {
    console.error("Fehler beim Befördern zum Admin:", error);
    alert("Spieler konnte nicht zum Admin gemacht werden.");
    return;
  }

  alert(`${player.display_name || player.username} ist jetzt Admin.`);

  await initializeAdminPlayersTab();

  const refreshedPlayer = adminPlayers.find(
    p => Number(p.id) === Number(player.id)
  );

  if (refreshedPlayer && typeof renderAdminPlayerDetails === "function") {
    await renderAdminPlayerDetails(refreshedPlayer);
  }
}