'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import type { Berater, Geschaeftsbereich, Kommune, KommunePerson } from '@/lib/supabase/types'

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
    kommune_id: '',
    kommune_search: '',
    tippgeber_id: '',
    tippgeber_search: '',
    bedarf: '',
    geschaeftsbereich_id: '',
    zugewiesen_an: '',
    naechster_termin_am: '',
    termin_notiz: '',
    wiedervorlage_am: '',
  })
  const [tippgeberResults, setTippgeberResults] = useState<any[]>([])
  const [kommuneResults, setKommuneResults] = useState<(Kommune & { personen: KommunePerson[] })[]>([])
  const [selectedKommune, setSelectedKommune] = useState<(Kommune & { personen: KommunePerson[] }) | null>(null)

  async function searchKommune(query: string) {
    setForm(f => ({ ...f, kommune_search: query, kommune_id: '' }))
    setSelectedKommune(null)
    if (query.length < 2) { setKommuneResults([]); return }
    const { data } = await supabase
      .from('kommunen')
      .select('*, personen:kommunen_personen(*)')
      .ilike('name', `%${query}%`)
      .eq('aktiv', true)
      .limit(6)
    setKommuneResults((data || []) as any)
  }

  function selectKommune(k: Kommune & { personen: KommunePerson[] }) {
    setSelectedKommune(k)
    setForm(f => ({ ...f, kommune_id: k.id, kommune_search: k.name }))
    setKommuneResults([])
  }

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
    if (!form.kommune_id && !form.kommune_search.trim() && !form.bedarf.trim()) {
      return alert('Bitte mindestens eine Kommune oder einen Bedarf angeben')
    }
    setSaving(true)

    const { data: tipp, error } = await supabase.from('tipps').insert({
      tippgeber_id: form.tippgeber_id || null,
      kommune_id: form.kommune_id || null,
      kunde_organisation: !form.kommune_id && form.kommune_search ? form.kommune_search : null,
      bedarf: form.bedarf || null,
      geschaeftsbereich_id: form.geschaeftsbereich_id || null,
      zugewiesen_an: form.zugewiesen_an || null,
      phase: form.zugewiesen_an ? 'Zugewiesen' : 'Neuer Tipp',
      naechster_termin_am: form.naechster_termin_am || null,
      termin_notiz: form.termin_notiz || null,
      wiedervorlage_am: form.wiedervorlage_am || null,
    }).select().single()

    if (error || !tipp) {
      alert('Fehler: ' + (error?.message || 'Unbekannt'))
      setSaving(false)
      return
    }

    // Termin als Aktivität loggen
    if (form.naechster_termin_am) {
      await supabase.from('aktivitaeten').insert({
        typ: 'meeting',
        titel: 'Termin' + (form.termin_notiz ? `: ${form.termin_notiz}` : ''),
        beschreibung: form.termin_notiz || null,
        tipp_id: tipp.id,
        faellig_am: form.naechster_termin_am,
        tippgeber_sichtbar: false,
      })
    }

    if (form.tippgeber_id) {
      try { await supabase.rpc('increment_tipps_gesamt', { tg_id: form.tippgeber_id }) } catch { /* optional */ }
    }

    onCreated()
  }

  const hauptAnsprechpartner = selectedKommune?.personen?.find(p => p.reihenfolge === 1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl my-4" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1A1A2E]">Neuen Tipp erfassen</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* 1. Kommune */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-[#1A1A2E]">Kommune / Organisation *</label>
              <a href="/kommunen" target="_blank" className="text-xs text-[#E4002B] hover:underline">+ Neue anlegen</a>
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                value={form.kommune_search}
                onChange={e => searchKommune(e.target.value)}
                placeholder="Gemeinde oder Stadt suchen..."
                className="w-full rounded-lg border border-[#E5E7EB] py-2 pl-9 pr-3 text-sm focus:border-[#E4002B] focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
              />
            </div>
            {kommuneResults.length > 0 && !form.kommune_id && (
              <div className="mt-1 rounded-lg border border-[#E5E7EB] bg-white shadow-lg z-10 relative">
                {kommuneResults.map(k => {
                  const haupt = k.personen?.find(p => p.reihenfolge === 1)
                  return (
                    <button key={k.id} type="button" onClick={() => selectKommune(k)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
                      <span className="font-medium">{k.name}</span>
                      {haupt && <span className="text-gray-400 text-xs"> · {haupt.vorname} {haupt.nachname}{haupt.position ? ` (${haupt.position})` : ''}</span>}
                    </button>
                  )
                })}
              </div>
            )}
            {selectedKommune && (
              <div className="mt-2 rounded-lg bg-green-50 border border-green-200 p-3 text-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-green-900">{selectedKommune.name}</p>
                    {hauptAnsprechpartner && (
                      <p className="text-green-700 text-xs mt-0.5">
                        {hauptAnsprechpartner.vorname} {hauptAnsprechpartner.nachname}
                        {hauptAnsprechpartner.position && ` · ${hauptAnsprechpartner.position}`}
                        {hauptAnsprechpartner.telefon && ` · ${hauptAnsprechpartner.telefon}`}
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={() => { setSelectedKommune(null); setForm(f => ({ ...f, kommune_id: '', kommune_search: '' })) }}
                    className="text-green-400 hover:text-green-600 ml-2 mt-0.5">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. Tippgeber (optional) */}
          <div>
            <label className="block text-sm font-medium text-[#1A1A2E] mb-1.5">
              Tippgeber <span className="text-xs font-normal text-gray-400">(optional)</span>
            </label>
            <input
              value={form.tippgeber_search}
              onChange={e => searchTippgeber(e.target.value)}
              placeholder="Name eingeben..."
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
            />
            {tippgeberResults.length > 0 && !form.tippgeber_id && (
              <div className="mt-1 rounded-lg border border-[#E5E7EB] bg-white shadow-lg">
                {tippgeberResults.map(tg => (
                  <button key={tg.id} type="button"
                    onClick={() => { setForm(f => ({ ...f, tippgeber_id: tg.id, tippgeber_search: `${tg.vorname} ${tg.nachname}` })); setTippgeberResults([]) }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50">
                    {tg.vorname} {tg.nachname} <span className="text-gray-400">· {tg.firma}</span>
                  </button>
                ))}
              </div>
            )}
            {form.tippgeber_id && (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-gray-500">✓ {form.tippgeber_search}</span>
                <button type="button" onClick={() => setForm(f => ({ ...f, tippgeber_id: '', tippgeber_search: '' }))} className="text-xs text-gray-400 hover:text-red-500">× entfernen</button>
              </div>
            )}
          </div>

          {/* 3. Bedarf */}
          <div>
            <label className="block text-sm font-medium text-[#1A1A2E] mb-1.5">Bedarf / Notizen</label>
            <textarea value={form.bedarf} onChange={e => setForm(f => ({ ...f, bedarf: e.target.value }))} rows={2} placeholder="Was ist der konkrete Bedarf?" className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none focus:ring-1 focus:ring-[#E4002B]" />
          </div>

          {/* 4. Geschäftsbereich + Zuweisen */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#1A1A2E] mb-1.5">Geschäftsbereich</label>
              <select value={form.geschaeftsbereich_id} onChange={e => setForm(f => ({ ...f, geschaeftsbereich_id: e.target.value }))} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none">
                <option value="">Auswählen...</option>
                {bereiche.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1A1A2E] mb-1.5">Zuweisen an</label>
              <select value={form.zugewiesen_an} onChange={e => setForm(f => ({ ...f, zugewiesen_an: e.target.value }))} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none">
                <option value="">Später zuweisen</option>
                {berater.map(b => <option key={b.id} value={b.id}>{b.vorname} {b.nachname}</option>)}
              </select>
            </div>
          </div>

          {/* 5. Termin */}
          <div className="rounded-lg border border-[#E5E7EB] bg-gray-50 p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Termin
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Datum &amp; Uhrzeit</label>
                <input
                  type="datetime-local"
                  value={form.naechster_termin_am}
                  onChange={e => setForm(f => ({ ...f, naechster_termin_am: e.target.value }))}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Wiedervorlage</label>
                <input
                  type="date"
                  value={form.wiedervorlage_am}
                  onChange={e => setForm(f => ({ ...f, wiedervorlage_am: e.target.value }))}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Termin-Notiz</label>
              <input
                value={form.termin_notiz}
                onChange={e => setForm(f => ({ ...f, termin_notiz: e.target.value }))}
                placeholder="z.B. Erstgespräch mit Bürgermeister"
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
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
