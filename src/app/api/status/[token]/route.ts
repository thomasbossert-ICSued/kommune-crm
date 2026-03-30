import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = createServiceClient()

  // Tippgeber per Token finden
  const { data: tippgeber, error: tgError } = await supabase
    .from('tippgeber')
    .select('id, vorname, nachname, firma, token_aktiv')
    .eq('zugangs_token', token)
    .eq('token_aktiv', true)
    .single()

  if (tgError || !tippgeber) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 404 })
  }

  // Tipps laden
  const { data: tipps } = await supabase
    .from('tipps')
    .select('id, kunde_name, kunde_organisation, phase, erstellt_am')
    .eq('tippgeber_id', tippgeber.id)
    .order('erstellt_am', { ascending: false })

  // Pipeline-Phasen für Tippgeber-sichtbaren Text
  const { data: phasen } = await supabase
    .from('pipeline_phasen')
    .select('name, tippgeber_sichtbar_text, ist_abschluss, ist_verloren')

  const phasenMap = new Map(phasen?.map((p: any) => [p.name, p]) || [])

  const tippsMapped = tipps?.map((tipp: any) => {
    const phase: any = phasenMap.get(tipp.phase)
    return {
      id: tipp.id,
      kunde: tipp.kunde_name || tipp.kunde_organisation || 'Tipp',
      status: phase?.tippgeber_sichtbar_text || tipp.phase,
      ist_abschluss: phase?.ist_abschluss || false,
      ist_verloren: phase?.ist_verloren || false,
      datum: tipp.erstellt_am,
    }
  })

  return NextResponse.json({
    tippgeber: { vorname: tippgeber.vorname, nachname: tippgeber.nachname },
    tipps: tippsMapped,
  })
}
