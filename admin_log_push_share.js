/**
 * ============================================================
 * admin_log_push_share.js
 * ============================================================
 *
 * Zweck:
 * - Hilfsfunktion, um einen Activity-Logeintrag als Push vorzubereiten.
 * - Der Logs-Tab wechselt in den Push-Tab und befüllt dort das Formular.
 * - Es wird nichts automatisch gesendet; der Admin kann Text/Zielgruppe prüfen.
 *
 * Erwartet:
 * - admin.js stellt activateAdminTabByName(tabName) bereit.
 * - admin_push.js stellt den Push-Tab bereit.
 */

async function prefillAdminPushFormFromLog(prefill = {}) {
  if (typeof activateAdminTabByName === "function") {
    await activateAdminTabByName("push");
  } else if (typeof initializeAdminPushTab === "function") {
    await initializeAdminPushTab();
  }

  const titleInput = document.getElementById("adminPushTitleInput");
  const messageInput = document.getElementById("adminPushMessageInput");
  const targetSelect = document.getElementById("adminPushTargetTypeSelect");
  const gameSelect = document.getElementById("adminPushGameSelect");
  const playerSelect = document.getElementById("adminPushPlayerSelect");
  const launchInput = document.getElementById("adminPushLaunchUrlInput");

  if (!titleInput || !messageInput || !targetSelect) {
    alert("Push-Formular konnte nicht gefunden werden.");
    return false;
  }

  titleInput.value = prefill.title || "";
  messageInput.value = prefill.message || "";
  targetSelect.value = prefill.targetType || (prefill.targetGameId ? "game" : "all");

  if (launchInput) {
    launchInput.value = prefill.launchUrl || "https://ingsi1v3r.github.io/Bingov2/";
  }

  if (typeof updateAdminPushTargetVisibility === "function") {
    updateAdminPushTargetVisibility();
  }

  if (gameSelect && prefill.targetGameId) {
    gameSelect.value = String(prefill.targetGameId);
  }

  if (playerSelect && prefill.targetPlayerId) {
    playerSelect.value = String(prefill.targetPlayerId);
  }

  window.adminPushPrefillMetadata = prefill.metadata || null;

  if (typeof updateAdminPushRecipientPreview === "function") {
    await updateAdminPushRecipientPreview();
  }

  if (typeof setAdminPushStatus === "function") {
    setAdminPushStatus(
      "Logeintrag wurde übernommen. Text und Zielgruppe können vor dem Senden noch angepasst werden.",
      "success"
    );
  }

  titleInput.focus();
  return true;
}
