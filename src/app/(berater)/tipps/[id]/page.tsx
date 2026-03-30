'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Tipp, PipelinePhase, Berater, Aktivitaet, Geschaeftsbereich } from '@/lib/supabase/types'

export default function TippDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [tipp, setTipp] = useState<Tipp | null>(null)
  const [phasen, setPhasen] = useState<PipelinePhase[]>([])
  const [berater, setBerater] = useState<Berater[]>([])
  const [bereiche, setBereiche] = useState<Geschaeftsbereich[]>([])
  const [aktivitaeten, setAktivitaeten] = useState<Aktivitaet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [tippRes, phasenRes, beraterRes, bereicheRes, aktRes] = await Promise.all([
        supabase.from('tipps').select('*, tippgeber(id, vorname, nachname, email, telefon, firma), geschaeftsbereich:geschaeftsbereich_id(id, name, farbe)').eq('id', id).single(),
        supabase.from('pipeline_phasen').select('*').order('reihenfolge'),
        supabase.from('berater').select('*').eq('aktiv', true),
        supabase.from('geschaeftsbereiche').select('*').eq('aktiv', true),
        supabase.from('aktivitaeten').select('*').eq('tipp_id', id).order('erstellt_am', { ascending: false }),
      ])
      setTipp(tippRes.data)
      setPhasen(phasenRes.data || [])
      setBerater(beraterRes.data || [])
      setBereiche(bereicheRes.data || [])
      setAktivitaeten(aktRes.data || [])
      setLoading(false)
    }
    load()
  }, [id])

  async function updateTipp(field: string, value: any) {
    if (!tipp) return
    const { data } = await supabase.from('tipps').update({ [field]: value }).eq('id', id).select('*, tippgeber(id, vorname, nachname, email, telefon, firma), geschaeftsbereich:geschaeftsbereich_id(id, name, farbe)').single()
    if (data) setTipp(data)
    // Reload activities for phase changes
    if (field === 'phase') {
      const { data: akt } = await supabase.from('aktivitaeten').select('*').eq('tipp_id', id).order('erstellt_am', { ascending: false })
      setAktivitaeten(akt || [])
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E4002B] border-t-transparent" /></div>
  if (!tipp) return <div className="py-20 text-center text-gray-400">Tipp nicht gefunden</div>

  const currentPhase = phasen.find(p => p.name === tipp.phase)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => router.push('/tipps')} className="mb-2 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-[#1A1A2E]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Zurück zur Pipeline
          </button>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">{tipp.kunde_name || tipp.kunde_organisation || 'Unbekannt'}</h1>
          {tipp.kunde_organisation && tipp.kunde_name && (
            <p className="text-sm text-gray-500">{tipp.kunde_organisation}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: currentPhase?.farbe }} />
          <select
            value={tipp.phase}
            onChange={e => updateTipp('phase', e.target.value)}
            className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium focus:border-[#E4002B] focus:outline-none"
          >
            {phasen.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <h2 className="mb-4 text-base font-bold text-[#1A1A2E]">Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Geschäftsbereich</p>
                <select value={tipp.geschaeftsbereich_id || ''} onChange={e => updateTipp('geschaeftsbereich_id', e.target.value || null)} className="mt-1 w-full rounded border border-[#E5E7EB] px-2 py-1 text-sm focus:outline-none focus:border-[#E4002B]">
                  <option value="">Nicht zugeordnet</option>
                  {bereiche.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <p className="text-gray-400">Zugewiesen an</p>
                <select value={tipp.zugewiesen_an || ''} onChange={e => updateTipp('zugewiesen_an', e.target.value || null)} className="mt-1 w-full rounded border border-[#E5E7EB] px-2 py-1 text-sm focus:outline-none focus:border-[#E4002B]">
                  <option value="">Nicht zugewiesen</option>
                  {berater.map(b => <option key={b.id} value={b.id}>{b.vorname} {b.nachname}</option>)}
                </select>
              </div>
              <div>
                <p className="text-gray-400">Telefon</p>
                <p className="font-medium">{tipp.kunde_telefon || '–'}</p>
              </div>
              <div>
                <p className="text-gray-400">E-Mail</p>
                <p className="font-medium">{tipp.kunde_email || '–'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-400">Bedarf</p>
                <p className="font-medium">{tipp.bedarf || '–'}</p>
              </div>
            </div>
          </div>

          {/* Provision */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <h2 className="mb-4 text-base font-bold text-[#1A1A2E]">Finanzielles</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Geschätzter Wert</p>
                <input type="number" value={tipp.geschaetzter_wert || ''} onChange={e => updateTipp('geschaetzter_wert', e.target.value ? parseFloat(e.target.value) : null)} placeholder="0" className="mt-1 w-full rounded border border-[#E5E7EB] px-2 py-1 text-sm focus:outline-none focus:border-[#E4002B]" />
              </div>
              <div>
                <p className="text-gray-400">Provision</p>
                <input type="number" value={tipp.provision_betrag || ''} onChange={e => updateTipp('provision_betrag', e.target.value ? parseFloat(e.target.value) : null)} placeholder="0" className="mt-1 w-full rounded border border-[#E5E7EB] px-2 py-1 text-sm focus:outline-none focus:border-[#E4002B]" />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Tippgeber + Aktivitäten */}
        <div className="space-y-4">
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <h2 className="mb-3 text-base font-bold text-[#1A1A2E]">Tippgeber</h2>
            {tipp.tippgeber && (
              <div className="text-sm">
                <p className="font-medium">{(tipp.tippgeber as any).vorname} {(tipp.tippgeber as any).nachname}</p>
                <p className="text-gray-400">{(tipp.tippgeber as any).firma}</p>
                {(tipp.tippgeber as any).email && <p className="mt-1 text-gray-500">{(tipp.tippgeber as any).email}</p>}
                {(tipp.tippgeber as any).telefon && <p className="text-gray-500">{(tipp.tippgeber as any).telefon}</p>}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <h2 className="mb-3 text-base font-bold text-[#1A1A2E]">Aktivitäten</h2>
            {aktivitaeten.length > 0 ? (
              <div className="space-y-3">
                {aktivitaeten.map(akt => (
                  <div key={akt.id} className="border-l-2 border-gray-200 pl-3">
                    <p className="text-sm font-medium text-[#1A1A2E]">{akt.titel}</p>
                    {akt.beschreibung && <p className="text-xs text-gray-400 mt-0.5">{akt.beschreibung}</p>}
                    <p className="text-xs text-gray-300 mt-1">{new Date(akt.erstellt_am).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Noch keine Aktivitäten</p>
            )}
          </div>

          <div className="text-xs text-gray-300">
            Erstellt: {new Date(tipp.erstellt_am).toLocaleDateString('de-DE')}
            {tipp.aktualisiert_am !== tipp.erstellt_am && (
              <> · Aktualisiert: {new Date(tipp.aktualisiert_am).toLocaleDateString('de-DE')}</>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
