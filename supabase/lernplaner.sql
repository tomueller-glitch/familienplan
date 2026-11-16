-- Lernplaner (lernen.html): einmal im Supabase-Projekt des Familienplans ausführen (SQL Editor > New query > Run).
-- Legt nur neue Objekte mit dem Präfix lp_ an und verändert keine Tabellen des Familienplans.
-- Zugriff wie beim Familienplan: nur mit Anmeldung.

create table if not exists public.lp_data (
  id          text primary key,
  coll        text not null,
  data        jsonb,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now()
);
create index if not exists lp_data_updated_idx on public.lp_data (updated_at);
create index if not exists lp_data_coll_idx on public.lp_data (coll);

create or replace function public.lp_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists lp_touch on public.lp_data;
create trigger lp_touch before insert or update on public.lp_data
for each row execute function public.lp_touch();

-- Nur angemeldete Geräte (die Anmeldung des Familienplans) dürfen lesen und schreiben.
alter table public.lp_data enable row level security;
drop policy if exists "lp_data anon" on public.lp_data;
drop policy if exists "lp_data familie" on public.lp_data;
create policy "lp_data familie" on public.lp_data for all to authenticated using (true) with check (true);
revoke all on public.lp_data from anon;
grant select, insert, update, delete on public.lp_data to authenticated;

-- Änderungen live an den Familienplan melden (wie bei den ep_-Tabellen)
do $$ begin
  alter publication supabase_realtime add table public.lp_data;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- ===== Ansichten für den Familienplan =====

-- Heute erledigte Schulaufgaben (für den Bereich "Erledigt")
create or replace view public.lp_erledigt_heute with (security_invoker = on) as
select
  data->>'subject'            as fach,
  data->>'title'              as aufgabe,
  data->>'kind'               as art,          -- ha = Hausaufgabe, lern = Prüfungslernen, daily = Ludus Latinus
  (data->>'actual')::int      as minuten,
  updated_at                  as erledigt_um
from public.lp_data
where coll = 'task' and not deleted
  and (data->>'done')::boolean
  and data->>'doneAt' = to_char(now() at time zone 'Europe/Berlin', 'YYYY-MM-DD')
order by updated_at;

-- Zusammenfassung für eine Karte in der Familien-App
create or replace view public.lp_stand with (security_invoker = on) as
with heute as (select to_char(now() at time zone 'Europe/Berlin', 'YYYY-MM-DD') as d),
woche as (select date_trunc('week', now() at time zone 'Europe/Berlin')::date as mo)
select
  (select count(*) from public.lp_erledigt_heute)                                         as heute_erledigt,
  (select coalesce(sum(minuten), 0) from public.lp_erledigt_heute)                        as heute_minuten,
  exists (select 1 from public.lp_data, heute where id = 'win:' || heute.d and not deleted and (data->>'v')::boolean) as tagessieg,
  (select data->>'v' from public.lp_data, heute where id = 'kick:' || heute.d and not deleted)                       as anpfiff,
  (select count(*) from public.lp_data, woche
     where coll = 'win' and not deleted and (data->>'v')::boolean
       and (data->>'k')::date between woche.mo and woche.mo + 4)                           as siege_woche,
  (select coalesce((data->>'winGoal')::int, 4) from public.lp_data where id = 'settings')  as siegziel,
  (select coalesce((data->>'bedtimeMin')::int, 30) from public.lp_data where id = 'settings') as aufbleiben_min,
  (select count(*) from public.lp_data where coll = 'help' and not deleted)               as hilfe_offen,
  (select data->>'kidId' from public.lp_data where id = 'settings')                       as kind_id,
  (select coalesce(sum((data->>'n')::int), 0) from public.lp_data where coll = 'goal' and not deleted) as tore_gesamt;

revoke all on public.lp_erledigt_heute, public.lp_stand from anon;
grant select on public.lp_erledigt_heute, public.lp_stand to authenticated;
