'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { Tipp, Tippgeber, PipelinePhase } from '@/lib/supabase/types'

type DashboardData = {
  tippsDieseWoche: number
  tippsGesamt: number
  offenePipeline: number
  pipelineWert: number
  conversionRate: number
  offeneProvisionen: number
  unzugewieseneTipps: Tipp[]
  topTippgeber: (Tippgeber & { tipps_count: number })[]
  pipelineFunnel: { name: string; count: number; farbe: string }[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadDashboard() {
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay() + 1)
      startOfWeek.setHours(0, 0, 0, 0)

      // Parallel queries
      const [tippsRes, tippgeberRes, phasenRes, alleRes] = await Promise.all([
        supabase.from('tipps').select('*, tippgeber(*), berater:zugewiesen_an(vorname, nachname), geschaeftsbereich:geschaeftsbereich_id(name, farbe)'),
        supabase.from('tippgeber').select('*').eq('aktiv', true).order('tipps_gesamt', { ascending: false }).limit(5),
        supabase.from('pipeline_phasen').select('*').order('reihenfolge'),
        supabase.from('tipps').select('id, phase, erstellt_am, geschaetzter_wert, provision_betrag, provision_bezahlt, zugewiesen_an'),
      ])

      const tipps = tippsRes.data || []
      const alleTipps = alleRes.data || []
      const phasen = phasenRes.data || []
      const tippgeber = tippgeberRes.data || []

      // KPIs berechnen
      const tippsDieseWoche = alleTipps.filter(t => new Date(t.erstellt_am) >= startOfWeek).length
      const abschlussPhase = phasen.find(p => p.ist_abschluss)
      const verlorenPhase = phasen.find(p => p.ist_verloren)
      const abgeschlossen = alleTipps.filter(t => t.phase === abschlussPhase?.name).length
      const verloren = alleTipps.filter(t => t.phase === verlorenPhase?.name).length
      const offene = alleTipps.filter(t => t.phase !== abschlussPhase?.name && t.phase !== verlorenPhase?.name)
      const offeneProvisionen = alleTipps
        .filter(t => t.provision_betrag && !t.provision_bezahlt)
        .reduce((sum, t) => sum + (t.provision_betrag || 0), 0)

      const conversionRate = (abgeschlossen + verloren) > 0
        ? Math.round((abgeschlossen / (abgeschlossen + verloren)) * 100)
        : 0

      // Pipeline Funnel
      const pipelineFunnel = phasen
        .filter(p => !p.ist_verloren)
        .map(p => ({
          name: p.name,
          count: alleTipps.filter(t => t.phase === p.name).length,
          farbe: p.farbe,
        }))

      // Unzugewiesene Tipps
      const unzugewieseneTipps = tipps.filter(t => !t.zugewiesen_an && t.phase !== verlorenPhase?.name && t.phase !== abschlussPhase?.name)

      setData({
        tippsDieseWoche,
        tippsGesamt: alleTipps.length,
        offenePipeline: offene.length,
        pipelineWert: offene.reduce((s, t) => s + (t.geschaetzter_wert || 0), 0),
        conversionRate,
        offeneProvisionen,
        unzugewieseneTipps,
        topTippgeber: tippgeber as any,
        pipelineFunnel,
      })
      setLoading(false)
    }
    loadDashboard()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E4002B] border-t-transparent" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A2E]">Dashboard</h1>
        <p className="text-sm text-gray-500">Überblick über deine Pipeline und Tippgeber</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Neue Tipps (Woche)"
          value={data.tippsDieseWoche.toString()}
          sub={`${data.tippsGesamt} gesamt`}
          color="#2563EB"
        />
        <KpiCard
          label="Offene Pipeline"
          value={data.offenePipeline.toString()}
          sub={data.pipelineWert > 0 ? `${data.pipelineWert.toLocaleString('de-DE')} € Wert` : 'Kein Wert erfasst'}
          color="#F59E0B"
        />
        <KpiCard
          label="Conversion Rate"
          value={`${data.conversionRate}%`}
          sub="Abschluss / (Abschluss + Verloren)"
          color="#10B981"
        />
        <KpiCard
          label="Offene Provisionen"
          value={`${data.offeneProvisionen.toLocaleString('de-DE')} €`}
          sub="Noch nicht ausgezahlt"
          color="#7C3AED"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Pipeline Funnel */}
        <div className="lg:col-span-2 rounded-xl border border-[#E5E7EB] bg-white p-5">
          <h2 className="mb-4 text-base font-bold text-[#1A1A2E]">Pipeline-Funnel</h2>
          {data.pipelineFunnel.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.pipelineFunnel} layout="vertical" margin={{ left: 100 }}>
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [`${value} Tipps`, 'Anzahl']} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {data.pipelineFunnel.map((entry, i) => (
                    <Cell key={i} fill={entry.farbe} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm text-gray-400">Noch keine Tipps in der Pipeline</p>
          )}
        </div>

        {/* Top Tippgeber */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
          <h2 className="mb-4 text-base font-bold text-[#1A1A2E]">Top Tippgeber</h2>
          {data.topTippgeber.length > 0 ? (
            <div className="space-y-3">
              {data.topTippgeber.map((tg, i) => (
                <div key={tg.id} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#1A1A2E]">{tg.vorname} {tg.nachname}</p>
                    <p className="text-xs text-gray-400">{tg.firma}</p>
                  </div>
                  <span className="text-sm font-semibold text-[#1A1A2E]">{tg.tipps_gesamt}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-gray-400">Noch keine Tippgeber</p>
          )}
        </div>
      </div>

      {/* Unassigned Tips - Urgent */}
      {data.unzugewieseneTipps.length > 0 && (
        <div className="rounded-xl border-2 border-[#F59E0B] bg-amber-50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <svg className="h-5 w-5 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-base font-bold text-amber-800">
              {data.unzugewieseneTipps.length} Tipp{data.unzugewieseneTipps.length !== 1 ? 's' : ''} ohne Zuordnung
            </h2>
          </div>
          <div className="space-y-2">
            {data.unzugewieseneTipps.slice(0, 5).map((tipp) => (
              <a
                key={tipp.id}
                href={`/tipps/${tipp.id}`}
                className="flex items-center justify-between rounded-lg bg-white px-4 py-2.5 border border-amber-200 hover:border-[#F59E0B] transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-[#1A1A2E]">{tipp.kunde_name || tipp.kunde_organisation || 'Unbekannt'}</p>
                  <p className="text-xs text-gray-400">
                    von {(tipp as any).tippgeber?.vorname} {(tipp as any).tippgeber?.nachname} · {new Date(tipp.erstellt_am).toLocaleDateString('de-DE')}
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  Zuweisen
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
      <div className="mb-1 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-bold text-[#1A1A2E]">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{sub}</p>
    </div>
  )
}
