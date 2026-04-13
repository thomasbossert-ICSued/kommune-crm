'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Tipp, PipelinePhase, Berater, Aktivitaet, Geschaeftsbereich, Kommune, KommunePerson } from '@/lib/supabase/types'

function formatDatum(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString('de-DE', opts || { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'gerade eben'
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`
  return formatDatum(iso)
}

export default function TippDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [tipp, setTipp] = useState<Tipp | null>(null)
  const [phasen, setPhasen] = useState<PipelinePhase[]>([])
  const [berater, setBerater] = useState<Berater[]>([])
  const [bereiche, setBereiche] = useState<Geschaeftsbereich[]>([])
  const [aktivitaeten, setAktivitaeten] = useState<(Aktivitaet & { berater?: Berater })[]>([])
  const [kommune, setKommune] = useState<(Kommune & { personen: KommunePerson[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentBerater, setCurrentBerater] = useState<Berater | null>(null)

  // Notiz-Chat
  const [neueNotiz, setNeueNotiz] = useState('')
  const [sendingNotiz, setSendingNotiz] = useState(false)
  const notizRef = useRef<HTMLTextAreaElement>(null)

  // Termin bearbeiten
  const [editTermin, setEditTermin] = useState(false)
  const [terminForm, setTerminForm] = useState({ naechster_termin_am: '', termin_notiz: '', wiedervorlage_am: '' })

  async function load() {
    // Aktuellen Berater holen
    const { data: { user } } = await supabase.auth.getUser()

    const [tippRes, phasenRes, beraterRes, bereicheRes, aktRes] = await Promise.all([
      supabase.from('tipps').select('*, tippgeber(id, vorname, nachname, email, telefon, firma), geschaeftsbereich:geschaeftsbereich_id(id, name, farbe)').eq('id', id).single(),
      supabase.from('pipeline_phasen').select('*').order('reihenfolge'),
      supabase.from('berater').select('*').eq('aktiv', true),
      supabase.from('geschaeftsbereiche').select('*').eq('aktiv', true),
      supabase.from('aktivitaeten').select('*').eq('tipp_id', id).order('erstellt_am', { ascending: true }),
    ])
    const tippData = tippRes.data
    const allBerater = beraterRes.data || []
    setTipp(tippData)
    setPhasen(phasenRes.data || [])
    setBerater(allBerater)
    setBereiche(bereicheRes.data || [])

    // Aktivitäten mit Berater-Infos anreichern
    const akts = aktRes.data || []
    const enriched = akts.map((a: Aktivitaet) => ({
      ...a,
      berater: allBerater.find(b => b.id === a.erstellt_von),
    }))
    setAktivitaeten(enriched)

    const me = allBerater.find(b => b.id === user?.id) || null
    setCurrentBerater(me)

    // Termin-Formular befüllen
    if (tippData) {
      setTerminForm({
        naechster_termin_am: tippData.naechster_termin_am ? tippData.naechster_termin_am.slice(0, 16) : '',
        termin_notiz: tippData.termin_notiz || '',
        wiedervorlage_am: tippData.wiedervorlage_am || '',
      })
    }

    // Verlinkte Kommune laden
    if (tippData?.kommune_id) {
      const { data: k } = await supabase
        .from('kommunen')
        .select('*, personen:kommunen_personen(*)')
        .eq('id', tippData.kommune_id)
        .single()
      if (k) setKommune(k as any)
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function updateTipp(field: string, value: any) {
    if (!tipp) return
    const { data } = await supabase.from('tipps').update({ [field]: value }).eq('id', id)
      .select('*, tippgeber(id, vorname, nachname, email, telefon, firma), geschaeftsbereich:geschaeftsbereich_id(id, name, farbe)').single()
    if (data) setTipp(data)
    if (field === 'phase') {
      // Aktivitäten neu laden
      const { data: akt } = await supabase.from('aktivitaeten').select('*').eq('tipp_id', id).order('erstellt_am', { ascending: true })
      setAktivitaeten((akt || []).map((a: Aktivitaet) => ({ ...a, berater: berater.find(b => b.id === a.erstellt_von) })))
    }
  }

  async function saveTermin() {
    await supabase.from('tipps').update({
      naechster_termin_am: terminForm.naechster_termin_am || null,
      termin_notiz: terminForm.termin_notiz || null,
      wiedervorlage_am: terminForm.wiedervorlage_am || null,
    }).eq('id', id)

    // Termin als Aktivität loggen wenn neu gesetzt
    if (terminForm.naechster_termin_am && terminForm.naechster_termin_am !== (tipp?.naechster_termin_am || '').slice(0, 16)) {
      await supabase.from('aktivitaeten').insert({
        typ: 'meeting',
        titel: 'Termin' + (terminForm.termin_notiz ? `: ${terminForm.termin_notiz}` : ''),
        beschreibung: `Geplant für ${formatDateTime(terminForm.naechster_termin_am)}`,
        tipp_id: id,
        faellig_am: terminForm.naechster_termin_am,
        erstellt_von: currentBerater?.id || null,
        tippgeber_sichtbar: false,
      })
    }

    setEditTermin(false)
    load()
  }

  async function sendeNotiz() {
    if (!neueNotiz.trim()) return
    setSendingNotiz(true)
    const { data: newAkt } = await supabase.from('aktivitaeten').insert({
      typ: 'notiz',
      titel: neueNotiz.trim(),
      beschreibung: null,
      tipp_id: id,
      erstellt_von: currentBerater?.id || null,
      tippgeber_sichtbar: false,
    }).select().single()

    if (newAkt) {
      setAktivitaeten(prev => [...prev, { ...newAkt, berater: currentBerater || undefined }])
    }
    setNeueNotiz('')
    setSendingNotiz(false)
    setTimeout(() => notizRef.current?.focus(), 100)
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E4002B] border-t-transparent" /></div>
  if (!tipp) return <div className="py-20 text-center text-gray-400">Tipp nicht gefunden</div>

  const currentPhase = phasen.find(p => p.name === tipp.phase)
  const kommuneName = kommune?.name || tipp.kunde_organisation || tipp.kunde_name || 'Unbekannt'
  const sortedPersonen = (kommune?.personen || []).sort((a, b) => a.reihenfolge - b.reihenfolge)
  const notizen = aktivitaeten.filter(a => a.typ === 'notiz')
  const statusAktivitaeten = aktivitaeten.filter(a => a.typ === 'status_aenderung')
  const termine = aktivitaeten.filter(a => a.typ === 'meeting')

  const istWiedervorlageHeute = tipp.wiedervorlage_am && tipp.wiedervorlage_am <= new Date().toISOString().slice(0, 10)
  const istTerminBald = tipp.naechster_termin_am && new Date(tipp.naechster_termin_am) <= new Date(Date.now() + 3 * 86400000)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <button onClick={() => router.push('/tipps')} className="mb-2 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-[#1A1A2E]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Zurück zur Pipeline
          </button>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">{kommuneName}</h1>
          {kommune && (
            <a href={`/kommunen/${kommune.id}`} className="text-xs text-[#E4002B] hover:underline mt-0.5 inline-block">→ Kommunen-Akte öffnen</a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: currentPhase?.farbe }} />
          <select value={tipp.phase} onChange={e => updateTipp('phase', e.target.value)}
            className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium focus:border-[#E4002B] focus:outline-none">
            {phasen.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {/* Alerts: Wiedervorlage + Termin */}
      {(istWiedervorlageHeute || istTerminBald) && (
        <div className="space-y-2">
          {istWiedervorlageHeute && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span><strong>Wiedervorlage heute:</strong> {formatDatum(tipp.wiedervorlage_am!)}</span>
            </div>
          )}
          {istTerminBald && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm text-blue-800">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span><strong>Bevorstehender Termin:</strong> {formatDateTime(tipp.naechster_termin_am!)}{tipp.termin_notiz ? ` – ${tipp.termin_notiz}` : ''}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Linke Hauptspalte */}
        <div className="lg:col-span-2 space-y-5">

          {/* Ansprechpartner */}
          {sortedPersonen.length > 0 && (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-[#1A1A2E]">Ansprechpartner in {kommune?.name}</h2>
                <a href={`/kommunen/${kommune?.id}`} className="text-xs text-gray-400 hover:text-[#E4002B]">Akte →</a>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {sortedPersonen.map((p, idx) => (
                  <div key={p.id} className="rounded-lg bg-gray-50 p-3">
                    {idx === 0 && <span className="inline-block mb-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">★ Hauptansprechpartner</span>}
                    <p className="font-semibold text-sm text-[#1A1A2E]">{p.vorname} {p.nachname}</p>
                    {p.position && <p className="text-xs text-gray-500">{p.position}</p>}
                    <div className="mt-1.5 space-y-0.5">
                      {p.telefon && <a href={`tel:${p.telefon}`} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#E4002B]">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        {p.telefon}
                      </a>}
                      {p.email && <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#E4002B]">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        {p.email}
                      </a>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Termin & Wiedervorlage */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#1A1A2E]">Termin & Wiedervorlage</h2>
              {!editTermin && (
                <button onClick={() => setEditTermin(true)} className="text-xs text-gray-400 hover:text-[#E4002B]">
                  {tipp.naechster_termin_am || tipp.wiedervorlage_am ? 'Bearbeiten' : '+ Hinzufügen'}
                </button>
              )}
            </div>
            {!editTermin ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Nächster Termin</p>
                  {tipp.naechster_termin_am ? (
                    <div>
                      <p className="font-medium text-[#1A1A2E]">{formatDateTime(tipp.naechster_termin_am)}</p>
                      {tipp.termin_notiz && <p className="text-xs text-gray-500 mt-0.5">{tipp.termin_notiz}</p>}
                    </div>
                  ) : <p className="text-gray-300 italic text-xs">Kein Termin</p>}
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Wiedervorlage</p>
                  {tipp.wiedervorlage_am
                    ? <p className="font-medium text-[#1A1A2E]">{formatDatum(tipp.wiedervorlage_am)}</p>
                    : <p className="text-gray-300 italic text-xs">Keine Wiedervorlage</p>}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Termin (Datum & Uhrzeit)</label>
                    <input type="datetime-local" value={terminForm.naechster_termin_am} onChange={e => setTerminForm(f => ({ ...f, naechster_termin_am: e.target.value }))} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Wiedervorlage</label>
                    <input type="date" value={terminForm.wiedervorlage_am} onChange={e => setTerminForm(f => ({ ...f, wiedervorlage_am: e.target.value }))} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Termin-Notiz</label>
                  <input value={terminForm.termin_notiz} onChange={e => setTerminForm(f => ({ ...f, termin_notiz: e.target.value }))} placeholder="z.B. Erstgespräch mit Bürgermeister" className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none" />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditTermin(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 rounded-lg">Abbrechen</button>
                  <button onClick={saveTermin} className="px-3 py-1.5 text-sm font-medium bg-[#E4002B] text-white rounded-lg hover:bg-[#C50024]">Speichern</button>
                </div>
              </div>
            )}
          </div>

          {/* Notizen-Chat */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <h2 className="mb-4 text-base font-bold text-[#1A1A2E]">Notizen</h2>
            <div className="space-y-3 mb-4 max-h-72 overflow-y-auto">
              {notizen.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Noch keine Notizen – schreib die erste!</p>
              ) : notizen.map(n => {
                const isMe = n.berater?.id === currentBerater?.id
                return (
                  <div key={n.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <div className="flex-shrink-0 h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                      {n.berater ? `${n.berater.vorname[0]}${n.berater.nachname[0]}` : '?'}
                    </div>
                    <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className={`rounded-xl px-3 py-2 text-sm ${isMe ? 'bg-[#E4002B] text-white rounded-tr-sm' : 'bg-gray-100 text-[#1A1A2E] rounded-tl-sm'}`}>
                        {n.titel}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 px-1">
                        {n.berater ? `${n.berater.vorname} ${n.berater.nachname}` : 'Unbekannt'} · {relativeTime(n.erstellt_am)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Eingabe */}
            <div className="flex gap-2 items-end">
              <textarea
                ref={notizRef}
                value={neueNotiz}
                onChange={e => setNeueNotiz(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendeNotiz() } }}
                rows={2}
                placeholder="Notiz schreiben... (Enter zum Senden)"
                className="flex-1 resize-none rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
              />
              <button onClick={sendeNotiz} disabled={sendingNotiz || !neueNotiz.trim()}
                className="rounded-xl bg-[#E4002B] p-2.5 text-white hover:bg-[#C50024] disabled:opacity-40">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </div>
          </div>

          {/* Details */}
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
              {!kommune && (
                <>
                  <div><p className="text-gray-400">Ansprechpartner</p><p className="font-medium">{tipp.kunde_name || '–'}</p></div>
                  <div><p className="text-gray-400">Organisation</p><p className="font-medium">{tipp.kunde_organisation || '–'}</p></div>
                </>
              )}
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

        {/* Rechte Spalte */}
        <div className="space-y-4">
          {/* Tippgeber */}
          {tipp.tippgeber && (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
              <h2 className="mb-3 text-base font-bold text-[#1A1A2E]">Tippgeber</h2>
              <div className="text-sm">
                <p className="font-medium">{(tipp.tippgeber as any).vorname} {(tipp.tippgeber as any).nachname}</p>
                <p className="text-gray-400">{(tipp.tippgeber as any).firma}</p>
                {(tipp.tippgeber as any).email && <p className="mt-1 text-gray-500">{(tipp.tippgeber as any).email}</p>}
                {(tipp.tippgeber as any).telefon && <p className="text-gray-500">{(tipp.tippgeber as any).telefon}</p>}
              </div>
            </div>
          )}

          {/* Status-Verlauf */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <h2 className="mb-3 text-base font-bold text-[#1A1A2E]">Verlauf</h2>
            {statusAktivitaeten.length === 0 && termine.length === 0 ? (
              <p className="text-sm text-gray-400">Noch kein Verlauf</p>
            ) : (
              <div className="space-y-3">
                {[...statusAktivitaeten, ...termine].sort((a, b) => new Date(b.erstellt_am).getTime() - new Date(a.erstellt_am).getTime()).map(akt => (
                  <div key={akt.id} className="border-l-2 border-gray-200 pl-3">
                    <div className="flex items-center gap-1.5">
                      {akt.typ === 'meeting' && <svg className="h-3 w-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                      <p className="text-sm font-medium text-[#1A1A2E]">{akt.titel}</p>
                    </div>
                    {akt.beschreibung && <p className="text-xs text-gray-400 mt-0.5">{akt.beschreibung}</p>}
                    <p className="text-xs text-gray-300 mt-1">{formatDateTime(akt.erstellt_am)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-xs text-gray-300">
            Erstellt: {formatDatum(tipp.erstellt_am)}
            {tipp.aktualisiert_am !== tipp.erstellt_am && <> · Aktualisiert: {formatDatum(tipp.aktualisiert_am)}</>}
          </div>
        </div>
      </div>
    </div>
  )
}
