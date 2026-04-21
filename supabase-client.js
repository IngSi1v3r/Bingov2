const SUPABASE_URL = "https://dzririwzipewnbwfekkx.supabase.co";
const SUPABASE_KEY = "sb_publishable_XX10TnpwP3JBSD4Wur_vlA_y9nwOq5t";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("Supabase Client erstellt:", supabaseClient);



/**
 * ============================================================
 * SUPABASE DATENSTRUKTUR - BINGO WEB APP
 * ============================================================
 *
 * Diese Übersicht dokumentiert die wichtigsten Tabellen der
 * Supabase-Datenbank, deren Spalten sowie die Beziehungen
 * untereinander.
 *
 * Ziel:
 * - Schnell nachvollziehen, welche Daten gespeichert werden
 * - Verstehen, wie Spieler, Spiele, Aufgaben und Logs zusammenhängen
 * - Später bei Wartung, Debugging und Erweiterungen helfen
 *
 *
 * ============================================================
 * GRUNDLOGIK DES SYSTEMS
 * ============================================================
 *
 * Es gibt:
 * - Spieler (players)
 * - Spiele (games)
 * - Aufgaben pro Spiel (challenges)
 * - Fortschritt eines Spielers pro Spiel (player_game_state)
 * - Status einer Aufgabe pro Spieler (player_challenges)
 * - Bingo-Boni pro Spieler (player_bingos)
 * - Live-/Spontan-Challenges (live_challenges)
 * - Teilnahme bzw. Abschluss von Live-Challenges (player_live_challenges)
 * - Sichtbarkeit / Anzeigehistorie von Live-Challenges (player_live_challenge_views)
 * - Aktivitätsprotokoll / Logs (activity_logs)
 *
 *
 * ============================================================
 * 1) players
 * ============================================================
 *
 * Zweck:
 * - Enthält alle Benutzerkonten
 * - Sowohl normale Spieler als auch Admins
 *
 * Spalten:
 * - id                bigint, PK
 * - username          text, eindeutig
 * - pin_hash          text
 * - role              text ('player' | 'admin')
 * - is_blocked        boolean
 * - created_at        timestamptz
 * - display_name      text, optional
 *
 * Hinweise:
 * - username ist eindeutig
 * - role unterscheidet Spieler und Admin
 * - is_blocked kann verwendet werden, um Spieler zu sperren
 *
 *
 * ============================================================
 * 2) games
 * ============================================================
 *
 * Zweck:
 * - Definiert einzelne Bingo-Spiele
 * - Jedes Spiel hat eigene Grid-Größe, Cooldown und Bonusregeln
 *
 * Spalten:
 * - id                bigint, PK
 * - name              text
 * - grid_size         integer, Standard: 5
 * - cooldown_seconds  integer, Standard: 3600
 * - bingo_bonus_points integer, Standard: 5
 * - is_active         boolean
 * - created_at        timestamptz
 *
 * Hinweise:
 * - Ein Spiel enthält viele Challenges
 * - Spieler können in mehreren Spielen parallel einen Spielstand haben
 *
 *
 * ============================================================
 * 3) challenges
 * ============================================================
 *
 * Zweck:
 * - Enthält die normalen Bingo-Felder / Aufgaben eines Spiels
 *
 * Spalten:
 * - id                    bigint, PK
 * - game_id               bigint, FK -> games.id
 * - position              integer
 * - title                 text
 * - task                  text
 * - points                integer (nur 1, 2 oder 3)
 * - is_active             boolean
 * - created_at            timestamptz
 * - category_icon         text, optional
 * - details               text, optional
 * - success_text          text, optional
 * - requires_photo_proof  boolean
 *
 * Constraints:
 * - (game_id, position) ist eindeutig
 * - points darf nur 1, 2 oder 3 sein
 *
 * Hinweise:
 * - position entspricht der Feldposition im Grid
 * - Jede Challenge gehört genau zu einem Spiel
 *
 *
 * ============================================================
 * 4) player_game_state
 * ============================================================
 *
 * Zweck:
 * - Speichert den aktuellen Gesamtstatus eines Spielers in einem Spiel
 * - Also Punktestand, aktive Challenge und Cooldown
 *
 * Spalten:
 * - id                   bigint, PK
 * - player_id            bigint, FK -> players.id
 * - game_id              bigint, FK -> games.id
 * - score                integer
 * - active_challenge_id  bigint, FK -> challenges.id, optional
 * - cooldown_until       timestamptz, optional
 * - created_at           timestamptz
 * - updated_at           timestamptz
 *
 * Constraints:
 * - (player_id, game_id) ist eindeutig
 *
 * Hinweise:
 * - Pro Spieler und Spiel genau ein Datensatz
 * - active_challenge_id zeigt auf die aktuell laufende Aufgabe
 * - cooldown_until sperrt neue Aufgaben bis zu diesem Zeitpunkt
 *
 *
 * ============================================================
 * 5) player_challenges
 * ============================================================
 *
 * Zweck:
 * - Speichert den Status jeder normalen Challenge für jeden Spieler
 *
 * Spalten:
 * - id                bigint, PK
 * - player_id         bigint, FK -> players.id
 * - game_id           bigint, FK -> games.id
 * - challenge_id      bigint, FK -> challenges.id
 * - status            text ('hidden' | 'active' | 'completed')
 * - completed_at      timestamptz, optional
 * - was_first_solver  boolean
 * - points_awarded    integer, optional
 * - created_at        timestamptz
 * - updated_at        timestamptz
 * - proof_image_path  text, optional
 *
 * Constraints:
 * - (player_id, challenge_id) ist eindeutig
 *
 * Hinweise:
 * - Diese Tabelle beschreibt den individuellen Aufgabenfortschritt
 * - hidden    = noch nicht sichtbar / noch nicht gestartet
 * - active    = aktuell aktiv
 * - completed = erfolgreich abgeschlossen
 * - was_first_solver markiert, ob der Spieler diese Aufgabe als Erster gelöst hat
 * - points_awarded speichert die tatsächlich vergebenen Punkte
 *
 *
 * ============================================================
 * 6) player_bingos
 * ============================================================
 *
 * Zweck:
 * - Speichert bereits vergebene Bingo-Linien-Boni
 * - Verhindert doppelte Vergabe derselben Linie
 *
 * Spalten:
 * - id            bigint, PK
 * - player_id     bigint, FK -> players.id
 * - game_id       bigint, FK -> games.id
 * - line_key      text
 * - bonus_points  integer
 * - awarded_at    timestamptz
 *
 * Constraints:
 * - (player_id, game_id, line_key) ist eindeutig
 *
 * Hinweise:
 * - line_key beschreibt die fertige Linie
 *   z. B. "row_0", "col_3", "diag_main", "diag_anti"
 *
 *
 * ============================================================
 * 7) live_challenges
 * ============================================================
 *
 * Zweck:
 * - Enthält spontane / globale Live-Challenges innerhalb eines Spiels
 * - Diese laufen unabhängig von normalen Grid-Challenges
 *
 * Spalten:
 * - id                    bigint, PK
 * - game_id               bigint, FK -> games.id
 * - title                 text
 * - description           text
 * - points                integer
 * - requires_photo_proof  boolean
 * - status                text ('active' | 'completed' | 'expired' | 'inactive')
 * - winner_player_id      bigint, FK -> players.id, optional
 * - winner_completed_at   timestamptz, optional
 * - created_at            timestamptz
 * - completed_at          timestamptz, optional
 * - expires_at            timestamptz, optional
 * - scheduled_start_at    timestamptz, optional
 * - duration_minutes      integer, optional
 *
 * Hinweise:
 * - Eine Live-Challenge gehört zu genau einem Spiel
 * - winner_player_id ist gesetzt, wenn jemand gewinnt
 * - status beschreibt den aktuellen Zustand
 *
 *
 * ============================================================
 * 8) player_live_challenges
 * ============================================================
 *
 * Zweck:
 * - Speichert, wie ein Spieler an einer Live-Challenge beteiligt war
 * - Vor allem für Abschluss oder Dismiss
 *
 * Spalten:
 * - id               bigint, PK
 * - live_challenge_id bigint, FK -> live_challenges.id
 * - player_id        bigint, FK -> players.id
 * - game_id          bigint, FK -> games.id
 * - status           text ('completed' | 'dismissed')
 * - points_awarded   integer
 * - proof_image_path text, optional
 * - completed_at     timestamptz
 *
 * Constraints:
 * - (live_challenge_id, player_id) ist eindeutig
 *
 * Hinweise:
 * - Pro Spieler und Live-Challenge maximal ein Eintrag
 * - completed = Spieler hat abgeschlossen
 * - dismissed = Challenge wurde vom Spieler weggeklickt / verworfen
 *
 *
 * ============================================================
 * 9) player_live_challenge_views
 * ============================================================
 *
 * Zweck:
 * - Speichert, ob bzw. wann ein Spieler eine Live-Challenge gesehen hat
 * - Dient zur Sichtbarkeits- und Anzeigeauswertung
 *
 * Spalten:
 * - id                bigserial, PK
 * - player_id         bigint, FK -> players.id
 * - live_challenge_id bigint, FK -> live_challenges.id
 * - seen_start_at     timestamptz, optional
 * - seen_end_at       timestamptz, optional
 * - created_at        timestamptz
 * - dismissed_at      timestamptz, optional
 *
 * Constraints:
 * - (player_id, live_challenge_id) ist eindeutig
 *
 * Hinweise:
 * - Diese Tabelle ist rein für Anzeige-/Trackinglogik
 * - Sie ist getrennt von player_live_challenges, weil "gesehen"
 *   nicht automatisch "abgeschlossen" bedeutet
 *
 *
 * ============================================================
 * 10) activity_logs
 * ============================================================
 *
 * Zweck:
 * - Zentrales Aktivitätsprotokoll für Gameplay, Live-Challenges
 *   und Admin-Aktionen
 *
 * Spalten:
 * - id                 bigint, PK
 * - created_at         timestamptz
 * - game_id            bigint, FK -> games.id, optional
 * - player_id          bigint, FK -> players.id, optional
 * - admin_player_id    bigint, FK -> players.id, optional
 * - challenge_id       bigint, FK -> challenges.id, optional
 * - live_challenge_id  bigint, FK -> live_challenges.id, optional
 * - event_type         text
 * - entity_type        text, optional
 * - entity_id          bigint, optional
 * - points_delta       integer, optional
 * - message            text, optional
 * - metadata           jsonb
 *
 * event_type erlaubt aktuell:
 * - challenge_started
 * - challenge_completed
 * - challenge_failed
 * - challenge_reset
 * - bingo_awarded
 * - points_awarded
 * - photo_uploaded
 * - live_challenge_created
 * - live_challenge_completed
 * - live_challenge_expired
 * - live_challenge_manually_ended
 * - admin_player_blocked
 * - admin_player_unblocked
 * - admin_score_changed
 * - admin_cooldown_changed
 * - admin_player_game_reset
 * - admin_player_deleted
 * - admin_game_created
 * - admin_game_deleted
 * - admin_game_duplicated
 * - admin_game_updated
 * - admin_challenge_updated
 *
 * Hinweise:
 * - player_id = betroffener Spieler
 * - admin_player_id = handelnder Admin
 * - metadata enthält flexible Zusatzinfos als JSON
 * - points_delta kann positive oder negative Punktänderungen speichern
 *
 *
 * ============================================================
 * WICHTIGE BEZIEHUNGEN
 * ============================================================
 *
 * players
 *   -> player_game_state
 *   -> player_challenges
 *   -> player_bingos
 *   -> player_live_challenges
 *   -> player_live_challenge_views
 *   -> activity_logs (player_id / admin_player_id)
 *
 * games
 *   -> challenges
 *   -> player_game_state
 *   -> player_challenges
 *   -> player_bingos
 *   -> live_challenges
 *   -> player_live_challenges
 *   -> activity_logs
 *
 * challenges
 *   -> player_challenges
 *   -> player_game_state.active_challenge_id
 *   -> activity_logs
 *
 * live_challenges
 *   -> player_live_challenges
 *   -> player_live_challenge_views
 *   -> activity_logs
 *
 *
 * ============================================================
 * TYPISCHER DATENFLUSS IM SPIEL
 * ============================================================
 *
 * 1. Admin erstellt ein Spiel
 *    -> games
 *
 * 2. Admin erstellt die Aufgaben des Spielfelds
 *    -> challenges
 *
 * 3. Spieler nimmt an einem Spiel teil
 *    -> player_game_state
 *    -> ggf. player_challenges initialisieren
 *
 * 4. Spieler aktiviert eine Aufgabe
 *    -> player_game_state.active_challenge_id
 *    -> player_challenges.status = 'active'
 *    -> activity_logs: challenge_started
 *
 * 5. Spieler löst eine Aufgabe
 *    -> player_challenges.status = 'completed'
 *    -> player_challenges.completed_at
 *    -> player_challenges.points_awarded
 *    -> player_game_state.score erhöhen
 *    -> player_game_state.active_challenge_id = null
 *    -> cooldown_until setzen
 *    -> ggf. player_bingos Einträge erzeugen
 *    -> activity_logs schreiben
 *
 * 6. Admin erstellt spontane Live-Challenge
 *    -> live_challenges
 *    -> activity_logs
 *
 * 7. Spieler sieht / schließt Live-Challenge ab
 *    -> player_live_challenge_views
 *    -> player_live_challenges
 *    -> ggf. live_challenges.winner_player_id
 *    -> activity_logs
 *
 *
 * ============================================================
 * WICHTIGE TECHNISCHE HINWEISE
 * ============================================================
 *
 * - Mehrere Tabellen haben ON DELETE CASCADE:
 *   Beim Löschen eines Spiels verschwinden also auch abhängige Daten.
 *
 * - Einige Fremdschlüssel sind ON DELETE SET NULL:
 *   Referenzen bleiben dann erhalten, auch wenn z. B. ein Spieler
 *   oder eine Challenge gelöscht wurde.
 *
 * - updated_at wird bei player_challenges und player_game_state
 *   automatisch per Trigger gepflegt.
 *
 * - metadata in activity_logs ist flexibel erweiterbar und eignet
 *   sich für zusätzliche Debug- oder Kontextinformationen.
 *
 * * ============================================================
 * STATUSWERTE / ENUM-LOGIK
 * ============================================================
 *
 * player_challenges.status:
 * - hidden
 * - active
 * - completed
 *
 * player_live_challenges.status:
 * - completed
 * - dismissed
 *
 * live_challenges.status:
 * - active
 * - completed
 * - expired
 * - cancelled
 *
 * players.role:
 * - player
 * - admin
 */