'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Odbiorca } from '@/lib/types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'

const empty = { imie: '', nazwisko: '', ksywa: '', tel: '', miejsce_odbioru: '' }

export default function OdbiorcyPage() {
  const [odbiorcy, setOdbiorcy] = useState<Odbiorca[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState<number | null>(null)
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null)

  async function load() {
    const { data } = await supabase.from('odbiorcy').select('*').order('created_at', { ascending: false })
    setOdbiorcy(data ?? [])
  }

  useEffect(() => { load() }, [])

  function openNew() { setForm(empty); setEditId(null); setOpen(true) }
  function openEdit(o: Odbiorca) {
    setForm({ imie: o.imie ?? '', nazwisko: o.nazwisko ?? '', ksywa: o.ksywa ?? '', tel: o.tel ?? '', miejsce_odbioru: o.miejsce_odbioru ?? '' })
    setEditId(o.id); setOpen(true)
  }

  async function save() {
    const payload = { imie: form.imie || null, nazwisko: form.nazwisko || null, ksywa: form.ksywa || null, tel: form.tel || null, miejsce_odbioru: form.miejsce_odbioru || null }
    const { error } = editId
      ? await supabase.from('odbiorcy').update(payload).eq('id', editId)
      : await supabase.from('odbiorcy').insert(payload)
    if (error) { toast.error('Nie udało się zapisać: ' + error.message); return }
    toast.success(editId ? 'Odbiorca zaktualizowany' : 'Odbiorca dodany')
    setOpen(false); load()
  }

  function remove(id: number) {
    setConfirmAction(() => async () => {
      const { error } = await supabase.from('odbiorcy').delete().eq('id', id)
      if (error) { toast.error('Nie udało się usunąć: ' + error.message); return }
      toast.success('Odbiorca usunięty'); load()
    })
  }

  function displayName(o: Odbiorca) {
    return o.ksywa || [o.imie, o.nazwisko].filter(Boolean).join(' ') || '—'
  }

  function initials(o: Odbiorca) {
    const name = displayName(o)
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-gray-900">Odbiorcy</h1>
        <Button onClick={openNew}>+ Dodaj odbiorcę</Button>
      </div>

      <div className="bg-white rounded-2xl border divide-y overflow-hidden">
        {odbiorcy.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">Brak odbiorców</div>
        )}
        {odbiorcy.map(o => (
          <div key={o.id} className="flex items-center gap-3 px-4 py-3.5 active:bg-gray-50">
            <div className="bg-indigo-100 text-indigo-700 rounded-xl w-11 h-11 flex items-center justify-center shrink-0 font-bold text-sm">
              {initials(o)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{displayName(o)}</p>
              <p className="text-sm text-gray-500">
                {o.tel ?? ''}
                {o.tel && o.miejsce_odbioru && ' · '}
                {o.miejsce_odbioru ?? ''}
                {!o.tel && !o.miejsce_odbioru && '—'}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => openEdit(o)} className="p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button onClick={() => remove(o.id)} className="p-2.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Edytuj odbiorcę' : 'Nowy odbiorca'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Imię</Label>
                <Input value={form.imie} onChange={e => setForm(f => ({ ...f, imie: e.target.value }))} />
              </div>
              <div>
                <Label>Nazwisko</Label>
                <Input value={form.nazwisko} onChange={e => setForm(f => ({ ...f, nazwisko: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Ksywa / skrót</Label>
              <Input value={form.ksywa} onChange={e => setForm(f => ({ ...f, ksywa: e.target.value }))} placeholder="opcjonalnie" />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input value={form.tel} onChange={e => setForm(f => ({ ...f, tel: e.target.value }))} placeholder="+48..." type="tel" />
            </div>
            <div>
              <Label>Miejsce odbioru</Label>
              <Input value={form.miejsce_odbioru} onChange={e => setForm(f => ({ ...f, miejsce_odbioru: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Anuluj</Button>
              <Button onClick={save} className="flex-1">Zapisz</Button>
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
