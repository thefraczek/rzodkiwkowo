'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Zmiana = { od: string; do: string; liczba: string }

// liczba godzin miedzy "HH:MM" a "HH:MM" (ten sam dzien)
function godziny(od: string, doo: string): number {
  if (!od || !doo) return 0
  const [oh, om] = od.split(':').map(Number)
  const [dh, dm] = doo.split(':').map(Number)
  if ([oh, om, dh, dm].some(n => Number.isNaN(n))) return 0
  const mins = (dh * 60 + dm) - (oh * 60 + om)
  return mins > 0 ? mins / 60 : 0
}

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (n: number) => n.toLocaleString('pl-PL', { maximumFractionDigits: 1 })
function hm(h: number): string {
  const t = Math.max(0, Math.round(h * 60))
  return `${Math.floor(t / 60)}h ${pad(t % 60)}min`
}

export default function TempoPage() {
  const [tryb, setTryb] = useState<'podsumowanie' | 'live'>('podsumowanie')
  const [zmiany, setZmiany] = useState<Zmiana[]>([{ od: '06:00', do: '11:00', liczba: '2' }])
  const [jednostka, setJednostka] = useState<'peczki' | 'klatki'>('klatki')
  const [ile, setIle] = useState('')
  const [wKlatce, setWKlatce] = useState('25')
  const [now, setNow] = useState<Date>(() => new Date())
  const [planKoniec, setPlanKoniec] = useState('')

  // w trybie live zegar tyka -> czas/roboczogodziny rosna same
  useEffect(() => {
    if (tryb !== 'live') return
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 20000)
    return () => clearInterval(id)
  }, [tryb])

  const nowHHMM = `${pad(now.getHours())}:${pad(now.getMinutes())}`

  // w live ostatnia zmiana konczy sie "teraz"
  const segs = tryb === 'live'
    ? zmiany.map((z, i) => (i === zmiany.length - 1 ? { ...z, do: nowHHMM } : z))
    : zmiany

  const peczki = jednostka === 'peczki'
    ? (Number(ile) || 0)
    : (Number(ile) || 0) * (Number(wKlatce) || 0)

  const czasPracy = segs.reduce((s, z) => s + godziny(z.od, z.do), 0)
  const roboczogodziny = segs.reduce((s, z) => s + godziny(z.od, z.do) * (Number(z.liczba) || 0), 0)
  const peczkiNaGodzine = czasPracy > 0 ? peczki / czasPracy : 0
  const peczkiNaOsobeGodzine = roboczogodziny > 0 ? peczki / roboczogodziny : 0
  const gotowe = peczki > 0 && roboczogodziny > 0

  // prognoza (live)
  const aktualnaObsada = Number(zmiany[zmiany.length - 1]?.liczba) || 0
  const pozostaloH = tryb === 'live' && planKoniec ? godziny(nowHHMM, planKoniec) : 0
  const prognozaPeczki = gotowe && pozostaloH > 0
    ? peczki + peczkiNaOsobeGodzine * aktualnaObsada * pozostaloH
    : 0

  function setZ(i: number, patch: Partial<Zmiana>) {
    setZmiany(zs => zs.map((z, idx) => (idx === i ? { ...z, ...patch } : z)))
  }
  function dodaj() {
    const ostatnia = zmiany[zmiany.length - 1]
    setZmiany(zs => [...zs, { od: ostatnia?.do || '', do: '', liczba: ostatnia?.liczba || '1' }])
  }
  function zmianaObsadyTeraz() {
    setZmiany(zs => {
      const domkniete = zs.map((z, i) => (i === zs.length - 1 ? { ...z, do: nowHHMM } : z))
      const ost = zs[zs.length - 1]
      return [...domkniete, { od: nowHHMM, do: '', liczba: ost?.liczba || '1' }]
    })
  }
  function usun(i: number) {
    setZmiany(zs => zs.filter((_, idx) => idx !== i))
  }

  const staty = (
    <div className='grid grid-cols-3 gap-2 text-center'>
      <div className='bg-white rounded-xl py-2.5 border'>
        <p className='text-lg font-bold text-gray-900'>{fmt(peczkiNaGodzine)}</p>
        <p className='text-[11px] text-gray-400 leading-tight'>pęcz./godz.<br />(ekipa)</p>
      </div>
      <div className='bg-white rounded-xl py-2.5 border'>
        <p className='text-lg font-bold text-gray-900'>{fmt(roboczogodziny)}</p>
        <p className='text-[11px] text-gray-400 leading-tight'>roboczo-<br />godzin</p>
      </div>
      <div className='bg-white rounded-xl py-2.5 border'>
        <p className='text-lg font-bold text-gray-900'>{hm(czasPracy)}</p>
        <p className='text-[11px] text-gray-400 leading-tight'>czas<br />pracy</p>
      </div>
    </div>
  )

  return (
    <div>
      <h1 className='text-xl font-bold text-gray-900 mb-1'>Tempo rwania</h1>
      <p className='text-sm text-gray-400 mb-4'>Ile pęczków na osobę/godzinę przy zmiennej obsadzie.</p>

      {/* tryb */}
      <div className='flex gap-2 mb-4'>
        {(['podsumowanie', 'live'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTryb(t)}
            className={`flex-1 py-2 rounded-xl border-2 text-sm font-semibold transition-colors ${tryb === t ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 active:bg-gray-50'}`}
          >
            {t === 'podsumowanie' ? '📋 Podsumowanie' : '🔴 Na żywo'}
          </button>
        ))}
      </div>

      {/* live: panel "na teraz" */}
      {tryb === 'live' && (
        <div className='bg-green-600 text-white rounded-2xl p-4 mb-4'>
          <div className='flex justify-between items-start gap-3'>
            <div className='min-w-0'>
              <p className='text-xs uppercase tracking-wider text-green-100'>Na żywo · teraz {nowHHMM}</p>
              <div className='flex items-end gap-2 mt-2'>
                <span className='text-4xl font-bold leading-none'>{gotowe ? fmt(peczkiNaOsobeGodzine) : '—'}</span>
                <span className='text-sm text-green-100 mb-0.5'>pęcz./os./godz.</span>
              </div>
            </div>
            <div className='text-right text-sm text-green-100 shrink-0'>
              <p>od {zmiany[0]?.od || '—'}</p>
              <p className='font-semibold text-white'>{hm(czasPracy)}</p>
            </div>
          </div>
        </div>
      )}

      {/* obsada w czasie */}
      <p className='text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2'>Obsada w czasie</p>
      <div className='bg-white rounded-2xl border divide-y overflow-hidden mb-3'>
        {zmiany.map((z, i) => {
          const live = tryb === 'live' && i === zmiany.length - 1
          return (
            <div key={i} className='flex items-center gap-2 px-3 py-3'>
              <Input type='time' value={z.od} onChange={e => setZ(i, { od: e.target.value })} className='flex-1 min-w-0' />
              <span className='text-gray-400 shrink-0'>–</span>
              {live ? (
                <span className='flex-1 min-w-0 text-center text-sm font-medium text-green-600'>teraz</span>
              ) : (
                <Input type='time' value={z.do} onChange={e => setZ(i, { do: e.target.value })} className='flex-1 min-w-0' />
              )}
              <Input
                type='number'
                inputMode='numeric'
                min='0'
                value={z.liczba}
                onChange={e => setZ(i, { liczba: e.target.value })}
                className='w-14 text-center shrink-0'
                aria-label='Liczba osób'
              />
              <span className='text-sm text-gray-400 shrink-0'>os.</span>
              <button
                onClick={() => usun(i)}
                disabled={zmiany.length === 1}
                aria-label='Usuń zmianę'
                className='p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors shrink-0'
              >
                <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><polyline points='3 6 5 6 21 6' /><path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' /></svg>
              </button>
            </div>
          )
        })}
      </div>
      {tryb === 'live' ? (
        <Button variant='outline' size='sm' onClick={zmianaObsadyTeraz} className='mb-5'>+ Zmiana obsady (teraz)</Button>
      ) : (
        <Button variant='outline' size='sm' onClick={dodaj} className='mb-5'>+ Zmiana obsady</Button>
      )}

      {/* ile nazbierano */}
      <p className='text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2'>Nazbierano</p>
      <div className='bg-white rounded-2xl border p-4 mb-5 space-y-3'>
        <div className='flex gap-2'>
          {(['klatki', 'peczki'] as const).map(u => (
            <button
              key={u}
              onClick={() => setJednostka(u)}
              className={`flex-1 py-2 rounded-xl border-2 text-sm font-semibold transition-colors ${jednostka === u ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 active:bg-gray-50'}`}
            >
              {u === 'peczki' ? 'Pęczki' : 'Klatki'}
            </button>
          ))}
        </div>
        <div className='flex gap-3'>
          <div className='flex-1'>
            <Label>{jednostka === 'peczki' ? 'Liczba pęczków' : 'Liczba klatek'}</Label>
            <Input type='number' inputMode='numeric' min='0' value={ile} onChange={e => setIle(e.target.value)} placeholder='0' />
          </div>
          {jednostka === 'klatki' && (
            <div className='w-32'>
              <Label>Pęczków/klatkę</Label>
              <Input type='number' inputMode='numeric' min='0' value={wKlatce} onChange={e => setWKlatce(e.target.value)} placeholder='25' />
            </div>
          )}
        </div>
        {tryb === 'live' && (
          <div className='flex gap-2'>
            {['1', '5', '10'].map(d => (
              <button
                key={d}
                onClick={() => setIle(v => String((Number(v) || 0) + Number(d)))}
                className='flex-1 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 active:bg-gray-100 transition-colors'
              >
                +{d}
              </button>
            ))}
          </div>
        )}
        {jednostka === 'klatki' && peczki > 0 && (
          <p className='text-xs text-gray-400'>= {fmt(peczki)} pęczków</p>
        )}
      </div>

      {/* wynik */}
      {tryb === 'podsumowanie' ? (
        <div className='bg-green-50 border border-green-200 rounded-2xl p-4'>
          <p className='text-xs font-semibold text-green-600 uppercase tracking-wider mb-3'>Szybkość rwania</p>
          {gotowe ? (
            <>
              <div className='flex items-end gap-2 mb-4'>
                <span className='text-4xl font-bold text-green-700 leading-none'>{fmt(peczkiNaOsobeGodzine)}</span>
                <span className='text-sm text-green-600 mb-0.5'>pęczków / osobę / godz.</span>
              </div>
              {staty}
            </>
          ) : (
            <p className='text-sm text-green-700/70'>Uzupełnij obsadę i liczbę nazbieranych, aby zobaczyć tempo.</p>
          )}
        </div>
      ) : (
        <>
          {staty}
          {/* prognoza */}
          <div className='bg-white rounded-2xl border p-4 mt-3'>
            <p className='text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2'>Prognoza do końca</p>
            <div className='flex items-center gap-3'>
              <Label className='shrink-0 mb-0'>Planowany koniec</Label>
              <Input type='time' value={planKoniec} onChange={e => setPlanKoniec(e.target.value)} className='w-32' />
            </div>
            {prognozaPeczki > 0 ? (
              <p className='mt-3 text-sm text-gray-600'>
                W tym tempie, przy <b>{aktualnaObsada} os.</b>, do <b>{planKoniec}</b> uzbiera się ok.{' '}
                <span className='font-bold text-green-700'>{fmt(prognozaPeczki)} pęczków</span>
                {jednostka === 'klatki' && Number(wKlatce) > 0 && <> (~{fmt(prognozaPeczki / (Number(wKlatce) || 1))} kl.)</>}.
              </p>
            ) : (
              <p className='mt-2 text-xs text-gray-400'>Podaj godzinę końca, aby zobaczyć prognozę.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
