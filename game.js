// =======================
// GAME STATE
// =======================

let gameState = {
  activeChallengeId: null,
  completed: [],
  firstSolved: [],
  completedAt: {},
  proofImagePaths: {},     // { [boardId]: "..." }
  cooldownUntil: null,
  score: 0,
  bingos: [],
  bingoCells: []
};

let cooldownInterval = null;

// =======================
// HILFSFUNKTIONEN
// =======================

function isCooldownActive() {
  if (!gameState.cooldownUntil) return false;
  return Date.now() < gameState.cooldownUntil;
}

function getRemainingCooldownSeconds() {
  if (!gameState.cooldownUntil) return 0;
  return Math.max(0, Math.ceil((gameState.cooldownUntil - Date.now()) / 1000));
}

function formatCooldownTime(totalSeconds) {
  const seconds = Math.max(0, Math.ceil(totalSeconds));

  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} min`;
  }

  return `${seconds} s`;
}

// =======================
// BINGOLOGIK
// =======================

const bingoLines = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
  [11, 12, 13, 14, 15],
  [16, 17, 18, 19, 20],
  [21, 22, 23, 24, 25],

  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  [5, 10, 15, 20, 25],

  [1, 7, 13, 19, 25],
  [5, 9, 13, 17, 21]
];

function rebuildBingoCellsFromBingos() {
  gameState.bingoCells = [];

  for (const lineIndex of gameState.bingos) {
    const line = bingoLines[lineIndex];
    if (!line) continue;

    for (const boardId of line) {
      if (!gameState.bingoCells.includes(boardId)) {
        gameState.bingoCells.push(boardId);
      }
    }
  }
}

function checkForNewBingos() {
  const newLineIndexes = [];

  for (let i = 0; i < bingoLines.length; i++) {
    const line = bingoLines[i];

    if (gameState.bingos.includes(i)) continue;

    const isComplete = line.every(boardId => gameState.completed.includes(boardId));

    if (isComplete) {
      gameState.bingos.push(i);

      const bingoBonus = currentGame?.bingo_bonus_points ?? 5;
      gameState.score += bingoBonus;

      newLineIndexes.push(i);
    }
  }

  rebuildBingoCellsFromBingos();

  return newLineIndexes;
}

// =======================
// STATE AUS DB LADEN
// =======================

async function initializePlayerStateFromDatabase() {
  if (!currentPlayer) return false;

    gameState = {
    activeChallengeId: null,
    completed: [],
    firstSolved: [],
    completedAt: {},
    proofImagePaths: {},
    cooldownUntil: null,
    score: 0,
    bingos: [],
    bingoCells: []
  };

  const playerId = currentPlayer.id;

  const ensuredState = await ensurePlayerGameState(playerId);
  if (!ensuredState) {
    return false;
  }

  const [dbGameState, dbPlayerChallenges, dbPlayerBingos] = await Promise.all([
    loadPlayerGameState(playerId),
    loadPlayerChallenges(playerId),
    loadPlayerBingos(playerId)
  ]);

  if (!dbGameState) {
    return false;
  }

  let activeBoardId = null;

  if (dbGameState.active_challenge_id) {
    const activeChallenge = getChallengeByDbId(dbGameState.active_challenge_id);
    if (activeChallenge) {
      activeBoardId = activeChallenge.boardId;
    }
  }

  const completedBoardIds = dbPlayerChallenges
    .filter(row => row.status === "completed")
    .map(row => {
      const challenge = getChallengeByDbId(row.challenge_id);
      return challenge ? challenge.boardId : null;
    })
    .filter(Boolean);

  const completedAtMap = {};

  dbPlayerChallenges
    .filter(row => row.status === "completed")
    .forEach(row => {
      const challenge = getChallengeByDbId(row.challenge_id);
      if (!challenge) return;

      completedAtMap[challenge.boardId] = row.completed_at || null;
    });

     const proofImagePathMap = {};

  dbPlayerChallenges
    .filter(row => row.status === "completed" && row.proof_image_path)
    .forEach(row => {
      const challenge = getChallengeByDbId(row.challenge_id);
      if (!challenge) return;

      proofImagePathMap[challenge.boardId] = row.proof_image_path;
    }); 

  const firstSolvedBoardIds = dbPlayerChallenges
    .filter(row => row.status === "completed" && row.was_first_solver === true)
    .map(row => {
      const challenge = getChallengeByDbId(row.challenge_id);
      return challenge ? challenge.boardId : null;
    })
    .filter(Boolean);

  const bingoIndexes = dbPlayerBingos
    .map(row => Number(row.line_key))
    .filter(Number.isInteger);

  gameState.activeChallengeId = activeBoardId;
  gameState.completed = completedBoardIds;
  gameState.firstSolved = firstSolvedBoardIds;
  gameState.completedAt = completedAtMap;
  gameState.proofImagePaths = proofImagePathMap;
  gameState.cooldownUntil = dbGameState.cooldown_until
    ? new Date(dbGameState.cooldown_until).getTime()
    : null;
  gameState.score = dbGameState.score || 0;
  gameState.bingos = bingoIndexes;
  gameState.bingoCells = [];

  rebuildBingoCellsFromBingos();

  return true;
}

// =======================
// CHALLENGE AKTIVIEREN
// =======================

async function activateChallenge(boardId) {
  if (!currentPlayer) return;
  if (isCooldownActive()) return;
  if (gameState.activeChallengeId !== null) return;
  if (gameState.completed.includes(boardId)) return;

  const challenge = getChallengeByBoardId(boardId);
  if (!challenge) return;

  const playerId = currentPlayer.id;

  const updatedGameState = await updatePlayerGameState(playerId, {
    active_challenge_id: challenge.dbId
  });

  if (!updatedGameState) {
    alert("Aktive Aufgabe konnte nicht gespeichert werden.");
    return;
  }

  const updatedPlayerChallenge = await upsertPlayerChallenge(playerId, challenge.dbId, {
    status: "active",
    completed_at: null,
    was_first_solver: false,
    points_awarded: null
  });

  if (!updatedPlayerChallenge) {
    await updatePlayerGameState(playerId, {
      active_challenge_id: null
    });

    alert("Challenge-Status konnte nicht gespeichert werden.");
    return;
  }

  gameState.activeChallengeId = boardId;

  await loadGlobalChallengeStats();
  openChallengeModal(challenge);
  renderGrid();
}

// =======================
// SPIELLOGIK
// =======================

async function completeChallenge(boardId, proofImagePath = null) {
  if (!currentPlayer) return;

  const challenge = getChallengeByBoardId(boardId);
  if (!challenge) return;

  const playerId = currentPlayer.id;

  const previousScore = gameState.score;
  const previousActiveChallengeId = gameState.activeChallengeId;
  const previousCooldownUntil = gameState.cooldownUntil;

  const { count, error: countError } = await supabaseClient
    .from("player_challenges")
    .select("*", { count: "exact", head: true })
    .eq("game_id", currentGameId)
    .eq("challenge_id", challenge.dbId)
    .eq("status", "completed");

  if (countError) {
    console.error("Fehler beim Prüfen des First Solvers:", countError);
    alert("First-Solver-Status konnte nicht geprüft werden.");
    return;
  }

  const isFirstSolver = count === 0;
  const awardedPoints = isFirstSolver ? challenge.points * 2 : challenge.points;

  const wasAlreadyCompleted = gameState.completed.includes(boardId);

  const nextCompleted = wasAlreadyCompleted
    ? [...gameState.completed]
    : [...gameState.completed, boardId];

  const nextFirstSolved =
    isFirstSolver && !gameState.firstSolved.includes(boardId)
      ? [...gameState.firstSolved, boardId]
      : [...gameState.firstSolved];

  let nextScore = gameState.score;

  if (!wasAlreadyCompleted) {
    nextScore += awardedPoints;
  }

  const bingoResult = calculateBingoResult(
    nextCompleted,
    gameState.bingos,
    nextScore
  );

  const nextBingos = bingoResult.bingos;
  const nextBingoCells = bingoResult.bingoCells;
  const newBingoIndexes = bingoResult.newLineIndexes;
  nextScore = bingoResult.score;

  const updatedGameState = await updatePlayerGameState(playerId, {
    score: nextScore,
    active_challenge_id: null,
    cooldown_until: null
  });

  if (!updatedGameState) {
    alert("Spielstand konnte nicht gespeichert werden.");
    return;
  }

  const completedAt = new Date().toISOString();

  const updatedPlayerChallenge = await upsertPlayerChallenge(playerId, challenge.dbId, {
  status: "completed",
  completed_at: completedAt,
  was_first_solver: isFirstSolver,
  points_awarded: awardedPoints,
  proof_image_path: proofImagePath
});

if (proofImagePath) {
  gameState.proofImagePaths[boardId] = proofImagePath;
}

  if (!updatedPlayerChallenge) {
    const rollbackActiveChallenge = previousActiveChallengeId
      ? getChallengeByBoardId(previousActiveChallengeId)
      : null;

    await updatePlayerGameState(playerId, {
      score: previousScore,
      active_challenge_id: rollbackActiveChallenge ? rollbackActiveChallenge.dbId : null,
      cooldown_until: previousCooldownUntil
        ? new Date(previousCooldownUntil).toISOString()
        : null
    });

    alert("Challenge-Abschluss konnte nicht gespeichert werden.");
    return;
  }

  gameState.completed = nextCompleted;
  gameState.firstSolved = nextFirstSolved;
  gameState.completedAt[boardId] = completedAt;
  gameState.score = nextScore;
  gameState.activeChallengeId = null;
  gameState.bingos = nextBingos;
  gameState.bingoCells = nextBingoCells;

  const bingoBonus = currentGame?.bingo_bonus_points ?? 5;

  for (const lineIndex of newBingoIndexes) {
    await insertPlayerBingo(playerId, String(lineIndex), bingoBonus);
  }

  await loadGlobalChallengeStats();
  await renderLeaderboard();

  closeModal();
  renderGrid();

  if (isFirstSolver) {
    await showFirstSolverAnimation();
  }

  if (newBingoIndexes.length > 0) {
    await showBingoAnimation();
  }
}

async function failChallenge() {
  if (!currentPlayer) return;

  const playerId = currentPlayer.id;
  const activeBoardId = gameState.activeChallengeId;
  const activeChallenge = activeBoardId ? getChallengeByBoardId(activeBoardId) : null;

  const cooldownSeconds = currentGame?.cooldown_seconds ?? 5;
  const cooldownUntilDate = new Date(Date.now() + cooldownSeconds * 1000);

  const updatedGameState = await updatePlayerGameState(playerId, {
    active_challenge_id: null,
    cooldown_until: cooldownUntilDate.toISOString()
  });

  if (!updatedGameState) {
    alert("Cooldown konnte nicht gespeichert werden.");
    return;
  }

  if (activeChallenge) {
    const updatedPlayerChallenge = await upsertPlayerChallenge(playerId, activeChallenge.dbId, {
      status: "hidden",
      completed_at: null,
      was_first_solver: false,
      points_awarded: null
    });

    if (!updatedPlayerChallenge) {
      await updatePlayerGameState(playerId, {
        active_challenge_id: activeChallenge.dbId,
        cooldown_until: null
      });

      alert("Challenge-Status konnte nicht gespeichert werden.");
      return;
    }
  }

  gameState.activeChallengeId = null;
  gameState.cooldownUntil = cooldownUntilDate.getTime();

  await loadGlobalChallengeStats();
  await renderLeaderboard();

  openCooldownModal();
  startCooldownLoop();
  renderGrid();
}

// =======================
// COOLDOWN
// =======================

function startCooldownLoop() {
  if (cooldownInterval) {
    clearInterval(cooldownInterval);
  }

  cooldownInterval = setInterval(async () => {
    const remaining = getRemainingCooldownSeconds();
    const timerNumber = document.getElementById("timerNumber");

    if (timerNumber) {
      timerNumber.textContent = formatCooldownTime(remaining);
    }

    if (!isCooldownActive()) {
      clearInterval(cooldownInterval);
      cooldownInterval = null;

      gameState.cooldownUntil = null;

      if (currentPlayer) {
        await updatePlayerGameState(currentPlayer.id, {
          cooldown_until: null
        });
      }

      closeModal();
      renderGrid();
      return;
    }

    renderGrid();
  }, 200);
}