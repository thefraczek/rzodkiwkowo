'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Folia, Nawadnianie } from '@/lib/types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus'

type Krok = { folia_id: number; nazwa: string; strefa: number; czas_minut: number }

const STATUS: Record<string, string> = { w_trakcie: '💦 podlewa', oczekuje: '⏳ następna', wstrzymane: '⏸ czeka' }

export default function KolejkaPage() {
  const [folie, setFolie] = useState<Folia[]>([])
  const [aktywna, setAktywna] = useState<Nawadnianie[]>([])
  const [kroki, setKroki] = useState<Krok[]>([])
  const [foliaId, setFoliaId] = useState('')
  const [minuty, setMinuty] = useState('10')

  async function load() {
    const [f, a] = await Promise.all([
      supabase.from('folie').select('*').order('nazwa'),
      supabase.from('nawadnianie').select('*, folie(nazwa)').eq('zrodlo', 'kolejka')
        .in('status', ['oczekuje', 'w_trakcie', 'wstrzymane']).order('kolejnosc'),
    ])
    setFolie(f.data ?? [])
    setAktywna(a.data ?? [])
  }

  useEffect(() => { load() }, [])
  useRefreshOnFocus(load)

  const aktRef = useRef(false)
  aktRef.current = aktywna.length > 0
  useEffect(() => {
    let stop = false
    let t: ReturnType<typeof setTimeout>
    const tick = () => {
      if (stop) return
      if (typeof document === 'undefined' || document.visibilityState === 'visible') load()
      t = setTimeout(tick, aktRef.current ? 5000 : 30000)
    }
    t = setTimeout(tick, aktRef.current ? 5000 : 30000)
    return () => { stop = true; clearTimeout(t) }
  }, [])

  const zZaworem = folie.filter(f => f.kanal_zaworu != null)

  function dodajKrok() {
    const f = zZaworem.find(x => String(x.id) === foliaId)
    if (!f || f.kanal_zaworu == null) { toast.error('Wybierz folię'); return }
    setKroki(k => [...k, { folia_id: f.id, nazwa: f.nazwa, strefa: f.kanal_zaworu!, czas_minut: Number(minuty) || 10 }])
    setFoliaId(''); setMinuty('10')
  }
  function usunKrok(i: number) { setKroki(k => k.filter((_, idx) => idx !== i)) }
  function przesun(i: number, dir: -1 | 1) {
    setKroki(k => {
      const j = i + dir
      if (j < 0 || j >= k.length) return k
      const c = [...k]; const tmp = c[i]; c[i] = c[j]; c[j] = tmp; return c
    })
  }

  async function uruchom() {
    if (kroki.length === 0) return
    if (aktywna.length > 0) { toast.error('Kolejka już działa — poczekaj aż się skończy lub ją zatrzymaj'); return }
    const rows = kroki.map((k, i) => ({
      folia_id: k.folia_id, strefa: k.strefa, czas_minut: k.czas_minut,
      zrodlo: 'kolejka', kolejnosc: i + 1, status: i === 0 ? 'oczekuje' : 'wstrzymane',
    }))
    const { error } = await supabase.from('nawadnianie').insert(rows)
    if (error) { toast.error('Nie udało się uruchomić: ' + error.message); return }
    toast.success(`Kolejka uruchomiona (${rows.length} kroków)`)
    setKroki([]); load()
  }

  async function zatrzymaj() {
    const { error } = await supabase.from('nawadnianie').delete().eq('zrodlo', 'kolejka').eq('status', 'wstrzymane')
    if (error) { toast.error(error.message); return }
    toast.success('Zatrzymano — pozostałe kroki usunięte (bieżący dokończy się sam)'); load()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 mb-4">
        <h1 className="text-xl font-bold text-gray-900">Kolejka podlewania</h1>
      </div>

      {/* aktywna kolejka */}
      {aktywna.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between px-1 mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Trwająca kolejka</p>
            <button onClick={zatrzymaj} className="text-xs font-medium text-red-500 active:text-red-700">Zatrzymaj</button>
          </div>
          <div className="bg-white rounded-2xl border divide-y overflow-hidden">
            {aktywna.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-sm font-bold text-gray-400 tabular-nums w-5 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{(a.folie as any)?.nazwa ?? `Strefa ${a.strefa}`}</p>
                  <p className="text-sm text-gray-500">{a.czas_minut} min</p>
                </div>
                <span className="text-sm shrink-0">{STATUS[a.status] ?? a.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* budowanie nowej kolejki */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">Ułóż kolejkę</p>
      <div className="bg-white rounded-2xl border p-4 space-y-3">
        {zZaworem.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Żadna folia nie ma przypisanego zaworu (ustaw w sekcji Folie).</p>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label>Folia</Label>
                <Select key={zZaworem.length} value={foliaId} onValueChange={v => setFoliaId(v ?? '')}>
                  <SelectTrigger><SelectValue placeholder="Wybierz">{zZaworem.find(f => String(f.id) === foliaId)?.nazwa}</SelectValue></SelectTrigger>
                  <SelectContent>{zZaworem.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.nazwa}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="w-20">
                <Label>Min</Label>
                <Input type="number" value={minuty} onChange={e => setMinuty(e.target.value)} min="1" max="120" />
              </div>
              <Button size='sm' onClick={dodajKrok} disabled={!foliaId} className="h-10">+ Dodaj</Button>
            </div>

            {kroki.length > 0 && (
              <div className="divide-y border rounded-xl overflow-hidden">
                {kroki.map((k, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2.5">
                    <span className="text-sm font-bold text-gray-400 tabular-nums w-5 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-900">{k.nazwa}</span>
                      <span className="text-gray-500 text-sm"> · {k.czas_minut} min</span>
                    </div>
                    <button onClick={() => przesun(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-gray-400 disabled:opacity-30 active:bg-gray-100">▲</button>
                    <button onClick={() => przesun(i, 1)} disabled={i === kroki.length - 1} className="p-1.5 rounded-lg text-gray-400 disabled:opacity-30 active:bg-gray-100">▼</button>
                    <button onClick={() => usunKrok(i)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 active:bg-red-50">✕</button>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={uruchom}
              disabled={kroki.length === 0 || aktywna.length > 0}
              className="w-full bg-cyan-600 hover:bg-cyan-700"
            >
              {aktywna.length > 0 ? 'Kolejka już działa' : `Uruchom kolejkę (${kroki.length})`}
            </Button>
          </>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3 px-1">
        Strefy ruszają po kolei — następna startuje, gdy poprzednia się zakończy. Jednorazowo (nie powtarza się).
      </p>
    </div>
  )
}
