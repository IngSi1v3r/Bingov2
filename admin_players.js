



let selectedAdminPlayerChallengeContext = null;

const adminPlayerChallengeOverlay = document.getElementById("adminPlayerChallengeOverlay");
const closeAdminPlayerChallengeBtn = document.getElementById("closeAdminPlayerChallengeBtn");
const adminPlayerChallengeModalTitle = document.getElementById("adminPlayerChallengeModalTitle");
const adminPlayerChallengeModalContent = document.getElementById("adminPlayerChallengeModalContent");
const adminMarkChallengeCompletedBtn = document.getElementById("adminMarkChallengeCompletedBtn");
const adminSetChallengeInactiveBtn = document.getElementById("adminSetChallengeInactiveBtn");
const adminResetChallengeBtn = document.getElementById("adminResetChallengeBtn");
const adminSetChallengeActiveBtn = document.getElementById("adminSetChallengeActiveBtn");
const adminPlayerActionBar = document.getElementById("adminPlayerActionBar");
const adminResetPlayerGameBtn = document.getElementById("adminResetPlayerGameBtn");
const adminDeletePlayerBtn = document.getElementById("adminDeletePlayerBtn");
const adminPlayerCreateStateBar = document.getElementById("adminPlayerCreateStateBar");
const adminCreatePlayerStateBtn = document.getElementById("adminCreatePlayerStateBtn");





// =======================
// PLAYERS TAB DATA LOAD
// =======================

async function initializeAdminPlayersTab() {
  await Promise.all([
    loadAllPlayersForAdmin(),
    loadAllGamesForAdmin(),
    loadAllPlayerStatesForAdmin(),
    loadAllPlayerChallengesForAdmin(),
    loadAllPlayerBingosForAdmin(),
    loadAllChallengesForAdmin()
  ]);

  renderAdminPlayersList();

  if (selectedAdminPlayerId) {
    const selectedPlayer = adminPlayers.find(p => p.id === selectedAdminPlayerId);
    if (selectedPlayer) {
      await renderAdminPlayerDetails(selectedPlayer);
      return;
    }
  }

  const detailsEl = document.getElementById("adminPlayerDetails");
  const miniGridWrapper = document.getElementById("adminPlayerGameMiniGrid");
  const galleryWrapper = document.getElementById("adminPlayerGalleryWrapper");
  const completedWrapper = document.getElementById("adminPlayerCompletedWrapper");

  if (detailsEl) {
    detailsEl.innerHTML = `<p class="admin-details-empty">Wähle links einen Spieler aus.</p>`;
  }

  if (miniGridWrapper) miniGridWrapper.classList.add("hidden");
  if (galleryWrapper) galleryWrapper.classList.add("hidden");
  if (completedWrapper) completedWrapper.classList.add("hidden");
}

async function loadAllPlayersForAdmin() {
  const { data, error } = await supabaseClient
    .from("players")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden aller Spieler:", error);
    adminPlayers = [];
    return;
  }

  adminPlayers = data || [];
}

async function loadAllGamesForAdmin() {
  const { data, error } = await supabaseClient
    .from("games")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden aller Spiele:", error);
    adminGames = [];
    return;
  }

  adminGames = data || [];
}

async function loadAllPlayerStatesForAdmin() {
  const { data, error } = await supabaseClient
    .from("player_game_state")
    .select("*");

  if (error) {
    console.error("Fehler beim Laden aller player_game_state Einträge:", error);
    adminPlayerStates = [];
    return;
  }

  adminPlayerStates = data || [];
}

async function loadAllPlayerChallengesForAdmin() {
  const { data, error } = await supabaseClient
    .from("player_challenges")
    .select("*")
    .in("status", ["active", "completed"]);

  if (error) {
    console.error("Fehler beim Laden aller player_challenges:", error);
    adminPlayerChallenges = [];
    return;
  }

  adminPlayerChallenges = data || [];
}

async function loadAllPlayerBingosForAdmin() {
  const { data, error } = await supabaseClient
    .from("player_bingos")
    .select("*");

  if (error) {
    console.error("Fehler beim Laden aller player_bingos:", error);
    adminPlayerBingos = [];
    return;
  }

  adminPlayerBingos = data || [];
}

async function loadAllChallengesForAdmin() {
  const { data, error } = await supabaseClient
    .from("challenges")
    .select("id, game_id, position, title, points, is_active")
    .order("game_id", { ascending: true })
    .order("position", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden aller Challenges:", error);
    adminChallenges = [];
    return;
  }

  adminChallenges = data || [];
}

// =======================
// PLAYER HELPERS
// =======================

function getGameByIdAdmin(gameId) {
  return adminGames.find(game => game.id === gameId) || null;
}

function getChallengeByIdAdmin(challengeId) {
  return adminChallenges.find(challenge => challenge.id === challengeId) || null;
}

function getChallengeTitleByIdAdmin(challengeId) {
  const challenge = getChallengeByIdAdmin(challengeId);
  return challenge ? challenge.title : `Challenge ${challengeId}`;
}

function getStatesForPlayer(playerId) {
  return adminPlayerStates.filter(row => row.player_id === playerId);
}

function getAdminGameStateCountForPlayer(playerId) {
  return getStatesForPlayer(playerId).length;
}

function getAdminGameStateGamesForPlayer(playerId) {
  return getStatesForPlayer(playerId)
    .map(row => getGameByIdAdmin(row.game_id))
    .filter(Boolean);
}

// Für die linke Liste: welches Spiel ist gerade am relevantesten/offen?
function getDisplayStateForPlayer(playerId) {
  const states = getStatesForPlayer(playerId);
  if (!states.length) return null;

  const stateWithActiveChallenge = states.find(row => row.active_challenge_id !== null);
  if (stateWithActiveChallenge) return stateWithActiveChallenge;

  const stateWithCooldown = states.find(row => isCooldownActiveAdmin(row.cooldown_until));
  if (stateWithCooldown) return stateWithCooldown;

  if (adminCurrentGameId) {
    const currentGameState = states.find(row => row.game_id === adminCurrentGameId);
    if (currentGameState) return currentGameState;
  }

  return states[0] || null;
}

// Für rechte Detailansicht UND linke Spiel-bezogene Werte:
// immer exakt das global ausgewählte Admin-Spiel
function getStateForPlayerInAdminGame(playerId) {
  if (!adminCurrentGameId) return null;

  return adminPlayerStates.find(
    row =>
      row.player_id === playerId &&
      row.game_id === adminCurrentGameId
  ) || null;
}

function getChallengeRowsForPlayerInGame(playerId, gameId) {
  return adminPlayerChallenges.filter(
    row => row.player_id === playerId && row.game_id === gameId
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
    row => row.player_id === playerId && row.game_id === gameId
  ).length;
}

function buildSmallMiniGrid(playerId, game) {
  if (!game) return "";

  const gridSize = game.grid_size || 5;
  const expected = gridSize * gridSize;

  const gameChallenges = adminChallenges
    .filter(c => c.game_id === game.id && c.is_active !== false);

  const rows = getChallengeRowsForPlayerInGame(playerId, game.id);
  const rowMap = {};
  rows.forEach(r => {
    rowMap[r.challenge_id] = r;
  });

  let html = `
    <div 
      class="admin-mini-grid-small"
      style="grid-template-columns: repeat(${gridSize}, 1fr);"
    >
  `;

  for (let i = 1; i <= expected; i++) {
    const challenge = gameChallenges.find(c => Number(c.position) === i);
    const row = challenge ? rowMap[challenge.id] : null;

    let cls = "admin-mini-cell-small";

    if (row?.status === "completed") cls += " completed";
    if (row?.status === "active") cls += " active";
    if (row?.was_first_solver) cls += " first";

    html += `<div class="${cls}"></div>`;
  }

  html += `</div>`;
  return html;
}

function parseCooldownInput(input) {
  if (!input) return null;

  const trimmed = input.trim().toLowerCase();

  // Format: MM:SS
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    if (parts.length === 2) {
      const minutes = Number(parts[0]);
      const seconds = Number(parts[1]);

      if (!isNaN(minutes) && !isNaN(seconds)) {
        return minutes * 60 + seconds;
      }
    }
  }

  // Format: "2m", "2m 30s"
  const minuteMatch = trimmed.match(/(\d+)\s*m/);
  const secondMatch = trimmed.match(/(\d+)\s*s/);

  if (minuteMatch || secondMatch) {
    const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
    const seconds = secondMatch ? Number(secondMatch[1]) : 0;
    return minutes * 60 + seconds;
  }

  // Fallback: normale Zahl (Sekunden)
  const numeric = Number(trimmed);
  if (!isNaN(numeric)) {
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

// =======================
// AUFGABEN ZURÜCKSETZEN
// =======================

function openAdminPlayerChallengeModal() {
  if (!adminPlayerChallengeOverlay) return;
  adminPlayerChallengeOverlay.classList.remove("hidden");
}

function closeAdminPlayerChallengeModal() {
  if (!adminPlayerChallengeOverlay) return;
  adminPlayerChallengeOverlay.classList.add("hidden");
  selectedAdminPlayerChallengeContext = null;
}

function getPlayerChallengeRow(playerId, gameId, challengeId) {
  return adminPlayerChallenges.find(
    row =>
      row.player_id === playerId &&
      row.game_id === gameId &&
      row.challenge_id === challengeId
  ) || null;
}

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

async function showAdminPlayerChallengeDetails(player, game, challenge) {
  console.log("showAdminPlayerChallengeDetails aufgerufen:", {
    player,
    game,
    challenge
  });

  if (!player || !game || !challenge) {
    console.warn("Abbruch: player/game/challenge fehlt");
    return;
  }

  if (
    !adminPlayerChallengeOverlay ||
    !adminPlayerChallengeModalTitle ||
    !adminPlayerChallengeModalContent ||
    !adminMarkChallengeCompletedBtn ||
    !adminResetChallengeBtn
  ) {
    console.error("Admin Challenge Modal DOM nicht gefunden", {
      adminPlayerChallengeOverlay,
      adminPlayerChallengeModalTitle,
      adminPlayerChallengeModalContent,
      adminMarkChallengeCompletedBtn,
      adminResetChallengeBtn
    });
    return;
  }

  const row = getPlayerChallengeRow(player.id, game.id, challenge.id);
  const isCompleted = row?.status === "completed";
const isActive = row?.status === "active";
const imageUrl = row?.proof_image_path
  ? getPublicImageUrl(row.proof_image_path)
  : null;

  selectedAdminPlayerChallengeContext = {
    player,
    game,
    challenge,
    row
  };

  adminPlayerChallengeModalTitle.textContent =
    challenge.title || `Challenge ${challenge.position}`;

  adminPlayerChallengeModalContent.innerHTML = `
    <p><strong>Status:</strong> ${
  isCompleted ? "Bestanden" :
  isActive ? "Aktiv" :
  "Nicht bestanden"
}</p>

    <div class="admin-challenge-meta">
      <div class="admin-challenge-meta-row">
        <strong>Position:</strong> ${challenge.position ?? "-"}
      </div>

      <div class="admin-challenge-meta-row">
        <strong>Abgeschlossen am:</strong> ${
          row?.completed_at ? formatAdminDateTime(row.completed_at) : "-"
        }
      </div>

      <div class="admin-challenge-meta-row">
        <strong>Punkte:</strong> ${row?.points_awarded ?? 0}
      </div>

      <div class="admin-challenge-meta-row">
        <strong>First Solver:</strong> ${row?.was_first_solver ? "Ja" : "Nein"}
      </div>
    </div>

    ${imageUrl ? `<img src="${imageUrl}" class="admin-challenge-image" alt="Beweisfoto" />` : ""}
  `;

// Alle Buttons verstecken
adminMarkChallengeCompletedBtn.style.display = "none";
adminSetChallengeActiveBtn.style.display = "none";
adminSetChallengeInactiveBtn.style.display = "none";
adminResetChallengeBtn.style.display = "none";

// Zustände
if (isCompleted) {
  // Nur aberkennen
  adminResetChallengeBtn.style.display = "inline-block";

} else if (isActive) {
  // Aktiv → inaktiv + fertigstellen
  adminSetChallengeInactiveBtn.style.display = "inline-block";
  adminMarkChallengeCompletedBtn.style.display = "inline-block";

} else {
  // Offen → aktiv setzen ODER direkt fertig
  adminSetChallengeActiveBtn.style.display = "inline-block";
  adminMarkChallengeCompletedBtn.style.display = "inline-block";
}

  console.log("Öffne Admin Challenge Modal");
  openAdminPlayerChallengeModal();
}

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

  const refreshedPlayer = adminPlayers.find(p => p.id === player.id);
  if (refreshedPlayer) {
    await renderAdminPlayerDetails(refreshedPlayer);
  }

  closeAdminPlayerChallengeModal();
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
    alert("Challenge zurückgesetzt, aber Fortschritt konnte nicht sauber neu berechnet werden.");
  }

  await initializeAdminPlayersTab();

  const refreshedPlayer = adminPlayers.find(p => p.id === player.id);
  if (refreshedPlayer) {
    await renderAdminPlayerDetails(refreshedPlayer);
  }

  closeAdminPlayerChallengeModal();
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
    alert("Aktive Challenge konnte nicht zurückgesetzt werden.");
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
      console.error("Fehler beim Zurücksetzen von active_challenge_id:", error);
      alert("Challenge-Status wurde geändert, aber active_challenge_id konnte nicht zurückgesetzt werden.");
    }
  }

  closeAdminPlayerChallengeModal();

  await initializeAdminPlayersTab();

  const refreshedPlayer = adminPlayers.find(p => p.id === player.id);
  if (refreshedPlayer) {
    await renderAdminPlayerDetails(refreshedPlayer);
  }
}

async function adminSetChallengeActiveFromModal() {
  if (!selectedAdminPlayerChallengeContext) return;

  const { player, game, challenge } = selectedAdminPlayerChallengeContext;

  // 1. Challenge auf active setzen
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

  // 2. active_challenge_id setzen (nur eine gleichzeitig!)
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

  const refreshedPlayer = adminPlayers.find(p => p.id === player.id);
  if (refreshedPlayer) {
    await renderAdminPlayerDetails(refreshedPlayer);
  }

  closeAdminPlayerChallengeModal();
}

function generateAdminBingoLines(size) {
  const lines = [];

  // horizontal
  for (let row = 0; row < size; row++) {
    const line = [];
    for (let col = 0; col < size; col++) {
      line.push(row * size + col + 1);
    }
    lines.push(line);
  }

  // vertikal
  for (let col = 0; col < size; col++) {
    const line = [];
    for (let row = 0; row < size; row++) {
      line.push(row * size + col + 1);
    }
    lines.push(line);
  }

  // diagonale 1
  const diagonal1 = [];
  for (let i = 0; i < size; i++) {
    diagonal1.push(i * size + i + 1);
  }
  lines.push(diagonal1);

  // diagonale 2
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
    console.error("Spiel für Recompute nicht gefunden:", gameId);
    return false;
  }

  const completedRows = adminPlayerChallenges.filter(
    row =>
      row.player_id === playerId &&
      row.game_id === gameId &&
      row.status === "completed"
  );

  // Basispunkte aus completed challenges
  let rebuiltScore = completedRows.reduce((sum, row) => {
    return sum + (row.points_awarded || 0);
  }, 0);

  // Zugehörige Board-Positionen bestimmen
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

  // Alte Bingos löschen
  const { error: deleteError } = await supabaseClient
    .from("player_bingos")
    .delete()
    .eq("player_id", playerId)
    .eq("game_id", gameId);

  if (deleteError) {
    console.error("Fehler beim Löschen alter player_bingos:", deleteError);
    return false;
  }

  // Neue Bingos einfügen
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
      console.error("Fehler beim Einfügen neuer player_bingos:", insertBingoError);
      return false;
    }
  }

  // Score im player_game_state setzen
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

// =======================
// PLAYER ACTIONS
// =======================

async function updateAdminPlayerBlocked(playerId, shouldBlock) {
  const { error } = await supabaseClient
    .from("players")
    .update({
      is_blocked: shouldBlock
    })
    .eq("id", playerId);

  if (error) {
    console.error("Fehler beim Aktualisieren von is_blocked:", error);
    alert("Sperrstatus konnte nicht geändert werden.");
    return false;
  }

  return true;
}

async function updateAdminPlayerScore(playerId, gameId, newScore) {
  const parsedScore = Number(newScore);

  if (!Number.isFinite(parsedScore)) {
    alert("Ungültiger Score.");
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
    alert("Score konnte nicht geändert werden.");
    return false;
  }

  return true;
}

async function updateAdminPlayerCooldown(playerId, gameId, cooldownSeconds) {
  let cooldownIso = null;

  const parsedSeconds = Number(cooldownSeconds);

  if (!Number.isFinite(parsedSeconds) || parsedSeconds < 0) {
    alert("Ungültiger Cooldown.");
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
    alert("Cooldown konnte nicht geändert werden.");
    return false;
  }

  return true;
}

async function handleAdminToggleBlocked(player) {
  if (!player) return;

  const nextBlocked = !player.is_blocked;

  const ok = await updateAdminPlayerBlocked(player.id, nextBlocked);
  if (!ok) return;

    const adminName =
    (typeof adminPlayer !== "undefined" && adminPlayer)
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

  const refreshedPlayer = adminPlayers.find(p => p.id === player.id);
  if (refreshedPlayer) {
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
    `Neuen Score für ${player.display_name || player.username} eingeben:`,
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

  const refreshedPlayer = adminPlayers.find(p => p.id === player.id);
  if (refreshedPlayer) {
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
    `Cooldown für ${player.display_name || player.username} setzen.\n\n` +
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
    alert("Ungültiges Format. Beispiele: 90, 1:30, 2m 30s");
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

  const refreshedPlayer = adminPlayers.find(p => p.id === player.id);
  if (refreshedPlayer) {
    await renderAdminPlayerDetails(refreshedPlayer);
  }
}

async function adminResetPlayerGameProgress(player, game) {
  if (!player || !game) {
    alert("Kein relevantes Spiel vorhanden.");
    return;
  }

  const confirmed = confirm(
    `Spielstand von ${player.display_name || player.username} im Spiel "${game.name}" wirklich zurücksetzen?`
  );

  if (!confirmed) return;

  // player_challenges löschen
  const { error: challengesError } = await supabaseClient
    .from("player_challenges")
    .delete()
    .eq("player_id", player.id)
    .eq("game_id", game.id);

  if (challengesError) {
    console.error("Fehler beim Löschen von player_challenges:", challengesError);
    alert("player_challenges konnten nicht gelöscht werden.");
    return;
  }

  // player_bingos löschen
  const { error: bingosError } = await supabaseClient
    .from("player_bingos")
    .delete()
    .eq("player_id", player.id)
    .eq("game_id", game.id);

  if (bingosError) {
    console.error("Fehler beim Löschen von player_bingos:", bingosError);
    alert("player_bingos konnten nicht gelöscht werden.");
    return;
  }

  // player_live_challenges für dieses Spiel löschen
  const { error: liveError } = await supabaseClient
    .from("player_live_challenges")
    .delete()
    .eq("player_id", player.id)
    .eq("game_id", game.id);

  if (liveError) {
    console.error("Fehler beim Löschen von player_live_challenges:", liveError);
    alert("player_live_challenges konnten nicht gelöscht werden.");
    return;
  }

  // player_game_state zurücksetzen
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
    console.error("Fehler beim Zurücksetzen von player_game_state:", stateError);
    alert("player_game_state konnte nicht zurückgesetzt werden.");
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

  const refreshedPlayer = adminPlayers.find(p => p.id === player.id);
  if (refreshedPlayer) {
    await renderAdminPlayerDetails(refreshedPlayer);
  }
}

async function adminDeletePlayerCompletely(player) {
  if (!player) return;

  const playerName = player.display_name || player.username || `Spieler ${player.id}`;

  const confirmed = confirm(
    `Spieler "${playerName}" wirklich komplett löschen?\n\nDiese Aktion entfernt den Spieler und alle zugehörigen Daten dauerhaft.`
  );

  if (!confirmed) return;

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

  // Reihenfolge wichtig: abhängige Tabellen zuerst
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
      console.error(`Fehler beim Löschen aus ${entry.table}:`, error);
      alert(`Fehler beim Löschen aus ${entry.table}.`);
      return;
    }
  }

  // players zuletzt löschen
  const { error: playerError } = await supabaseClient
    .from("players")
    .delete()
    .eq("id", player.id);

  if (playerError) {
    console.error("Fehler beim Löschen des Spielers:", playerError);
    alert("Spieler konnte nicht gelöscht werden.");
    return;
  }

  selectedAdminPlayerId = null;

  await initializeAdminPlayersTab();
}

async function adminCreatePlayerState(player, game) {
  if (!player || !game) {
    alert("Kein Spiel ausgewählt.");
    return;
  }

  const existingState = getStateForPlayerInAdminGame(player.id);
  if (existingState) {
    alert("Für dieses Spiel existiert bereits ein Spielstand.");
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

  await initializeAdminPlayersTab();

  const refreshedPlayer = adminPlayers.find(p => p.id === player.id);
  if (refreshedPlayer) {
    await renderAdminPlayerDetails(refreshedPlayer);
  }
}

// =======================
// PLAYER LIST
// =======================

function renderAdminPlayersList() {
  const listEl = document.getElementById("adminPlayersList");
  if (!listEl) return;

  if (!adminPlayers.length) {
    listEl.innerHTML = `<p>Keine Spieler gefunden.</p>`;
    return;
  }

  listEl.innerHTML = "";

  adminPlayers.forEach(player => {
    const item = document.createElement("div");
    item.className = "admin-list-item";

    if (player.id === selectedAdminPlayerId) {
      item.classList.add("active");
    }

    const displayName = player.display_name || player.username || `Spieler ${player.id}`;

    // Für Anzeige, in welchem Spiel er gerade "drin" ist
    const displayState = getDisplayStateForPlayer(player.id);
    const displayGame = displayState ? getGameByIdAdmin(displayState.game_id) : null;

    // Für Score, Mini-Grid und Stats: global ausgewähltes Admin-Spiel
    const adminGameState = getStateForPlayerInAdminGame(player.id);
    const score = adminGameState?.score ?? 0;
    const cooldownActive = adminGameState
      ? isCooldownActiveAdmin(adminGameState.cooldown_until)
      : false;

    let activeChallengeText = "-";
    if (adminGameState?.active_challenge_id) {
      activeChallengeText = getChallengeTitleByIdAdmin(adminGameState.active_challenge_id);
    }

    const gameStateCount = getAdminGameStateCountForPlayer(player.id);

const firstSolverCount = adminCurrentGameId
  ? getFirstSolverCountForPlayerInGame(player.id, adminCurrentGameId)
  : 0;

const completedCount = adminCurrentGameId
  ? getCompletedRowsForPlayerInGame(player.id, adminCurrentGameId).length
  : 0;

    const miniGridHtml = adminCurrentGame
      ? buildSmallMiniGrid(player.id, adminCurrentGame)
      : "";

    item.innerHTML = `
      <div class="admin-list-card">
        <div class="admin-list-card-left">
          <div class="admin-list-name">${displayName}</div>
          <div class="admin-list-meta">@${player.username || "-"}</div>

          <div class="admin-status-row">
            ${player.is_blocked ? `<span class="admin-badge blocked">Gesperrt</span>` : ""}
            ${displayGame ? `<span class="admin-badge ingame">${displayGame.name}</span>` : ""}
            ${cooldownActive ? `<span class="admin-badge cooldown">Cooldown</span>` : ""}
          </div>

          <div class="admin-list-subinfo">
  <div><strong>Aktiv:</strong> ${activeChallengeText}</div>
  <div><strong>Gelöst:</strong> ${completedCount}</div>
  <div><strong>First:</strong> ${firstSolverCount}</div>
  <div><strong>Spiele:</strong> ${gameStateCount}</div>
</div>
        </div>

        <div class="admin-list-card-right">
          <div class="admin-list-score">${score}P</div>
          ${miniGridHtml}
        </div>
      </div>
    `;

    item.addEventListener("click", async () => {
      selectedAdminPlayerId = player.id;
      renderAdminPlayersList();
      await renderAdminPlayerDetails(player);
    });

    listEl.appendChild(item);
  });
}

// =======================
// PLAYER DETAILS
// =======================

async function renderAdminPlayerDetails(player) {
  const detailsEl = document.getElementById("adminPlayerDetails");
  const miniGridWrapper = document.getElementById("adminPlayerGameMiniGrid");
  const galleryWrapper = document.getElementById("adminPlayerGalleryWrapper");
  const completedWrapper = document.getElementById("adminPlayerCompletedWrapper");
  const actionBar = document.getElementById("adminPlayerActionBar");
  const createStateBar = document.getElementById("adminPlayerCreateStateBar");

  if (!detailsEl) return;

  if (!player) {
    detailsEl.innerHTML = `<p class="admin-details-empty">Kein Spieler ausgewählt.</p>`;

    if (miniGridWrapper) miniGridWrapper.classList.add("hidden");
    if (galleryWrapper) galleryWrapper.classList.add("hidden");
    if (completedWrapper) completedWrapper.classList.add("hidden");
    if (actionBar) actionBar.classList.add("hidden");
    if (createStateBar) createStateBar.classList.add("hidden");

    return;
  }

  const displayName = player.display_name || player.username || "-";
  const relevantGame = adminCurrentGame || null;
  const currentState = getStateForPlayerInAdminGame(player.id);

  // Wenn im global ausgewählten Spiel noch kein State existiert
  if (!relevantGame || !currentState) {
    const playerGames = getAdminGameStateGamesForPlayer(player.id);
    const playerGamesText = playerGames.length
      ? playerGames.map(game => game.name).join(", ")
      : "-";

    detailsEl.innerHTML = `
      <div class="admin-details-grid">
        <div class="admin-detail-card">
          <div class="admin-detail-label">Name</div>
          <div class="admin-detail-value">${displayName}</div>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Username</div>
          <div class="admin-detail-value">${player.username || "-"}</div>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Rolle</div>
          <div class="admin-detail-value">${player.role || "-"}</div>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Gesperrt</div>
          <div
            id="adminToggleBlockedBtn"
            class="admin-detail-value clickable ${player.is_blocked ? "danger-state" : ""}"
            title="Zum Umschalten klicken"
          >
            ${player.is_blocked ? "Ja" : "Nein"}
          </div>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">Player ID</div>
          <div class="admin-detail-value">${player.id}</div>
        </div>

        <div class="admin-detail-card">
          <div class="admin-detail-label">PIN</div>
          <div class="admin-detail-value">${player.pin_hash || "-"}</div>
        </div>

        <div class="admin-detail-card admin-detail-wide">
          <div class="admin-detail-label">Spielstände vorhanden in</div>
          <div class="admin-detail-value">${playerGamesText}</div>
        </div>

        <div class="admin-detail-card admin-detail-wide">
          <div class="admin-detail-label">Info</div>
          <div class="admin-detail-value">
            Für diesen Spieler gibt es im aktuell ausgewählten Spiel
            <strong>${relevantGame?.name || "-"}</strong> noch keinen Spielstand.
          </div>
        </div>
      </div>
    `;

    const toggleBlockedBtn = document.getElementById("adminToggleBlockedBtn");

    if (toggleBlockedBtn) {
      toggleBlockedBtn.addEventListener("click", async () => {
        await handleAdminToggleBlocked(player);
      });
    }

    if (miniGridWrapper) miniGridWrapper.classList.add("hidden");
    if (galleryWrapper) galleryWrapper.classList.add("hidden");
    if (completedWrapper) completedWrapper.classList.add("hidden");
    if (actionBar) actionBar.classList.add("hidden");

    if (createStateBar) {
      createStateBar.classList.remove("hidden");
    }

    if (adminCreatePlayerStateBtn) {
      adminCreatePlayerStateBtn.onclick = async () => {
        await adminCreatePlayerState(player, relevantGame);
      };
    }

    return;
  }

  let activeChallengeText = "-";
  if (currentState.active_challenge_id) {
    activeChallengeText = getChallengeTitleByIdAdmin(currentState.active_challenge_id);
  }

  const score = currentState.score ?? 0;
  const cooldownText = formatAdminCooldown(currentState.cooldown_until);

  const completedRows = getCompletedRowsForPlayerInGame(player.id, relevantGame.id);
  const firstSolverCount = getFirstSolverCountForPlayerInGame(player.id, relevantGame.id);
  const bingoCount = getBingoCountForPlayerInGame(player.id, relevantGame.id);

  const playerGames = getAdminGameStateGamesForPlayer(player.id);
  const playerGamesText = playerGames.length
    ? playerGames.map(game => game.name).join(", ")
    : "-";

  const lastActivityLog = relevantGame
    ? await loadLastActivityLogForPlayerInGame(player.id, relevantGame.id)
    : null;

  const lastActivityText = lastActivityLog
    ? formatLastActivityShort(lastActivityLog)
    : "Noch keine Aktivität";

  detailsEl.innerHTML = `
    <div class="admin-details-grid">
      <div class="admin-detail-card">
        <div class="admin-detail-label">Name</div>
        <div class="admin-detail-value">${displayName}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Username</div>
        <div class="admin-detail-value">${player.username || "-"}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Rolle</div>
        <div class="admin-detail-value">${player.role || "-"}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Gesperrt</div>
        <div
          id="adminToggleBlockedBtn"
          class="admin-detail-value clickable ${player.is_blocked ? "danger-state" : ""}"
          title="Zum Umschalten klicken"
        >
          ${player.is_blocked ? "Ja" : "Nein"}
        </div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Player ID</div>
        <div class="admin-detail-value">${player.id}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">PIN</div>
        <div class="admin-detail-value">${player.pin_hash || "-"}</div>
      </div>

      <div class="admin-detail-card admin-detail-wide">
        <div class="admin-detail-label">Spielstände vorhanden in</div>
        <div class="admin-detail-value">${playerGamesText}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Ausgewähltes Spiel</div>
        <div class="admin-detail-value">${relevantGame?.name || "-"}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Score</div>
        <div
          id="adminEditScoreBtn"
          class="admin-detail-value clickable"
          title="Zum Bearbeiten klicken"
        >
          ${score}
        </div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Aktive Aufgabe</div>
        <div class="admin-detail-value">${activeChallengeText}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Cooldown</div>
        <div
          id="adminEditCooldownBtn"
          class="admin-detail-value clickable"
          title="Zum Bearbeiten klicken"
        >
          ${cooldownText}
        </div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Abgeschlossene Aufgaben</div>
        <div class="admin-detail-value">${completedRows.length}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">First Solver</div>
        <div class="admin-detail-value">${firstSolverCount}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Bingos</div>
        <div class="admin-detail-value">${bingoCount}</div>
      </div>

      <div class="admin-detail-card">
        <div class="admin-detail-label">Letzte Aktivität</div>
        <div class="admin-detail-value">${lastActivityText}</div>
      </div>
    </div>
  `;

  const toggleBlockedBtn = document.getElementById("adminToggleBlockedBtn");
  const editScoreBtn = document.getElementById("adminEditScoreBtn");
  const editCooldownBtn = document.getElementById("adminEditCooldownBtn");

  if (toggleBlockedBtn) {
    toggleBlockedBtn.addEventListener("click", async () => {
      await handleAdminToggleBlocked(player);
    });
  }

  if (editScoreBtn) {
    editScoreBtn.addEventListener("click", async () => {
      await handleAdminEditScore(player, relevantGame);
    });
  }

  if (editCooldownBtn) {
    editCooldownBtn.addEventListener("click", async () => {
      await handleAdminEditCooldown(player, relevantGame);
    });
  }

  if (actionBar) {
    actionBar.classList.remove("hidden");
  }

  if (createStateBar) {
    createStateBar.classList.add("hidden");
  }

  if (adminResetPlayerGameBtn) {
    adminResetPlayerGameBtn.onclick = async () => {
      await adminResetPlayerGameProgress(player, relevantGame);
    };
  }

  if (adminDeletePlayerBtn) {
    adminDeletePlayerBtn.onclick = async () => {
      await adminDeletePlayerCompletely(player);
    };
  }

  renderAdminPlayerMiniGrid(player, relevantGame);
  renderAdminCompletedChallenges(player, relevantGame);
  renderAdminPlayerGallery(player, relevantGame);
}

// =======================
// MINI GRID LARGE
// =======================

function renderAdminPlayerMiniGrid(player, game) {
  const wrapperEl = document.getElementById("adminPlayerGameMiniGrid");
  const gridEl = document.getElementById("adminPlayerMiniGrid");

  if (!wrapperEl || !gridEl) return;

  if (!player || !game) {
    wrapperEl.classList.add("hidden");
    gridEl.innerHTML = "";
    return;
  }

  const gameChallenges = adminChallenges
    .filter(challenge => challenge.game_id === game.id && challenge.is_active !== false)
    .sort((a, b) => a.position - b.position);

  const challengeRows = getChallengeRowsForPlayerInGame(player.id, game.id);
  const challengeRowMap = {};

  challengeRows.forEach(row => {
    challengeRowMap[row.challenge_id] = row;
  });

  const gridSize = game.grid_size || 5;
  const expectedCount = gridSize * gridSize;

  const challengeByPosition = {};
  gameChallenges.forEach(challenge => {
    challengeByPosition[challenge.position] = challenge;
  });

  gridEl.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
  gridEl.innerHTML = "";

  for (let position = 1; position <= expectedCount; position++) {
    const challenge = challengeByPosition[position];

    if (!challenge) {
      const placeholder = document.createElement("div");
      placeholder.className = "admin-mini-cell placeholder";
      placeholder.innerHTML = `<div class="admin-mini-cell-title"></div>`;
      gridEl.appendChild(placeholder);
      continue;
    }

    const row = challengeRowMap[challenge.id];
    const isCompleted = row?.status === "completed";
    const isActive = row?.status === "active";
    const isFirstSolver = row?.was_first_solver === true;

    const cell = document.createElement("div");
    cell.className = "admin-mini-cell";

    if (isCompleted) cell.classList.add("completed");
    if (isActive) cell.classList.add("active");
    if (isFirstSolver) cell.classList.add("first-solver");

    cell.innerHTML = `
  <div class="admin-mini-cell-title">
    ${shortenTitle(challenge.title || String(position), 22)}
  </div>
`;

cell.title = challenge.title || `Feld ${position}`;
cell.style.cursor = "pointer";

cell.addEventListener("click", async () => {
  console.log("Grid-Feld geklickt:", {
    playerId: player?.id,
    gameId: game?.id,
    challengeId: challenge?.id,
    challengeTitle: challenge?.title
  });

  try {
    await showAdminPlayerChallengeDetails(player, game, challenge);
  } catch (err) {
    console.error("Fehler beim Öffnen des Admin-Challenge-Modals:", err);
  }
});

gridEl.appendChild(cell);
  }

  wrapperEl.classList.remove("hidden");
}

// =======================
// COMPLETED LIST
// =======================

function renderAdminCompletedChallenges(player, game) {
  const wrapperEl = document.getElementById("adminPlayerCompletedWrapper");
  const listEl = document.getElementById("adminPlayerCompletedList");

  if (!wrapperEl || !listEl) return;

  if (!player || !game) {
    wrapperEl.classList.add("hidden");
    listEl.innerHTML = "";
    return;
  }

  const completedRows = getCompletedRowsForPlayerInGame(player.id, game.id);

  if (!completedRows.length) {
    wrapperEl.classList.remove("hidden");
    listEl.innerHTML = `<p class="admin-details-empty">Noch keine Aufgaben abgeschlossen.</p>`;
    return;
  }

  let html = `<div class="admin-completion-list">`;

  completedRows.forEach(row => {
    const challenge = getChallengeByIdAdmin(row.challenge_id);
    const title = challenge?.title || `Challenge ${row.challenge_id}`;
    const clickable = row.proof_image_path ? "clickable" : "";

    html += `
      <div class="admin-completion-row">
        <div class="admin-completion-left">
          <div
            class="admin-completion-name ${clickable}"
            data-challenge-id="${row.challenge_id}"
          >
            ${title}
            ${row.was_first_solver ? `<span class="admin-completion-star">⭐</span>` : ""}
          </div>
          <div class="admin-completion-meta">
            ${formatAdminDateTime(row.completed_at)}
          </div>
        </div>

        <div class="admin-completion-right">
          <div class="admin-completion-points">${row.points_awarded || 0}P</div>
        </div>
      </div>
    `;
  });

  html += `</div>`;

  listEl.innerHTML = html;
  wrapperEl.classList.remove("hidden");

  const clickableEntries = listEl.querySelectorAll(".admin-completion-name.clickable");

  clickableEntries.forEach(el => {
    el.addEventListener("click", () => {
      const challengeId = Number(el.dataset.challengeId);
      setAdminGalleryToChallenge(player.id, game.id, challengeId);
    });
  });
}

// =======================
// GALLERY
// =======================

function buildAdminGalleryEntries(playerId, gameId) {
  return getCompletedRowsForPlayerInGame(playerId, gameId)
    .filter(row => row.proof_image_path)
    .map(row => {
      const challenge = getChallengeByIdAdmin(row.challenge_id);
      return {
        challengeId: row.challenge_id,
        challengeTitle: challenge?.title || `Challenge ${row.challenge_id}`,
        completedAt: row.completed_at,
        proofImagePath: row.proof_image_path,
        pointsAwarded: row.points_awarded || 0,
        wasFirstSolver: row.was_first_solver === true
      };
    });
}

function renderAdminPlayerGallery(player, game) {
  const wrapperEl = document.getElementById("adminPlayerGalleryWrapper");
  const galleryEl = document.getElementById("adminPlayerGallery");

  if (!wrapperEl || !galleryEl) return;

  if (!player || !game) {
    wrapperEl.classList.add("hidden");
    galleryEl.innerHTML = "";
    currentAdminGalleryEntries = [];
    currentAdminGalleryIndex = 0;
    return;
  }

  currentAdminGalleryEntries = buildAdminGalleryEntries(player.id, game.id);
  currentAdminGalleryIndex = 0;

  if (!currentAdminGalleryEntries.length) {
    wrapperEl.classList.remove("hidden");
    galleryEl.innerHTML = `<p class="admin-details-empty">Keine Bilder im relevanten Spiel vorhanden.</p>`;
    return;
  }

  wrapperEl.classList.remove("hidden");
  renderAdminGalleryCurrent();
}

function renderAdminGalleryCurrent() {
  const galleryEl = document.getElementById("adminPlayerGallery");
  if (!galleryEl) return;

  if (!currentAdminGalleryEntries.length) {
    galleryEl.innerHTML = `<p class="admin-details-empty">Keine Bilder vorhanden.</p>`;
    return;
  }

  const entry = currentAdminGalleryEntries[currentAdminGalleryIndex];
  const imageUrl = getPublicImageUrl(entry.proofImagePath);

  galleryEl.innerHTML = `
    <div class="admin-gallery-caption">
      <strong>${entry.challengeTitle}</strong>
      <span class="admin-gallery-time">(${formatAdminDateTime(entry.completedAt)})</span>
    </div>

    <div class="admin-gallery-image-container">
      ${currentAdminGalleryIndex > 0 ? `<div class="admin-gallery-arrow left" id="adminGalleryPrevBtn">‹</div>` : ""}
      <img src="${imageUrl}" class="admin-gallery-image" alt="Beweisfoto" />
      ${currentAdminGalleryIndex < currentAdminGalleryEntries.length - 1 ? `<div class="admin-gallery-arrow right" id="adminGalleryNextBtn">›</div>` : ""}
    </div>
  `;

  const prevBtn = document.getElementById("adminGalleryPrevBtn");
  const nextBtn = document.getElementById("adminGalleryNextBtn");

  if (prevBtn) {
    prevBtn.onclick = () => {
      if (currentAdminGalleryIndex > 0) {
        currentAdminGalleryIndex--;
        renderAdminGalleryCurrent();
      }
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      if (currentAdminGalleryIndex < currentAdminGalleryEntries.length - 1) {
        currentAdminGalleryIndex++;
        renderAdminGalleryCurrent();
      }
    };
  }
}

function setAdminGalleryToChallenge(playerId, gameId, challengeId) {
  currentAdminGalleryEntries = buildAdminGalleryEntries(playerId, gameId);

  const index = currentAdminGalleryEntries.findIndex(entry => entry.challengeId === challengeId);
  if (index >= 0) {
    currentAdminGalleryIndex = index;
    renderAdminGalleryCurrent();
  }
}

// =======================
// EVENT LISTENER
// =======================


if (closeAdminPlayerChallengeBtn) {
  closeAdminPlayerChallengeBtn.addEventListener("click", () => {
    closeAdminPlayerChallengeModal();
  });
}

if (adminMarkChallengeCompletedBtn) {
  adminMarkChallengeCompletedBtn.addEventListener("click", async () => {
    await adminMarkChallengeAsCompleted();
  });
}

if (adminSetChallengeInactiveBtn) {
  adminSetChallengeInactiveBtn.addEventListener("click", async () => {
    await adminSetChallengeInactiveFromModal();
  });
}

if (adminResetChallengeBtn) {
  adminResetChallengeBtn.addEventListener("click", async () => {
    await adminResetChallengeFromModal();
  });
}

if (adminSetChallengeActiveBtn) {
  adminSetChallengeActiveBtn.addEventListener("click", async () => {
    await adminSetChallengeActiveFromModal();
  });
}