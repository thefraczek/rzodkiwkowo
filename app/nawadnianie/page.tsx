'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Folia, Nawadnianie, NawadnianieSterownik } from '@/lib/types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus'

const STATUS_LABEL: Record<string, string> = {
  oczekuje: 'Czeka w kolejce', w_trakcie: 'Podlewa', zakonczone: 'Zakończone', blad: 'Błąd',
}

export default function NawadnianiePage() {
  const [folie, setFolie] = useState<Folia[]>([])
  const [aktywne, setAktywne] = useState<Nawadnianie[]>([])
  const [ostatnie, setOstatnie] = useState<Nawadnianie[]>([])
  const [sterownik, setSterownik] = useState<NawadnianieSterownik | null>(null)
  const [open, setOpen] = useState(false)
  const [wybrana, setWybrana] = useState<Folia | null>(null)
  const [minuty, setMinuty] = useState('10')

  async function load() {
    const [f, akt, ost, st] = await Promise.all([
      supabase.from('folie').select('*').order('nazwa'),
      supabase.from('nawadnianie').select('*, folie(nazwa)').in('status', ['oczekuje', 'w_trakcie']).order('created_at', { ascending: false }),
      supabase.from('nawadnianie').select('*, folie(nazwa)').eq('status', 'zakonczone').order('created_at', { ascending: false }).limit(5),
      supabase.from('nawadnianie_sterownik').select('*').eq('id', 1).maybeSingle(),
    ])
    setFolie(f.data ?? [])
    setAktywne(akt.data ?? [])
    setOstatnie(ost.data ?? [])
    setSterownik(st.data ?? null)
  }

  useEffect(() => { load() }, [])
  useRefreshOnFocus(load)

  function openPodlej(f: Folia) { setWybrana(f); setMinuty('10'); setOpen(true) }

  async function podlej() {
    if (!wybrana) return
    const { error } = await supabase.from('nawadnianie').insert({
      folia_id: wybrana.id,
      strefa: wybrana.kanal_zaworu,
      czas_minut: Number(minuty),
      zrodlo: 'reczne',
    })
    if (error) { toast.error('Nie udało się zlecić: ' + error.message); return }
    toast.success(`Zlecono podlewanie: ${wybrana.nazwa} (${minuty} min)`)
    setOpen(false); load()
  }

  const online = !!sterownik?.ostatni_kontakt &&
    (Date.now() - new Date(sterownik.ostatni_kontakt).getTime() < 12 * 60 * 1000)
  const zZaworem = folie.filter(f => f.kanal_zaworu != null)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 mb-4">
        <h1 className="text-xl font-bold text-gray-900">Nawadnianie</h1>
      </div>

      {/* status sterownika */}
      <div className={`rounded-2xl border p-4 mb-4 ${online ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-400'}`} />
          <span className={`font-semibold ${online ? 'text-green-800' : 'text-red-700'}`}>
            Sterownik {online ? 'online' : 'offline'}
          </span>
          {online && sterownik?.zasieg != null && (
            <span className="ml-auto text-sm text-green-700">zasięg {sterownik.zasieg}%</span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {sterownik?.ostatni_kontakt
            ? `Ostatni kontakt: ${new Date(sterownik.ostatni_kontakt).toLocaleString('pl-PL')}`
            : 'Brak kontaktu ze sterownikiem'}
        </p>
      </div>

      {/* trwające / w kolejce */}
      {aktywne.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">Trwające i w kolejce</p>
          <div className="bg-white rounded-2xl border divide-y overflow-hidden">
            {aktywne.map(a => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-xl leading-none">{a.status === 'w_trakcie' ? '💦' : '⏳'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{(a.folie as any)?.nazwa ?? `Strefa ${a.strefa}`}</p>
                  <p className="text-sm text-gray-500">{a.czas_minut} min · {STATUS_LABEL[a.status]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* folie do podlania */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">Podlej ręcznie</p>
      <div className="bg-white rounded-2xl border divide-y overflow-hidden">
        {zZaworem.length === 0 && (
          <div className="py-8 text-center text-gray-400 text-sm px-4">
            Żadna folia nie ma przypisanego zaworu.<br />Ustaw „kanał zaworu" w sekcji Folie.
          </div>
        )}
        {zZaworem.map(f => (
          <div key={f.id} className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-3 self-stretch rounded-full shrink-0" style={{ background: f.kolor ?? '#d1d5db' }} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{f.nazwa}</p>
              <p className="text-sm text-gray-500">zawór {f.kanal_zaworu}</p>
            </div>
            <Button size='sm' onClick={() => openPodlej(f)}>💦 Podlej</Button>
          </div>
        ))}
      </div>

      {/* ostatnie podlewania */}
      {ostatnie.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">Ostatnie podlewania</p>
          <div className="bg-white rounded-2xl border divide-y overflow-hidden">
            {ostatnie.map(o => (
              <div key={o.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-lg leading-none">✓</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{(o.folie as any)?.nazwa ?? `Strefa ${o.strefa}`}</p>
                  <p className="text-xs text-gray-400">
                    {o.czas_minut} min · {new Date(o.created_at).toLocaleString('pl-PL')} · {o.zrodlo === 'harmonogram' ? 'harmonogram' : 'ręcznie'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Podlej: {wybrana?.nazwa}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex gap-2">
              {['5', '10', '15', '20'].map(m => (
                <button key={m} onClick={() => setMinuty(m)} className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${minuty === m ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 active:bg-gray-50'}`}>{m} min</button>
              ))}
            </div>
            <div>
              <Label>Czas (minuty)</Label>
              <Input type="number" value={minuty} onChange={e => setMinuty(e.target.value)} min="1" max="120" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Anuluj</Button>
              <Button onClick={podlej} disabled={!minuty || Number(minuty) < 1} className="flex-1">Zleć podlewanie</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
