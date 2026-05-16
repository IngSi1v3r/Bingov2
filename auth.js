/**
 * ============================================================
 * auth.js
 * ============================================================
 *
 * Zweck:
 * Zentrale Auth-, Session- und Routing-Logik für:
 * - Spielerseite (index.html)
 * - Adminseite (admin.html)
 *
 * Diese Datei verwaltet:
 * - Registrierung
 * - Login
 * - lokale Session im Browser
 * - Umschalten zwischen Spiel- und Adminansicht
 * - Admin-Passwortabfragen für kritische Aktionen
 * - vorbereiteten Passwort-Reset für Spieler
 * - Prüfung, ob ein eingeloggter Spieler weiterhin gültig / entsperrt ist
 *
 *
 * ============================================================
 * SERVERSEITIGE FUNKTIONEN (SUPABASE / POSTGRES)
 * ============================================================
 *
 * Diese Datei erwartet folgende RPC-Funktionen in Supabase:
 *
 * 1) public.register_bingo_user(...)
 *    - legt einen neuen Spieler an
 *    - prüft Session-Passwort
 *    - prüft Passwort-Wiederholung
 *    - hasht das Passwort serverseitig
 *
 * 2) public.login_bingo_user(...)
 *    - prüft Username + Passwort
 *    - vergleicht Passwort serverseitig mit dem Hash
 *    - liefert ein bereinigtes Benutzerobjekt zurück
 *
 * 3) public.verify_bingo_admin_password(...)
 *    - prüft das Passwort eines Admins
 *    - wird für kritische Aktionen verwendet
 *
 * 4) public.admin_reset_bingo_user_password(...)
 *    - setzt das Passwort eines Zielspielers neu
 *    - prüft dabei vorher das Admin-Passwort serverseitig
 *
 *
 * ============================================================
 * GRUNDLOGIK
 * ============================================================
 *
 * - Es gibt genau EINE Session im LocalStorage
 * - Ein Benutzer kann role = "player" oder role = "admin" haben
 * - Admins dürfen Spiel- und Adminansicht benutzen
 * - Die bevorzugte Ansicht ("game" / "admin") wird separat gemerkt
 * - Alte Legacy-LocalStorage-Einträge werden beim Start migriert
 *
 * 
 ** ============================================================
 * SICHERHEITSKONZEPT
 * ============================================================
 * 
 * Diese Auth-Lösung ist bewusst leichtgewichtig gehalten und für ein privates
 * Spiel- bzw. Event-Umfeld gedacht, nicht für hochsensible produktive Systeme.
 * Zielgruppe sind kleine Gruppen wie Freundeskreise, Festivals oder interne Runden,
 * bei denen eine einfache Bedienung genauso wichtig ist wie ein solides Mindestmaß
 * an Sicherheit.
 *
 * Passwörter werden serverseitig geprüft und gehasht gespeichert, kritische
 * Admin-Aktionen können zusätzlich per Admin-Passwort bestätigt werden. Gleichzeitig
 * verzichten wir bewusst auf komplexere Mechanismen wie E-Mail-Login,
 * Passwort-Recovery per Mail, Token-/Refresh-Token-Management oder ein vollständiges
 * externes Identity-System. Dadurch bleibt der Ablauf für Nutzer einfach und der
 * Code überschaubar.
 *
 * Diese Lösung ist damit ein guter Kompromiss zwischen Sicherheit und Komplexität:
 * deutlich sauberer und sicherer als Klartext-Passwörter oder rein clientseitige
 * Logik, aber bewusst einfacher als ein vollwertiges professionelles Auth-System.
 * 
 * 
 * 
 * ============================================================
 * HAUPTBEREICHE
 * ============================================================
 *
 * 1. Globaler Auth-State und Konstanten
 * 2. Allgemeine Helper
 * 3. Session / LocalStorage
 * 4. Kompatibilitäts-Wrapper für alten Code
 * 5. DOM-/Overlay-Helfer
 * 6. Status- und View-Helfer
 * 7. RPC-Wrapper
 * 8. Login / Registrierung
 * 9. Admin-Auswahl und Passwortabfrage
 * 10. Auth-Overlay / Login-Flow
 * 11. Routing / Bootstrap
 * 12. Logout
 * 13. Gültigkeits- / Sperrprüfung des aktuellen Spielers
 */

/* ============================================================
 * GLOBALER AUTH-STATE / KONSTANTEN
 * ============================================================
 */

/** Aktuell eingeloggter Benutzer für Spiel- und Adminlogik */
let currentPlayer = null;

/** Gesamte Session, wie sie im LocalStorage gespeichert wird */
let currentSession = null;

/** Neuer zentraler LocalStorage-Key für die Session */
const AUTH_SESSION_STORAGE_KEY = "festival_bingo_session";

/** LocalStorage-Key für die zuletzt gewünschte Ansicht */
const AUTH_VIEW_STORAGE_KEY = "festival_bingo_view";

/** Alte Keys aus der früheren Architektur, nur noch für Migration */
const LEGACY_PLAYER_STORAGE_KEY = "festival_bingo_player";
const LEGACY_ADMIN_STORAGE_KEY = "festival_bingo_admin";

/** Mögliche Zielansichten */
const AUTH_VIEW_GAME = "game";
const AUTH_VIEW_ADMIN = "admin";

/** Mindestlänge für Passwörter */
const AUTH_MIN_PASSWORD_LENGTH = 6;



const AUTH_FORCE_GAME_VIEW_KEY = "festival_bingo_force_game_view";

/* ============================================================
 * ALLGEMEINE HELPER
 * ============================================================
 */

/**
 * Parst JSON sicher.
 * Gibt bei Fehlern null zurück statt eine Exception zu werfen.
 */
function authSafeJsonParse(raw) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("Fehler beim Parsen von Auth-JSON:", error);
    return null;
  }
}

/**
 * Normalisiert den Benutzernamen für Registrierung und Login.
 * Aktuell: trim + lowercase.
 */
function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

/**
 * Bereinigt einen Anzeigenamen / eingegebenen Namen.
 */
function cleanDisplayName(name) {
  return String(name || "").trim();
}

/**
 * Prüft, ob ein Benutzer Admin ist.
 */
function isAdminUser(user = currentPlayer) {
  return user?.role === "admin";
}

/**
 * Prüft, ob wir uns aktuell auf der Adminseite befinden.
 */
function isAdminPage() {
  return window.location.pathname.toLowerCase().includes("admin.html");
}

/**
 * Prüft, ob wir uns aktuell auf der Spieleseite befinden.
 */
function isGamePage() {
  return !isAdminPage();
}

/* ============================================================
 * SESSION / LOCAL STORAGE
 * ============================================================
 */

/**
 * Speichert die aktuelle Session im LocalStorage
 * und synchronisiert currentSession / currentPlayer.
 */
function saveAuthSessionToLocalStorage(session) {
  currentSession = session || null;
  currentPlayer = session?.user || null;

  if (!session) {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    return;
  }

  localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
}

/**
 * Lädt die Session aus dem LocalStorage
 * und synchronisiert currentSession / currentPlayer.
 */
function loadAuthSessionFromLocalStorage() {
  const session = authSafeJsonParse(localStorage.getItem(AUTH_SESSION_STORAGE_KEY));

  currentSession = session || null;
  currentPlayer = session?.user || null;

  return currentSession;
}

/**
 * Löscht die aktuelle Session vollständig aus dem LocalStorage.
 */
function clearAuthSessionFromLocalStorage() {
  currentSession = null;
  currentPlayer = null;
  localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

/**
 * Speichert die bevorzugte Ansicht des Benutzers.
 */
function saveAuthPreferredView(view) {
  const safeView = view === AUTH_VIEW_ADMIN ? AUTH_VIEW_ADMIN : AUTH_VIEW_GAME;
  localStorage.setItem(AUTH_VIEW_STORAGE_KEY, safeView);
}

/**
 * Lädt die bevorzugte Ansicht aus dem LocalStorage.
 */
function loadAuthPreferredView() {
  const raw = localStorage.getItem(AUTH_VIEW_STORAGE_KEY);
  return raw === AUTH_VIEW_ADMIN ? AUTH_VIEW_ADMIN : AUTH_VIEW_GAME;
}

/**
 * Löscht die gespeicherte bevorzugte Ansicht.
 */
function clearAuthPreferredView() {
  localStorage.removeItem(AUTH_VIEW_STORAGE_KEY);
}

/**
 * Löscht die alten Storage-Keys der früheren Architektur.
 */
function clearLegacyAuthStorage() {
  localStorage.removeItem(LEGACY_PLAYER_STORAGE_KEY);
  localStorage.removeItem(LEGACY_ADMIN_STORAGE_KEY);
}

/**
 * Migriert alte Player-/Admin-Storage-Einträge in das neue Session-Modell.
 * Wird nur verwendet, wenn noch keine neue Session existiert.
 */
function migrateLegacyAuthStorageIfPossible() {
  const alreadyHasNewSession = !!localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (alreadyHasNewSession) return;

  const legacyAdmin = authSafeJsonParse(localStorage.getItem(LEGACY_ADMIN_STORAGE_KEY));
  if (legacyAdmin?.id) {
    saveAuthSessionToLocalStorage({
      user: legacyAdmin,
      createdAt: new Date().toISOString()
    });
    saveAuthPreferredView(AUTH_VIEW_ADMIN);
    clearLegacyAuthStorage();
    return;
  }

  const legacyPlayer = authSafeJsonParse(localStorage.getItem(LEGACY_PLAYER_STORAGE_KEY));
  if (legacyPlayer?.id) {
    saveAuthSessionToLocalStorage({
      user: legacyPlayer,
      createdAt: new Date().toISOString()
    });
    saveAuthPreferredView(legacyPlayer.role === "admin" ? AUTH_VIEW_ADMIN : AUTH_VIEW_GAME);
    clearLegacyAuthStorage();
  }
}

/* ============================================================
 * KOMPATIBILITÄTS-WRAPPER
 * für alten Code, damit nicht sofort alles bricht
 * ============================================================
 */

/**
 * Altes Wrapper-Verhalten: "Spieler speichern".
 * Nutzt intern bereits das neue Session-Modell.
 */
function savePlayerToLocalStorage(player) {
  saveAuthSessionToLocalStorage({
    user: player,
    createdAt: new Date().toISOString()
  });
}

/**
 * Altes Wrapper-Verhalten: "Spieler laden".
 */
function loadPlayerFromLocalStorage() {
  const session = loadAuthSessionFromLocalStorage();
  return session?.user || null;
}

/**
 * Altes Wrapper-Verhalten: "Spieler löschen".
 */
function clearPlayerFromLocalStorage() {
  clearAuthSessionFromLocalStorage();
}

/**
 * Altes Wrapper-Verhalten: "Admin speichern".
 */
function saveAdminToLocalStorage(admin) {
  saveAuthSessionToLocalStorage({
    user: admin,
    createdAt: new Date().toISOString()
  });
  saveAuthPreferredView(AUTH_VIEW_ADMIN);
}

/**
 * Altes Wrapper-Verhalten: "Admin laden".
 */
function loadAdminFromLocalStorage() {
  const session = loadAuthSessionFromLocalStorage();
  if (session?.user?.role === "admin") return session.user;
  return null;
}

/**
 * Altes Wrapper-Verhalten: "Admin löschen".
 */
function clearAdminFromLocalStorage() {
  const session = loadAuthSessionFromLocalStorage();

  if (session?.user?.role === "admin") {
    clearAuthSessionFromLocalStorage();
  }
}

/* ============================================================
 * DOM- / OVERLAY-HELPER
 * ============================================================
 */

/**
 * Stellt sicher, dass Statuszeilen für Login und Registrierung vorhanden sind.
 */
function ensureAuthStatusElements() {
  const loginView = document.getElementById("loginView");
  const registerView = document.getElementById("registerView");

  if (loginView && !document.getElementById("authLoginStatusText")) {
    const el = document.createElement("p");
    el.id = "authLoginStatusText";
    el.className = "auth-hint";
    el.style.color = "#fca5a5";
    el.style.minHeight = "1.2em";

    const actions = loginView.querySelector(".modal-actions");
    if (actions) {
      loginView.insertBefore(el, actions);
    } else {
      loginView.appendChild(el);
    }
  }

  if (registerView && !document.getElementById("authRegisterStatusText")) {
    const el = document.createElement("p");
    el.id = "authRegisterStatusText";
    el.className = "auth-hint";
    el.style.color = "#fca5a5";
    el.style.minHeight = "1.2em";

    const actions = registerView.querySelector(".modal-actions");
    if (actions) {
      registerView.insertBefore(el, actions);
    } else {
      registerView.appendChild(el);
    }
  }
}

/**
 * Baut die Registrierungsansicht so um,
 * dass Passwort-Wiederholung und Session-Passwort vorhanden sind.
 */
function ensureEnhancedRegisterFields() {
  const registerView = document.getElementById("registerView");
  const registerPinInput = document.getElementById("registerPinInput");

  if (!registerView || !registerPinInput) return;

  const registerHint = registerView.querySelector(".auth-hint");
  if (registerHint) {
    registerHint.innerHTML = `
      Wähle einen einfachen Namen ohne Leerzeichen oder Sonderzeichen.<br>
      Das Passwort muss mindestens ${AUTH_MIN_PASSWORD_LENGTH} Zeichen lang sein.
    `;
  }

  registerPinInput.placeholder = "Passwort";
  registerPinInput.removeAttribute("maxlength");
  registerPinInput.removeAttribute("inputmode");

  if (!document.getElementById("registerPinRepeatInput")) {
    const repeatInput = document.createElement("input");
    repeatInput.id = "registerPinRepeatInput";
    repeatInput.type = "password";
    repeatInput.placeholder = "Passwort wiederholen";

    registerPinInput.insertAdjacentElement("afterend", repeatInput);
  }

  if (!document.getElementById("registerSessionPasswordInput")) {
    const sessionInput = document.createElement("input");
    sessionInput.id = "registerSessionPasswordInput";
    sessionInput.type = "password";
    sessionInput.placeholder = "Session-Passwort";

    const repeatInput = document.getElementById("registerPinRepeatInput");
    if (repeatInput) {
      repeatInput.insertAdjacentElement("afterend", sessionInput);
    } else {
      registerPinInput.insertAdjacentElement("afterend", sessionInput);
    }
  }
}

/**
 * Passt das Loginfeld sprachlich von PIN auf Passwort an.
 */
function ensureEnhancedLoginFields() {
  const loginPinInput = document.getElementById("loginPinInput");
  if (!loginPinInput) return;

  loginPinInput.placeholder = "Passwort";
  loginPinInput.removeAttribute("inputmode");
}

/**
 * Erstellt das Overlay, mit dem Admins nach dem Login
 * Spiel oder Adminpanel wählen können.
 */
function ensureAdminChoiceOverlay() {
  if (document.getElementById("authAdminChoiceOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "authAdminChoiceOverlay";
  overlay.className = "modal-overlay hidden";
  overlay.innerHTML = `
    <div class="modal">
      <h2>Admin erkannt</h2>
      <p class="auth-subtext">
        Du bist als Admin angemeldet. Welche Ansicht möchtest du öffnen?
      </p>

      <div class="modal-actions auth-actions">
        <button id="authAdminChooseGameBtn" type="button" class="secondary-btn">Zum Spiel</button>
        <button id="authAdminChooseAdminBtn" type="button">Zum Adminpanel</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
}

/**
 * Erstellt das Overlay zur Bestätigung des Admin-Passworts.
 * Dieses wird bei kritischen Aktionen verwendet.
 */
function ensureAdminPasswordConfirmOverlay() {
  if (document.getElementById("authAdminPasswordOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "authAdminPasswordOverlay";
  overlay.className = "modal-overlay hidden";
  overlay.innerHTML = `
    <div class="modal">
      <h2>Admin-Bestätigung</h2>
      <p class="auth-subtext">
        Bitte bestätige dein Admin-Passwort.
      </p>

      <input
        id="authAdminPasswordInput"
        type="password"
        placeholder="Admin-Passwort"
      />

      <p id="authAdminPasswordStatusText" class="auth-hint" style="color:#fca5a5; min-height:1.2em;"></p>

      <div class="modal-actions">
        <button id="authAdminPasswordCancelBtn" type="button" class="secondary-btn">Abbrechen</button>
        <button id="authAdminPasswordConfirmBtn" type="button">Bestätigen</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
}

/**
 * Erstellt das vorbereitete Overlay für einen Spieler-Passwort-Reset.
 * Der Admin startet den Flow, der Spieler tippt sein neues Passwort selbst ein.
 */
function ensurePreparedPlayerPasswordResetOverlay() {
  if (document.getElementById("authPlayerPasswordResetOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "authPlayerPasswordResetOverlay";
  overlay.className = "modal-overlay hidden";
  overlay.innerHTML = `
    <div class="modal">
      <h2>Passwort für Spieler neu setzen</h2>
      <p class="auth-subtext">
        Gib das Gerät jetzt dem Spieler. Das neue Passwort ist für Admins nicht sichtbar.
      </p>

      <input
        id="authPlayerPasswordResetInput"
        type="password"
        placeholder="Neues Passwort"
      />

      <input
        id="authPlayerPasswordResetRepeatInput"
        type="password"
        placeholder="Neues Passwort wiederholen"
      />

      <p id="authPlayerPasswordResetStatusText" class="auth-hint" style="color:#fca5a5; min-height:1.2em;"></p>

      <div class="modal-actions">
        <button id="authPlayerPasswordResetCancelBtn" type="button" class="secondary-btn">Abbrechen</button>
        <button id="authPlayerPasswordResetConfirmBtn" type="button">Passwort speichern</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
}

/**
 * Fügt auf der Spieleseite für Admins den Button "Zum Adminpanel" hinzu.
 */
function ensureAdminSwitchButtonOnGamePage() {
  if (!isGamePage()) return;

  const bottomActions = document.querySelector(".bottom-actions");
  if (!bottomActions) return;

  let btn = document.getElementById("goToAdminPanelBtn");

  if (!isAdminUser()) {
    if (btn) btn.remove();
    return;
  }

  if (!btn) {
    btn = document.createElement("button");
    btn.id = "goToAdminPanelBtn";
    btn.type = "button";
    btn.className = "secondary-btn";
    btn.textContent = "Zum Adminpanel";

    btn.addEventListener("click", () => {
      saveAuthPreferredView(AUTH_VIEW_ADMIN);
      window.location.href = "admin.html";
    });

    bottomActions.appendChild(btn);
  }
}

/**
 * Baut alle benötigten Auth-DOM-Erweiterungen auf.
 */
function setupAuthDom() {
  ensureEnhancedLoginFields();
  ensureEnhancedRegisterFields();
  ensureAuthStatusElements();
  ensureAdminChoiceOverlay();
  ensureAdminPasswordConfirmOverlay();
  ensurePreparedPlayerPasswordResetOverlay();
}

/* ============================================================
 * STATUS-TEXTE
 * ============================================================
 */

/**
 * Setzt den Status-Text im Login-Bereich.
 */
function setAuthLoginStatus(text = "") {
  const el = document.getElementById("authLoginStatusText");
  if (el) el.textContent = text;
}

/**
 * Setzt den Status-Text im Registrierungs-Bereich.
 */
function setAuthRegisterStatus(text = "") {
  const el = document.getElementById("authRegisterStatusText");
  if (el) el.textContent = text;
}

/* ============================================================
 * VIEW-HELPER FÜR DIE BESTEHENDE LOGIN-UI
 * ============================================================
 */

/**
 * Öffnet das zentrale Login-Overlay.
 */
function openLoginOverlay() {
  const overlay = document.getElementById("loginOverlay");
  if (!overlay) return;

  overlay.classList.remove("hidden");
  showAuthChoiceView();

  if (typeof setRandomLoginTagline === "function") {
    setRandomLoginTagline();
  }
}

/**
 * Schließt das zentrale Login-Overlay.
 */
function closeLoginOverlay() {
  const overlay = document.getElementById("loginOverlay");
  if (!overlay) return;
  overlay.classList.add("hidden");
}

/**
 * Zeigt die erste Auswahlansicht "Login oder Registrierung".
 */
function showAuthChoiceView() {
  const authChoiceView = document.getElementById("authChoiceView");
  const loginView = document.getElementById("loginView");
  const registerView = document.getElementById("registerView");

  if (authChoiceView) authChoiceView.classList.remove("hidden");
  if (loginView) loginView.classList.add("hidden");
  if (registerView) registerView.classList.add("hidden");

  setAuthLoginStatus("");
  setAuthRegisterStatus("");
}

/**
 * Zeigt die Login-Ansicht.
 */
function showLoginView() {
  const authChoiceView = document.getElementById("authChoiceView");
  const loginView = document.getElementById("loginView");
  const registerView = document.getElementById("registerView");
  const loginNameInput = document.getElementById("loginNameInput");
  const loginPinInput = document.getElementById("loginPinInput");

  if (authChoiceView) authChoiceView.classList.add("hidden");
  if (loginView) loginView.classList.remove("hidden");
  if (registerView) registerView.classList.add("hidden");

  if (loginNameInput) loginNameInput.value = "";
  if (loginPinInput) loginPinInput.value = "";

  setAuthLoginStatus("");

  setTimeout(() => {
    loginNameInput?.focus();
  }, 0);
}

/**
 * Zeigt die Registrierungs-Ansicht.
 */
function showRegisterView() {
  const authChoiceView = document.getElementById("authChoiceView");
  const loginView = document.getElementById("loginView");
  const registerView = document.getElementById("registerView");
  const registerNameInput = document.getElementById("registerNameInput");
  const registerPinInput = document.getElementById("registerPinInput");
  const registerPinRepeatInput = document.getElementById("registerPinRepeatInput");
  const registerSessionPasswordInput = document.getElementById("registerSessionPasswordInput");

  if (authChoiceView) authChoiceView.classList.add("hidden");
  if (loginView) loginView.classList.add("hidden");
  if (registerView) registerView.classList.remove("hidden");

  if (registerNameInput) registerNameInput.value = "";
  if (registerPinInput) registerPinInput.value = "";
  if (registerPinRepeatInput) registerPinRepeatInput.value = "";
  if (registerSessionPasswordInput) registerSessionPasswordInput.value = "";

  setAuthRegisterStatus("");

  setTimeout(() => {
    registerNameInput?.focus();
  }, 0);
}

/* ============================================================
 * RPC-HELPER / SERVERSEITIGE FUNKTIONEN
 * ============================================================
 */

/**
 * Übersetzt rohe Fehlermeldungen der serverseitigen Funktionen
 * in benutzerfreundliche UI-Texte.
 */
function normalizeRpcError(error) {
  const raw = String(error?.message || error?.details || error || "").trim();

  switch (raw) {
    case "SESSION_PASSWORD_INVALID":
      return "Das Session-Passwort ist falsch.";
    case "DISPLAY_NAME_REQUIRED":
      return "Bitte einen gültigen Anzeigenamen eingeben.";
    case "USERNAME_REQUIRED":
      return "Bitte einen gültigen Namen eingeben.";
    case "USERNAME_INVALID":
      return "Der Name darf nur Kleinbuchstaben, Zahlen, - und _ enthalten.";
    case "USERNAME_TAKEN":
      return "Dieser Name ist bereits vergeben.";
    case "PASSWORD_REQUIRED":
      return "Bitte ein Passwort eingeben.";
    case "PASSWORD_TOO_SHORT":
      return `Das Passwort muss mindestens ${AUTH_MIN_PASSWORD_LENGTH} Zeichen lang sein.`;
    case "PASSWORDS_DO_NOT_MATCH":
      return "Die beiden Passwörter stimmen nicht überein.";
    case "LOGIN_INVALID":
      return "Name oder Passwort ist falsch.";
    case "USER_BLOCKED":
      return "Dieser Benutzer ist gesperrt.";
    case "ADMIN_PASSWORD_INVALID":
      return "Das Admin-Passwort ist falsch.";
    case "TARGET_USER_REQUIRED":
      return "Kein Zielspieler ausgewählt.";
    case "TARGET_USER_NOT_FOUND":
      return "Der Zielspieler wurde nicht gefunden.";
    default:
      return raw || "Unbekannter Fehler.";
  }
}

/**
 * RPC-Wrapper für die serverseitige Registrierung.
 */
async function rpcRegisterBingoUser({
  username,
  displayName,
  password,
  passwordRepeat,
  sessionPassword
}) {
  const { data, error } = await supabaseClient.rpc("register_bingo_user", {
    p_username: username,
    p_display_name: displayName,
    p_password: password,
    p_password_repeat: passwordRepeat,
    p_session_password: sessionPassword
  });

  if (error) {
    throw new Error(normalizeRpcError(error));
  }

  return data;
}

/**
 * RPC-Wrapper für den serverseitigen Login.
 */
async function rpcLoginBingoUser({ username, password }) {
  const { data, error } = await supabaseClient.rpc("login_bingo_user", {
    p_username: username,
    p_password: password
  });

  if (error) {
    throw new Error(normalizeRpcError(error));
  }

  return data;
}

/**
 * RPC-Wrapper zur Prüfung des Admin-Passworts.
 */
async function rpcVerifyAdminPassword({ adminUserId, password }) {
  const { data, error } = await supabaseClient.rpc("verify_bingo_admin_password", {
    p_admin_user_id: adminUserId,
    p_password: password
  });

  if (error) {
    throw new Error(normalizeRpcError(error));
  }

  return data === true;
}

/**
 * RPC-Wrapper zum serverseitigen Zurücksetzen eines Spielerpassworts.
 */
async function rpcAdminResetBingoUserPassword({
  adminUserId,
  adminPassword,
  targetUserId,
  newPassword,
  newPasswordRepeat
}) {
  const { data, error } = await supabaseClient.rpc("admin_reset_bingo_user_password", {
    p_admin_user_id: adminUserId,
    p_admin_password: adminPassword,
    p_target_user_id: targetUserId,
    p_new_password: newPassword,
    p_new_password_repeat: newPasswordRepeat
  });

  if (error) {
    throw new Error(normalizeRpcError(error));
  }

  return data === true;
}

async function rpcUpdateBingoSessionPassword({
  adminUserId,
  adminPassword,
  newSessionPassword,
  newSessionPasswordRepeat
}) {
  const { data, error } = await supabaseClient.rpc(
    "update_bingo_session_password",
    {
      p_admin_user_id: adminUserId,
      p_admin_password: adminPassword,
      p_new_session_password: newSessionPassword,
      p_new_session_password_repeat: newSessionPasswordRepeat
    }
  );

  if (error) {
    throw new Error(error.message || "Session-Passwort konnte nicht geändert werden.");
  }

  return !!data;
}


/* ============================================================
 * LOGIN / REGISTRIERUNG
 * ============================================================
 */

/**
 * Führt den Login aus und speichert die Session lokal.
 */
async function loginUser(username, password) {
  const cleanUsername = normalizeUsername(username);
  const cleanPassword = String(password || "");

  if (!cleanUsername) {
    throw new Error("Bitte einen gültigen Namen eingeben.");
  }

  if (!cleanPassword) {
    throw new Error("Bitte ein Passwort eingeben.");
  }

  const user = await rpcLoginBingoUser({
    username: cleanUsername,
    password: cleanPassword
  });

  const session = {
    user,
    createdAt: new Date().toISOString()
  };

  saveAuthSessionToLocalStorage(session);
  ensureAdminSwitchButtonOnGamePage();

  return user;
}

/**
 * Führt die Registrierung aus und speichert danach direkt die Session.
 */
async function registerUser({
  username,
  password,
  passwordRepeat,
  sessionPassword
}) {
  const displayName = cleanDisplayName(username);
  const cleanUsername = normalizeUsername(username);

  if (!displayName) {
    throw new Error("Bitte einen gültigen Namen eingeben.");
  }

  const user = await rpcRegisterBingoUser({
    username: cleanUsername,
    displayName,
    password,
    passwordRepeat,
    sessionPassword
  });

  const session = {
    user,
    createdAt: new Date().toISOString()
  };

  saveAuthSessionToLocalStorage(session);
  saveAuthPreferredView(AUTH_VIEW_GAME);
  ensureAdminSwitchButtonOnGamePage();

  return user;
}

/* ============================================================
 * ADMIN-AUSWAHL-MODAL
 * ============================================================
 */

/**
 * Öffnet das Overlay für die Admin-Zielauswahl.
 */
function openAdminChoiceOverlay() {
  const overlay = document.getElementById("authAdminChoiceOverlay");
  if (overlay) overlay.classList.remove("hidden");
}

/**
 * Schließt das Overlay für die Admin-Zielauswahl.
 */
function closeAdminChoiceOverlay() {
  const overlay = document.getElementById("authAdminChoiceOverlay");
  if (overlay) overlay.classList.add("hidden");
}

/**
 * Fragt einen Admin nach dem Login,
 * ob Spiel oder Adminpanel geöffnet werden soll.
 */
function askAdminTargetView() {
  return new Promise((resolve) => {
    const gameBtn = document.getElementById("authAdminChooseGameBtn");
    const adminBtn = document.getElementById("authAdminChooseAdminBtn");

    const finish = (view) => {
      closeAdminChoiceOverlay();
      resolve(view);
    };

    if (gameBtn) gameBtn.onclick = () => finish(AUTH_VIEW_GAME);
    if (adminBtn) adminBtn.onclick = () => finish(AUTH_VIEW_ADMIN);

    openAdminChoiceOverlay();
  });
}

/* ============================================================
 * ADMIN-PASSWORT-BESTÄTIGUNG
 * vorbereitet für harte Admin-Aktionen
 * ============================================================
 */

/**
 * Öffnet das Overlay zur Admin-Passwortbestätigung.
 */
function openAdminPasswordConfirmOverlay() {
  const overlay = document.getElementById("authAdminPasswordOverlay");
  const input = document.getElementById("authAdminPasswordInput");
  const status = document.getElementById("authAdminPasswordStatusText");

  if (status) status.textContent = "";
  if (input) input.value = "";
  if (overlay) overlay.classList.remove("hidden");

  setTimeout(() => input?.focus(), 0);
}

/**
 * Schließt das Overlay zur Admin-Passwortbestätigung.
 */
function closeAdminPasswordConfirmOverlay() {
  const overlay = document.getElementById("authAdminPasswordOverlay");
  if (overlay) overlay.classList.add("hidden");
}

/**
 * Führt eine Admin-Passwortabfrage aus und gibt true/false zurück.
 */
async function requireAdminPassword() {
  if (!isAdminUser()) {
    throw new Error("Nur für Admins erlaubt.");
  }

  return new Promise((resolve) => {
    const input = document.getElementById("authAdminPasswordInput");
    const status = document.getElementById("authAdminPasswordStatusText");
    const cancelBtn = document.getElementById("authAdminPasswordCancelBtn");
    const confirmBtn = document.getElementById("authAdminPasswordConfirmBtn");

    const cleanup = () => {
      if (input) input.onkeydown = null;
      if (cancelBtn) cancelBtn.onclick = null;
      if (confirmBtn) confirmBtn.onclick = null;
    };

    const cancel = () => {
      cleanup();
      closeAdminPasswordConfirmOverlay();
      resolve(false);
    };

    const confirm = async () => {
      const password = String(input?.value || "");

      if (!password) {
        if (status) status.textContent = "Bitte das Admin-Passwort eingeben.";
        return;
      }

      if (status) status.textContent = "Prüfe...";

      try {
        const ok = await rpcVerifyAdminPassword({
          adminUserId: currentPlayer.id,
          password
        });

        if (!ok) {
          if (status) status.textContent = "Das Admin-Passwort ist falsch.";
          return;
        }

        cleanup();
        closeAdminPasswordConfirmOverlay();
        resolve(password);
      } catch (error) {
        if (status) status.textContent = error.message || "Prüfung fehlgeschlagen.";
      }
    };

    if (cancelBtn) cancelBtn.onclick = cancel;
    if (confirmBtn) confirmBtn.onclick = confirm;

    if (input) {
      input.onkeydown = async (event) => {
        if (event.key === "Enter") {
          await confirm();
        }
      };
    }

    openAdminPasswordConfirmOverlay();
  });
}

/* ============================================================
 * VORBEREITETER PASSWORT-RESET-FLOW FÜR SPIELER
 * ============================================================
 */

/**
 * Öffnet das Passwort-Reset-Overlay für Spieler.
 */
function openPreparedPlayerPasswordResetOverlay() {
  const overlay = document.getElementById("authPlayerPasswordResetOverlay");
  const input = document.getElementById("authPlayerPasswordResetInput");
  const repeat = document.getElementById("authPlayerPasswordResetRepeatInput");
  const status = document.getElementById("authPlayerPasswordResetStatusText");

  if (status) status.textContent = "";
  if (input) input.value = "";
  if (repeat) repeat.value = "";
  if (overlay) overlay.classList.remove("hidden");

  setTimeout(() => input?.focus(), 0);
}

/**
 * Schließt das Passwort-Reset-Overlay für Spieler.
 */
function closePreparedPlayerPasswordResetOverlay() {
  const overlay = document.getElementById("authPlayerPasswordResetOverlay");
  if (overlay) overlay.classList.add("hidden");
}

/**
 * Startet den vorbereiteten Reset-Flow:
 * - Admin bestätigt sein Passwort
 * - Spieler gibt sein neues Passwort selbst ein
 * - Passwort wird serverseitig geändert
 */
async function runPreparedAdminPasswordResetFlow(targetUserId) {
  if (!isAdminUser()) {
    throw new Error("Nur für Admins erlaubt.");
  }

  const cachedAdminPassword = await requireAdminPassword();
  if (!cachedAdminPassword) return false;

  return new Promise((resolve) => {
    const input = document.getElementById("authPlayerPasswordResetInput");
    const repeat = document.getElementById("authPlayerPasswordResetRepeatInput");
    const status = document.getElementById("authPlayerPasswordResetStatusText");
    const cancelBtn = document.getElementById("authPlayerPasswordResetCancelBtn");
    const confirmBtn = document.getElementById("authPlayerPasswordResetConfirmBtn");

    const cleanup = () => {
      if (cancelBtn) cancelBtn.onclick = null;
      if (confirmBtn) confirmBtn.onclick = null;
      if (input) input.onkeydown = null;
      if (repeat) repeat.onkeydown = null;
    };

    const cancel = () => {
      cleanup();
      closePreparedPlayerPasswordResetOverlay();
      resolve(false);
    };

    const confirm = async () => {
      const newPassword = String(input?.value || "");
      const newPasswordRepeat = String(repeat?.value || "");

      if (!newPassword || !newPasswordRepeat) {
        if (status) status.textContent = "Bitte beide Passwortfelder ausfüllen.";
        return;
      }

      if (newPassword.length < AUTH_MIN_PASSWORD_LENGTH) {
        if (status) status.textContent = `Mindestens ${AUTH_MIN_PASSWORD_LENGTH} Zeichen.`;
        return;
      }

      if (newPassword !== newPasswordRepeat) {
        if (status) status.textContent = "Die beiden Passwörter stimmen nicht überein.";
        return;
      }

      if (status) status.textContent = "Speichere neues Passwort...";

      try {
        const ok = await rpcAdminResetBingoUserPassword({
          adminUserId: currentPlayer.id,
          adminPassword: cachedAdminPassword,
          targetUserId,
          newPassword,
          newPasswordRepeat
        });

        if (!ok) {
          if (status) status.textContent = "Passwort konnte nicht geändert werden.";
          return;
        }

        cleanup();
        closePreparedPlayerPasswordResetOverlay();
        resolve(true);
      } catch (error) {
        if (status) status.textContent = error.message || "Passwort konnte nicht geändert werden.";
      }
    };

    if (cancelBtn) cancelBtn.onclick = cancel;
    if (confirmBtn) confirmBtn.onclick = confirm;

    if (input) {
      input.onkeydown = async (event) => {
        if (event.key === "Enter") {
          await confirm();
        }
      };
    }

    if (repeat) {
      repeat.onkeydown = async (event) => {
        if (event.key === "Enter") {
          await confirm();
        }
      };
    }

    openPreparedPlayerPasswordResetOverlay();
  });
}

/* ============================================================
 * ZENTRALER AUTH-FLOW IM LOGIN-OVERLAY
 * ============================================================
 */

/**
 * Öffnet den gesamten Auth-Flow:
 * - Login / Registrierung
 * - Admin-Auswahl nach Login
 * - Rückgabe eines strukturierten Ergebnisses für den App-Start
 */
async function openUnifiedAuthFlow() {
  setupAuthDom();
  openLoginOverlay();

  return new Promise((resolve) => {
    const showLoginBtn = document.getElementById("showLoginBtn");
    const showRegisterBtn = document.getElementById("showRegisterBtn");
    const backToChoiceFromLoginBtn = document.getElementById("backToChoiceFromLoginBtn");
    const backToChoiceFromRegisterBtn = document.getElementById("backToChoiceFromRegisterBtn");
    const doLoginBtn = document.getElementById("doLoginBtn");
    const doRegisterBtn = document.getElementById("doRegisterBtn");

    const loginNameInput = document.getElementById("loginNameInput");
    const loginPinInput = document.getElementById("loginPinInput");

    const registerNameInput = document.getElementById("registerNameInput");
    const registerPinInput = document.getElementById("registerPinInput");
    const registerPinRepeatInput = document.getElementById("registerPinRepeatInput");
    const registerSessionPasswordInput = document.getElementById("registerSessionPasswordInput");

    const finish = (result) => {
      closeLoginOverlay();
      ensureAdminSwitchButtonOnGamePage();
      resolve(result);
    };

    const handleLogin = async () => {
      setAuthLoginStatus("Prüfe Login...");

      try {
        const user = await loginUser(
          loginNameInput?.value || "",
          loginPinInput?.value || ""
        );

        if (user.role === "admin" && isGamePage()) {
          const view = await askAdminTargetView();
          saveAuthPreferredView(view);

          if (view === AUTH_VIEW_ADMIN) {
            finish({
              allowed: false,
              mode: "login",
              redirectTo: AUTH_VIEW_ADMIN,
              user
            });
            return;
          }
        } else {
          saveAuthPreferredView(AUTH_VIEW_GAME);
        }

        finish({
          allowed: true,
          mode: "login",
          justRegistered: false,
          redirectTo: null,
          user
        });
      } catch (error) {
        setAuthLoginStatus(error.message || "Login fehlgeschlagen.");
      }
    };

    const handleRegister = async () => {
      setAuthRegisterStatus("Erstelle Spieler...");

      try {
        const user = await registerUser({
          username: registerNameInput?.value || "",
          password: registerPinInput?.value || "",
          passwordRepeat: registerPinRepeatInput?.value || "",
          sessionPassword: registerSessionPasswordInput?.value || ""
        });

        finish({
          allowed: true,
          mode: "register",
          justRegistered: true,
          redirectTo: null,
          user
        });
      } catch (error) {
        setAuthRegisterStatus(error.message || "Registrierung fehlgeschlagen.");
      }
    };

    if (showLoginBtn) showLoginBtn.onclick = showLoginView;
    if (showRegisterBtn) showRegisterBtn.onclick = showRegisterView;
    if (backToChoiceFromLoginBtn) backToChoiceFromLoginBtn.onclick = showAuthChoiceView;
    if (backToChoiceFromRegisterBtn) backToChoiceFromRegisterBtn.onclick = showAuthChoiceView;
    if (doLoginBtn) doLoginBtn.onclick = handleLogin;
    if (doRegisterBtn) doRegisterBtn.onclick = handleRegister;

    if (loginNameInput) {
      loginNameInput.onkeydown = async (event) => {
        if (event.key === "Enter") await handleLogin();
      };
    }

    if (loginPinInput) {
      loginPinInput.onkeydown = async (event) => {
        if (event.key === "Enter") await handleLogin();
      };
    }

    if (registerNameInput) {
      registerNameInput.onkeydown = async (event) => {
        if (event.key === "Enter") await handleRegister();
      };
    }

    if (registerPinInput) {
      registerPinInput.onkeydown = async (event) => {
        if (event.key === "Enter") await handleRegister();
      };
    }

    if (registerPinRepeatInput) {
      registerPinRepeatInput.onkeydown = async (event) => {
        if (event.key === "Enter") await handleRegister();
      };
    }

    if (registerSessionPasswordInput) {
      registerSessionPasswordInput.onkeydown = async (event) => {
        if (event.key === "Enter") await handleRegister();
      };
    }
  });
}

/* ============================================================
 * ROUTING / BOOTSTRAP
 * ============================================================
 */

/**
 * Leitet bewusst in die Spielansicht.
 */
function redirectToGameView() {
  saveAuthPreferredView(AUTH_VIEW_GAME);
  localStorage.setItem(AUTH_FORCE_GAME_VIEW_KEY, "true");
  window.location.href = "index.html";
}

/**
 * Leitet bewusst ins Adminpanel.
 */
function redirectToAdminView() {
  saveAuthPreferredView(AUTH_VIEW_ADMIN);
  window.location.href = "admin.html";
}

/**
 * Bootstrap für die Spieleseite:
 * - DOM vorbereiten
 * - Session / Legacy migrieren
 * - ggf. Auth-Overlay öffnen
 * - ggf. Admin ins Panel umleiten
 */
async function authBootstrapForGamePage() {
  setupAuthDom();
  migrateLegacyAuthStorageIfPossible();

  const session = loadAuthSessionFromLocalStorage();

  if (!session?.user) {
    const authResult = await openUnifiedAuthFlow();

    if (authResult?.redirectTo === AUTH_VIEW_ADMIN) {
      redirectToAdminView();
      return { allowed: false };
    }

    currentPlayer = authResult?.user || null;
    ensureAdminSwitchButtonOnGamePage();

    return {
      allowed: true,
      justRegistered: authResult?.justRegistered === true,
      user: currentPlayer
    };
  }

  currentPlayer = session.user;

  const forceGameView = localStorage.getItem(AUTH_FORCE_GAME_VIEW_KEY) === "true";

  if (forceGameView) {
    localStorage.removeItem(AUTH_FORCE_GAME_VIEW_KEY);
    saveAuthPreferredView(AUTH_VIEW_GAME);
  } else if (isAdminUser(currentPlayer) && loadAuthPreferredView() === AUTH_VIEW_ADMIN) {
    redirectToAdminView();
    return { allowed: false };
  }

  ensureAdminSwitchButtonOnGamePage();

  return {
    allowed: true,
    justRegistered: false,
    user: currentPlayer
  };
}

/**
 * Bootstrap für die Adminseite:
 * - Session laden
 * - nur Admins zulassen
 * - sonst zurück zur Spieleseite
 */
async function authBootstrapForAdminPage() {
  setupAuthDom();
  migrateLegacyAuthStorageIfPossible();

  const session = loadAuthSessionFromLocalStorage();

  if (!session?.user) {
    redirectToGameView();
    return { allowed: false };
  }

  currentPlayer = session.user;

  if (!isAdminUser(currentPlayer)) {
    redirectToGameView();
    return { allowed: false };
  }

  saveAuthPreferredView(AUTH_VIEW_ADMIN);

  return {
    allowed: true,
    user: currentPlayer
  };
}

/* ============================================================
 * LOGOUT
 * ============================================================
 */

/**
 * Zentrale Logout-Funktion.
 * Löscht Session + View-State und leitet anschließend um.
 */
async function authLogout({ redirectTo = AUTH_VIEW_GAME } = {}) {
  if (typeof logoutPlayerPushService === "function") {
  logoutPlayerPushService().catch(error => {
    console.warn("Push-Logout fehlgeschlagen, normaler Logout wird trotzdem fortgesetzt:", error);
  });
}

  clearAuthSessionFromLocalStorage();
  clearAuthPreferredView();
  clearLegacyAuthStorage();

  if (typeof resetLiveChallengeState === "function") {
    resetLiveChallengeState();
  }

  if (redirectTo === AUTH_VIEW_ADMIN) {
    window.location.href = "admin.html";
    return;
  }

  window.location.href = "index.html";
}

/**
 * Wrapper für Logout aus der Spieleseite.
 */
function logoutPlayer() {
  authLogout({ redirectTo: AUTH_VIEW_GAME });
}

/**
 * Wrapper für Logout aus dem Adminpanel.
 */
function logoutAdmin() {
  authLogout({ redirectTo: AUTH_VIEW_GAME });
}

/* ============================================================
 * GÜLTIGKEITS- / SPERRPRÜFUNG DES AKTUELLEN SPIELERS
 * ============================================================
 */

/**
 * Lädt den aktuell eingeloggten Benutzer frisch aus der DB.
 */
async function loadCurrentPlayerFromDatabase() {
  if (!currentPlayer?.id) return null;

  const { data, error } = await supabaseClient
    .from("players")
    .select("id, username, display_name, role, is_blocked, created_at")
    .eq("id", currentPlayer.id)
    .maybeSingle();

  if (error) {
    console.error("Fehler beim Nachladen des aktuellen Spielers:", error);
    return null;
  }

  return data || null;
}

/** Verhindert doppelte Behandlung von gesperrten / gelöschten Spielern */
let blockedPlayerHandled = false;

/**
 * Prüft zyklisch, ob der aktuelle Spieler noch existiert und nicht gesperrt ist.
 */
async function checkCurrentPlayerStillAllowed() {
  if (!currentPlayer || blockedPlayerHandled) return true;

  const freshPlayer = await loadCurrentPlayerFromDatabase();

  if (!freshPlayer) {
    handleBlockedOrRemovedPlayer("Dein Spielerprofil ist nicht mehr verfügbar.");
    return false;
  }

  if (freshPlayer.is_blocked) {
    handleBlockedOrRemovedPlayer("Dein Spieler wurde durch einen Admin gesperrt.");
    return false;
  }

  currentPlayer = freshPlayer;
  saveAuthSessionToLocalStorage({
    user: freshPlayer,
    createdAt: currentSession?.createdAt || new Date().toISOString()
  });

  ensureAdminSwitchButtonOnGamePage();
  return true;
}

/**
 * Behandelt den Fall, dass der aktuelle Spieler gelöscht oder gesperrt wurde.
 * Schließt offene Overlays, löscht die Session und zeigt die Sperrinfo an.
 */
function handleBlockedOrRemovedPlayer(message) {
  if (blockedPlayerHandled) return;
  blockedPlayerHandled = true;

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
  } catch (error) {
    console.warn("Fehler beim Schließen von Overlays:", error);
  }

  clearAuthSessionFromLocalStorage();
  clearAuthPreferredView();
  clearLegacyAuthStorage();
  currentPlayer = null;

  const overlay = document.getElementById("blockedOverlay");
  const button = document.getElementById("blockedBackToLoginBtn");

  if (overlay) {
    overlay.classList.remove("hidden");
  } else {
    alert(message);
  }

  if (button) {
    button.onclick = () => {
      window.location.href = "index.html";
    };
  }
}