import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function StatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createServiceClient()

  // Tippgeber per Token finden
  const { data: tippgeber } = await supabase
    .from('tippgeber')
    .select('id, vorname, nachname, firma, token_aktiv')
    .eq('zugangs_token', token)
    .eq('token_aktiv', true)
    .single()

  if (!tippgeber) return notFound()

  // Tipps des Tippgebers laden
  const { data: tipps } = await supabase
    .from('tipps')
    .select('id, kunde_name, kunde_organisation, phase, erstellt_am, geschaeftsbereich_id, geschaeftsbereiche:geschaeftsbereich_id(name, farbe)')
    .eq('tippgeber_id', tippgeber.id)
    .order('erstellt_am', { ascending: false })

  // Pipeline-Phasen für sichtbaren Text
  const { data: phasen } = await supabase
    .from('pipeline_phasen')
    .select('name, tippgeber_sichtbar_text, farbe, ist_abschluss, ist_verloren')

  const phasenMap = new Map(phasen?.map((p: any) => [p.name, p] as const) || [])

  return (
    <div className="min-h-screen bg-[#F8F8F8]">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="mx-auto max-w-2xl px-4 py-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#E4002B]">
            <span className="text-lg font-bold text-white">K</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Deine Tipps</h1>
          <p className="mt-1 text-sm text-gray-500">
            Hallo {tippgeber.vorname}! Hier siehst du den aktuellen Stand deiner Tipps.
          </p>
        </div>
      </div>

      {/* Tipps */}
      <div className="mx-auto max-w-2xl px-4 py-8">
        {tipps && tipps.length > 0 ? (
          <div className="space-y-3">
            {tipps.map((tipp: any) => {
              const phase: any = phasenMap.get(tipp.phase)
              const statusText = phase?.tippgeber_sichtbar_text || tipp.phase
              const isSuccess = phase?.ist_abschluss
              const isLost = phase?.ist_verloren

              return (
                <div key={tipp.id} className="rounded-xl border border-[#E5E7EB] bg-white p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-[#1A1A2E]">
                        {tipp.kunde_name || tipp.kunde_organisation || 'Tipp'}
                      </p>
                      {tipp.kunde_organisation && tipp.kunde_name && (
                        <p className="text-sm text-gray-400">{tipp.kunde_organisation}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        Eingereicht am {new Date(tipp.erstellt_am).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        isSuccess ? 'bg-emerald-100 text-emerald-700' :
                        isLost ? 'bg-red-100 text-red-600' :
                        'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {statusText}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  {!isLost && (
                    <div className="mt-4">
                      <div className="flex gap-1">
                        {Array.from({ length: 7 }).map((_, i) => {
                          const phaseOrder = phasen?.find((p: any) => p.name === tipp.phase)
                          const currentOrder = phasen?.findIndex((p: any) => p.name === tipp.phase) ?? 0
                          const filled = i <= currentOrder
                          return (
                            <div
                              key={i}
                              className={`h-1.5 flex-1 rounded-full ${
                                filled
                                  ? isSuccess ? 'bg-[#10B981]' : 'bg-[#2563EB]'
                                  : 'bg-gray-200'
                              }`}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
            <p className="text-gray-400">Noch keine Tipps eingereicht.</p>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-gray-300">
          IC Süd · Kommunaler Strukturvertrieb
        </p>
      </div>
    </div>
  )
}
