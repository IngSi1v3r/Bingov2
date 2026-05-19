/**
 * ============================================================
 * admin_games_setup_wizard.js
 * ============================================================
 *
 * Zweck:
 * Ausgelagerter Challenge-Setup-Wizard fuer den "Spiele"-Tab
 * im Adminpanel.
 *
 * Diese Datei enthaelt nur den Wizard zum schrittweisen Befuellen
 * von Aufgaben nach dem Erstellen eines Spiels oder beim Pruefen
 * unvollstaendiger Aufgaben.
 *
 * Enthaltene Hauptfunktionen:
 *
 * 1) Wizard-State
 *    - aktuelles Spiel
 *    - Liste der zu bearbeitenden Positionen
 *    - aktueller Schritt
 *
 * 2) Modal-Aufbau
 *    - Formular fuer Titel, Beschreibung, Hinweise, Punkte, Varianten,
 *      Kategorie, Fotopflicht, Aktivstatus und Aufgabenbild
 *
 * 3) Wizard-Ablauf
 *    - Starten
 *    - aktuellen Schritt rendern
 *    - Speichern & weiter
 *    - Zurueck
 *    - Ueberspringen
 *    - Spaeter fertigstellen
 *    - Werte auf restliche Aufgaben anwenden
 *
 * 4) Aufgabenbild im Wizard
 *    - vorhandenes Bild anzeigen
 *    - neues Bild hochladen
 *    - vorhandenes Bild entfernen
 *
 * Abhaengigkeiten:
 * - Diese Datei wird zusammen mit admin_games.js genutzt.
 * - Sie verwendet globale Funktionen und Variablen aus admin_games.js,
 *   admin.js und data_service.js, insbesondere:
 *   adminGames, adminChallenges, updateAdminChallengeFields(),
 *   loadAllChallengesForAdminDetailed(), initializeAdminGamesTab(),
 *   getAdminChallengeImagePublicUrl(), uploadAdminChallengeImageFile().
 *
 * Einbindung:
 * - In admin.html nach admin_games.js und vor admin.js oder zumindest
 *   vor dem ersten Aufruf von initializeAdminGamesTab() einbinden.
 */

/* ============================================================
 * STATE
 * ============================================================
 */

/** Aktuelles Spiel im Challenge-Setup-Wizard */
let adminChallengeSetupGameId = null;

/** Positionen, die im Wizard bearbeitet werden */
let adminChallengeSetupPositions = [];

/** Aktueller Index innerhalb der Positionsliste */
let adminChallengeSetupIndex = 0;

/* ============================================================
 * CHALLENGE-SETUP-WIZARD
 * ============================================================ */

/** Baut das Setup-Modal einmalig auf */
function ensureAdminChallengeSetupModal() {
  if (document.getElementById("adminChallengeSetupOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "adminChallengeSetupOverlay";
  overlay.className = "modal-overlay hidden";

  overlay.innerHTML = `
    <div class="modal">
      <button id="closeAdminChallengeSetupBtn" class="modal-close-btn" type="button">×</button>

      <h2 id="adminChallengeSetupTitle">Aufgabe bearbeiten</h2>

      <div class="admin-setup-progress-wrap">
        <div class="admin-setup-progress-bar">
          <div id="adminChallengeSetupProgressFill" class="admin-setup-progress-fill" style="width: 0%;"></div>
        </div>
        <div id="adminChallengeSetupProgress" class="admin-setup-progress-meta">Aufgabe 1 / 25</div>
        <div id="adminChallengeSetupPositionBadge" class="admin-setup-position-badge">Position 1</div>
      </div>

      <div class="rules-content">
        <div class="admin-form-group">
          <label for="adminSetupChallengeTitleInput">Name</label>
          <input id="adminSetupChallengeTitleInput" type="text" placeholder="Titel der Aufgabe" />
        </div>

        <div class="admin-form-group">
          <label for="adminSetupChallengeTaskInput">Beschreibung</label>
          <textarea id="adminSetupChallengeTaskInput" class="admin-text-edit-textarea" style="min-height: 120px;" placeholder="Beschreibung der Aufgabe"></textarea>
        </div>

        <div class="admin-form-group">
          <label for="adminSetupChallengeDetailsInput">Hinweise</label>
          <textarea id="adminSetupChallengeDetailsInput" class="admin-text-edit-textarea" style="min-height: 100px;" placeholder="Optionaler Hinweistext"></textarea>
        </div>

        <div class="admin-form-group">
          <label for="adminSetupChallengeSuccessInput">Congratulation Text</label>
          <textarea id="adminSetupChallengeSuccessInput" class="admin-text-edit-textarea" style="min-height: 100px;" placeholder="Optionaler Erfolgstext"></textarea>
        </div>

        <div class="admin-game-challenge-cards">
          <div class="admin-game-challenge-card">
            <div class="admin-game-challenge-card-label">Punkte</div>
            <input id="adminSetupChallengePointsInput" type="text" inputmode="numeric" value="1" placeholder="leer = variabel / ?" />
          </div>

          <div class="admin-game-challenge-card">
            <div class="admin-game-challenge-card-label">Variante 1</div>
            <input id="adminSetupChallengeVariant1Input" type="text" placeholder="z.B. Mehr als 5 Dosen" />
          </div>

          <div class="admin-game-challenge-card">
            <div class="admin-game-challenge-card-label">Variante 2</div>
            <input id="adminSetupChallengeVariant2Input" type="text" placeholder="z.B. Mehr als 8 Dosen" />
          </div>

          <div class="admin-game-challenge-card">
            <div class="admin-game-challenge-card-label">Variante 3</div>
            <input id="adminSetupChallengeVariant3Input" type="text" placeholder="z.B. Mehr als 12 Dosen" />
          </div>

          <div class="admin-game-challenge-card">
            <div class="admin-game-challenge-card-label">Kategorie</div>
            <input id="adminSetupChallengeCategoryInput" type="text" placeholder="z.B. 🍺" />
          </div>

          <div class="admin-game-challenge-card">
            <label>
              <input id="adminSetupChallengePhotoInput" type="checkbox" />
              Foto erforderlich
            </label>
          </div>

          <div class="admin-game-challenge-card">
            <label>
              <input id="adminSetupChallengeActiveInput" type="checkbox" checked />
              Aufgabe aktiv
            </label>
          </div>
        </div>

        <div class="admin-form-group admin-setup-image-box">
          <label for="adminSetupChallengeImageInput"><strong>Aufgabenbild</strong></label>
          <div id="adminSetupChallengeImagePreview" class="admin-challenge-image-preview-wrap"></div>
          <input id="adminSetupChallengeImageInput" type="file" accept="image/*" />
          <label id="adminSetupChallengeImageRemoveLabel" class="admin-setup-image-remove hidden">
            <input id="adminSetupChallengeImageRemoveInput" type="checkbox" />
            Vorhandenes Aufgabenbild entfernen
          </label>
          <p class="admin-details-empty">Optional. Wird im Aufgabenmodal unter der Beschreibung angezeigt.</p>
        </div>

        <div class="admin-setup-bulk-box">
          <h3>Für viele ähnliche Aufgaben</h3>
          <p>Die aktuellen Werte auf alle restlichen Aufgaben anwenden.</p>
          <div class="admin-setup-bulk-actions">
            <button id="adminSetupApplyToRemainingBtn" type="button" class="secondary-btn">Auf alle restlichen anwenden</button>
          </div>
        </div>
      </div>

      <div class="modal-actions">
        <button id="adminSetupBackBtn" type="button" class="secondary-btn">Zurück</button>
        <button id="adminSetupSkipBtn" type="button" class="secondary-btn">Überspringen</button>
        <button id="adminSetupStopBtn" type="button" class="secondary-btn">Später fertigstellen</button>
        <button id="adminSetupSaveNextBtn" type="button">Speichern & nächste</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("closeAdminChallengeSetupBtn")?.addEventListener("click", closeAdminChallengeSetupModal);
  document.getElementById("adminSetupSkipBtn")?.addEventListener("click", handleAdminChallengeSetupSkip);
  document.getElementById("adminSetupStopBtn")?.addEventListener("click", closeAdminChallengeSetupModal);
  document.getElementById("adminSetupSaveNextBtn")?.addEventListener("click", handleAdminChallengeSetupSaveNext);
  document.getElementById("adminSetupBackBtn")?.addEventListener("click", handleAdminChallengeSetupBack);
  document.getElementById("adminSetupApplyToRemainingBtn")?.addEventListener("click", handleAdminChallengeSetupApplyToRemaining);
}

/** Öffnet das Setup-Modal */
function openAdminChallengeSetupModal() {
  ensureAdminChallengeSetupModal();

  const overlay = document.getElementById("adminChallengeSetupOverlay");
  if (!overlay) return;

  overlay.classList.remove("hidden");
}

/** Schließt das Setup-Modal und setzt Wizard-State zurück */
function closeAdminChallengeSetupModal() {
  const overlay = document.getElementById("adminChallengeSetupOverlay");
  if (overlay) {
    overlay.classList.add("hidden");
  }

  adminChallengeSetupGameId = null;
  adminChallengeSetupPositions = [];
  adminChallengeSetupIndex = 0;
}

/** Sucht eine Challenge über Spiel + Position */
function getAdminChallengeByGameAndPosition(gameId, position) {
  return adminChallenges.find(
    challenge => challenge.game_id === gameId && Number(challenge.position) === Number(position)
  ) || null;
}

/**
 * Startet den Setup-Wizard.
 * Optional können nur bestimmte Positionen übergeben werden.
 */
function startAdminChallengeSetup(gameId, positions = null) {
  adminChallengeSetupGameId = gameId;
  adminChallengeSetupPositions = [];

  if (Array.isArray(positions) && positions.length > 0) {
    adminChallengeSetupPositions = [...positions];
  } else {
    const game = adminGames.find(g => g.id === gameId);
    const gridSize = game?.grid_size || 5;
    const total = gridSize * gridSize;

    for (let i = 1; i <= total; i++) {
      adminChallengeSetupPositions.push(i);
    }
  }

  adminChallengeSetupIndex = 0;

  openAdminChallengeSetupModal();
  renderAdminChallengeSetupStep();
}

/** Rendert den aktuellen Wizard-Schritt */
function renderAdminChallengeSetupStep() {
  const gameId = adminChallengeSetupGameId;
  const position = adminChallengeSetupPositions[adminChallengeSetupIndex];

  if (!gameId || !position) {
    closeAdminChallengeSetupModal();
    return;
  }

  const challenge = getAdminChallengeByGameAndPosition(gameId, position);
  if (!challenge) {
    closeAdminChallengeSetupModal();
    return;
  }

  const titleEl = document.getElementById("adminChallengeSetupTitle");
  const progressEl = document.getElementById("adminChallengeSetupProgress");
  const progressFillEl = document.getElementById("adminChallengeSetupProgressFill");
  const positionBadgeEl = document.getElementById("adminChallengeSetupPositionBadge");

  const titleInput = document.getElementById("adminSetupChallengeTitleInput");
  const taskInput = document.getElementById("adminSetupChallengeTaskInput");
  const detailsInput = document.getElementById("adminSetupChallengeDetailsInput");
  const successInput = document.getElementById("adminSetupChallengeSuccessInput");
  const pointsInput = document.getElementById("adminSetupChallengePointsInput");
  const categoryInput = document.getElementById("adminSetupChallengeCategoryInput");
  const variant1Input = document.getElementById("adminSetupChallengeVariant1Input");
  const variant2Input = document.getElementById("adminSetupChallengeVariant2Input");
  const variant3Input = document.getElementById("adminSetupChallengeVariant3Input");
  const photoInput = document.getElementById("adminSetupChallengePhotoInput");
  const activeInput = document.getElementById("adminSetupChallengeActiveInput");
  const imageInput = document.getElementById("adminSetupChallengeImageInput");
  const imagePreview = document.getElementById("adminSetupChallengeImagePreview");
  const imageRemoveInput = document.getElementById("adminSetupChallengeImageRemoveInput");
  const imageRemoveLabel = document.getElementById("adminSetupChallengeImageRemoveLabel");
  const backBtn = document.getElementById("adminSetupBackBtn");

  const currentStep = adminChallengeSetupIndex + 1;
  const totalSteps = adminChallengeSetupPositions.length;
  const percent = Math.round((currentStep / totalSteps) * 100);

  if (titleEl) titleEl.textContent = `Aufgabe bearbeiten`;
  if (progressEl) progressEl.textContent = `Aufgabe ${currentStep} / ${totalSteps}`;
  if (progressFillEl) progressFillEl.style.width = `${percent}%`;
  if (positionBadgeEl) positionBadgeEl.textContent = `Gridposition ${position}`;
  if (backBtn) backBtn.disabled = adminChallengeSetupIndex === 0;

  if (titleInput) titleInput.value = challenge.title || "";
  if (taskInput) taskInput.value = challenge.task || "";
  if (detailsInput) detailsInput.value = challenge.details || "";
  if (successInput) successInput.value = challenge.success_text || "";
  if (pointsInput) pointsInput.value = challenge.points ?? "";
  if (variant1Input) variant1Input.value = challenge.success_variant_1 || "";
  if (variant2Input) variant2Input.value = challenge.success_variant_2 || "";
  if (variant3Input) variant3Input.value = challenge.success_variant_3 || "";
  if (categoryInput) categoryInput.value = challenge.category_icon || "";
  if (photoInput) photoInput.checked = challenge.requires_photo_proof === true;
  if (activeInput) activeInput.checked = challenge.is_active !== false;
  if (imageInput) imageInput.value = "";
  if (imageRemoveInput) imageRemoveInput.checked = false;

  const imageUrl = getAdminChallengeImagePublicUrl(challenge.description_image_path);

  if (imagePreview) {
    imagePreview.innerHTML = imageUrl
      ? `<img src="${imageUrl}" class="admin-challenge-description-image-preview" alt="Aufgabenbild" />`
      : `<p class="admin-details-empty">Noch kein Aufgabenbild gesetzt.</p>`;
  }

  if (imageRemoveLabel) {
    imageRemoveLabel.classList.toggle("hidden", !challenge.description_image_path);
  }
}

function parseAdminChallengePointsInput(rawValue) {
  const trimmed = String(rawValue || "").trim();

  if (trimmed === "" || trimmed === "?") {
    return null;
  }

  const value = Number(trimmed);

  if (!Number.isInteger(value) || value < 0) {
    return undefined;
  }

  return value;
}

/** Liest die aktuellen Formularwerte des Wizards aus */
function getAdminChallengeSetupFormValues() {
  const pointsRaw = document.getElementById("adminSetupChallengePointsInput")?.value ?? "";

  return {
    title: document.getElementById("adminSetupChallengeTitleInput")?.value?.trim() || "",
    task: document.getElementById("adminSetupChallengeTaskInput")?.value || "",
    details: document.getElementById("adminSetupChallengeDetailsInput")?.value || "",
    success_text: document.getElementById("adminSetupChallengeSuccessInput")?.value || "",
    points: parseAdminChallengePointsInput(pointsRaw),
    success_variant_1: document.getElementById("adminSetupChallengeVariant1Input")?.value?.trim() || "",
    success_variant_2: document.getElementById("adminSetupChallengeVariant2Input")?.value?.trim() || "",
    success_variant_3: document.getElementById("adminSetupChallengeVariant3Input")?.value?.trim() || "",
    category_icon: document.getElementById("adminSetupChallengeCategoryInput")?.value?.trim() || "",
    requires_photo_proof: document.getElementById("adminSetupChallengePhotoInput")?.checked === true,
    is_active: document.getElementById("adminSetupChallengeActiveInput")?.checked === true
  };

}

/**
 * Ermittelt den Aufgabenbild-Pfad fuer den aktuellen Wizard-Schritt.
 *
 * Logik:
 * - Wenn "Bild entfernen" aktiv ist, wird null gespeichert.
 * - Wenn ein neues Bild ausgewaehlt wurde, wird es hochgeladen und der neue Pfad gespeichert.
 * - Wenn nichts geaendert wurde, bleibt der bisherige Bildpfad erhalten.
 */
async function resolveAdminChallengeSetupImagePath(gameId, challenge) {
  const imageInput = document.getElementById("adminSetupChallengeImageInput");
  const removeInput = document.getElementById("adminSetupChallengeImageRemoveInput");

  const shouldRemoveImage = removeInput?.checked === true;
  const file = imageInput?.files?.[0] || null;

  if (shouldRemoveImage) {
    return null;
  }

  if (file) {
    const imagePath = await uploadAdminChallengeImageFile(gameId, challenge.id, file);

    if (!imagePath) {
      return challenge.description_image_path || null;
    }

    return imagePath;
  }

  return challenge.description_image_path || null;
}

/** Speichert den aktuellen Schritt und springt zum nächsten */
async function handleAdminChallengeSetupSaveNext() {
  const gameId = adminChallengeSetupGameId;
  const position = adminChallengeSetupPositions[adminChallengeSetupIndex];

  if (!gameId || !position) return;

  const challenge = getAdminChallengeByGameAndPosition(gameId, position);
  if (!challenge) return;

  const values = getAdminChallengeSetupFormValues();

  if (!values.title) {
    alert("Bitte einen Namen eingeben.");
    return;
  }

  if (values.points === undefined) {
    alert("Bitte eine ganze Punktzahl eingeben oder das Feld leer lassen für variable Punkte.");
    return;
  }

  const imagePath = await resolveAdminChallengeSetupImagePath(gameId, challenge);

  const updated = await updateAdminChallengeFields(challenge.id, {
    title: values.title,
    task: values.task.trim(),
    details: values.details.trim() || null,
    success_text: values.success_text.trim() || null,
    points: values.points === null ? null : (Number.isFinite(values.points) ? values.points : 0),
    success_variant_1: values.success_variant_1 || null,
    success_variant_2: values.success_variant_2 || null,
    success_variant_3: values.success_variant_3 || null,
    category_icon: values.category_icon || null,
    requires_photo_proof: values.requires_photo_proof,
    photo_mode: values.requires_photo_proof ? "required" : "none",
    is_active: values.is_active,
    description_image_path: imagePath
  });

  if (!updated) return;

  await loadAllChallengesForAdminDetailed();

  adminChallengeSetupIndex++;

  if (adminChallengeSetupIndex >= adminChallengeSetupPositions.length) {
    closeAdminChallengeSetupModal();
    await initializeAdminGamesTab();
    return;
  }

  renderAdminChallengeSetupStep();
}

/** Überspringt den aktuellen Schritt */
async function handleAdminChallengeSetupSkip() {
  adminChallengeSetupIndex++;

  if (adminChallengeSetupIndex >= adminChallengeSetupPositions.length) {
    closeAdminChallengeSetupModal();
    await initializeAdminGamesTab();
    return;
  }

  renderAdminChallengeSetupStep();
}

/** Geht einen Schritt zurück */
function handleAdminChallengeSetupBack() {
  if (adminChallengeSetupIndex <= 0) return;

  adminChallengeSetupIndex--;
  renderAdminChallengeSetupStep();
}

/**
 * Wendet die aktuellen Eingabewerte auf alle restlichen Aufgaben des Wizards an.
 */
async function handleAdminChallengeSetupApplyToRemaining() {
  const gameId = adminChallengeSetupGameId;
  if (!gameId) return;

  const values = getAdminChallengeSetupFormValues();

  if (!values.title) {
    alert("Bitte zuerst mindestens einen Namen eingeben.");
    return;
  }

  if (values.points === undefined) {
    alert("Bitte eine ganze Punktzahl eingeben oder das Feld leer lassen für variable Punkte.");
    return;
  }

  const confirmed = confirm(
    "Die aktuellen Werte werden auf alle restlichen Aufgaben angewendet. Fortfahren?"
  );
  if (!confirmed) return;

  const remainingPositions = adminChallengeSetupPositions.slice(adminChallengeSetupIndex);

  for (const position of remainingPositions) {
    const challenge = getAdminChallengeByGameAndPosition(gameId, position);
    if (!challenge) continue;

    const titleForRow =
      position === adminChallengeSetupPositions[adminChallengeSetupIndex]
        ? values.title
        : `${values.title} ${position}`;

    const updated = await updateAdminChallengeFields(challenge.id, {
      title: titleForRow,
      task: values.task.trim(),
      details: values.details.trim() || null,
      success_text: values.success_text.trim() || null,
      points: values.points === null ? null : (Number.isFinite(values.points) ? values.points : 0),
      success_variant_1: values.success_variant_1 || null,
      success_variant_2: values.success_variant_2 || null,
      success_variant_3: values.success_variant_3 || null,
      category_icon: values.category_icon || null,
      requires_photo_proof: values.requires_photo_proof,
      photo_mode: values.requires_photo_proof ? "required" : "none",
      is_active: values.is_active
    });

    if (!updated) {
      alert(`Fehler bei Position ${position}.`);
      return;
    }
  }

  await loadAllChallengesForAdminDetailed();
  closeAdminChallengeSetupModal();
  await initializeAdminGamesTab();
}
