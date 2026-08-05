'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Pogoda } from '@/lib/types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Dane starsze niż tyle godzin uznajemy za nieświeże i NIE blokujemy podlewania
// (lepiej podlać, niż nie podlewać nigdy z powodu zepsutego źródła pogody).
const SWIEZOSC_H = 3

// Uwaga: ta sama reguła co w SQL (pogoda_blokuje()). Tutaj tylko do wyświetlania
// i ostrzeżeń — wiążącą decyzję podejmuje trigger w bazie.
export function pogodaBlokuje(p: Pogoda | null): { blokuje: boolean; powod: string | null; swieza: boolean } {
  if (!p) return { blokuje: false, powod: null, swieza: false }
  const swieza = !!p.aktualizacja &&
    Date.now() - new Date(p.aktualizacja).getTime() < SWIEZOSC_H * 3600_000
  if (!p.aktywna || !swieza) return { blokuje: false, powod: null, swieza }

  if ((p.opad_wstecz ?? 0) >= p.prog_opad_wstecz)
    return { blokuje: true, powod: `padało: ${(p.opad_wstecz ?? 0).toFixed(1)} mm w ost. ${p.godzin_wstecz} h`, swieza }
  if ((p.opad_naprzod ?? 0) >= p.prog_opad_naprzod)
    return { blokuje: true, powod: `prognoza deszczu: ${(p.opad_naprzod ?? 0).toFixed(1)} mm w ${p.godzin_naprzod} h`, swieza }
  if ((p.szansa_naprzod ?? 0) >= p.prog_szansa)
    return { blokuje: true, powod: `szansa na deszcz ${p.szansa_naprzod}% w ${p.godzin_naprzod} h`, swieza }

  return { blokuje: false, powod: null, swieza }
}

const empty = {
  lat: '', lon: '', godzin_wstecz: '', godzin_naprzod: '',
  prog_opad_wstecz: '', prog_opad_naprzod: '', prog_szansa: '',
}

export default function PogodaCard({ pogoda: pogodaProp, onZmiana }: { pogoda: Pogoda | null; onZmiana: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [odswiezanie, setOdswiezanie] = useState(false)

  // const (nie parametr), zeby zawezenie typu dzialalo tez w funkcjach nizej
  const pogoda = pogodaProp
  if (!pogoda) return null
  const { blokuje, powod, swieza } = pogodaBlokuje(pogoda)

  const openUstawienia = () => {
    setForm({
      lat: String(pogoda.lat), lon: String(pogoda.lon),
      godzin_wstecz: String(pogoda.godzin_wstecz), godzin_naprzod: String(pogoda.godzin_naprzod),
      prog_opad_wstecz: String(pogoda.prog_opad_wstecz), prog_opad_naprzod: String(pogoda.prog_opad_naprzod),
      prog_szansa: String(pogoda.prog_szansa),
    })
    setOpen(true)
  }

  async function zapisz() {
    const { error } = await supabase.from('pogoda').update({
      lat: Number(form.lat), lon: Number(form.lon),
      godzin_wstecz: Number(form.godzin_wstecz), godzin_naprzod: Number(form.godzin_naprzod),
      prog_opad_wstecz: Number(form.prog_opad_wstecz), prog_opad_naprzod: Number(form.prog_opad_naprzod),
      prog_szansa: Number(form.prog_szansa),
    }).eq('id', 1)
    if (error) { toast.error('Nie udało się zapisać: ' + error.message); return }
    toast.success('Zapisano — odświeżam pogodę')
    setOpen(false)
    odswiez()
  }

  const toggleAktywna = async () => {
    const { error } = await supabase.from('pogoda').update({ aktywna: !pogoda.aktywna }).eq('id', 1)
    if (error) { toast.error('Nie udało się zmienić: ' + error.message); return }
    toast.success(pogoda.aktywna ? 'Blokada deszczowa wyłączona' : 'Blokada deszczowa włączona')
    onZmiana()
  }

  // pg_net jest asynchroniczny: pierwsze wywołanie wysyła zapytanie, drugie czyta odpowiedź
  async function odswiez() {
    setOdswiezanie(true)
    try {
      await supabase.rpc('pogoda_odswiez')
      await new Promise(r => setTimeout(r, 3000))
      await supabase.rpc('pogoda_odswiez')
      onZmiana()
    } finally {
      setOdswiezanie(false)
    }
  }

  const brakDanych = pogoda.aktualizacja == null

  return (
    <>
      <div className={`rounded-2xl border p-4 mb-4 ${blokuje ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
        <div className="flex items-start gap-3">
          <span className="text-xl leading-none">{blokuje ? '🌧️' : pogoda.aktywna ? '🌤️' : '🚫'}</span>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold ${blokuje ? 'text-blue-800' : 'text-gray-900'}`}>
              {!pogoda.aktywna ? 'Blokada deszczowa wyłączona'
                : blokuje ? 'Harmonogram wstrzymany — deszcz'
                : 'Harmonogram aktywny'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {brakDanych ? 'Brak danych pogodowych — uruchom „Odśwież"'
                : !swieza ? 'Dane nieaktualne — blokada nie działa'
                : powod ?? 'Bez opadów — podlewanie pójdzie normalnie'}
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={odswiez} disabled={odswiezanie} aria-label="Odśwież pogodę"
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                className={odswiezanie ? 'animate-spin' : ''}>
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />
              </svg>
            </button>
            <button onClick={openUstawienia} aria-label="Ustawienia pogody"
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10.09 3V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>

        {!brakDanych && (
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div className="bg-gray-50 rounded-xl py-2">
              <p className="text-base font-bold text-gray-900">{(pogoda.opad_wstecz ?? 0).toFixed(1)} mm</p>
              <p className="text-[11px] text-gray-400">spadło ({pogoda.godzin_wstecz} h)</p>
            </div>
            <div className="bg-gray-50 rounded-xl py-2">
              <p className="text-base font-bold text-gray-900">{(pogoda.opad_naprzod ?? 0).toFixed(1)} mm</p>
              <p className="text-[11px] text-gray-400">prognoza ({pogoda.godzin_naprzod} h)</p>
            </div>
            <div className="bg-gray-50 rounded-xl py-2">
              <p className="text-base font-bold text-gray-900">{pogoda.szansa_naprzod ?? 0}%</p>
              <p className="text-[11px] text-gray-400">szansa deszczu</p>
            </div>
          </div>
        )}

        {pogoda.blad && <p className="text-xs text-red-500 mt-2">Błąd pogody: {pogoda.blad}</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pogoda i blokada deszczowa</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Lokalizacja pola</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label>Szerokość (lat)</Label>
                  <Input type="number" step="0.0001" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} />
                </div>
                <div className="flex-1">
                  <Label>Długość (lon)</Label>
                  <Input type="number" step="0.0001" value={form.lon} onChange={e => setForm(f => ({ ...f, lon: e.target.value }))} />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">Z Map Google: przytrzymaj punkt na polu — pokaże dwie liczby.</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nie podlewaj, jeśli…</p>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label>spadło min. (mm)</Label>
                    <Input type="number" step="0.5" min="0" value={form.prog_opad_wstecz} onChange={e => setForm(f => ({ ...f, prog_opad_wstecz: e.target.value }))} />
                  </div>
                  <div className="w-28">
                    <Label>w ost. (h)</Label>
                    <Input type="number" min="1" max="48" value={form.godzin_wstecz} onChange={e => setForm(f => ({ ...f, godzin_wstecz: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label>prognoza min. (mm)</Label>
                    <Input type="number" step="0.5" min="0" value={form.prog_opad_naprzod} onChange={e => setForm(f => ({ ...f, prog_opad_naprzod: e.target.value }))} />
                  </div>
                  <div className="w-28">
                    <Label>w ciągu (h)</Label>
                    <Input type="number" min="1" max="48" value={form.godzin_naprzod} onChange={e => setForm(f => ({ ...f, godzin_naprzod: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>albo szansa na deszcz min. (%)</Label>
                  <Input type="number" min="0" max="100" value={form.prog_szansa} onChange={e => setForm(f => ({ ...f, prog_szansa: e.target.value }))} />
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400">
              Blokada dotyczy tylko folii <b>odkrytych</b>. To, która folia jest założona, ustawiasz
              w sekcji Folie — folie założone są podlewane mimo deszczu.
            </p>

            <button onClick={toggleAktywna}
              className={`w-full rounded-xl border p-3 flex items-center gap-3 text-left transition-colors ${pogoda.aktywna ? 'border-gray-200 active:bg-gray-50' : 'border-amber-300 bg-amber-50 active:bg-amber-100'}`}>
              <span className="text-lg leading-none">{pogoda.aktywna ? '✅' : '🚫'}</span>
              <span className="flex-1 text-sm">
                {pogoda.aktywna ? 'Blokada deszczowa włączona' : 'Blokada deszczowa wyłączona'}
                <span className="block text-xs text-gray-400">Dotknij, aby przełączyć</span>
              </span>
            </button>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Anuluj</Button>
              <Button onClick={zapisz} className="flex-1">Zapisz</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
