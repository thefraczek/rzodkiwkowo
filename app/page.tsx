'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Folia, Zamowienie } from '@/lib/types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import MapView from '@/components/MapView'
import { parsePozycjeFromTyp, cratesFromPozycje, formatPozycje } from '@/lib/order-lines'

type Stats = { folie: number; zbiory_dzis: number; zbiory_tydzien: number; zamowienia: number; sianie: number }

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

export default function Home() {
  const [stats, setStats] = useState<Stats>({ folie: 0, zbiory_dzis: 0, zbiory_tydzien: 0, zamowienia: 0, sianie: 0 })
  const [folie, setFolie] = useState<Folia[]>([])
  const [nasiona, setNasiona] = useState<{ id: number; nazwa: string }[]>([])

  const [zbiorFolia, setZbiorFolia] = useState('')
  const [zbiorKlatki, setZbiorKlatki] = useState('')
  const [zbiorUwagi, setZbiorUwagi] = useState('')
  const [zbiorSaving, setZbiorSaving] = useState(false)

  const [sianieFolia, setSianieFolia] = useState('')
  const [sianieUwagi, setSianieUwagi] = useState('')
  const [sianieSaving, setSianieSaving] = useState(false)
  const [nasionaId, setNasionaId] = useState('')

  const [deliveryDate, setDeliveryDate] = useState(today)
  const [orders, setOrders] = useState<Zamowienie[]>([])
  const [issuedHistory, setIssuedHistory] = useState<Zamowienie[]>([])

  const [wydajOpen, setWydajOpen] = useState(false)
  const [wydajZam, setWydajZam] = useState<Zamowienie | null>(null)
  const [wydajPuste, setWydajPuste] = useState('0')
  const [wydajZaplacono, setWydajZaplacono] = useState('')

  async function load() {
    const [f, zd, zt, zam, s, n] = await Promise.all([
      supabase.from('folie').select('*').order('nazwa'),
      supabase.from('zbiory').select('id', { count: 'exact', head: true }).eq('data_zbioru', today),
      supabase.from('zbiory').select('id', { count: 'exact', head: true }).gte('data_zbioru', weekAgo),
      supabase.from('zamowienia').select('id', { count: 'exact', head: true }),
      supabase.from('sianie').select('id', { count: 'exact', head: true }),
      supabase.from('nasiona').select('*').order('nazwa'),
    ])

    setFolie((f.data as Folia[]) ?? [])
    setNasiona((n.data as { id: number; nazwa: string }[]) ?? [])
    setStats({
      folie: f.data?.length ?? 0,
      zbiory_dzis: zd.count ?? 0,
      zbiory_tydzien: zt.count ?? 0,
      zamowienia: zam.count ?? 0,
      sianie: s.count ?? 0,
    })
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

  useEffect(() => {
    load()
    loadOrders(today)
  }, [])

  useEffect(() => {
    loadOrders(deliveryDate)
  }, [deliveryDate])

  async function saveZbior() {
    if (!zbiorFolia || !zbiorKlatki) return
    setZbiorSaving(true)
    const { error } = await supabase.from('zbiory').insert({
      folia_id: Number(zbiorFolia),
      data_zbioru: today,
      ilosc_klatek: Number(zbiorKlatki),
      uwagi: zbiorUwagi || null,
    })
    setZbiorSaving(false)
    if (error) {
      toast.error('Błąd: ' + error.message)
      return
    }
    toast.success(`Zbiór — ${folie.find(f => f.id === Number(zbiorFolia))?.nazwa ?? ''} (${zbiorKlatki} kl.)`)
    setZbiorFolia('')
    setZbiorKlatki('')
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
  }

  async function cofnijWydanie(id: number) {
    if (!confirm('Cofnąć wydanie?')) return
    const { error } = await supabase
      .from('zamowienia')
      .update({ wydane: false, data_wydania: null, puste_zwrocono: 0, zaplacono_kwota: null })
      .eq('id', id)

    if (error) {
      toast.error('Błąd: ' + error.message)
      return
    }

    loadOrders(deliveryDate)
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

  const statCards = [
    { label: 'Folie', value: stats.folie, color: 'text-green-700', bg: 'bg-green-50 border-green-200', href: '/mapa' },
    { label: 'Zbiory dziś', value: stats.zbiory_dzis, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', href: '/zbiory' },
    { label: 'Zbiory (7 dni)', value: stats.zbiory_tydzien, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', href: '/zbiory' },
    { label: 'Zasiewy', value: stats.sianie, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', href: '/sianie' },
    { label: 'Zamówienia', value: stats.zamowienia, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', href: '/zamowienia' },
  ]

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-3 md:grid-cols-5 gap-2.5'>
        {statCards.map(c => (
          <a key={c.label} href={c.href} className={`border rounded-xl p-3 ${c.bg} hover:opacity-80 transition-opacity`}>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            <div className='text-xs text-gray-500 mt-0.5 leading-tight'>{c.label}</div>
          </a>
        ))}
      </div>

      <div className='bg-white border rounded-2xl overflow-hidden'>
        <div className='px-4 py-3 border-b bg-teal-50 flex items-center gap-3'>
          <span className='text-xl'>🚚</span>
          <div className='flex-1 min-w-0'>
            <h2 className='font-semibold text-gray-800'>Wydania na dzień</h2>
            <p className='text-xs text-teal-700 truncate'>
              {orders.length} zam. · {totalKlatek} kl. · {totalPeczkow} pęczków
            </p>
          </div>
          <Input type='date' value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className='w-auto h-9 text-sm border-teal-200 bg-white shrink-0' />
        </div>

        {orders.length === 0 ? (
          <div className='py-10 text-center text-gray-400 text-sm'>Brak zamówień na {deliveryDate === today ? 'dziś' : deliveryDate}</div>
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
                  <span className='text-xs text-green-600 font-medium shrink-0'>✓ wydane</span>
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
              <Label>Folia</Label>
              <Select value={zbiorFolia} onValueChange={v => setZbiorFolia(v ?? '')}>
                <SelectTrigger><SelectValue placeholder='Wybierz folię' /></SelectTrigger>
                <SelectContent>{folie.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.nazwa}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ilość klatek</Label>
              <Input type='number' min='0' value={zbiorKlatki} onChange={e => setZbiorKlatki(e.target.value)} placeholder='np. 12' onKeyDown={e => e.key === 'Enter' && saveZbior()} />
            </div>
            <div>
              <Label>Uwagi <span className='text-gray-400 font-normal'>(opcjonalnie)</span></Label>
              <Textarea value={zbiorUwagi} onChange={e => setZbiorUwagi(e.target.value)} rows={1} />
            </div>
            <Button className='w-full bg-orange-500 hover:bg-orange-600' onClick={saveZbior} disabled={!zbiorFolia || !zbiorKlatki || zbiorSaving}>Dodaj zbiór</Button>
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

      <div>
        <h2 className='font-semibold text-gray-800 mb-2'>Mapa folii</h2>
        <MapView />
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
    </div>
  )
}
