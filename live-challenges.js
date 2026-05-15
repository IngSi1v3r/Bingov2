/**
 * ============================================================
 * live-challenges.js
 * ============================================================
 *
 * Zweck:
 * Verwaltung aller Live-/Spontanchallenges im normalen Spielermodus.
 *
 * Diese Datei kuemmert sich um:
 * - Live-Challenge-Anzeige fuer Spieler
 * - Start-, End- und Expired-Modals
 * - Abschlusslogik inklusive Punktevergabe
 * - Sichtbarkeits-Tracking
 * - automatische Ablaufpruefung
 * - Profil-/Statistikdaten fuer Live-Challenges
 *
 * Reine Ladefunktionen laufen jetzt weitgehend ueber DataService.
 * Schreibfunktionen bleiben bewusst hier.
 */

/* ============================================================
 * DOM
 * ============================================================ */

const liveChallengeOverlay = document.getElementById("liveChallengeOverlay");
const liveChallengeTitle = document.getElementById("liveChallengeTitle");
const liveChallengeContent = document.getElementById("liveChallengeContent");
const liveChallengeActions = document.getElementById("liveChallengeActions");

/* ============================================================
 * STATE
 * ============================================================ */

let currentLiveChallenge = null;
let currentLiveChallengeModalOpen = false;
let liveChallengeCountdownInterval = null;

/* ============================================================
 * STATE HELPERS
 * ============================================================ */

function resetLiveChallengeState() {
  currentLiveChallenge = null;
  currentLiveChallengeModalOpen = false;
}

/* ============================================================
 * LOAD WRAPPER - LIVE CHALLENGES
 * ============================================================ */

async function loadActiveLiveChallenge() {
  return await DataService.live.loadActiveForGame(currentGameId);
}

async function loadLatestLiveChallenge() {
  return await DataService.live.loadLatestForGame(currentGameId);
}

async function loadAllLiveChallengesForCurrentGame() {
  return await DataService.live.loadForGame(currentGameId);
}

async function loadLiveChallengeWinner(liveChallengeId) {
  return await DataService.live.loadWinner(liveChallengeId);
}

/* ============================================================
 * LOAD WRAPPER - VIEW STATES
 * ============================================================ */

async function loadLiveChallengeViewState(playerId, liveChallengeId) {
  return await DataService.liveViews.loadForPlayerAndLiveChallenge(
    playerId,
    liveChallengeId
  );
}

async function loadLiveChallengeViewStatesForPlayer(playerId) {
  return await DataService.liveViews.loadForPlayer(playerId);
}

/* ============================================================
 * MUTATIONS - LIVE COMPLETION
 * ============================================================ */

async function completeLiveChallengeForPlayer(liveChallengeId, proofImagePath = null) {
  if (!currentPlayer || !liveChallengeId) return null;

  const completedAt = new Date().toISOString();

  const { data, error } = await supabaseClient
    .from("player_live_challenges")
    .insert({
      live_challenge_id: liveChallengeId,
      player_id: currentPlayer.id,
      game_id: currentGameId,
      status: "completed",
      points_awarded: 0,
      proof_image_path: proofImagePath,
      completed_at: completedAt
    })
    .select()
    .single();

  if (error) {
    console.error("Fehler beim Speichern des Live-Challenge-Abschlusses:", error);
    return null;
  }

  return data;
}

async function markLiveChallengeWinner(liveChallengeId, playerId) {
  const completedAt = new Date().toISOString();

  const { data, error } = await supabaseClient
    .from("live_challenges")
    .update({
      winner_player_id: playerId,
      winner_completed_at: completedAt,
      completed_at: completedAt,
      status: "completed"
    })
    .eq("id", liveChallengeId)
    .is("winner_player_id", null)
    .select()
    .single();

  if (error) {
    console.error("Fehler beim Setzen des Gewinners der Spontanchallenge:", error);
    return null;
  }

  return data;
}

async function updatePlayerLiveChallengePoints(entryId, points) {
  const { data, error } = await supabaseClient
    .from("player_live_challenges")
    .update({ points_awarded: points })
    .eq("id", entryId)
    .select()
    .single();

  if (error) {
    console.error("Fehler beim Aktualisieren der Live-Challenge-Punkte:", error);
    return null;
  }

  return data;
}

/* ============================================================
 * MUTATIONS - VIEW STATES
 * ============================================================ */

async function ensureLiveChallengeViewState(playerId, liveChallengeId) {
  const existing = await loadLiveChallengeViewState(playerId, liveChallengeId);
  if (existing) return existing;

  const { data, error } = await supabaseClient
    .from("player_live_challenge_views")
    .insert({
      player_id: playerId,
      live_challenge_id: liveChallengeId
    })
    .select()
    .single();

  if (error) {
    console.error("Fehler beim Erstellen des Live-Challenge-View-Status:", error);
    return null;
  }

  return data;
}

async function markLiveChallengeStartSeen(playerId, liveChallengeId) {
  const existing = await ensureLiveChallengeViewState(playerId, liveChallengeId);
  if (!existing) return null;

  if (existing.seen_start_at) {
    return existing;
  }

  const { data, error } = await supabaseClient
    .from("player_live_challenge_views")
    .update({
      seen_start_at: new Date().toISOString()
    })
    .eq("player_id", playerId)
    .eq("live_challenge_id", liveChallengeId)
    .select()
    .single();

  if (error) {
    console.error("Fehler beim Markieren von seen_start_at:", error);
    return null;
  }

  return data;
}

async function markLiveChallengeDismissed(playerId, liveChallengeId) {
  const existing = await ensureLiveChallengeViewState(playerId, liveChallengeId);
  if (!existing) return null;

  const now = new Date().toISOString();

  const { data, error } = await supabaseClient
    .from("player_live_challenge_views")
    .update({
      seen_start_at: existing.seen_start_at || now,
      dismissed_at: now
    })
    .eq("player_id", playerId)
    .eq("live_challenge_id", liveChallengeId)
    .select()
    .single();

  if (error) {
    console.error("Fehler beim Markieren von dismissed_at:", error);
    return null;
  }

  return data;
}

async function markLiveChallengeEndSeen(playerId, liveChallengeId) {
  const existing = await ensureLiveChallengeViewState(playerId, liveChallengeId);
  if (!existing) return null;

  const { data, error } = await supabaseClient
    .from("player_live_challenge_views")
    .update({
      seen_end_at: new Date().toISOString()
    })
    .eq("player_id", playerId)
    .eq("live_challenge_id", liveChallengeId)
    .select()
    .single();

  if (error) {
    console.error("Fehler beim Markieren von seen_end_at:", error);
    return null;
  }

  return data;
}

/* ============================================================
 * COUNTDOWN
 * ============================================================ */

function stopLiveChallengeCountdown() {
  if (liveChallengeCountdownInterval) {
    clearInterval(liveChallengeCountdownInterval);
    liveChallengeCountdownInterval = null;
  }
}

function updateLiveChallengeCountdownDisplay() {
  if (!currentLiveChallenge || currentLiveChallenge.status !== "active") return;

  const countdownEl = document.getElementById("liveChallengeRemainingValue");
  if (!countdownEl) return;

  const remainingSeconds = getLiveChallengeRemainingSeconds(currentLiveChallenge);

  countdownEl.textContent =
    remainingSeconds !== null
      ? formatLiveChallengeRemainingTime(remainingSeconds)
      : "Unbegrenzt";

  if (remainingSeconds !== null && remainingSeconds <= 0) {
    stopLiveChallengeCountdown();
    closeLiveChallengeOverlay();
  }
}

function startLiveChallengeCountdown() {
  stopLiveChallengeCountdown();

  if (!currentLiveChallenge || currentLiveChallenge.status !== "active") return;
  if (!currentLiveChallenge.expires_at) return;

  updateLiveChallengeCountdownDisplay();

  liveChallengeCountdownInterval = setInterval(() => {
    updateLiveChallengeCountdownDisplay();
  }, 1000);
}

/* ============================================================
 * MODAL - OPEN / CLOSE
 * ============================================================ */

function openLiveChallengeOverlay() {
  if (!liveChallengeOverlay) return;

  lockBodyScroll();
  liveChallengeOverlay.classList.remove("hidden");
  currentLiveChallengeModalOpen = true;

  startLiveChallengeCountdown();
}

function closeLiveChallengeOverlay() {
  if (!liveChallengeOverlay) return;

  stopLiveChallengeCountdown();

  liveChallengeOverlay.classList.add("hidden");
  unlockBodyScroll();
  currentLiveChallengeModalOpen = false;
}

/* ============================================================
 * START MODAL
 * ============================================================ */

function renderLiveChallengeModal(challenge) {
  if (!challenge || !liveChallengeTitle || !liveChallengeContent || !liveChallengeActions) {
    return;
  }

  const requiresPhoto =
    challenge.requires_photo_proof === true ||
    challenge.requiresPhotoProof === true;

  const remainingSeconds = getLiveChallengeRemainingSeconds(challenge);

  const timeText =
    remainingSeconds !== null
      ? formatLiveChallengeRemainingTime(remainingSeconds)
      : "Unbegrenzt";

  liveChallengeTitle.innerHTML = `
    <span style="opacity: 0.7;">Spontanchallenge:</span>
    <strong>${challenge.title || "Ohne Titel"}</strong>
  `;

  liveChallengeContent.innerHTML = `
    <p style="font-weight: 600; margin-bottom: 12px;">
      ${challenge.description || ""}
    </p>

    <div class="live-challenge-hint-text">
      Das ist eine Spontanchallenge. Sei schnell - nur der erste Spieler bekommt die Punkte.
    </div>

    ${requiresPhoto ? `
      <div class="live-challenge-photo">
        Foto erforderlich
      </div>
    ` : ""}

    <div class="live-challenge-stats">
      <div class="live-stat-box">
        <div class="live-stat-label">Punkte</div>
        <div class="live-stat-value">${challenge.points ?? 5}</div>
      </div>

      <div class="live-stat-box">
        <div class="live-stat-label">Restzeit</div>
        <div id="liveChallengeRemainingValue" class="live-stat-value">${timeText}</div>
      </div>
    </div>
  `;

  liveChallengeActions.innerHTML = `
    <button id="dismissLiveChallengeBtn" type="button" class="secondary-btn">
      Nicht interessiert
    </button>

    <button id="completeLiveChallengeBtn" type="button">
      ${requiresPhoto ? "Bestanden (Foto hochladen)" : "Bestanden"}
    </button>
  `;

  const dismissBtn = document.getElementById("dismissLiveChallengeBtn");
  const completeBtn = document.getElementById("completeLiveChallengeBtn");

  if (dismissBtn) {
    dismissBtn.onclick = async () => {
      if (currentPlayer && challenge.id) {
        await markLiveChallengeDismissed(currentPlayer.id, challenge.id);
      }

      closeLiveChallengeOverlay();
    };
  }

  if (completeBtn) {
    completeBtn.onclick = async () => {
      if (requiresPhoto) {
        if (currentPlayer && challenge.id) {
          await markLiveChallengeStartSeen(currentPlayer.id, challenge.id);
        }

        closeLiveChallengeOverlay();
        openUploadModal(challenge, "live");
        return;
      }

      await handleCompleteLiveChallenge(challenge);
    };
  }
}

/* ============================================================
 * END / RESULT MODALS
 * ============================================================ */

async function renderCompletedLiveChallengeModal(challenge) {
  if (!challenge) return;

  const winner = await loadLiveChallengeWinner(challenge.id);

  const imageUrl = winner?.imagePath
    ? DataService.storage.getProofPhotoPublicUrl(winner.imagePath)
    : null;

  liveChallengeTitle.innerHTML = `
    <span style="opacity: 0.7;">Spontanchallenge</span>
    <strong>${challenge.title || "Ohne Titel"}</strong>
    <span style="opacity: 0.7;">beendet</span>
  `;

  liveChallengeContent.innerHTML = `
    <p style="font-weight: 600; margin-bottom: 12px;">
      ${challenge.description || ""}
    </p>

    <div class="live-challenge-result ${winner ? "success" : "neutral"}">
      ${
        winner
          ? `<strong>${winner.name}</strong> war am schnellsten und hat <strong>${challenge.points ?? 5} Punkte</strong> bekommen.`
          : `Niemand war schnell genug. Es wurden keine Punkte vergeben.`
      }
    </div>

    ${imageUrl ? `<img src="${imageUrl}" class="live-challenge-winner-image" />` : ""}
  `;

  liveChallengeActions.innerHTML = `
    <button id="closeLiveChallengeEndBtn" type="button">Schließen</button>
  `;

  const closeBtn = document.getElementById("closeLiveChallengeEndBtn");

  if (closeBtn) {
    closeBtn.onclick = async () => {
      if (currentPlayer && challenge.id) {
        await markLiveChallengeEndSeen(currentPlayer.id, challenge.id);
      }

      closeLiveChallengeOverlay();
    };
  }
}

function renderExpiredLiveChallengeModal(challenge) {
  if (!challenge) return;

  liveChallengeTitle.textContent = "Spontanchallenge beendet";

  liveChallengeContent.innerHTML = `
    <p style="font-weight: 600; margin-bottom: 12px;">
      ${challenge.description || ""}
    </p>

    <div class="live-challenge-result neutral">
      Niemand hat die Aufgabe geschafft. Es wurden keine Punkte vergeben.
    </div>
  `;

  liveChallengeActions.innerHTML = `
    <button id="closeLiveChallengeEndBtn" type="button">Schließen</button>
  `;

  const closeBtn = document.getElementById("closeLiveChallengeEndBtn");

  if (closeBtn) {
    closeBtn.onclick = async () => {
      if (currentPlayer && challenge.id) {
        await markLiveChallengeEndSeen(currentPlayer.id, challenge.id);
      }

      closeLiveChallengeOverlay();
    };
  }
}

/* ============================================================
 * LIVE CHALLENGE CHECK / DISPLAY FLOW
 * ============================================================ */

async function checkLiveChallengeStatus() {
  if (uploadOverlay && !uploadOverlay.classList.contains("hidden")) {
    return;
  }

  const next = await getNextLiveChallengeToDisplay();

  if (!next) {
    if (
      currentLiveChallengeModalOpen &&
      currentLiveChallenge &&
      currentLiveChallenge.status === "active"
    ) {
      closeLiveChallengeOverlay();
      currentLiveChallenge = null;
    }

    return;
  }

  const { type, challenge } = next;

  const sameChallengeAlreadyOpen =
    currentLiveChallengeModalOpen &&
    currentLiveChallenge &&
    Number(currentLiveChallenge.id) === Number(challenge.id);

  if (type === "end") {
    currentLiveChallenge = challenge;

    if (challenge.status === "completed") {
      await renderCompletedLiveChallengeModal(challenge);
    } else {
      renderExpiredLiveChallengeModal(challenge);
    }

    if (!currentLiveChallengeModalOpen) {
      openLiveChallengeOverlay();
    }

    return;
  }

  if (type === "start") {
    currentLiveChallenge = challenge;

    renderLiveChallengeModal(challenge);

    if (!sameChallengeAlreadyOpen) {
      openLiveChallengeOverlay();
    }

    if (currentPlayer && challenge.id) {
      await markLiveChallengeStartSeen(currentPlayer.id, challenge.id);
    }
  }
}

async function getNextLiveChallengeToDisplay() {
  if (!currentPlayer) return null;

  const playerId = currentPlayer.id;

  const [liveChallenges, views] = await Promise.all([
    loadAllLiveChallengesForCurrentGame(),
    loadLiveChallengeViewStatesForPlayer(playerId)
  ]);

  const viewMap = {};

  for (const view of views) {
    viewMap[view.live_challenge_id] = view;
  }

  for (const challenge of liveChallenges) {
    if (challenge.status === "completed" || challenge.status === "expired") {
      const view = viewMap[challenge.id];

      if (!view?.seen_end_at) {
        return {
          type: "end",
          challenge
        };
      }
    }
  }

  for (const challenge of liveChallenges) {
    if (challenge.status !== "active") continue;

    const view = viewMap[challenge.id];
    const wasDismissed = !!view?.dismissed_at;

    if (!wasDismissed) {
      return {
        type: "start",
        challenge
      };
    }
  }

  return null;
}

/* ============================================================
 * ABSCHLUSSLOGIK
 * ============================================================ */

async function handleCompleteLiveChallenge(challenge, proofImagePath = null) {
  if (!challenge || !currentPlayer) return;

  const attempt = await completeLiveChallengeForPlayer(challenge.id, proofImagePath);

  if (!attempt) {
    alert("Konnte nicht gespeichert werden.");
    return;
  }

  const winnerUpdate = await markLiveChallengeWinner(
    challenge.id,
    currentPlayer.id
  );

  if (winnerUpdate) {
    const points = challenge.points ?? 5;

    await updatePlayerLiveChallengePoints(attempt.id, points);

    const newScore = (gameState.score || 0) + points;

    const updatedGameState = await updatePlayerGameState(currentPlayer.id, {
      score: newScore
    });

    if (proofImagePath) {
      await logPhotoUploaded({
        gameId: currentGameId,
        playerId: currentPlayer.id,
        liveChallengeId: challenge.id,
        metadata: {
          live_challenge_title: challenge.title || null,
          proof_image_path: proofImagePath,
          game_name: currentGame?.name || null,
          player_name: currentPlayer.display_name || currentPlayer.username || null
        }
      });
    }

    await logLiveChallengeCompleted({
      gameId: currentGameId,
      playerId: currentPlayer.id,
      liveChallengeId: challenge.id,
      pointsDelta: points,
      metadata: {
        live_challenge_title: challenge.title || null,
        description: challenge.description || null,
        proof_image_path: proofImagePath || null,
        player_name: currentPlayer.display_name || currentPlayer.username || null,
        game_name: currentGame?.name || null
      }
    });

    if (updatedGameState) {
      gameState.score = newScore;

      freezeScoreDisplay = true;
      await animateScoreDisplay(newScore);
      freezeScoreDisplay = false;

      await renderLeaderboard();
    }
  }

  currentLiveChallenge = {
    ...challenge,
    status: "completed"
  };

  await renderCompletedLiveChallengeModal(challenge);
}

/* ============================================================
 * ZEIT / ABLAUF
 * ============================================================ */

function getLiveChallengeRemainingSeconds(challenge) {
  if (!challenge?.expires_at) return null;

  const expiresAtMs = new Date(challenge.expires_at).getTime();
  const remainingMs = expiresAtMs - Date.now();

  return Math.max(0, Math.ceil(remainingMs / 1000));
}

function formatLiveChallengeRemainingTime(totalSeconds) {
  if (totalSeconds === null) return "Unbegrenzt";

  const seconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
}

async function expireLiveChallenge(liveChallengeId) {
  if (!liveChallengeId) return null;

  const completedAt = new Date().toISOString();

  const { data, error } = await supabaseClient
    .from("live_challenges")
    .update({
      status: "expired",
      completed_at: completedAt
    })
    .eq("id", liveChallengeId)
    .eq("status", "active")
    .select()
    .single();

  if (error) {
    console.error("Fehler beim Beenden der Spontanchallenge ohne Gewinner:", error);
    return null;
  }

  const effectiveGameName =
  (typeof currentGame !== "undefined" && currentGame?.name)
    ? currentGame.name
    : ((typeof adminCurrentGame !== "undefined" && adminCurrentGame?.name)
        ? adminCurrentGame.name
        : null);

  await logLiveChallengeExpired({
    gameId: data?.game_id || currentGameId || adminCurrentGameId || null,
    liveChallengeId,
    metadata: {
      live_challenge_title: data?.title || null,
      game_name: effectiveGameName
    }
  });

  return data;
}

async function expireOverdueLiveChallenges() {
  const activeChallenge = await loadActiveLiveChallenge();
  if (!activeChallenge) return false;

  if (!activeChallenge.expires_at) return false;

  const expiresAtMs = new Date(activeChallenge.expires_at).getTime();
  if (Date.now() < expiresAtMs) return false;

  const expired = await expireLiveChallenge(activeChallenge.id);
  return !!expired;
}

/* ============================================================
 * PROFIL / SPIELERSTATS
 * ============================================================ */

async function loadCompletedLiveChallengesForPlayer(playerId) {
  return await DataService.live.loadCompletedForPlayer(
    playerId,
    currentGameId
  );
}

async function loadLiveChallengeStatsForPlayer(playerId) {
  return await DataService.stats.loadLiveStatsForPlayer(
    playerId,
    currentGameId
  );
}

/* ============================================================
 * INITIALISIERUNG FUER NEUE SPIELER
 * ============================================================ */

async function initializeLiveChallengeViewsForNewPlayerInGame(playerId) {
  const liveChallenges = await DataService.live.loadForGame(currentGameId);

  const rows = liveChallenges || [];

  if (!rows.length) {
    return true;
  }

  const now = new Date().toISOString();

  const activeChallenges = rows.filter(row => row.status === "active");

  const latestActiveChallengeId = activeChallenges.length
    ? activeChallenges[activeChallenges.length - 1].id
    : null;

  const payload = rows.map(row => {
    const entry = {
      player_id: playerId,
      live_challenge_id: row.id,
      seen_start_at: null,
      seen_end_at: null,
      dismissed_at: null
    };

    if (row.status === "completed" || row.status === "expired") {
      entry.seen_start_at = now;
      entry.seen_end_at = now;
    } else if (row.status === "active") {
      if (row.id !== latestActiveChallengeId) {
        entry.seen_start_at = now;
      }
    }

    return entry;
  });

  const { error } = await supabaseClient
    .from("player_live_challenge_views")
    .upsert(payload, {
      onConflict: "player_id,live_challenge_id"
    });

  if (error) {
    console.error("Fehler beim Upsert der initialen Live-Challenge-Views:", error);
    return false;
  }

  return true;
}