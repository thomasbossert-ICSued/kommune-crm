-- ============================================
-- MIGRATION: Termine, Wiedervorlage, Notizen-Chat
-- Führe dieses SQL im Supabase SQL-Editor aus
-- ============================================

-- Wiedervorlage und Termin direkt am Tipp
ALTER TABLE tipps ADD COLUMN IF NOT EXISTS wiedervorlage_am DATE;
ALTER TABLE tipps ADD COLUMN IF NOT EXISTS naechster_termin_am TIMESTAMPTZ;
ALTER TABLE tipps ADD COLUMN IF NOT EXISTS termin_notiz TEXT;

-- Notizen brauchen den Berater-Namen zum Anzeigen
-- aktivitaeten.erstellt_von referenziert berater.id – das ist bereits so
-- Wir ergänzen nur einen Index für Performance
CREATE INDEX IF NOT EXISTS idx_aktivitaeten_tipp_id ON aktivitaeten(tipp_id);
CREATE INDEX IF NOT EXISTS idx_aktivitaeten_typ ON aktivitaeten(typ);
