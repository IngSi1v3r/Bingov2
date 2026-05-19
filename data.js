/**
 * ============================================================
 * data.js
 * ============================================================
 *
 * Zweck:
 * Spielerseitige Daten- und State-Bruecke.
 *
 * Diese Datei enthaelt weiterhin die globalen Variablen und Funktionsnamen,
 * die von game.js, app.js, live-challenges.js und main.js verwendet werden.
 *
 * Die eigentlichen Lesezugriffe laufen jetzt weitgehend ueber DataService.
 *
 * Hier bleiben bewusst:
 * - currentGameId / currentGame / challenges
 * - Mapping der Challenge-Daten fuer die Spieler-UI
 * - lokale Helper wie getChallengeByBoardId()
 * - spielbezogene Schreibfunktionen
 * - Bingo-Berechnungshelper
 * - Profil-Loeschung
 * - Regeln-Rendering
 *
 * Nicht mehr hier:
 * - direkte Supabase-Selects fuer einfache Ladefunktionen
 * - doppelte Leaderboard-/Completion-Loader
 */

/* ============================================================
 * GLOBALER SPIEL-STATE / KONSTANTEN
 * ============================================================ */

const GAME_STORAGE_KEY = "festival_bingo_game_id";

let currentGameId = loadGameIdFromLocalStorage();
let currentGame = null;
let challenges = [];
let bingoLineStats = {};

/* ============================================================
 * GAME LOCAL STORAGE
 * ============================================================ */

function saveGameIdToLocalStorage(gameId) {
  localStorage.setItem(GAME_STORAGE_KEY, String(gameId));
}

function loadGameIdFromLocalStorage() {
  const raw = localStorage.getItem(GAME_STORAGE_KEY);
  if (!raw) return 1;

  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : 1;
}

function setCurrentGameId(gameId) {
  currentGameId = Number(gameId);
  saveGameIdToLocalStorage(currentGameId);
}

/* ============================================================
 * GAME LADEN
 * ============================================================ */

/**
 * Laedt alle aktiven Spiele fuer die Spielauswahl.
 */
async function loadAllGames() {
  if (!currentPlayer?.id) {
    return {
      myGames: [],
      availableGames: []
    };
  }

  return await DataService.games.loadVisibleForPlayer(currentPlayer.id);
}

/**
 * Laedt das aktuell ausgewaehlte Spiel und baut die Bingo-Linien neu.
 */
async function loadGame() {
  const data = await DataService.games.loadById(currentGameId);

  if (!data) {
    currentGame = null;
    return false;
  }

  currentGame = data;
  bingoLines = generateBingoLines(currentGame?.grid_size || 5);

  return true;
}

/**
 * Laedt das aktuell geoeffnete Spiel frisch nach.
 * Wird verwendet, um zu pruefen, ob es noch aktiv ist.
 */
async function loadCurrentGameFresh() {
  return await DataService.games.loadById(currentGameId);
}

/* ============================================================
 * CHALLENGES LADEN / MAPPING
 * ============================================================ */

/**
 * Mappt eine DB-Challenge auf das Format der Spieler-UI.
 */
function mapChallengeRowForGameUi(row) {
  return {
    boardId: Number(row.position),
    dbId: row.id,
    title: row.title,
    task: row.task,
    points: row.points,
    categoryIcon: row.category_icon || "",
    details: row.details || "",
    successText: row.success_text || "",
    successVariant1: row.success_variant_1 || "",
    successVariant2: row.success_variant_2 || "",
    successVariant3: row.success_variant_3 || "",
    descriptionImagePath: row.description_image_path || null,
    photoMode: row.photo_mode || (row.requires_photo_proof ? "required" : "none"),
    requiresPhotoProof: row.photo_mode === "required" || row.requires_photo_proof === true,
    isActive: row.is_active === true,
    solvedCount: 0,
    activeCount: 0
  };
}

/**
 * Laedt alle Challenges des aktuellen Spiels und mappt sie fuer die UI.
 */
async function loadChallengesFromDatabase() {
  const rows = await DataService.challenges.loadForGame(currentGameId);

  challenges = (rows || []).map(mapChallengeRowForGameUi);

  return true;
}

/* ============================================================
 * CHALLENGE HELPER
 * ============================================================ */

function getChallengeByBoardId(boardId) {
  return challenges.find(c => c.boardId === boardId) || null;
}

function getChallengeByDbId(dbId) {
  return challenges.find(c => c.dbId === dbId) || null;
}


function getChallengeSuccessVariants(challenge) {
  if (!challenge) return [];

  return [
    { points: 1, label: challenge.successVariant1 || "" },
    { points: 2, label: challenge.successVariant2 || "" },
    { points: 3, label: challenge.successVariant3 || "" }
  ].filter(variant => String(variant.label || "").trim() !== "");
}

function isVariablePointsChallenge(challenge) {
  return (
    !!challenge &&
    (challenge.points === null || challenge.points === undefined) &&
    getChallengeSuccessVariants(challenge).length > 0
  );
}

function getChallengePointsDisplay(challenge) {
  if (isVariablePointsChallenge(challenge)) return "?";
  return `${challenge?.points ?? 0}P`;
}

/* ============================================================
 * PLAYER GAME STATE
 * ============================================================ */

/**
 * Stellt sicher, dass fuer Spieler + Spiel ein player_game_state existiert.
 *
 * Wichtig:
 * Bei neu angelegtem State werden weiterhin Live-Challenge-Views initialisiert,
 * damit alte Live-Challenges nicht nachtraeglich als neu auftauchen.
 */
async function ensurePlayerGameState(playerId) {
  const existing = await DataService.playerState.loadForPlayerAndGame(
    playerId,
    currentGameId
  );

  if (existing) {
    return existing;
  }

  const inserted = await joinCurrentGame(playerId, "");

  if (!inserted) {
    return null;
  }

  if (typeof initializeLiveChallengeViewsForNewPlayerInGame === "function") {
    const liveViewsInitialized =
      await initializeLiveChallengeViewsForNewPlayerInGame(playerId);

    if (!liveViewsInitialized) {
      console.warn("Live-Challenge-Views konnten nicht initialisiert werden.");
    }
  }

  return inserted;
}

async function joinCurrentGame(playerId, gamePassword = "") {
  const { data, error } = await supabaseClient.rpc(
    "join_bingo_game",
    {
      p_player_id: playerId,
      p_game_id: currentGameId,
      p_game_password: gamePassword
    }
  );

  if (error) {
    console.error("Fehler beim Beitreten zum Spiel:", error);
    throw error;
  }

  if (!data) {
    return null;
  }

  const state = await DataService.playerState.loadForPlayerAndGame(
    playerId,
    currentGameId
  );

  if (state && typeof initializeLiveChallengeViewsForNewPlayerInGame === "function") {
    const liveViewsInitialized =
      await initializeLiveChallengeViewsForNewPlayerInGame(playerId);

    if (!liveViewsInitialized) {
      console.warn("Live-Challenge-Views konnten nicht initialisiert werden.");
    }
  }

  return state;
}

/**
 * Laedt den Spielstand eines Spielers im aktuellen Spiel.
 */
async function loadPlayerGameState(playerId) {
  return await DataService.playerState.loadForPlayerAndGame(
    playerId,
    currentGameId
  );
}

/**
 * Aktualisiert den Spielstand eines Spielers.
 * Schreibfunktion bleibt bewusst hier.
 */
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

/* ============================================================
 * PLAYER CHALLENGES
 * ============================================================ */

/**
 * Laedt alle Challenge-Zeilen eines Spielers im aktuellen Spiel.
 */
async function loadPlayerChallenges(playerId) {
  return await DataService.playerChallenges.loadForPlayerAndGame(
    playerId,
    currentGameId
  );
}

/**
 * Legt oder aktualisiert den Challenge-Status eines Spielers.
 * Schreibfunktion bleibt bewusst hier.
 */
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

/* ============================================================
 * PLAYER BINGOS
 * ============================================================ */

/**
 * Laedt alle Bingo-Eintraege eines Spielers im aktuellen Spiel.
 */
async function loadPlayerBingos(playerId) {
  return await DataService.playerBingos.loadForPlayerAndGame(
    playerId,
    currentGameId
  );
}

/**
 * Speichert einen neuen Bingo-Eintrag, falls er noch nicht existiert.
 * Schreibfunktion bleibt bewusst hier.
 */
async function insertPlayerBingo(playerId, lineKey, bonusPoints) {
  const lineKeyString = String(lineKey);

  const { data: existing, error: selectError } = await supabaseClient
    .from("player_bingos")
    .select("id")
    .eq("player_id", playerId)
    .eq("game_id", currentGameId)
    .eq("line_key", lineKeyString)
    .maybeSingle();

  if (selectError) {
    console.error("Fehler beim Pruefen bestehender player_bingos:", selectError, {
      playerId,
      currentGameId,
      lineKey: lineKeyString
    });
    throw selectError;
  }

  if (existing) {
    return existing;
  }

  const { data, error } = await supabaseClient
    .from("player_bingos")
    .insert({
      player_id: playerId,
      game_id: currentGameId,
      line_key: lineKeyString,
      bonus_points: bonusPoints
    })
    .select()
    .single();

  if (error) {
    console.error("Fehler beim Speichern von player_bingos:", error, {
      playerId,
      currentGameId,
      lineKey: lineKeyString,
      bonusPoints
    });
    throw error;
  }

  return data;
}

/**
 * Loescht alle Bingo-Eintraege eines Spielers im aktuellen Spiel.
 */
async function deleteAllPlayerBingos(playerId) {
  const { error } = await supabaseClient
    .from("player_bingos")
    .delete()
    .eq("player_id", playerId)
    .eq("game_id", currentGameId);

  if (error) {
    console.error("Fehler beim Loeschen von player_bingos:", error);
    return false;
  }

  return true;
}

async function loadGlobalBingoLineStats() {
  const rows = await DataService.playerBingos.loadForGame(currentGameId);

  const stats = {};

  for (const row of rows || []) {
    const lineKey = String(row.line_key);

    if (!stats[lineKey]) {
      stats[lineKey] = {
        count: 0,
        playerIds: [],
        rows: [],
        firstPlayerId: row.player_id,
        firstAwardedAt: row.awarded_at || null
      };
    }

    stats[lineKey].rows.push(row);
    stats[lineKey].count += 1;

    if (!stats[lineKey].playerIds.includes(row.player_id)) {
      stats[lineKey].playerIds.push(row.player_id);
    }

    if (
      row.awarded_at &&
      (!stats[lineKey].firstAwardedAt ||
        new Date(row.awarded_at) < new Date(stats[lineKey].firstAwardedAt))
    ) {
      stats[lineKey].firstAwardedAt = row.awarded_at;
      stats[lineKey].firstPlayerId = row.player_id;
    }
  }

  bingoLineStats = stats;
  return true;
}

function getBingoLineDisplayInfo(lineIndex) {
  const lineKey = String(lineIndex);
  const stat = bingoLineStats[lineKey] || null;

  const normalBonus = currentGame?.bingo_bonus_points ?? 5;
  const firstBonus = getFirstBingoBonusPoints();

  const count = stat?.count || 0;

  const ownBingo = currentPlayer
    ? (gameState.bingos || []).includes(Number(lineIndex))
    : false;

  const ownBingoRow = stat?.rows?.find(row =>
    Number(row.player_id) === Number(currentPlayer?.id)
  ) || null;

  const firstStillAvailable = count === 0;

  return {
    lineKey,
    count,
    ownCompleted: ownBingo,
    firstStillAvailable,
    availablePoints: ownBingoRow
      ? (ownBingoRow.bonus_points || normalBonus)
      : firstStillAvailable
        ? normalBonus + firstBonus
        : normalBonus
  };
}

/* ============================================================
 * BINGO HELPER
 * ============================================================ */

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

/**
 * Berechnet neue Bingos und den daraus folgenden Score.
 */
function calculateBingoResult(completedBoardIds, existingBingos, baseScore) {
  const nextBingos = [...existingBingos];
  const nextScore = baseScore;
  const newLineIndexes = [];

  for (let i = 0; i < bingoLines.length; i++) {
    const line = bingoLines[i];

    if (nextBingos.includes(i)) continue;

    const isComplete = line.every(boardId => completedBoardIds.includes(boardId));

    if (isComplete) {
      nextBingos.push(i);
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

function formatBingoLineName(lineKey) {
  const lineIndex = Number(lineKey);
  const gridSize = currentGame?.grid_size || 5;

  if (!Number.isInteger(lineIndex)) {
    return `Bingo ${lineKey}`;
  }

  if (lineIndex < gridSize) {
    return `Reihe ${lineIndex + 1} Bingo`;
  }

  if (lineIndex < gridSize * 2) {
    return `Spalte ${lineIndex - gridSize + 1} Bingo`;
  }

  if (lineIndex === gridSize * 2) {
    return "Diagonale ↘ Bingo";
  }

  if (lineIndex === gridSize * 2 + 1) {
    return "Diagonale ↙ Bingo";
  }

  return `Bingo ${lineIndex}`;
}

function isFirstBingoForLine(bingoRow) {
  if (!bingoRow) return false;

  const lineKey = String(bingoRow.line_key);
  const stat = bingoLineStats?.[lineKey];

  if (!stat?.firstPlayerId) return false;

  return Number(stat.firstPlayerId) === Number(bingoRow.player_id);
}

/* ============================================================
 * FIRST BINGO
 * ============================================================ */

function getFirstBingoBonusPoints() {
  return currentGame?.first_bingo_bonus_points ?? 3;
}

async function hasAnyPlayerClaimedBingoLine(lineKey) {
  const lineKeyString = String(lineKey);

  const { data, error } = await supabaseClient
    .from("player_bingos")
    .select("id")
    .eq("game_id", currentGameId)
    .eq("line_key", lineKeyString)
    .limit(1);

  if (error) {
    console.error("Fehler beim Pruefen bestehender Bingo-Linie:", error, {
      currentGameId,
      lineKey: lineKeyString
    });
    throw error;
  }

  return Array.isArray(data) && data.length > 0;
}

/* ============================================================
 * GLOBALE CHALLENGE STATS
 * ============================================================ */

/**
 * Laedt globale Challenge-Stats und schreibt solvedCount / activeCount
 * direkt in das lokale challenges-Array.
 */
async function loadGlobalChallengeStats() {
  const rows = await DataService.playerChallenges.loadGlobalStatsRows(currentGameId);

  for (const challenge of challenges) {
    challenge.solvedCount = 0;
    challenge.activeCount = 0;
  }

  for (const row of rows || []) {
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

/* ============================================================
 * LEADERBOARD / COMPLETIONS
 * ============================================================ */

/**
 * Laedt das Leaderboard des aktuellen Spiels.
 */
async function loadLeaderboard() {
  return await DataService.stats.loadLeaderboard(currentGameId);
}

/**
 * Laedt alle Abschluesse einer bestimmten Challenge.
 */
async function loadChallengeCompletions(challengeDbId) {
  return await DataService.playerChallenges.loadCompletionsForChallenge(
    challengeDbId,
    currentGameId
  );
}

/**
 * Laedt abgeschlossene Aufgaben des aktuellen Spielers.
 */
async function loadCompletedChallengesForCurrentPlayer(playerId) {
  return await DataService.playerChallenges.loadCompletedForPlayer(
    playerId,
    currentGameId,
    true
  );
}

/* ============================================================
 * PROFIL LOESCHEN
 * ============================================================ */

/**
 * Loescht ein Spielerprofil samt abhaengiger Spiel- und Live-Daten.
 * Schreibfunktion bleibt bewusst hier.
 */
async function deletePlayerProfile(playerId) {
  try {
    await supabaseClient
      .from("player_bingos")
      .delete()
      .eq("player_id", playerId);

    await supabaseClient
      .from("player_challenges")
      .delete()
      .eq("player_id", playerId);

    await supabaseClient
      .from("player_live_challenges")
      .delete()
      .eq("player_id", playerId);

    await supabaseClient
      .from("player_live_challenge_views")
      .delete()
      .eq("player_id", playerId);

    await supabaseClient
      .from("player_game_state")
      .delete()
      .eq("player_id", playerId);

    const { error } = await supabaseClient
      .from("players")
      .delete()
      .eq("id", playerId);

    if (error) {
      console.error("Fehler beim Loeschen des Players:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Fehler beim Profil loeschen:", err);
    return false;
  }
}

/* ============================================================
 * REGELN
 * ============================================================ */

/**
 * Rendert den Regeltext passend zum aktuell geladenen Spiel.
 */
function renderRulesContent() {
  const rulesContent = document.getElementById("rulesContent");
  const rulesTitle = document.getElementById("rulesTitle");

  if (!rulesContent || !rulesTitle) return;

  const gameName = currentGame?.name || "Unbekanntes Spiel";
  const gridSize = currentGame?.grid_size || 5;
  const cooldownSeconds = currentGame?.cooldown_seconds ?? 60;
  const bingoBonus = currentGame?.bingo_bonus_points ?? 5;

  rulesTitle.textContent = `Regeln & Punkte - ${gameName}`;

  rulesContent.innerHTML = `
    <p><strong>Ziel:</strong> Loese Aufgaben auf dem Spielfeld und sammle moeglichst viele Punkte.</p>

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
      <li>Wer eine Aufgabe als Erster loest, bekommt <strong>doppelte Punkte</strong>.</li>
    </ul>

    <p><strong>Bingo:</strong></p>
    <ul>
      <li>${gridSize} geloeste Felder in einer Reihe ergeben ein <strong>Bingo</strong>.</li>
      <li>Ein Bingo bringt <strong>+${bingoBonus} Bonuspunkte</strong>.</li>
      <li>Bingos zaehlen horizontal, vertikal und diagonal.</li>
    </ul>

    <p><strong>Cooldown:</strong></p>
    <ul>
      <li>Wenn du aufgibst, bekommst du eine Sperrzeit von ${cooldownSeconds} Sekunden.</li>
      <li>Waehrenddessen kannst du keine neue Aufgabe starten.</li>
    </ul>

    <p><strong>Hinweise im Spielfeld:</strong></p>
    <ul>
      <li>Die Zahl unten zeigt, wie viele Spieler das Feld bereits geloest haben.</li>
      <li>Der Banner oben zeigt, wenn andere Spieler gerade daran arbeiten.</li>
      <li>Ein Stern bedeutet, dass du diese Aufgabe als Erster geloest hast.</li>
    </ul>
  `;
}