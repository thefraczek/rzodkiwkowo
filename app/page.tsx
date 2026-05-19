'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Folia, Odbiorca, Zamowienie } from '@/lib/types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import MapView from '@/components/MapView'
import { parsePozycjeFromTyp, cratesFromPozycje, formatPozycje, serializePozycje } from '@/lib/order-lines'
import { formatDatePL } from '@/lib/date'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus'

type UpcomingSummary = { date: string; jedynka: number; dwojka: number; ordersCount: number } | null

const today = new Date().toISOString().slice(0, 10)
const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

function odbiorcaName(o: any) {
  return o?.ksywa || [o?.imie, o?.nazwisko].filter(Boolean).join(' ') || '?'
}

function cratesForOrder(z: Zamowienie): number {
  return cratesFromPozycje(parsePozycjeFromTyp(z.typ, z.ilosc, z.ilosc_w_klatce))
}

function peczkiForOrder(z: Zamowienie): number {
  if (z.ilosc != null) return z.ilosc
  const crates = cratesForOrder(z)
  const pwk = z.ilosc_w_klatce ?? 25
  return crates * pwk
}

function formatDateWithWeekdayPL(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, day || 1)
  const weekday = new Intl.DateTimeFormat('pl-PL', { weekday: 'long' }).format(date)
  return `${weekday}, ${formatDatePL(value)}`
}

export default function Home() {
  const [folie, setFolie] = useState<Folia[]>([])
  const [nasiona, setNasiona] = useState<{ id: number; nazwa: string }[]>([])
  const [odbiorcy, setOdbiorcy] = useState<Odbiorca[]>([])
  const [upcomingSummary, setUpcomingSummary] = useState<UpcomingSummary>(null)

  const [quickOrderOpen, setQuickOrderOpen] = useState(false)
  const [quickOrderSaving, setQuickOrderSaving] = useState(false)
  const [quickOrder, setQuickOrder] = useState({
    odbiorca_id: '',
    data_na_kiedy: today,
    jedynka_klatki: '',
    dwojka_klatki: '0',
    peczkow_w_klatce: '25',
    uwagi: '',
  })

  const [zbiorFolia, setZbiorFolia] = useState('')
  const [zbiorJedynka, setZbiorJedynka] = useState('')
  const [zbiorDwojka, setZbiorDwojka] = useState('')
  const [zbiorPeczkowWKlatce, setZbiorPeczkowWKlatce] = useState('25')
  const [zbiorUwagi, setZbiorUwagi] = useState('')
  const [zbiorSaving, setZbiorSaving] = useState(false)

  const [sianieFolia, setSianieFolia] = useState('')
  const [sianieUwagi, setSianieUwagi] = useState('')
  const [sianieSaving, setSianieSaving] = useState(false)
  const [nasionaId, setNasionaId] = useState('')

  const [deliveryDate, setDeliveryDate] = useState(today)
  const [mapZoom, setMapZoom] = useState(1)
  const [orders, setOrders] = useState<Zamowienie[]>([])
  const [issuedHistory, setIssuedHistory] = useState<Zamowienie[]>([])

  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null)
  const [confirmMessage, setConfirmMessage] = useState('')
  const [wydajOpen, setWydajOpen] = useState(false)
  const [wydajZam, setWydajZam] = useState<Zamowienie | null>(null)
  const [wydajPuste, setWydajPuste] = useState('0')
  const [wydajZaplacono, setWydajZaplacono] = useState('')

  async function load() {
    const [f, n, o, s] = await Promise.all([
      supabase.from('folie').select('*').order('nazwa'),
      supabase.from('nasiona').select('*').order('nazwa'),
      supabase.from('odbiorcy').select('*').eq('archived', false).order('ksywa'),
      supabase.from('sianie').select('folia_id, data').order('data', { ascending: true }),
    ])

    const rawFolie = (f.data as Folia[]) ?? []
    const oldestSowing = new Map<number, string>()
    for (const row of s.data ?? []) {
      if (row.folia_id && !oldestSowing.has(row.folia_id)) oldestSowing.set(row.folia_id, row.data)
    }
    const sortedFolie = [...rawFolie].sort((a, b) => {
      const aD = oldestSowing.get(a.id)
      const bD = oldestSowing.get(b.id)
      if (aD && bD) return aD.localeCompare(bD)
      if (aD) return -1
      if (bD) return 1
      return 0
    })

    setFolie(sortedFolie)
    setNasiona((n.data as { id: number; nazwa: string }[]) ?? [])
    setOdbiorcy((o.data as Odbiorca[]) ?? [])
  }

  async function loadOrders(date: string) {
    const [byDate, issued] = await Promise.all([
      supabase.from('zamowienia').select('*, odbiorcy(*)').eq('data_na_kiedy', date).order('data_utworzenia', { ascending: true }),
      supabase.from('zamowienia').select('*, odbiorcy(*)').eq('wydane', true).order('data_wydania', { ascending: false }),
    ])

    if (byDate.error) {
      console.error('loadOrders error:', byDate.error)
      toast.error('Błąd wczytywania zamówień: ' + byDate.error.message)
    }

    setOrders((byDate.data as Zamowienie[]) ?? [])
    setIssuedHistory((issued.data as Zamowienie[]) ?? [])
  }

  async function loadUpcomingSummary() {
    const { data, error } = await supabase
      .from('zamowienia')
      .select('*')
      .gte('data_na_kiedy', today)
      .order('data_na_kiedy', { ascending: true })
      .order('data_utworzenia', { ascending: true })

    if (error) {
      toast.error('Błąd podsumowania zamówień: ' + error.message)
      return
    }

    const pending = ((data as Zamowienie[]) ?? []).filter(z => !z.wydane && !!z.data_na_kiedy)
    if (!pending.length) {
      setUpcomingSummary(null)
      return
    }

    const nearestDate = pending[0].data_na_kiedy!
    const sameDate = pending.filter(z => z.data_na_kiedy === nearestDate)

    const summary = sameDate.reduce(
      (acc, z) => {
        const pozycje = parsePozycjeFromTyp(z.typ, z.ilosc, z.ilosc_w_klatce)
        for (const p of pozycje) {
          if (p.typ === 'dwojka') acc.dwojka += p.klatki
          else acc.jedynka += p.klatki
        }
        acc.ordersCount += 1
        return acc
      },
      { date: nearestDate, jedynka: 0, dwojka: 0, ordersCount: 0 }
    )

    setUpcomingSummary(summary)
  }

  useEffect(() => {
    load()
    loadOrders(today)
    loadUpcomingSummary()
  }, [])
  useRefreshOnFocus(load)

  useEffect(() => {
    loadOrders(deliveryDate)
  }, [deliveryDate])

  function resetQuickOrder() {
    setQuickOrder({
      odbiorca_id: '',
      data_na_kiedy: today,
      jedynka_klatki: '',
      dwojka_klatki: '0',
      peczkow_w_klatce: '25',
      uwagi: '',
    })
  }

  async function saveQuickOrder() {
    const jedynka = Number(quickOrder.jedynka_klatki) || 0
    const dwojka = Number(quickOrder.dwojka_klatki) || 0
    const pwk = Number(quickOrder.peczkow_w_klatce) || 25
    const pozycje = [
      { typ: 'jedynka' as const, klatki: jedynka },
      { typ: 'dwojka' as const, klatki: dwojka },
    ].filter(p => p.klatki > 0)

    if (!quickOrder.odbiorca_id || pozycje.length === 0) {
      toast.error('Wybierz odbiorcę i wpisz liczbę klatek')
      return
    }

    const totalKlatek = pozycje.reduce((sum, p) => sum + p.klatki, 0)
    const totalPeczkow = totalKlatek * pwk

    setQuickOrderSaving(true)
    const { error } = await supabase.from('zamowienia').insert({
      odbiorca_id: Number(quickOrder.odbiorca_id),
      data_na_kiedy: quickOrder.data_na_kiedy || null,
      ilosc: totalPeczkow,
      ilosc_w_klatce: pwk,
      typ: serializePozycje(pozycje),
      cena_za_peczek: null,
      cena_calkowita: null,
      uwagi: quickOrder.uwagi || null,
    })
    setQuickOrderSaving(false)

    if (error) {
      toast.error('Błąd: ' + error.message)
      return
    }

    toast.success('Zamówienie dodane')
    setQuickOrderOpen(false)
    resetQuickOrder()
    load()
    loadOrders(deliveryDate)
    loadUpcomingSummary()
  }

  async function saveZbior() {
    const j = Number(zbiorJedynka) || 0
    const d = Number(zbiorDwojka) || 0
    if (j === 0 && d === 0) return
    const pwk = Number(zbiorPeczkowWKlatce) || 25
    const base = { folia_id: zbiorFolia ? Number(zbiorFolia) : null, data_zbioru: today, ilosc_w_klatce: pwk, uwagi: zbiorUwagi || null }
    const records: object[] = []
    if (j > 0) records.push({ ...base, typ: 'jedynka', ilosc_klatek: j })
    if (d > 0) records.push({ ...base, typ: 'dwojka', ilosc_klatek: d })
    setZbiorSaving(true)
    const { error } = await supabase.from('zbiory').insert(records)
    setZbiorSaving(false)
    if (error) { toast.error('Błąd: ' + error.message); return }
    const nazwa = zbiorFolia ? (folie.find(f => f.id === Number(zbiorFolia))?.nazwa ?? '') : ''
    toast.success(`Zbiór${nazwa ? ` — ${nazwa}` : ''} (${j + d} kl.)`)
    setZbiorFolia('')
    setZbiorJedynka('')
    setZbiorDwojka('')
    setZbiorPeczkowWKlatce('25')
    setZbiorUwagi('')
    load()
  }

  async function saveSianie() {
    if (!sianieFolia) return
    setSianieSaving(true)
    const { error } = await supabase.from('sianie').insert({
      folia_id: Number(sianieFolia),
      nasiona_id: nasionaId ? Number(nasionaId) : null,
      data: today,
      uwagi: sianieUwagi || null,
    })
    setSianieSaving(false)
    if (error) {
      toast.error('Błąd: ' + error.message)
      return
    }
    toast.success(`Zasiew — ${folie.find(f => f.id === Number(sianieFolia))?.nazwa ?? ''}`)
    setSianieFolia('')
    setNasionaId('')
    setSianieUwagi('')
    load()
  }

  function openWydaj(z: Zamowienie) {
    setWydajZam(z)
    setWydajPuste(String(z.puste_zwrocono ?? 0))
    setWydajZaplacono(String(z.zaplacono_kwota ?? z.cena_calkowita ?? ''))
    setWydajOpen(true)
  }

  async function saveWydanie() {
    if (!wydajZam) return
    const { error } = await supabase
      .from('zamowienia')
      .update({
        wydane: true,
        data_wydania: deliveryDate,
        puste_zwrocono: Number(wydajPuste) || 0,
        zaplacono_kwota: wydajZaplacono ? Number(wydajZaplacono) : null,
      })
      .eq('id', wydajZam.id)

    if (error) {
      toast.error('Błąd: ' + error.message)
      return
    }

    toast.success(`Wydano — ${odbiorcaName((wydajZam as any).odbiorcy)}`)
    setWydajOpen(false)
    loadOrders(deliveryDate)
    loadUpcomingSummary()
  }

  function cofnijWydanie(id: number) {
    setConfirmMessage('Cofnąć oznaczenie wydania? Zamówienie wróci do listy oczekujących.')
    setConfirmAction(() => async () => {
      const { error } = await supabase
        .from('zamowienia')
        .update({ wydane: false, data_wydania: null, puste_zwrocono: 0, zaplacono_kwota: null })
        .eq('id', id)
      if (error) { toast.error('Błąd: ' + error.message); return }
      loadOrders(deliveryDate)
      loadUpcomingSummary()
    })
  }

  const pending = useMemo(() => orders.filter(z => !z.wydane), [orders])
  const done = useMemo(() => orders.filter(z => z.wydane), [orders])

  const balanceByOdbiorca = useMemo(() => {
    const map = new Map<number, number>()
    for (const z of issuedHistory) {
      if (!z.odbiorca_id) continue
      const sent = cratesForOrder(z)
      const returned = z.puste_zwrocono ?? 0
      map.set(z.odbiorca_id, (map.get(z.odbiorca_id) ?? 0) + (sent - returned))
    }
    return map
  }, [issuedHistory])

  const totalKlatek = useMemo(() => orders.reduce((s, z) => s + cratesForOrder(z), 0), [orders])
  const totalPeczkow = useMemo(() => orders.reduce((s, z) => s + peczkiForOrder(z), 0), [orders])

  return (
    <div className='space-y-5'>
      <div className='flex items-center justify-between gap-3'>
        <div>
          <h1 className='text-xl font-bold text-gray-900'>Pulpit</h1>
          <p className='text-xs text-gray-500'>Działania na dziś</p>
        </div>
        <Button size='sm' className='shrink-0 bg-purple-600 hover:bg-purple-700' onClick={() => { resetQuickOrder(); setQuickOrderOpen(true) }}>
          + Zamówienie
        </Button>
      </div>

      <div className='bg-white border rounded-2xl overflow-hidden'>
        <div className='px-3 py-2 flex items-center gap-2 border-b'>
          <h2 className='font-semibold text-gray-800 text-sm flex-1'>Folie</h2>
          <button
            onClick={() => setMapZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))}
            className='w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 active:bg-gray-100 text-base font-bold leading-none transition-colors'
          >+</button>
          <button
            onClick={() => setMapZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            className='w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 active:bg-gray-100 text-base font-bold leading-none transition-colors'
          >−</button>
        </div>
        <MapView zoom={mapZoom} />
      </div>

      <div className='bg-white border rounded-2xl overflow-hidden'>
        <div className='px-4 py-3 border-b bg-purple-50 flex items-center gap-3'>
          <span className='text-xl'>📦</span>
          <div className='flex-1 min-w-0'>
            <h2 className='font-semibold text-gray-800'>Najbliższe zamówienie</h2>
            <p className='text-xs text-purple-700 truncate'>
              {upcomingSummary ? formatDateWithWeekdayPL(upcomingSummary.date) : 'Brak zaplanowanych zamówień'}
            </p>
          </div>
        </div>

        {upcomingSummary ? (
          <div className='px-4 py-4 grid grid-cols-3 gap-3'>
            <div className='rounded-xl bg-orange-50 border border-orange-200 px-3 py-3'>
              <p className='text-xs text-orange-700'>Jedynka</p>
              <p className='text-2xl font-bold text-orange-800'>{upcomingSummary.jedynka}</p>
              <p className='text-xs text-orange-600'>klatek</p>
            </div>
            <div className='rounded-xl bg-amber-50 border border-amber-200 px-3 py-3'>
              <p className='text-xs text-amber-700'>Dwójka</p>
              <p className='text-2xl font-bold text-amber-800'>{upcomingSummary.dwojka}</p>
              <p className='text-xs text-amber-600'>klatek</p>
            </div>
            <div className='rounded-xl bg-purple-50 border border-purple-200 px-3 py-3'>
              <p className='text-xs text-purple-700'>Odbiory</p>
              <p className='text-2xl font-bold text-purple-800'>{upcomingSummary.ordersCount}</p>
              <p className='text-xs text-purple-600'>zamówień</p>
            </div>
          </div>
        ) : (
          <div className='py-10 text-center text-gray-400 text-sm'>Brak przyszłych zamówień</div>
        )}
      </div>

      <div className='bg-white border rounded-2xl overflow-hidden'>
        <div className='px-4 py-3 border-b bg-teal-50'>
          <div className='flex items-center gap-2 mb-1'>
            <span className='text-xl shrink-0'>🚚</span>
            <h2 className='font-semibold text-gray-800'>Wydania na dzień</h2>
          </div>
          <div className='flex items-center justify-between gap-2'>
            <p className='text-xs text-teal-700 truncate flex-1'>
              {orders.length} zam. · {totalKlatek} kl. · {totalPeczkow} pęczków
            </p>
            <Input type='date' value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className='shrink-0 w-[130px] h-7 text-[11px] border-teal-200 bg-white px-2' />
          </div>
        </div>

        {orders.length === 0 ? (
          <div className='py-10 text-center text-gray-400 text-sm'>Brak zamówień na {deliveryDate === today ? 'dziś' : formatDatePL(deliveryDate)}</div>
        ) : (
          <>
            {pending.map(z => {
              const pozycje = parsePozycjeFromTyp(z.typ, z.ilosc, z.ilosc_w_klatce)
              const crates = cratesFromPozycje(pozycje)
              const debt = z.odbiorca_id ? (balanceByOdbiorca.get(z.odbiorca_id) ?? 0) : 0
              return (
                <div key={z.id} className='flex items-center gap-3 px-4 py-4 border-b last:border-0'>
                  <button onClick={() => openWydaj(z)} className='w-7 h-7 rounded-lg border-2 border-gray-300 flex items-center justify-center shrink-0 active:bg-gray-100' />
                  <div className='flex-1 min-w-0'>
                    <p className='font-semibold text-gray-900 leading-tight'>{odbiorcaName((z as any).odbiorcy)}</p>
                    <p className='text-sm text-gray-500 mt-0.5'>{formatPozycje(pozycje)} = <span className='font-medium text-gray-700'>{crates} kl.</span></p>
                    {z.cena_calkowita != null && <p className='text-sm text-gray-500'>do zapłaty: <span className='font-semibold text-gray-800'>{z.cena_calkowita} zł</span></p>}
                    {debt > 0 && <p className='text-xs text-orange-600 mt-0.5'>Aktualnie wisi: {debt} klatek</p>}
                  </div>
                  <Button size='sm' className='bg-teal-600 hover:bg-teal-700 shrink-0' onClick={() => openWydaj(z)}>Wydaj</Button>
                </div>
              )
            })}

            {done.map(z => {
              const crates = cratesForOrder(z)
              return (
                <div key={z.id} className='flex items-center gap-3 px-4 py-4 border-b last:border-0 bg-green-50/50'>
                  <button onClick={() => cofnijWydanie(z.id)} className='w-7 h-7 rounded-lg bg-green-500 flex items-center justify-center shrink-0 active:bg-green-600'>
                    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='3'><polyline points='20 6 9 17 4 12' /></svg>
                  </button>
                  <div className='flex-1 min-w-0'>
                    <p className='font-semibold text-gray-600 leading-tight'>{odbiorcaName((z as any).odbiorcy)}</p>
                    <p className='text-sm text-gray-500 mt-0.5'>
                      {crates} kl. · zwrócił {z.puste_zwrocono ?? 0} pustych
                      {z.zaplacono_kwota != null && <span className='text-green-600 font-semibold'> · {z.zaplacono_kwota} zł</span>}
                    </p>
                  </div>
                  <div className='flex items-center gap-2 shrink-0'>
                    <button onClick={() => openWydaj(z)} className='px-3 py-1.5 rounded-lg text-xs font-medium text-teal-700 bg-teal-100 hover:bg-teal-200 transition-colors'>
                      Edytuj
                    </button>
                    <span className='text-xs text-green-600 font-medium'>✓ wydane</span>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div className='bg-white border rounded-2xl p-4'>
          <h2 className='font-semibold text-gray-800 mb-3 flex items-center gap-2'><span>🥕</span> Szybki zbiór — dziś</h2>
          <div className='space-y-3'>
            <div>
              <Label>Folia <span className='text-gray-400 font-normal'>(opcjonalnie)</span></Label>
              <Select value={zbiorFolia} onValueChange={v => setZbiorFolia(v ?? '')}>
                <SelectTrigger><SelectValue placeholder='Wybierz folię' /></SelectTrigger>
                <SelectContent>{folie.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.nazwa}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <Label>Jedynka (klatki)</Label>
                <Input type='number' inputMode='numeric' min='0' value={zbiorJedynka} onChange={e => setZbiorJedynka(e.target.value)} placeholder='0' />
              </div>
              <div>
                <Label>Dwójka (klatki)</Label>
                <Input type='number' inputMode='numeric' min='0' value={zbiorDwojka} onChange={e => setZbiorDwojka(e.target.value)} placeholder='0' />
              </div>
            </div>
            <div>
              <Label>Pęczków w klatce</Label>
              <Input type='number' min='1' value={zbiorPeczkowWKlatce} onChange={e => setZbiorPeczkowWKlatce(e.target.value)} placeholder='25' />
            </div>
            <div>
              <Label>Uwagi <span className='text-gray-400 font-normal'>(opcjonalnie)</span></Label>
              <Textarea value={zbiorUwagi} onChange={e => setZbiorUwagi(e.target.value)} rows={1} />
            </div>
            <Button className='w-full bg-orange-500 hover:bg-orange-600' onClick={saveZbior} disabled={(Number(zbiorJedynka) === 0 && Number(zbiorDwojka) === 0) || zbiorSaving}>Dodaj zbiór</Button>
          </div>
        </div>

        <div className='bg-white border rounded-2xl p-4'>
          <h2 className='font-semibold text-gray-800 mb-3 flex items-center gap-2'><span>🌱</span> Szybki zasiew — dziś</h2>
          <div className='space-y-3'>
            <div>
              <Label>Folia</Label>
              <Select value={sianieFolia} onValueChange={v => setSianieFolia(v ?? '')}>
                <SelectTrigger><SelectValue placeholder='Wybierz folię' /></SelectTrigger>
                <SelectContent>{folie.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.nazwa}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nasiona <span className='text-gray-400 font-normal'>(opcjonalnie)</span></Label>
              <Select value={nasionaId} onValueChange={v => setNasionaId(v ?? '')}>
                <SelectTrigger><SelectValue placeholder='Wybierz nasiona' /></SelectTrigger>
                <SelectContent>{nasiona.map(n => <SelectItem key={n.id} value={String(n.id)}>{n.nazwa}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Uwagi <span className='text-gray-400 font-normal'>(opcjonalnie)</span></Label>
              <Textarea value={sianieUwagi} onChange={e => setSianieUwagi(e.target.value)} rows={1} />
            </div>
            <Button className='w-full bg-green-600 hover:bg-green-700' onClick={saveSianie} disabled={!sianieFolia || sianieSaving}>Dodaj zasiew</Button>
          </div>
        </div>
      </div>

      <Dialog open={wydajOpen} onOpenChange={setWydajOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wydaj — {wydajZam ? odbiorcaName((wydajZam as any).odbiorcy) : ''}</DialogTitle>
          </DialogHeader>

          {wydajZam && (
            <div className='space-y-4 mt-1'>
              <div className='bg-gray-50 rounded-xl px-4 py-3 space-y-1.5'>
                <p className='text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2'>Zamówienie</p>
                <div className='flex justify-between text-sm'>
                  <span className='text-gray-500'>Pozycje</span>
                  <span className='font-semibold'>{formatPozycje(parsePozycjeFromTyp(wydajZam.typ, wydajZam.ilosc, wydajZam.ilosc_w_klatce))}</span>
                </div>
                <div className='flex justify-between text-sm'>
                  <span className='text-gray-500'>Razem klatek</span>
                  <span className='font-semibold'>{cratesForOrder(wydajZam)}</span>
                </div>
                {wydajZam.cena_calkowita != null && (
                  <div className='flex justify-between text-sm border-t pt-1.5 mt-1'>
                    <span className='text-gray-500'>Do zapłaty</span>
                    <span className='font-bold text-lg'>{wydajZam.cena_calkowita} zł</span>
                  </div>
                )}
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <Label>Pustych zwrócono</Label>
                  <Input type='number' min='0' value={wydajPuste} onChange={e => setWydajPuste(e.target.value)} autoFocus />
                </div>
                <div>
                  <Label>Zapłacono (zł)</Label>
                  <Input type='number' min='0' step='0.01' value={wydajZaplacono} onChange={e => setWydajZaplacono(e.target.value)} />
                </div>
              </div>

              <div className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
                cratesForOrder(wydajZam) - Number(wydajPuste || 0) > 0
                  ? 'bg-orange-50 border border-orange-200 text-orange-700'
                  : 'bg-green-50 border border-green-200 text-green-700'
              }`}>
                {cratesForOrder(wydajZam) - Number(wydajPuste || 0)} klatek zostaje u klienta po tej dostawie
              </div>

              <div className='flex gap-2 pt-1'>
                <Button variant='outline' onClick={() => setWydajOpen(false)} className='flex-1'>Anuluj</Button>
                <Button onClick={saveWydanie} className='flex-1 bg-teal-600 hover:bg-teal-700'>✓ Potwierdź wydanie</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={quickOrderOpen} onOpenChange={setQuickOrderOpen}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>Nowe zamówienie</DialogTitle>
          </DialogHeader>

          <div className='space-y-3 mt-2'>
            <div>
              <Label>Odbiorca</Label>
              <Select value={quickOrder.odbiorca_id} onValueChange={v => setQuickOrder(p => ({ ...p, odbiorca_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder='Wybierz odbiorcę' /></SelectTrigger>
                <SelectContent>
                  {odbiorcy.map(o => <SelectItem key={o.id} value={String(o.id)}>{odbiorcaName(o)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data na kiedy</Label>
              <Input type='date' value={quickOrder.data_na_kiedy} onChange={e => setQuickOrder(p => ({ ...p, data_na_kiedy: e.target.value }))} />
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div>
                <Label>Jedynka (duża)</Label>
                <Input type='number' min='0' value={quickOrder.jedynka_klatki} onChange={e => setQuickOrder(p => ({ ...p, jedynka_klatki: e.target.value }))} placeholder='np. 37' />
              </div>
              <div>
                <Label>Dwójka (mała)</Label>
                <Input type='number' min='0' value={quickOrder.dwojka_klatki} onChange={e => setQuickOrder(p => ({ ...p, dwojka_klatki: e.target.value }))} placeholder='0' />
              </div>
            </div>

            <div>
              <Label>Pęczków w klatce</Label>
              <Input type='number' min='1' value={quickOrder.peczkow_w_klatce} onChange={e => setQuickOrder(p => ({ ...p, peczkow_w_klatce: e.target.value }))} />
            </div>

            <div>
              <Label>Uwagi</Label>
              <Textarea value={quickOrder.uwagi} onChange={e => setQuickOrder(p => ({ ...p, uwagi: e.target.value }))} rows={2} />
            </div>

            <div className='flex gap-2 pt-1'>
              <Button variant='outline' onClick={() => setQuickOrderOpen(false)} className='flex-1'>Anuluj</Button>
              <Button onClick={saveQuickOrder} disabled={quickOrderSaving} className='flex-1 bg-purple-600 hover:bg-purple-700'>Zapisz</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmAction}
        message={confirmMessage || undefined}
        confirmLabel='Cofnij'
        onConfirm={async () => { await confirmAction?.(); setConfirmAction(null) }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}
