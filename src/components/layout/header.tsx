'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { Berater } from '@/lib/supabase/types'

export function Header() {
  const [berater, setBerater] = useState<Berater | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadBerater() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('berater')
          .select('*')
          .eq('id', user.id)
          .single()
        if (data) setBerater(data)
      }
    }
    loadBerater()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-[#E5E7EB] bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        {berater && (
          <div className="text-right">
            <p className="text-sm font-medium text-[#1A1A2E]">
              {berater.vorname} {berater.nachname}
            </p>
            <p className="text-xs text-gray-400 capitalize">{berater.funktion}</p>
          </div>
        )}
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1A1A2E] text-sm font-bold text-white">
          {berater ? berater.vorname[0] + berater.nachname[0] : '..'}
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Abmelden"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
        </button>
      </div>
    </header>
  )
}
