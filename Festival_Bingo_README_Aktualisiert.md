# Festival Bingo - README

## Inhaltsverzeichnis

1. Projektueberblick
2. Spielidee, Zielgruppe und geplanter Einsatz
3. Spielregeln und Spielmechanik
4. Spielerfunktionen
5. Adminfunktionen
6. Technische Architektur
7. Dateiuebersicht
8. Datenbankstruktur
9. Authentifizierung und Sicherheit
10. Push-Benachrichtigungen
11. Polling und Live-Aktualisierung
12. Foto-Upload und Galerie
13. Activity Logs
14. Typische Ablaufe
15. Entwicklungsstand und offene Punkte
16. Wartung, Debugging und Weiterentwicklung

---

# 1. Projektueberblick

**Festival Bingo** ist eine mobile Multiplayer-Web-App fuer kleine private Gruppen. Mehrere Spieler spielen gemeinsam auf einem Bingo-Feld, loesen Aufgaben, sammeln Punkte und konkurrieren um First-Solver-Boni, Bingo-Linien und spontane Live-Challenges.

Das Projekt ist bewusst pragmatisch aufgebaut:

- kein Framework
- kein komplexes Build-System
- mobile-first
- leicht hostbar ueber GitHub Pages
- Backend ueber Supabase
- Bilder ueber Supabase Storage
- Push-Nachrichten ueber OneSignal und Supabase Edge Functions
- Aktualisierung ueber zentrales Polling

Die App ist fuer den praktischen Einsatz bei einem Event gedacht. Ziel ist nicht maximale Enterprise-Architektur, sondern ein stabiles, verstaendliches und schnell wartbares System.

---

# 2. Spielidee, Zielgruppe und geplanter Einsatz

## 2.1 Zielgruppe

Das Spiel ist gedacht fuer:

- Festivals
- Partys
- Geburtstage
- Freundesgruppen
- Wochenendtrips
- kleine private Events
- Gruppen mit ca. 10 bis 20 Spielern

Die Bedienung soll auch fuer technisch weniger versierte Personen funktionieren. Der Hauptfokus liegt daher auf einfacher Nutzung am Smartphone.

## 2.2 Ziel des Spiels

Alle Spieler sehen dasselbe Bingo-Spielfeld. Jedes Feld steht fuer eine Aufgabe. Spieler starten Aufgaben, erledigen sie, laden bei Bedarf ein Beweisfoto hoch und erhalten Punkte.

Zusatzpunkte gibt es fuer:

- First Solver einer Aufgabe
- Bingo-Linien
- First Bingo pro Linie
- spontane Live-Challenges

## 2.3 Grundprinzip

- Alle Spieler spielen im selben Spiel auf demselben Grid.
- Jeder Spieler hat seinen eigenen Fortschritt.
- Pro Spieler kann immer nur eine normale Aufgabe aktiv sein.
- Aufgaben koennen bestanden oder aufgegeben werden.
- Beim Aufgeben startet ein Cooldown.
- Geloeste Aufgaben bleiben fuer den Spieler abgeschlossen.
- Andere Spieler koennen dieselben Aufgaben ebenfalls loesen.
- Der erste erfolgreiche Solver einer Aufgabe bekommt doppelte Punkte.
- Reihen, Spalten und Diagonalen geben Bingo-Boni.
- Admins koennen Spiele, Spieler, Aufgaben, Live-Challenges, Logs, Galerie und Push-Nachrichten verwalten.

---

# 3. Spielregeln und Spielmechanik

## 3.1 Spielfeld

Das Spielfeld ist dynamisch. Die Gridgroesse wird je Spiel gespeichert.

Moegliche Groessen:

- 3 x 3
- 4 x 4
- 5 x 5
- 6 x 6
- 7 x 7

Der Standardfall ist ein 5 x 5 Bingo-Feld.

Jedes Feld besitzt eine Position. Die Position bestimmt die Lage im Grid und wird auch fuer Bingo-Linien verwendet.

## 3.2 Normale Challenges

Eine normale Challenge ist ein Feld im Bingo-Grid.

Eine Challenge kann enthalten:

- Titel
- Aufgabenbeschreibung
- Punktewert
- Kategorie-Icon
- Zusatzhinweise
- Erfolgs-/Gratulationstext
- Aufgabenbild
- Fotopflicht
- Aktiv/Inaktiv-Status
- fixe Punkte oder variable Erfolgsvarianten

## 3.3 Fixe Punkte

Eine Aufgabe kann einen fixen Punktewert haben.

Beispiel:

- Aufgabe A: 1 Punkt
- Aufgabe B: 2 Punkte
- Aufgabe C: 3 Punkte

Beim Abschluss wird dieser Punktewert vergeben. Ist der Spieler der erste Solver, wird der Punktewert verdoppelt.

## 3.4 Variable Punkte

Eine Aufgabe kann auch variable Erfolgsstufen besitzen. In diesem Fall ist der fixe Punktewert leer/null und es werden Erfolgsvarianten verwendet.

Beispiel:

- 1P: einfache Variante
- 2P: mittlere Variante
- 3P: schwierige Variante

In der Spieler-UI ersetzt dann eine Auswahl der Erfolgsstufe den normalen "Bestanden"-Button. Der Spieler waehlt beim Abschluss, welche Stufe er geschafft hat.

Gespeichert werden:

- ausgewaehlte Erfolgsstufe
- vergebene Punkte
- optionales Foto
- Logeintrag
- Anzeige in Profil/Galerie/Logs

## 3.5 Aktive Aufgabe

Ein Spieler kann immer nur eine Aufgabe gleichzeitig aktiv haben.

Ablauf:

1. Spieler tippt auf ein Feld.
2. System prueft:
   - Spieler ist eingeloggt
   - Spiel ist aktiv
   - Spieler ist nicht gesperrt
   - Spieler ist nicht im Cooldown
   - Spieler hat keine andere aktive Aufgabe
   - Feld ist aktiv
   - Feld wurde vom Spieler noch nicht geloest
3. Aufgabe wird in der Datenbank als aktiv gespeichert.
4. Spieler sieht das Challenge-Modal.
5. Andere Spieler sehen im Grid, dass das Feld gerade versucht wird.

## 3.6 Aufgabe abschliessen

Beim Abschluss einer Aufgabe passiert:

1. First-Solver-Status wird geprueft.
2. Punkte werden berechnet.
3. Challenge wird als abgeschlossen gespeichert.
4. Score wird aktualisiert.
5. aktive Aufgabe wird entfernt.
6. Cooldown wird geloescht.
7. Bingo-Linien werden geprueft.
8. neue Bingos werden gespeichert.
9. Activity Logs werden geschrieben.
10. UI wird aktualisiert.
11. Animationen werden angezeigt.

Bei Fotopflicht wird zuerst das Upload-Modal geoeffnet. Erst nach erfolgreichem Upload wird die Aufgabe abgeschlossen.

## 3.7 Aufgabe aufgeben

Beim Aufgeben passiert:

1. Spieler bestaetigt die Aufgabe im Confirm-Modal.
2. Die Aufgabe wird nicht als completed gespeichert.
3. active_challenge_id wird entfernt.
4. player_challenges-Status wird zurueckgesetzt bzw. versteckt.
5. Cooldown wird gesetzt.
6. Activity Log wird geschrieben.
7. UI wird aktualisiert.

Der Spieler kann die Aufgabe spaeter erneut versuchen.

## 3.8 Cooldown

Der Cooldown ist pro Spiel konfigurierbar.

Solange der Cooldown aktiv ist:

- kann der Spieler keine neue normale Aufgabe starten
- wird ein Cooldown-Hinweis angezeigt
- der Cooldown laeuft in der UI sichtbar herunter
- der Spieler bleibt im Leaderboard sichtbar

Optional koennen Push-Benachrichtigungen fuer abgelaufene Cooldowns verwendet werden.

## 3.9 First Solver

Der erste Spieler, der eine Aufgabe erfolgreich abschliesst, bekommt doppelte Punkte.

Beispiel:

- Aufgabe: 3 Punkte
- erster Solver: 6 Punkte
- weitere Solver: 3 Punkte

Der First-Solver-Status wird in `player_challenges.was_first_solver` gespeichert.

## 3.10 Bingo-Linien

Bingo-Linien entstehen durch vollstaendige:

- Reihen
- Spalten
- Hauptdiagonale
- Gegendiagonale

Die Anzahl der Linien haengt von der Gridgroesse ab.

Bei 5 x 5:

- 5 Reihen
- 5 Spalten
- 2 Diagonalen
- insgesamt 12 moegliche Bingos

## 3.11 Bingo-Bonus

Wenn ein Spieler eine neue Bingo-Linie erreicht, bekommt er Bonuspunkte.

Der normale Bingo-Bonus ist pro Spiel konfigurierbar.

## 3.12 First-Bingo-Bonus pro Linie

Wenn ein Spieler als erster Spieler eine bestimmte Bingo-Linie erreicht, kann er zusaetzliche First-Bingo-Bonuspunkte bekommen.

Beispiel:

- normaler Bingo-Bonus: 5 Punkte
- First-Bingo-Bonus: 3 Punkte
- erster Spieler fuer diese Linie: 8 Punkte
- spaetere Spieler fuer dieselbe Linie: 5 Punkte

## 3.13 Erstes Bingo im gesamten Spiel

Das System kann erkennen, ob noch gar kein Bingo in einem Spiel vergeben wurde. Beim ersten Bingo im gesamten Spiel kann optional ein automatischer Push gesendet werden.

## 3.14 Live-Challenges

Live-Challenges sind spontane Zusatzaufgaben ausserhalb des normalen Bingo-Grids.

Eigenschaften:

- gehoeren zu genau einem Spiel
- koennen aktiv/inaktiv/beendet/expired sein
- koennen sofort gestartet werden
- koennen geplant werden
- koennen eine Dauer haben
- koennen Fotopflicht haben
- geben eigene Punkte
- haben meist nur einen Gewinner
- werden in Profil, Logs und Galerie beruecksichtigt

Ablauf:

1. Admin erstellt Live-Challenge.
2. Admin aktiviert sie sofort oder plant Startzeit.
3. Spieler sehen ein Live-Challenge-Modal.
4. Spieler koennen teilnehmen oder wegklicken.
5. Schnellster erfolgreicher Spieler gewinnt.
6. Punkte werden vergeben.
7. Live-Challenge wird beendet.
8. Ergebnis wird angezeigt.
9. Activity Logs und ggf. Push-Nachrichten werden erzeugt.

## 3.15 Foto-Beweise

Normale Challenges und Live-Challenges koennen ein Beweisfoto verlangen.

Upload-Optionen:

- Kamera oeffnen
- Bild aus Galerie waehlen
- Vorschau anzeigen
- hochladen
- mit Aufgabe speichern

Bilder werden in Supabase Storage gespeichert und spaeter ueber Public URLs angezeigt.

## 3.16 Spielstatus

Ein Spiel kann aktiv oder inaktiv sein.

Wenn ein Admin ein Spiel deaktiviert:

- Spieler im aktuellen Spiel bekommen ein Overlay
- offene Modals werden geschlossen
- Polling wird gestoppt
- Spieler muessen ein anderes Spiel auswaehlen

---

# 4. Spielerfunktionen

## 4.1 Registrierung

Spieler koennen sich mit Namen und Passwort registrieren.

Bei der Registrierung wird abgefragt:

- Anzeigename / Username
- Passwort
- Passwort-Wiederholung
- Session-Passwort

Das Session-Passwort verhindert, dass zufaellige Link-Besucher neue Spieler anlegen.

## 4.2 Login

Spieler melden sich mit Username und Passwort an.

Nach erfolgreichem Login wird eine lokale Session im Browser gespeichert.

## 4.3 Spielauswahl

Spieler sehen:

- eigene Spiele
- verfuegbare oeffentliche Spiele

Private Spiele erscheinen nicht frei verfuegbar, ausser der Spieler hat bereits einen Spielstand.

Passwortgeschuetzte Spiele verlangen beim Beitritt ein Spielpasswort.

## 4.4 Grid

Das Grid zeigt:

- Challenge-Titel
- Punkte oder Fragezeichen bei variablen Punkten
- Kategorie-Icon
- Foto-Symbol bei Fotopflicht
- geloeste Felder
- eigene aktiven Felder
- aktive Versuche anderer Spieler
- geloeste Anzahl pro Feld
- First-Solver-Markierung
- Bingo-Zellen

## 4.5 Challenge-Modal

Beim Oeffnen einer Challenge sieht der Spieler:

- Titel
- Beschreibung
- Aufgabenbild
- Punkte
- Hinweisbutton, falls Hinweise vorhanden sind
- Bestanden-/Upload-Button
- Aufgeben-Button
- bei variablen Aufgaben: Auswahl der Erfolgsstufe

## 4.6 Upload-Modal

Das Upload-Modal bietet:

- Aufgabe anzeigen
- Erfolgsstufe anzeigen, falls variabel
- Kamera-Button
- Galerie-Button
- Vorschau
- Upload-Button
- Zurueck-Button

## 4.7 Profil

Im Profil sieht der Spieler:

- Name
- Punkte
- abgeschlossene Aufgaben
- First Solver
- Bingos
- Bilder
- Rang
- Live-Challenge-Statistik
- Galerie
- abgeschlossene Aufgabenliste
- Push-Einstellungen
- Logout
- Fortschritt zuruecksetzen
- Profil loeschen

## 4.8 Leaderboard

Das Leaderboard zeigt:

- Rang
- Name
- Score
- aktive Spieler
- Spieler im Cooldown
- aktuelle eigene Position

## 4.9 Live-Challenge-Anzeige

Spieler sehen Live-Challenges als Overlay.

Moegliche Aktionen:

- Nicht interessiert
- Aufgabe bestanden
- Foto hochladen, falls erforderlich

Nach Abschluss/Ende sehen Spieler das Ergebnis.

## 4.10 Push-Einstellungen im Profil

Spieler koennen Push aktivieren oder deaktivieren und einstellen, welche Kategorien sie erhalten wollen:

- Live-Challenges
- Spielupdates
- Cooldown abgelaufen
- Admin-Nachrichten

## 4.11 Spieler kann eigenen Fortschritt zuruecksetzen

Der Spieler kann seinen eigenen Fortschritt fuer das aktuelle Spiel zuruecksetzen. Dabei werden abgeschlossene Aufgaben, Bingos und Score zurueckgesetzt.

## 4.12 Spieler kann eigenes Profil loeschen

Der Spieler kann sein Profil loeschen. Dabei werden zugehoerige Daten entfernt bzw. durch Datenbank-Cascades bereinigt.

---

# 5. Adminfunktionen

## 5.1 Adminpanel

Das Adminpanel ist eine eigene Seite: `admin.html`.

Tabs:

- Dashboard
- Spieler
- Spiele
- Live
- Galerie
- Logs
- Push

Admins melden sich mit einem Admin-Account an. Ein Admin ist ein Spieler mit `role = "admin"`.

## 5.2 Dashboard

Das Dashboard ist eine kompakte Uebersicht.

Es zeigt:

- aktive Spiele
- Spieler gesamt
- aktive Live-Challenges
- Auffaelligkeiten
- aktuelles Spiel
- Mini-Grid
- aktive Live-Challenge
- Top 5 Leaderboard
- letzte Logs
- Polling-Einstellungen
- Session-Passwort-Aenderung

Quicklinks erlauben Spruenge in passende Tabs.

## 5.3 Spieler-Tab

Der Spieler-Tab besteht aus:

- linker Spielerliste
- rechter Detailansicht

Spielerliste zeigt:

- Name
- Username
- Admin-Badge
- Sperrstatus
- Spielstatus
- Cooldown
- aktive Aufgabe
- geloeste Aufgaben
- First-Solver-Anzahl
- Anzahl Spiele
- Score
- kleines Mini-Grid

Detailansicht zeigt:

- Basisdaten
- Rolle
- Sperrstatus
- Spieler-ID
- Erstelldatum
- vorhandene Spielstaende
- Score
- aktive Aufgabe
- Cooldown
- abgeschlossene Aufgaben
- First Solver
- Bingos
- letzte Aktivitaet
- grosses Mini-Grid
- Galerie
- abgeschlossene Aufgabenliste

Admin-Aktionen:

- Spieler sperren/entsperren
- Passwort zuruecksetzen
- Spieler zu Admin machen
- Fortschritt zuruecksetzen
- Spieler loeschen
- Score bearbeiten
- Cooldown bearbeiten
- Spielstand anlegen
- Challenge manuell als bestanden markieren
- Challenge aktiv setzen
- Challenge inaktiv setzen
- Challenge aberkennen

## 5.4 Spiele-Tab

Der Spiele-Tab verwaltet alle Spiele.

Funktionen:

- Spiel erstellen
- Spiel duplizieren
- Spiel loeschen
- Spiel aktiv/inaktiv setzen
- Spielname bearbeiten
- Sichtbarkeit bearbeiten
- Spielpasswort setzen/entfernen
- Cooldown bearbeiten
- Bingo-Bonus bearbeiten
- First-Bingo-Bonus bearbeiten
- Aufgaben pruefen
- Challenge-Setup-Wizard oeffnen
- Grid anzeigen
- Bingo-Line-Indikatoren anzeigen
- Leaderboard anzeigen
- Challenge-Details oeffnen

Challenge-Bearbeitung:

- Titel bearbeiten
- Beschreibung bearbeiten
- Hinweise bearbeiten
- Success-Text bearbeiten
- Punkte bearbeiten
- variable Erfolgsstufen bearbeiten
- Kategorie-Icon bearbeiten
- Fotopflicht toggeln
- Aktiv/Inaktiv toggeln
- Aufgabenbild hochladen/entfernen
- Completion-Liste sehen
- Challenge-Galerie sehen

## 5.5 Challenge-Setup-Wizard

Der Wizard hilft beim Befuellen neuer Spiele.

Funktionen:

- Aufgabe fuer Position bearbeiten
- naechste/vorherige Aufgabe
- Aufgabe ueberspringen
- spaeter fertigstellen
- Werte auf restliche Aufgaben anwenden
- unvollstaendige Aufgaben pruefen

## 5.6 Live-Tab

Der Live-Tab verwaltet Live-Challenges.

Funktionen:

- neue Live-Challenge erstellen
- Titel setzen
- Beschreibung setzen
- Punkte setzen
- Dauer setzen
- Fotopflicht setzen
- sofort aktivieren
- geplanten Start setzen
- aktive Challenge beenden
- Challenge aktivieren
- Challenge pausieren
- Challenge manuell beenden
- Challenge loeschen
- Gewinner anzeigen
- Teilnehmer anzeigen
- gesehen/nicht gesehen/weggeklickt/abgeschlossen anzeigen
- globale und spielbezogene Statistik sehen

## 5.7 Galerie-Tab

Die Admin-Galerie sammelt alle Beweisfotos.

Quellen:

- normale Challenges
- Live-Challenges

Funktionen:

- alle Bilder anzeigen
- nach Spiel filtern
- nach Spieler filtern
- nach Aufgabe filtern
- nach Typ filtern
- nach Zeitraum filtern
- Freitextsuche
- Bildviewer
- Metadaten anzeigen
- Spieler anklicken -> Spieler-Tab
- Aufgabe anklicken -> Spiele-Tab
- Live-Challenge anklicken -> Live-Tab
- Spiel anklicken -> Spiele-Tab
- Bild in neuem Tab oeffnen
- Link kopieren
- Auswahlmodus
- sichtbare Bilder auswaehlen
- Auswahl teilen
- Auswahl downloaden

## 5.8 Logs-Tab

Der Logs-Tab zeigt das zentrale Activity Logging.

Filter:

- Spieler
- Spiel
- Eventtyp
- Quickfilter: alle
- Quickfilter: Gameplay
- Quickfilter: Live
- Quickfilter: Admin

Features:

- kompakter Feed
- Soft-Refresh ohne Flackern
- Logeintrag als Push vorbereiten
- Details aus Metadaten
- Punkteveraenderungen
- Adminaktionen
- Spielaktionen
- Live-Challenge-Aktionen

## 5.9 Push-Tab

Der Push-Tab verwaltet manuelle und automatische Push-Nachrichten.

Funktionen:

- manuelle Push-Nachricht schreiben
- Zielgruppe auswaehlen:
  - alle Push-Spieler
  - alle Spieler eines Spiels
  - einzelner Spieler
- Launch URL setzen
- Empfaenger-Vorschau anzeigen
- Push senden
- Formular leeren
- Push-Historie anzeigen
- Push-Historie loeschen
- automatische Push-Einstellungen pro Spiel toggeln

Automatische Push-Kategorien:

- neue Live-Challenge
- Live-Challenge beendet
- Spiel aktiviert
- Spieler hinzugefuegt
- erstes Bingo im Spiel
- Cooldown abgelaufen

---

# 6. Technische Architektur

## 6.1 Grundstruktur

Die App ist in mehrere globale JavaScript-Dateien aufgeteilt. Jede Datei hat einen klaren Aufgabenbereich.

Es gibt keine Module im ES6-Sinn. Die Dateien werden klassisch ueber `<script>` eingebunden und teilen sich globale Variablen/Funktionen.

Das ist bewusst einfach gehalten, benoetigt aber eine korrekte Script-Reihenfolge.

## 6.2 Zentrale Schichten

### Auth-Schicht

Datei:

- `auth.js`

Verantwortlich fuer:

- Login
- Registrierung
- lokale Session
- Admin-Erkennung
- Admin-Passwortbestaetigung
- Passwort-Reset
- Routing zwischen Spiel und Adminpanel

### Datenzugriffsschicht

Dateien:

- `data_service.js`
- `data.js`

`data_service.js` ist die zentrale moderne Leseschicht.

`data.js` ist die spielerseitige State- und Kompatibilitaetsschicht. Dort liegen weiterhin globale State-Variablen und einige Schreibfunktionen fuer das Gameplay.

### Spiellogik

Datei:

- `game.js`

Verantwortlich fuer:

- Spielzustand
- Challenge starten
- Challenge abschliessen
- Challenge aufgeben
- Bingo-Berechnung
- Cooldown
- Score
- Synchronisation mit Datenbank

### Spieler-UI

Datei:

- `app.js`

Verantwortlich fuer:

- Grid-Rendering
- Modals
- Profil
- Galerie
- Upload
- Leaderboard
- Animationen
- UI-Interaktionen

### Live-Challenges Spieler

Datei:

- `live-challenges.js`

Verantwortlich fuer:

- Live-Challenge-Anzeige
- Live-Abschluss
- Gewinnerlogik
- View-Tracking
- Ergebnisanzeige

### Polling

Datei:

- `polling_service.js`

Verantwortlich fuer:

- Polling-Jobs registrieren
- Polling-Jobs starten/stoppen
- Presets
- parallele Ausfuehrung verhindern

### Admin-Zentrale

Datei:

- `admin.js`

Verantwortlich fuer:

- Admin-Bootstrap
- aktives Admin-Spiel
- Header
- Tabwechsel
- Admin-Polling
- globale Helper

### Admin-Tabs

Dateien:

- `admin_dashboard.js`
- `admin_players.js`
- `admin_players_ui.js`
- `admin_games.js`
- `admin_live.js`
- `admin_galerie.js`
- `admin_logs.js`
- `admin_push.js`

### Push

Dateien:

- `push_service.js`
- `push_automation.js`
- `admin_push.js`
- `OneSignalSDKWorker.js`
- Edge Functions `send-push` und `check-cooldowns`

---

# 7. Dateiuebersicht

## 7.1 `supabase-client.js`

Erstellt den Supabase Client.

Enthaelt:

- Supabase URL
- Supabase Publishable Key
- `supabaseClient`
- Dokumentation der DB-Struktur als Kommentar

Wichtig:

- Diese Datei muss vor allen Datenzugriffen geladen werden.
- Der Key ist ein Publishable Key, aber RLS/Security-Regeln bleiben wichtig.

## 7.2 `index.html`

Hauptseite fuer Spieler.

Enthaelt die gesamte DOM-Struktur fuer:

- Header
- Grid
- Leaderboard
- Login/Register
- Spielauswahl
- Regeln
- Profil
- Upload
- Fotoanzeige
- Live-Challenges
- Animationen
- Push im Profil
- Script-Einbindungen

## 7.3 `style.css`

Styling der Spielerseite.

Bereiche:

- Base/Global
- Modals/Overlays
- Buttons
- Header
- Score
- Cooldown
- Bingo-Line-Indikatoren
- Grid
- Leaderboard
- Rules
- Auth/Login
- Upload
- Gallery
- Profile
- Live-Challenges
- Game Select
- Push Preferences
- Responsive Layout
- Animationen

## 7.4 `auth.js`

Zentrale Auth-, Session- und Routinglogik.

Wichtige Aufgaben:

- JSON sicher parsen
- Username normalisieren
- Display Name bereinigen
- Admin pruefen
- aktuelle Seite erkennen
- Session speichern/laden/loeschen
- bevorzugte Ansicht speichern/laden
- Legacy-Storage migrieren
- Login/Register DOM erweitern
- Admin-Auswahl-Overlay
- Admin-Passwortbestaetigung
- Spieler-Passwort-Reset-Overlay
- RPCs fuer Registrierung/Login/Admin-Passwort
- Login durchfuehren
- Registrierung durchfuehren
- Adminziel abfragen
- Adminpasswort verlangen
- Passwortreset ausfuehren
- Auth-Bootstrap fuer Spielerseite
- Auth-Bootstrap fuer Adminseite
- Logout
- Spieler weiterhin erlaubt pruefen

Wichtige RPC-Funktionen:

- `register_bingo_user`
- `login_bingo_user`
- `verify_bingo_admin_password`
- `admin_reset_bingo_user_password`
- `update_bingo_session_password`

## 7.5 `data_service.js`

Zentrale Datenzugriffsschicht.

Grundregel:

- rendert nichts
- enthaelt moeglichst reine Lesezugriffe
- kapselt Supabase Selects
- bietet Bundles fuer Tabs und Seiten

Hauptbereiche:

- Games
- Players
- Push Preferences
- Challenges
- Player Game State
- Player Challenges
- Player Bingos
- Leaderboard/Stats
- Live-Challenges
- Live-Views
- Activity Logs
- Storage Public URLs
- Combined Loaders / Bundles
- Kompatibilitaets-Wrapper

Beispiele:

- `DataService.games.loadAll()`
- `DataService.games.loadVisibleForPlayer(playerId)`
- `DataService.games.loadById(gameId)`
- `DataService.players.loadAllSafe()`
- `DataService.challenges.loadForGame(gameId)`
- `DataService.playerState.loadForPlayerAndGame(playerId, gameId)`
- `DataService.playerChallenges.loadForPlayerAndGame(playerId, gameId)`
- `DataService.playerBingos.loadForGame(gameId)`
- `DataService.stats.loadLeaderboard(gameId)`
- `DataService.live.loadActiveForGame(gameId)`
- `DataService.logs.loadActivityLogs(...)`
- `DataService.storage.getProofPhotoPublicUrl(path)`

## 7.6 `data.js`

Spielerseitige Daten- und State-Bruecke.

Enthaelt:

- `currentGameId`
- `currentGame`
- `challenges`
- `bingoLineStats`
- Game-LocalStorage
- Spiel laden
- Challenges laden und fuer UI mappen
- Challenge-Helper
- Player-State sicherstellen
- Spiel beitreten
- Player-State laden/aktualisieren
- Player-Challenge upsert
- Player-Bingos laden/einfuegen/loeschen
- globale Bingo-Line-Stats
- Bingo-Helfer
- First-Bingo-Helfer
- globale Challenge-Stats
- Leaderboard-Wrapper
- Completion-Loader
- Regeln rendern
- Profil-/Progress-Reset und Loeschfunktionen

Diese Datei bleibt wichtig, weil viele Spielerfunktionen globale Variablen daraus verwenden.

## 7.7 `game.js`

Zentrale Spiellogik der Spielerseite.

Enthaelt:

- `gameState`
- Cooldown-Helper
- Bingo-Linien-Generator
- State aus DB initialisieren
- State aus DB synchronisieren
- Challenge-Modal mit Game-State synchronisieren
- Challenge aktivieren
- Challenge abschliessen
- Aufgabe aufgeben
- abgeschlossene Challenge zuruecksetzen
- Bingo berechnen
- Score aktualisieren
- Logs schreiben
- Animationen anstossen
- Upload-Abschluss weiterverarbeiten

Wichtige Funktionen:

- `initializePlayerStateFromDatabase()`
- `syncPlayerStateFromDatabase()`
- `activateChallenge(boardId)`
- `completeChallenge(boardId, proofImagePath, successVariant)`
- `failChallenge()`
- `resetCompletedChallenge(boardId)`
- `checkForNewBingos()`
- `generateBingoLines(size)`

## 7.8 `app.js`

Zentrale UI-Datei der Spielerseite.

Enthaelt:

- DOM-Referenzen
- Modal-Funktionen
- Body-Scroll-Lock
- Challenge-Modal
- Completed-Challenge-Modal
- Cooldown-Modal
- Regeln-Modal
- Details-Modal
- Upload-Modal
- Upload-Preview
- Spielerprofil
- Profil-Galerie
- Profil-Statistik
- Profil-Abschlussliste
- Fail-Confirm
- Cooldown-Display
- Bingo-Animation
- First-Solver-Animation
- Score-Animation
- Points-Popup
- Leaderboard-Rendering
- Grid-Rendering
- Foto-Viewer
- Eventlistener fuer UI

Wichtige Funktionen:

- `openChallengeModal(challenge)`
- `openCompletedChallengeModal(challenge)`
- `openUploadModal(challenge, type, successVariant)`
- `closeUploadModal()`
- `openPlayerProfileModal()`
- `renderLeaderboard()`
- `renderGrid()`
- `showBingoAnimation()`
- `showFirstSolverAnimation()`
- `animateScoreDisplay(newScore)`

## 7.9 `main.js`

Start- und Ablaufsteuerung der normalen Spielerseite.

Enthaelt:

- Welcome-Overlay
- Spielauswahl
- Spielwechsel
- Join-Game-Flow
- Player-Polling
- Behandlung deaktivierter Spiele
- App-Start nach Auth
- Initiales Laden von Spiel, Challenges, State, Stats
- UI-Eventlistener fuer Hauptseite

Wichtige Funktionen:

- `renderGameList()`
- `handleJoinGameFromSelect(game)`
- `startGlobalStatsPolling()`
- `stopGlobalStatsPolling()`
- `checkCurrentGameStillActive()`
- `handleInactiveCurrentGame(message)`
- `loadCurrentGameIntoApp()`
- `startAppAfterAuth()`

## 7.10 `live-challenges.js`

Spielerseitige Live-Challenge-Logik.

Enthaelt:

- aktuelle Live-Challenge
- Live-Overlay
- Countdown
- View-State
- Completion
- Gewinner setzen
- Punkte vergeben
- Ergebnis anzeigen
- Expired-Handling
- Profilstatistik fuer Live-Challenges

Wichtige Funktionen:

- `checkLiveChallengeStatus()`
- `getNextLiveChallengeToDisplay()`
- `renderLiveChallengeModal(challenge)`
- `handleCompleteLiveChallenge(challenge, proofImagePath)`
- `renderCompletedLiveChallengeModal(challenge)`
- `renderExpiredLiveChallengeModal(challenge)`
- `expireOverdueLiveChallenges()`

## 7.11 `polling_service.js`

Zentraler Polling-Service.

Features:

- Jobs registrieren
- Jobs updaten
- Jobs starten/stoppen
- Job-Level
- Presets
- Custom Intervals
- parallele Ausfuehrung desselben Jobs verhindern
- Running Jobs neu starten

Polling-Level:

- `fast`
- `slow`
- `admin`

Standard-Presets:

- slow
- normal
- fast

Wichtige Funktionen:

- `PollingService.registerJob(config)`
- `PollingService.registerOrUpdateJob(config)`
- `PollingService.startJob(id)`
- `PollingService.stopJob(id)`
- `PollingService.runJobOnce(id)`
- `PollingService.setPreset(presetName)`
- `PollingService.setCustomIntervals(...)`
- `PollingService.getSettings()`

## 7.12 `admin.html`

Adminpanel-Struktur.

Enthaelt:

- Admin-Login-Overlay
- Header mit Adminname, aktuellem Spiel und Buttons
- Spielauswahl-Overlay
- Tab-Leiste
- leere Tab-Container
- Script-Reihenfolge fuer Adminpanel

## 7.13 `admin.js`

Zentrale Adminsteuerung.

Enthaelt:

- Admin-Bootstrap
- Logout
- Admin-Header
- aktuelles Admin-Spiel laden
- globale Spielauswahl
- Tabwechsel
- aktiven Tab initialisieren
- Admin-Polling
- globale Helper fuer Datum, Cooldown, Bilder etc.

Wichtige globale Variablen:

- `adminPlayer`
- `adminCurrentGameId`
- `adminCurrentGame`
- `selectedAdminPlayerId`
- `adminPlayers`
- `adminGames`
- `adminPlayerStates`
- `adminPlayerChallenges`
- `adminPlayerBingos`
- `adminChallenges`

Wichtige Funktionen:

- `startAdminApp()`
- `startAdminPanelAfterLogin()`
- `loadAdminCurrentGame()`
- `activateAdminTabByName(tabName)`
- `handleAdminTabActivated(tabName)`
- `startAdminPolling()`
- `stopAdminPolling()`
- `formatAdminDateTime(isoString)`
- `formatAdminCooldown(isoString)`

## 7.14 `admin_dashboard.js`

Dashboard-Tab.

Enthaelt:

- Dashboard-Layout
- Session-Passwort-Modal
- Dashboard-Datenbundle laden
- globale Statistiken
- aktuelles Spiel
- Mini-Grid
- Live-Block
- Top-5 Leaderboard
- letzte Logs
- Polling-Einstellungen
- Session-Passwort aendern
- Quicklinks in andere Tabs

Wichtige Funktionen:

- `initializeAdminDashboardTab()`
- `loadAdminDashboardData()`
- `renderAdminDashboard()`
- `renderAdminDashboardGlobalStats()`
- `renderAdminDashboardCurrentGameBlock()`
- `renderAdminDashboardLiveBlock()`
- `renderAdminDashboardLeaderboard()`
- `renderAdminDashboardLogs()`
- `renderAdminDashboardPollingSettings()`
- `handleAdminDashboardSaveSessionPassword()`

## 7.15 `admin_players.js`

Logik- und Datenebene fuer Spieler-Tab.

Enthaelt:

- Player-Tab initialisieren
- Daten laden
- Kompatibilitaets-Wrapper
- Player-/Game-/Challenge-Helper
- Admin-Passwortschutz
- Passwortreset
- Player-Challenge-Schreibzugriffe
- Challenge manuell abschliessen/zuruecksetzen/aktiv setzen/inaktiv setzen
- Recompute von Score und Bingos
- Spieler sperren
- Spieler loeschen
- Fortschritt zuruecksetzen
- Score/Cooldown bearbeiten
- Spieler zu Admin machen
- Spielstand anlegen

Wichtige Funktionen:

- `initializeAdminPlayersTab()`
- `loadAdminPlayersTabData()`
- `getStateForPlayerInAdminGame(playerId)`
- `adminMarkChallengeAsCompleted()`
- `adminResetChallengeFromModal()`
- `adminSetChallengeInactiveFromModal()`
- `adminSetChallengeActiveFromModal()`
- `recomputeAdminPlayerGameProgress(playerId, gameId)`
- `handleAdminToggleBlocked(player)`
- `adminResetPlayerGameProgress(player, game)`
- `adminDeletePlayerCompletely(player)`
- `handleAdminPromotePlayer(player)`
- `adminCreatePlayerState(player, game)`

## 7.16 `admin_players_ui.js`

UI- und Rendering-Ebene fuer Spieler-Tab.

Enthaelt:

- Player-Tab-Layout
- Challenge-Modal
- Spielerliste
- Detailansicht
- Mini-Grids
- Galerie
- abgeschlossene Aufgaben
- Eventlistener

Wichtige Funktionen:

- `ensureAdminPlayersTabLayout()`
- `ensureAdminPlayerChallengeModal()`
- `renderAdminPlayersList()`
- `renderAdminPlayerDetails(player)`
- `renderAdminPlayerMiniGrid(player, game)`
- `renderAdminCompletedChallenges(player, game)`
- `renderAdminPlayerGallery(player, game)`
- `openAdminPlayerChallengeDetails(player, game, challenge, row)`

## 7.17 `admin_games.js`

Spiele-Tab.

Enthaelt:

- Spiel-Liste
- Spiel-Details
- Spiel erstellen
- Spiel duplizieren
- Spiel loeschen
- Spiel bearbeiten
- Challenge-Grid
- Bingo-Line-Indikatoren
- Challenge-Detailmodal
- Spielpasswort-Modal
- Text-Edit-Modal
- Challenge-Setup-Wizard
- Aufgabenbilder
- Challenge-Galerie
- Leaderboard
- Bingo-Uebersicht

Wichtige Funktionen:

- `initializeAdminGamesTab()`
- `loadAdminGamesTabData()`
- `renderAdminGamesList()`
- `renderAdminGameDetails(game)`
- `updateAdminGameFields(gameId, updates)`
- `handleAdminEditGameName(game)`
- `handleAdminToggleGameActive(game)`
- `renderAdminGameGrid(game)`
- `openAdminGameChallengeDetails(game, challenge)`
- `handleAdminCreateGameFromModal()`
- `handleAdminDuplicateGame(game)`
- `handleAdminDeleteGame(game)`
- `openAdminChallengeSetupModal(game)`
- `handleAdminSaveGamePassword()`

## 7.18 `admin_live.js`

Live-Challenge-Admin-Tab.

Enthaelt:

- Live-Tab-Layout
- Create-Modal
- Daten laden
- Statusfilter
- globale Statistiken
- Liste
- Detailansicht
- Teilnehmerauswertung
- Countdown
- Live-Challenge erstellen
- aktivieren
- pausieren
- beenden
- loeschen
- Felder bearbeiten
- geplante automatische Starts

Wichtige Funktionen:

- `initializeAdminLiveTab()`
- `loadAdminLiveTabData()`
- `getVisibleAdminLiveChallenges()`
- `renderAdminLiveGlobalStats()`
- `renderAdminLiveList()`
- `renderAdminLiveDetails(row)`
- `handleAdminCreateLiveChallengeFromModal()`
- `handleAdminActivateLiveChallenge(row)`
- `handleAdminPauseLiveChallenge(row)`
- `handleAdminEndLiveChallenge(row)`
- `handleAdminDeleteLiveChallenge(row)`
- `autoActivateScheduledLiveChallenges()`

## 7.19 `admin_galerie.js`

Admin-Galerie.

Enthaelt:

- Galerie-Layout
- Filter
- Viewer-Modal
- Auswahlmodus
- normale Bild-Eintraege
- Live-Bild-Eintraege
- Suche
- Bildnavigation
- Metadaten
- Tab-Navigation
- Teilen
- Download

Wichtige Funktionen:

- `initializeAdminGalleryTab()`
- `loadAdminGalleryBaseData()`
- `buildAdminGalleryEntries()`
- `renderAdminGalleryFilterOptions()`
- `renderAdminGalleryGrid()`
- `openAdminGalleryViewer(entryId)`
- `showPreviousAdminGalleryEntry()`
- `showNextAdminGalleryEntry()`
- `copyCurrentAdminGalleryImageLink()`
- `shareSelectedAdminGalleryImages()`
- `downloadSelectedAdminGalleryImages()`

## 7.20 `admin_logs.js`

Activity-Log-System und Logs-Tab.

Enthaelt:

- Event-Type-Konstanten
- Event-Gruppen
- Activity Log schreiben
- Activity Logs laden
- Namen/Labels formatieren
- Zeit formatieren
- Feed-Text bauen
- Log-Wrapper fuer Gameplay
- Log-Wrapper fuer Live
- Log-Wrapper fuer Admin
- Logs-Tab-Daten laden
- Logs-Tab rendern
- Filter
- Quickfilter
- Soft-Refresh
- Push-Prefill aus Log

Wichtige Funktionen:

- `insertActivityLog(...)`
- `loadActivityLogs(...)`
- `formatActivityLogMessage(log)`
- `logChallengeStarted(...)`
- `logChallengeCompleted(...)`
- `logChallengeFailed(...)`
- `logBingoAwarded(...)`
- `logPhotoUploaded(...)`
- `logLiveChallengeCreated(...)`
- `logLiveChallengeCompleted(...)`
- `logAdminPlayerBlocked(...)`
- `logAdminGameUpdated(...)`
- `logAdminChallengeUpdated(...)`
- `initializeAdminLogsTab()`
- `refreshAdminLogsListIfNeeded()`

## 7.21 `admin_push.js`

Push-Tab im Adminpanel.

Enthaelt:

- Push-Layout
- manuelles Push-Formular
- Zielgruppenauswahl
- Empfaenger-Vorschau
- Push senden
- Push-Historie
- Historie loeschen
- Spielbezogene Push-Einstellungen
- Auto-Save von Einstellungen

Wichtige Funktionen:

- `initializeAdminPushTab()`
- `loadAdminPushData()`
- `renderAdminPushFormOptions()`
- `updateAdminPushRecipientPreview()`
- `handleSendManualPush()`
- `buildManualPushPayload()`
- `renderAdminPushSettings()`
- `handleSavePushSettings()`
- `renderAdminPushHistory()`

## 7.22 `admin_log_push_share.js`

Verbindet Logs mit Push.

Funktion:

- Logeintrag als vorbereitete Push-Nachricht in den Push-Tab uebernehmen

Wichtige Funktion:

- `prefillAdminPushFormFromLog(prefill)`

## 7.23 `push_service.js`

Spielerseitige Push-Verwaltung.

Enthaelt:

- OneSignal laden
- Spieler mit OneSignal verbinden
- Push aktivieren
- Push deaktivieren
- Push-Status speichern
- Push-Praeferenzen laden/speichern
- Profil-Buttons binden
- Registrierungs-Prompt
- Debug-Helfer
- Reparaturfunktion

Wichtige Funktionen:

- `initializePlayerPushService()`
- `getOneSignalSafe()`
- `loginCurrentPlayerToOneSignal()`
- `enablePlayerPushNotifications()`
- `disablePlayerPushNotifications()`
- `savePlayerPushPreference(fields)`
- `maybeShowPlayerPushRegistrationPrompt()`
- `debugPlayerPushState()`
- `repairCurrentPlayerPushRegistration()`

## 7.24 `push_automation.js`

Automatische Push-Hooks.

Enthaelt:

- zentrale Push-Automation-Helfer
- automatische Pushes fuer Events
- Cooldown-Testchecker fuer Entwicklung

Automatische Push-Typen:

- neue Live-Challenge
- Live-Challenge beendet
- Spiel aktiviert
- Spieler zu Spiel hinzugefuegt
- erstes Bingo im Spiel

Wichtige Funktionen:

- `pushAutomationSendLiveCreated(liveChallenge)`
- `pushAutomationSendLiveFinished(liveChallenge, options)`
- `pushAutomationSendGameActivated(game)`
- `pushAutomationSendPlayerAddedToGame({ playerId, gameId })`
- `pushAutomationSendFirstGameBingo({ gameId, playerId, lineKey })`
- `pushAutomationRunCooldownCheckOnce()`

Hinweis:

Der Cooldown-Testchecker ruft in der Adminseite regelmaessig `check-cooldowns` auf. Fuer Produktion kann dieser deaktiviert und durch Supabase Cron ersetzt werden.

## 7.25 `player_activity_toasts.js`

Optionale Spieler-Toasts fuer Live-Aktivitaeten.

Zweck:

- kleine Toast-Benachrichtigungen fuer neue relevante Events
- keine eigenen Events anzeigen
- nur aktuelles Spiel
- z. B. Challenge abgeschlossen oder Bingo erreicht

Wichtige Funktionen:

- `initializePlayerActivityToasts()`
- `refreshPlayerActivityToasts()`
- `showPlayerActivityToast(text, type)`

Hinweis:

Diese Datei ist vorbereitet, muss aber bewusst in `index.html` eingebunden und im Polling aufgerufen werden, wenn sie aktiv genutzt werden soll.

## 7.26 `OneSignalSDKWorker.js`

Service Worker fuer OneSignal.

Inhalt:

- importiert den OneSignal Service Worker

Muss bei GitHub Pages unter dem richtigen Pfad erreichbar sein.

## 7.27 Edge Function `send-push`

Serverseitiger Versand von Push-Nachrichten.

Aufgaben:

- Payload validieren
- Empfaenger anhand Zielgruppe bestimmen
- OneSignal API aufrufen
- Push-Historie speichern
- Fehler speichern
- Zielgruppen unterstuetzen:
  - all
  - game
  - player
  - live_open

## 7.28 Edge Function `check-cooldowns`

Serverseitiger Check fuer abgelaufene Cooldowns.

Aufgaben:

- Spieler mit abgelaufenem Cooldown finden
- pruefen, ob Push bereits gesendet wurde
- Cooldown-Push versenden
- idempotent durch eigene Tracking-Tabelle

---

# 8. Datenbankstruktur

## 8.1 `players`

Speichert Benutzerkonten.

Wichtige Spalten:

- `id`
- `username`
- `display_name`
- `pin_hash`
- `role`
- `is_blocked`
- `created_at`

Rollen:

- `player`
- `admin`

## 8.2 `games`

Speichert Spiele.

Wichtige Spalten:

- `id`
- `name`
- `grid_size`
- `cooldown_seconds`
- `bingo_bonus_points`
- `first_bingo_bonus_points`
- `is_active`
- `visibility`
- `game_password_hash`
- `created_at`

## 8.3 `challenges`

Speichert normale Bingo-Aufgaben.

Wichtige Spalten:

- `id`
- `game_id`
- `position`
- `title`
- `task`
- `points`
- `is_active`
- `category_icon`
- `details`
- `success_text`
- `requires_photo_proof`
- `success_variant_1`
- `success_variant_2`
- `success_variant_3`
- `description_image_path`

Constraint:

- `(game_id, position)` eindeutig

## 8.4 `player_game_state`

Speichert den Gesamtstatus eines Spielers in einem Spiel.

Wichtige Spalten:

- `id`
- `player_id`
- `game_id`
- `score`
- `active_challenge_id`
- `cooldown_until`
- `created_at`
- `updated_at`

Constraint:

- `(player_id, game_id)` eindeutig

## 8.5 `player_challenges`

Speichert Status einer Challenge fuer einen Spieler.

Wichtige Spalten:

- `id`
- `player_id`
- `game_id`
- `challenge_id`
- `status`
- `completed_at`
- `was_first_solver`
- `points_awarded`
- `proof_image_path`
- `success_variant_label`
- `success_variant_points`
- `created_at`
- `updated_at`

Statuswerte:

- `hidden`
- `active`
- `completed`

Constraint:

- `(player_id, challenge_id)` eindeutig

## 8.6 `player_bingos`

Speichert vergebene Bingo-Boni.

Wichtige Spalten:

- `id`
- `player_id`
- `game_id`
- `line_key`
- `bonus_points`
- `awarded_at`

Constraint:

- `(player_id, game_id, line_key)` eindeutig

## 8.7 `live_challenges`

Speichert Live-Challenges.

Wichtige Spalten:

- `id`
- `game_id`
- `title`
- `description`
- `points`
- `requires_photo_proof`
- `status`
- `winner_player_id`
- `winner_completed_at`
- `created_at`
- `completed_at`
- `expires_at`
- `scheduled_start_at`
- `duration_minutes`

Statuswerte:

- `inactive`
- `active`
- `completed`
- `expired`
- `cancelled`

## 8.8 `player_live_challenges`

Speichert Abschluesse von Live-Challenges.

Wichtige Spalten:

- `id`
- `live_challenge_id`
- `player_id`
- `game_id`
- `status`
- `points_awarded`
- `proof_image_path`
- `completed_at`

Constraint:

- `(live_challenge_id, player_id)` eindeutig

## 8.9 `player_live_challenge_views`

Speichert, ob Spieler Live-Challenges gesehen haben.

Wichtige Spalten:

- `id`
- `player_id`
- `live_challenge_id`
- `seen_start_at`
- `seen_end_at`
- `dismissed_at`
- `created_at`

Constraint:

- `(player_id, live_challenge_id)` eindeutig

## 8.10 `activity_logs`

Zentrales Aktivitaetsprotokoll.

Wichtige Spalten:

- `id`
- `created_at`
- `game_id`
- `player_id`
- `admin_player_id`
- `challenge_id`
- `live_challenge_id`
- `event_type`
- `entity_type`
- `entity_id`
- `points_delta`
- `message`
- `metadata`

Eventtypen:

- `challenge_started`
- `challenge_completed`
- `challenge_failed`
- `challenge_reset`
- `bingo_awarded`
- `points_awarded`
- `photo_uploaded`
- `live_challenge_created`
- `live_challenge_completed`
- `live_challenge_expired`
- `live_challenge_manually_ended`
- `admin_player_blocked`
- `admin_player_unblocked`
- `admin_score_changed`
- `admin_cooldown_changed`
- `admin_player_game_reset`
- `admin_player_deleted`
- `admin_game_created`
- `admin_game_deleted`
- `admin_game_duplicated`
- `admin_game_updated`
- `admin_challenge_updated`

## 8.11 `player_push_preferences`

Speichert Push-Einstellungen pro Spieler.

Wichtige Spalten:

- `player_id`
- `push_enabled`
- `external_id`
- `permission_state`
- `last_subscription_id`
- `live_challenges_enabled`
- `live_results_enabled`
- `first_bingo_enabled`
- `game_updates_enabled`
- `cooldown_enabled`
- `admin_messages_enabled`
- `enabled_at`
- `disabled_at`
- `last_seen_at`
- `updated_at`

## 8.12 `game_push_settings`

Speichert automatische Push-Einstellungen pro Spiel.

Wichtige Spalten:

- `game_id`
- `push_live_created_enabled`
- `push_live_finished_enabled`
- `push_game_activated_enabled`
- `push_player_added_enabled`
- `push_first_game_bingo_enabled`
- `push_cooldown_finished_enabled`

## 8.13 `push_notifications`

Speichert Push-Historie.

Wichtige Spalten:

- `id`
- `created_at`
- `type`
- `title`
- `message`
- `target_type`
- `target_game_id`
- `target_player_id`
- `live_challenge_id`
- `target_count`
- `status`
- `error_message`
- `onesignal_notification_id`
- `created_by_admin_id`
- `metadata`

---

# 9. Authentifizierung und Sicherheit

## 9.1 Grundprinzip

Die App nutzt eine bewusst einfache Authentifizierung.

- Benutzer haben Username und Passwort.
- Passwoerter werden serverseitig gehasht.
- Login erfolgt ueber Supabase RPC.
- Lokale Session wird im Browser gespeichert.
- Admins sind normale Spieler mit `role = "admin"`.

## 9.2 Session-Passwort

Bei Registrierung muss ein Session-Passwort eingegeben werden. Dadurch koennen nur Personen, die dieses Passwort kennen, neue Accounts anlegen.

Das Session-Passwort kann im Admin-Dashboard geaendert werden.

## 9.3 Spielpasswort

Einzelne Spiele koennen optional ein eigenes Spielpasswort haben.

Dieses wird beim Beitritt abgefragt und serverseitig geprueft.

## 9.4 Admin-Passwortbestaetigung

Kritische Aktionen verlangen erneut das Admin-Passwort, z. B.:

- Spielerpasswort zuruecksetzen
- Spieler loeschen
- Spieler zu Admin machen
- Spielpasswoerter aendern
- Session-Passwort aendern

## 9.5 Bekannte Sicherheitsgrenzen

Das System ist fuer private Events gedacht, nicht fuer hochsensible Anwendungen.

Wichtige Einschraenkungen:

- keine vollwertige externe Auth-Loesung
- keine E-Mail-Verifikation
- kein Passwortreset per Mail
- Frontend ist statisch ausgeliefert
- RLS/Supabase Policies sollten fuer echten Produktivbetrieb sauber gesetzt sein
- Edge Functions sollten serverseitig Adminrechte pruefen

---

# 10. Push-Benachrichtigungen

## 10.1 OneSignal

OneSignal wird auf der Spielerseite initialisiert.

Wichtig fuer GitHub Pages:

- Service Worker Pfad muss `/Bingov2/OneSignalSDKWorker.js` sein
- Scope muss `/Bingov2/` sein

## 10.2 Spieler-Push

Spieler koennen Push im Profil aktivieren.

Dabei passiert:

1. OneSignal wird geladen.
2. Spieler-ID wird als external_id gesetzt.
3. Browser-Permission wird abgefragt.
4. Subscription wird aktiviert.
5. Push-Einstellungen werden in Supabase gespeichert.

## 10.3 Admin-Push

Admins koennen manuelle Pushes senden.

Zielgruppen:

- alle Push-Spieler
- alle Spieler eines Spiels
- einzelner Spieler

## 10.4 Automatische Pushes

Automatische Pushes koennen pro Spiel aktiviert/deaktiviert werden.

Aktuelle automatische Typen:

- neue Live-Challenge
- Live-Challenge beendet
- Spiel aktiviert
- Spieler hinzugefuegt
- erstes Bingo im Spiel
- Cooldown abgelaufen

## 10.5 Push-Historie

Jeder Push wird in `push_notifications` gespeichert.

Gespeichert werden:

- Typ
- Titel
- Nachricht
- Zielgruppe
- Empfaengeranzahl
- Status
- Fehler
- OneSignal-ID
- Admin
- Metadaten

---

# 11. Polling und Live-Aktualisierung

## 11.1 Warum Polling?

Die App verwendet bewusst Polling statt Realtime.

Vorteile:

- einfacher
- robuster
- besser kontrollierbar
- weniger Supabase-Realtime-Komplexitaet
- fuer 10 bis 20 Spieler ausreichend

## 11.2 Player-Polling

Der Player-Fast-Job aktualisiert regelmaessig:

- ob Spieler noch erlaubt ist
- ob Spiel noch aktiv ist
- abgelaufene Live-Challenges
- Challenges
- Player State
- globale Challenge Stats
- Bingo-Line Stats
- Grid
- Leaderboard
- Live-Challenge-Status

## 11.3 Admin-Polling

Das Adminpanel pollt den aktuell aktiven Tab.

Sonderlogik:

- Logs-Tab nutzt Soft-Refresh
- Live-Tab aktiviert geplante Live-Challenges
- andere Tabs werden neu initialisiert/gerendert

## 11.4 Polling-Presets

Es gibt Presets:

- slow
- normal
- fast

Diese koennen im Dashboard angepasst werden.

---

# 12. Foto-Upload und Galerie

## 12.1 Upload

Fotos werden in Supabase Storage hochgeladen.

Verwendung:

- normale Challenge mit Fotopflicht
- Live-Challenge mit Fotopflicht

## 12.2 Anzeige

Bilder erscheinen:

- in Challenge-Completion-Galerien
- im Spielerprofil
- in der Admin-Galerie
- im Live-Challenge-Ergebnis
- in Challenge-Detailansichten im Adminpanel

## 12.3 Admin-Galerie

Die Admin-Galerie ist die zentrale Bildverwaltung.

Filter:

- Spiel
- Spieler
- Aufgabe
- Typ
- Datum von/bis
- Suche

Aktionen:

- ansehen
- oeffnen
- Link kopieren
- mehrere Bilder auswaehlen
- teilen
- herunterladen

---

# 13. Activity Logs

## 13.1 Zweck

Activity Logs sind das zentrale Protokoll des Spiels.

Sie dienen fuer:

- Adminuebersicht
- Debugging
- Historie
- Push-Vorlagen
- Nachvollziehbarkeit von Punkten und Aktionen

## 13.2 Loggruppen

Gruppen:

- Gameplay
- Live
- Admin

## 13.3 Gameplay-Logs

Beispiele:

- Challenge gestartet
- Challenge abgeschlossen
- Challenge aufgegeben
- Challenge zurueckgesetzt
- Bingo erreicht
- Punkte vergeben
- Foto hochgeladen

## 13.4 Live-Logs

Beispiele:

- Live-Challenge erstellt
- Live-Challenge gewonnen
- Live-Challenge abgelaufen
- Live-Challenge manuell beendet

## 13.5 Admin-Logs

Beispiele:

- Spieler gesperrt
- Spieler entsperrt
- Score geaendert
- Cooldown geaendert
- Spieler geloescht
- Spiel erstellt
- Spiel geloescht
- Spiel dupliziert
- Spiel geaendert
- Challenge geaendert

## 13.6 Logs als Push-Vorlage

Ein Logeintrag kann in den Push-Tab uebernommen werden. Dort wird nichts automatisch gesendet. Der Admin kann Titel, Nachricht und Zielgruppe pruefen und anpassen.

---

# 14. Typische Ablaufe

## 14.1 Neues Spiel erstellen

1. Admin oeffnet Adminpanel.
2. Tab "Spiele".
3. "Neues Spiel".
4. Name, Gridgroesse und Grundwerte setzen.
5. Spiel wird erstellt.
6. Challenges werden fuer alle Positionen angelegt.
7. Setup-Wizard kann Aufgaben befuellen.
8. Spiel aktiv setzen.
9. Spieler koennen beitreten.

## 14.2 Spieler tritt Spiel bei

1. Spieler loggt sich ein.
2. Spielauswahl oeffnen.
3. Spiel auswaehlen.
4. Falls Passwort gesetzt ist: Passwort eingeben.
5. `join_bingo_game` RPC erstellt `player_game_state`.
6. Live-Challenge-Views werden initialisiert.
7. Spiel wird geladen.

## 14.3 Spieler loest Aufgabe

1. Feld anklicken.
2. Aufgabe wird aktiv.
3. Spieler erledigt Aufgabe.
4. ggf. Foto hochladen.
5. System prueft First Solver.
6. Punkte werden vergeben.
7. Challenge wird completed.
8. Bingo wird geprueft.
9. Logs werden geschrieben.
10. UI aktualisiert sich.

## 14.4 Spieler gibt Aufgabe auf

1. Spieler klickt Aufgeben.
2. Confirm-Modal.
3. Challenge wird zurueckgesetzt.
4. Cooldown wird gesetzt.
5. Log wird geschrieben.
6. UI zeigt Cooldown.

## 14.5 Admin sperrt Spieler

1. Admin oeffnet Spieler-Tab.
2. Spieler auswaehlen.
3. Gesperrt toggeln.
4. Spieler wird in DB gesperrt.
5. Log wird geschrieben.
6. Spieler verliert beim naechsten Polling Zugriff.

## 14.6 Admin startet Live-Challenge

1. Admin oeffnet Live-Tab.
2. Neue Live-Challenge.
3. Titel/Beschreibung/Punkte setzen.
4. Dauer/Fotopflicht optional setzen.
5. Sofort aktivieren oder planen.
6. Spieler sehen Overlay.
7. Gewinner wird gespeichert.
8. Punkte und Logs werden vergeben.
9. Ergebnis wird angezeigt.

## 14.7 Admin sendet Push

1. Admin oeffnet Push-Tab.
2. Titel und Nachricht eingeben.
3. Zielgruppe waehlen.
4. Empfaenger-Vorschau pruefen.
5. Senden bestaetigen.
6. Edge Function sendet Push.
7. Historie wird gespeichert.

## 14.8 Galerie teilen

1. Admin oeffnet Galerie.
2. Filter setzen.
3. Auswahlmodus aktivieren.
4. Bilder auswaehlen.
5. Teilen oder Download klicken.
6. Browser Share API oder Download wird verwendet.

---

# 15. Entwicklungsstand und offene Punkte

## 15.1 Stabiler Kern

Aktuell gut ausgebaut:

- Spielerlogin
- Spielauswahl
- normales Gameplay
- variable Punkte
- Foto-Upload
- Bingo-Boni
- First Solver
- Live-Challenges
- Adminpanel
- Spieler-Verwaltung
- Spiele-Verwaltung
- Galerie
- Logs
- Push-Grundsystem
- Polling-Service

## 15.2 Bekannte technische Schulden

- grosse JS-Dateien, aber aktuell bewusst akzeptiert
- viele globale Variablen durch klassischen Script-Aufbau
- manche Kompatibilitaets-Wrapper aus frueheren Umbauten
- Push-Cooldown-Testchecker sollte fuer Produktivbetrieb sauber ersetzt/deaktiviert werden
- `player_activity_toasts.js` ist vorbereitet, aber nur nutzen, wenn aktiv eingebunden
- DataService-Selects muessen bei neuen DB-Feldern immer mitgepflegt werden
- RLS/Security sollte vor oeffentlichem Betrieb geprueft werden

## 15.3 Empfohlene letzte Fixes vor Event

1. In `data_service.js` alle neuen Challenge-Felder in detaillierten Selects ergaenzen:
   - `success_variant_1`
   - `success_variant_2`
   - `success_variant_3`
   - `description_image_path`

2. Completion-Loader um variable Erfolgsfelder erweitern:
   - `success_variant_label`
   - `success_variant_points`

3. Cooldown-Testchecker entscheiden:
   - fuer Test lassen
   - fuer echten Betrieb deaktivieren oder durch Cron ersetzen

4. `player_activity_toasts.js` entscheiden:
   - bewusst einbinden
   - oder vorerst entfernen

5. Vollstaendiger End-to-End-Test:
   - 2 Spieler
   - 1 Admin
   - Aufgabe starten
   - Aufgabe aufgeben
   - Cooldown
   - Aufgabe mit Foto
   - variable Aufgabe
   - Bingo
   - Live-Challenge
   - Push
   - Galerie
   - Spieler sperren
   - Spiel deaktivieren

---

# 16. Wartung, Debugging und Weiterentwicklung

## 16.1 Wichtige Debug-Orte

Browser Console:

- Supabase-Fehler
- PollingService-Fehler
- Push-Debug
- OneSignal-Status
- Upload-Fehler

Supabase:

- Tabelleninhalt pruefen
- Edge Function Logs
- Storage Buckets
- RPC-Fehler
- Policies/RLS

OneSignal:

- Subscription vorhanden?
- external_id korrekt?
- Notification gesendet?
- Browser Permission granted?

## 16.2 Typische Fehlerquellen

### Spiel laedt nicht

Pruefen:

- `currentGameId`
- existiert Spiel?
- ist Spiel aktiv?
- hat Spieler `player_game_state`?
- Fehler in `loadCurrentGameIntoApp()`

### Adminpanel leer

Pruefen:

- Admin eingeloggt?
- Rolle `admin`?
- Script-Reihenfolge?
- Console Syntaxfehler?
- `DataService` vorhanden?

### Challenge-Felder fehlen

Pruefen:

- DB-Spalten vorhanden?
- `DataService.SELECT_CHALLENGES_DETAILED` vollstaendig?
- Mapping in `data.js` korrekt?

### Push geht nicht

Pruefen:

- HTTPS?
- Service Worker Pfad?
- Browser Permission?
- OneSignal external_id?
- `player_push_preferences`
- Edge Function Logs
- OneSignal API Key serverseitig

### Fotos werden nicht angezeigt

Pruefen:

- Storage Path gespeichert?
- Bucket public oder signierte URLs?
- `DataService.storage.getProofPhotoPublicUrl`
- `proof_image_path`
- Browser Console

## 16.3 Weiterentwicklungsideen

Moegliche spaetere Erweiterungen:

- Tutorial-Modus mit 3 x 3 Feld
- PWA/Installierbarkeit
- bessere RLS-Sicherheit
- separate Passwoerter pro Spiel weiter ausbauen
- Push-Cron voll serverseitig
- Realtime statt Polling fuer einzelne Features
- bessere Admin-Statistiken
- Export von Logs
- Export von Galerie-Zip
- Theme-/Design-Auswahl
- mehrere Sessions/Events parallel
- QR-Code fuer Spielbeitritt
- bessere Mobile-Gesten in Galerie
- Offline-Hinweise bei schlechter Verbindung

## 16.4 Architekturentscheidung fuer aktuellen Stand

Vor dem geplanten Einsatz sollten keine grossen Refactorings mehr gemacht werden.

Grund:

- System ist funktional bereits weit
- groessere Aufteilung kann neue Lade-Reihenfolgen brechen
- globale Abhaengigkeiten sind bekannt und funktionieren
- Risiko/Nutzen-Verhaeltnis spricht fuer gezielte Fixes statt Umbau

Empfehlung:

- kleine konkrete Fixes
- danach Testlauf
- danach Code-Freeze fuer Eventbetrieb

---

# 17. Kurzfassung fuer neue Entwickler

Festival Bingo ist eine Vanilla-JS-Web-App mit Supabase-Backend.

Startpunkte:

- Spieler: `index.html`
- Admin: `admin.html`

Wichtige zentrale Dateien:

- `supabase-client.js`: Supabase Client
- `auth.js`: Login, Registrierung, Admin, Session
- `data_service.js`: zentrale Datenzugriffe
- `data.js`: Spieler-State und DB-Schreibfunktionen
- `game.js`: Spiellogik
- `app.js`: Spieler-UI
- `main.js`: App-Start und Polling
- `live-challenges.js`: Live-Challenges fuer Spieler
- `polling_service.js`: zentrales Polling
- `admin.js`: Admin-Zentrale
- `admin_*`: Admin-Tabs
- `push_service.js`: Spieler-Push
- `push_automation.js`: automatische Push-Hooks

Wichtig:

- Script-Reihenfolge beachten.
- Globale Variablen sind Teil der Architektur.
- DataService-Felder bei DB-Erweiterungen mitpflegen.
- Vor grossen Umbauten End-to-End testen.
- Fuer Eventbetrieb Stabilitaet vor Perfektion.


---

# 18. Neue Features und Erweiterungen (aktualisiert)

## 18.1 Haushaltsmodus / Single-Use-Challenges

Das Spiel unterstützt nun zusätzlich einen zweiten Haupt-Use-Case:

- gamifizierte Haushaltsaufgaben
- Aufgabenverteilung
- WG-/Paar-Haushalte
- Wochenwertung mit Belohnungen

Neue Spieloption:

```text
Aufgaben nur einmal lösbar
```

Neue DB-Spalte:

```sql
single_use_challenges boolean default false
```

Wenn aktiviert:

- kann jede Aufgabe nur einmal abgeschlossen werden
- danach wird das Feld für alle anderen Spieler deaktiviert
- das Feld wird ausgegraut und mit einem Checkmark markiert
- First-Solver-Doppelbonus wird automatisch deaktiviert
- die First-Solver-Animation wird unterdrückt

---

## 18.2 Erweiterter Foto-Modus

Neue Werte:

```text
none
optional
required
```

Neue Challenge-Spalte:

```sql
photo_mode
```

### Player-UI

#### none

```text
Bestanden
Später/Aufgeben
```

#### optional

```text
Bestanden
Optional Foto hochladen
Später/Aufgeben
```

#### required

```text
Foto hochladen
Später/Aufgeben
```

---

## 18.3 Variable Aufgaben mit optionalem Foto

Variable Aufgaben unterstützen jetzt ebenfalls optionale Bilder.

Beispiel:

```text
1P – Kleine Variante      📷
2P – Mittlere Variante    📷
3P – Schwere Variante     📷
```

---

## 18.4 Haushaltsmodus ohne Strafzeit

Wenn:

```text
cooldown_seconds = 0
```

ändert sich das Verhalten des Aufgeben-Buttons.

Vorher:

```text
Aufgeben
-> Confirm-Modal
```

Jetzt:

```text
Später
```

Zusätzlich:

- kein Confirm-Modal mehr
- Aufgabe wird direkt zurückgelegt
- sofortige Auswahl einer neuen Aufgabe möglich

---

## 18.5 Single-Use Push-Benachrichtigungen

Neue automatische Push-Art:

```text
automatic_single_use_completed
```

Beispiel:

```text
Mira hat "Bad putzen" erledigt (+3P)
```

Neue Settings-Spalte:

```sql
push_single_use_completed_enabled boolean default true
```

---

## 18.6 Player Activity Toasts

Die vorbereiteten Player-Toasts wurden vollständig integriert.

Features:

- große Toast-Banner oben mittig
- mobilefreundlich
- Bingo-Meldungen
- Challenge-Abschlüsse
- nur aktuelles Spiel
- keine eigenen Events

---

## 18.7 Variable Aufgaben vollständig repariert

Behobene Probleme:

- `?` wurde nicht korrekt angezeigt
- Erfolgsvarianten wurden nicht geladen
- Varianten erschienen nicht im Player-Modal
- Varianten erschienen nicht im Adminpanel

---

## 18.8 Wizard ausgelagert

Neue Datei:

```text
admin_games_setup_wizard.js
```

Zusätzlich wurde der Fehler beim Button:

```text
Speichern + weiter
```

behoben.

---

## 18.9 Neue DB-Felder

### Tabelle `games`

```sql
single_use_challenges boolean default false
```

### Tabelle `challenges`

```sql
photo_mode text
```

### Tabelle `game_push_settings`

```sql
push_single_use_completed_enabled boolean default true
```

---

## 18.10 Aktueller Projektstatus

Das Projekt unterstützt inzwischen zwei Hauptmodi:

### Party-/Festival-Modus

- gemeinsames Bingo
- First Solver
- Bingo-Linien
- Live-Challenges
- Galerie
- Pushes
- variable Aufgaben
- Fotoaufgaben

### Haushalts-/Gamification-Modus

- Single-Use-Aufgaben
- Aufgabenverteilung
- optionale Fotos
- direkte Pushes
- reduzierte UI
- keine Strafzeiten
- Wochenwertung

Das Projekt entwickelt sich damit zunehmend von einem reinen Festivalspiel zu einer allgemeinen Multiplayer-Gamification-Plattform für kleine private Gruppen.
