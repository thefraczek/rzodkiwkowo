'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Nawozenie, Folia, Nawoz } from '@/lib/types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatDatePL } from '@/lib/date'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus'

type Pozycja = { nawoz_id: string; ilosc: string; jednostka: 'kg' | 'g' }
const emptyPozycja = (): Pozycja => ({ nawoz_id: '', ilosc: '', jednostka: 'kg' })
const emptyForm = { folia_id: '', data: '', uwagi: '', pozycje: [emptyPozycja()] }

export default function NawozyPage() {
  const [nawozenia, setNawozenia] = useState<Nawozenie[]>([])
  const [folie, setFolie] = useState<Folia[]>([])
  const [slownik, setSlownik] = useState<Nawoz[]>([])
  const [open, setOpen] = useState(false)
  const [openSlownik, setOpenSlownik] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState<number | null>(null)
  const [nowaNazwa, setNowaNazwa] = useState('')
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null)

  async function load() {
    const [n, f, s] = await Promise.all([
      supabase.from('nawozenie').select('*, folie(nazwa), nawozenie_pozycje(*, nawozy_slownik(nazwa))').order('data', { ascending: false }),
      supabase.from('folie').select('*').order('nazwa'),
      supabase.from('nawozy_slownik').select('*').eq('archived', false).order('nazwa'),
    ])
    setNawozenia(n.data ?? [])
    setFolie(f.data ?? [])
    setSlownik(s.data ?? [])
  }

  useEffect(() => { load() }, [])
  useRefreshOnFocus(load)

  function openNew() {
    setForm({ ...emptyForm, data: new Date().toISOString().slice(0, 10), pozycje: [emptyPozycja()] })
    setEditId(null); setOpen(true)
  }

  function openEdit(n: Nawozenie) {
    const pozycje = (n.nawozenie_pozycje ?? []).map(p => ({
      nawoz_id: String(p.nawoz_id ?? ''), ilosc: String(p.ilosc ?? ''), jednostka: (p.jednostka ?? 'kg') as 'kg' | 'g',
    }))
    setForm({ folia_id: String(n.folia_id ?? ''), data: n.data, uwagi: n.uwagi ?? '', pozycje: pozycje.length ? pozycje : [emptyPozycja()] })
    setEditId(n.id); setOpen(true)
  }

  async function save() {
    const payload = { folia_id: form.folia_id ? Number(form.folia_id) : null, data: form.data, uwagi: form.uwagi || null }
    let id = editId
    if (editId) {
      const { error } = await supabase.from('nawozenie').update(payload).eq('id', editId)
      if (error) { toast.error('Nie udało się zapisać: ' + error.message); return }
      await supabase.from('nawozenie_pozycje').delete().eq('nawozenie_id', editId)
    } else {
      const { data, error } = await supabase.from('nawozenie').insert(payload).select('id').single()
      if (error) { toast.error('Nie udało się zapisać: ' + error.message); return }
      id = data?.id
    }
    if (id) {
      const pozycje = form.pozycje.filter(p => p.nawoz_id).map(p => ({ nawozenie_id: id!, nawoz_id: Number(p.nawoz_id), ilosc: p.ilosc ? Number(p.ilosc) : null, jednostka: p.jednostka }))
      if (pozycje.length) await supabase.from('nawozenie_pozycje').insert(pozycje)
    }
    toast.success(editId ? 'Nawożenie zaktualizowane' : 'Nawożenie dodane')
    setOpen(false); load()
  }

  function remove(id: number) {
    setConfirmAction(() => async () => {
      const { error } = await supabase.from('nawozenie').delete().eq('id', id)
      if (error) { toast.error('Nie udało się usunąć: ' + error.message); return }
      toast.success('Nawożenie usunięte'); load()
    })
  }

  async function addNawoz() {
    if (!nowaNazwa.trim()) return
    const { error } = await supabase.from('nawozy_slownik').insert({ nazwa: nowaNazwa.trim() })
    if (error) { toast.error('Nie udało się dodać: ' + error.message); return }
    toast.success('Nawóz dodany'); setNowaNazwa(''); load()
  }

  function removeNawoz(id: number) {
    setConfirmAction(() => async () => {
      const { error } = await supabase.from('nawozy_slownik').update({ archived: true }).eq('id', id)
      if (error) { toast.error('Nie udało się usunąć: ' + error.message); return }
      toast.success('Nawóz usunięty'); load()
    })
  }

  function updatePozycja(i: number, key: keyof Pozycja, val: string) {
    setForm(f => ({ ...f, pozycje: f.pozycje.map((p, idx) => idx === i ? { ...p, [key]: val } : p) }))
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 mb-4">
        <h1 className="text-xl font-bold text-gray-900">Nawożenie</h1>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={() => setOpenSlownik(true)}>Słownik</Button>
          <Button size="sm" onClick={openNew}>+ Dodaj</Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border divide-y overflow-hidden">
        {nawozenia.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">Brak wpisów</div>
        )}
        {nawozenia.map(n => (
          <div key={n.id} className="flex items-center gap-3 px-4 py-3.5 active:bg-gray-50">
            <div className="bg-yellow-100 rounded-xl p-2.5 shrink-0">
              <span className="text-xl leading-none">🌿</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{(n.folie as any)?.nazwa ?? '—'}</p>
              <p className="text-sm text-gray-500">{formatDatePL(n.data)}</p>
              {(n.nawozenie_pozycje?.length ?? 0) > 0 && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {(n.nawozenie_pozycje ?? []).map(p => `${(p.nawozy_slownik as any)?.nazwa ?? '?'} ${p.ilosc ?? ''}${p.jednostka}`).join(', ')}
                </p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => openEdit(n)} className="p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button onClick={() => remove(n.id)} className="p-2.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? 'Edytuj nawożenie' : 'Nowe nawożenie'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data</Label>
                <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div>
                <Label>Folia</Label>
                <Select key={folie.length} value={form.folia_id} onValueChange={v => setForm(f => ({ ...f, folia_id: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                  <SelectContent>{folie.map(fl => <SelectItem key={fl.id} value={String(fl.id)}>{fl.nazwa}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <Label>Nawozy</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setForm(f => ({ ...f, pozycje: [...f.pozycje, emptyPozycja()] }))}>+ Dodaj</Button>
              </div>
              {form.pozycje.map((p, i) => (
                <div key={i} className="flex gap-2 mb-2 items-end">
                  <div className="flex-1">
                    <Select value={p.nawoz_id} onValueChange={v => updatePozycja(i, 'nawoz_id', v ?? '')}>
                      <SelectTrigger><SelectValue placeholder="Nawóz" /></SelectTrigger>
                      <SelectContent>{slownik.map(n => <SelectItem key={n.id} value={String(n.id)}>{n.nazwa}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Input className="w-20 h-11" type="number" value={p.ilosc} onChange={e => updatePozycja(i, 'ilosc', e.target.value)} placeholder="Ilość" />
                  <Select value={p.jednostka} onValueChange={v => updatePozycja(i, 'jednostka', v ?? 'kg')}>
                    <SelectTrigger className="w-16 h-11"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="kg">kg</SelectItem><SelectItem value="g">g</SelectItem></SelectContent>
                  </Select>
                  {form.pozycje.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setForm(f => ({ ...f, pozycje: f.pozycje.filter((_, idx) => idx !== i) }))}>✕</Button>
                  )}
                </div>
              ))}
            </div>
            <div>
              <Label>Uwagi</Label>
              <Textarea value={form.uwagi} onChange={e => setForm(f => ({ ...f, uwagi: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Anuluj</Button>
              <Button onClick={save} disabled={!form.data} className="flex-1">Zapisz</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openSlownik} onOpenChange={setOpenSlownik}>
        <DialogContent>
          <DialogHeader><DialogTitle>Słownik nawozów</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="flex gap-2">
              <Input value={nowaNazwa} onChange={e => setNowaNazwa(e.target.value)} placeholder="Nazwa nawozu" onKeyDown={e => e.key === 'Enter' && addNawoz()} />
              <Button onClick={addNawoz} disabled={!nowaNazwa.trim()}>Dodaj</Button>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y rounded-xl border">
              {slownik.map(n => (
                <div key={n.id} className="flex justify-between items-center px-3 py-2.5">
                  <span className="text-sm font-medium">{n.nazwa}</span>
                  <button className="text-red-400 hover:text-red-600 text-sm px-2 py-1 rounded-lg hover:bg-red-50 transition-colors" onClick={() => removeNawoz(n.id)}>Usuń</button>
                </div>
              ))}
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
