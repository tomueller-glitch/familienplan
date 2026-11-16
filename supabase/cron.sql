-- Zeitplan für die Push-Funktion: ruft sie alle fünf Minuten auf.
-- Bequemer: push-einrichten.html öffnen, dort steht dieser Befehl mit den richtigen Werten.
-- DEIN-PROJEKT und DEIN-CRON-SECRET ersetzen, dann im SQL Editor ausführen.
-- Erneutes Ausführen ersetzt den Job mit gleichem Namen.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'familienplan-push',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://DEIN-PROJEKT.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'DEIN-CRON-SECRET'),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- Lernplaner im Minutentakt: nur „Pause vorbei“ und Lernmodus, damit die Nachricht pünktlich kommt.
select cron.schedule(
  'lernplaner-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://DEIN-PROJEKT.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'DEIN-CRON-SECRET'),
    body := '{"nur":"lern"}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- Zum Abschalten:
-- select cron.unschedule('familienplan-push');
-- select cron.unschedule('lernplaner-minute');
-- Letzte Aufrufe und Antworten ansehen:
-- select status_code, content, created from net._http_response order by created desc limit 10;
