-- ============================================
-- TIPPGEBER-CRM SCHEMA (Kommunaler Vertrieb)
-- ============================================

-- Geschaeftsbereiche
create table if not exists geschaeftsbereiche (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  beschreibung text,
  farbe text default '#3B82F6',
  aktiv boolean default true
);

-- Berater-Profile (erweitert Supabase Auth)
create table if not exists berater (
  id uuid primary key references auth.users(id) on delete cascade,
  vorname text not null,
  nachname text not null,
  email text not null,
  telefon text,
  funktion text not null check (funktion in ('vertrieb', 'strategie')),
  aktiv boolean default true,
  erstellt_am timestamptz default now()
);

-- Berater <-> Geschaeftsbereiche (m:n)
create table if not exists berater_geschaeftsbereiche (
  berater_id uuid references berater(id) on delete cascade,
  geschaeftsbereich_id uuid references geschaeftsbereiche(id) on delete cascade,
  primary key (berater_id, geschaeftsbereich_id)
);

-- Tippgeber (KEIN Supabase Auth User!)
create table if not exists tippgeber (
  id uuid primary key default gen_random_uuid(),
  vorname text not null,
  nachname text not null,
  email text,
  telefon text,
  firma text default 'Swiss Life Select',
  zugangs_token text unique not null,
  token_aktiv boolean default true,
  token_erstellt_am timestamptz default now(),
  tipps_gesamt integer default 0,
  tipps_erfolgreich integer default 0,
  provision_gesamt numeric(12,2) default 0,
  notizen text,
  aktiv boolean default true,
  erstellt_von uuid references berater(id),
  erstellt_am timestamptz default now()
);

-- Kontakte
create table if not exists kontakte (
  id uuid primary key default gen_random_uuid(),
  typ text not null check (typ in ('kommune', 'kommunaler_betrieb', 'person')),
  name text not null,
  organisation text,
  position text,
  email text,
  telefon text,
  adresse text,
  stadt text,
  plz text,
  bundesland text,
  einwohner integer,
  mitarbeiter integer,
  notizen text,
  erstellt_am timestamptz default now(),
  aktualisiert_am timestamptz default now()
);

-- Pipeline-Phasen
create table if not exists pipeline_phasen (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  reihenfolge integer not null,
  farbe text default '#3B82F6',
  ist_abschluss boolean default false,
  ist_verloren boolean default false,
  tippgeber_sichtbar_text text,
  tippgeber_benachrichtigen boolean default true
);

-- TIPPS (zentrale Entitaet)
create table if not exists tipps (
  id uuid primary key default gen_random_uuid(),
  tippgeber_id uuid not null references tippgeber(id),
  geschaeftsbereich_id uuid references geschaeftsbereiche(id),
  kontakt_id uuid references kontakte(id),
  kunde_name text,
  kunde_telefon text,
  kunde_email text,
  kunde_organisation text,
  bedarf text,
  produkt_bereich text,
  zugewiesen_an uuid references berater(id),
  phase text not null default 'Neuer Tipp',
  geschaetzter_wert numeric(12,2),
  provision_betrag numeric(10,2),
  provision_bezahlt boolean default false,
  provision_bezahlt_am date,
  erstellt_am timestamptz default now(),
  aktualisiert_am timestamptz default now(),
  abgeschlossen_am timestamptz,
  quelle text default 'manuell'
);

-- Aktivitaeten
create table if not exists aktivitaeten (
  id uuid primary key default gen_random_uuid(),
  typ text not null check (typ in ('anruf', 'email', 'meeting', 'notiz', 'aufgabe', 'status_aenderung')),
  titel text not null,
  beschreibung text,
  tipp_id uuid references tipps(id) on delete cascade,
  kontakt_id uuid references kontakte(id) on delete set null,
  faellig_am timestamptz,
  erledigt boolean default false,
  erledigt_am timestamptz,
  alte_phase text,
  neue_phase text,
  tippgeber_sichtbar boolean default false,
  erstellt_von uuid references berater(id),
  erstellt_am timestamptz default now()
);

-- E-Mail-Log
create table if not exists email_log (
  id uuid primary key default gen_random_uuid(),
  tippgeber_id uuid not null references tippgeber(id),
  tipp_id uuid references tipps(id) on delete set null,
  typ text not null,
  betreff text not null,
  empfaenger_email text not null,
  gesendet_am timestamptz default now(),
  resend_id text
);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

create or replace function generate_token(length integer default 32)
returns text as $$
declare
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i integer;
begin
  for i in 1..length loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  end loop;
  return result;
end;
$$ language plpgsql;

create or replace function set_default_token()
returns trigger as $$
begin
  if new.zugangs_token is null or new.zugangs_token = '' then
    new.zugangs_token := generate_token(32);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists tippgeber_default_token on tippgeber;
create trigger tippgeber_default_token before insert on tippgeber
  for each row execute function set_default_token();

create or replace function update_aktualisiert_am()
returns trigger as $$
begin
  new.aktualisiert_am = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists kontakte_aktualisiert on kontakte;
create trigger kontakte_aktualisiert before update on kontakte
  for each row execute function update_aktualisiert_am();

drop trigger if exists tipps_aktualisiert on tipps;
create trigger tipps_aktualisiert before update on tipps
  for each row execute function update_aktualisiert_am();

create or replace function on_tipp_phase_change()
returns trigger as $$
begin
  if old.phase is distinct from new.phase then
    insert into aktivitaeten (typ, titel, beschreibung, tipp_id, alte_phase, neue_phase, tippgeber_sichtbar, erstellt_von)
    values (
      'status_aenderung',
      'Status: ' || old.phase || ' → ' || new.phase,
      'Tipp wurde nach "' || new.phase || '" verschoben.',
      new.id, old.phase, new.phase,
      true, new.zugewiesen_an
    );

    if exists (select 1 from pipeline_phasen where name = new.phase and (ist_abschluss or ist_verloren)) then
      new.abgeschlossen_am := now();
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists tipp_phase_change on tipps;
create trigger tipp_phase_change before update on tipps
  for each row execute function on_tipp_phase_change();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table berater enable row level security;
alter table berater_geschaeftsbereiche enable row level security;
alter table geschaeftsbereiche enable row level security;
alter table tippgeber enable row level security;
alter table kontakte enable row level security;
alter table tipps enable row level security;
alter table aktivitaeten enable row level security;
alter table email_log enable row level security;
alter table pipeline_phasen enable row level security;

-- Berater Vollzugriff
do $$
declare
  t text;
begin
  for t in select unnest(array['berater','berater_geschaeftsbereiche','geschaeftsbereiche','tippgeber','kontakte','tipps','aktivitaeten','email_log','pipeline_phasen'])
  loop
    execute format('drop policy if exists "Berater Vollzugriff" on %I', t);
    execute format('create policy "Berater Vollzugriff" on %I for all using (auth.role() = ''authenticated'')', t);
  end loop;
end $$;

-- ============================================
-- DEFAULT-DATEN
-- ============================================

insert into geschaeftsbereiche (name, beschreibung, farbe) values
  ('Kommunales Bausparen', 'Bauspar-Loesungen fuer Kommunen und kommunale Mitarbeiter', '#2563EB'),
  ('bKV & bAV', 'Betriebliche Krankenversicherung und Altersvorsorge', '#7C3AED')
on conflict (name) do nothing;

insert into pipeline_phasen (name, reihenfolge, farbe, ist_abschluss, ist_verloren, tippgeber_sichtbar_text, tippgeber_benachrichtigen) values
  ('Neuer Tipp',         1, '#94A3B8', false, false, 'Eingegangen',                  true),
  ('Zugewiesen',         2, '#6366F1', false, false, 'In Bearbeitung',               false),
  ('Kontaktaufnahme',    3, '#3B82F6', false, false, 'In Bearbeitung',               false),
  ('Termin vereinbart',  4, '#0EA5E9', false, false, 'Termin steht',                 true),
  ('In Beratung',        5, '#F59E0B', false, false, 'In Beratung',                  false),
  ('Angebot',            6, '#8B5CF6', false, false, 'Angebot unterbreitet',         true),
  ('Abschluss',          7, '#10B981', true,  false, 'Erfolgreich abgeschlossen!',   true),
  ('Verloren',           8, '#EF4444', false, true,  'Leider kein Abschluss',        true)
on conflict do nothing;
