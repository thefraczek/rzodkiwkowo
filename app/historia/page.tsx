'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Folia } from '@/lib/types'
import { formatDatePL } from '@/lib/date'
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type EventType = 'sianie' | 'zbior' | 'oprysk' | 'nawoz'

type TimelineEvent = {
  id: string
  type: EventType
  date: string
  title: string
  detail?: string
  uwagi?: string | null
}

const TYPE_META: Record<EventType, { icon: string; color: string; bg: string; dot: string }> = {
  sianie: { icon: '🌱', color: 'text-green-700', bg: 'bg-green-50 border-green-200', dot: 'bg-green-500' },
  zbior:  { icon: '🥕', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
  oprysk: { icon: '💧', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
  nawoz:  { icon: '🌿', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-500' },
}

export default function HistoriaPage() {
  const [folie, setFolie] = useState<Folia[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(false)

  async function loadFolie() {
    const [f, s] = await Promise.all([
      supabase.from('folie').select('*').order('nazwa'),
      supabase.from('sianie').select('folia_id, data').order('data', { ascending: true }),
    ])
    const rawFolie = (f.data as Folia[]) ?? []
    const oldestSowing = new Map<number, string>()
    for (const row of s.data ?? []) {
      if (row.folia_id && !oldestSowing.has(row.folia_id)) oldestSowing.set(row.folia_id, row.data)
    }
    const sorted = [...rawFolie].sort((a, b) => {
      const aD = oldestSowing.get(a.id)
      const bD = oldestSowing.get(b.id)
      if (aD && bD) return aD.localeCompare(bD)
      if (aD) return -1
      if (bD) return 1
      return 0
    })
    setFolie(sorted)
    if (sorted.length && !selectedId) setSelectedId(String(sorted[0].id))
  }

  async function loadHistory(foliaId: string) {
    if (!foliaId) return
    setLoading(true)
    const id = Number(foliaId)

    const [si, zb, op, nw] = await Promise.all([
      supabase.from('sianie').select('id, data, uwagi, nasiona(nazwa)').eq('folia_id', id).order('data', { ascending: false }),
      supabase.from('zbiory').select('id, data_zbioru, typ, ilosc_klatek, ilosc_w_klatce, uwagi').eq('folia_id', id).order('data_zbioru', { ascending: false }),
      supabase.from('opryski').select('id, data, preparat, uwagi').eq('folia_id', id).order('data', { ascending: false }),
      supabase.from('nawozenie').select('id, data, uwagi, nawozenie_pozycje(ilosc, jednostka, nawozy_slownik(nazwa))').eq('folia_id', id).order('data', { ascending: false }),
    ])

    const result: TimelineEvent[] = []

    for (const r of si.data ?? []) {
      const nasiona = (r as any).nasiona?.nazwa
      result.push({
        id: `sianie-${r.id}`,
        type: 'sianie',
        date: r.data,
        title: 'Zasiew',
        detail: nasiona ?? undefined,
        uwagi: r.uwagi,
      })
    }

    for (const r of zb.data ?? []) {
      const kl = r.ilosc_klatek ?? 0
      const pwk = r.ilosc_w_klatce ?? 25
      const typ = r.typ === 'dwojka' ? 'Dwójka' : 'Jedynka'
      result.push({
        id: `zbior-${r.id}`,
        type: 'zbior',
        date: r.data_zbioru,
        title: `Zbiór — ${typ}`,
        detail: kl ? `${kl} kl. · ${kl * pwk} pęczków` : undefined,
        uwagi: r.uwagi,
      })
    }

    for (const r of op.data ?? []) {
      result.push({
        id: `oprysk-${r.id}`,
        type: 'oprysk',
        date: r.data,
        title: 'Oprysk',
        detail: (r as any).preparat ?? undefined,
        uwagi: r.uwagi,
      })
    }

    for (const r of nw.data ?? []) {
      const pozycje = ((r as any).nawozenie_pozycje ?? [])
        .map((p: any) => `${p.nawozy_slownik?.nazwa ?? '?'}${p.ilosc ? ` ${p.ilosc}${p.jednostka}` : ''}`)
        .join(', ')
      result.push({
        id: `nawoz-${r.id}`,
        type: 'nawoz',
        date: r.data,
        title: 'Nawożenie',
        detail: pozycje || undefined,
        uwagi: r.uwagi,
      })
    }

    result.sort((a, b) => b.date.localeCompare(a.date))
    setEvents(result)
    setLoading(false)
  }

  useEffect(() => { loadFolie() }, [])
  useRefreshOnFocus(loadFolie)

  useEffect(() => { loadHistory(selectedId) }, [selectedId])

  const selectedFolia = folie.find(f => String(f.id) === selectedId)

  // Group events by year-month
  const grouped = events.reduce<Record<string, TimelineEvent[]>>((acc, ev) => {
    const key = ev.date.slice(0, 7) // "2026-05"
    if (!acc[key]) acc[key] = []
    acc[key].push(ev)
    return acc
  }, {})

  function monthLabel(key: string): string {
    const [year, month] = key.split('-').map(Number)
    const date = new Date(year, month - 1, 1)
    return new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(date)
  }

  return (
    <div>
      <div className='mb-4'>
        <h1 className='text-xl font-bold text-gray-900'>Historia folii</h1>
        {selectedFolia?.metry_kwadratowe && (
          <p className='text-[11px] text-gray-400'>{selectedFolia.metry_kwadratowe} m²</p>
        )}
      </div>

      <div className='mb-5'>
        <Select key={folie.length} value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className='bg-white'>
            <SelectValue placeholder='Wybierz folię' />
          </SelectTrigger>
          <SelectContent>
            {folie.map(f => (
              <SelectItem key={f.id} value={String(f.id)}>{f.nazwa}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className='py-12 text-center text-gray-400 text-sm'>Ładowanie…</div>
      )}

      {!loading && events.length === 0 && selectedId && (
        <div className='py-12 text-center text-gray-400 text-sm'>Brak zdarzeń dla tej folii</div>
      )}

      {!loading && Object.keys(grouped).length > 0 && (
        <div className='space-y-6'>
          {Object.keys(grouped).sort((a, b) => b.localeCompare(a)).map(monthKey => (
            <div key={monthKey}>
              <p className='text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1'>
                {monthLabel(monthKey)}
              </p>
              <div className='relative'>
                {/* vertical line */}
                <div className='absolute left-[19px] top-3 bottom-3 w-px bg-gray-200' />

                <div className='space-y-3'>
                  {grouped[monthKey].map(ev => {
                    const meta = TYPE_META[ev.type]
                    return (
                      <div key={ev.id} className='flex gap-3'>
                        {/* dot */}
                        <div className='flex flex-col items-center shrink-0 pt-1'>
                          <div className={`w-[38px] h-[38px] rounded-xl ${meta.bg} border flex items-center justify-center text-lg shrink-0 z-10`}>
                            {meta.icon}
                          </div>
                        </div>

                        {/* content */}
                        <div className='flex-1 bg-white rounded-xl border px-3 py-2.5 min-w-0'>
                          <div className='flex items-start justify-between gap-2'>
                            <p className={`font-semibold text-sm ${meta.color}`}>{ev.title}</p>
                            <span className='text-[11px] text-gray-400 shrink-0'>{formatDatePL(ev.date)}</span>
                          </div>
                          {ev.detail && (
                            <p className='text-sm text-gray-600 mt-0.5'>{ev.detail}</p>
                          )}
                          {ev.uwagi && (
                            <p className='text-xs text-gray-400 mt-0.5 truncate'>{ev.uwagi}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
