'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Tippgeber, Tipp } from '@/lib/supabase/types'

export default function TippgeberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [tippgeber, setTippgeber] = useState<Tippgeber | null>(null)
  const [tipps, setTipps] = useState<Tipp[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedToken, setCopiedToken] = useState(false)

  useEffect(() => {
    async function load() {
      const [tgRes, tippsRes] = await Promise.all([
        supabase.from('tippgeber').select('*').eq('id', id).single(),
        supabase.from('tipps').select('*, geschaeftsbereich:geschaeftsbereich_id(name, farbe)').eq('tippgeber_id', id).order('erstellt_am', { ascending: false }),
      ])
      setTippgeber(tgRes.data)
      setTipps(tippsRes.data || [])
      setLoading(false)
    }
    load()
  }, [id])

  function copyTokenLink() {
    if (!tippgeber) return
    navigator.clipboard.writeText(`${window.location.origin}/status/${tippgeber.zugangs_token}`)
    setCopiedToken(true)
    setTimeout(() => setCopiedToken(false), 2000)
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E4002B] border-t-transparent" /></div>
  if (!tippgeber) return <div className="py-20 text-center text-gray-400">Tippgeber nicht gefunden</div>

  return (
    <div className="space-y-6">
      <div>
        <button onClick={() => router.push('/tippgeber')} className="mb-2 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-[#1A1A2E]">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Zurück
        </button>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#1A1A2E]">{tippgeber.vorname} {tippgeber.nachname}</h1>
          <button onClick={copyTokenLink} className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            {copiedToken ? 'Link kopiert!' : 'Status-Link kopieren'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Stammdaten */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
          <h2 className="mb-3 text-base font-bold text-[#1A1A2E]">Stammdaten</h2>
          <div className="space-y-2 text-sm">
            <div><p className="text-gray-400">Firma</p><p className="font-medium">{tippgeber.firma}</p></div>
            <div><p className="text-gray-400">E-Mail</p><p className="font-medium">{tippgeber.email || '–'}</p></div>
            <div><p className="text-gray-400">Telefon</p><p className="font-medium">{tippgeber.telefon || '–'}</p></div>
            <div><p className="text-gray-400">Aktiv seit</p><p className="font-medium">{new Date(tippgeber.erstellt_am).toLocaleDateString('de-DE')}</p></div>
          </div>
        </div>

        {/* Statistiken */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
          <h2 className="mb-3 text-base font-bold text-[#1A1A2E]">Statistiken</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-[#1A1A2E]">{tippgeber.tipps_gesamt}</p>
              <p className="text-xs text-gray-400">Tipps</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[#10B981]">{tippgeber.tipps_erfolgreich}</p>
              <p className="text-xs text-gray-400">Erfolg</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[#7C3AED]">{tippgeber.provision_gesamt.toLocaleString('de-DE')} €</p>
              <p className="text-xs text-gray-400">Provision</p>
            </div>
          </div>
        </div>

        {/* Token Info */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
          <h2 className="mb-3 text-base font-bold text-[#1A1A2E]">Zugangs-Token</h2>
          <div className="rounded-lg bg-gray-50 p-3">
            <code className="break-all text-xs text-gray-500">{tippgeber.zugangs_token}</code>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Token {tippgeber.token_aktiv ? 'aktiv' : 'deaktiviert'} · Erstellt am {new Date(tippgeber.token_erstellt_am).toLocaleDateString('de-DE')}
          </p>
        </div>
      </div>

      {/* Tipps des Tippgebers */}
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
        <h2 className="mb-4 text-base font-bold text-[#1A1A2E]">Tipps ({tipps.length})</h2>
        {tipps.length > 0 ? (
          <div className="space-y-2">
            {tipps.map(tipp => (
              <a key={tipp.id} href={`/tipps/${tipp.id}`} className="flex items-center justify-between rounded-lg border border-[#E5E7EB] px-4 py-3 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-[#1A1A2E]">{tipp.kunde_name || tipp.kunde_organisation || 'Unbekannt'}</p>
                  <p className="text-xs text-gray-400">{new Date(tipp.erstellt_am).toLocaleDateString('de-DE')}</p>
                </div>
                <div className="flex items-center gap-2">
                  {(tipp as any).geschaeftsbereich && (
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: (tipp as any).geschaeftsbereich.farbe }}>
                      {(tipp as any).geschaeftsbereich.name === 'Kommunales Bausparen' ? 'BS' : 'bKV'}
                    </span>
                  )}
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{tipp.phase}</span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">Noch keine Tipps von diesem Tippgeber</p>
        )}
      </div>
    </div>
  )
}
