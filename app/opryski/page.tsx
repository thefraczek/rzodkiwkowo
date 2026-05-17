'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Oprysk, Folia } from '@/lib/types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const empty = { folia_id: '', data: '', preparat: '', uwagi: '' }

export default function OpryszkiPage() {
  const [opryski, setOpryski] = useState<Oprysk[]>([])
  const [folie, setFolie] = useState<Folia[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState<number | null>(null)

  async function load() {
    const [o, f] = await Promise.all([
      supabase.from('opryski').select('*, folie(nazwa)').order('data', { ascending: false }),
      supabase.from('folie').select('*').order('nazwa'),
    ])
    setOpryski(o.data ?? [])
    setFolie(f.data ?? [])
  }

  useEffect(() => { load() }, [])

  function openNew() { setForm({ ...empty, data: new Date().toISOString().slice(0, 10) }); setEditId(null); setOpen(true) }
  function openEdit(o: Oprysk) {
    setForm({ folia_id: String(o.folia_id ?? ''), data: o.data, preparat: o.preparat ?? '', uwagi: o.uwagi ?? '' })
    setEditId(o.id); setOpen(true)
  }

  async function save() {
    const payload = { folia_id: form.folia_id ? Number(form.folia_id) : null, data: form.data, preparat: form.preparat || null, uwagi: form.uwagi || null }
    const { error } = editId
      ? await supabase.from('opryski').update(payload).eq('id', editId)
      : await supabase.from('opryski').insert(payload)
    if (error) { toast.error('Nie udało się zapisać: ' + error.message); return }
    toast.success(editId ? 'Oprysk zaktualizowany' : 'Oprysk dodany')
    setOpen(false); load()
  }

  async function remove(id: number) {
    if (!confirm('Usunąć oprysk?')) return
    const { error } = await supabase.from('opryski').delete().eq('id', id)
    if (error) { toast.error('Nie udało się usunąć: ' + error.message); return }
    toast.success('Oprysk usunięty'); load()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-gray-900">Opryski</h1>
        <Button onClick={openNew}>+ Dodaj oprysk</Button>
      </div>

      <div className="bg-white rounded-2xl border divide-y overflow-hidden">
        {opryski.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">Brak oprysków</div>
        )}
        {opryski.map(o => (
          <div key={o.id} className="flex items-center gap-3 px-4 py-3.5 active:bg-gray-50">
            <div className="bg-blue-100 rounded-xl p-2.5 shrink-0">
              <span className="text-xl leading-none">💧</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">
                {(o.folie as any)?.nazwa ?? '—'}
                {o.preparat && <span className="font-normal text-gray-500"> · {o.preparat}</span>}
              </p>
              <p className="text-sm text-gray-500">{o.data}</p>
              {o.uwagi && <p className="text-xs text-gray-400 mt-0.5 truncate">{o.uwagi}</p>}
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
          <DialogHeader><DialogTitle>{editId ? 'Edytuj oprysk' : 'Nowy oprysk'}</DialogTitle></DialogHeader>
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
            <div>
              <Label>Preparat</Label>
              <Input value={form.preparat} onChange={e => setForm(f => ({ ...f, preparat: e.target.value }))} placeholder="Nazwa preparatu" />
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
    </div>
  )
}
