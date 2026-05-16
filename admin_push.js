/**
 * ============================================================
 * admin_push.js
 * ============================================================
 *
 * Zweck:
 * - Push-Tab im Adminpanel
 * - manuelle Push-Nachrichten senden
 * - Empfaenger-Vorschau laden
 * - Push-Historie anzeigen
 * - Push-Einstellungen pro Spiel vorbereiten/speichern
 *
 * Wichtig:
 * - Der eigentliche Versand passiert serverseitig in der Supabase Edge Function
 *   send-push.
 * - Das Frontend sendet nur Zielgruppe + Inhalt, aber keine Empfaengerliste.
 */

/* ============================================================
 * STATE
 * ============================================================ */

let adminPushInitialized = false;
let adminPushGames = [];
let adminPushPlayers = [];
let adminPushHistory = [];
let adminPushSettings = null;
let adminPushPreviewCount = 0;
let adminPushSettingsSaveInProgress = false;
let adminPushSettingsLocalLockUntil = 0;

const ADMIN_PUSH_DEFAULT_LAUNCH_URL = "https://ingsi1v3r.github.io/Bingov2/";

const ADMIN_PUSH_SETTING_FIELDS = [
  {
    key: "push_live_created_enabled",
    label: "Neue Live-Challenge",
    description: "Push an alle Spieler des Spiels, wenn eine neue Live-Challenge startet."
  },
  {
    key: "push_live_finished_enabled",
    label: "Live-Challenge beendet",
    description: "Push an relevante Spieler, wenn eine Live-Challenge beendet wurde."
  },
  {
    key: "push_game_activated_enabled",
    label: "Spiel aktiviert",
    description: "Push, wenn ein Spiel aktiv/verfügbar geschaltet wird."
  },
  {
    key: "push_player_added_enabled",
    label: "Spieler hinzugefügt",
    description: "Push an einen Spieler, wenn er zu einem Spiel hinzugefügt wurde."
  },
  {
    key: "push_first_game_bingo_enabled",
    label: "Erstes Bingo im Spiel",
    description: "Push an alle Spieler des Spiels beim allerersten Bingo."
  },
  {
    key: "push_cooldown_finished_enabled",
    label: "Cooldown abgelaufen",
    description: "Push an den betroffenen Spieler, sobald sein Cooldown vorbei ist."
  }
];

/* ============================================================
 * INIT
 * ============================================================ */

async function initializeAdminPushTab() {
  ensureAdminPushLayout();

  if (!adminPushInitialized) {
    attachAdminPushEvents();
    adminPushInitialized = true;
  }

  await loadAdminPushData();
  renderAdminPushFormOptions();
  renderAdminPushSettings();
  renderAdminPushHistory();
  await updateAdminPushRecipientPreview();
}

function ensureAdminPushLayout() {
  const tabEl = document.getElementById("tab-push");
  if (!tabEl) return;

  if (document.getElementById("adminPushLayout")) return;

  tabEl.innerHTML = `
    <h2>Push</h2>

    <div id="adminPushLayout" class="admin-push-layout">
      <div class="admin-panel admin-push-panel">
        <div class="admin-panel-header">
          <h3>Manuelle Nachricht senden</h3>
        </div>

        <div class="admin-push-form-grid">
          <div class="admin-form-group admin-push-wide">
            <label for="adminPushTitleInput">Titel</label>
            <input id="adminPushTitleInput" type="text" placeholder="z. B. Treffpunkt" maxlength="80" />
          </div>

          <div class="admin-form-group admin-push-wide">
            <label for="adminPushMessageInput">Nachricht</label>
            <textarea id="adminPushMessageInput" rows="4" placeholder="Nachricht eingeben..."></textarea>
          </div>

          <div class="admin-form-group">
            <label for="adminPushTargetTypeSelect">Zielgruppe</label>
            <select id="adminPushTargetTypeSelect" class="admin-push-select">
              <option value="game">Alle Spieler eines Spiels</option>
              <option value="player">Einzelner Spieler</option>
              <option value="all">Alle Push-Spieler</option>
            </select>
          </div>

          <div class="admin-form-group" id="adminPushGameSelectWrap">
            <label for="adminPushGameSelect">Spiel</label>
            <select id="adminPushGameSelect" class="admin-push-select"></select>
          </div>

          <div class="admin-form-group hidden" id="adminPushPlayerSelectWrap">
            <label for="adminPushPlayerSelect">Spieler</label>
            <select id="adminPushPlayerSelect" class="admin-push-select"></select>
          </div>

          <div class="admin-form-group admin-push-wide">
            <label for="adminPushLaunchUrlInput">Launch URL</label>
            <input id="adminPushLaunchUrlInput" type="url" placeholder="https://..." />
          </div>
        </div>

        <div class="admin-push-preview-box">
          <div>
            <strong>Empfänger-Vorschau:</strong>
            <span id="adminPushRecipientPreview">-</span>
          </div>
          <button id="adminPushRefreshPreviewBtn" type="button" class="secondary-btn">Vorschau aktualisieren</button>
        </div>

        <p id="adminPushStatusText" class="admin-push-status"></p>

        <div class="admin-player-action-bar">
          <button id="adminPushSendBtn" type="button">Push senden</button>
          <button id="adminPushClearBtn" type="button" class="secondary-btn">Formular leeren</button>
        </div>
      </div>

      <div class="admin-panel admin-push-panel">
        <div class="admin-panel-header">
          <h3>Push-Einstellungen für aktuelles Spiel</h3>
        </div>

        <p class="admin-details-empty">
          Diese Einstellungen werden automatisch gespeichert, sobald du eine Option umschaltest.
        </p>

        <div id="adminPushSettingsList" class="admin-push-settings-list"></div>

        <p id="adminPushSettingsStatusText" class="admin-push-status"></p>

        <div class="admin-player-action-bar hidden">
          <button id="adminPushSaveSettingsBtn" type="button">Einstellungen speichern</button>
        </div>
      </div>

      <div class="admin-panel admin-push-panel admin-push-wide-panel">
        <div class="admin-panel-header admin-push-history-header">
          <h3>Push-Historie</h3>
          <button id="adminPushRefreshHistoryBtn" type="button" class="secondary-btn">Aktualisieren</button>
        </div>

        <div id="adminPushHistoryList">
          <p class="admin-details-empty">Historie wird geladen...</p>
        </div>
      </div>
    </div>
  `;
}

function attachAdminPushEvents() {
  document.getElementById("adminPushTargetTypeSelect")?.addEventListener("change", async () => {
    updateAdminPushTargetVisibility();
    await updateAdminPushRecipientPreview();
  });

  document.getElementById("adminPushGameSelect")?.addEventListener("change", updateAdminPushRecipientPreview);
  document.getElementById("adminPushPlayerSelect")?.addEventListener("change", updateAdminPushRecipientPreview);
  document.getElementById("adminPushRefreshPreviewBtn")?.addEventListener("click", updateAdminPushRecipientPreview);
  document.getElementById("adminPushRefreshHistoryBtn")?.addEventListener("click", async () => {
    await loadAdminPushHistory();
    renderAdminPushHistory();
  });

  document.getElementById("adminPushSendBtn")?.addEventListener("click", handleSendManualPush);
  document.getElementById("adminPushClearBtn")?.addEventListener("click", clearAdminPushForm);
  document.getElementById("adminPushSaveSettingsBtn")?.addEventListener("click", handleSavePushSettings);
}

/* ============================================================
 * DATA LOAD
 * ============================================================ */

async function loadAdminPushData() {
  await Promise.all([
    loadAdminPushGames(),
    loadAdminPushPlayers(),
    loadAdminPushSettings(),
    loadAdminPushHistory()
  ]);
}

async function loadAdminPushGames() {
  adminPushGames = await DataService.games.loadAll();
}

async function loadAdminPushPlayers() {
  adminPushPlayers = await DataService.players.loadAllSafe();
}

async function loadAdminPushSettings() {
  if (!adminCurrentGameId) {
    adminPushSettings = null;
    return;
  }

  if (adminPushSettings && Date.now() < adminPushSettingsLocalLockUntil) {
    return;
  }

  const { data, error } = await supabaseClient
    .from("game_push_settings")
    .select("*")
    .eq("game_id", adminCurrentGameId)
    .maybeSingle();

  if (error) {
    console.error("Fehler beim Laden der Push-Einstellungen:", error);
    adminPushSettings = null;
    return;
  }

  adminPushSettings = data || buildDefaultAdminPushSettings(adminCurrentGameId);
}

async function loadAdminPushHistory() {
  const { data, error } = await supabaseClient
    .from("push_notifications")
    .select(`
      *,
      game:target_game_id (
        id,
        name
      ),
      target_player:target_player_id (
        id,
        username,
        display_name
      ),
      admin_player:created_by_admin_id (
        id,
        username,
        display_name
      )
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Fehler beim Laden der Push-Historie:", error);
    adminPushHistory = [];
    return;
  }

  adminPushHistory = data || [];
}

function buildDefaultAdminPushSettings(gameId) {
  const settings = { game_id: gameId };
  ADMIN_PUSH_SETTING_FIELDS.forEach(field => {
    settings[field.key] = true;
  });
  return settings;
}

/* ============================================================
 * FORM / RENDERING
 * ============================================================ */

function renderAdminPushFormOptions() {
  const gameSelect = document.getElementById("adminPushGameSelect");
  const playerSelect = document.getElementById("adminPushPlayerSelect");
  const launchInput = document.getElementById("adminPushLaunchUrlInput");

  if (gameSelect) {
    const currentValue = gameSelect.value || String(adminCurrentGameId || "");
    gameSelect.innerHTML = "";

    adminPushGames.forEach(game => {
      const option = document.createElement("option");
      option.value = String(game.id);
      option.textContent = game.name || `Spiel ${game.id}`;
      if (String(game.id) === String(currentValue)) option.selected = true;
      gameSelect.appendChild(option);
    });
  }

  if (playerSelect) {
    const currentValue = playerSelect.value;
    playerSelect.innerHTML = `<option value="">Spieler auswählen...</option>`;

    adminPushPlayers.forEach(player => {
      const option = document.createElement("option");
      option.value = String(player.id);
      option.textContent = player.display_name || player.username || `Spieler ${player.id}`;
      if (String(player.id) === String(currentValue)) option.selected = true;
      playerSelect.appendChild(option);
    });
  }

  if (launchInput && !launchInput.value) {
    launchInput.value = ADMIN_PUSH_DEFAULT_LAUNCH_URL;
  }

  updateAdminPushTargetVisibility();
}

function updateAdminPushTargetVisibility() {
  const targetType = getAdminPushTargetType();
  const gameWrap = document.getElementById("adminPushGameSelectWrap");
  const playerWrap = document.getElementById("adminPushPlayerSelectWrap");

  if (gameWrap) {
    gameWrap.classList.toggle("hidden", targetType !== "game");
  }

  if (playerWrap) {
    playerWrap.classList.toggle("hidden", targetType !== "player");
  }
}

function renderAdminPushSettings() {
  const list = document.getElementById("adminPushSettingsList");
  if (!list) return;

  if (!adminCurrentGameId) {
    list.innerHTML = `<p class="admin-details-empty">Kein Spiel ausgewählt.</p>`;
    return;
  }

  const settings = adminPushSettings || buildDefaultAdminPushSettings(adminCurrentGameId);

  list.innerHTML = ADMIN_PUSH_SETTING_FIELDS.map(field => `
    <label class="admin-push-setting-card">
      <input
        type="checkbox"
        class="admin-push-setting-checkbox"
        data-setting-key="${field.key}"
        ${settings[field.key] !== false ? "checked" : ""}
      />
      <div>
        <div class="admin-push-setting-title">${field.label}</div>
        <div class="admin-push-setting-description">${field.description}</div>
      </div>
    </label>
  `).join("");

  attachAdminPushSettingAutoSaveEvents();
}

function renderAdminPushHistory() {
  const list = document.getElementById("adminPushHistoryList");
  if (!list) return;

  if (!adminPushHistory.length) {
    list.innerHTML = `<p class="admin-details-empty">Noch keine Push-Nachrichten gesendet.</p>`;
    return;
  }

  list.innerHTML = `
    <div class="admin-push-history-list">
      ${adminPushHistory.map(renderAdminPushHistoryRow).join("")}
    </div>
  `;

  attachAdminPushHistoryDeleteEvents();
}

function renderAdminPushHistoryRow(row) {
  const title = escapeAdminPushHtml(row.title || "-");
  const message = escapeAdminPushHtml(row.message || "-");
  const statusClass = row.status === "failed" ? "failed" : "sent";
  const targetLabel = getAdminPushTargetLabel(row);
  const adminName = row.admin_player
    ? (row.admin_player.display_name || row.admin_player.username || `Admin ${row.created_by_admin_id}`)
    : "-";

  return `
    <div class="admin-push-history-row ${statusClass}">
      <button
        type="button"
        class="admin-push-history-delete-btn"
        data-push-id="${row.id}"
        title="Historieneintrag löschen"
        aria-label="Historieneintrag löschen"
      >🗑</button>

      <div class="admin-push-history-main">
        <div class="admin-push-history-title-row">
          <strong>${title}</strong>
          <span class="admin-badge ${statusClass === "failed" ? "blocked" : "ingame"}">${row.status || "sent"}</span>
        </div>
        <div class="admin-push-history-message">${message}</div>
        ${row.error_message ? `<div class="admin-push-history-error">${escapeAdminPushHtml(row.error_message)}</div>` : ""}
      </div>
      <div class="admin-push-history-meta">
        <div>${formatAdminDateTime(row.created_at)}</div>
        <div>Typ: ${escapeAdminPushHtml(row.type || "manual")}</div>
        <div>Ziel: ${escapeAdminPushHtml(targetLabel)}</div>
        <div>Empfänger: ${row.target_count ?? 0}</div>
        <div>Admin: ${escapeAdminPushHtml(adminName)}</div>
        ${row.onesignal_notification_id ? `<div class="admin-push-history-id">OneSignal: ${escapeAdminPushHtml(row.onesignal_notification_id)}</div>` : ""}
      </div>
    </div>
  `;
}

function getAdminPushTargetLabel(row) {
  if (!row) return "-";

  if (row.target_type === "all") return "Alle Push-Spieler";
  if (row.target_type === "game") return row.game?.name || `Spiel ${row.target_game_id || "?"}`;
  if (row.target_type === "player") {
    const playerName = row.target_player?.display_name || row.target_player?.username;
    return playerName || `Spieler ${row.target_player_id || "?"}`;
  }

  return row.target_type || "-";
}

/* ============================================================
 * RECIPIENT PREVIEW
 * ============================================================ */

async function updateAdminPushRecipientPreview() {
  const previewEl = document.getElementById("adminPushRecipientPreview");
  if (previewEl) previewEl.textContent = "lade...";

  try {
    adminPushPreviewCount = await loadAdminPushRecipientPreviewCount();
    if (previewEl) {
      previewEl.textContent = `${adminPushPreviewCount} Spieler mit aktiviertem Push`;
    }
  } catch (error) {
    console.error("Fehler bei Push-Empfänger-Vorschau:", error);
    adminPushPreviewCount = 0;
    if (previewEl) previewEl.textContent = "Vorschau konnte nicht geladen werden.";
  }
}

async function loadAdminPushRecipientPreviewCount() {
  const targetType = getAdminPushTargetType();

  if (targetType === "all") {
    const { count, error } = await supabaseClient
      .from("player_push_preferences")
      .select("player_id", { count: "exact", head: true })
      .eq("push_enabled", true)
      .not("external_id", "is", null);

    if (error) throw error;
    return count || 0;
  }

  if (targetType === "player") {
    const playerId = getAdminPushTargetPlayerId();
    if (!playerId) return 0;

    const { data, error } = await supabaseClient
      .from("player_push_preferences")
      .select("player_id")
      .eq("player_id", playerId)
      .eq("push_enabled", true)
      .not("external_id", "is", null)
      .maybeSingle();

    if (error) throw error;
    return data ? 1 : 0;
  }

  if (targetType === "game") {
    const gameId = getAdminPushTargetGameId();
    if (!gameId) return 0;

    const { data: stateRows, error: stateError } = await supabaseClient
      .from("player_game_state")
      .select("player_id")
      .eq("game_id", gameId);

    if (stateError) throw stateError;

    const playerIds = [...new Set((stateRows || []).map(row => row.player_id).filter(Boolean))];
    if (!playerIds.length) return 0;

    const { count, error } = await supabaseClient
      .from("player_push_preferences")
      .select("player_id", { count: "exact", head: true })
      .in("player_id", playerIds)
      .eq("push_enabled", true)
      .not("external_id", "is", null);

    if (error) throw error;
    return count || 0;
  }

  return 0;
}

/* ============================================================
 * SEND / SAVE
 * ============================================================ */

async function handleSendManualPush() {
  const statusEl = document.getElementById("adminPushStatusText");
  const sendBtn = document.getElementById("adminPushSendBtn");

  const payload = buildManualPushPayload();

  if (!payload.title || !payload.message) {
    setAdminPushStatus("Bitte Titel und Nachricht eingeben.", "error");
    return;
  }

  if (payload.targetType === "game" && !payload.targetGameId) {
    setAdminPushStatus("Bitte ein Spiel auswählen.", "error");
    return;
  }

  if (payload.targetType === "player" && !payload.targetPlayerId) {
    setAdminPushStatus("Bitte einen Spieler auswählen.", "error");
    return;
  }

  const confirmed = confirm(`Push wirklich an ${adminPushPreviewCount} Empfänger senden?`);
  if (!confirmed) return;

  try {
    if (sendBtn) sendBtn.disabled = true;
    if (statusEl) statusEl.textContent = "Sende Push...";

    const { data, error } = await supabaseClient.functions.invoke("send-push", {
      body: payload
    });

    if (error) {
      throw error;
    }

    if (!data?.ok) {
      throw new Error(data?.error || "Push konnte nicht gesendet werden.");
    }

    setAdminPushStatus(`Push gesendet (${data.targetCount || 0} Empfänger).`, "success");

    await loadAdminPushHistory();
    renderAdminPushHistory();
  } catch (error) {
    console.error("Push-Versand fehlgeschlagen:", error);
    setAdminPushStatus(buildAdminPushErrorMessage(error, "Push-Versand fehlgeschlagen."), "error");
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

function buildManualPushPayload() {
  return {
    type: "manual",
    title: String(document.getElementById("adminPushTitleInput")?.value || "").trim(),
    message: String(document.getElementById("adminPushMessageInput")?.value || "").trim(),
    targetType: getAdminPushTargetType(),
    targetGameId: getAdminPushTargetType() === "game" ? getAdminPushTargetGameId() : null,
    targetPlayerId: getAdminPushTargetType() === "player" ? getAdminPushTargetPlayerId() : null,
    launchUrl: String(document.getElementById("adminPushLaunchUrlInput")?.value || "").trim() || ADMIN_PUSH_DEFAULT_LAUNCH_URL,
    createdByAdminId: adminPlayer?.id || null,
    metadata: {
      source: "admin_push_tab"
    }
  };
}

async function handleSavePushSettings({ silent = false } = {}) {
  if (!adminCurrentGameId) return null;

  const statusEl = document.getElementById("adminPushSettingsStatusText");

  const payload = {
    game_id: adminCurrentGameId,
    updated_at: new Date().toISOString()
  };

  document.querySelectorAll(".admin-push-setting-checkbox").forEach(input => {
    payload[input.dataset.settingKey] = input.checked === true;
  });

  try {
    adminPushSettingsSaveInProgress = true;

    if (statusEl && !silent) {
      statusEl.textContent = "Speichere...";
      statusEl.className = "admin-push-status";
    }

    const { data, error } = await supabaseClient
      .from("game_push_settings")
      .upsert(payload, { onConflict: "game_id" })
      .select()
      .single();

    if (error) throw error;

    adminPushSettings = data;
    adminPushSettingsLocalLockUntil = 0;

    if (statusEl) {
      statusEl.textContent = "Einstellungen automatisch gespeichert.";
      statusEl.className = "admin-push-status success";
    }

    return data;
  } catch (error) {
    console.error("Push-Einstellungen konnten nicht gespeichert werden:", error);

    if (statusEl) {
      statusEl.textContent = buildAdminPushErrorMessage(
        error,
        "Einstellungen konnten nicht gespeichert werden."
      );
      statusEl.className = "admin-push-status error";
    }

    return null;
  } finally {
    adminPushSettingsSaveInProgress = false;
  }
}

/* ============================================================
 * SETTINGS AUTOSAVE
 * ============================================================ */

function attachAdminPushSettingAutoSaveEvents() {
  document.querySelectorAll(".admin-push-setting-checkbox").forEach(input => {
    if (input.dataset.bound === "true") return;

    input.addEventListener("change", async () => {
      await handleAdminPushSettingChanged(input);
    });

    input.dataset.bound = "true";
  });
}

async function handleAdminPushSettingChanged(input) {
  if (!input || !adminCurrentGameId) return;

  const key = input.dataset.settingKey;
  if (!key) return;

  adminPushSettingsLocalLockUntil = Date.now() + 5000;

  adminPushSettings = {
    ...(adminPushSettings || buildDefaultAdminPushSettings(adminCurrentGameId)),
    game_id: adminCurrentGameId,
    [key]: input.checked === true
  };

  const statusEl = document.getElementById("adminPushSettingsStatusText");
  if (statusEl) {
    statusEl.textContent = "Speichere Änderung...";
    statusEl.className = "admin-push-status";
  }

  await handleSavePushSettings({ silent: true });
}



/* ============================================================
 * HISTORY DELETE
 * ============================================================ */

function attachAdminPushHistoryDeleteEvents() {
  document.querySelectorAll(".admin-push-history-delete-btn").forEach(btn => {
    if (btn.dataset.bound === "true") return;

    btn.addEventListener("click", async (event) => {
      event.stopPropagation();

      const pushId = Number(btn.dataset.pushId);
      if (!pushId) return;

      await handleDeleteAdminPushHistoryEntry(pushId);
    });

    btn.dataset.bound = "true";
  });
}

async function handleDeleteAdminPushHistoryEntry(pushId) {
  const confirmed = confirm(
    "Diesen Push-Historieneintrag wirklich löschen?\n\nDie bereits versendete Push-Nachricht wird dadurch nicht zurückgerufen."
  );

  if (!confirmed) return;

  try {
    const { error } = await supabaseClient
      .from("push_notifications")
      .delete()
      .eq("id", pushId);

    if (error) {
      throw error;
    }

    adminPushHistory = adminPushHistory.filter(row => Number(row.id) !== Number(pushId));
    renderAdminPushHistory();
    setAdminPushStatus("Historieneintrag gelöscht.", "success");
  } catch (error) {
    console.error("Push-Historieneintrag konnte nicht gelöscht werden:", error);
    setAdminPushStatus(
      buildAdminPushErrorMessage(error, "Historieneintrag konnte nicht gelöscht werden."),
      "error"
    );
  }
}

function buildAdminPushErrorMessage(error, fallback = "Aktion fehlgeschlagen.") {
  const raw = String(
    error?.message ||
    error?.context?.error ||
    error?.details ||
    error?.hint ||
    error ||
    ""
  ).trim();

  if (!raw) return fallback;

  if (raw.includes("Failed to fetch")) {
    return "Verbindung zur Edge Function fehlgeschlagen. Bitte Internetverbindung und Supabase-Deploy prüfen.";
  }

  if (raw.includes("non-2xx")) {
    return "Edge Function hat einen Fehler zurückgegeben. Details stehen in der Push-Historie oder in den Supabase Function Logs.";
  }

  if (raw.includes("permission denied") || raw.includes("RLS")) {
    return "Keine Berechtigung für diese Aktion. Prüfe Supabase/RLS bzw. Tabellenrechte.";
  }

  return raw;
}

/* ============================================================
 * SMALL HELPERS
 * ============================================================ */

function getAdminPushTargetType() {
  return document.getElementById("adminPushTargetTypeSelect")?.value || "game";
}

function getAdminPushTargetGameId() {
  const value = document.getElementById("adminPushGameSelect")?.value;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function getAdminPushTargetPlayerId() {
  const value = document.getElementById("adminPushPlayerSelect")?.value;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function clearAdminPushForm() {
  const titleInput = document.getElementById("adminPushTitleInput");
  const messageInput = document.getElementById("adminPushMessageInput");
  const launchInput = document.getElementById("adminPushLaunchUrlInput");

  if (titleInput) titleInput.value = "";
  if (messageInput) messageInput.value = "";
  if (launchInput) launchInput.value = ADMIN_PUSH_DEFAULT_LAUNCH_URL;

  setAdminPushStatus("", "");
}

function setAdminPushStatus(text, type = "") {
  const statusEl = document.getElementById("adminPushStatusText");
  if (!statusEl) return;

  statusEl.textContent = text || "";
  statusEl.className = `admin-push-status ${type || ""}`.trim();
}

function escapeAdminPushHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
