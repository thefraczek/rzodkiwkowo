'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Folia, NawadnianieHarmonogram } from '@/lib/types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus'

const empty = { folia_id: '', godzina: '06:00', czas_minut: '10', aktywny: true }
const hhmm = (t: string) => (t ?? '').slice(0, 5)
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

export default function HarmonogramPage() {
  const [wpisy, setWpisy] = useState<NawadnianieHarmonogram[]>([])
  const [folie, setFolie] = useState<Folia[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState<number | null>(null)
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null)

  async function load() {
    const [h, f] = await Promise.all([
      supabase.from('nawadnianie_harmonogram').select('*, folie(nazwa)').order('godzina'),
      supabase.from('folie').select('*').order('nazwa'),
    ])
    setWpisy(h.data ?? [])
    setFolie(f.data ?? [])
  }

  useEffect(() => { load() }, [])
  useRefreshOnFocus(load)

  const zZaworem = folie.filter(f => f.kanal_zaworu != null)
  const [godzH, godzM] = (form.godzina || '06:00').split(':')

  function openNew() { setForm(empty); setEditId(null); setOpen(true) }
  function openEdit(h: NawadnianieHarmonogram) {
    setForm({ folia_id: String(h.folia_id), godzina: hhmm(h.godzina), czas_minut: String(h.czas_minut), aktywny: h.aktywny })
    setEditId(h.id); setOpen(true)
  }

  async function save() {
    const payload = {
      folia_id: Number(form.folia_id),
      godzina: form.godzina,
      czas_minut: Number(form.czas_minut),
      aktywny: form.aktywny,
    }
    const { error } = editId
      ? await supabase.from('nawadnianie_harmonogram').update(payload).eq('id', editId)
      : await supabase.from('nawadnianie_harmonogram').insert(payload)
    if (error) { toast.error('Nie udało się zapisać: ' + error.message); return }
    toast.success(editId ? 'Harmonogram zaktualizowany' : 'Harmonogram dodany')
    setOpen(false); load()
  }

  async function toggle(h: NawadnianieHarmonogram) {
    const { error } = await supabase.from('nawadnianie_harmonogram').update({ aktywny: !h.aktywny }).eq('id', h.id)
    if (error) { toast.error(error.message); return }
    load()
  }

  function remove(id: number) {
    setConfirmAction(() => async () => {
      const { error } = await supabase.from('nawadnianie_harmonogram').delete().eq('id', id)
      if (error) { toast.error('Nie udało się usunąć: ' + error.message); return }
      toast.success('Wpis usunięty'); load()
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 mb-4">
        <h1 className="text-xl font-bold text-gray-900">Harmonogram podlewania</h1>
        <Button size='sm' onClick={openNew} disabled={zZaworem.length === 0}>+ Dodaj porę</Button>
      </div>

      <div className="bg-white rounded-2xl border divide-y overflow-hidden">
        {zZaworem.length === 0 && (
          <div className="py-8 text-center text-gray-400 text-sm px-4">
            Żadna folia nie ma przypisanego zaworu.<br />Ustaw „kanał zaworu" w sekcji Folie.
          </div>
        )}
        {zZaworem.length > 0 && wpisy.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">Brak zaplanowanych pór podlewania</div>
        )}
        {wpisy.map(h => (
          <div key={h.id} className={`flex items-center gap-3 px-4 py-3.5 ${h.aktywny ? '' : 'opacity-50'}`}>
            <div className="bg-cyan-100 rounded-xl px-2.5 py-1.5 shrink-0">
              <span className="text-base font-bold text-cyan-800 tabular-nums">{hhmm(h.godzina)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{(h.folie as any)?.nazwa ?? '—'}</p>
              <p className="text-sm text-gray-500">codziennie · {h.czas_minut} min</p>
            </div>
            <button
              onClick={() => toggle(h)}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${h.aktywny ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-100 border-gray-200 text-gray-400'}`}
            >
              {h.aktywny ? 'wł.' : 'wył.'}
            </button>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => openEdit(h)} className="p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button onClick={() => remove(h.id)} className="p-2.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-3 px-1">
        Aby podlewać o kilku porach (np. 5:00 i 23:30), dodaj osobny wpis dla każdej godziny.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Edytuj porę' : 'Nowa pora podlewania'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Folia</Label>
              <Select key={zZaworem.length} value={form.folia_id} onValueChange={v => setForm(f => ({ ...f, folia_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Wybierz folię">{zZaworem.find(f => String(f.id) === form.folia_id)?.nazwa}</SelectValue></SelectTrigger>
                <SelectContent>{zZaworem.map(fl => <SelectItem key={fl.id} value={String(fl.id)}>{fl.nazwa}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Godzina (czas polski, 24h)</Label>
              <div className="flex items-center gap-2">
                <Select value={godzH} onValueChange={v => setForm(f => ({ ...f, godzina: `${v}:${godzM}` }))}>
                  <SelectTrigger className="flex-1"><SelectValue>{godzH}</SelectValue></SelectTrigger>
                  <SelectContent>{HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
                <span className="text-lg font-bold text-gray-400">:</span>
                <Select value={godzM} onValueChange={v => setForm(f => ({ ...f, godzina: `${godzH}:${v}` }))}>
                  <SelectTrigger className="flex-1"><SelectValue>{godzM}</SelectValue></SelectTrigger>
                  <SelectContent>{MINUTES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Czas podlewania (min)</Label>
              <Input type="number" value={form.czas_minut} onChange={e => setForm(f => ({ ...f, czas_minut: e.target.value }))} min="1" max="120" />
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, aktywny: !f.aktywny }))}
              className={`w-full py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${form.aktywny ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-400'}`}
            >
              {form.aktywny ? 'Harmonogram włączony' : 'Harmonogram wyłączony'}
            </button>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Anuluj</Button>
              <Button onClick={save} disabled={!form.folia_id || !form.godzina} className="flex-1">Zapisz</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmAction}
        onConfirm={async () => { await confirmAction?.(); setConfirmAction(null) }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}
