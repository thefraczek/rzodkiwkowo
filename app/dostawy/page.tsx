'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Zamowienie, Odbiorca } from '@/lib/types'

function odbiorcaName(o: any) {
  return o?.ksywa || [o?.imie, o?.nazwisko].filter(Boolean).join(' ') || '?'
}

type Balance = {
  odbiorca_id: number
  nazwa: string
  klatki_wydane: number
  klatki_zwrocone: number
  suma_zaplacono: number
  suma_nalezna: number
}

export default function DostawyPage() {
  const [delivered, setDelivered] = useState<Zamowienie[]>([])

  async function load() {
    const { data } = await supabase
      .from('zamowienia')
      .select('*, odbiorcy(imie, nazwisko, ksywa)')
      .eq('wydane', true)
      .order('data_wydania', { ascending: false })
      .order('created_at', { ascending: false })
    setDelivered(data ?? [])
  }

  useEffect(() => { load() }, [])

  // Bilans per odbiorca
  const balanceMap = new Map<number, Balance>()
  for (const z of delivered) {
    const oid = z.odbiorca_id
    if (!oid) continue
    const klatki = z.ilosc && z.ilosc_w_klatce ? Math.ceil(z.ilosc / z.ilosc_w_klatce) : 0
    const prev = balanceMap.get(oid) ?? {
      odbiorca_id: oid,
      nazwa: odbiorcaName((z as any).odbiorcy),
      klatki_wydane: 0, klatki_zwrocone: 0,
      suma_zaplacono: 0, suma_nalezna: 0,
    }
    balanceMap.set(oid, {
      ...prev,
      klatki_wydane: prev.klatki_wydane + klatki,
      klatki_zwrocone: prev.klatki_zwrocone + (z.puste_zwrocono ?? 0),
      suma_zaplacono: prev.suma_zaplacono + (z.zaplacono_kwota ?? 0),
      suma_nalezna: prev.suma_nalezna + (z.cena_calkowita ?? 0),
    })
  }
  const balances = Array.from(balanceMap.values()).filter(
    b => b.klatki_wydane - b.klatki_zwrocone !== 0 || b.suma_zaplacono > 0
  )

  // Grupowanie po dacie wydania
  const byDate = delivered.reduce<Record<string, Zamowienie[]>>((acc, z) => {
    const key = z.data_wydania ?? '—'
    if (!acc[key]) acc[key] = []
    acc[key].push(z)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Dostawy</h1>

      {/* Bilans skrzynek */}
      {balances.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Skrzynki u klientów</h2>
          <div className="bg-white rounded-2xl border divide-y overflow-hidden">
            {balances.map(b => {
              const diff = b.klatki_wydane - b.klatki_zwrocone
              return (
                <div key={b.odbiorca_id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                    diff > 0 ? 'bg-orange-100 text-orange-700' :
                    diff < 0 ? 'bg-blue-100 text-blue-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {diff === 0 ? '✓' : diff > 0 ? `+${diff}` : diff}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{b.nazwa}</p>
                    <p className="text-sm text-gray-500">
                      {diff > 0 && `${diff} klatek do zwrotu`}
                      {diff < 0 && `Nadpłata ${Math.abs(diff)} klatek`}
                      {diff === 0 && 'Skrzynki rozliczone'}
                    </p>
                  </div>
                  {b.suma_zaplacono > 0 && (
                    <span className="text-sm font-semibold text-green-700 shrink-0">{b.suma_zaplacono} zł</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Historia wydań */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Historia wydań</h2>
        {delivered.length === 0 && (
          <div className="bg-white rounded-2xl border py-12 text-center text-gray-400 text-sm">
            Brak wydanych zamówień
          </div>
        )}
        {Object.entries(byDate).map(([date, items]) => (
          <div key={date} className="mb-3">
            <p className="text-xs font-semibold text-gray-400 px-1 mb-1.5">{date}</p>
            <div className="bg-white rounded-2xl border divide-y overflow-hidden">
              {items.map(z => {
                const klatki = z.ilosc && z.ilosc_w_klatce ? Math.ceil(z.ilosc / z.ilosc_w_klatce) : null
                const roznica = z.zaplacono_kwota != null && z.cena_calkowita != null
                  ? z.zaplacono_kwota - z.cena_calkowita : null
                return (
                  <div key={z.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="bg-teal-100 rounded-xl p-2.5 shrink-0">
                      <span className="text-xl leading-none">🚚</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{odbiorcaName((z as any).odbiorcy)}</p>
                      <div className="flex flex-wrap gap-x-2 text-sm text-gray-500 mt-0.5">
                        {z.ilosc != null && <span>{z.ilosc} pęczków</span>}
                        {klatki && <span className="text-gray-400">· {klatki} kl.</span>}
                        {(z.puste_zwrocono ?? 0) > 0 && <span className="text-gray-400">· {z.puste_zwrocono} pustych</span>}
                      </div>
                      {z.zaplacono_kwota != null && (
                        <p className="text-sm mt-0.5">
                          <span className="text-green-600 font-semibold">{z.zaplacono_kwota} zł</span>
                          {roznica != null && roznica !== 0 && (
                            <span className={`text-xs ml-1.5 ${roznica < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                              ({roznica > 0 ? '+' : ''}{roznica} zł vs {z.cena_calkowita} zł)
                            </span>
                          )}
                        </p>
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
