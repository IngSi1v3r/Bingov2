// =======================
// DATEN / DB
// =======================

const GAME_STORAGE_KEY = "festival_bingo_game_id";

let currentGameId = loadGameIdFromLocalStorage();
let currentGame = null;
let challenges = [];

// =======================
// GAME LOCAL STORAGE
// =======================

function saveGameIdToLocalStorage(gameId) {
  localStorage.setItem(GAME_STORAGE_KEY, String(gameId));
}

function loadGameIdFromLocalStorage() {
  const raw = localStorage.getItem(GAME_STORAGE_KEY);
  if (!raw) return 1;

  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : 1;
}

// =======================
// GAME LADEN
// =======================

async function loadAllGames() {
  const { data, error } = await supabaseClient
    .from("games")
    .select("*")
    .eq("is_active", true)
    .order("id", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden aller Spiele:", error);
    return [];
  }

  return data || [];
}

async function loadGame() {
  const { data, error } = await supabaseClient
    .from("games")
    .select("*")
    .eq("id", currentGameId)
    .single();

  if (error) {
    console.error("Fehler beim Laden des Spiels:", error);
    return false;
  }

  currentGame = data;
  bingoLines = generateBingoLines(currentGame?.grid_size || 5);

  console.log("Aktuelles Spiel:", currentGame);
  console.log("Bingo-Linien:", bingoLines);

  return true;
}

function setCurrentGameId(gameId) {
  currentGameId = Number(gameId);
  saveGameIdToLocalStorage(currentGameId);
}

// =======================
// CHALLENGES LADEN
// =======================

async function loadChallengesFromDatabase() {
  console.log("Lade Challenges aus Supabase...");

  const { data, error } = await supabaseClient
    .from("challenges")
    .select("id, game_id, position, title, task, points, is_active, category_icon, details, success_text, requires_photo_proof")
    .eq("game_id", currentGameId)
    .eq("is_active", true)
    .order("position", { ascending: true });

  console.log("Supabase Antwort:", data, error);

  if (error) {
    console.error("Fehler beim Laden der Challenges:", error);
    return false;
  }

  challenges = data.map(row => ({
    boardId: Number(row.position),
    dbId: row.id,
    title: row.title,
    task: row.task,
    points: row.points,
    categoryIcon: row.category_icon || "",
    details: row.details || "",
    successText: row.success_text || "",
    requiresPhotoProof: row.requires_photo_proof === true,
    solvedCount: 0
  }));

  console.log("Challenges nach Mapping:", challenges);

  return true;
}

// =======================
// HILFSFUNKTIONEN
// =======================

function getChallengeByBoardId(boardId) {
  return challenges.find(c => c.boardId === boardId) || null;
}

function getChallengeByDbId(dbId) {
  return challenges.find(c => c.dbId === dbId) || null;
}

// =======================
// PLAYER GAME STATE
// =======================

async function ensurePlayerGameState(playerId) {
  const { data: existing, error: selectError } = await supabaseClient
    .from("player_game_state")
    .select("*")
    .eq("player_id", playerId)
    .eq("game_id", currentGameId)
    .maybeSingle();

  if (selectError) {
    console.error("Fehler beim Laden von player_game_state:", selectError);
    return null;
  }

  if (existing) {
    return existing;
  }

  const { data: inserted, error: insertError } = await supabaseClient
    .from("player_game_state")
    .insert({
      player_id: playerId,
      game_id: currentGameId,
      score: 0,
      active_challenge_id: null,
      cooldown_until: null
    })
    .select()
    .single();

  if (insertError) {
    console.error("Fehler beim Erstellen von player_game_state:", insertError);
    return null;
  }

  return inserted;
}

async function loadPlayerGameState(playerId) {
  const { data, error } = await supabaseClient
    .from("player_game_state")
    .select("*")
    .eq("player_id", playerId)
    .eq("game_id", currentGameId)
    .maybeSingle();

  if (error) {
    console.error("Fehler beim Laden des player_game_state:", error);
    return null;
  }

  return data;
}

async function updatePlayerGameState(playerId, updates) {
  const { data, error } = await supabaseClient
    .from("player_game_state")
    .update(updates)
    .eq("player_id", playerId)
    .eq("game_id", currentGameId)
    .select()
    .single();

  if (error) {
    console.error("Fehler beim Aktualisieren von player_game_state:", error);
    return null;
  }

  return data;
}

// =======================
// PLAYER CHALLENGES
// =======================

async function loadPlayerChallenges(playerId) {
  const { data, error } = await supabaseClient
    .from("player_challenges")
    .select("*")
    .eq("player_id", playerId)
    .eq("game_id", currentGameId);

  if (error) {
    console.error("Fehler beim Laden von player_challenges:", error);
    return [];
  }

  return data || [];
}

async function upsertPlayerChallenge(playerId, challengeDbId, fields) {
  const payload = {
    player_id: playerId,
    game_id: currentGameId,
    challenge_id: challengeDbId,
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
    console.error("Fehler beim Upsert von player_challenges:", error);
    return null;
  }

  return data;
}

// =======================
// PLAYER BINGOS
// =======================

async function loadPlayerBingos(playerId) {
  const { data, error } = await supabaseClient
    .from("player_bingos")
    .select("*")
    .eq("player_id", playerId)
    .eq("game_id", currentGameId);

  if (error) {
    console.error("Fehler beim Laden von player_bingos:", error);
    return [];
  }

  return data || [];
}

async function insertPlayerBingo(playerId, lineKey, bonusPoints) {
  const { data, error } = await supabaseClient
    .from("player_bingos")
    .upsert({
      player_id: playerId,
      game_id: currentGameId,
      line_key: String(lineKey),
      bonus_points: bonusPoints
    }, {
      onConflict: "player_id,game_id,line_key"
    })
    .select()
    .single();

  if (error) {
    console.error("Fehler beim Speichern von player_bingos:", error);
    return null;
  }

  return data;
}

function buildBingoCellsFromLineIndexes(lineIndexes) {
  const cells = [];

  for (const lineIndex of lineIndexes) {
    const line = bingoLines[lineIndex];
    if (!line) continue;

    for (const boardId of line) {
      if (!cells.includes(boardId)) {
        cells.push(boardId);
      }
    }
  }

  return cells;
}

function calculateBingoResult(completedBoardIds, existingBingos, baseScore) {
  const nextBingos = [...existingBingos];
  let nextScore = baseScore;
  const newLineIndexes = [];

  for (let i = 0; i < bingoLines.length; i++) {
    const line = bingoLines[i];

    if (nextBingos.includes(i)) continue;

    const isComplete = line.every(boardId => completedBoardIds.includes(boardId));

    if (isComplete) {
      nextBingos.push(i);

      const bingoBonus = currentGame?.bingo_bonus_points ?? 5;
      nextScore += bingoBonus;

      newLineIndexes.push(i);
    }
  }

  return {
    bingos: nextBingos,
    bingoCells: buildBingoCellsFromLineIndexes(nextBingos),
    score: nextScore,
    newLineIndexes
  };
}

async function deleteAllPlayerBingos(playerId) {
  const { error } = await supabaseClient
    .from("player_bingos")
    .delete()
    .eq("player_id", playerId)
    .eq("game_id", currentGameId);

  if (error) {
    console.error("Fehler beim Löschen von player_bingos:", error);
    return false;
  }

  return true;
}


// =======================
// GLOBALE CHALLENGE STATS
// =======================

async function loadGlobalChallengeStats() {
  const { data, error } = await supabaseClient
    .from("player_challenges")
    .select("player_id, challenge_id, status")
    .eq("game_id", currentGameId)
    .in("status", ["active", "completed"]);

  if (error) {
    console.error("Fehler beim Laden der globalen Challenge-Stats:", error);
    return false;
  }

  for (const challenge of challenges) {
    challenge.solvedCount = 0;
    challenge.activeCount = 0;
  }

  for (const row of data || []) {
    const challenge = getChallengeByDbId(row.challenge_id);
    if (!challenge) continue;

    if (row.status === "completed") {
      challenge.solvedCount += 1;
    }

    if (row.status === "active") {
      if (!currentPlayer || row.player_id !== currentPlayer.id) {
        challenge.activeCount += 1;
      }
    }
  }

  return true;
}



// =======================
// LEADERBOARD
// =======================

async function loadLeaderboard() {
  const { data, error } = await supabaseClient
    .from("player_game_state")
    .select(`
      score,
      player_id,
      active_challenge_id,
      cooldown_until,
      players (
        username,
        display_name
        )
    `)
    .eq("game_id", currentGameId)
    .order("score", { ascending: false });

  if (error) {
    console.error("Fehler beim Laden des Leaderboards:", error);
    return [];
  }

  return (data || []).map(row => {
    const cooldownUntilMs = row.cooldown_until
      ? new Date(row.cooldown_until).getTime()
      : null;

    return {
      playerId: row.player_id,
      username: row.players?.username || "Unbekannt",
      display_name: row.players?.display_name || null,
      score: row.score || 0,
      activeChallengeId: row.active_challenge_id,
      cooldownUntil: cooldownUntilMs
    };
  });
}

// =======================
// LISTE INNERHALB AUFGABE
// =======================


async function loadChallengeCompletions(challengeDbId) {
  const { data, error } = await supabaseClient
    .from("player_challenges")
    .select(`
      player_id,
      completed_at,
      was_first_solver,
      proof_image_path,
      players (
        username,
        display_name
        )
    `)
    .eq("game_id", currentGameId)
    .eq("challenge_id", challengeDbId)
    .eq("status", "completed")
    .order("completed_at", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden der Challenge-Abschlüsse:", error);
    return [];
  }

  return (data || []).map(row => ({
  playerId: row.player_id,
  username: row.players?.username || "Unbekannt",
  display_name: row.players?.display_name || null,
  completedAt: row.completed_at,
  wasFirstSolver: row.was_first_solver === true,
  proofImagePath: row.proof_image_path || null
}));
}

// =======================
// ABGESCHLOSSENE AUFGABEN
// =======================

async function loadCompletedChallengesForCurrentPlayer(playerId) {
  const { data, error } = await supabaseClient
    .from("player_challenges")
    .select("challenge_id, completed_at, was_first_solver, points_awarded, proof_image_path")
    .eq("player_id", playerId)
    .eq("game_id", currentGameId)
    .eq("status", "completed")
    .order("completed_at", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden der abgeschlossenen Aufgaben:", error);
    return [];
  }

  return data || [];
}

// =======================
// PROFIL LÖSCHEN
// =======================

async function deletePlayerProfile(playerId) {
  try {
    // 1. Bingos löschen
    await supabaseClient
      .from("player_bingos")
      .delete()
      .eq("player_id", playerId);

    // 2. Challenges löschen
    await supabaseClient
      .from("player_challenges")
      .delete()
      .eq("player_id", playerId);

    // 3. Game State löschen
    await supabaseClient
      .from("player_game_state")
      .delete()
      .eq("player_id", playerId);

    // 4. Player löschen
    const { error } = await supabaseClient
      .from("players")
      .delete()
      .eq("id", playerId);

    if (error) {
      console.error("Fehler beim Löschen des Players:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Fehler beim Profil löschen:", err);
    return false;
  }
}

// =======================
// REGELN
// =======================

function renderRulesContent() {
  const rulesContent = document.getElementById("rulesContent");
  const rulesTitle = document.getElementById("rulesTitle");

  if (!rulesContent || !rulesTitle) return;

  const gameName = currentGame?.name || "Unbekanntes Spiel";
  const gridSize = currentGame?.grid_size || 5;
  const cooldownSeconds = currentGame?.cooldown_seconds ?? 60;
  const bingoBonus = currentGame?.bingo_bonus_points ?? 5;

  // Titel mit Spielname
  rulesTitle.textContent = `Regeln & Punkte – ${gameName}`;

  rulesContent.innerHTML = `
    <p><strong>Ziel:</strong> Löse Aufgaben auf dem Spielfeld und sammle möglichst viele Punkte.</p>

    <p><strong>So funktioniert's:</strong></p>
    <ul>
      <li>Alle Spieler sehen dasselbe Spielfeld.</li>
      <li>Das Spielfeld hat ${gridSize}x${gridSize} Felder.</li>
      <li>Du kannst immer nur eine Aufgabe gleichzeitig aktiv haben.</li>
      <li>Nach dem Anklicken eines Feldes musst du dich entscheiden: <strong>Bestanden</strong> oder <strong>Aufgeben</strong>.</li>
    </ul>

    <p><strong>Punkte:</strong></p>
    <ul>
      <li>Jede Aufgabe bringt 1 bis 3 Punkte.</li>
      <li>Wer eine Aufgabe als Erster löst, bekommt <strong>doppelte Punkte</strong>.</li>
    </ul>

    <p><strong>Bingo:</strong></p>
    <ul>
      <li>${gridSize} gelöste Felder in einer Reihe ergeben ein <strong>Bingo</strong>.</li>
      <li>Ein Bingo bringt <strong>+${bingoBonus} Bonuspunkte</strong>.</li>
      <li>Bingos zählen horizontal, vertikal und diagonal.</li>
    </ul>

    <p><strong>Cooldown:</strong></p>
    <ul>
      <li>Wenn du aufgibst, bekommst du eine Sperrzeit von ${cooldownSeconds} Sekunden.</li>
      <li>Währenddessen kannst du keine neue Aufgabe starten.</li>
    </ul>

    <p><strong>Hinweise im Spielfeld:</strong></p>
    <ul>
      <li>Die Zahl unten zeigt, wie viele Spieler das Feld bereits gelöst haben.</li>
      <li>Der Banner oben zeigt, wenn andere Spieler gerade daran arbeiten.</li>
      <li>Ein ⭐ bedeutet, dass du diese Aufgabe als Erster gelöst hast.</li>
    </ul>
  `;
}