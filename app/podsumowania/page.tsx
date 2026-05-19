'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { parsePozycjeFromTyp, cratesFromPozycje } from '@/lib/order-lines'
import { formatDatePL } from '@/lib/date'

type ActiveSowing = { id: number; data: string; folia_id: number | null; folie: { nazwa: string; kolor: string } | null }
type ActivityItem = { icon: string; label: string; date: string }

type Stats = {
  folie: number
  zamowienia: number
  sianie: number
  metry_folii: number
}

type ActivityDay = {
  date: string
  jedynka: number
  jedynkaPeczki: number
  dwojka: number
  dwojkaPeczki: number
  isToday: boolean
}

type WeeklyMeters = {
  weekStart: string
  label: string
  relativeLabel: string
  meters: number
  folieCount: number
}

const MS_DAY = 24 * 60 * 60 * 1000

function toIsoDate(value: Date): string {
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function startOfWeek(value: Date): Date {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date
}

function buildActivityWindow(): string[] {
  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - 7 + index)
    return toIsoDate(date)
  })
}

function dayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const days = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb']
  return days[date.getDay()]
}

function buildWeekBuckets(weeks: number): WeeklyMeters[] {
  const currentWeekStart = startOfWeek(new Date())
  return Array.from({ length: weeks }, (_, index) => {
    const date = new Date(currentWeekStart)
    const weeksAgo = weeks - 1 - index
    date.setDate(date.getDate() - weeksAgo * 7)

    let relativeLabel = ''
    if (weeksAgo === 0) relativeLabel = 'Ten tydzień'
    else if (weeksAgo === 1) relativeLabel = 'Poprzedni tydzień'
    else if (weeksAgo === 2) relativeLabel = '2 tygodnie temu'
    else if (weeksAgo === 3) relativeLabel = '3 tygodnie temu'
    else if (weeksAgo === 4) relativeLabel = '4 tygodnie temu'
    else relativeLabel = `${weeksAgo} tygodni temu`

    return {
      weekStart: toIsoDate(date),
      label: new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit' }).format(date),
      relativeLabel,
      meters: 0,
      folieCount: 0,
    }
  })
}

function daysAgo(dateStr: string): number {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  const then = new Date(y, m - 1, d)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.floor((now.getTime() - then.getTime()) / 86400000)
}

function relativeDate(dateStr: string): string {
  const days = daysAgo(dateStr)
  if (days === 0) return 'dziś'
  if (days === 1) return 'wczoraj'
  if (days < 7) return `${days} dni temu`
  return formatDatePL(dateStr.slice(0, 10))
}

function shortDateLabel(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, day || 1)
  return new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit' }).format(date)
}

export default function PodsumowaniaPage() {
  const today = toIsoDate(new Date())
  const activityStart = toIsoDate(new Date(Date.now() - 7 * MS_DAY))

  const [stats, setStats] = useState<Stats>({
    folie: 0,
    zamowienia: 0,
    sianie: 0,
    metry_folii: 0,
  })
  const [activity, setActivity] = useState<ActivityDay[]>([])
  const [weeklyMeters, setWeeklyMeters] = useState<WeeklyMeters[]>([])
  const [activeSowings, setActiveSowings] = useState<ActiveSowing[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])

  async function load() {
    const weekBuckets = buildWeekBuckets(6)
    const firstWeekStart = weekBuckets[0]?.weekStart ?? today

    const [folieRows, zam, s, zbioryRows, weeklySowingRows] = await Promise.all([
      supabase.from('folie').select('id, metry_kwadratowe'),
      supabase.from('zamowienia').select('id', { count: 'exact', head: true }),
      supabase.from('sianie').select('id', { count: 'exact', head: true }),
      supabase.from('zbiory').select('data_zbioru, typ, ilosc_klatek, ilosc_w_klatce').gte('data_zbioru', activityStart).lte('data_zbioru', today),
      supabase.from('sianie').select('data, folia_id, folie(metry_kwadratowe)').gte('data', firstWeekStart).lte('data', today),
    ])

    const totalMeters = (folieRows.data ?? []).reduce((sum, row: any) => sum + Number(row.metry_kwadratowe ?? 0), 0)

    setStats({
      folie: folieRows.data?.length ?? 0,
      zamowienia: zam.count ?? 0,
      sianie: s.count ?? 0,
      metry_folii: totalMeters,
    })

    const activityMap = new Map<string, ActivityDay>()
    for (const date of buildActivityWindow()) {
      activityMap.set(date, { date, jedynka: 0, jedynkaPeczki: 0, dwojka: 0, dwojkaPeczki: 0, isToday: date === today })
    }

    for (const row of zbioryRows.data ?? []) {
      const day = (row as any).data_zbioru
      if (!day || !activityMap.has(day)) continue
      const entry = activityMap.get(day)!
      const kl = (row as any).ilosc_klatek ?? 0
      const pwk = (row as any).ilosc_w_klatce ?? 25
      if ((row as any).typ === 'jedynka') { entry.jedynka += kl; entry.jedynkaPeczki += kl * pwk }
      else if ((row as any).typ === 'dwojka') { entry.dwojka += kl; entry.dwojkaPeczki += kl * pwk }
    }

    const weeklyMap = new Map(weekBuckets.map(week => [week.weekStart, { ...week }]))
    const weeklyFoils = new Map<string, Set<number>>()

    for (const row of weeklySowingRows.data ?? []) {
      if (!row.data) continue

      const weekStart = toIsoDate(startOfWeek(new Date(row.data)))
      const folia = Array.isArray((row as any).folie) ? (row as any).folie[0] : (row as any).folie
      const meters = Number(folia?.metry_kwadratowe ?? 0)

      if (weeklyMap.has(weekStart)) weeklyMap.get(weekStart)!.meters += meters

      const foliaId = row.folia_id
      if (foliaId && weeklyMap.has(weekStart)) {
        if (!weeklyFoils.has(weekStart)) weeklyFoils.set(weekStart, new Set<number>())
        weeklyFoils.get(weekStart)!.add(foliaId)
      }
    }

    for (const [weekStart, ids] of weeklyFoils.entries()) {
      if (weeklyMap.has(weekStart)) weeklyMap.get(weekStart)!.folieCount = ids.size
    }

    setActivity(Array.from(activityMap.values()))
    setWeeklyMeters(Array.from(weeklyMap.values()))
  }

  async function loadActiveSowings() {
    const since = new Date(Date.now() - 70 * 86400000).toISOString().slice(0, 10)
    const [s, z] = await Promise.all([
      supabase.from('sianie').select('id, data, folia_id, folie(nazwa, kolor)').gte('data', since).order('data', { ascending: false }),
      supabase.from('zbiory').select('folia_id, data_zbioru').gte('data_zbioru', since),
    ])
    const sowings = (s.data ?? []) as unknown as ActiveSowing[]
    const harvests = (z.data ?? []) as { folia_id: number | null; data_zbioru: string }[]
    setActiveSowings(sowings.filter(s => !harvests.some(z => z.folia_id === s.folia_id && z.data_zbioru >= s.data)))
  }

  async function loadRecentActivity() {
    const [zb, si, op, na, zam] = await Promise.all([
      supabase.from('zbiory').select('data_zbioru, folie(nazwa), ilosc_klatek').order('created_at', { ascending: false }).limit(6),
      supabase.from('sianie').select('data, folie(nazwa)').order('created_at', { ascending: false }).limit(6),
      supabase.from('opryski').select('data, folie(nazwa)').order('created_at', { ascending: false }).limit(4),
      supabase.from('nawozenie').select('data, folie(nazwa)').order('created_at', { ascending: false }).limit(4),
      supabase.from('zamowienia').select('data_utworzenia, odbiorcy(ksywa, imie, nazwisko), typ, ilosc, ilosc_w_klatce').order('data_utworzenia', { ascending: false }).limit(6),
    ])
    const items: ActivityItem[] = []
    for (const r of zb.data ?? []) {
      const kl = (r as any).ilosc_klatek
      items.push({ icon: '🥕', label: `Zbiór — ${(r as any).folie?.nazwa ?? '?'}${kl ? ` (${kl} kl.)` : ''}`, date: (r as any).data_zbioru })
    }
    for (const r of si.data ?? []) items.push({ icon: '🌱', label: `Zasiew — ${(r as any).folie?.nazwa ?? '?'}`, date: (r as any).data })
    for (const r of op.data ?? []) items.push({ icon: '💧', label: `Oprysk — ${(r as any).folie?.nazwa ?? '?'}`, date: (r as any).data })
    for (const r of na.data ?? []) items.push({ icon: '🌿', label: `Nawożenie — ${(r as any).folie?.nazwa ?? '?'}`, date: (r as any).data })
    for (const r of zam.data ?? []) {
      const o = (r as any).odbiorcy
      const name = o?.ksywa || [o?.imie, o?.nazwisko].filter(Boolean).join(' ') || '?'
      const kl = cratesFromPozycje(parsePozycjeFromTyp((r as any).typ, (r as any).ilosc, (r as any).ilosc_w_klatce))
      items.push({ icon: '📦', label: `Zamówienie — ${name}${kl ? ` (${kl} kl.)` : ''}`, date: (r as any).data_utworzenia.slice(0, 10) })
    }
    items.sort((a, b) => b.date.localeCompare(a.date))
    setRecentActivity(items.slice(0, 12))
  }

  useEffect(() => { load(); loadActiveSowings(); loadRecentActivity() }, [])

  const statCards = [
    { label: 'Folie', value: stats.folie, suffix: '', color: 'text-green-700', bg: 'bg-green-50 border-green-200', href: '/mapa' },
    { label: 'Powierzchnia folii', value: stats.metry_folii, suffix: 'm²', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', href: '/mapa' },
{ label: 'Zasiewy', value: stats.sianie, suffix: '', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', href: '/sianie' },
    { label: 'Zamówienia', value: stats.zamowienia, suffix: '', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', href: '/zamowienia' },
  ]

const maxWeeklyMeters = Math.max(1, ...weeklyMeters.map(week => week.meters))
  const currentWeekMeters = weeklyMeters[weeklyMeters.length - 1]?.meters ?? 0
  const currentWeekFolie = weeklyMeters[weeklyMeters.length - 1]?.folieCount ?? 0

  return (
    <div className='space-y-5'>
      <div>
        <h1 className='text-xl font-bold text-gray-900'>Podsumowania</h1>
        <p className='text-sm text-gray-500'>Szybki przegląd gospodarstwa, aktywności i zasianej powierzchni.</p>
      </div>

      <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
        {statCards.map(c => (
          <a key={c.label} href={c.href} className={`border rounded-xl p-4 ${c.bg} hover:opacity-80 transition-opacity`}>
            <div className={`text-3xl font-bold ${c.color}`}>
              {c.value}
              {c.suffix && <span className='ml-1 text-base font-semibold'>{c.suffix}</span>}
            </div>
            <div className='text-sm text-gray-500 mt-1 leading-tight'>{c.label}</div>
          </a>
        ))}
      </div>

      <div className='bg-white border rounded-2xl overflow-hidden'>
        <div className='px-4 py-3 border-b bg-emerald-50'>
          <h2 className='font-semibold text-gray-800'>Zasiane m² w 6 tygodni</h2>
          <p className='text-[11px] text-emerald-700 mt-0.5'>Liczone według powierzchni przypisanej do folii przy każdym zasiewie.</p>
          <div className='flex gap-2 mt-2'>
            <div className='rounded-lg bg-white border border-emerald-200 px-3 py-1.5 flex-1 text-center'>
              <div className='text-[11px] text-gray-500'>Ten tydzień</div>
              <div className='text-base font-bold text-emerald-700'>{currentWeekMeters} m²</div>
            </div>
            <div className='rounded-lg bg-white border border-emerald-200 px-3 py-1.5 flex-1 text-center'>
              <div className='text-[11px] text-gray-500'>Folie zasiane</div>
              <div className='text-base font-bold text-emerald-700'>{currentWeekFolie}</div>
            </div>
          </div>
        </div>

        {weeklyMeters.length ? (
          <div className='px-4 py-5'>
            <div className='flex items-end gap-3 overflow-x-auto pb-2'>
              {weeklyMeters.map(week => (
                <div key={week.weekStart} className='min-w-[90px] flex-1'>
                  <div className='h-44 flex items-end justify-center rounded-xl bg-emerald-50 px-3 py-3'>
                    <div
                      className='w-8 rounded-t-lg bg-emerald-500'
                      style={{ height: `${Math.max(10, (week.meters / maxWeeklyMeters) * 130)}px` }}
                      title={`${week.meters} m²`}
                    />
                  </div>
                  <div className='mt-2 text-center text-[11px] font-medium text-gray-600'>{week.relativeLabel}</div>
                  <div className='mt-0.5 text-center text-[11px] text-gray-400'>od {week.label}</div>
                  <div className='mt-1 text-center text-[13px] font-semibold text-emerald-700'>{week.meters} m²</div>
                  <div className='text-center text-[11px] text-gray-500'>{week.folieCount} folii</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className='py-10 text-center text-gray-400 text-sm'>Brak zasiewów do przeliczenia m².</div>
        )}
      </div>

      {(() => {
        const totJ = activity.reduce((s, d) => s + d.jedynka, 0)
        const totJp = activity.reduce((s, d) => s + d.jedynkaPeczki, 0)
        const totD = activity.reduce((s, d) => s + d.dwojka, 0)
        const totDp = activity.reduce((s, d) => s + d.dwojkaPeczki, 0)
        return (
          <div className='bg-white border rounded-2xl overflow-hidden'>
            <div className='px-4 py-3 border-b bg-orange-50'>
              <h2 className='font-semibold text-gray-800'>Zbiory — ostatnie 7 dni</h2>
            </div>

            {/* 7-day totals */}
            <div className='grid grid-cols-3 divide-x border-b bg-gray-50 text-center'>
              <div className='px-3 py-3'>
                <div className='flex items-center justify-center gap-1 mb-1'>
                  <span className='w-2.5 h-2.5 rounded-sm bg-orange-400 shrink-0' />
                  <span className='text-[11px] font-medium text-gray-500'>Jedynka (7 dni)</span>
                </div>
                <div className='text-xl font-bold text-orange-600'>{totJ} <span className='text-sm font-medium'>kl.</span></div>
                <div className='text-[11px] text-gray-400 mt-0.5'>{totJp} pęczków</div>
              </div>
              <div className='px-3 py-3'>
                <div className='flex items-center justify-center gap-1 mb-1'>
                  <span className='w-2.5 h-2.5 rounded-sm bg-amber-400 shrink-0' />
                  <span className='text-[11px] font-medium text-gray-500'>Dwójka (7 dni)</span>
                </div>
                <div className='text-xl font-bold text-amber-500'>{totD} <span className='text-sm font-medium'>kl.</span></div>
                <div className='text-[11px] text-gray-400 mt-0.5'>{totDp} pęczków</div>
              </div>
              <div className='px-3 py-3'>
                <div className='text-[11px] font-medium text-gray-500 mb-1'>Razem (7 dni)</div>
                <div className='text-xl font-bold text-gray-800'>{totJ + totD} <span className='text-sm font-medium'>kl.</span></div>
                <div className='text-[11px] text-gray-400 mt-0.5'>{totJp + totDp} pęczków</div>
              </div>
            </div>

            {/* column headers */}
            <div className='grid grid-cols-[72px_1fr_1fr_1fr] gap-x-2 px-4 py-1.5 bg-gray-50 border-b text-[11px] font-medium text-gray-400 uppercase tracking-wide'>
              <div>Dzień</div>
              <div className='text-center'>Jedynka</div>
              <div className='text-center'>Dwójka</div>
              <div className='text-center'>Suma dnia</div>
            </div>

            {/* per-day rows */}
            <div className='divide-y'>
              {[...activity].reverse().map(day => {
                const sumaKl = day.jedynka + day.dwojka
                const sumaP = day.jedynkaPeczki + day.dwojkaPeczki
                const empty = sumaKl === 0
                return (
                  <div key={day.date} className={`grid grid-cols-[72px_1fr_1fr_1fr] gap-x-2 px-4 py-2.5 items-center ${day.isToday ? 'bg-orange-50' : ''}`}>
                    <div>
                      <div className={`text-sm font-bold ${day.isToday ? 'text-orange-600' : 'text-gray-700'}`}>{dayLabel(day.date)}</div>
                      <div className='text-[11px] text-gray-400'>{shortDateLabel(day.date)}</div>
                      {day.isToday && <div className='text-[10px] font-semibold text-orange-400'>dziś</div>}
                    </div>
                    <div className='text-center'>
                      {day.jedynka > 0 ? (
                        <>
                          <div className='text-sm font-bold text-orange-600'>{day.jedynka} kl.</div>
                          <div className='text-[11px] text-gray-400'>{day.jedynkaPeczki} p.</div>
                        </>
                      ) : <span className='text-gray-300 text-sm'>—</span>}
                    </div>
                    <div className='text-center'>
                      {day.dwojka > 0 ? (
                        <>
                          <div className='text-sm font-bold text-amber-500'>{day.dwojka} kl.</div>
                          <div className='text-[11px] text-gray-400'>{day.dwojkaPeczki} p.</div>
                        </>
                      ) : <span className='text-gray-300 text-sm'>—</span>}
                    </div>
                    <div className='text-center'>
                      {empty ? (
                        <span className='text-gray-300 text-sm'>—</span>
                      ) : (
                        <>
                          <div className='text-sm font-bold text-gray-800'>{sumaKl} kl.</div>
                          <div className='text-[11px] text-gray-400'>{sumaP} p.</div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
      <div className='bg-white border rounded-2xl overflow-hidden'>
        <div className='px-4 py-3 border-b bg-green-50 flex items-center gap-2'>
          <span className='text-lg'>🌱</span>
          <h2 className='font-semibold text-gray-800'>Rośnie teraz</h2>
          {activeSowings.length > 0 && (
            <span className='ml-auto text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full'>{activeSowings.length} folii</span>
          )}
        </div>
        {activeSowings.length === 0 ? (
          <div className='py-10 text-center text-gray-400 text-sm'>Brak aktywnych zasiewów</div>
        ) : (
          <div className='divide-y'>
            {activeSowings.map(s => {
              const days = daysAgo(s.data)
              const status = days >= 28
                ? { label: 'Gotowe!', cls: 'bg-green-100 text-green-700' }
                : days >= 20
                  ? { label: 'Dojrzewa', cls: 'bg-amber-100 text-amber-700' }
                  : { label: `${days} dni`, cls: 'bg-blue-100 text-blue-700' }
              return (
                <div key={s.id} className='flex items-center gap-3 px-4 py-3'>
                  <div className='w-2.5 h-2.5 rounded-full shrink-0' style={{ background: s.folie?.kolor ?? '#d1d5db' }} />
                  <p className='flex-1 text-sm font-medium text-gray-800'>{s.folie?.nazwa ?? '—'}</p>
                  <span className='text-xs text-gray-400'>od {formatDatePL(s.data)}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className='bg-white border rounded-2xl overflow-hidden'>
        <div className='px-4 py-3 border-b flex items-center gap-2'>
          <span className='text-lg'>📋</span>
          <h2 className='font-semibold text-gray-800'>Ostatnie działania</h2>
        </div>
        {recentActivity.length === 0 ? (
          <div className='py-10 text-center text-gray-400 text-sm'>Brak zapisanych operacji</div>
        ) : (
          <div className='divide-y'>
            {recentActivity.map((a, i) => (
              <div key={i} className='flex items-center gap-3 px-4 py-2.5'>
                <span className='text-lg leading-none shrink-0'>{a.icon}</span>
                <p className='flex-1 text-sm text-gray-800 truncate'>{a.label}</p>
                <span className='text-xs text-gray-400 shrink-0'>{relativeDate(a.date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
