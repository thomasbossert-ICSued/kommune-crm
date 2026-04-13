'use client'

import { createClient } from '@/lib/supabase/client'
import { useState, useRef } from 'react'

// ─── CSV-Format ───────────────────────────────────────────────────────────────
// Pflicht:  name
// Optional: typ, stadt, plz, bundesland, einwohner, mitarbeiter, notizen
//           ap1_vorname, ap1_nachname, ap1_position, ap1_telefon, ap1_email
//           ap2_vorname, ap2_nachname, ap2_position, ap2_telefon, ap2_email
//           ap3_vorname, ap3_nachname, ap3_position, ap3_telefon, ap3_email

const TEMPLATE_HEADER = [
  'name','typ','stadt','plz','bundesland','einwohner','mitarbeiter','notizen',
  'ap1_vorname','ap1_nachname','ap1_position','ap1_telefon','ap1_email',
  'ap2_vorname','ap2_nachname','ap2_position','ap2_telefon','ap2_email',
  'ap3_vorname','ap3_nachname','ap3_position','ap3_telefon','ap3_email',
].join(',')

const TEMPLATE_EXAMPLE = [
  'Gemeinde Friedberg','gemeinde','Friedberg','86316','Bayern','30000','250','',
  'Max','Müller','Bürgermeister','+49 821 123456','bm@friedberg.de',
  'Anna','Schmidt','Kämmerin','+49 821 123457','kaemmer@friedberg.de',
  '','','','','',
].join(',')

const VALID_TYPEN = ['gemeinde','stadt','landkreis','kommunaler_betrieb','zweckverband','sonstige']

type ParsedRow = {
  line: number
  name: string
  typ: string
  stadt: string
  plz: string
  bundesland: string
  einwohner: number | null
  mitarbeiter: number | null
  notizen: string
  personen: { vorname: string; nachname: string; position: string; telefon: string; email: string }[]
  fehler: string[]
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    const cols: string[] = []
    let inQuotes = false
    let current = ''
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { cols.push(current.trim()); current = '' }
      else { current += ch }
    }
    cols.push(current.trim())
    rows.push(cols)
  }
  return rows
}

function parseRows(raw: string[][]): ParsedRow[] {
  if (raw.length < 2) return []
  const header = raw[0].map(h => h.toLowerCase().replace(/\s/g, '_'))
  const idx = (name: string) => header.indexOf(name)

  return raw.slice(1).map((cols, i) => {
    const get = (col: string) => (cols[idx(col)] || '').trim()
    const fehler: string[] = []

    const name = get('name')
    if (!name) fehler.push('Name fehlt')

    const typ = get('typ') || 'gemeinde'
    if (!VALID_TYPEN.includes(typ)) fehler.push(`Ungültiger Typ: "${typ}"`)

    const einwohnerRaw = get('einwohner')
    const einwohner = einwohnerRaw ? parseInt(einwohnerRaw.replace(/\D/g, '')) : null
    const mitarbeiterRaw = get('mitarbeiter')
    const mitarbeiter = mitarbeiterRaw ? parseInt(mitarbeiterRaw.replace(/\D/g, '')) : null

    const personen = []
    for (let p = 1; p <= 3; p++) {
      const vorname = get(`ap${p}_vorname`)
      const nachname = get(`ap${p}_nachname`)
      if (vorname || nachname) {
        if (!vorname || !nachname) fehler.push(`Ansprechpartner ${p}: Vor- und Nachname müssen beide angegeben sein`)
        personen.push({
          vorname, nachname,
          position: get(`ap${p}_position`),
          telefon: get(`ap${p}_telefon`),
          email: get(`ap${p}_email`),
        })
      }
    }

    return {
      line: i + 2,
      name, typ,
      stadt: get('stadt'),
      plz: get('plz'),
      bundesland: get('bundesland'),
      einwohner, mitarbeiter,
      notizen: get('notizen'),
      personen,
      fehler,
    }
  })
}

interface Props {
  onClose: () => void
  onImported: () => void
}

export function KommunenImport({ onClose, onImported }: Props) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ ok: number; fehler: number } | null>(null)
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')

  function downloadTemplate() {
    const csv = TEMPLATE_HEADER + '\n' + TEMPLATE_EXAMPLE
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'kommunen-vorlage.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const raw = parseCSV(text)
      const parsed = parseRows(raw)
      setRows(parsed)
      setStep('preview')
    }
    reader.readAsText(file, 'UTF-8')
  }

  const validRows = rows.filter(r => r.fehler.length === 0)
  const errorRows = rows.filter(r => r.fehler.length > 0)

  async function handleImport() {
    if (validRows.length === 0) return
    setImporting(true)
    let ok = 0
    let fehler = 0

    for (const row of validRows) {
      const { data: kommune, error } = await supabase
        .from('kommunen')
        .insert({
          name: row.name,
          typ: row.typ,
          stadt: row.stadt || null,
          plz: row.plz || null,
          bundesland: row.bundesland || null,
          einwohner: row.einwohner,
          mitarbeiter: row.mitarbeiter,
          notizen: row.notizen || null,
        })
        .select()
        .single()

      if (error || !kommune) { fehler++; continue }

      if (row.personen.length > 0) {
        await supabase.from('kommunen_personen').insert(
          row.personen.map((p, i) => ({
            kommune_id: kommune.id,
            reihenfolge: i + 1,
            vorname: p.vorname,
            nachname: p.nachname,
            position: p.position || null,
            telefon: p.telefon || null,
            email: p.email || null,
          }))
        )
      }
      ok++
    }

    setImportResult({ ok, fehler })
    setImporting(false)
    setStep('done')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl my-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#1A1A2E]">Kommunen importieren</h2>
            <p className="text-xs text-gray-400 mt-0.5">CSV-Datei mit Kommunen und Ansprechpartnern hochladen</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6">
          {/* Step: Upload */}
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Vorlage */}
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">CSV-Format</p>
                    <p className="text-xs text-blue-700 mt-1">Eine Zeile = eine Kommune. Pflichtfeld: <code className="bg-blue-100 px-1 rounded">name</code>. Optional: Stammdaten + bis zu 3 Ansprechpartner.</p>
                    <button onClick={downloadTemplate} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 underline">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Vorlage herunterladen (kommunen-vorlage.csv)
                    </button>
                  </div>
                </div>
              </div>

              {/* Spalten-Referenz */}
              <div className="rounded-lg border border-[#E5E7EB] p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Verfügbare Spalten</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  <div className="space-y-1">
                    <p className="font-medium text-gray-700 mt-1">Kommune</p>
                    {[['name','Pflicht'],['typ','gemeinde / stadt / landkreis / kommunaler_betrieb / zweckverband / sonstige'],['stadt','Ort'],['plz','Postleitzahl'],['bundesland','z.B. Bayern'],['einwohner','Zahl'],['mitarbeiter','Zahl'],['notizen','Freitext']].map(([col, hint]) => (
                      <div key={col} className="flex gap-2">
                        <code className="text-[#E4002B] w-24 flex-shrink-0">{col}</code>
                        <span className="text-gray-400">{hint}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-gray-700 mt-1">Ansprechpartner (1–3)</p>
                    {[['ap1_vorname','Pflicht wenn ap1'],['ap1_nachname','Pflicht wenn ap1'],['ap1_position','z.B. Bürgermeister'],['ap1_telefon',''],['ap1_email',''],].map(([col, hint]) => (
                      <div key={col} className="flex gap-2">
                        <code className="text-[#6366F1] w-28 flex-shrink-0">{col}</code>
                        <span className="text-gray-400">{hint}</span>
                      </div>
                    ))}
                    <p className="text-gray-400 text-xs mt-1">→ ap2_* und ap3_* analog</p>
                  </div>
                </div>
              </div>

              {/* Upload-Zone */}
              <div
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#E5E7EB] py-10 cursor-pointer hover:border-[#E4002B] hover:bg-red-50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <svg className="h-10 w-10 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                <p className="text-sm font-medium text-gray-500">CSV-Datei hier ablegen oder klicken</p>
                <p className="text-xs text-gray-400 mt-1">UTF-8, Komma-getrennt</p>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#1A1A2E]">{fileName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {rows.length} Zeilen gelesen ·{' '}
                    <span className="text-green-600 font-medium">{validRows.length} importierbar</span>
                    {errorRows.length > 0 && <span className="text-red-500 font-medium"> · {errorRows.length} mit Fehlern</span>}
                  </p>
                </div>
                <button onClick={() => { setRows([]); setFileName(''); setStep('upload') }} className="text-xs text-gray-400 hover:text-[#1A1A2E]">← Andere Datei</button>
              </div>

              {/* Fehler-Liste */}
              {errorRows.length > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 max-h-36 overflow-y-auto">
                  <p className="text-xs font-semibold text-red-700 mb-2">Zeilen mit Fehlern (werden übersprungen):</p>
                  {errorRows.map(r => (
                    <div key={r.line} className="text-xs text-red-600 mb-1">
                      <span className="font-medium">Zeile {r.line}{r.name ? ` (${r.name})` : ''}: </span>
                      {r.fehler.join(', ')}
                    </div>
                  ))}
                </div>
              )}

              {/* Vorschau-Tabelle */}
              {validRows.length > 0 && (
                <div className="rounded-lg border border-[#E5E7EB] overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Name</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Typ</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Ort</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Hauptansprechpartner</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">+ Personen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validRows.map((r, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-3 py-2 font-medium text-[#1A1A2E]">{r.name}</td>
                            <td className="px-3 py-2 text-gray-500">{r.typ}</td>
                            <td className="px-3 py-2 text-gray-500">{[r.plz, r.stadt].filter(Boolean).join(' ') || '–'}</td>
                            <td className="px-3 py-2">
                              {r.personen[0]
                                ? <><span className="font-medium">{r.personen[0].vorname} {r.personen[0].nachname}</span>{r.personen[0].position && <span className="text-gray-400"> · {r.personen[0].position}</span>}</>
                                : <span className="text-gray-300">–</span>}
                            </td>
                            <td className="px-3 py-2 text-gray-400">{r.personen.length > 1 ? `+${r.personen.length - 1}` : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && importResult && (
            <div className="py-8 text-center">
              {importResult.ok > 0 ? (
                <>
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                    <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="text-lg font-bold text-[#1A1A2E]">{importResult.ok} Kommunen importiert</p>
                  {importResult.fehler > 0 && <p className="text-sm text-red-500 mt-1">{importResult.fehler} konnten nicht importiert werden</p>}
                </>
              ) : (
                <>
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                    <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </div>
                  <p className="text-lg font-bold text-[#1A1A2E]">Import fehlgeschlagen</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4">
          {step === 'done' ? (
            <button onClick={() => { onImported(); onClose() }} className="rounded-lg bg-[#E4002B] px-5 py-2 text-sm font-semibold text-white hover:bg-[#C50024]">
              Fertig
            </button>
          ) : (
            <>
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Abbrechen</button>
              {step === 'preview' && validRows.length > 0 && (
                <button onClick={handleImport} disabled={importing}
                  className="rounded-lg bg-[#E4002B] px-5 py-2 text-sm font-semibold text-white hover:bg-[#C50024] disabled:opacity-50 flex items-center gap-2">
                  {importing && <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                  {importing ? 'Wird importiert...' : `${validRows.length} Kommunen importieren`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
