'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import type { Berater, Geschaeftsbereich } from '@/lib/supabase/types'

interface Props {
  berater: Berater[]
  bereiche: Geschaeftsbereich[]
  onClose: () => void
  onCreated: () => void
}

export function NeuenTippErfassen({ berater, bereiche, onClose, onCreated }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    tippgeber_id: '',
    tippgeber_search: '',
    kunde_name: '',
    kunde_organisation: '',
    kunde_telefon: '',
    kunde_email: '',
    bedarf: '',
    geschaeftsbereich_id: '',
    zugewiesen_an: '',
  })
  const [tippgeberResults, setTippgeberResults] = useState<any[]>([])

  async function searchTippgeber(query: string) {
    setForm(f => ({ ...f, tippgeber_search: query, tippgeber_id: '' }))
    if (query.length < 2) { setTippgeberResults([]); return }
    const { data } = await supabase
      .from('tippgeber')
      .select('id, vorname, nachname, firma')
      .or(`vorname.ilike.%${query}%,nachname.ilike.%${query}%`)
      .eq('aktiv', true)
      .limit(5)
    setTippgeberResults(data || [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.tippgeber_id) return alert('Bitte Tippgeber auswählen')
    setSaving(true)

    const { error } = await supabase.from('tipps').insert({
      tippgeber_id: form.tippgeber_id,
      kunde_name: form.kunde_name || null,
      kunde_organisation: form.kunde_organisation || null,
      kunde_telefon: form.kunde_telefon || null,
      kunde_email: form.kunde_email || null,
      bedarf: form.bedarf || null,
      geschaeftsbereich_id: form.geschaeftsbereich_id || null,
      zugewiesen_an: form.zugewiesen_an || null,
      phase: form.zugewiesen_an ? 'Zugewiesen' : 'Neuer Tipp',
    })

    if (error) {
      alert('Fehler: ' + error.message)
      setSaving(false)
      return
    }

    // Tippgeber-Statistik aktualisieren
    try {
      await supabase.rpc('increment_tipps_gesamt', { tg_id: form.tippgeber_id })
    } catch {
      // RPC might not exist yet
    }

    onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1A1A2E]">Neuen Tipp erfassen</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tippgeber Search */}
          <div>
            <label className="block text-sm font-medium text-[#1A1A2E] mb-1.5">Tippgeber *</label>
            <input
              value={form.tippgeber_search}
              onChange={(e) => searchTippgeber(e.target.value)}
              placeholder="Name eingeben..."
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
            />
            {tippgeberResults.length > 0 && !form.tippgeber_id && (
              <div className="mt-1 rounded-lg border border-[#E5E7EB] bg-white shadow-lg">
                {tippgeberResults.map(tg => (
                  <button
                    key={tg.id}
                    type="button"
                    onClick={() => {
                      setForm(f => ({ ...f, tippgeber_id: tg.id, tippgeber_search: `${tg.vorname} ${tg.nachname}` }))
                      setTippgeberResults([])
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {tg.vorname} {tg.nachname} <span className="text-gray-400">· {tg.firma}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#1A1A2E] mb-1.5">Kunde / Ansprechpartner</label>
              <input value={form.kunde_name} onChange={e => setForm(f => ({ ...f, kunde_name: e.target.value }))} placeholder="Max Müller" className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none focus:ring-1 focus:ring-[#E4002B]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1A1A2E] mb-1.5">Organisation</label>
              <input value={form.kunde_organisation} onChange={e => setForm(f => ({ ...f, kunde_organisation: e.target.value }))} placeholder="Gemeinde Friedberg" className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none focus:ring-1 focus:ring-[#E4002B]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#1A1A2E] mb-1.5">Telefon</label>
              <input value={form.kunde_telefon} onChange={e => setForm(f => ({ ...f, kunde_telefon: e.target.value }))} placeholder="+49..." className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none focus:ring-1 focus:ring-[#E4002B]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1A1A2E] mb-1.5">E-Mail</label>
              <input value={form.kunde_email} onChange={e => setForm(f => ({ ...f, kunde_email: e.target.value }))} type="email" placeholder="max@gemeinde.de" className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none focus:ring-1 focus:ring-[#E4002B]" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1A1A2E] mb-1.5">Bedarf / Notizen</label>
            <textarea value={form.bedarf} onChange={e => setForm(f => ({ ...f, bedarf: e.target.value }))} rows={2} placeholder="Was ist der konkrete Bedarf?" className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none focus:ring-1 focus:ring-[#E4002B]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#1A1A2E] mb-1.5">Geschäftsbereich</label>
              <select value={form.geschaeftsbereich_id} onChange={e => setForm(f => ({ ...f, geschaeftsbereich_id: e.target.value }))} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none focus:ring-1 focus:ring-[#E4002B]">
                <option value="">Auswählen...</option>
                {bereiche.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1A1A2E] mb-1.5">Zuweisen an</label>
              <select value={form.zugewiesen_an} onChange={e => setForm(f => ({ ...f, zugewiesen_an: e.target.value }))} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none focus:ring-1 focus:ring-[#E4002B]">
                <option value="">Später zuweisen</option>
                {berater.map(b => <option key={b.id} value={b.id}>{b.vorname} {b.nachname} ({b.funktion})</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Abbrechen</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-[#E4002B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C50024] disabled:opacity-50">
              {saving ? 'Wird gespeichert...' : 'Tipp erfassen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
