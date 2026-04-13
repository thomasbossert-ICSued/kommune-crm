'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Kommune, KommunePerson } from '@/lib/supabase/types'

const TYP_LABELS: Record<string, string> = {
  gemeinde: 'Gemeinde',
  stadt: 'Stadt',
  landkreis: 'Landkreis',
  kommunaler_betrieb: 'Komm. Betrieb',
  zweckverband: 'Zweckverband',
  sonstige: 'Sonstige',
}

export default function KommunenPage() {
  const supabase = createClient()
  const router = useRouter()
  const [kommunen, setKommunen] = useState<(Kommune & { personen: KommunePerson[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  async function load() {
    const { data } = await supabase
      .from('kommunen')
      .select('*, personen:kommunen_personen(*)')
      .eq('aktiv', true)
      .order('name')
    setKommunen((data || []) as any)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = kommunen.filter(k =>
    k.name.toLowerCase().includes(search.toLowerCase()) ||
    (k.stadt || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Kommunen</h1>
          <p className="text-sm text-gray-400 mt-0.5">{kommunen.length} Kommunen angelegt</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-[#E4002B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C50024]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Neue Kommune
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Kommune oder Stadt suchen..."
          className="w-full rounded-lg border border-[#E5E7EB] py-2 pl-9 pr-4 text-sm focus:border-[#E4002B] focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
        />
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E4002B] border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5E7EB] py-16 text-center">
          <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          <p className="mt-3 text-sm font-medium text-gray-400">
            {search ? 'Keine Kommunen gefunden' : 'Noch keine Kommunen angelegt'}
          </p>
          {!search && (
            <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-[#E4002B] hover:underline">
              Erste Kommune anlegen →
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(k => {
            const haupt = k.personen?.find(p => p.reihenfolge === 1)
            const weitere = k.personen?.filter(p => p.reihenfolge > 1).sort((a, b) => a.reihenfolge - b.reihenfolge)
            return (
              <button
                key={k.id}
                onClick={() => router.push(`/kommunen/${k.id}`)}
                className="group rounded-xl border border-[#E5E7EB] bg-white p-4 text-left hover:border-[#E4002B] hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#1A1A2E] truncate group-hover:text-[#E4002B]">{k.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {TYP_LABELS[k.typ]}{k.stadt ? ` · ${k.stadt}` : ''}{k.bundesland ? ` · ${k.bundesland}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    {k.personen?.length || 0} {(k.personen?.length || 0) === 1 ? 'Person' : 'Personen'}
                  </span>
                </div>

                {haupt && (
                  <div className="mt-3 border-t border-[#E5E7EB] pt-3">
                    <p className="text-xs font-medium text-[#1A1A2E]">{haupt.vorname} {haupt.nachname}</p>
                    {haupt.position && <p className="text-xs text-gray-400">{haupt.position}</p>}
                    {haupt.telefon && <p className="text-xs text-gray-400 mt-0.5">{haupt.telefon}</p>}
                  </div>
                )}

                {(weitere?.length ?? 0) > 0 && (
                  <div className="mt-2">
                    {weitere!.map(p => (
                      <p key={p.id} className="text-xs text-gray-400">
                        + {p.vorname} {p.nachname}{p.position ? ` (${p.position})` : ''}
                      </p>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <KommuneFormModal
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}

// ─── Formular-Modal ──────────────────────────────────────────────────────────

function KommuneFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', typ: 'gemeinde', adresse: '', stadt: '', plz: '', bundesland: '',
    einwohner: '', mitarbeiter: '', notizen: '',
  })
  const [personen, setPersonen] = useState([
    { reihenfolge: 1, vorname: '', nachname: '', position: '', email: '', telefon: '' },
  ])

  function addPerson() {
    if (personen.length >= 3) return
    setPersonen(p => [...p, { reihenfolge: p.length + 1, vorname: '', nachname: '', position: '', email: '', telefon: '' }])
  }

  function removePerson(idx: number) {
    setPersonen(p => p.filter((_, i) => i !== idx).map((x, i) => ({ ...x, reihenfolge: i + 1 })))
  }

  function updatePerson(idx: number, field: string, value: string) {
    setPersonen(p => p.map((x, i) => i === idx ? { ...x, [field]: value } : x))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return alert('Name der Kommune ist Pflichtfeld')
    if (!personen[0].vorname || !personen[0].nachname) return alert('Hauptansprechpartner (Vor- und Nachname) ist Pflichtfeld')
    setSaving(true)

    const { data: kommune, error } = await supabase
      .from('kommunen')
      .insert({
        name: form.name.trim(),
        typ: form.typ,
        adresse: form.adresse || null,
        stadt: form.stadt || null,
        plz: form.plz || null,
        bundesland: form.bundesland || null,
        einwohner: form.einwohner ? parseInt(form.einwohner) : null,
        mitarbeiter: form.mitarbeiter ? parseInt(form.mitarbeiter) : null,
        notizen: form.notizen || null,
      })
      .select()
      .single()

    if (error || !kommune) {
      alert('Fehler: ' + (error?.message || 'Unbekannt'))
      setSaving(false)
      return
    }

    const validPersonen = personen.filter(p => p.vorname && p.nachname)
    if (validPersonen.length > 0) {
      await supabase.from('kommunen_personen').insert(
        validPersonen.map(p => ({
          kommune_id: kommune.id,
          reihenfolge: p.reihenfolge,
          vorname: p.vorname,
          nachname: p.nachname,
          position: p.position || null,
          email: p.email || null,
          telefon: p.telefon || null,
        }))
      )
    }

    onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl my-4" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1A1A2E]">Neue Kommune anlegen</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Stammdaten */}
          <div>
            <h3 className="text-sm font-semibold text-[#1A1A2E] mb-3">Stammdaten</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Gemeinde Friedberg" required className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none focus:ring-1 focus:ring-[#E4002B]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Typ</label>
                <select value={form.typ} onChange={e => setForm(f => ({ ...f, typ: e.target.value }))} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none">
                  <option value="gemeinde">Gemeinde</option>
                  <option value="stadt">Stadt</option>
                  <option value="landkreis">Landkreis</option>
                  <option value="kommunaler_betrieb">Komm. Betrieb</option>
                  <option value="zweckverband">Zweckverband</option>
                  <option value="sonstige">Sonstige</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Bundesland</label>
                <input value={form.bundesland} onChange={e => setForm(f => ({ ...f, bundesland: e.target.value }))} placeholder="Bayern" className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">PLZ</label>
                <input value={form.plz} onChange={e => setForm(f => ({ ...f, plz: e.target.value }))} placeholder="86316" className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Stadt / Ort</label>
                <input value={form.stadt} onChange={e => setForm(f => ({ ...f, stadt: e.target.value }))} placeholder="Friedberg" className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Einwohner</label>
                <input type="number" value={form.einwohner} onChange={e => setForm(f => ({ ...f, einwohner: e.target.value }))} placeholder="15000" className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Mitarbeiter</label>
                <input type="number" value={form.mitarbeiter} onChange={e => setForm(f => ({ ...f, mitarbeiter: e.target.value }))} placeholder="200" className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Notizen</label>
                <textarea value={form.notizen} onChange={e => setForm(f => ({ ...f, notizen: e.target.value }))} rows={2} placeholder="Besonderheiten, Hintergründe..." className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Personen */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#1A1A2E]">Ansprechpartner</h3>
              {personen.length < 3 && (
                <button type="button" onClick={addPerson} className="flex items-center gap-1 text-xs text-[#E4002B] hover:underline">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Weitere Person
                </button>
              )}
            </div>

            <div className="space-y-4">
              {personen.map((p, idx) => (
                <div key={idx} className="rounded-lg border border-[#E5E7EB] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {idx === 0 ? '★ Hauptansprechpartner' : `Weitere Person ${idx + 1}`}
                    </span>
                    {idx > 0 && (
                      <button type="button" onClick={() => removePerson(idx)} className="text-xs text-gray-400 hover:text-red-500">
                        Entfernen
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Vorname {idx === 0 && '*'}</label>
                      <input value={p.vorname} onChange={e => updatePerson(idx, 'vorname', e.target.value)} placeholder="Max" required={idx === 0} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Nachname {idx === 0 && '*'}</label>
                      <input value={p.nachname} onChange={e => updatePerson(idx, 'nachname', e.target.value)} placeholder="Müller" required={idx === 0} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Position / Funktion</label>
                      <input value={p.position} onChange={e => updatePerson(idx, 'position', e.target.value)} placeholder="z.B. Bürgermeister, Kämmerer, Personalleiter..." className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Telefon</label>
                      <input value={p.telefon} onChange={e => updatePerson(idx, 'telefon', e.target.value)} placeholder="+49 821 ..." className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">E-Mail</label>
                      <input type="email" value={p.email} onChange={e => updatePerson(idx, 'email', e.target.value)} placeholder="max@gemeinde.de" className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-[#E5E7EB]">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Abbrechen</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-[#E4002B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C50024] disabled:opacity-50">
              {saving ? 'Wird gespeichert...' : 'Kommune anlegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
