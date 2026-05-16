/**
 * ============================================================
 * game.js
 * ============================================================
 *
 * Zweck:
 * Zentrale Spiellogik der normalen Spielerseite.
 *
 * Diese Datei kuemmert sich um:
 * - lokalen Spielzustand eines Spielers
 * - Cooldown-Logik
 * - Bingo-Linien und Bingo-Bonus
 * - Synchronisation des lokalen States mit der Datenbank
 * - Aktivieren, Abschliessen, Aufgeben und Zuruecksetzen von Challenges
 * - Punktevergabe inklusive First Solver
 * - lokale UI-Folgeaktionen nach Spielaktionen
 *
 * Reine Ladefunktionen liegen inzwischen in data.js / data_service.js.
 * Schreibfunktionen werden indirekt ueber data.js genutzt.
 */



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

let bingoLines = [];

function generateBingoLines(size) {
  const lines = [];

  // horizontale Linien
  for (let row = 0; row < size; row++) {
    const line = [];
    for (let col = 0; col < size; col++) {
      line.push(row * size + col + 1);
    }
    lines.push(line);
  }

  // vertikale Linien
  for (let col = 0; col < size; col++) {
    const line = [];
    for (let row = 0; row < size; row++) {
      line.push(row * size + col + 1);
    }
    lines.push(line);
  }

  // Hauptdiagonale
  const diagonal1 = [];
  for (let i = 0; i < size; i++) {
    diagonal1.push(i * size + i + 1);
  }
  lines.push(diagonal1);

  // Gegendiagonale
  const diagonal2 = [];
  for (let i = 0; i < size; i++) {
    diagonal2.push(i * size + (size - 1 - i) + 1);
  }
  lines.push(diagonal2);

  return lines;
}

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
  displayedScore = gameState.score;
  gameState.bingos = bingoIndexes;
  gameState.bingoCells = [];

  rebuildBingoCellsFromBingos();

  return true;
}

async function syncPlayerStateFromDatabase() {
  if (!currentPlayer) return false;

  const previousActiveChallengeId = gameState.activeChallengeId;
  const playerId = currentPlayer.id;

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
  const proofImagePathMap = {};

  dbPlayerChallenges
    .filter(row => row.status === "completed")
    .forEach(row => {
      const challenge = getChallengeByDbId(row.challenge_id);
      if (!challenge) return;

      completedAtMap[challenge.boardId] = row.completed_at || null;

      if (row.proof_image_path) {
        proofImagePathMap[challenge.boardId] = row.proof_image_path;
      }
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

  if (!freezeScoreDisplay) {
    displayedScore = gameState.score;
  }

    await syncChallengeModalWithGameState(previousActiveChallengeId);

  return true;
}



async function syncChallengeModalWithGameState(previousActiveChallengeId) {
  const currentActiveChallengeId = gameState.activeChallengeId;
  const modalOpen = typeof isChallengeModalOpen === "function" && isChallengeModalOpen();
  const openModalBoardId =
    typeof getOpenChallengeBoardIdFromModal === "function"
      ? getOpenChallengeBoardIdFromModal()
      : null;

  // Fall 1:
  // Vorher aktiv, jetzt nicht mehr aktiv -> Modal schließen
  if (previousActiveChallengeId !== null && currentActiveChallengeId === null) {
    if (modalOpen) {
      closeModal();
    }
    return;
  }

  // Fall 2:
  // Vorher nichts aktiv, jetzt aktiv -> Modal öffnen
  if (previousActiveChallengeId === null && currentActiveChallengeId !== null) {
    const activeChallenge = getChallengeByBoardId(currentActiveChallengeId);
    if (activeChallenge) {
      if (modalOpen) {
        closeModal();
      }
      openChallengeModal(activeChallenge);
    }
    return;
  }

  // Fall 3:
  // Andere aktive Aufgabe als vorher -> Modal auf richtige Aufgabe umstellen
  if (
    previousActiveChallengeId !== null &&
    currentActiveChallengeId !== null &&
    previousActiveChallengeId !== currentActiveChallengeId
  ) {
    const activeChallenge = getChallengeByBoardId(currentActiveChallengeId);
    if (activeChallenge) {
      if (modalOpen) {
        closeModal();
      }
      openChallengeModal(activeChallenge);
    }
    return;
  }

  // Fall 4:
  // Es gibt eine aktive Aufgabe, aber Modal ist nicht offen -> öffnen
  if (currentActiveChallengeId !== null && !modalOpen) {
    const activeChallenge = getChallengeByBoardId(currentActiveChallengeId);
    if (activeChallenge) {
      openChallengeModal(activeChallenge);
    }
    return;
  }

  // Fall 5:
  // Modal ist offen, aber zeigt nicht die aktive Aufgabe -> korrigieren
  if (
    currentActiveChallengeId !== null &&
    modalOpen &&
    openModalBoardId !== currentActiveChallengeId
  ) {
    const activeChallenge = getChallengeByBoardId(currentActiveChallengeId);
    if (activeChallenge) {
      closeModal();
      openChallengeModal(activeChallenge);
    }
  }
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
  if (challenge.isActive === false) return;

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
    points_awarded: null,
    success_variant_label: null,
    success_variant_points: null
  });

  if (!updatedPlayerChallenge) {
    await updatePlayerGameState(playerId, {
      active_challenge_id: null
    });

    alert("Challenge-Status konnte nicht gespeichert werden.");
    return;
  }

  gameState.activeChallengeId = boardId;

    await logChallengeStarted({
    gameId: currentGameId,
    playerId: playerId,
    challengeId: challenge.dbId,
    metadata: {
      challenge_title: challenge.title || null,
      position: challenge.boardId,
      points: challenge.points || null
    }
  });

  await loadGlobalChallengeStats();
  openChallengeModal(challenge);
  renderGrid();
}

// =======================
// SPIELLOGIK
// =======================

async function completeChallenge(boardId, proofImagePath = null, successVariant = null) {
  if (!currentPlayer) return;

  const challenge = getChallengeByBoardId(boardId);
  if (!challenge) return;

  const variableChallenge = isVariablePointsChallenge(challenge);

  if (variableChallenge && !successVariant) {
    alert("Bitte zuerst eine Erfolgsstufe auswählen.");
    return;
  }

  const basePoints = successVariant?.points ?? challenge.points;

  if (!Number.isFinite(Number(basePoints))) {
    alert("Für diese Aufgabe sind keine Punkte definiert.");
    return;
  }

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
  const awardedPoints = isFirstSolver ? Number(basePoints) * 2 : Number(basePoints);

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

  const bingoBonus = currentGame?.bingo_bonus_points ?? 5;
  const firstBingoBonus = getFirstBingoBonusPoints();

  const { count: existingGameBingoCount, error: existingGameBingoError } = await supabaseClient
    .from("player_bingos")
    .select("id", { count: "exact", head: true })
    .eq("game_id", currentGameId);

  if (existingGameBingoError) {
    console.warn("Fehler beim Prüfen des ersten Bingos im Spiel:", existingGameBingoError);
  }

  const isFirstBingoInGameBeforeThisMove = (existingGameBingoCount || 0) === 0;

  const newBingoAwards = [];

  for (const lineIndex of newBingoIndexes) {
    const lineKey = String(lineIndex);
    const alreadyClaimedByAnyone = await hasAnyPlayerClaimedBingoLine(lineKey);

    const isFirstForLine = !alreadyClaimedByAnyone;
    const awardedBingoPoints = isFirstForLine
      ? bingoBonus + firstBingoBonus
      : bingoBonus;

    nextScore += awardedBingoPoints;

    newBingoAwards.push({
      lineIndex,
      lineKey,
      isFirstForLine,
      awardedBingoPoints
    });
  }

  await loadGlobalBingoLineStats();

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
  proof_image_path: proofImagePath,
  success_variant_label: successVariant?.label || null,
  success_variant_points: successVariant?.points || null
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

    if (proofImagePath) {
    await logPhotoUploaded({
      gameId: currentGameId,
      playerId: playerId,
      challengeId: challenge.dbId,
      metadata: {
        challenge_title: challenge.title || null,
        position: challenge.boardId,
        proof_image_path: proofImagePath,
        success_variant_label: successVariant?.label || null,
        success_variant_points: successVariant?.points || null
      }
    });
  }

  try {
  await logChallengeCompleted({
    gameId: currentGameId,
    playerId: playerId,
    challengeId: challenge.dbId,
    pointsDelta: awardedPoints,
    metadata: {
      challenge_title: challenge.title || null,
      position: challenge.boardId,
      was_first_solver: isFirstSolver,
      proof_image_path: proofImagePath || null,
      success_variant_label: successVariant?.label || null,
      success_variant_points: successVariant?.points || null,
      base_points: Number(basePoints)
    }
  });

 

  for (const award of newBingoAwards) {
  await logBingoAwarded({
    gameId: currentGameId,
    playerId: playerId,
    pointsDelta: award.awardedBingoPoints,
    metadata: {
      line_index: award.lineIndex,
      line_key: award.lineKey,
      is_first_for_line: award.isFirstForLine,
      normal_bingo_bonus: bingoBonus,
      first_bingo_bonus: award.isFirstForLine ? firstBingoBonus : 0,
      challenge_title: challenge.title || null,
      trigger_position: challenge.boardId
    }
  });
}
} catch (error) {
  console.error("Fehler beim Schreiben der Activity-Logs:", error);
}


  for (const award of newBingoAwards) {
  await insertPlayerBingo(
    playerId,
    award.lineKey,
    award.awardedBingoPoints
  );
}

if (
  isFirstBingoInGameBeforeThisMove &&
  newBingoAwards.length > 0 &&
  typeof pushAutomationSendFirstGameBingo === "function"
) {
  await pushAutomationSendFirstGameBingo({
    gameId: currentGameId,
    playerId,
    lineKey: newBingoAwards[0]?.lineKey || null
  });
}

  await loadGlobalChallengeStats();
await renderLeaderboard();

freezeScoreDisplay = true;

closeModal();
renderGrid(false);

  if (isFirstSolver) {
    await showFirstSolverAnimation();
  }

  if (newBingoAwards.length > 0) {
  const totalBingoPoints = newBingoAwards.reduce(
    (sum, award) => sum + award.awardedBingoPoints,
    0
  );

  const hasFirstBingo = newBingoAwards.some(
    award => award.isFirstForLine
  );

  await showBingoAnimation(totalBingoPoints, hasFirstBingo);
}

 await showPointsPopup(boardId, awardedPoints);

freezeScoreDisplay = false;
await animateScoreDisplay(nextScore);

    const hasCompletedEverything = nextCompleted.length === challenges.length;

  if (hasCompletedEverything && !hasSeenFinal()) {
    setTimeout(() => {
      openFinalOverlay(nextScore);
    }, 250);
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
      points_awarded: null,
      success_variant_label: null,
      success_variant_points: null
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

    if (activeChallenge) {
    await logChallengeFailed({
      gameId: currentGameId,
      playerId: playerId,
      challengeId: activeChallenge.dbId,
      metadata: {
        challenge_title: activeChallenge.title || null,
        position: activeChallenge.boardId,
        cooldown_seconds: cooldownSeconds
      }
    });
  }

  await loadGlobalChallengeStats();
  await renderLeaderboard();

  closeModal();
updateCooldownDisplay();
startCooldownLoop();
renderGrid();
await renderLeaderboard();
}

// =======================
// COOLDOWN
// =======================

function startCooldownLoop() {
  if (cooldownInterval) {
    clearInterval(cooldownInterval);
  }

  cooldownInterval = setInterval(async () => {
    if (!isCooldownActive()) {
      clearInterval(cooldownInterval);
      cooldownInterval = null;

      if (currentPlayer) {
        await updatePlayerGameState(currentPlayer.id, {
          cooldown_until: null
        });
      }

      gameState.cooldownUntil = null;
      updateCooldownDisplay();
      renderGrid();
      await renderLeaderboard();
      return;
    }

    updateCooldownDisplay();
    await renderLeaderboard();
    renderGrid();
  }, 1000);
}

// =======================
// Aufgabe zurücksetzen
// =======================

async function resetCompletedChallenge(boardId) {
  if (!currentPlayer) return;

  const challenge = getChallengeByBoardId(boardId);
  if (!challenge) return;


  const playerId = currentPlayer.id;

  const isCompleted = gameState.completed.includes(boardId);
  if (!isCompleted) return;

  const confirmed = confirm(
    `Möchtest du "${challenge.title}" wirklich zurücksetzen?`
  );

  if (!confirmed) return;

  // 1) Challenge zurücksetzen
  const resetRow = await upsertPlayerChallenge(playerId, challenge.dbId, {
    status: "hidden",
    completed_at: null,
    was_first_solver: false,
    points_awarded: null,
    proof_image_path: null,
    success_variant_label: null,
    success_variant_points: null
  });

  if (!resetRow) {
    alert("Challenge konnte nicht zurückgesetzt werden.");
    return;
  }

    await logChallengeReset({
    gameId: currentGameId,
    playerId: playerId,
    challengeId: challenge.dbId,
    metadata: {
      challenge_title: challenge.title || null,
      position: challenge.boardId,
      action: "player_reset_completed_challenge"
    }
  });

  // 2) Verbleibende Challenges neu laden
  const dbPlayerChallenges = await loadPlayerChallenges(playerId);
  if (!dbPlayerChallenges) {
    alert("Spielstand konnte nicht neu geladen werden.");
    return;
  }

  const remainingCompletedRows = dbPlayerChallenges.filter(
    row => row.status === "completed"
  );

  const completedBoardIds = remainingCompletedRows
    .map(row => {
      const c = getChallengeByDbId(row.challenge_id);
      return c ? c.boardId : null;
    })
    .filter(Boolean);

  const firstSolvedBoardIds = remainingCompletedRows
    .filter(row => row.was_first_solver === true)
    .map(row => {
      const c = getChallengeByDbId(row.challenge_id);
      return c ? c.boardId : null;
    })
    .filter(Boolean);

  // 3) Basisscore aus remaining completed rows
  let rebuiltScore = remainingCompletedRows.reduce((sum, row) => {
    return sum + (row.points_awarded || 0);
  }, 0);

  // 4) Bingos komplett neu berechnen
  const bingoResult = calculateBingoResult(
    completedBoardIds,
    [],
    rebuiltScore
  );

  rebuiltScore = bingoResult.score;

  // 5) Alte Bingos löschen
  const deletedBingos = await deleteAllPlayerBingos(playerId);
  if (!deletedBingos) {
    alert("Bingos konnten nicht neu aufgebaut werden.");
    return;
  }

  // 6) Neue Bingos speichern
  const bingoBonus = currentGame?.bingo_bonus_points ?? 5;

  for (const lineIndex of bingoResult.bingos) {
    await insertPlayerBingo(playerId, String(lineIndex), bingoBonus);
  }

  // 7) Score im player_game_state aktualisieren
  const updatedGameState = await updatePlayerGameState(playerId, {
    score: rebuiltScore,
    active_challenge_id: null,
    cooldown_until: null
  });

  if (!updatedGameState) {
    alert("Spielstand konnte nicht aktualisiert werden.");
    return;
  }

  // 8) Lokalen State aktualisieren
  gameState.completed = completedBoardIds;
  gameState.firstSolved = firstSolvedBoardIds;
  gameState.score = rebuiltScore;
  gameState.activeChallengeId = null;
  gameState.cooldownUntil = null;
  gameState.bingos = bingoResult.bingos;
  gameState.bingoCells = bingoResult.bingoCells;

  await loadGlobalChallengeStats();
  await renderLeaderboard();

  closeModal();
  renderGrid();
}