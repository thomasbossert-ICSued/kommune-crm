-- ============================================
-- MIGRATION: Kommunen-Verwaltung
-- Führe dieses SQL im Supabase SQL-Editor aus
-- ============================================

-- Kommunen-Tabelle
CREATE TABLE IF NOT EXISTS kommunen (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  typ         TEXT NOT NULL DEFAULT 'gemeinde'
                CHECK (typ IN ('gemeinde', 'stadt', 'landkreis', 'kommunaler_betrieb', 'zweckverband', 'sonstige')),
  adresse     TEXT,
  stadt       TEXT,
  plz         TEXT,
  bundesland  TEXT,
  einwohner   INTEGER,
  mitarbeiter INTEGER,
  notizen     TEXT,
  aktiv       BOOLEAN NOT NULL DEFAULT true,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Personen zu einer Kommune (1 Hauptansprechpartner + bis zu 2 weitere)
CREATE TABLE IF NOT EXISTS kommunen_personen (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kommune_id   uuid NOT NULL REFERENCES kommunen(id) ON DELETE CASCADE,
  reihenfolge  INTEGER NOT NULL DEFAULT 1,  -- 1 = Hauptansprechpartner, 2 und 3 = optional
  vorname      TEXT NOT NULL,
  nachname     TEXT NOT NULL,
  position     TEXT,        -- Funktion/Position in der Kommune (z.B. "Bürgermeister", "Kämmerer")
  email        TEXT,
  telefon      TEXT,
  erstellt_am  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- kommune_id in tipps-Tabelle ergänzen (optional, rückwärts-kompatibel)
ALTER TABLE tipps ADD COLUMN IF NOT EXISTS kommune_id uuid REFERENCES kommunen(id) ON DELETE SET NULL;

-- Trigger für aktualisiert_am
CREATE TRIGGER kommunen_aktualisiert
  BEFORE UPDATE ON kommunen
  FOR EACH ROW EXECUTE FUNCTION update_aktualisiert_am();

-- Row Level Security
ALTER TABLE kommunen ENABLE ROW LEVEL SECURITY;
ALTER TABLE kommunen_personen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Berater Vollzugriff" ON kommunen
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Berater Vollzugriff" ON kommunen_personen
  FOR ALL USING (auth.role() = 'authenticated');
