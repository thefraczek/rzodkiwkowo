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
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus'

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
  const [editNasionoId, setEditNasionoId] = useState<number | null>(null)
  const [editNasionoNazwa, setEditNasionoNazwa] = useState('')
  const [seedSaving, setSeedSaving] = useState(false)
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null)

  async function load() {
    const [s, f, n] = await Promise.all([
      supabase.from('sianie').select('*, folie(nazwa), nasiona(nazwa)').order('data', { ascending: false }),
      supabase.from('folie').select('*').order('nazwa'),
      supabase.from('nasiona').select('*').eq('archived', false).order('nazwa'),
    ])
    setSianie((s.data as Sianie[]) ?? [])
    setFolie((f.data as Folia[]) ?? [])
    setNasiona((n.data as Nasiono[]) ?? [])
  }

  async function loadNasiona() {
    const { data, error } = await supabase.from('nasiona').select('*').eq('archived', false).order('nazwa')
    if (error) { toast.error('Nie udało się wczytać nasion: ' + error.message); return }
    setNasiona((data as Nasiono[]) ?? [])
  }

  useEffect(() => { load() }, [])
  useRefreshOnFocus(load)

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

    if (error) { toast.error('Nie udało się zapisać: ' + error.message); return }
    toast.success(editId ? 'Zasiew zaktualizowany' : 'Zasiew dodany')
    setOpen(false)
    load()
  }

  function remove(id: number) {
    setConfirmAction(() => async () => {
      const { error } = await supabase.from('sianie').delete().eq('id', id)
      if (error) { toast.error('Nie udało się usunąć: ' + error.message); return }
      toast.success('Zasiew usunięty')
      load()
    })
  }

  async function saveNasiono() {
    const nazwa = newNasiono.trim()
    if (!nazwa) { toast.error('Wpisz nazwę nasion'); return }
    setSeedSaving(true)
    const { data, error } = await supabase.from('nasiona').insert({ nazwa }).select('*').single()
    setSeedSaving(false)
    if (error) { toast.error('Nie udało się dodać nasion: ' + error.message); return }
    const added = data as Nasiono
    setNewNasiono('')
    if (open) setForm(f => ({ ...f, nasiona_id: String(added.id) }))
    toast.success('Nasiona dodane')
    loadNasiona()
  }

  async function updateNasiono() {
    const nazwa = editNasionoNazwa.trim()
    if (!nazwa || !editNasionoId) return
    const { error } = await supabase.from('nasiona').update({ nazwa }).eq('id', editNasionoId)
    if (error) { toast.error('Nie udało się zaktualizować: ' + error.message); return }
    toast.success('Nasiona zaktualizowane')
    setEditNasionoId(null)
    setEditNasionoNazwa('')
    loadNasiona()
  }

  function removeNasiono(id: number) {
    setConfirmAction(() => async () => {
      const { error } = await supabase.from('nasiona').update({ archived: true }).eq('id', id)
      if (error) { toast.error('Nie udało się usunąć: ' + error.message); return }
      toast.success('Nasiona usunięte')
      loadNasiona()
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 mb-4">
        <h1 className="text-xl font-bold text-gray-900">Sianie</h1>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size='sm' onClick={() => setNasionaOpen(true)}>Słownik nasion</Button>
          <Button size='sm' onClick={openNew}>+ Dodaj zasiew</Button>
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

      {/* Formularz zasiewu */}
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
              <Select key={folie.length} value={form.folia_id} onValueChange={v => setForm(f => ({ ...f, folia_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Wybierz folię">{folie.find(f => String(f.id) === form.folia_id)?.nazwa}</SelectValue></SelectTrigger>
                <SelectContent>{folie.map(fl => <SelectItem key={fl.id} value={String(fl.id)}>{fl.nazwa}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Nasiona</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setNasionaOpen(true)}>Słownik nasion</Button>
              </div>
              <Select key={nasiona.length} value={form.nasiona_id} onValueChange={v => setForm(f => ({ ...f, nasiona_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Wybierz nasiona">{nasiona.find(n => String(n.id) === form.nasiona_id)?.nazwa}</SelectValue></SelectTrigger>
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

      {/* Słownik nasion */}
      <Dialog open={nasionaOpen} onOpenChange={v => { setNasionaOpen(v); if (!v) { setEditNasionoId(null); setEditNasionoNazwa('') } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Słownik nasion</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="flex gap-2">
              <Input
                value={newNasiono}
                onChange={e => setNewNasiono(e.target.value)}
                placeholder="Nowe nasiona..."
                onKeyDown={e => e.key === 'Enter' && saveNasiono()}
              />
              <Button onClick={saveNasiono} disabled={seedSaving || !newNasiono.trim()}>Dodaj</Button>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y rounded-xl border">
              {nasiona.length === 0 && (
                <div className="py-6 text-center text-sm text-gray-400">Brak nasion w słowniku</div>
              )}
              {nasiona.map(n => (
                <div key={n.id} className="px-3 py-2.5">
                  {editNasionoId === n.id ? (
                    <div className="flex gap-2">
                      <Input
                        autoFocus
                        value={editNasionoNazwa}
                        onChange={e => setEditNasionoNazwa(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') updateNasiono(); if (e.key === 'Escape') { setEditNasionoId(null); setEditNasionoNazwa('') } }}
                        className="h-8 text-sm flex-1"
                      />
                      <Button size="sm" onClick={updateNasiono} disabled={!editNasionoNazwa.trim()}>Zapisz</Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditNasionoId(null); setEditNasionoNazwa('') }}>✕</Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{n.nazwa}</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditNasionoId(n.id); setEditNasionoNazwa(n.nazwa) }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button
                          onClick={() => removeNasiono(n.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    </div>
                  )}
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
