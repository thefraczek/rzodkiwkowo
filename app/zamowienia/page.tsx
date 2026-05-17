'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Zamowienie, Odbiorca } from '@/lib/types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const empty = { odbiorca_id: '', data_na_kiedy: '', ilosc: '', typ: '', ilosc_w_klatce: '', cena_za_peczek: '', cena_calkowita: '', uwagi: '' }

export default function ZamowieniaPage() {
  const [zamowienia, setZamowienia] = useState<Zamowienie[]>([])
  const [odbiorcy, setOdbiorcy] = useState<Odbiorca[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState<number | null>(null)

  async function load() {
    const [z, o] = await Promise.all([
      supabase.from('zamowienia').select('*, odbiorcy(imie, nazwisko, ksywa)').order('data_na_kiedy', { ascending: false }),
      supabase.from('odbiorcy').select('*').order('ksywa'),
    ])
    setZamowienia(z.data ?? [])
    setOdbiorcy(o.data ?? [])
  }

  useEffect(() => { load() }, [])

  function odbiorcaName(o: Odbiorca) {
    return o.ksywa || [o.imie, o.nazwisko].filter(Boolean).join(' ') || '?'
  }

  function openNew() { setForm({ ...empty, data_na_kiedy: new Date().toISOString().slice(0, 10) }); setEditId(null); setOpen(true) }
  function openEdit(z: Zamowienie) {
    setForm({
      odbiorca_id: String(z.odbiorca_id ?? ''), data_na_kiedy: z.data_na_kiedy ?? '',
      ilosc: String(z.ilosc ?? ''), typ: z.typ ?? '',
      ilosc_w_klatce: String(z.ilosc_w_klatce ?? ''),
      cena_za_peczek: String(z.cena_za_peczek ?? ''),
      cena_calkowita: String(z.cena_calkowita ?? ''),
      uwagi: z.uwagi ?? '',
    })
    setEditId(z.id); setOpen(true)
  }

  async function save() {
    const payload = {
      odbiorca_id: form.odbiorca_id ? Number(form.odbiorca_id) : null,
      data_na_kiedy: form.data_na_kiedy || null,
      ilosc: form.ilosc ? Number(form.ilosc) : null,
      typ: form.typ || null,
      ilosc_w_klatce: form.ilosc_w_klatce ? Number(form.ilosc_w_klatce) : null,
      cena_za_peczek: form.cena_za_peczek ? Number(form.cena_za_peczek) : null,
      cena_calkowita: form.cena_calkowita ? Number(form.cena_calkowita) : null,
      uwagi: form.uwagi || null,
    }
    const { error } = editId
      ? await supabase.from('zamowienia').update(payload).eq('id', editId)
      : await supabase.from('zamowienia').insert(payload)
    if (error) { toast.error('Nie udało się zapisać: ' + error.message); return }
    toast.success(editId ? 'Zamówienie zaktualizowane' : 'Zamówienie dodane')
    setOpen(false); load()
  }

  async function remove(id: number) {
    if (!confirm('Usunąć zamówienie?')) return
    const { error } = await supabase.from('zamowienia').delete().eq('id', id)
    if (error) { toast.error('Nie udało się usunąć: ' + error.message); return }
    toast.success('Zamówienie usunięte'); load()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-gray-900">Zamówienia</h1>
        <Button onClick={openNew}>+ Dodaj</Button>
      </div>

      <div className="bg-white rounded-2xl border divide-y overflow-hidden">
        {zamowienia.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">Brak zamówień</div>
        )}
        {zamowienia.map(z => (
          <div key={z.id} className="flex items-center gap-3 px-4 py-3.5 active:bg-gray-50">
            <div className="bg-purple-100 rounded-xl p-2.5 shrink-0">
              <span className="text-xl leading-none">📦</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-900">
                  {(z.odbiorcy as any) ? odbiorcaName(z.odbiorcy as Odbiorca) : '—'}
                </p>
                {z.ilosc != null && (
                  <span className="text-sm font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                    {z.ilosc} pęczków
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {z.data_na_kiedy ?? '—'}
                {z.cena_za_peczek != null && <span> · {z.cena_za_peczek} zł/pęczek</span>}
                {z.typ && <span> · {z.typ}</span>}
              </p>
              {z.uwagi && <p className="text-xs text-gray-400 mt-0.5 truncate">{z.uwagi}</p>}
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => openEdit(z)} className="p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button onClick={() => remove(z.id)} className="p-2.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? 'Edytuj zamówienie' : 'Nowe zamówienie'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Odbiorca</Label>
              <Select value={form.odbiorca_id} onValueChange={v => setForm(p => ({ ...p, odbiorca_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Wybierz odbiorcę" /></SelectTrigger>
                <SelectContent>{odbiorcy.map(o => <SelectItem key={o.id} value={String(o.id)}>{odbiorcaName(o)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data na kiedy</Label>
              <Input type="date" value={form.data_na_kiedy} onChange={e => setForm(p => ({ ...p, data_na_kiedy: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ilość (pęczki)</Label>
                <Input type="number" value={form.ilosc} onChange={e => setForm(p => ({ ...p, ilosc: e.target.value }))} min="0" />
              </div>
              <div>
                <Label>Typ</Label>
                <Input value={form.typ} onChange={e => setForm(p => ({ ...p, typ: e.target.value }))} placeholder="np. duże" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Ilość w klatce</Label>
                <Input type="number" value={form.ilosc_w_klatce} onChange={e => setForm(p => ({ ...p, ilosc_w_klatce: e.target.value }))} />
              </div>
              <div>
                <Label>Cena / pęczek</Label>
                <Input type="number" value={form.cena_za_peczek} onChange={e => setForm(p => ({ ...p, cena_za_peczek: e.target.value }))} step="0.01" />
              </div>
              <div>
                <Label>Cena całkowita</Label>
                <Input type="number" value={form.cena_calkowita} onChange={e => setForm(p => ({ ...p, cena_calkowita: e.target.value }))} step="0.01" />
              </div>
            </div>
            <div>
              <Label>Uwagi</Label>
              <Textarea value={form.uwagi} onChange={e => setForm(p => ({ ...p, uwagi: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Anuluj</Button>
              <Button onClick={save} className="flex-1">Zapisz</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
