'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Kommune, KommunePerson, Tipp } from '@/lib/supabase/types'

const TYP_LABELS: Record<string, string> = {
  gemeinde: 'Gemeinde', stadt: 'Stadt', landkreis: 'Landkreis',
  kommunaler_betrieb: 'Komm. Betrieb', zweckverband: 'Zweckverband', sonstige: 'Sonstige',
}

export default function KommuneDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [kommune, setKommune] = useState<Kommune | null>(null)
  const [personen, setPersonen] = useState<KommunePerson[]>([])
  const [tipps, setTipps] = useState<Tipp[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState<Partial<Kommune>>({})
  const [editPersonen, setEditPersonen] = useState<Partial<KommunePerson>[]>([])
  const [saving, setSaving] = useState(false)

  async function load() {
    const [kommRes, tippsRes] = await Promise.all([
      supabase.from('kommunen').select('*, personen:kommunen_personen(*)').eq('id', id).single(),
      supabase.from('tipps').select('*, tippgeber(vorname, nachname), geschaeftsbereich:geschaeftsbereich_id(name, farbe)').eq('kommune_id', id).order('erstellt_am', { ascending: false }),
    ])
    if (kommRes.data) {
      const k = kommRes.data as any
      setKommune(k)
      const sorted = (k.personen || []).sort((a: KommunePerson, b: KommunePerson) => a.reihenfolge - b.reihenfolge)
      setPersonen(sorted)
      setEditData({ name: k.name, typ: k.typ, adresse: k.adresse, stadt: k.stadt, plz: k.plz, bundesland: k.bundesland, einwohner: k.einwohner, mitarbeiter: k.mitarbeiter, notizen: k.notizen })
      setEditPersonen(sorted.map((p: KommunePerson) => ({ ...p })))
    }
    setTipps((tippsRes.data || []) as any)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  function startEdit() {
    setEditMode(true)
    // Ensure at least 1 person slot
    if (editPersonen.length === 0) {
      setEditPersonen([{ reihenfolge: 1, vorname: '', nachname: '', position: '', email: '', telefon: '' }])
    }
  }

  function addEditPerson() {
    if (editPersonen.length >= 3) return
    setEditPersonen(p => [...p, { reihenfolge: p.length + 1, vorname: '', nachname: '', position: '', email: '', telefon: '' }])
  }

  function removeEditPerson(idx: number) {
    setEditPersonen(p => p.filter((_, i) => i !== idx).map((x, i) => ({ ...x, reihenfolge: i + 1 })))
  }

  function updateEditPerson(idx: number, field: string, value: string) {
    setEditPersonen(p => p.map((x, i) => i === idx ? { ...x, [field]: value } : x))
  }

  async function handleSave() {
    if (!editData.name?.trim()) return alert('Name ist Pflichtfeld')
    const haupt = editPersonen[0]
    if (!haupt?.vorname || !haupt?.nachname) return alert('Hauptansprechpartner (Vor- und Nachname) ist Pflichtfeld')
    setSaving(true)

    // Update Kommune
    await supabase.from('kommunen').update({
      name: editData.name,
      typ: editData.typ,
      adresse: editData.adresse || null,
      stadt: editData.stadt || null,
      plz: editData.plz || null,
      bundesland: editData.bundesland || null,
      einwohner: editData.einwohner || null,
      mitarbeiter: editData.mitarbeiter || null,
      notizen: editData.notizen || null,
    }).eq('id', id)

    // Delete all existing persons and re-insert
    await supabase.from('kommunen_personen').delete().eq('kommune_id', id)
    const validPersonen = editPersonen.filter(p => p.vorname && p.nachname)
    if (validPersonen.length > 0) {
      await supabase.from('kommunen_personen').insert(
        validPersonen.map(p => ({
          kommune_id: id,
          reihenfolge: p.reihenfolge,
          vorname: p.vorname,
          nachname: p.nachname,
          position: p.position || null,
          email: p.email || null,
          telefon: p.telefon || null,
        }))
      )
    }

    setSaving(false)
    setEditMode(false)
    load()
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E4002B] border-t-transparent" /></div>
  if (!kommune) return <div className="py-20 text-center text-gray-400">Kommune nicht gefunden</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => router.push('/kommunen')} className="mb-2 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-[#1A1A2E]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Zurück zu Kommunen
          </button>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">{kommune.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {TYP_LABELS[kommune.typ]}{kommune.stadt ? ` · ${kommune.stadt}` : ''}{kommune.bundesland ? ` · ${kommune.bundesland}` : ''}
          </p>
        </div>
        {!editMode ? (
          <button onClick={startEdit} className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Bearbeiten
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => { setEditMode(false); load() }} className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50">Abbrechen</button>
            <button onClick={handleSave} disabled={saving} className="rounded-lg bg-[#E4002B] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#C50024] disabled:opacity-50">
              {saving ? 'Speichert...' : 'Speichern'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Stammdaten + Personen */}
        <div className="lg:col-span-2 space-y-5">
          {/* Stammdaten */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <h2 className="mb-4 text-base font-bold text-[#1A1A2E]">Stammdaten</h2>
            {!editMode ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><dt className="text-gray-400">Name</dt><dd className="font-medium mt-0.5">{kommune.name}</dd></div>
                <div><dt className="text-gray-400">Typ</dt><dd className="font-medium mt-0.5">{TYP_LABELS[kommune.typ]}</dd></div>
                <div><dt className="text-gray-400">PLZ / Ort</dt><dd className="font-medium mt-0.5">{[kommune.plz, kommune.stadt].filter(Boolean).join(' ') || '–'}</dd></div>
                <div><dt className="text-gray-400">Bundesland</dt><dd className="font-medium mt-0.5">{kommune.bundesland || '–'}</dd></div>
                <div><dt className="text-gray-400">Einwohner</dt><dd className="font-medium mt-0.5">{kommune.einwohner?.toLocaleString('de-DE') || '–'}</dd></div>
                <div><dt className="text-gray-400">Mitarbeiter</dt><dd className="font-medium mt-0.5">{kommune.mitarbeiter?.toLocaleString('de-DE') || '–'}</dd></div>
                {kommune.notizen && <div className="col-span-2"><dt className="text-gray-400">Notizen</dt><dd className="font-medium mt-0.5">{kommune.notizen}</dd></div>}
              </dl>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                  <input value={editData.name || ''} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Typ</label>
                  <select value={editData.typ || 'gemeinde'} onChange={e => setEditData(d => ({ ...d, typ: e.target.value as any }))} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none">
                    <option value="gemeinde">Gemeinde</option><option value="stadt">Stadt</option><option value="landkreis">Landkreis</option><option value="kommunaler_betrieb">Komm. Betrieb</option><option value="zweckverband">Zweckverband</option><option value="sonstige">Sonstige</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Bundesland</label>
                  <input value={editData.bundesland || ''} onChange={e => setEditData(d => ({ ...d, bundesland: e.target.value }))} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">PLZ</label>
                  <input value={editData.plz || ''} onChange={e => setEditData(d => ({ ...d, plz: e.target.value }))} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Stadt / Ort</label>
                  <input value={editData.stadt || ''} onChange={e => setEditData(d => ({ ...d, stadt: e.target.value }))} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Einwohner</label>
                  <input type="number" value={editData.einwohner || ''} onChange={e => setEditData(d => ({ ...d, einwohner: e.target.value ? parseInt(e.target.value) : null }))} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Mitarbeiter</label>
                  <input type="number" value={editData.mitarbeiter || ''} onChange={e => setEditData(d => ({ ...d, mitarbeiter: e.target.value ? parseInt(e.target.value) : null }))} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Notizen</label>
                  <textarea value={editData.notizen || ''} onChange={e => setEditData(d => ({ ...d, notizen: e.target.value }))} rows={2} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
                </div>
              </div>
            )}
          </div>

          {/* Ansprechpartner */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#1A1A2E]">Ansprechpartner</h2>
              {editMode && editPersonen.length < 3 && (
                <button type="button" onClick={addEditPerson} className="flex items-center gap-1 text-xs text-[#E4002B] hover:underline">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Weitere Person
                </button>
              )}
            </div>

            {!editMode ? (
              <div className="space-y-4">
                {personen.length === 0 ? (
                  <p className="text-sm text-gray-400">Noch keine Ansprechpartner angelegt</p>
                ) : personen.map((p, idx) => (
                  <div key={p.id} className={idx > 0 ? 'border-t border-[#E5E7EB] pt-4' : ''}>
                    {idx === 0 && (
                      <span className="inline-block mb-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        ★ Hauptansprechpartner
                      </span>
                    )}
                    <p className="font-semibold text-[#1A1A2E]">{p.vorname} {p.nachname}</p>
                    {p.position && <p className="text-sm text-gray-500">{p.position}</p>}
                    <div className="mt-1 flex flex-wrap gap-3 text-sm text-gray-500">
                      {p.telefon && (
                        <a href={`tel:${p.telefon}`} className="flex items-center gap-1 hover:text-[#E4002B]">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                          {p.telefon}
                        </a>
                      )}
                      {p.email && (
                        <a href={`mailto:${p.email}`} className="flex items-center gap-1 hover:text-[#E4002B]">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                          {p.email}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {editPersonen.map((p, idx) => (
                  <div key={idx} className={idx > 0 ? 'border-t border-[#E5E7EB] pt-4' : ''}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {idx === 0 ? '★ Hauptansprechpartner' : `Weitere Person ${idx + 1}`}
                      </span>
                      {idx > 0 && (
                        <button type="button" onClick={() => removeEditPerson(idx)} className="text-xs text-gray-400 hover:text-red-500">Entfernen</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Vorname {idx === 0 && '*'}</label>
                        <input value={p.vorname || ''} onChange={e => updateEditPerson(idx, 'vorname', e.target.value)} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Nachname {idx === 0 && '*'}</label>
                        <input value={p.nachname || ''} onChange={e => updateEditPerson(idx, 'nachname', e.target.value)} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Position / Funktion</label>
                        <input value={p.position || ''} onChange={e => updateEditPerson(idx, 'position', e.target.value)} placeholder="z.B. Bürgermeister, Personalleiter..." className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Telefon</label>
                        <input value={p.telefon || ''} onChange={e => updateEditPerson(idx, 'telefon', e.target.value)} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">E-Mail</label>
                        <input type="email" value={p.email || ''} onChange={e => updateEditPerson(idx, 'email', e.target.value)} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rechte Spalte: Verknüpfte Tipps */}
        <div>
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <h2 className="mb-3 text-base font-bold text-[#1A1A2E]">Tipps ({tipps.length})</h2>
            {tipps.length === 0 ? (
              <p className="text-sm text-gray-400">Noch keine Tipps zu dieser Kommune</p>
            ) : (
              <div className="space-y-3">
                {tipps.map(t => {
                  const gb = (t as any).geschaeftsbereich
                  return (
                    <a key={t.id} href={`/tipps/${t.id}`} className="block rounded-lg border border-[#E5E7EB] p-3 hover:border-[#E4002B] hover:shadow-sm transition-all">
                      <div className="flex items-center gap-2 mb-1">
                        {gb && <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: gb.farbe }} />}
                        <span className="text-xs text-gray-500">{gb?.name || '–'}</span>
                      </div>
                      <p className="text-sm font-medium text-[#1A1A2E]">{t.kunde_name || t.kunde_organisation || 'Ohne Name'}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-400">{t.phase}</span>
                        <span className="text-xs text-gray-300">{new Date(t.erstellt_am).toLocaleDateString('de-DE')}</span>
                      </div>
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
