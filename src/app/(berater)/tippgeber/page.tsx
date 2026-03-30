'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { Tippgeber } from '@/lib/supabase/types'

export default function TippgeberPage() {
  const supabase = createClient()
  const [tippgeber, setTippgeber] = useState<Tippgeber[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ vorname: '', nachname: '', email: '', telefon: '', firma: 'Swiss Life Select' })
  const [saving, setSaving] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  useEffect(() => {
    loadTippgeber()
  }, [])

  async function loadTippgeber() {
    const { data } = await supabase
      .from('tippgeber')
      .select('*')
      .order('erstellt_am', { ascending: false })
    setTippgeber(data || [])
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('tippgeber').insert({
      vorname: form.vorname,
      nachname: form.nachname,
      email: form.email || null,
      telefon: form.telefon || null,
      firma: form.firma,
    })
    if (error) { alert('Fehler: ' + error.message); setSaving(false); return }
    setShowNew(false)
    setForm({ vorname: '', nachname: '', email: '', telefon: '', firma: 'Swiss Life Select' })
    setSaving(false)
    loadTippgeber()
  }

  function copyTokenLink(token: string) {
    const url = `${window.location.origin}/status/${token}`
    navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E4002B] border-t-transparent" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Tippgeber</h1>
          <p className="text-sm text-gray-500">{tippgeber.length} Tippgeber registriert</p>
        </div>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#E4002B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C50024] transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Neuer Tippgeber
        </button>
      </div>

      {/* Tippgeber Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tippgeber.map(tg => (
          <div key={tg.id} className="rounded-xl border border-[#E5E7EB] bg-white p-5 hover:border-gray-300 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-[#1A1A2E]">{tg.vorname} {tg.nachname}</p>
                <p className="text-sm text-gray-400">{tg.firma}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                {tg.vorname[0]}{tg.nachname[0]}
              </div>
            </div>
            <div className="mt-3 flex gap-4 text-sm">
              <div>
                <p className="text-gray-400">Tipps</p>
                <p className="font-semibold">{tg.tipps_gesamt}</p>
              </div>
              <div>
                <p className="text-gray-400">Erfolgreich</p>
                <p className="font-semibold text-[#10B981]">{tg.tipps_erfolgreich}</p>
              </div>
              <div>
                <p className="text-gray-400">Provision</p>
                <p className="font-semibold">{tg.provision_gesamt.toLocaleString('de-DE')} €</p>
              </div>
            </div>
            {(tg.email || tg.telefon) && (
              <div className="mt-3 space-y-0.5 text-xs text-gray-400">
                {tg.email && <p>{tg.email}</p>}
                {tg.telefon && <p>{tg.telefon}</p>}
              </div>
            )}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => copyTokenLink(tg.zugangs_token)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                {copiedToken === tg.zugangs_token ? 'Kopiert!' : 'Status-Link'}
              </button>
              <a href={`/tippgeber/${tg.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Details
              </a>
            </div>
          </div>
        ))}
      </div>

      {tippgeber.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <p className="text-gray-400">Noch keine Tippgeber angelegt</p>
          <button onClick={() => setShowNew(true)} className="mt-2 text-sm font-medium text-[#E4002B] hover:underline">Jetzt anlegen</button>
        </div>
      )}

      {/* New Tippgeber Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowNew(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold text-[#1A1A2E]">Neuen Tippgeber anlegen</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#1A1A2E] mb-1">Vorname *</label>
                  <input required value={form.vorname} onChange={e => setForm(f => ({...f, vorname: e.target.value}))} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none focus:ring-1 focus:ring-[#E4002B]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1A1A2E] mb-1">Nachname *</label>
                  <input required value={form.nachname} onChange={e => setForm(f => ({...f, nachname: e.target.value}))} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none focus:ring-1 focus:ring-[#E4002B]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A1A2E] mb-1">E-Mail</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none focus:ring-1 focus:ring-[#E4002B]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A1A2E] mb-1">Telefon</label>
                <input value={form.telefon} onChange={e => setForm(f => ({...f, telefon: e.target.value}))} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none focus:ring-1 focus:ring-[#E4002B]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A1A2E] mb-1">Firma</label>
                <input value={form.firma} onChange={e => setForm(f => ({...f, firma: e.target.value}))} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#E4002B] focus:outline-none focus:ring-1 focus:ring-[#E4002B]" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowNew(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Abbrechen</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-[#E4002B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C50024] disabled:opacity-50">
                  {saving ? 'Speichert...' : 'Anlegen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
