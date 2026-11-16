# Prüfungen

Diese Skripte prüfen die App ohne echte Datenbank: Supabase und die Antworten von Claude werden nachgebildet,
die App läuft in Chromium (Playwright), Bildschirmfotos landen in `tests/out/`.

- `sh tests/run.sh` startet alles.
- Jedes Skript endet mit `Fehler: []`, wenn im Browser kein Fehler aufgetreten ist. Die Zeilen davor zeigen, was gespeichert wurde.
- Die `.mts`-Dateien prüfen einzelne Teile der Push-Funktion (Erinnerungen, Kosten, Saison-Regel).
- Ein Testdatum lässt sich als erstes Argument mitgeben, zum Beispiel `node tests/kinderansicht.mjs 2026-12-15`.
