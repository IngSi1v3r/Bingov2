/**
 * ============================================================
 * live-challenges.js
 * ============================================================
 *
 * Zweck:
 * Verwaltung aller Live-/Spontanchallenges im normalen Spielermodus.
 *
 * Diese Datei kümmert sich um:
 * 1) Laden und Prüfen des aktuellen Live-Challenge-Status
 * 2) Anzeigen der Start-, End- und Expired-Modals
 * 3) Abschlusslogik für Spieler inklusive Punktevergabe
 * 4) Tracking der Sichtbarkeit:
 *    - seen_start_at
 *    - dismissed_at
 *    - seen_end_at
 * 5) Auswertung für Profil / Statistiken
 * 6) Ablauf von zeitlich begrenzten Live-Challenges
 *
 * Nicht mehr enthalten:
 * - manuelles Erstellen von Live-Challenges im Spielermodus
 * - manuelles Beenden von Live-Challenges im Spielermodus
 * Diese Logik liegt jetzt im Adminpanel.
 */

/* ============================================================
 * DOM
 * ============================================================
 */

const liveChallengeOverlay = document.getElementById("liveChallengeOverlay");
const liveChallengeTitle = document.getElementById("liveChallengeTitle");
const liveChallengeContent = document.getElementById("liveChallengeContent");
const liveChallengeActions = document.getElementById("liveChallengeActions");

/* ============================================================
 * STATE
 * ============================================================
 */

let currentLiveChallenge = null;
let currentLiveChallengeModalOpen = false;

let liveChallengeCountdownInterval = null;

/* ============================================================
 * STATE HELPERS
 * ============================================================
 */

/**
 * Setzt den lokalen UI-State für Live-Challenges zurück.
 * Wird z. B. nach Game-Wechsel oder Logout nützlich.
 */
function resetLiveChallengeState() {
  currentLiveChallenge = null;
  currentLiveChallengeModalOpen = false;
}

/* ============================================================
 * DB LOAD - LIVE CHALLENGES
 * ============================================================
 */

/**
 * Lädt die aktuell aktive Live-Challenge des aktuellen Spiels.
 * Es kann maximal eine aktive geben.
 */
async function loadActiveLiveChallenge() {
  const { data, error } = await supabaseClient
    .from("live_challenges")
    .select("*")
    .eq("game_id", currentGameId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Fehler beim Laden der aktiven Spontanchallenge:", error);
    return null;
  }

  return data || null;
}

/**
 * Lädt die zuletzt erstellte Live-Challenge des aktuellen Spiels,
 * inklusive Gewinner-Player-Relation.
 */
async function loadLatestLiveChallenge() {
  const { data, error } = await supabaseClient
    .from("live_challenges")
    .select(`
      *,
      players:winner_player_id (
        username,
        display_name
      )
    `)
    .eq("game_id", currentGameId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Fehler beim Laden der letzten Spontanchallenge:", error);
    return null;
  }

  return data || null;
}

/**
 * Speichert einen Abschlussversuch eines Spielers für eine Live-Challenge.
 * Die Punkte werden zunächst mit 0 gespeichert und erst bei Gewinnerlogik gesetzt.
 */
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

/**
 * Versucht, den Gewinner einer Live-Challenge zu setzen.
 * Nur der erste erfolgreiche Update bekommt die Challenge wirklich.
 */
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

/**
 * Aktualisiert die endgültig vergebenen Punkte
 * im player_live_challenges-Eintrag des Spielers.
 */
async function updatePlayerLiveChallengePoints(entryId, points) {
  const { data, error } = await supabaseClient
    .from("player_live_challenges")
    .update({
      points_awarded: points
    })
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
 * DB LOAD - VIEW STATE
 * ============================================================
 */

/**
 * Lädt den View-State eines Spielers für genau eine Live-Challenge.
 */
async function loadLiveChallengeViewState(playerId, liveChallengeId) {
  const { data, error } = await supabaseClient
    .from("player_live_challenge_views")
    .select("*")
    .eq("player_id", playerId)
    .eq("live_challenge_id", liveChallengeId)
    .maybeSingle();

  if (error) {
    console.error("Fehler beim Laden des Live-Challenge-View-Status:", error);
    return null;
  }

  return data || null;
}

/**
 * Stellt sicher, dass ein View-State-Datensatz für den Spieler existiert.
 */
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

/**
 * Setzt seen_start_at genau dann, wenn der Spieler das Start-Modal
 * zum ersten Mal wirklich angezeigt bekommt.
 *
 * Wichtig:
 * Der erste Zeitpunkt wird bewusst nicht überschrieben.
 */
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

/**
 * Markiert, dass der Spieler die Live-Challenge bewusst weggeklickt hat.
 * seen_start_at wird dabei ebenfalls abgesichert, falls es noch fehlte.
 */
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

/**
 * Markiert, dass der Spieler das End-/Resultat-Modal gesehen hat.
 */
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

/**
 * Lädt alle Live-Challenges des aktuellen Spiels.
 */
async function loadAllLiveChallengesForCurrentGame() {
  const { data, error } = await supabaseClient
    .from("live_challenges")
    .select(`
      *,
      players:winner_player_id (
        username,
        display_name
      )
    `)
    .eq("game_id", currentGameId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden aller Live-Challenges:", error);
    return [];
  }

  return data || [];
}

/**
 * Lädt alle View-State-Einträge des aktuellen Spielers.
 */
async function loadLiveChallengeViewStatesForPlayer(playerId) {
  const { data, error } = await supabaseClient
    .from("player_live_challenge_views")
    .select("*")
    .eq("player_id", playerId);

  if (error) {
    console.error("Fehler beim Laden aller Live-Challenge-View-States:", error);
    return [];
  }

  return data || [];
}


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

  // Falls Zeit abgelaufen ist, Overlay schließen und beim nächsten Poll
  // kommt dann das Expired-Modal
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
 * ============================================================
 */

/**
 * Öffnet das zentrale Live-Challenge-Overlay.
 */
function openLiveChallengeOverlay() {
  if (!liveChallengeOverlay) return;

  lockBodyScroll();
  liveChallengeOverlay.classList.remove("hidden");
  currentLiveChallengeModalOpen = true;

  startLiveChallengeCountdown();
}

/**
 * Schließt das zentrale Live-Challenge-Overlay.
 */
function closeLiveChallengeOverlay() {
  if (!liveChallengeOverlay) return;

  stopLiveChallengeCountdown();

  liveChallengeOverlay.classList.add("hidden");
  unlockBodyScroll();
  currentLiveChallengeModalOpen = false;
}

/* ============================================================
 * START MODAL
 * ============================================================
 */

/**
 * Rendert das Start-Modal für eine aktive Live-Challenge.
 */
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
      Das ist eine Spontanchallenge. Sei schnell – nur der erste Spieler bekommt die Punkte.
    </div>

    ${requiresPhoto ? `
      <div class="live-challenge-photo">
        📷 Foto erforderlich
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
      ${requiresPhoto ? "Bestanden (foto hochladen)" : "Bestanden"}
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
 * ============================================================
 */

/**
 * Rendert das End-Modal einer erfolgreich beendeten Live-Challenge.
 */
async function renderCompletedLiveChallengeModal(challenge) {
  if (!challenge) return;

  const winner = await loadLiveChallengeWinner(challenge.id);

  const imageUrl = winner?.imagePath
    ? supabaseClient.storage
        .from("proof-photos")
        .getPublicUrl(winner.imagePath).data.publicUrl
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

/**
 * Rendert das End-Modal einer abgelaufenen Live-Challenge ohne Gewinner.
 */
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
 * ============================================================
 */

/**
 * Zentrale Prüf-Funktion:
 * Entscheidet, ob dem Spieler gerade
 * - ein Start-Modal
 * - oder ein End-Modal
 * angezeigt werden soll.
 */
async function checkLiveChallengeStatus() {
  if (uploadOverlay && !uploadOverlay.classList.contains("hidden")) {
    return;
  }

  const next = await getNextLiveChallengeToDisplay();

  // Wenn nichts mehr anzuzeigen ist, aber noch ein aktives Modal offen ist,
  // dann schließen (z. B. Admin hat auf inactive gesetzt)
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

/**
 * Ermittelt die nächste relevante Live-Challenge-Anzeige
 * für den aktuellen Spieler.
 *
 * Priorität:
 * 1. Endmeldungen
 * 2. neue aktive Challenge
 */
async function getNextLiveChallengeToDisplay() {
  if (!currentPlayer) return null;

  const playerId = currentPlayer.id;

  const [challenges, views] = await Promise.all([
    loadAllLiveChallengesForCurrentGame(),
    loadLiveChallengeViewStatesForPlayer(playerId)
  ]);

  const viewMap = {};
  for (const v of views) {
    viewMap[v.live_challenge_id] = v;
  }

  // 1) Zuerst noch nicht gesehene Endmeldungen
  for (const challenge of challenges) {
    if (challenge.status === "completed" || challenge.status === "expired") {
      const view = viewMap[challenge.id];
      const hasSeenEnd = view?.seen_end_at;

      if (!hasSeenEnd) {
        return {
          type: "end",
          challenge
        };
      }
    }
  }

  // 2) Danach neue aktive Challenge
  for (const challenge of challenges) {
  if (challenge.status === "active") {
    const view = viewMap[challenge.id];
    const wasDismissed = !!view?.dismissed_at;

    if (!wasDismissed) {
      return {
        type: "start",
        challenge
      };
    }
  }
}

  return null;
}

/* ============================================================
 * ABSCHLUSSLOGIK
 * ============================================================
 */

/**
 * Verarbeitet den Abschluss einer Live-Challenge durch den Spieler.
 * Nur der erste Gewinner erhält Punkte.
 */
async function handleCompleteLiveChallenge(challenge, proofImagePath = null) {
  if (!challenge || !currentPlayer) return;

  const attempt = await completeLiveChallengeForPlayer(challenge.id, proofImagePath);
  if (!attempt) {
    alert("Konnte nicht gespeichert werden.");
    return;
  }

  const winnerUpdate = await markLiveChallengeWinner(challenge.id, currentPlayer.id);

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
 * ============================================================
 */

/**
 * Liefert die verbleibenden Sekunden bis zum Ablauf.
 * Null => abgelaufen, null/nullish => unbegrenzt.
 */
function getLiveChallengeRemainingSeconds(challenge) {
  if (!challenge?.expires_at) return null;

  const expiresAtMs = new Date(challenge.expires_at).getTime();
  const remainingMs = expiresAtMs - Date.now();

  return Math.max(0, Math.ceil(remainingMs / 1000));
}

/**
 * Formatiert Sekunden als MM:SS.
 */
function formatLiveChallengeRemainingTime(totalSeconds) {
  if (totalSeconds === null) return "Unbegrenzt";

  const seconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
}

/**
 * Beendet eine aktive Live-Challenge ohne Gewinner als expired.
 * Diese Funktion wird weiterhin gebraucht, z. B. für automatische Abläufe.
 */
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
      : ((typeof adminCurrentGame !== "undefined" && adminCurrentGame?.name) ? adminCurrentGame.name : null);

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

/**
 * Prüft, ob die aktive Live-Challenge bereits abgelaufen ist,
 * und setzt sie in diesem Fall auf expired.
 */
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
 * ============================================================
 */

/**
 * Lädt alle abgeschlossenen Live-Challenges eines Spielers
 * für die Profilansicht.
 */
async function loadCompletedLiveChallengesForPlayer(playerId) {
  const { data, error } = await supabaseClient
    .from("player_live_challenges")
    .select(`
      id,
      live_challenge_id,
      completed_at,
      points_awarded,
      proof_image_path,
      live_challenges (
        title
      )
    `)
    .eq("player_id", playerId)
    .eq("game_id", currentGameId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });

  if (error) {
    console.error("Fehler beim Laden der Live-Challenges:", error);
    return [];
  }

  return (data || []).map(row => ({
    type: "live",
    challengeId: row.live_challenge_id,
    title: row.live_challenges?.title || "Spontanchallenge",
    completedAt: row.completed_at,
    points: row.points_awarded || 0,
    proofImagePath: row.proof_image_path || null
  }));
}

/**
 * Lädt Statistikdaten zu Live-Challenges für einen Spieler.
 */
async function loadLiveChallengeStatsForPlayer(playerId) {
  const [
    { data: playerRows, error: playerError },
    { count: totalCount, error: totalError }
  ] = await Promise.all([
    supabaseClient
      .from("player_live_challenges")
      .select("points_awarded")
      .eq("player_id", playerId)
      .eq("game_id", currentGameId)
      .eq("status", "completed"),

    supabaseClient
      .from("live_challenges")
      .select("*", { count: "exact", head: true })
      .eq("game_id", currentGameId)
      .neq("status", "cancelled")
  ]);

  if (playerError) {
    console.error("Fehler beim Laden der Spieler-Live-Challenge-Stats:", playerError);
  }

  if (totalError) {
    console.error("Fehler beim Laden der gesamten Live-Challenge-Anzahl:", totalError);
  }

  const rows = playerRows || [];

  const won = rows.filter(r => (r.points_awarded || 0) > 0).length;
  const points = rows.reduce((sum, r) => sum + (r.points_awarded || 0), 0);
  const total = totalCount || 0;

  return {
    total,
    won,
    points
  };
}

/**
 * Lädt Gewinnername und Gewinnerbild einer Live-Challenge.
 */
async function loadLiveChallengeWinner(liveChallengeId) {
  const { data, error } = await supabaseClient
    .from("player_live_challenges")
    .select(`
      player_id,
      proof_image_path,
      players (
        display_name,
        username
      )
    `)
    .eq("live_challenge_id", liveChallengeId)
    .gt("points_awarded", 0)
    .maybeSingle();

  if (error) {
    console.error("Fehler beim Laden des Gewinners:", error);
    return null;
  }

  if (!data) return null;

  return {
    name: data.players?.display_name || data.players?.username || "Unbekannt",
    imagePath: data.proof_image_path || null
  };
}

/* ============================================================
 * INITIALISIERUNG FÜR NEUE SPIELER
 * ============================================================
 */

/**
 * Initialisiert View-State-Einträge für einen neuen Spieler im aktuellen Spiel,
 * damit alte Events nicht nachträglich als neu auftauchen.
 */
async function initializeLiveChallengeViewsForNewPlayerInGame(playerId) {
  const { data: liveChallenges, error } = await supabaseClient
    .from("live_challenges")
    .select("id, status, created_at")
    .eq("game_id", currentGameId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Fehler beim Initialisieren der Live-Challenge-Views:", error);
    return false;
  }

  const rows = liveChallenges || [];
  if (!rows.length) {
    console.log("Keine Live-Challenges vorhanden, nichts zu initialisieren.");
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

  const { error: upsertError } = await supabaseClient
    .from("player_live_challenge_views")
    .upsert(payload, {
      onConflict: "player_id,live_challenge_id"
    });

  if (upsertError) {
    console.error("Fehler beim Upsert der initialen Live-Challenge-Views:", upsertError);
    return false;
  }

  return true;
}