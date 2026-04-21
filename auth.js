// =======================
// AUTH / SPIELER
// =======================

let currentPlayer = null;

const PLAYER_STORAGE_KEY = "festival_bingo_player";

// =======================
// LOCAL STORAGE
// =======================

function savePlayerToLocalStorage(player) {
  localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(player));
}

function loadPlayerFromLocalStorage() {
  const raw = localStorage.getItem(PLAYER_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("Fehler beim Lesen des gespeicherten Spielers:", error);
    return null;
  }
}

function clearPlayerFromLocalStorage() {
  localStorage.removeItem(PLAYER_STORAGE_KEY);
}

// =======================
// HILFSFUNKTIONEN
// =======================

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

function cleanDisplayName(username) {
  return username.trim();
}

// =======================
// LOGIN
// =======================

async function loginPlayer(username, pin) {
  const displayName = cleanDisplayName(username);
  const cleanUsername = normalizeUsername(username);
  const cleanPin = pin.trim();

  if (!displayName) {
    alert("Bitte einen gültigen Namen eingeben.");
    return null;
  }

  if (!cleanPin) {
    alert("Bitte einen PIN eingeben.");
    return null;
  }

  console.log("Login-Versuch für Spieler:", cleanUsername);

  const { data: player, error } = await supabaseClient
    .from("players")
    .select("*")
    .eq("username", cleanUsername)
    .maybeSingle();

  if (error) {
    console.error("Fehler beim Laden des Spielers:", error);
    alert("Spieler konnte nicht geladen werden.");
    return null;
  }

  if (!player) {
    alert("Spieler nicht gefunden.");
    return null;
  }

  if (player.pin_hash !== cleanPin) {
    alert("Falscher PIN.");
    return null;
  }

  if (player.is_blocked) {
    alert("Dieser Spieler ist gesperrt.");
    return null;
  }

  currentPlayer = {
    ...player,
    is_admin: player.is_admin === true
  };

  savePlayerToLocalStorage(currentPlayer);

  console.log("Spieler erfolgreich eingeloggt:", currentPlayer.display_name || currentPlayer.username);
  console.log("Admin-Status:", currentPlayer.is_admin);

  return currentPlayer;

  // Hinweise zum Pin: Der Pin wird absichtlich nicht als Hash abgespeichert. 
  // Es handelt sich um ein kleines privates Spiel. Ich möchte als Admin den Pin einfach nachsehen können
  // sollte ihn ein Spieler vergessen. Außerdem wesentlich einfachere Logik.
}
// =======================
// REGISTRIERUNG
// =======================

async function registerPlayer(username, pin) {
  const displayName = cleanDisplayName(username);
  const cleanUsername = normalizeUsername(username);
  const cleanPin = pin.trim();

  if (!displayName) {
    alert("Bitte einen gültigen Namen eingeben.");
    return null;
  }

  if (!cleanPin) {
    alert("Bitte einen PIN eingeben.");
    return null;
  }

  console.log("Registriere neuen Spieler:", cleanUsername);

  const { data: existingPlayer, error: selectError } = await supabaseClient
    .from("players")
    .select("*")
    .eq("username", cleanUsername)
    .maybeSingle();

  if (selectError) {
    console.error("Fehler beim Prüfen bestehender Spieler:", selectError);
    alert("Spieler konnte nicht geprüft werden.");
    return null;
  }

  if (existingPlayer) {
    alert("Dieser Name ist bereits vergeben.");
    return null;
  }

  const { data: newPlayer, error: insertError } = await supabaseClient
    .from("players")
    .insert({
      username: cleanUsername,
      display_name: displayName,
      pin_hash: cleanPin
    })
    .select()
    .single();

  if (insertError) {
    console.error("Fehler beim Erstellen des Spielers:", insertError);
    alert("Spieler konnte nicht erstellt werden.");
    return null;
  }

  currentPlayer = newPlayer;
  savePlayerToLocalStorage(currentPlayer);

  console.log("Neuer Spieler erstellt:", currentPlayer.display_name || currentPlayer.username);
  return currentPlayer;
}

// =======================
// LOGOUT
// =======================

function logoutPlayer() {
  currentPlayer = null;
  clearPlayerFromLocalStorage();
  location.reload();
}

// =======================
// BLOCK / VALIDITY CHECK
// =======================

async function loadCurrentPlayerFromDatabase() {
  if (!currentPlayer?.id) return null;

  const { data, error } = await supabaseClient
    .from("players")
    .select("*")
    .eq("id", currentPlayer.id)
    .maybeSingle();

  if (error) {
    console.error("Fehler beim Nachladen des aktuellen Spielers:", error);
    return null;
  }

  return data || null;
}

let blockedPlayerHandled = false;

async function checkCurrentPlayerStillAllowed() {
  if (!currentPlayer || blockedPlayerHandled) return true;

  const freshPlayer = await loadCurrentPlayerFromDatabase();

  // Spieler existiert nicht mehr
  if (!freshPlayer) {
    handleBlockedOrRemovedPlayer("Dein Spielerprofil ist nicht mehr verfügbar.");
    return false;
  }

  // Spieler wurde gesperrt
  if (freshPlayer.is_blocked) {
    handleBlockedOrRemovedPlayer("Dein Spieler wurde durch einen Admin gesperrt.");
    return false;
  }

  // optional: lokale Daten aktuell halten
  currentPlayer = freshPlayer;
  savePlayerToLocalStorage(currentPlayer);

  return true;
}

function handleBlockedOrRemovedPlayer(message) {
  if (blockedPlayerHandled) return;
  blockedPlayerHandled = true;

  console.log("Spieler wurde gesperrt oder entfernt:", message);

  try {
    if (typeof closeModal === "function") closeModal();
    if (typeof closeUploadModal === "function") closeUploadModal();
    if (typeof closePhotoViewer === "function") closePhotoViewer();
    if (typeof closeRulesModal === "function") closeRulesModal();
    if (typeof closeDetailsModal === "function") closeDetailsModal();
    if (typeof closeFinalOverlay === "function") closeFinalOverlay();
    if (typeof closePlayerProfileModal === "function") closePlayerProfileModal();
    if (typeof closeFailConfirmModal === "function") closeFailConfirmModal();
    if (typeof closeLiveChallengeOverlay === "function") closeLiveChallengeOverlay();
  } catch (err) {
    console.warn("Fehler beim Schließen von Overlays:", err);
  }

  // Player-Daten löschen
  clearPlayerFromLocalStorage();
  currentPlayer = null;

  // Overlay anzeigen
  const overlay = document.getElementById("blockedOverlay");
  const button = document.getElementById("blockedBackToLoginBtn");

  if (overlay) {
    overlay.classList.remove("hidden");
  }

  if (button) {
    button.onclick = () => {
      location.reload();
    };
  }
}