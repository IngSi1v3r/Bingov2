
// =======================
// LIVE CHALLENGE DOM
// =======================

const liveChallengeOverlay = document.getElementById("liveChallengeOverlay");
const liveChallengeTitle = document.getElementById("liveChallengeTitle");
const liveChallengeIntro = document.getElementById("liveChallengeIntro");
const liveChallengeTaskTitle = document.getElementById("liveChallengeTaskTitle");
const liveChallengeTaskDescription = document.getElementById("liveChallengeTaskDescription");
const liveChallengeMeta = document.getElementById("liveChallengeMeta");
const liveChallengeActions = document.getElementById("liveChallengeActions");

const dismissLiveChallengeBtn = document.getElementById("dismissLiveChallengeBtn");
const completeLiveChallengeBtn = document.getElementById("completeLiveChallengeBtn");
const testLiveChallengeBtn = document.getElementById("testLiveChallengeBtn");
const endLiveChallengeBtn = document.getElementById("endLiveChallengeBtn");






// =======================
// LIVE CHALLENGES / STATE
// =======================

let currentLiveChallenge = null;
let currentLiveChallengeModalOpen = false;
let dismissedLiveChallengeIds = [];

// =======================
// HILFSFUNKTIONEN
// =======================

function resetLiveChallengeState() {
  currentLiveChallenge = null;
  currentLiveChallengeModalOpen = false;
}

function hasDismissedLiveChallenge(challengeId) {
  return dismissedLiveChallengeIds.includes(challengeId);
}

function dismissLiveChallenge(challengeId) {
  if (!challengeId) return;
  if (!dismissedLiveChallengeIds.includes(challengeId)) {
    dismissedLiveChallengeIds.push(challengeId);
  }
}

// =======================
// DB - LIVE CHALLENGES
// =======================

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

async function createLiveChallenge({
  title,
  description,
  points = 5,
  requiresPhotoProof = false,
  durationMinutes = null
}) {
  try {
    const existing = await loadActiveLiveChallenge();

    if (existing) {
      console.log("Beende alte Challenge:", existing.id);

      const expired = await expireLiveChallenge(existing.id);
      console.log("Expire Ergebnis:", expired);
    }

    const expiresAt =
      durationMinutes && Number(durationMinutes) > 0
        ? new Date(Date.now() + Number(durationMinutes) * 60 * 1000).toISOString()
        : null;

    console.log("Erstelle neue Challenge...", {
      game_id: currentGameId,
      title,
      description,
      points,
      requires_photo_proof: requiresPhotoProof,
      status: "active",
      expires_at: expiresAt
    });

    const { data, error } = await supabaseClient
      .from("live_challenges")
      .insert({
        game_id: currentGameId,
        title,
        description,
        points,
        requires_photo_proof: requiresPhotoProof,
        status: "active",
        expires_at: expiresAt
      })
      .select()
      .single();

    if (error) {
      console.error("Fehler beim Erstellen der Spontanchallenge:", error);
      alert("Fehler beim Erstellen der Spontanchallenge.");
      return null;
    }

    console.log("Neue Challenge erstellt:", data);
    return data;
  } catch (err) {
    console.error("Unerwarteter Fehler in createLiveChallenge:", err);
    alert("Unerwarteter Fehler beim Erstellen der Spontanchallenge.");
    return null;
  }
}

async function completeLiveChallengeForPlayer(liveChallengeId, proofImagePath = null) {
  if (!currentPlayer) return null;
  if (!liveChallengeId) return null;

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

// =======================
// LIVE CHALLENGE CHECK
// =======================

async function checkLiveChallengeStatus() {

if (uploadOverlay && !uploadOverlay.classList.contains("hidden")) {
  return;
}

  const next = await getNextLiveChallengeToDisplay();
  if (!next) return;

  const { type, challenge } = next;

  currentLiveChallenge = challenge;

  if (type === "end") {
    if (challenge.status === "completed") {
      await renderCompletedLiveChallengeModal(challenge);
    } else {
      renderExpiredLiveChallengeModal(challenge);
    }

    openLiveChallengeOverlay();
    return;
  }

  if (type === "start") {
    renderLiveChallengeModal(challenge);
    openLiveChallengeOverlay();
  }
}



// =======================
// LIVE CHALLENGE MODAL
// =======================

function openLiveChallengeOverlay() {
  if (!liveChallengeOverlay) return;
  lockBodyScroll();
  liveChallengeOverlay.classList.remove("hidden");
  currentLiveChallengeModalOpen = true;
}

function closeLiveChallengeOverlay() {
  if (currentLiveChallenge?.id) {
    markLiveChallengeAsSeen(currentLiveChallenge.id); // 🔥 wichtig
  }

  liveChallengeOverlay.classList.add("hidden");
  unlockBodyScroll();
  currentLiveChallengeModalOpen = false;
}

// =======================
// LIVE CHALLENGE - START MODAL
// =======================

function renderLiveChallengeModal(challenge) {
  if (!challenge) return;

  const requiresPhoto =
    challenge.requires_photo_proof === true ||
    challenge.requiresPhotoProof === true;

  liveChallengeTitle.textContent = "Spontanchallenge";
  liveChallengeIntro.textContent = "Eine spontane Zusatzaufgabe wurde gestartet.";
  liveChallengeTaskTitle.textContent = challenge.title || "Ohne Titel";
  liveChallengeTaskDescription.textContent = challenge.description || "";

  const remainingSeconds = getLiveChallengeRemainingSeconds(challenge);
const hasTimer = remainingSeconds !== null;

liveChallengeMeta.innerHTML = `
  Nur der erste Spieler bekommt <strong>${challenge.points ?? 5} Punkte</strong>.
  ${requiresPhoto ? "<br>Für diese Aufgabe ist ein Foto erforderlich." : ""}
  ${hasTimer ? `<br>Verbleibende Zeit: <strong>${formatLiveChallengeRemainingTime(remainingSeconds)}</strong>` : ""}
`;

  liveChallengeActions.innerHTML = `
    <button id="dismissLiveChallengeBtn" type="button">Nicht interessiert</button>
    <button id="completeLiveChallengeBtn" type="button">
      ${requiresPhoto ? "Mit Foto abschließen" : "Aufgabe bestanden"}
    </button>
  `;

  const dismissBtn = document.getElementById("dismissLiveChallengeBtn");
  const completeBtn = document.getElementById("completeLiveChallengeBtn");

  // 👉 NICHT INTERESSIERT = START GESEHEN
  if (dismissBtn) {
    dismissBtn.onclick = async () => {
      if (currentPlayer && challenge.id) {
        await markLiveChallengeStartSeen(currentPlayer.id, challenge.id);
      }

      dismissLiveChallenge(challenge.id);
      closeLiveChallengeOverlay();
    };
  }

  // 👉 ABSCHLIESSEN
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



// =======================
// LIVE CHALLENGE - END MODAL
// =======================

async function renderCompletedLiveChallengeModal(challenge) {
  const winner = await loadLiveChallengeWinner(challenge.id);

  const imageUrl = winner?.imagePath
    ? supabaseClient.storage
        .from("proof-photos")
        .getPublicUrl(winner.imagePath).data.publicUrl
    : null;

  liveChallengeTitle.textContent = "Spontanchallenge beendet";

  if (winner) {
    liveChallengeIntro.innerHTML = `
      <strong>${winner.name}</strong> hat die Aufgabe gelöst!
    `;
  } else {
    liveChallengeIntro.innerHTML = `
      Niemand hat die Aufgabe geschafft.
    `;
  }

  liveChallengeTaskTitle.textContent = challenge.title;
  liveChallengeTaskDescription.textContent = challenge.description || "";

  liveChallengeMeta.innerHTML = `
    ${winner ? `Gewinner erhält <strong>${challenge.points ?? 5} Punkte</strong>` : ""}
  `;

  liveChallengeActions.innerHTML = `
    ${imageUrl ? `<img src="${imageUrl}" class="live-challenge-winner-image" />` : ""}
    <button id="closeLiveChallengeEndBtn">Schließen</button>
  `;

  const closeBtn = document.getElementById("closeLiveChallengeEndBtn");

  // 👉 END GESEHEN markieren
  if (closeBtn) {
    closeBtn.onclick = async () => {
      if (currentPlayer && challenge.id) {
        await markLiveChallengeEndSeen(currentPlayer.id, challenge.id);
      }

      closeLiveChallengeOverlay();
    };
  }
}




// =======================
// TEST BUTTON
// =======================

if (testLiveChallengeBtn) {
  testLiveChallengeBtn.addEventListener("click", async () => {
    const title = prompt("Name der Spontanchallenge:");
    if (!title) return;

    const description = prompt("Beschreibung:");
    if (!description) return;

    const requiresPhotoAnswer = prompt("Foto erforderlich? (ja/nein)", "nein");
    const requiresPhotoProof =
      requiresPhotoAnswer &&
      ["ja", "j", "yes", "y"].includes(requiresPhotoAnswer.trim().toLowerCase());

    const pointsAnswer = prompt("Punkte für diese Spontanchallenge?", "5");
    const points = Math.max(1, Number(pointsAnswer) || 5);

    const durationAnswer = prompt("Zeitlimit in Minuten? Leer lassen = unbegrenzt", "");
    const durationMinutes =
      durationAnswer && durationAnswer.trim() !== ""
        ? Math.max(1, Number(durationAnswer) || 0)
        : null;

    const created = await createLiveChallenge({
      title,
      description,
      points,
      requiresPhotoProof,
      durationMinutes
    });

    if (!created) {
      alert("Spontanchallenge konnte nicht erstellt werden.");
      return;
    }

    currentLiveChallenge = created;
    renderLiveChallengeModal(created);
    openLiveChallengeOverlay();
  });
}

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

if (endLiveChallengeBtn) {
  endLiveChallengeBtn.addEventListener("click", async () => {
    const activeChallenge = await loadActiveLiveChallenge();

    if (!activeChallenge) {
      alert("Aktuell gibt es keine aktive Spontanchallenge.");
      return;
    }

    const expired = await expireLiveChallenge(activeChallenge.id);

    if (!expired) {
      alert("Die aktive Spontanchallenge konnte nicht beendet werden.");
      return;
    }

    console.log("Spontanchallenge manuell beendet:", {
      id: activeChallenge.id,
      title: activeChallenge.title,
      description: activeChallenge.description
    });
  });
}

// =======================
// LIVE CHALLENGE ABSCHLUSS
// =======================

async function handleCompleteLiveChallenge(challenge, proofImagePath = null) {
  if (!challenge || !currentPlayer) return;

  const attempt = await completeLiveChallengeForPlayer(challenge.id, proofImagePath);
  if (!attempt) {
    alert("Konnte nicht gespeichert werden.");
    return;
  }

  const winnerUpdate = await markLiveChallengeWinner(challenge.id, currentPlayer.id);

  let winnerName = "Jemand anderes";

  if (winnerUpdate) {
    const points = challenge.points ?? 5;

    await updatePlayerLiveChallengePoints(attempt.id, points);

    const newScore = (gameState.score || 0) + points;

    const updatedGameState = await updatePlayerGameState(currentPlayer.id, {
      score: newScore
    });

    if (updatedGameState) {
      gameState.score = newScore;

      freezeScoreDisplay = true;
      await animateScoreDisplay(newScore);
      freezeScoreDisplay = false;

      await renderLeaderboard();
    }

    winnerName = currentPlayer.display_name || currentPlayer.username;
  } else {
    const latest = await loadLatestLiveChallenge();
    winnerName =
      latest?.players?.display_name ||
      latest?.players?.username ||
      "Jemand anderes";
  }

  currentLiveChallenge = {
    ...challenge,
    status: "completed"
  };

  await renderCompletedLiveChallengeModal(challenge);
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

// =======================
// Hilfsfunktionen
// =======================

function getLiveChallengeSeenKey(challengeId) {
  if (!currentPlayer) return null;
  return `live_challenge_seen_${currentGameId}_${currentPlayer.id}_${challengeId}`;
}

function hasSeenLiveChallenge(challengeId) {
  const key = getLiveChallengeSeenKey(challengeId);
  if (!key) return false;
  return localStorage.getItem(key) === "true";
}

function markLiveChallengeAsSeen(challengeId) {
  const key = getLiveChallengeSeenKey(challengeId);
  if (!key) return;
  localStorage.setItem(key, "true");
}

// =======================
// LIVE CHALLENGES FÜR PROFIL
// =======================

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

// =======================
// LIVE CHALLENGE STATS
// =======================

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
    .gt("points_awarded", 0) // nur Gewinner
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


// =======================
// LIVE CHALLENGE VIEW STATE
// =======================

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


// =======================
// ABGELAUFENE AUFGABEN
// =======================


let pendingExpiredChallenge = null;
let lastShownLiveChallengeId = null;

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

  return data;
}

function renderExpiredLiveChallengeModal(challenge) {
  liveChallengeTitle.textContent = "Spontanchallenge beendet";

  liveChallengeIntro.innerHTML = `
    <strong>Niemand</strong> hat die Aufgabe geschafft.
  `;

  liveChallengeTaskTitle.textContent = challenge.title || "Ohne Titel";
  liveChallengeTaskDescription.textContent = challenge.description || "";

  liveChallengeMeta.innerHTML = `
    Es wurden keine Punkte vergeben.
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

async function loadLatestFinishedLiveChallenge() {
  const { data, error } = await supabaseClient
    .from("live_challenges")
    .select("*")
    .eq("game_id", currentGameId)
    .in("status", ["completed", "expired"])
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Fehler beim Laden der letzten beendeten Challenge:", error);
    return null;
  }

  return data;
}

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

  // =======================
  // 1. zuerst: offene Endmeldungen
  // =======================

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

  // =======================
  // 2. dann: neue aktive Challenge
  // =======================

  for (const challenge of challenges) {
    if (challenge.status === "active") {
      const view = viewMap[challenge.id];

      const hasSeenStart = view?.seen_start_at;

      if (!hasSeenStart) {
        return {
          type: "start",
          challenge
        };
      }
    }
  }

  return null;
}

// =======================
// ALTE AUFGABEN NICHT ANZEIGEN
// =======================

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
      seen_end_at: null
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

  console.log("Initialisiere Live-Challenge-Views mit Payload:", payload);

  const { error: upsertError } = await supabaseClient
    .from("player_live_challenge_views")
    .upsert(payload, {
      onConflict: "player_id,live_challenge_id"
    });

  if (upsertError) {
    console.error("Fehler beim Upsert der initialen Live-Challenge-Views:", upsertError);
    return false;
  }

  console.log("Live-Challenge-Views erfolgreich initialisiert.");
  return true;
}