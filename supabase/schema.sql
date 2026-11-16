-- Familienplan: Tabellen, Zugriffsregeln und Live-Abgleich.
-- Einmal im Supabase-Dashboard unter "SQL Editor" ausführen.
-- Das Präfix ep_ verhindert Konflikte mit anderen Tabellen im selben Projekt.

create table if not exists public.ep_persons (
  id    text primary key,
  name  text not null,
  color text,
  sort  integer not null default 0,
  adult boolean not null default false
);
-- Für Datenbanken, die mit einer älteren Fassung dieser Datei angelegt wurden.
alter table public.ep_persons add column if not exists adult boolean not null default false;
alter table public.ep_persons add column if not exists pin_hash text;
alter table public.ep_persons add column if not exists screen_base integer;
alter table public.ep_persons add column if not exists earn_cap integer;
-- Erinnerung, wenn es Zeit zum Kochen ist (nur Erwachsene). Abschaltbar in der App.
alter table public.ep_persons add column if not exists notify_cook boolean not null default true;
-- Morgenüberblick per Push. Abschaltbar in der App.
alter table public.ep_persons add column if not exists notify_morning boolean not null default true;
-- Erinnerung am Abend, das Essen zu bewerten. Abschaltbar in der App.
alter table public.ep_persons add column if not exists notify_rating boolean not null default true;
alter table public.ep_persons add column if not exists notify_list boolean not null default true;

create table if not exists public.ep_dishes (
  id              text primary key,
  name            text not null,
  category        text not null default 'gemischt',
  duration_min    integer not null default 30,
  tags            jsonb not null default '[]'::jsonb,
  note            text not null default '',
  ingredients     jsonb not null default '[]'::jsonb,
  steps           jsonb not null default '[]'::jsonb,
  favorite        boolean not null default false,
  manual_archived boolean not null default false,
  rule_from       timestamptz not null default '1970-01-01T00:00:00Z',
  created_at      timestamptz not null default now()
);
-- Für Datenbanken, die mit einer älteren Fassung dieser Datei angelegt wurden.
alter table public.ep_dishes add column if not exists favorite boolean not null default false;
alter table public.ep_dishes add column if not exists pause_until date;
-- Vorbereitung am Vorabend, eigene Nährwerte pro Portion und Stückzahl bei Brotbox-Rezepten.
alter table public.ep_dishes add column if not exists prep text not null default '';
alter table public.ep_dishes add column if not exists nutrition jsonb;
alter table public.ep_dishes add column if not exists pieces integer;
-- Portionen, wenn ein Rezept bewusst für mehr als 4 gedacht ist (zum Beispiel zwei Packungen Fleisch).
alter table public.ep_dishes add column if not exists servings integer;

create table if not exists public.ep_plan (
  day      date primary key,
  dish_id  text references public.ep_dishes(id) on delete set null,
  lunchbox text not null default '',
  skipped  boolean not null default false
);
-- Essenszeit und wer nicht mitisst. Die App rechnet beides aus den Terminen aus, die Push-Funktion
-- bestimmt daraus, wann die Kocherinnerung kommt.
alter table public.ep_plan add column if not exists dinner_time text;
alter table public.ep_plan add column if not exists dinner_away jsonb not null default '[]'::jsonb;
-- Notiz für den Vorabend, z. B. für die Brotbox.
alter table public.ep_plan add column if not exists prep text not null default '';

create table if not exists public.ep_ratings (
  day        date not null references public.ep_plan(day) on delete cascade,
  person_id  text not null references public.ep_persons(id) on delete cascade,
  dish_id    text not null references public.ep_dishes(id) on delete cascade,
  stars      smallint not null check (stars between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (day, person_id)
);

-- Sterne der Kinder für die Brotbox. lunchbox hält den Text fest, zu dem bewertet wurde.
create table if not exists public.ep_lunch_ratings (
  day        date not null references public.ep_plan(day) on delete cascade,
  person_id  text not null references public.ep_persons(id) on delete cascade,
  stars      smallint not null check (stars between 1 and 5),
  lunchbox   text not null default '',
  updated_at timestamptz not null default now(),
  primary key (day, person_id)
);

-- Herz der Kinder für das Lieblingsgericht der Woche, eines pro Kind und Woche.
create table if not exists public.ep_week_hearts (
  week_start date not null,
  person_id  text not null references public.ep_persons(id) on delete cascade,
  dish_id    text not null references public.ep_dishes(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (week_start, person_id)
);

-- Haushaltsaufgaben. minutes 0 heißt Grundaufgabe ohne Bildschirmzeit.
create table if not exists public.ep_tasks (
  id          text primary key,
  name        text not null,
  minutes     integer not null default 0,
  schedule    text not null default 'bedarf',
  who         jsonb not null default '[]'::jsonb,
  rotate      boolean not null default false,
  rot_offset  integer not null default 0,
  max_per_day integer not null default 1,
  months      jsonb not null default '[]'::jsonb,
  note        text not null default '',
  active      boolean not null default true,
  sort        integer not null default 0
);

-- Erledigte Aufgaben und eingelöste Bildschirmzeit (negative Minuten).
create table if not exists public.ep_task_log (
  id         text primary key,
  person_id  text not null references public.ep_persons(id) on delete cascade,
  task_id    text references public.ep_tasks(id) on delete set null,
  day        date not null,
  label      text not null default '',
  minutes    integer not null default 0,
  status     text not null default 'offen' check (status in ('offen', 'bestaetigt', 'abgelehnt')),
  created_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz
);
create index if not exists ep_task_log_day_idx on public.ep_task_log (day);

-- Wiederkehrende Termine wie Training, Ballett oder Dienste.
create table if not exists public.ep_events (
  id           text primary key,
  title        text not null,
  who          jsonb not null default '[]'::jsonb,
  weekdays     jsonb not null default '[]'::jsonb,
  start_time   text,
  end_time     text,
  home_time    text,
  pause_ferien boolean not null default true,
  valid_from   date,
  valid_to     date,
  active       boolean not null default true,
  sort         integer not null default 0
);

-- Wer isst an einem Tag mit: da, spaet (mit Uhrzeit) oder weg.
create table if not exists public.ep_attendance (
  day       date not null,
  person_id text not null references public.ep_persons(id) on delete cascade,
  status    text not null check (status in ('da', 'spaet', 'weg')),
  time      text,
  primary key (day, person_id)
);

-- Vorrat: was meistens im Haus ist.
create table if not exists public.ep_pantry (
  id    text primary key,
  label text not null,
  have  boolean not null default true,
  sort  integer not null default 0
);

-- „Immer wieder“: Dinge, die regelmäßig gebraucht werden (Milch, Klopapier, Heu).
create table if not exists public.ep_staples (
  id         text primary key,
  label      text not null,
  category   text not null default 'sonst',
  qty        text not null default '',
  sort       integer not null default 0,
  last_added date
);

-- Einstellungen als Schlüssel und Wert: Regeln für den Wochenplan, Wunsch für den nächsten Entwurf,
-- und der Kontext, den die App für Claude bereitstellt (Bewertungen, Schulferien, Essenszeiten).
create table if not exists public.ep_settings (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz not null default now()
);

-- Wochenplan-Entwürfe von Claude. Die Push-Funktion schreibt sie, die App zeigt sie an und gibt sie frei.
create table if not exists public.ep_ai_runs (
  id          text primary key,
  week_start  date not null,
  status      text not null default 'angebote',
  batch_id    text,
  messages    jsonb,
  offers      text not null default '',
  draft       jsonb,
  warnings    jsonb not null default '[]'::jsonb,
  error       text not null default '',
  attempts    integer not null default 0,
  trigger     text not null default 'auto',
  wish        text not null default '',
  model       text,
  usage       jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  text
);

-- Haushaltsbuch: ein Eintrag pro Kassenzettel, die Posten als Liste.
create table if not exists public.ep_receipts (
  id          text primary key,
  day         date not null,
  shop        text not null default '',
  total       numeric(10,2) not null default 0,
  items       jsonb not null default '[]'::jsonb,
  note        text not null default '',
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ep_receipts_day on public.ep_receipts (day);

create table if not exists public.ep_shopping (
  id         text primary key,
  week_start date not null,
  trip       text not null default 'Einkauf',
  category   text not null default 'sonst',
  label      text not null,
  qty        text not null default '',
  sort       integer not null default 0,
  checked    boolean not null default false,
  checked_by text references public.ep_persons(id) on delete set null,
  checked_at timestamptz,
  manual     boolean not null default false
);
-- Einkaufstag: An diesem Tag erinnert die Push-Funktion die Eltern.
alter table public.ep_tasks add column if not exists school_only boolean not null default false;
alter table public.ep_shopping add column if not exists due date;
-- Wer den Einkauf übernimmt (Person). Wird in der App per Haken gesetzt.
alter table public.ep_shopping add column if not exists buyer text;
-- Wofür der Posten gedacht ist, und ob er beim Einkauf nicht zu bekommen war.
alter table public.ep_shopping add column if not exists purpose text not null default '';
alter table public.ep_shopping add column if not exists missing boolean not null default false;
-- Verweis auf den „Immer wieder“-Eintrag, aus dem der Posten stammt.
alter table public.ep_shopping add column if not exists staple_id text;
-- Markt: leer heißt Aldi Süd, 'lidl' heißt Lidl.
alter table public.ep_shopping add column if not exists shop text;
-- Wer hat einen Eintrag von Hand dazugeschrieben, und wann (für die Push-Nachricht an die anderen).
alter table public.ep_shopping add column if not exists added_by text;
alter table public.ep_shopping add column if not exists created_at timestamptz;
-- Gäste zum Abendessen an einem Tag (Mengen werden hochgerechnet).
alter table public.ep_plan add column if not exists guests integer not null default 0;
-- Vorrat: wann zuletzt gekauft oder bestätigt.
alter table public.ep_pantry add column if not exists seen_at date;

-- Abfuhrtermine der Mülltonnen. Die App trägt sie aus js/abfuhr.js ein, die Push-Funktion liest sie.
create table if not exists public.ep_abfuhr (
  day date not null,
  bin text not null,
  primary key (day, bin)
);

-- Geräte, die Push-Nachrichten bekommen. Eine Zeile pro Gerät und Browser.
create table if not exists public.ep_push_subs (
  endpoint   text primary key,
  person_id  text not null references public.ep_persons(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

-- Zustellstatus pro Gerät, damit die App zeigen kann, ob Nachrichten ankommen.
alter table public.ep_push_subs add column if not exists last_ok_at  timestamptz;
alter table public.ep_push_subs add column if not exists last_status integer;
alter table public.ep_push_subs add column if not exists last_error  text;
-- Die letzten zehn Nachrichten an dieses Gerät mit Uhrzeit und Ergebnis.
alter table public.ep_push_subs add column if not exists history     jsonb not null default '[]'::jsonb;

-- Bereits verschickte Nachrichten, damit nichts doppelt ankommt. Nur die Push-Funktion greift darauf zu.
create table if not exists public.ep_push_log (
  key     text primary key,
  sent_at timestamptz not null default now()
);
alter table public.ep_push_log enable row level security;

create index if not exists ep_shopping_week_idx on public.ep_shopping (week_start);
create index if not exists ep_ratings_dish_idx on public.ep_ratings (dish_id);

-- Zugriff nur für angemeldete Nutzer, also für den Familienzugang.
alter table public.ep_persons  enable row level security;
alter table public.ep_dishes   enable row level security;
alter table public.ep_plan     enable row level security;
alter table public.ep_ratings  enable row level security;
alter table public.ep_shopping enable row level security;
alter table public.ep_lunch_ratings enable row level security;
alter table public.ep_week_hearts enable row level security;
alter table public.ep_tasks enable row level security;
alter table public.ep_task_log enable row level security;
alter table public.ep_events enable row level security;
alter table public.ep_attendance enable row level security;
alter table public.ep_pantry enable row level security;
alter table public.ep_staples enable row level security;
alter table public.ep_settings enable row level security;
alter table public.ep_ai_runs enable row level security;
alter table public.ep_receipts enable row level security;
alter table public.ep_abfuhr enable row level security;
alter table public.ep_push_subs enable row level security;

grant select, insert, update, delete on
  public.ep_persons, public.ep_dishes, public.ep_plan, public.ep_ratings, public.ep_shopping, public.ep_lunch_ratings, public.ep_week_hearts,
  public.ep_tasks, public.ep_task_log, public.ep_events, public.ep_attendance, public.ep_pantry, public.ep_staples, public.ep_settings, public.ep_ai_runs,
  public.ep_receipts, public.ep_abfuhr, public.ep_push_subs
  to authenticated;

drop policy if exists "Familie" on public.ep_persons;
drop policy if exists "Familie" on public.ep_dishes;
drop policy if exists "Familie" on public.ep_plan;
drop policy if exists "Familie" on public.ep_ratings;
drop policy if exists "Familie" on public.ep_shopping;
drop policy if exists "Familie" on public.ep_lunch_ratings;
drop policy if exists "Familie" on public.ep_week_hearts;
drop policy if exists "Familie" on public.ep_tasks;
drop policy if exists "Familie" on public.ep_task_log;
drop policy if exists "Familie" on public.ep_events;
drop policy if exists "Familie" on public.ep_attendance;
drop policy if exists "Familie" on public.ep_pantry;
drop policy if exists "Familie" on public.ep_staples;
drop policy if exists "Familie" on public.ep_settings;
drop policy if exists "Familie" on public.ep_ai_runs;
drop policy if exists "Familie" on public.ep_abfuhr;
drop policy if exists "Familie" on public.ep_push_subs;

create policy "Familie" on public.ep_persons  for all to authenticated using (true) with check (true);
create policy "Familie" on public.ep_dishes   for all to authenticated using (true) with check (true);
create policy "Familie" on public.ep_plan     for all to authenticated using (true) with check (true);
create policy "Familie" on public.ep_ratings  for all to authenticated using (true) with check (true);
create policy "Familie" on public.ep_shopping for all to authenticated using (true) with check (true);
create policy "Familie" on public.ep_lunch_ratings for all to authenticated using (true) with check (true);
create policy "Familie" on public.ep_week_hearts for all to authenticated using (true) with check (true);
create policy "Familie" on public.ep_tasks       for all to authenticated using (true) with check (true);
create policy "Familie" on public.ep_task_log    for all to authenticated using (true) with check (true);
create policy "Familie" on public.ep_events      for all to authenticated using (true) with check (true);
create policy "Familie" on public.ep_attendance  for all to authenticated using (true) with check (true);
create policy "Familie" on public.ep_pantry      for all to authenticated using (true) with check (true);
create policy "Familie" on public.ep_staples     for all to authenticated using (true) with check (true);
create policy "Familie" on public.ep_settings    for all to authenticated using (true) with check (true);
create policy "Familie" on public.ep_ai_runs     for all to authenticated using (true) with check (true);
drop policy if exists "Familie" on public.ep_receipts;
create policy "Familie" on public.ep_receipts    for all to authenticated using (true) with check (true);
create policy "Familie" on public.ep_abfuhr      for all to authenticated using (true) with check (true);
create policy "Familie" on public.ep_push_subs   for all to authenticated using (true) with check (true);

-- Live-Abgleich: Häkchen und Sterne erscheinen sofort auf den anderen Geräten.
do $$
declare t text;
begin
  foreach t in array array['ep_persons', 'ep_dishes', 'ep_plan', 'ep_ratings', 'ep_shopping', 'ep_lunch_ratings', 'ep_week_hearts', 'ep_tasks', 'ep_task_log', 'ep_events', 'ep_attendance', 'ep_pantry', 'ep_staples', 'ep_settings', 'ep_ai_runs', 'ep_receipts'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Datensicherung: privater Speicherplatz "sicherung". Die Push-Funktion legt jeden Sonntag eine Sicherung ab,
-- angemeldete Familienmitglieder dürfen sie lesen und herunterladen.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public) values ('sicherung', 'sicherung', false) on conflict (id) do nothing;
    drop policy if exists "Familie liest Sicherungen" on storage.objects;
    create policy "Familie liest Sicherungen" on storage.objects for select to authenticated using (bucket_id = 'sicherung');
  end if;
end $$;
