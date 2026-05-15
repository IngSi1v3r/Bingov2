/**
 * ============================================================
 * polling_service.js
 * ============================================================
 *
 * Zweck:
 * Zentrale Verwaltung aller Polling-Intervalle der Festival-Bingo-App.
 *
 * Diese Datei kuemmert sich nur um:
 * - Polling-Jobs registrieren
 * - Jobs starten / stoppen
 * - Intervalle zentral verwalten
 * - Polling-Presets speichern und laden
 * - parallele Ausfuehrung desselben Jobs verhindern
 *
 * Diese Datei kuemmert sich NICHT um:
 * - Supabase-Zugriffe
 * - Rendering
 * - konkrete UI-Logik
 * - Auth
 *
 * Grundidee:
 * Andere Dateien registrieren Jobs mit Callback-Funktionen.
 * Der PollingService entscheidet nur, wann diese Callbacks laufen.
 *
 * Beispiel:
 *
 * PollingService.registerJob({
 *   id: "player-fast",
 *   level: "fast",
 *   callback: async () => {
 *     await refreshPlayerFastData();
 *   }
 * });
 *
 * PollingService.startJob("player-fast");
 *
 * Standard-Ebenen:
 * - fast:  Daten, die oft aktualisiert werden sollen
 * - slow:  Stammdaten, die sich selten aendern
 * - admin: Adminpanel / aktiver Tab
 */

/* ============================================================
 * POLLING SERVICE
 * ============================================================ */

const PollingService = (() => {
  const STORAGE_KEY = "festival_bingo_polling_settings";

  const DEFAULT_SETTINGS = {
    preset: "normal",
    intervals: {
      fast: 5000,
      slow: 60000,
      admin: 10000
    }
  };

  const PRESETS = {
    slow: {
      fast: 10000,
      slow: 120000,
      admin: 20000
    },
    normal: {
      fast: 5000,
      slow: 60000,
      admin: 10000
    },
    fast: {
      fast: 2500,
      slow: 30000,
      admin: 5000
    }
  };

  const jobs = new Map();

  let settings = loadSettings();

  /* ============================================================
   * SETTINGS
   * ============================================================ */

  function loadSettings() {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return structuredCloneSafe(DEFAULT_SETTINGS);
    }

    try {
      const parsed = JSON.parse(raw);

      return {
        preset: parsed.preset || DEFAULT_SETTINGS.preset,
        intervals: {
          fast: Number(parsed.intervals?.fast) || DEFAULT_SETTINGS.intervals.fast,
          slow: Number(parsed.intervals?.slow) || DEFAULT_SETTINGS.intervals.slow,
          admin: Number(parsed.intervals?.admin) || DEFAULT_SETTINGS.intervals.admin
        }
      };
    } catch (error) {
      console.error("Fehler beim Laden der Polling-Settings:", error);
      return structuredCloneSafe(DEFAULT_SETTINGS);
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getSettings() {
    return structuredCloneSafe(settings);
  }

  function getIntervalForLevel(level) {
    return settings.intervals[level] || settings.intervals.fast;
  }

  function setPreset(presetName) {
    const preset = PRESETS[presetName];

    if (!preset) {
      console.warn("Unbekanntes Polling-Preset:", presetName);
      return false;
    }

    settings = {
      preset: presetName,
      intervals: {
        fast: preset.fast,
        slow: preset.slow,
        admin: preset.admin
      }
    };

    saveSettings();
    restartRunningJobs();

    return true;
  }

  function setCustomIntervals({ fast = null, slow = null, admin = null } = {}) {
    settings = {
      preset: "custom",
      intervals: {
        fast: sanitizeInterval(fast, settings.intervals.fast),
        slow: sanitizeInterval(slow, settings.intervals.slow),
        admin: sanitizeInterval(admin, settings.intervals.admin)
      }
    };

    saveSettings();
    restartRunningJobs();

    return true;
  }

  function sanitizeInterval(value, fallback) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 1000) {
      return fallback;
    }

    return Math.round(parsed);
  }

  /* ============================================================
   * JOB REGISTRATION
   * ============================================================ */

  function registerJob({
    id,
    level = "fast",
    callback,
    runImmediately = false,
    enabled = true,
    description = ""
  }) {
    if (!id) {
      console.error("PollingService.registerJob: id fehlt.");
      return false;
    }

    if (typeof callback !== "function") {
      console.error("PollingService.registerJob: callback fehlt oder ist keine Funktion.", id);
      return false;
    }

    const existing = jobs.get(id);

    if (existing?.intervalId) {
      clearInterval(existing.intervalId);
    }

    jobs.set(id, {
      id,
      level,
      callback,
      runImmediately,
      enabled,
      description,
      intervalId: null,
      isRunning: false,
      startedAt: null,
      lastRunAt: null,
      lastFinishedAt: null,
      lastError: null
    });

    return true;
  }

  function unregisterJob(id) {
    stopJob(id);
    return jobs.delete(id);
  }

  function hasJob(id) {
    return jobs.has(id);
  }

  function getJob(id) {
    const job = jobs.get(id);
    if (!job) return null;

    return {
      id: job.id,
      level: job.level,
      enabled: job.enabled,
      description: job.description,
      isRunning: job.isRunning,
      startedAt: job.startedAt,
      lastRunAt: job.lastRunAt,
      lastFinishedAt: job.lastFinishedAt,
      lastError: job.lastError
    };
  }

  function getAllJobs() {
    return Array.from(jobs.values()).map(job => getJob(job.id));
  }

  /* ============================================================
   * JOB EXECUTION
   * ============================================================ */

  async function runJobOnce(id) {
    const job = jobs.get(id);

    if (!job || !job.enabled) {
      return false;
    }

    if (job.isRunning) {
      return false;
    }

    job.isRunning = true;
    job.lastRunAt = new Date().toISOString();
    job.lastError = null;

    try {
      await job.callback();
      job.lastFinishedAt = new Date().toISOString();
      return true;
    } catch (error) {
      job.lastError = error?.message || String(error);
      console.error(`PollingService Job "${id}" fehlgeschlagen:`, error);
      return false;
    } finally {
      job.isRunning = false;
    }
  }

  function startJob(id) {
    const job = jobs.get(id);

    if (!job) {
      console.warn("PollingService.startJob: Job nicht gefunden:", id);
      return false;
    }

    if (job.intervalId) {
      clearInterval(job.intervalId);
      job.intervalId = null;
    }

    if (!job.enabled) {
      return false;
    }

    const intervalMs = getIntervalForLevel(job.level);

    job.startedAt = new Date().toISOString();

    if (job.runImmediately) {
      runJobOnce(id);
    }

    job.intervalId = setInterval(() => {
      runJobOnce(id);
    }, intervalMs);

    return true;
  }

  function stopJob(id) {
    const job = jobs.get(id);

    if (!job) {
      return false;
    }

    if (job.intervalId) {
      clearInterval(job.intervalId);
      job.intervalId = null;
    }

    job.startedAt = null;
    return true;
  }

  function restartJob(id) {
    stopJob(id);
    return startJob(id);
  }

  function startLevel(level) {
    jobs.forEach(job => {
      if (job.level === level) {
        startJob(job.id);
      }
    });
  }

  function stopLevel(level) {
    jobs.forEach(job => {
      if (job.level === level) {
        stopJob(job.id);
      }
    });
  }

  function startAll() {
    jobs.forEach(job => {
      startJob(job.id);
    });
  }

  function stopAll() {
    jobs.forEach(job => {
      stopJob(job.id);
    });
  }

  function restartRunningJobs() {
    jobs.forEach(job => {
      if (job.intervalId) {
        restartJob(job.id);
      }
    });
  }

  function enableJob(id) {
    const job = jobs.get(id);
    if (!job) return false;

    job.enabled = true;
    return true;
  }

  function disableJob(id) {
    const job = jobs.get(id);
    if (!job) return false;

    job.enabled = false;
    stopJob(id);
    return true;
  }

  /* ============================================================
   * CONVENIENCE HELPERS
   * ============================================================ */

  function registerOrUpdateJob(config) {
    const wasRunning = jobs.get(config.id)?.intervalId != null;

    const ok = registerJob(config);
    if (!ok) return false;

    if (wasRunning) {
      startJob(config.id);
    }

    return true;
  }

  function isJobRunning(id) {
    const job = jobs.get(id);
    return job?.isRunning === true;
  }

  function isJobStarted(id) {
    const job = jobs.get(id);
    return !!job?.intervalId;
  }

  function getPresetNames() {
    return Object.keys(PRESETS);
  }

  function resetSettingsToDefault() {
    settings = structuredCloneSafe(DEFAULT_SETTINGS);
    saveSettings();
    restartRunningJobs();
  }

  /* ============================================================
   * PUBLIC API
   * ============================================================ */

  return {
    registerJob,
    registerOrUpdateJob,
    unregisterJob,
    hasJob,
    getJob,
    getAllJobs,

    startJob,
    stopJob,
    restartJob,
    startLevel,
    stopLevel,
    startAll,
    stopAll,
    runJobOnce,

    enableJob,
    disableJob,
    isJobRunning,
    isJobStarted,

    getSettings,
    setPreset,
    setCustomIntervals,
    resetSettingsToDefault,
    getPresetNames,
    getIntervalForLevel
  };
})();