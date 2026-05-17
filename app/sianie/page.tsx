'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Sianie, Folia, Nasiono } from '@/lib/types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatDatePL } from '@/lib/date'
import { ConfirmDialog } from '@/components/ConfirmDialog'

const empty = { folia_id: '', nasiona_id: '', data: '', uwagi: '' }

export default function SianiePage() {
  const [sianie, setSianie] = useState<Sianie[]>([])
  const [folie, setFolie] = useState<Folia[]>([])
  const [nasiona, setNasiona] = useState<Nasiono[]>([])
  const [open, setOpen] = useState(false)
  const [nasionaOpen, setNasionaOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [newNasiono, setNewNasiono] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [seedSaving, setSeedSaving] = useState(false)
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null)

  async function load() {
    const [s, f, n] = await Promise.all([
      supabase.from('sianie').select('*, folie(nazwa), nasiona(nazwa)').order('data', { ascending: false }),
      supabase.from('folie').select('*').order('nazwa'),
      supabase.from('nasiona').select('*').order('nazwa'),
    ])
    setSianie((s.data as Sianie[]) ?? [])
    setFolie((f.data as Folia[]) ?? [])
    setNasiona((n.data as Nasiono[]) ?? [])
  }

  async function loadNasiona() {
    const { data, error } = await supabase.from('nasiona').select('*').order('nazwa')
    if (error) {
      toast.error('Nie udało się wczytać nasion: ' + error.message)
      return
    }
    setNasiona((data as Nasiono[]) ?? [])
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setForm({ ...empty, data: new Date().toISOString().slice(0, 10) })
    setEditId(null)
    setOpen(true)
  }

  function openEdit(s: Sianie) {
    setForm({
      folia_id: String(s.folia_id ?? ''),
      nasiona_id: String(s.nasiona_id ?? ''),
      data: s.data,
      uwagi: s.uwagi ?? '',
    })
    setEditId(s.id)
    setOpen(true)
  }

  async function save() {
    const payload = {
      folia_id: form.folia_id ? Number(form.folia_id) : null,
      nasiona_id: form.nasiona_id ? Number(form.nasiona_id) : null,
      data: form.data,
      uwagi: form.uwagi || null,
    }

    const { error } = editId
      ? await supabase.from('sianie').update(payload).eq('id', editId)
      : await supabase.from('sianie').insert(payload)

    if (error) {
      toast.error('Nie udało się zapisać: ' + error.message)
      return
    }

    toast.success(editId ? 'Zasiew zaktualizowany' : 'Zasiew dodany')
    setOpen(false)
    load()
  }

  async function saveNasiono() {
    const nazwa = newNasiono.trim()
    if (!nazwa) {
      toast.error('Wpisz nazwę nasion')
      return
    }

    setSeedSaving(true)
    const { data, error } = await supabase.from('nasiona').insert({ nazwa }).select('*').single()
    setSeedSaving(false)

    if (error) {
      toast.error('Nie udało się dodać nasion: ' + error.message)
      return
    }

    const added = data as Nasiono
    setNewNasiono('')
    setNasionaOpen(false)
    setForm(f => ({ ...f, nasiona_id: String(added.id) }))
    toast.success('Nasiona dodane')
    loadNasiona()
  }

  function remove(id: number) {
    setConfirmAction(() => async () => {
      const { error } = await supabase.from('sianie').delete().eq('id', id)
      if (error) { toast.error('Nie udało się usunąć: ' + error.message); return }
      toast.success('Zasiew usunięty')
      load()
    })
  }

  return (
    <div>
      <div className="flex justify-between items-center gap-2 mb-4">
        <h1 className="text-xl font-bold text-gray-900">Sianie</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setNasionaOpen(true)}>+ Nasiona</Button>
          <Button onClick={openNew}>+ Dodaj zasiew</Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border divide-y overflow-hidden">
        {sianie.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">Brak zasiewów</div>
        )}

        {sianie.map(s => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3.5 active:bg-gray-50">
            <div className="bg-green-100 rounded-xl p-2.5 shrink-0">
              <span className="text-xl leading-none">🌱</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{(s.folie as any)?.nazwa ?? '—'}</p>
              <p className="text-sm text-gray-500">
                {formatDatePL(s.data)}
                {(s.nasiona as any)?.nazwa && <span className="text-gray-400"> · {(s.nasiona as any).nazwa}</span>}
              </p>
              {s.uwagi && <p className="text-xs text-gray-400 mt-0.5 truncate">{s.uwagi}</p>}
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => openEdit(s)} className="p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button onClick={() => remove(s.id)} className="p-2.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Edytuj zasiew' : 'Nowy zasiew'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div>
              <Label>Folia</Label>
              <Select value={form.folia_id} onValueChange={v => setForm(f => ({ ...f, folia_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Wybierz folię" /></SelectTrigger>
                <SelectContent>{folie.map(fl => <SelectItem key={fl.id} value={String(fl.id)}>{fl.nazwa}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Nasiona</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setNasionaOpen(true)}>+ Nowe nasiona</Button>
              </div>
              <Select value={form.nasiona_id} onValueChange={v => setForm(f => ({ ...f, nasiona_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Wybierz nasiona" /></SelectTrigger>
                <SelectContent>{nasiona.map(n => <SelectItem key={n.id} value={String(n.id)}>{n.nazwa}</SelectItem>)}</SelectContent>
              </Select>
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

      <Dialog open={nasionaOpen} onOpenChange={setNasionaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nowe nasiona</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Nazwa</Label>
              <Input
                value={newNasiono}
                onChange={e => setNewNasiono(e.target.value)}
                placeholder="np. Rzodkiewka Saxa"
                autoFocus
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setNasionaOpen(false)} className="flex-1">Anuluj</Button>
              <Button onClick={saveNasiono} disabled={seedSaving} className="flex-1">Dodaj</Button>
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
