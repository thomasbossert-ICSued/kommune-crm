import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Webhook für Status-Änderungen → E-Mail an Tippgeber
export async function POST(request: Request) {
  const body = await request.json()
  const { tipp_id, neue_phase } = body

  if (!tipp_id || !neue_phase) {
    return NextResponse.json({ error: 'Missing tipp_id or neue_phase' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Phase prüfen ob Benachrichtigung nötig
  const { data: phase } = await supabase
    .from('pipeline_phasen')
    .select('tippgeber_benachrichtigen, tippgeber_sichtbar_text')
    .eq('name', neue_phase)
    .single()

  if (!phase?.tippgeber_benachrichtigen) {
    return NextResponse.json({ message: 'Keine Benachrichtigung für diese Phase' })
  }

  // Tipp + Tippgeber laden
  const { data: tipp } = await supabase
    .from('tipps')
    .select('id, kunde_name, kunde_organisation, tippgeber_id, tippgeber(vorname, nachname, email, zugangs_token)')
    .eq('id', tipp_id)
    .single()

  if (!tipp || !(tipp as any).tippgeber?.email) {
    return NextResponse.json({ message: 'Kein Tippgeber oder keine E-Mail' })
  }

  const tippgeber = (tipp as any).tippgeber
  const statusText = phase.tippgeber_sichtbar_text || neue_phase
  const kunde = tipp.kunde_name || tipp.kunde_organisation || 'Dein Tipp'
  const statusUrl = `${process.env.NEXT_PUBLIC_APP_URL}/status/${tippgeber.zugangs_token}`

  // E-Mail via Resend senden
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Kommune CRM <noreply@ic-sued.de>',
          to: tippgeber.email,
          subject: `Status-Update: ${kunde} – ${statusText}`,
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto;">
              <div style="background: #E4002B; padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 20px;">Kommune CRM</h1>
              </div>
              <div style="padding: 24px; background: white; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px;">
                <p>Hallo ${tippgeber.vorname},</p>
                <p>es gibt ein Update zu deinem Tipp <strong>${kunde}</strong>:</p>
                <div style="background: #F8F8F8; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
                  <p style="font-size: 18px; font-weight: bold; color: #1A1A2E; margin: 0;">${statusText}</p>
                </div>
                <a href="${statusUrl}" style="display: block; background: #E4002B; color: white; text-align: center; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                  Alle Tipps ansehen
                </a>
                <p style="color: #9CA3AF; font-size: 12px; margin-top: 24px;">
                  IC Süd · Kommunaler Strukturvertrieb
                </p>
              </div>
            </div>
          `,
        }),
      })

      const emailResult = await res.json()

      // E-Mail Log
      await supabase.from('email_log').insert({
        tippgeber_id: tipp.tippgeber_id,
        tipp_id: tipp.id,
        typ: 'status_aenderung',
        betreff: `Status-Update: ${kunde} – ${statusText}`,
        empfaenger_email: tippgeber.email,
        resend_id: emailResult.id || null,
      })

      return NextResponse.json({ success: true, email_sent: true })
    } catch (err) {
      console.error('E-Mail Fehler:', err)
      return NextResponse.json({ success: true, email_sent: false, error: 'Email failed' })
    }
  }

  return NextResponse.json({ success: true, email_sent: false, reason: 'No RESEND_API_KEY' })
}
