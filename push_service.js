/**
 * ============================================================
 * push_service.js
 * ============================================================
 *
 * Phase 1 fuer Push-Benachrichtigungen:
 * - OneSignal nach Login mit Spieler-ID verknuepfen
 * - Push-Berechtigung bewusst per Button anfragen
 * - Push-Status in Supabase speichern
 * - Debug-Infos fuer Tests im Profil anzeigen / in Console ausgeben
 *
 * Noch NICHT enthalten:
 * - Versand echter Push-Nachrichten
 * - Edge Functions
 * - Admin-Broadcasts
 * - Event-Pushs fuer Live-Challenges / Bingos
 */

/* ============================================================
 * STATE
 * ============================================================ */

let playerPushServiceInitialized = false;
let playerPushRegistrationPromptPending = false;
let playerPushPreference = null;
let cachedOneSignalInstance = null;

/* ============================================================
 * INIT
 * ============================================================ */

async function initializePlayerPushService({ justRegistered = false } = {}) {
  if (!currentPlayer?.id) return;

  bindPlayerPushProfileButtons();
  bindPlayerPushPreferenceCheckboxes();

  const oneSignal = await getOneSignalSafe();

  if (oneSignal) {
    await loginCurrentPlayerToOneSignal(oneSignal);
  }

  await loadAndRenderPlayerPushPreference();

  if (oneSignal) {
    await syncOneSignalPushStateWithCurrentPreference(oneSignal);
    await loadAndRenderPlayerPushPreference();
  }

  playerPushRegistrationPromptPending = justRegistered === true;
  playerPushServiceInitialized = true;
}

async function getOneSignalSafe() {
  if (cachedOneSignalInstance) return cachedOneSignalInstance;

  if (!window.OneSignalDeferred) {
    console.warn("OneSignalDeferred ist nicht vorhanden. Push ist nicht verfuegbar.");
    return null;
  }

  return await new Promise((resolve) => {
    let resolved = false;

    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      cachedOneSignalInstance = value || null;
      resolve(cachedOneSignalInstance);
    };

    try {
      window.OneSignalDeferred.push(async function(OneSignal) {
        finish(OneSignal);
      });
    } catch (error) {
      console.warn("OneSignal konnte nicht geladen werden:", error);
      finish(null);
    }

    setTimeout(() => finish(null), 5000);
  });
}

async function loginCurrentPlayerToOneSignal(oneSignal) {
  if (!oneSignal || !currentPlayer?.id) return false;

  try {
    if (typeof oneSignal.login === "function") {
      await oneSignal.login(String(currentPlayer.id));
    }

    await savePlayerPushPreference({
      external_id: String(currentPlayer.id),
      permission_state: getPlayerPushPermissionState(oneSignal)
    });

    return true;
  } catch (error) {
    console.warn("OneSignal login/player binding fehlgeschlagen:", error);
    return false;
  }
}

async function logoutPlayerPushService() {
  try {
    const oneSignal = await getOneSignalSafe();

    if (oneSignal?.User?.PushSubscription?.optOut) {
      await oneSignal.User.PushSubscription.optOut();
    }

    if (oneSignal && typeof oneSignal.logout === "function") {
      await oneSignal.logout();
    }

    playerPushServiceInitialized = false;
    playerPushRegistrationPromptPending = false;
    playerPushPreference = null;
  } catch (error) {
    console.warn("OneSignal logout/optOut fehlgeschlagen:", error);
  }
}

/* ============================================================
 * PROFILE UI
 * ============================================================ */

function bindPlayerPushProfileButtons() {
  const enableBtn = document.getElementById("playerProfilePushEnableBtn");
  const disableBtn = document.getElementById("playerProfilePushDisableBtn");
  if (enableBtn && !enableBtn.dataset.pushBound) {
    enableBtn.addEventListener("click", async () => {
      await enablePlayerPushNotifications();
    });
    enableBtn.dataset.pushBound = "true";
  }

  if (disableBtn && !disableBtn.dataset.pushBound) {
    disableBtn.addEventListener("click", async () => {
      await disablePlayerPushNotifications();
    });
    disableBtn.dataset.pushBound = "true";
  }
}

async function loadAndRenderPlayerPushPreference() {
  if (!currentPlayer?.id) return;

  try {
    playerPushPreference = await DataService.pushPreferences.loadForPlayer(currentPlayer.id);
  } catch (error) {
    console.warn("Push-Einstellungen konnten nicht geladen werden:", error);
    playerPushPreference = null;
  }

  await renderPlayerPushProfileState();
  renderPlayerPushPreferenceCheckboxes();
}

async function syncOneSignalPushStateWithCurrentPreference(oneSignal = cachedOneSignalInstance) {
  if (!currentPlayer?.id || !oneSignal) return false;

  const shouldBeEnabled = playerPushPreference?.push_enabled === true;
  const permissionState = getPlayerPushPermissionState(oneSignal);

  try {
    if (!shouldBeEnabled) {
      if (oneSignal?.User?.PushSubscription?.optOut) {
        await oneSignal.User.PushSubscription.optOut();
      }

      await savePlayerPushPreference({
        push_enabled: false,
        permission_state: permissionState,
        external_id: String(currentPlayer.id),
        last_subscription_id: getPlayerPushSubscriptionId(oneSignal),
        disabled_at: playerPushPreference?.disabled_at || new Date().toISOString()
      });

      return true;
    }

    if (permissionState === "granted" && oneSignal?.User?.PushSubscription?.optIn) {
      await oneSignal.User.PushSubscription.optIn();

      await savePlayerPushPreference({
        push_enabled: true,
        permission_state: permissionState,
        external_id: String(currentPlayer.id),
        last_subscription_id: getPlayerPushSubscriptionId(oneSignal),
        enabled_at: playerPushPreference?.enabled_at || new Date().toISOString(),
        disabled_at: null
      });
    }

    return true;
  } catch (error) {
    console.warn("Push-Synchronisierung fehlgeschlagen:", error);
    return false;
  }
}

async function renderPlayerPushProfileState() {
  const statusEl = document.getElementById("playerPushStatusText");
  const enableBtn = document.getElementById("playerProfilePushEnableBtn");
  const disableBtn = document.getElementById("playerProfilePushDisableBtn");

  if (!statusEl || !enableBtn || !disableBtn) return;

  const oneSignal = await getOneSignalSafe();
  const browserSupported = isPlayerPushBrowserSupported();
  const permissionState = getPlayerPushPermissionState(oneSignal);
  const subscriptionId = getPlayerPushSubscriptionId(oneSignal);
  const pushEnabledInDb = playerPushPreference?.push_enabled === true;
  const isActuallySubscribed = isOneSignalPushOptedIn(oneSignal) || !!subscriptionId;

  statusEl.classList.remove("success", "warning", "error");

  if (!browserSupported) {
    statusEl.textContent = "Push wird von diesem Browser oder dieser Verbindung nicht unterstuetzt.";
    statusEl.classList.add("error");
    enableBtn.classList.remove("hidden");
    disableBtn.classList.add("hidden");
    return;
  }

  if (permissionState === "denied") {
    statusEl.textContent = "Push wurde im Browser blockiert. Du musst die Berechtigung in den Browser-/Website-Einstellungen wieder freigeben.";
    statusEl.classList.add("error");
    enableBtn.classList.remove("hidden");
    disableBtn.classList.add("hidden");
    return;
  }

  if (pushEnabledInDb && isActuallySubscribed) {
    statusEl.textContent = "Push ist fuer diesen Spieler aktiviert.";
    statusEl.classList.add("success");
    enableBtn.classList.add("hidden");
    disableBtn.classList.remove("hidden");
    return;
  }

  if (pushEnabledInDb && !isActuallySubscribed) {
    statusEl.textContent = "Push ist gespeichert, aber dieses Geraet ist noch nicht aktiv abonniert. Bitte erneut aktivieren.";
    statusEl.classList.add("warning");
    enableBtn.classList.remove("hidden");
    disableBtn.classList.remove("hidden");
    return;
  }

  statusEl.textContent = "Push ist fuer diesen Spieler noch nicht aktiviert.";
  statusEl.classList.add("warning");
  enableBtn.classList.remove("hidden");
  disableBtn.classList.add("hidden");
}


/* ============================================================
 * PLAYER PUSH PREFERENCE CHECKBOXES
 * ============================================================ */

const PLAYER_PUSH_PREFERENCE_DEFAULTS = {
  live_challenges_enabled: true,
  live_results_enabled: true,
  first_bingo_enabled: true,
  game_updates_enabled: true,
  cooldown_enabled: true,
  admin_messages_enabled: true
};

function bindPlayerPushPreferenceCheckboxes() {
  document.querySelectorAll(".player-push-pref-checkbox").forEach(input => {
    if (input.dataset.pushPrefBound === "true") return;

    input.addEventListener("change", async () => {
      await handlePlayerPushPreferenceChanged(input);
    });

    input.dataset.pushPrefBound = "true";
  });
}

function renderPlayerPushPreferenceCheckboxes() {
  const settingsBox = document.getElementById("playerPushPreferenceSettings");
  if (!settingsBox) return;

  const pushEnabled = playerPushPreference?.push_enabled === true;

  settingsBox.classList.toggle("hidden", !pushEnabled);

  document.querySelectorAll(".player-push-pref-checkbox").forEach(input => {
    const key = input.dataset.pushPrefKey;
    if (!key) return;

    const value = playerPushPreference?.[key];
    input.checked = value !== false;
    input.disabled = !pushEnabled;
  });
}

async function handlePlayerPushPreferenceChanged(input) {
  if (!input || !currentPlayer?.id) return;

  const key = input.dataset.pushPrefKey;
  if (!key) return;

  const statusEl = document.getElementById("playerPushPreferenceStatusText");

  try {
    input.disabled = true;

    if (statusEl) {
      statusEl.textContent = "Speichere...";
      statusEl.className = "player-push-preference-status";
    }

    const patch = {
      [key]: input.checked === true
    };

    // Live-Challenges werden bewusst zusammengefasst:
    // neue Live-Challenge + Live-Ergebnis/Ende.
    if (key === "live_challenges_enabled") {
      patch.live_results_enabled = input.checked === true;
    }

    playerPushPreference = await savePlayerPushPreference(patch);

    if (statusEl) {
      statusEl.textContent = "Einstellung gespeichert.";
      statusEl.className = "player-push-preference-status success";
    }
  } catch (error) {
    console.error("Push-Einstellung konnte nicht gespeichert werden:", error);

    if (statusEl) {
      statusEl.textContent = "Einstellung konnte nicht gespeichert werden.";
      statusEl.className = "player-push-preference-status error";
    }
  } finally {
    renderPlayerPushPreferenceCheckboxes();
  }
}

/* ============================================================
 * ENABLE / DISABLE
 * ============================================================ */

async function enablePlayerPushNotifications() {
  if (!currentPlayer?.id) return false;

  const statusEl = document.getElementById("playerPushStatusText");

  if (statusEl) {
    statusEl.textContent = "Aktiviere Push...";
    statusEl.classList.remove("success", "warning", "error");
  }

  const oneSignal = await getOneSignalSafe();

  if (!oneSignal) {
    await savePlayerPushPreference({
      push_enabled: false,
      permission_state: "unavailable",
      external_id: String(currentPlayer.id)
    });

    if (statusEl) {
      statusEl.textContent = "OneSignal ist nicht verfuegbar. Teste Push auf der HTTPS-GitHub-Pages-Seite.";
      statusEl.classList.add("error");
    }

    return false;
  }

  try {
    await loginCurrentPlayerToOneSignal(oneSignal);
    await requestOneSignalPushPermission(oneSignal);
    await optInOneSignalPush(oneSignal);

    const permissionState = getPlayerPushPermissionState(oneSignal);
    const subscriptionId = getPlayerPushSubscriptionId(oneSignal);
    const optedIn = isOneSignalPushOptedIn(oneSignal) || permissionState === "granted";

    playerPushPreference = await savePlayerPushPreference({
      push_enabled: optedIn,
      permission_state: permissionState,
      external_id: String(currentPlayer.id),
      last_subscription_id: subscriptionId,
      enabled_at: optedIn ? new Date().toISOString() : null,
      disabled_at: null,
      live_challenges_enabled: true,
      live_results_enabled: true,
      first_bingo_enabled: true,
      game_updates_enabled: true,
      admin_messages_enabled: true,
      cooldown_enabled: true
    });

    await renderPlayerPushProfileState();
    await debugPlayerPushState({ showAlert: false });

    return optedIn;
  } catch (error) {
    console.error("Push konnte nicht aktiviert werden:", error);

    await savePlayerPushPreference({
      push_enabled: false,
      permission_state: getPlayerPushPermissionState(oneSignal),
      external_id: String(currentPlayer.id)
    });

    if (statusEl) {
      statusEl.textContent = "Push konnte nicht aktiviert werden. Details stehen in der Console.";
      statusEl.classList.add("error");
    }

    return false;
  }
}

async function disablePlayerPushNotifications() {
  if (!currentPlayer?.id) return false;

  const oneSignal = await getOneSignalSafe();

  try {
    if (oneSignal?.User?.PushSubscription?.optOut) {
      await oneSignal.User.PushSubscription.optOut();
    }
  } catch (error) {
    console.warn("OneSignal optOut fehlgeschlagen:", error);
  }

  playerPushPreference = await savePlayerPushPreference({
    push_enabled: false,
    permission_state: getPlayerPushPermissionState(oneSignal),
    external_id: String(currentPlayer.id),
    last_subscription_id: getPlayerPushSubscriptionId(oneSignal),
    disabled_at: new Date().toISOString()
  });

  await renderPlayerPushProfileState();
  return true;
}

async function requestOneSignalPushPermission(oneSignal) {
  if (!oneSignal) return false;

  const permissionState = getPlayerPushPermissionState(oneSignal);

  if (permissionState === "granted") {
    return true;
  }

  if (permissionState === "denied") {
    return false;
  }

  if (oneSignal.Notifications?.requestPermission) {
    return await oneSignal.Notifications.requestPermission();
  }

  if (oneSignal.Slidedown?.promptPush) {
    await oneSignal.Slidedown.promptPush();
    return true;
  }

  return false;
}

async function optInOneSignalPush(oneSignal) {
  if (!oneSignal) return false;

  if (oneSignal.User?.PushSubscription?.optIn) {
    await oneSignal.User.PushSubscription.optIn();
    return true;
  }

  return true;
}

async function savePlayerPushPreference(fields = {}) {
  if (!currentPlayer?.id) return null;

  if (!DataService?.pushPreferences?.upsertForPlayer) {
    console.warn("DataService.pushPreferences fehlt.");
    return null;
  }

  return await DataService.pushPreferences.upsertForPlayer(currentPlayer.id, fields);
}

/* ============================================================
 * REGISTRATION PROMPT
 * ============================================================ */

function maybeShowPlayerPushRegistrationPrompt() {
  if (!playerPushRegistrationPromptPending) return;
  if (!currentPlayer?.id) return;

  playerPushRegistrationPromptPending = false;

  if (playerPushPreference?.push_enabled === true) return;

  openPlayerPushRegistrationPrompt();
}

function openPlayerPushRegistrationPrompt() {
  ensurePlayerPushRegistrationPrompt();

  const overlay = document.getElementById("playerPushPromptOverlay");
  overlay?.classList.remove("hidden");
}

function closePlayerPushRegistrationPrompt() {
  const overlay = document.getElementById("playerPushPromptOverlay");
  overlay?.classList.add("hidden");
}

function ensurePlayerPushRegistrationPrompt() {
  if (document.getElementById("playerPushPromptOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "playerPushPromptOverlay";
  overlay.className = "modal-overlay hidden";

  overlay.innerHTML = `
    <div class="modal">
      <h2>Push aktivieren?</h2>
      <div class="rules-content">
        <p>
          Du kannst Push-Benachrichtigungen fuer Live-Challenges und wichtige Spielereignisse aktivieren.
        </p>
        <p class="auth-hint">
          Du kannst das spaeter im Spielerprofil wieder deaktivieren.
        </p>
        <p id="playerPushPromptStatus" class="auth-hint"></p>
      </div>

      <div class="modal-actions">
        <button id="playerPushPromptLaterBtn" type="button" class="secondary-btn">Spaeter</button>
        <button id="playerPushPromptEnableBtn" type="button">Push aktivieren</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("playerPushPromptLaterBtn")?.addEventListener("click", () => {
    closePlayerPushRegistrationPrompt();
  });

  document.getElementById("playerPushPromptEnableBtn")?.addEventListener("click", async () => {
    const status = document.getElementById("playerPushPromptStatus");
    if (status) status.textContent = "Aktiviere Push...";

    const ok = await enablePlayerPushNotifications();

    if (ok) {
      if (status) status.textContent = "Push wurde aktiviert.";
      setTimeout(closePlayerPushRegistrationPrompt, 600);
    } else {
      if (status) status.textContent = "Push konnte nicht aktiviert werden. Du kannst es spaeter im Profil erneut versuchen.";
    }
  });
}

/* ============================================================
 * STATUS HELPERS
 * ============================================================ */

function isPlayerPushBrowserSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    (window.isSecureContext || location.hostname === "localhost" || location.hostname === "127.0.0.1")
  );
}

function getPlayerPushPermissionState(oneSignal = cachedOneSignalInstance) {
  try {
    if (oneSignal?.Notifications?.permissionNative) {
      return oneSignal.Notifications.permissionNative;
    }

    if (typeof Notification !== "undefined" && Notification.permission) {
      return Notification.permission;
    }
  } catch (_) {}

  return "unknown";
}

function getPlayerPushSubscriptionId(oneSignal = cachedOneSignalInstance) {
  try {
    const subscription = oneSignal?.User?.PushSubscription;

    if (!subscription) return null;

    return subscription.id || subscription.subscriptionId || null;
  } catch (_) {
    return null;
  }
}

function isOneSignalPushOptedIn(oneSignal = cachedOneSignalInstance) {
  try {
    const subscription = oneSignal?.User?.PushSubscription;

    if (!subscription) return false;

    if (typeof subscription.optedIn === "boolean") {
      return subscription.optedIn;
    }

    if (typeof subscription.isOptedIn === "boolean") {
      return subscription.isOptedIn;
    }
  } catch (_) {}

  return false;
}

async function debugPlayerPushState({ showAlert = false } = {}) {
  const oneSignal = await getOneSignalSafe();

  const debug = {
    currentPlayerId: currentPlayer?.id || null,
    oneSignalAvailable: !!oneSignal,
    browserSupported: isPlayerPushBrowserSupported(),
    permissionState: getPlayerPushPermissionState(oneSignal),
    externalId: currentPlayer?.id ? String(currentPlayer.id) : null,
    subscriptionId: getPlayerPushSubscriptionId(oneSignal),
    optedIn: isOneSignalPushOptedIn(oneSignal),
    preference: playerPushPreference
  };

  console.log("Push Debug:", debug);

  if (showAlert) {
    alert(JSON.stringify(debug, null, 2));
  }

  return debug;
}
