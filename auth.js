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

// =======================
// LOGIN
// =======================

async function loginPlayer(username, pin) {
  const cleanUsername = normalizeUsername(username);
  const cleanPin = pin.trim();

  if (!cleanUsername) {
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

  currentPlayer = player;
  savePlayerToLocalStorage(currentPlayer);

  console.log("Spieler erfolgreich eingeloggt:", currentPlayer.username);
  return currentPlayer;
}

// =======================
// REGISTRIERUNG
// =======================

async function registerPlayer(username, pin) {
  const cleanUsername = normalizeUsername(username);
  const cleanPin = pin.trim();

  if (!cleanUsername) {
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

  console.log("Neuer Spieler erstellt:", currentPlayer.username);
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