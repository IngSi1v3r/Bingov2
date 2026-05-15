/**
 * ============================================================
 * data_service.js
 * ============================================================
 *
 * Zweck:
 * Zentrale Lade- und Datenzugriffsschicht fuer die Festival-Bingo-App.
 *
 * Diese Datei buendelt reine Lesezugriffe auf Supabase fuer:
 * - Spielerseite
 * - Adminpanel
 * - Dashboard
 * - Galerie
 * - Live-Challenges
 * - Logs
 *
 * Grundregeln:
 * - Diese Datei rendert nichts.
 * - Diese Datei veraendert keinen UI-State direkt.
 * - Diese Datei enthaelt moeglichst keine Mutationen.
 * - Schreibaktionen bleiben vorerst in den jeweiligen Fachdateien.
 * - pin_hash wird bewusst nicht ins Frontend geladen.
 *
 * Erwartete Voraussetzung:
 * - supabase-client.js wurde vorher geladen.
 * - supabaseClient ist global verfuegbar.
 *
 * Empfohlene Einbindung:
 * - index.html:
 *   nach supabase-client.js und vor data.js / game.js / main.js
 *
 * - admin.html:
 *   nach supabase-client.js und vor admin.js / admin_*.js
 *
 * Hauptbereiche:
 * 1. Konstanten / Basis-Helper
 * 2. Games
 * 3. Players
 * 4. Challenges
 * 5. Player Game State
 * 6. Player Challenges
 * 7. Player Bingos
 * 8. Leaderboard / Statistiken
 * 9. Live-Challenges
 * 10. Live-Challenge-Views
 * 11. Activity Logs
 * 12. Storage / Public URLs
 * 13. Combined Loaders / Bundles
 * 14. Kompatibilitaets-Wrapper
 */

/* ============================================================
 * 1. KONSTANTEN / BASIS-HELPER
 * ============================================================ */

const DataService = (() => {
  const SELECT_PLAYERS_SAFE = "id, username, display_name, role, is_blocked, created_at";

  const SELECT_CHALLENGES_BASIC = `
    id,
    game_id,
    position,
    title,
    points,
    success_variant_1,
    success_variant_2,
    success_variant_3,
    is_active
  `;

  const SELECT_CHALLENGES_DETAILED = `
    id,
    game_id,
    position,
    title,
    task,
    points,
    is_active,
    category_icon,
    details,
    success_text,
    success_variant_1,
    success_variant_2,
    success_variant_3,
    requires_photo_proof
  `;

  const SELECT_LIVE_WITH_WINNER = `
    *,
    players:winner_player_id (
      id,
      username,
      display_name
    )
  `;

  const SELECT_ACTIVITY_LOGS_DETAILED = `
    *,
    player:player_id (
      id,
      username,
      display_name
    ),
    admin_player:admin_player_id (
      id,
      username,
      display_name
    ),
    game:game_id (
      id,
      name
    ),
    challenge:challenge_id (
      id,
      title,
      position
    ),
    live_challenge:live_challenge_id (
      id,
      title
    )
  `;

  function getDefaultGameId() {
    if (typeof currentGameId !== "undefined" && currentGameId) {
      return currentGameId;
    }

    if (typeof adminCurrentGameId !== "undefined" && adminCurrentGameId) {
      return adminCurrentGameId;
    }

    return null;
  }

  function getDefaultPlayerId() {
    if (typeof currentPlayer !== "undefined" && currentPlayer?.id) {
      return currentPlayer.id;
    }

    if (typeof adminPlayer !== "undefined" && adminPlayer?.id) {
      return adminPlayer.id;
    }

    return null;
  }

  function normalizeId(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function handleError(label, error, fallback) {
    if (error) {
      console.error(label, error);
    }

    return fallback;
  }

  function mapPlayerChallengeCompletion(row) {
    return {
      playerId: row.player_id,
      username: row.players?.username || "Unbekannt",
      display_name: row.players?.display_name || null,
      completedAt: row.completed_at,
      wasFirstSolver: row.was_first_solver === true,
      proofImagePath: row.proof_image_path || null,
      successVariantLabel: row.success_variant_label || null,
      successVariantPoints: row.success_variant_points || null,
      pointsAwarded: row.points_awarded || 0
    };
  }

  function mapLeaderboardRow(row) {
    const cooldownUntilMs = row.cooldown_until
      ? new Date(row.cooldown_until).getTime()
      : null;

    return {
      playerId: row.player_id,
      username: row.players?.username || "Unbekannt",
      display_name: row.players?.display_name || null,
      score: row.score || 0,
      activeChallengeId: row.active_challenge_id,
      cooldownUntil: cooldownUntilMs
    };
  }

  /* ============================================================
   * 2. GAMES
   * ============================================================ */

  const games = {
    /**
     * Laedt alle Spiele, unabhaengig vom Aktivstatus.
     */
    async loadAll() {
      const { data, error } = await supabaseClient
        .from("games")
        .select("*")
        .order("id", { ascending: true });

      return error
        ? handleError("Fehler beim Laden aller Spiele:", error, [])
        : (data || []);
    },

    /**
     * Laedt alle aktiven Spiele.
     * Wird auf der Spielerseite fuer die Spielauswahl genutzt.
     */
    async loadActive() {
      const { data, error } = await supabaseClient
        .from("games")
        .select("*")
        .eq("is_active", true)
        .order("id", { ascending: true });

      return error
        ? handleError("Fehler beim Laden aktiver Spiele:", error, [])
        : (data || []);
    },

    async loadVisibleForPlayer(playerId) {
    const safePlayerId = normalizeId(playerId);
    if (!safePlayerId) {
        return {
            myGames: [],
            availableGames: []
        };
    }

    const [
        activeGamesResult,
        stateRowsResult,
        allStateRowsResult
    ] = await Promise.all([
        supabaseClient
            .from("games")
            .select("*")
            .eq("is_active", true)
            .order("id", { ascending: true }),

        supabaseClient
            .from("player_game_state")
            .select("*")
            .eq("player_id", safePlayerId),

        supabaseClient
            .from("player_game_state")
            .select("game_id")
    ]);

    if (activeGamesResult.error) {
        return handleError(
            "Fehler beim Laden aktiver Spiele:",
            activeGamesResult.error,
            {
                myGames: [],
                availableGames: []
            }
        );
    }

    if (stateRowsResult.error) {
        return handleError(
            "Fehler beim Laden der Spielstaende:",
            stateRowsResult.error,
            {
                myGames: [],
                availableGames: []
            }
        );
    }

    if (allStateRowsResult.error) {
        return handleError(
            "Fehler beim Laden der Spieleranzahlen:",
            allStateRowsResult.error,
            {
                myGames: [],
                availableGames: []
            }
        );
    }

    const games = activeGamesResult.data || [];
    const states = stateRowsResult.data || [];
    const allStates = allStateRowsResult.data || [];

    const stateByGameId = {};
    states.forEach(state => {
        stateByGameId[Number(state.game_id)] = state;
    });

    const playerCountByGameId = {};

    allStates.forEach(row => {
        const gameId = Number(row.game_id);

        playerCountByGameId[gameId] =
            (playerCountByGameId[gameId] || 0) + 1;
    });

    const myGames = [];
    const availableGames = [];

    games.forEach(game => {
        const state = stateByGameId[Number(game.id)] || null;
        const visibility = game.visibility || "public";

        const gameEntry = {
            ...game,
            playerCount: playerCountByGameId[Number(game.id)] || 0,
            playerState: state
        };

        // Spieler hat bereits Zugriff
        if (state) {
            myGames.push(gameEntry);
            return;
        }

        // Öffentlich sichtbare Spiele
        if (visibility === "public") {
            availableGames.push(gameEntry);
        }
    });

    // Eigene Spiele nach letzter Aktivität sortieren
    myGames.sort((a, b) => {
        const aTime = new Date(
            a.playerState?.updated_at ||
            a.playerState?.created_at ||
            0
        ).getTime();

        const bTime = new Date(
            b.playerState?.updated_at ||
            b.playerState?.created_at ||
            0
        ).getTime();

        return bTime - aTime;
    });

    // Öffentliche Spiele alphabetisch
    availableGames.sort((a, b) => {
        return String(a.name || "").localeCompare(
            String(b.name || ""),
            "de"
        );
    });

    return {
        myGames,
        availableGames
    };
},

    /**
     * Laedt ein einzelnes Spiel anhand der ID.
     */
    async loadById(gameId = getDefaultGameId()) {
      const safeGameId = normalizeId(gameId);
      if (!safeGameId) return null;

      const { data, error } = await supabaseClient
        .from("games")
        .select("*")
        .eq("id", safeGameId)
        .maybeSingle();

      return error
        ? handleError("Fehler beim Laden des Spiels:", error, null)
        : (data || null);
    },

    /**
     * Laedt ein Fallback-Spiel.
     * Standard: erstes aktives Spiel.
     */
    async loadFirstActive() {
      const { data, error } = await supabaseClient
        .from("games")
        .select("*")
        .eq("is_active", true)
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();

      return error
        ? handleError("Fehler beim Laden des Fallback-Spiels:", error, null)
        : (data || null);
    }
  };

  /* ============================================================
   * 3. PLAYERS
   * ============================================================ */

  const players = {
    /**
     * Laedt alle Spieler ohne pin_hash.
     * Wichtig: diese Funktion ist der Standard fuer Adminlisten.
     */
    async loadAllSafe() {
      const { data, error } = await supabaseClient
        .from("players")
        .select(SELECT_PLAYERS_SAFE)
        .order("id", { ascending: true });

      return error
        ? handleError("Fehler beim Laden aller Spieler:", error, [])
        : (data || []);
    },

    /**
     * Laedt einen einzelnen Spieler ohne pin_hash.
     */
    async loadById(playerId = getDefaultPlayerId()) {
      const safePlayerId = normalizeId(playerId);
      if (!safePlayerId) return null;

      const { data, error } = await supabaseClient
        .from("players")
        .select(SELECT_PLAYERS_SAFE)
        .eq("id", safePlayerId)
        .maybeSingle();

      return error
        ? handleError("Fehler beim Laden des Spielers:", error, null)
        : (data || null);
    }
  };

  /* ============================================================
   * 4. CHALLENGES
   * ============================================================ */

  const challenges = {
    /**
     * Laedt Challenge-Stammdaten fuer ein Spiel.
     * Diese Funktion ist fuer die Spielerseite geeignet.
     */
    async loadForGame(gameId = getDefaultGameId()) {
      const safeGameId = normalizeId(gameId);
      if (!safeGameId) return [];

      const { data, error } = await supabaseClient
        .from("challenges")
        .select(SELECT_CHALLENGES_DETAILED)
        .eq("game_id", safeGameId)
        .order("position", { ascending: true });

      return error
        ? handleError("Fehler beim Laden der Challenges:", error, [])
        : (data || []);
    },

    /**
     * Laedt alle Challenges mit Basisfeldern.
     * Reicht fuer Players-Tab, Mini-Grids und einfache Statistiken.
     */
    async loadAllBasic() {
      const { data, error } = await supabaseClient
        .from("challenges")
        .select(SELECT_CHALLENGES_BASIC)
        .order("game_id", { ascending: true })
        .order("position", { ascending: true });

      return error
        ? handleError("Fehler beim Laden aller Challenge-Basisdaten:", error, [])
        : (data || []);
    },

    /**
     * Laedt alle Challenges mit allen bearbeitbaren Feldern.
     * Wird fuer Games-Tab, Galerie und Detailansichten genutzt.
     */
    async loadAllDetailed() {
      const { data, error } = await supabaseClient
        .from("challenges")
        .select(SELECT_CHALLENGES_DETAILED)
        .order("game_id", { ascending: true })
        .order("position", { ascending: true });

      return error
        ? handleError("Fehler beim Laden aller detaillierten Challenges:", error, [])
        : (data || []);
    }
  };

  /* ============================================================
   * 5. PLAYER GAME STATE
   * ============================================================ */

  const playerState = {
    /**
     * Laedt alle player_game_state-Eintraege.
     * Wird vor allem im Adminpanel genutzt.
     */
    async loadAll() {
      const { data, error } = await supabaseClient
        .from("player_game_state")
        .select("*");

      return error
        ? handleError("Fehler beim Laden aller player_game_state-Eintraege:", error, [])
        : (data || []);
    },

    /**
     * Laedt den Spielstand eines Spielers in einem Spiel.
     */
    async loadForPlayerAndGame(playerId = getDefaultPlayerId(), gameId = getDefaultGameId()) {
      const safePlayerId = normalizeId(playerId);
      const safeGameId = normalizeId(gameId);
      if (!safePlayerId || !safeGameId) return null;

      const { data, error } = await supabaseClient
        .from("player_game_state")
        .select("*")
        .eq("player_id", safePlayerId)
        .eq("game_id", safeGameId)
        .maybeSingle();

      return error
        ? handleError("Fehler beim Laden des player_game_state:", error, null)
        : (data || null);
    },

    /**
     * Laedt alle Spielstaende fuer ein bestimmtes Spiel.
     */
    async loadForGame(gameId = getDefaultGameId()) {
      const safeGameId = normalizeId(gameId);
      if (!safeGameId) return [];

      const { data, error } = await supabaseClient
        .from("player_game_state")
        .select("*")
        .eq("game_id", safeGameId);

      return error
        ? handleError("Fehler beim Laden der Spielstaende fuer ein Spiel:", error, [])
        : (data || []);
    },

    /**
     * Stellt sicher, dass ein player_game_state existiert.
     * Diese Funktion erzeugt bei Bedarf einen Datensatz.
     * Hinweis: Das ist bewusst die einzige kleine Ausnahme von "nur lesen",
     * weil diese Logik bereits zum Lade-Bootstrap gehoert.
     */
    async ensureForPlayerAndGame(playerId = getDefaultPlayerId(), gameId = getDefaultGameId()) {
      const safePlayerId = normalizeId(playerId);
      const safeGameId = normalizeId(gameId);
      if (!safePlayerId || !safeGameId) return null;

      const existing = await playerState.loadForPlayerAndGame(safePlayerId, safeGameId);
      if (existing) return existing;

      const { data, error } = await supabaseClient
        .from("player_game_state")
        .insert({
          player_id: safePlayerId,
          game_id: safeGameId,
          score: 0,
          active_challenge_id: null,
          cooldown_until: null
        })
        .select()
        .single();

      return error
        ? handleError("Fehler beim Erstellen von player_game_state:", error, null)
        : data;
    }
  };

  /* ============================================================
   * 6. PLAYER CHALLENGES
   * ============================================================ */

  const playerChallenges = {
    /**
     * Laedt alle player_challenges.
     * Optional koennen Statuswerte eingeschraenkt werden.
     */
    async loadAll({ statuses = null } = {}) {
      let query = supabaseClient
        .from("player_challenges")
        .select("*");

      if (Array.isArray(statuses) && statuses.length > 0) {
        query = query.in("status", statuses);
      }

      const { data, error } = await query;

      return error
        ? handleError("Fehler beim Laden aller player_challenges:", error, [])
        : (data || []);
    },

    /**
     * Laedt alle aktiven und abgeschlossenen player_challenges.
     * Das ist der aktuelle Standard fuer viele Adminansichten.
     */
    async loadAllActiveAndCompleted() {
      return await playerChallenges.loadAll({
        statuses: ["active", "completed"]
      });
    },

    /**
     * Laedt alle Challenge-Zeilen eines Spielers in einem Spiel.
     */
    async loadForPlayerAndGame(playerId = getDefaultPlayerId(), gameId = getDefaultGameId()) {
      const safePlayerId = normalizeId(playerId);
      const safeGameId = normalizeId(gameId);
      if (!safePlayerId || !safeGameId) return [];

      const { data, error } = await supabaseClient
        .from("player_challenges")
        .select("*")
        .eq("player_id", safePlayerId)
        .eq("game_id", safeGameId);

      return error
        ? handleError("Fehler beim Laden von player_challenges:", error, [])
        : (data || []);
    },

    /**
     * Laedt abgeschlossene Aufgaben eines Spielers in einem Spiel.
     * Wird fuer Profilansicht und Galerien genutzt.
     */
    async loadCompletedForPlayer(playerId = getDefaultPlayerId(), gameId = getDefaultGameId(), ascending = false) {
      const safePlayerId = normalizeId(playerId);
      const safeGameId = normalizeId(gameId);
      if (!safePlayerId || !safeGameId) return [];

      const { data, error } = await supabaseClient
        .from("player_challenges")
        .select("challenge_id, completed_at, was_first_solver, points_awarded, proof_image_path, success_variant_label, success_variant_points")
        .eq("player_id", safePlayerId)
        .eq("game_id", safeGameId)
        .eq("status", "completed")
        .order("completed_at", { ascending });

      return error
        ? handleError("Fehler beim Laden abgeschlossener Aufgaben:", error, [])
        : (data || []);
    },

    /**
     * Laedt alle Abschluesse einer bestimmten Challenge.
     * Die Rueckgabe ist fuer die bestehende Spieler-UI bereits gemappt.
     */
    async loadCompletionsForChallenge(challengeId, gameId = getDefaultGameId()) {
      const safeChallengeId = normalizeId(challengeId);
      const safeGameId = normalizeId(gameId);
      if (!safeChallengeId || !safeGameId) return [];

      const { data, error } = await supabaseClient
        .from("player_challenges")
        .select(`
          player_id,
          completed_at,
          was_first_solver,
          proof_image_path,
          points_awarded,
          success_variant_label,
          success_variant_points,
          players (
            username,
            display_name
          )
        `)
        .eq("game_id", safeGameId)
        .eq("challenge_id", safeChallengeId)
        .eq("status", "completed")
        .order("completed_at", { ascending: true });

      return error
        ? handleError("Fehler beim Laden der Challenge-Abschluesse:", error, [])
        : (data || []).map(mapPlayerChallengeCompletion);
    },

    /**
     * Laedt Rohdaten fuer globale Challenge-Stats eines Spiels.
     */
    async loadGlobalStatsRows(gameId = getDefaultGameId()) {
      const safeGameId = normalizeId(gameId);
      if (!safeGameId) return [];

      const { data, error } = await supabaseClient
        .from("player_challenges")
        .select("player_id, challenge_id, status")
        .eq("game_id", safeGameId)
        .in("status", ["active", "completed"]);

      return error
        ? handleError("Fehler beim Laden globaler Challenge-Stats:", error, [])
        : (data || []);
    }
  };

  /* ============================================================
   * 7. PLAYER BINGOS
   * ============================================================ */

  const playerBingos = {
    /**
     * Laedt alle Bingo-Eintraege.
     */
    async loadAll() {
      const { data, error } = await supabaseClient
        .from("player_bingos")
        .select("*");

      return error
        ? handleError("Fehler beim Laden aller player_bingos:", error, [])
        : (data || []);
    },

    /**
     * Laedt alle Bingo-Eintraege eines Spielers in einem Spiel.
     */
    async loadForPlayerAndGame(playerId = getDefaultPlayerId(), gameId = getDefaultGameId()) {
      const safePlayerId = normalizeId(playerId);
      const safeGameId = normalizeId(gameId);
      if (!safePlayerId || !safeGameId) return [];

      const { data, error } = await supabaseClient
        .from("player_bingos")
        .select("*")
        .eq("player_id", safePlayerId)
        .eq("game_id", safeGameId);

      return error
        ? handleError("Fehler beim Laden von player_bingos:", error, [])
        : (data || []);
    },

    /**
     * Laedt alle Bingo-Eintraege eines Spiels.
     */
    async loadForGame(gameId = getDefaultGameId()) {
      const safeGameId = normalizeId(gameId);
      if (!safeGameId) return [];

      const { data, error } = await supabaseClient
        .from("player_bingos")
        .select("*")
        .eq("game_id", safeGameId);

      return error
        ? handleError("Fehler beim Laden der Bingo-Eintraege fuer ein Spiel:", error, [])
        : (data || []);
    }
  };

  /* ============================================================
   * 8. LEADERBOARD / STATISTIKEN
   * ============================================================ */

  const stats = {
    /**
     * Laedt das Leaderboard eines Spiels.
     * Die Rueckgabe ist fuer die bestehende Spieler-UI bereits gemappt.
     */
    async loadLeaderboard(gameId = getDefaultGameId()) {
      const safeGameId = normalizeId(gameId);
      if (!safeGameId) return [];

      const { data, error } = await supabaseClient
        .from("player_game_state")
        .select(`
          score,
          player_id,
          active_challenge_id,
          cooldown_until,
          players (
            username,
            display_name
          )
        `)
        .eq("game_id", safeGameId)
        .order("score", { ascending: false });

      return error
        ? handleError("Fehler beim Laden des Leaderboards:", error, [])
        : (data || []).map(mapLeaderboardRow);
    },

    /**
     * Zaehlt abgeschlossene Spieler-Live-Challenges und Live-Punkte.
     */
    async loadLiveStatsForPlayer(playerId = getDefaultPlayerId(), gameId = getDefaultGameId()) {
      const safePlayerId = normalizeId(playerId);
      const safeGameId = normalizeId(gameId);
      if (!safePlayerId || !safeGameId) {
        return { total: 0, won: 0, points: 0 };
      }

      const [
        { data: playerRows, error: playerError },
        { count: totalCount, error: totalError }
      ] = await Promise.all([
        supabaseClient
          .from("player_live_challenges")
          .select("points_awarded")
          .eq("player_id", safePlayerId)
          .eq("game_id", safeGameId)
          .eq("status", "completed"),

        supabaseClient
          .from("live_challenges")
          .select("*", { count: "exact", head: true })
          .eq("game_id", safeGameId)
          .neq("status", "cancelled")
      ]);

      if (playerError) {
        console.error("Fehler beim Laden der Spieler-Live-Stats:", playerError);
      }

      if (totalError) {
        console.error("Fehler beim Laden der Live-Challenge-Anzahl:", totalError);
      }

      const rows = playerRows || [];

      return {
        total: totalCount || 0,
        won: rows.filter(row => (row.points_awarded || 0) > 0).length,
        points: rows.reduce((sum, row) => sum + (row.points_awarded || 0), 0)
      };
    }
  };

  /* ============================================================
   * 9. LIVE-CHALLENGES
   * ============================================================ */

  const live = {
    /**
     * Laedt alle Live-Challenges ohne Gewinner-Relation.
     */
    async loadAll() {
      const { data, error } = await supabaseClient
        .from("live_challenges")
        .select("*")
        .order("created_at", { ascending: false });

      return error
        ? handleError("Fehler beim Laden aller Live-Challenges:", error, [])
        : (data || []);
    },

    /**
     * Laedt alle Live-Challenges mit Gewinner-Relation.
     * Standard fuer Admin-Live-Tab.
     */
    async loadAllWithWinner() {
      const { data, error } = await supabaseClient
        .from("live_challenges")
        .select(SELECT_LIVE_WITH_WINNER)
        .order("created_at", { ascending: false });

      return error
        ? handleError("Fehler beim Laden aller Live-Challenges mit Gewinner:", error, [])
        : (data || []);
    },

    /**
     * Laedt alle Live-Challenges eines Spiels.
     */
    async loadForGame(gameId = getDefaultGameId()) {
      const safeGameId = normalizeId(gameId);
      if (!safeGameId) return [];

      const { data, error } = await supabaseClient
        .from("live_challenges")
        .select(SELECT_LIVE_WITH_WINNER)
        .eq("game_id", safeGameId)
        .order("created_at", { ascending: true });

      return error
        ? handleError("Fehler beim Laden der Live-Challenges fuer ein Spiel:", error, [])
        : (data || []);
    },

    /**
     * Laedt die aktive Live-Challenge eines Spiels.
     */
    async loadActiveForGame(gameId = getDefaultGameId()) {
      const safeGameId = normalizeId(gameId);
      if (!safeGameId) return null;

      const { data, error } = await supabaseClient
        .from("live_challenges")
        .select("*")
        .eq("game_id", safeGameId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return error
        ? handleError("Fehler beim Laden der aktiven Live-Challenge:", error, null)
        : (data || null);
    },

    /**
     * Laedt die neueste Live-Challenge eines Spiels.
     */
    async loadLatestForGame(gameId = getDefaultGameId()) {
      const safeGameId = normalizeId(gameId);
      if (!safeGameId) return null;

      const { data, error } = await supabaseClient
        .from("live_challenges")
        .select(`
          *,
          players:winner_player_id (
            username,
            display_name
          )
        `)
        .eq("game_id", safeGameId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return error
        ? handleError("Fehler beim Laden der letzten Live-Challenge:", error, null)
        : (data || null);
    },

    /**
     * Laedt alle player_live_challenges.
     */
    async loadAllPlayerLiveChallenges() {
      const { data, error } = await supabaseClient
        .from("player_live_challenges")
        .select("*");

      return error
        ? handleError("Fehler beim Laden aller player_live_challenges:", error, [])
        : (data || []);
    },

    /**
     * Laedt abgeschlossene Live-Challenges eines Spielers fuer ein Spiel.
     * Die Rueckgabe ist fuer die bestehende Profil-UI bereits gemappt.
     */
    async loadCompletedForPlayer(playerId = getDefaultPlayerId(), gameId = getDefaultGameId()) {
      const safePlayerId = normalizeId(playerId);
      const safeGameId = normalizeId(gameId);
      if (!safePlayerId || !safeGameId) return [];

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
        .eq("player_id", safePlayerId)
        .eq("game_id", safeGameId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });

      if (error) {
        return handleError("Fehler beim Laden abgeschlossener Live-Challenges:", error, []);
      }

      return (data || []).map(row => ({
        type: "live",
        challengeId: row.live_challenge_id,
        title: row.live_challenges?.title || "Spontanchallenge",
        completedAt: row.completed_at,
        points: row.points_awarded || 0,
        proofImagePath: row.proof_image_path || null
      }));
    },

    /**
     * Laedt Gewinnername und Gewinnerbild einer Live-Challenge.
     */
    async loadWinner(liveChallengeId) {
      const safeLiveChallengeId = normalizeId(liveChallengeId);
      if (!safeLiveChallengeId) return null;

      const { data, error } = await supabaseClient
        .from("player_live_challenges")
        .select(`
          player_id,
          proof_image_path,
          points_awarded,
          players (
            display_name,
            username
          )
        `)
        .eq("live_challenge_id", safeLiveChallengeId)
        .gt("points_awarded", 0)
        .maybeSingle();

      if (error) {
        return handleError("Fehler beim Laden des Live-Challenge-Gewinners:", error, null);
      }

      if (!data) return null;

      return {
        name: data.players?.display_name || data.players?.username || "Unbekannt",
        imagePath: data.proof_image_path || null
      };
    }
  };

  /* ============================================================
   * 10. LIVE-CHALLENGE-VIEWS
   * ============================================================ */

  const liveViews = {
    /**
     * Laedt alle Live-Challenge-View-Zeilen.
     */
    async loadAll() {
      const { data, error } = await supabaseClient
        .from("player_live_challenge_views")
        .select("*");

      return error
        ? handleError("Fehler beim Laden aller Live-Challenge-Views:", error, [])
        : (data || []);
    },

    /**
     * Laedt alle View-Zeilen eines Spielers.
     */
    async loadForPlayer(playerId = getDefaultPlayerId()) {
      const safePlayerId = normalizeId(playerId);
      if (!safePlayerId) return [];

      const { data, error } = await supabaseClient
        .from("player_live_challenge_views")
        .select("*")
        .eq("player_id", safePlayerId);

      return error
        ? handleError("Fehler beim Laden der Live-Challenge-Views eines Spielers:", error, [])
        : (data || []);
    },

    /**
     * Laedt einen einzelnen View-State eines Spielers fuer eine Live-Challenge.
     */
    async loadForPlayerAndLiveChallenge(playerId = getDefaultPlayerId(), liveChallengeId) {
      const safePlayerId = normalizeId(playerId);
      const safeLiveChallengeId = normalizeId(liveChallengeId);
      if (!safePlayerId || !safeLiveChallengeId) return null;

      const { data, error } = await supabaseClient
        .from("player_live_challenge_views")
        .select("*")
        .eq("player_id", safePlayerId)
        .eq("live_challenge_id", safeLiveChallengeId)
        .maybeSingle();

      return error
        ? handleError("Fehler beim Laden des Live-Challenge-View-Status:", error, null)
        : (data || null);
    }
  };

  /* ============================================================
 * 11. ACTIVITY LOGS
 * ============================================================ */

const logs = {

  /**
   * Laedt Activity-Logs mit optionalen Filtern.
   */
  async loadActivityLogs({
    gameId = null,
    playerId = null,
    adminPlayerId = null,
    eventType = null,
    limit = 100,
    beforeCreatedAt = null
  } = {}) {

    let query = supabaseClient
      .from("activity_logs")
      .select(SELECT_ACTIVITY_LOGS_DETAILED)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (gameId) {
      query = query.eq("game_id", gameId);
    }

    if (playerId) {
      query = query.eq("player_id", playerId);
    }

    if (adminPlayerId) {
      query = query.eq("admin_player_id", adminPlayerId);
    }

    if (eventType) {
      if (Array.isArray(eventType)) {
        query = query.in("event_type", eventType);
      } else {
        query = query.eq("event_type", eventType);
      }
    }

    if (beforeCreatedAt) {
      query = query.lt("created_at", beforeCreatedAt);
    }

    const { data, error } = await query;

    return error
      ? handleError("Fehler beim Laden der Activity-Logs:", error, [])
      : (data || []);
  },

  /**
   * Letzten Logeintrag eines Spielers in einem Spiel laden.
   */
  async loadLastForPlayerInGame(playerId, gameId) {

    if (!playerId || !gameId) {
      return null;
    }

    const { data, error } = await supabaseClient
      .from("activity_logs")
      .select(SELECT_ACTIVITY_LOGS_DETAILED)
      .eq("player_id", playerId)
      .eq("game_id", gameId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return error
      ? handleError("Fehler beim Laden der letzten Spieleraktivität:", error, null)
      : (data || null);
  }

};

  /* ============================================================
   * 12. STORAGE / PUBLIC URLS
   * ============================================================ */

  const storage = {
    /**
     * Liefert die public URL fuer ein Beweisfoto.
     */
    getProofPhotoPublicUrl(path) {
      if (!path) return null;

      const { data } = supabaseClient.storage
        .from("proof-photos")
        .getPublicUrl(path);

      return data?.publicUrl || null;
    }
  };

  /* ============================================================
   * 13. COMBINED LOADERS / BUNDLES
   * ============================================================ */

  const bundles = {
    /**
     * Bootstrap-Daten fuer die Spielerseite.
     */
    async loadPlayerGameBootstrap({ playerId = getDefaultPlayerId(), gameId = getDefaultGameId() } = {}) {
      const safePlayerId = normalizeId(playerId);
      const safeGameId = normalizeId(gameId);

      if (!safePlayerId || !safeGameId) {
        return {
          game: null,
          challenges: [],
          playerState: null,
          playerChallenges: [],
          playerBingos: [],
          globalChallengeRows: [],
          leaderboard: []
        };
      }

      const game = await games.loadById(safeGameId);

      const [
        challengeRows,
        ensuredState,
        playerChallengeRows,
        bingoRows,
        globalChallengeRows,
        leaderboard
      ] = await Promise.all([
        challenges.loadForGame(safeGameId),
        playerState.ensureForPlayerAndGame(safePlayerId, safeGameId),
        playerChallenges.loadForPlayerAndGame(safePlayerId, safeGameId),
        playerBingos.loadForPlayerAndGame(safePlayerId, safeGameId),
        playerChallenges.loadGlobalStatsRows(safeGameId),
        stats.loadLeaderboard(safeGameId)
      ]);

      return {
        game,
        challenges: challengeRows,
        playerState: ensuredState,
        playerChallenges: playerChallengeRows,
        playerBingos: bingoRows,
        globalChallengeRows,
        leaderboard
      };
    },

    /**
     * Schnelle Polling-Daten fuer die Spielerseite.
     */
    async loadPlayerFastState({ playerId = getDefaultPlayerId(), gameId = getDefaultGameId() } = {}) {
      const safePlayerId = normalizeId(playerId);
      const safeGameId = normalizeId(gameId);

      if (!safePlayerId || !safeGameId) {
        return {
          playerState: null,
          playerChallenges: [],
          playerBingos: [],
          globalChallengeRows: [],
          leaderboard: [],
          activeLiveChallenge: null
        };
      }

      const [
        stateRow,
        playerChallengeRows,
        bingoRows,
        globalChallengeRows,
        leaderboard,
        activeLiveChallenge
      ] = await Promise.all([
        playerState.loadForPlayerAndGame(safePlayerId, safeGameId),
        playerChallenges.loadForPlayerAndGame(safePlayerId, safeGameId),
        playerBingos.loadForPlayerAndGame(safePlayerId, safeGameId),
        playerChallenges.loadGlobalStatsRows(safeGameId),
        stats.loadLeaderboard(safeGameId),
        live.loadActiveForGame(safeGameId)
      ]);

      return {
        playerState: stateRow,
        playerChallenges: playerChallengeRows,
        playerBingos: bingoRows,
        globalChallengeRows,
        leaderboard,
        activeLiveChallenge
      };
    },

    /**
     * Langsame Polling-Daten fuer die Spielerseite.
     * Enthalten sind Stammdaten, die sich selten aendern.
     */
    async loadPlayerSlowState({ gameId = getDefaultGameId() } = {}) {
      const safeGameId = normalizeId(gameId);

      const [
        activeGames,
        currentGame,
        challengeRows
      ] = await Promise.all([
        games.loadActive(),
        games.loadById(safeGameId),
        challenges.loadForGame(safeGameId)
      ]);

      return {
        activeGames,
        currentGame,
        challenges: challengeRows
      };
    },

    /**
     * Gemeinsamer Admin-Core fuer mehrere Tabs.
     */
    async loadAdminCore() {
      const [
        playerRows,
        gameRows,
        stateRows,
        challengeProgressRows,
        bingoRows,
        challengeRows
      ] = await Promise.all([
        players.loadAllSafe(),
        games.loadAll(),
        playerState.loadAll(),
        playerChallenges.loadAllActiveAndCompleted(),
        playerBingos.loadAll(),
        challenges.loadAllBasic()
      ]);

      return {
        players: playerRows,
        games: gameRows,
        playerStates: stateRows,
        playerChallenges: challengeProgressRows,
        playerBingos: bingoRows,
        challenges: challengeRows
      };
    },

    /**
     * Datenpaket fuer den Players-Tab.
     */
    async loadAdminPlayersTab() {
      return await bundles.loadAdminCore();
    },

    /**
     * Datenpaket fuer den Games-Tab.
     * Nutzt detaillierte Challenge-Daten.
     */
    async loadAdminGamesTab() {
      const [
            playerRows,
            gameRows,
            stateRows,
            challengeProgressRows,
            challengeRows,
            bingoRows
            ] = await Promise.all([
            players.loadAllSafe(),
            games.loadAll(),
            playerState.loadAll(),
            playerChallenges.loadAllActiveAndCompleted(),
            challenges.loadAllDetailed(),
            playerBingos.loadAll()
            ]);

      return {
        players: playerRows,
        games: gameRows,
        playerStates: stateRows,
        playerChallenges: challengeProgressRows,
        challenges: challengeRows,
        playerBingos: bingoRows
        };
    },

    /**
     * Datenpaket fuer den Live-Tab.
     */
    async loadAdminLiveTab() {
      const [
        playerRows,
        gameRows,
        stateRows,
        liveRows,
        playerLiveRows,
        liveViewRows
      ] = await Promise.all([
        players.loadAllSafe(),
        games.loadAll(),
        playerState.loadAll(),
        live.loadAllWithWinner(),
        live.loadAllPlayerLiveChallenges(),
        liveViews.loadAll()
      ]);

      return {
        players: playerRows,
        games: gameRows,
        playerStates: stateRows,
        liveChallenges: liveRows,
        playerLiveChallenges: playerLiveRows,
        liveChallengeViews: liveViewRows
      };
    },

    /**
     * Datenpaket fuer das Dashboard.
     */
    async loadAdminDashboard({ gameId = getDefaultGameId(), logLimit = 5 } = {}) {
      const [
        core,
        activeGames,
        currentGame,
        liveRows,
        logRows
      ] = await Promise.all([
        bundles.loadAdminCore(),
        games.loadActive(),
        games.loadById(gameId),
        live.loadAll(),
        logs.loadActivityLogs({
            gameId: adminCurrentGameId || null,
            limit: logLimit
            })
      ]);

      return {
        ...core,
        activeGames,
        currentGame,
        liveChallenges: liveRows,
        logs: logRows
      };
    },

    /**
     * Datenpaket fuer die Admin-Galerie.
     */
    async loadAdminGallery() {
      const [
        playerRows,
        gameRows,
        challengeProgressRows,
        challengeRows,
        liveRows,
        playerLiveRows
      ] = await Promise.all([
        players.loadAllSafe(),
        games.loadAll(),
        playerChallenges.loadAllActiveAndCompleted(),
        challenges.loadAllDetailed(),
        live.loadAllWithWinner(),
        live.loadAllPlayerLiveChallenges()
      ]);

      return {
        players: playerRows,
        games: gameRows,
        playerChallenges: challengeProgressRows,
        challenges: challengeRows,
        liveChallenges: liveRows,
        playerLiveChallenges: playerLiveRows
      };
    }
  };

  /* ============================================================
   * PUBLIC API
   * ============================================================ */

  return {
    games,
    players,
    challenges,
    playerState,
    playerChallenges,
    playerBingos,
    stats,
    live,
    liveViews,
    logs,
    storage,
    bundles,

    helpers: {
      getDefaultGameId,
      getDefaultPlayerId,
      normalizeId,
      handleError
    }
  };
})();

/* ============================================================
 * 14. KOMPATIBILITAETS-WRAPPER
 * ============================================================
 *
 * Diese Wrapper sind optional.
 * Sie ermoeglichen spaeter einen sanften Umbau der bestehenden Dateien.
 * Bestehende Funktionen koennen intern auf DataService umgestellt werden,
 * ohne dass sofort alle Aufrufer geaendert werden muessen.
 *
 * Wichtig:
 * Diese Wrapper werden hier NICHT automatisch als Ersatz fuer bestehende
 * Funktionen definiert, damit es keine Namenskonflikte gibt.
 *
 * Beispiel spaeter in data.js:
 *
 * async function loadAllGames() {
 *   return await DataService.games.loadActive();
 * }
 *
 * Beispiel spaeter in admin_players.js:
 *
 * async function loadAllPlayersForAdmin() {
 *   adminPlayers = await DataService.players.loadAllSafe();
 * }
 */