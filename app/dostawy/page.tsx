'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Zamowienie } from '@/lib/types'
import { parsePozycjeFromTyp, cratesFromPozycje, formatPozycje } from '@/lib/order-lines'

function odbiorcaName(o: any) {
  return o?.ksywa || [o?.imie, o?.nazwisko].filter(Boolean).join(' ') || '?'
}

function cratesForOrder(z: Zamowienie): number {
  return cratesFromPozycje(parsePozycjeFromTyp(z.typ, z.ilosc, z.ilosc_w_klatce))
}

export default function DostawyPage() {
  const [delivered, setDelivered] = useState<Zamowienie[]>([])

  async function load() {
    const { data } = await supabase
      .from('zamowienia')
      .select('*, odbiorcy(*)')
      .eq('wydane', true)
      .order('data_wydania', { ascending: false })
      .order('data_utworzenia', { ascending: false })
    setDelivered((data as Zamowienie[]) ?? [])
  }

  useEffect(() => { load() }, [])

  const balances = useMemo(() => {
    const map = new Map<number, {
      odbiorca_id: number
      nazwa: string
      klatki_wydane: number
      klatki_zwrocone: number
      suma_zaplacono: number
      suma_nalezna: number
    }>()

    for (const z of delivered) {
      if (!z.odbiorca_id) continue
      const prev = map.get(z.odbiorca_id) ?? {
        odbiorca_id: z.odbiorca_id,
        nazwa: odbiorcaName((z as any).odbiorcy),
        klatki_wydane: 0,
        klatki_zwrocone: 0,
        suma_zaplacono: 0,
        suma_nalezna: 0,
      }
      map.set(z.odbiorca_id, {
        ...prev,
        klatki_wydane: prev.klatki_wydane + cratesForOrder(z),
        klatki_zwrocone: prev.klatki_zwrocone + (z.puste_zwrocono ?? 0),
        suma_zaplacono: prev.suma_zaplacono + (z.zaplacono_kwota ?? 0),
        suma_nalezna: prev.suma_nalezna + (z.cena_calkowita ?? 0),
      })
    }

    return Array.from(map.values())
  }, [delivered])

  const byDate = useMemo(() => {
    return delivered.reduce<Record<string, Zamowienie[]>>((acc, z) => {
      const key = z.data_wydania ?? 'bez daty'
      if (!acc[key]) acc[key] = []
      acc[key].push(z)
      return acc
    }, {})
  }, [delivered])

  return (
    <div className='space-y-5'>
      <h1 className='text-xl font-bold text-gray-900'>Dostawy</h1>

      {balances.length > 0 && (
        <div>
          <h2 className='text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2'>Bilans skrzynek u klientów</h2>
          <div className='bg-white rounded-2xl border divide-y overflow-hidden'>
            {balances.map(b => {
              const diff = b.klatki_wydane - b.klatki_zwrocone
              return (
                <div key={b.odbiorca_id} className='flex items-center gap-3 px-4 py-3.5'>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                    diff > 0 ? 'bg-orange-100 text-orange-700' :
                    diff < 0 ? 'bg-blue-100 text-blue-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {diff === 0 ? '✓' : diff > 0 ? `+${diff}` : diff}
                  </div>
                  <div className='flex-1 min-w-0'>
                    <p className='font-semibold text-gray-900'>{b.nazwa}</p>
                    <p className='text-sm text-gray-500'>
                      {diff > 0 && `${diff} klatek do zwrotu`}
                      {diff < 0 && `Nadpłata ${Math.abs(diff)} klatek`}
                      {diff === 0 && 'Skrzynki rozliczone'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className='text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2'>Historia wydań</h2>
        {delivered.length === 0 && (
          <div className='bg-white rounded-2xl border py-12 text-center text-gray-400 text-sm'>
            Brak wydanych zamówień
          </div>
        )}

        {Object.entries(byDate).map(([date, items]) => (
          <div key={date} className='mb-3'>
            <p className='text-xs font-semibold text-gray-400 px-1 mb-1.5'>{date}</p>
            <div className='bg-white rounded-2xl border divide-y overflow-hidden'>
              {items.map(z => {
                const pozycje = parsePozycjeFromTyp(z.typ, z.ilosc, z.ilosc_w_klatce)
                return (
                  <div key={z.id} className='flex items-center gap-3 px-4 py-3.5'>
                    <div className='bg-teal-100 rounded-xl p-2.5 shrink-0'>
                      <span className='text-xl leading-none'>🚚</span>
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p className='font-semibold text-gray-900'>{odbiorcaName((z as any).odbiorcy)}</p>
                      <p className='text-sm text-gray-500'>
                        {formatPozycje(pozycje)} = {cratesForOrder(z)} kl.
                        <span className='text-gray-400'> · zwrócił {z.puste_zwrocono ?? 0} pustych</span>
                      </p>
                      {z.zaplacono_kwota != null && (
                        <p className='text-sm text-green-600 font-semibold mt-0.5'>{z.zaplacono_kwota} zł</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
