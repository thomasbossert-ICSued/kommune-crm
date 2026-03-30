'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

type ProvisionRow = {
  id: string
  kunde_name: string | null
  kunde_organisation: string | null
  provision_betrag: number | null
  provision_bezahlt: boolean
  provision_bezahlt_am: string | null
  phase: string
  tippgeber: { vorname: string; nachname: string } | null
  geschaeftsbereich: { name: string; farbe: string } | null
}

export default function ProvisionenPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<ProvisionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('tipps')
        .select('id, kunde_name, kunde_organisation, provision_betrag, provision_bezahlt, provision_bezahlt_am, phase, tippgeber(vorname, nachname), geschaeftsbereich:geschaeftsbereich_id(name, farbe)')
        .not('provision_betrag', 'is', null)
        .order('provision_bezahlt', { ascending: true })
        .order('erstellt_am', { ascending: false })
      setRows((data as any) || [])
      setLoading(false)
    }
    load()
  }, [])

  async function toggleBezahlt(id: string, current: boolean) {
    const update: any = { provision_bezahlt: !current }
    if (!current) update.provision_bezahlt_am = new Date().toISOString().split('T')[0]
    else update.provision_bezahlt_am = null
    await supabase.from('tipps').update(update).eq('id', id)
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...update } : r))
  }

  const offen = rows.filter(r => !r.provision_bezahlt)
  const bezahlt = rows.filter(r => r.provision_bezahlt)
  const summeOffen = offen.reduce((s, r) => s + (r.provision_betrag || 0), 0)
  const summeBezahlt = bezahlt.reduce((s, r) => s + (r.provision_betrag || 0), 0)

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E4002B] border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A2E]">Provisionen</h1>
        <p className="text-sm text-gray-500">Tippgeber-Provisionen verwalten</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Offen</p>
          <p className="text-2xl font-bold text-[#F59E0B]">{summeOffen.toLocaleString('de-DE')} €</p>
          <p className="text-xs text-gray-400">{offen.length} Provisionen</p>
        </div>
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bezahlt</p>
          <p className="text-2xl font-bold text-[#10B981]">{summeBezahlt.toLocaleString('de-DE')} €</p>
          <p className="text-xs text-gray-400">{bezahlt.length} Provisionen</p>
        </div>
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Gesamt</p>
          <p className="text-2xl font-bold text-[#1A1A2E]">{(summeOffen + summeBezahlt).toLocaleString('de-DE')} €</p>
          <p className="text-xs text-gray-400">{rows.length} Provisionen</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">Tippgeber</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Kunde</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Bereich</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Betrag</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-[#1A1A2E]">
                  {row.tippgeber ? `${(row.tippgeber as any).vorname} ${(row.tippgeber as any).nachname}` : '–'}
                </td>
                <td className="px-4 py-3 text-gray-600">{row.kunde_name || row.kunde_organisation || '–'}</td>
                <td className="px-4 py-3">
                  {row.geschaeftsbereich && (
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: (row.geschaeftsbereich as any).farbe }}>
                      {(row.geschaeftsbereich as any).name === 'Kommunales Bausparen' ? 'Bausparen' : 'bKV/bAV'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-semibold">{(row.provision_betrag || 0).toLocaleString('de-DE')} €</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleBezahlt(row.id, row.provision_bezahlt)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      row.provision_bezahlt
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    }`}
                  >
                    {row.provision_bezahlt ? 'Bezahlt' : 'Offen'}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">Noch keine Provisionen erfasst</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
