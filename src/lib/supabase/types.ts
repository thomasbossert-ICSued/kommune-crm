// Supabase Database Types for Tippgeber-CRM

export type Geschaeftsbereich = {
  id: string
  name: string
  beschreibung: string | null
  farbe: string
  aktiv: boolean
}

export type Berater = {
  id: string
  vorname: string
  nachname: string
  email: string
  telefon: string | null
  funktion: 'vertrieb' | 'strategie'
  aktiv: boolean
  erstellt_am: string
}

export type Tippgeber = {
  id: string
  vorname: string
  nachname: string
  email: string | null
  telefon: string | null
  firma: string
  zugangs_token: string
  token_aktiv: boolean
  token_erstellt_am: string
  tipps_gesamt: number
  tipps_erfolgreich: number
  provision_gesamt: number
  notizen: string | null
  aktiv: boolean
  erstellt_von: string | null
  erstellt_am: string
}

export type Kontakt = {
  id: string
  typ: 'kommune' | 'kommunaler_betrieb' | 'person'
  name: string
  organisation: string | null
  position: string | null
  email: string | null
  telefon: string | null
  adresse: string | null
  stadt: string | null
  plz: string | null
  bundesland: string | null
  einwohner: number | null
  mitarbeiter: number | null
  notizen: string | null
  erstellt_am: string
  aktualisiert_am: string
}

export type Tipp = {
  id: string
  tippgeber_id: string
  geschaeftsbereich_id: string | null
  kontakt_id: string | null
  kunde_name: string | null
  kunde_telefon: string | null
  kunde_email: string | null
  kunde_organisation: string | null
  bedarf: string | null
  produkt_bereich: string | null
  zugewiesen_an: string | null
  phase: string
  geschaetzter_wert: number | null
  provision_betrag: number | null
  provision_bezahlt: boolean
  provision_bezahlt_am: string | null
  erstellt_am: string
  aktualisiert_am: string
  abgeschlossen_am: string | null
  quelle: string
  // Joined fields
  tippgeber?: Tippgeber
  berater?: Berater
  geschaeftsbereich?: Geschaeftsbereich
  kontakt?: Kontakt
}

export type PipelinePhase = {
  id: string
  name: string
  reihenfolge: number
  farbe: string
  ist_abschluss: boolean
  ist_verloren: boolean
  tippgeber_sichtbar_text: string | null
  tippgeber_benachrichtigen: boolean
}

export type Aktivitaet = {
  id: string
  typ: 'anruf' | 'email' | 'meeting' | 'notiz' | 'aufgabe' | 'status_aenderung'
  titel: string
  beschreibung: string | null
  tipp_id: string | null
  kontakt_id: string | null
  faellig_am: string | null
  erledigt: boolean
  erledigt_am: string | null
  alte_phase: string | null
  neue_phase: string | null
  tippgeber_sichtbar: boolean
  erstellt_von: string | null
  erstellt_am: string
}

export type EmailLog = {
  id: string
  tippgeber_id: string
  tipp_id: string | null
  typ: string
  betreff: string
  empfaenger_email: string
  gesendet_am: string
  resend_id: string | null
}
