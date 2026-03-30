'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useCallback } from 'react'
import type { Tipp, PipelinePhase, Berater, Geschaeftsbereich } from '@/lib/supabase/types'
import { TippBoard } from '@/components/crm/tipp-board'
import { NeuenTippErfassen } from '@/components/crm/neuen-tipp-erfassen'

export default function TippsPage() {
  const [tipps, setTipps] = useState<Tipp[]>([])
  const [phasen, setPhasen] = useState<PipelinePhase[]>([])
  const [berater, setBerater] = useState<Berater[]>([])
  const [bereiche, setBereiche] = useState<Geschaeftsbereich[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const supabase = createClient()

  const loadData = useCallback(async () => {
    const [tippsRes, phasenRes, beraterRes, bereicheRes] = await Promise.all([
      supabase.from('tipps').select('*, tippgeber(id, vorname, nachname), geschaeftsbereich:geschaeftsbereich_id(id, name, farbe)').order('erstellt_am', { ascending: false }),
      supabase.from('pipeline_phasen').select('*').order('reihenfolge'),
      supabase.from('berater').select('*').eq('aktiv', true),
      supabase.from('geschaeftsbereiche').select('*').eq('aktiv', true),
    ])
    setTipps(tippsRes.data || [])
    setPhasen(phasenRes.data || [])
    setBerater(beraterRes.data || [])
    setBereiche(bereicheRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handlePhaseChange(tippId: string, neuePhase: string) {
    await supabase.from('tipps').update({ phase: neuePhase }).eq('id', tippId)
    setTipps(prev => prev.map(t => t.id === tippId ? { ...t, phase: neuePhase } : t))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E4002B] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Pipeline</h1>
          <p className="text-sm text-gray-500">{tipps.length} Tipps in der Pipeline</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#E4002B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C50024] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Neuer Tipp
        </button>
      </div>

      <TippBoard
        tipps={tipps}
        phasen={phasen}
        onPhaseChange={handlePhaseChange}
      />

      {showNew && (
        <NeuenTippErfassen
          berater={berater}
          bereiche={bereiche}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); loadData() }}
        />
      )}
    </div>
  )
}
