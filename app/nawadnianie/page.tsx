'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Folia, Nawadnianie, NawadnianieSterownik } from '@/lib/types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus'

const STATUS_LABEL: Record<string, string> = {
  oczekuje: 'Czeka w kolejce', w_trakcie: 'Podlewa', zakonczone: 'Zakończone', blad: 'Błąd', anulowane: 'Przerywanie…',
}

const godz = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' }) : '—'

export default function NawadnianiePage() {
  const [folie, setFolie] = useState<Folia[]>([])
  const [aktywne, setAktywne] = useState<Nawadnianie[]>([])
  const [ostatnie, setOstatnie] = useState<Nawadnianie[]>([])
  const [sterownik, setSterownik] = useState<NawadnianieSterownik | null>(null)
  const [open, setOpen] = useState(false)
  const [wybrana, setWybrana] = useState<Folia | null>(null)
  const [minuty, setMinuty] = useState('10')
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null)

  async function load() {
    const [f, akt, ost, st] = await Promise.all([
      supabase.from('folie').select('*').order('nazwa'),
      supabase.from('nawadnianie').select('*, folie(nazwa)').in('status', ['oczekuje', 'w_trakcie', 'anulowane']).order('created_at', { ascending: false }),
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

  // auto-odświeżanie: co 5 s gdy coś w toku, co 30 s gdy bezczynnie (tylko gdy karta widoczna).
  // interwal zalezy od cosWToku -> przebudowuje sie OD RAZU, gdy cos stanie sie aktywne.
  const cosWToku = aktywne.length > 0
  useEffect(() => {
    const interval = cosWToku ? 5000 : 30000
    const id = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') load()
    }, interval)
    return () => clearInterval(id)
  }, [cosWToku])

  function openPodlej(f: Folia) { setWybrana(f); setMinuty('10'); setOpen(true) }

  async function podlej() {
    if (!wybrana) return
    if (aktywne.some(a => a.folia_id === wybrana.id)) {
      toast.error('Ta folia jest już podlewana lub czeka w kolejce')
      setOpen(false); return
    }
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

  async function anuluj(a: Nawadnianie) {
    // Zlecenie w kolejce — sterownik jeszcze go nie podjął, więc po prostu usuwamy wiersz.
    // Usuwamy tylko gdy status wciąż 'oczekuje'/'wstrzymane' — jeśli sterownik właśnie
    // je podjął (status zmienił się na 'w_trakcie'), delete nic nie usunie.
    const { error } = await supabase.from('nawadnianie').delete()
      .eq('id', a.id).in('status', ['oczekuje', 'wstrzymane'])
    if (error) { toast.error('Nie udało się anulować: ' + error.message); return }
    toast.success('Zlecenie anulowane')
    load()
  }

  function przerwij(a: Nawadnianie) {
    setConfirmAction(() => async () => {
      // Trwające podlewanie — ustawiamy status 'anulowane'; sterownik przy najbliższym
      // odpytaniu zamyka zawór i oznacza wpis jako zakończony.
      const { error } = await supabase.from('nawadnianie')
        .update({ status: 'anulowane' }).eq('id', a.id).eq('status', 'w_trakcie')
      if (error) { toast.error('Nie udało się przerwać: ' + error.message); return }
      toast.success('Wysłano polecenie przerwania — zawór zamknie się za chwilę')
      load()
    })
  }

  async function togglePauza() {
    const nowy = !sterownik?.pauza
    setSterownik(s => (s ? { ...s, pauza: nowy } : s))   // optymistycznie
    const { error } = await supabase.from('nawadnianie_sterownik').update({ pauza: nowy }).eq('id', 1)
    if (error) { toast.error('Nie udało się zmienić: ' + error.message); load(); return }
    toast.success(nowy ? 'Podlewanie wstrzymane (tryb serwisowy)' : 'Podlewanie wznowione')
    load()
  }

  const online = !!sterownik?.ostatni_kontakt &&
    (Date.now() - new Date(sterownik.ostatni_kontakt).getTime() < 12 * 60 * 1000)
  const zZaworem = folie.filter(f => f.kanal_zaworu != null)
  const statusFolii = new Map<number, string>()
  aktywne.forEach(a => { if (a.folia_id != null) statusFolii.set(a.folia_id, a.status) })

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 mb-4">
        <h1 className="text-xl font-bold text-gray-900">Nawadnianie</h1>
        <div className="flex gap-2">
          <Link href="/harmonogram" className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors">⏰ Harmonogram</Link>
          <Link href="/kolejka" className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors">📋 Kolejka</Link>
        </div>
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
            ? `Ostatni kontakt: ${new Date(sterownik.ostatni_kontakt).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}`
            : 'Brak kontaktu ze sterownikiem'}
        </p>
      </div>

      {/* tryb serwisowy / pauza */}
      <button
        onClick={togglePauza}
        className={`w-full rounded-2xl border p-4 mb-4 flex items-center gap-3 text-left transition-colors ${
          sterownik?.pauza ? 'bg-amber-50 border-amber-300 active:bg-amber-100' : 'bg-white border-gray-200 active:bg-gray-50'
        }`}
      >
        <span className="text-xl leading-none">{sterownik?.pauza ? '⏸️' : '▶️'}</span>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold ${sterownik?.pauza ? 'text-amber-800' : 'text-gray-900'}`}>
            {sterownik?.pauza ? 'Podlewanie wstrzymane' : 'Podlewanie aktywne'}
          </p>
          <p className="text-xs text-gray-500">
            {sterownik?.pauza
              ? 'Tryb serwisowy — zawory zamknięte, czas zamrożony. Dotknij, aby wznowić.'
              : 'Dotknij, aby wstrzymać na czas naprawy (tryb serwisowy).'}
          </p>
        </div>
        <span className={`text-sm font-semibold px-3 py-1.5 rounded-lg shrink-0 ${sterownik?.pauza ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
          {sterownik?.pauza ? 'Wznów' : 'Wstrzymaj'}
        </span>
      </button>

      {/* trwające / w kolejce */}
      {aktywne.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">Trwające i w kolejce</p>
          <div className="bg-white rounded-2xl border divide-y overflow-hidden">
            {aktywne.map(a => {
              const start = a.rozpoczeto ? new Date(a.rozpoczeto) : null
              const koniec = start ? new Date(start.getTime() + a.czas_minut * 60000) : null
              const pozostalo = koniec ? Math.max(0, Math.round((koniec.getTime() - Date.now()) / 60000)) : null
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xl leading-none">{a.status === 'w_trakcie' ? '💦' : a.status === 'anulowane' ? '🛑' : '⏳'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{(a.folie as any)?.nazwa ?? `Strefa ${a.strefa}`}</p>
                    {a.status === 'w_trakcie' && start ? (
                      <p className="text-sm text-gray-500">
                        Otwarte o {godz(a.rozpoczeto)} · {a.czas_minut} min
                        {pozostalo != null && <span> · pozostało ~{pozostalo} min</span>}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">{a.czas_minut} min · {STATUS_LABEL[a.status]}</p>
                    )}
                  </div>
                  {a.status === 'oczekuje' && a.zrodlo !== 'kolejka' && (
                    <button onClick={() => anuluj(a)} className="shrink-0 text-sm font-medium text-gray-400 hover:text-red-500 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-red-200 hover:bg-red-50 active:bg-red-100 transition-colors">
                      Anuluj
                    </button>
                  )}
                  {a.status === 'w_trakcie' && (
                    <button onClick={() => przerwij(a)} className="shrink-0 text-sm font-semibold text-red-600 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 active:bg-red-200 transition-colors">
                      🛑 Przerwij
                    </button>
                  )}
                </div>
              )
            })}
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
        {zZaworem.map(f => {
          const st = statusFolii.get(f.id)
          return (
            <div key={f.id} className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-3 self-stretch rounded-full shrink-0" style={{ background: f.kolor ?? '#d1d5db' }} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{f.nazwa}</p>
                <p className="text-sm text-gray-500">zawór {f.kanal_zaworu}</p>
              </div>
              {st === 'w_trakcie' ? (
                <span className="text-sm font-medium text-blue-600 shrink-0">💦 Podlewa</span>
              ) : st === 'oczekuje' ? (
                <span className="text-sm font-medium text-amber-600 shrink-0">⏳ W kolejce</span>
              ) : (
                <Button size='sm' onClick={() => openPodlej(f)}>💦 Podlej</Button>
              )}
            </div>
          )
        })}
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
                    {o.czas_minut} min · {new Date(o.created_at).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })} · {o.zrodlo === 'harmonogram' ? 'harmonogram' : 'ręcznie'}
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

      <ConfirmDialog
        open={!!confirmAction}
        message='Przerwać trwające podlewanie? Zawór zostanie zamknięty przy najbliższym kontakcie ze sterownikiem.'
        confirmLabel='Przerwij'
        onConfirm={async () => { await confirmAction?.(); setConfirmAction(null) }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}
