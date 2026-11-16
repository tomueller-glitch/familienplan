#!/bin/sh
# Alle Prüfungen nacheinander. Braucht Node 22 und Playwright mit Chromium.
# Aufruf aus dem Projektordner: sh tests/run.sh
set -u
cd "$(dirname "$0")"
mkdir -p out
for f in ../js/*.js; do node --input-type=module --check < "$f" || echo "SYNTAXFEHLER $f"; done
npx --yes tsc --noEmit --strict --target es2022 --lib es2022,dom --module esnext --skipLibCheck ../supabase/functions/push/index.ts 2>/dev/null || echo "tsc: bitte prüfen"
for t in *.mts; do echo "== $t"; node --experimental-strip-types "$t" 2>&1 | grep -v ExperimentalWarning; done
cd out
for t in ../*.mjs; do
  echo "== $t"
  case "$t" in
    *wochenbonus*) d=2026-11-22 ;;
    *) d=2026-11-18 ;;
  esac
  timeout 300 node "$t" "$d" 2>&1 | tail -n 40
  case "$t" in *optik*) timeout 300 node "$t" "$d" dunkel 2>&1 | tail -n 10 ;; esac
done
