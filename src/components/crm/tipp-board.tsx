'use client'

import type { Tipp, PipelinePhase } from '@/lib/supabase/types'
import { useState } from 'react'

interface TippBoardProps {
  tipps: Tipp[]
  phasen: PipelinePhase[]
  onPhaseChange: (tippId: string, neuePhase: string) => void
}

export function TippBoard({ tipps, phasen, onPhaseChange }: TippBoardProps) {
  const [draggedTipp, setDraggedTipp] = useState<string | null>(null)
  const [dragOverPhase, setDragOverPhase] = useState<string | null>(null)

  return (
    <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
      {phasen.map((phase) => {
        const phaseTipps = tipps.filter(t => t.phase === phase.name)
        const isOver = dragOverPhase === phase.name

        return (
          <div
            key={phase.id}
            className="flex w-72 flex-shrink-0 flex-col rounded-xl bg-white border border-[#E5E7EB]"
            onDragOver={(e) => { e.preventDefault(); setDragOverPhase(phase.name) }}
            onDragLeave={() => setDragOverPhase(null)}
            onDrop={() => {
              if (draggedTipp) {
                onPhaseChange(draggedTipp, phase.name)
                setDraggedTipp(null)
                setDragOverPhase(null)
              }
            }}
          >
            {/* Column Header */}
            <div className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: phase.farbe }} />
              <span className="text-sm font-semibold text-[#1A1A2E]">{phase.name}</span>
              <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {phaseTipps.length}
              </span>
            </div>

            {/* Cards */}
            <div className={`flex-1 space-y-2 p-2 transition-colors ${isOver ? 'bg-blue-50' : ''}`}>
              {phaseTipps.map((tipp) => (
                <div
                  key={tipp.id}
                  draggable
                  onDragStart={() => setDraggedTipp(tipp.id)}
                  onDragEnd={() => { setDraggedTipp(null); setDragOverPhase(null) }}
                  className={`cursor-grab rounded-lg border border-[#E5E7EB] bg-white p-3 shadow-sm hover:shadow transition-shadow active:cursor-grabbing ${draggedTipp === tipp.id ? 'opacity-50' : ''}`}
                >
                  <a href={`/tipps/${tipp.id}`} className="block" onClick={(e) => { if (draggedTipp) e.preventDefault() }}>
                    <p className="text-sm font-medium text-[#1A1A2E]">
                      {tipp.kunde_name || tipp.kunde_organisation || 'Unbekannt'}
                    </p>
                    {tipp.kunde_organisation && tipp.kunde_name && (
                      <p className="text-xs text-gray-400 mt-0.5">{tipp.kunde_organisation}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {(tipp as any).geschaeftsbereich && (
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: (tipp as any).geschaeftsbereich.farbe }}
                        >
                          {(tipp as any).geschaeftsbereich.name === 'Kommunales Bausparen' ? 'Bausparen' : 'bKV/bAV'}
                        </span>
                      )}
                      {tipp.geschaetzter_wert && (
                        <span className="text-xs text-gray-400">
                          {tipp.geschaetzter_wert.toLocaleString('de-DE')} €
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-gray-400">
                        {(tipp as any).tippgeber?.vorname?.[0]}. {(tipp as any).tippgeber?.nachname}
                      </p>
                      <p className="text-xs text-gray-300">
                        {new Date(tipp.erstellt_am).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                      </p>
                    </div>
                  </a>
                </div>
              ))}
              {phaseTipps.length === 0 && (
                <p className="py-8 text-center text-xs text-gray-300">Keine Tipps</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
