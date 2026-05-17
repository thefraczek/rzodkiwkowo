'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Folia } from '@/lib/types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import MapView from '@/components/MapView'

const empty = { nazwa: '', data_nalozenia: '', szerokosc: '160', wysokosc: '80' }

export default function MapaPage() {
  const [folie, setFolie] = useState<Folia[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState<number | null>(null)
  const [mapSignal, setMapSignal] = useState(0)

  async function load() {
    const { data } = await supabase.from('folie').select('*').order('created_at', { ascending: false })
    setFolie(data ?? [])
  }

  useEffect(() => { load() }, [])

  function openNew() { setForm(empty); setEditId(null); setOpen(true) }
  function openEdit(f: Folia) {
    setForm({ nazwa: f.nazwa, data_nalozenia: f.data_nalozenia ?? '', szerokosc: String(f.szerokosc), wysokosc: String(f.wysokosc) })
    setEditId(f.id); setOpen(true)
  }

  async function save() {
    const payload = { nazwa: form.nazwa, data_nalozenia: form.data_nalozenia || null, szerokosc: form.szerokosc ? Number(form.szerokosc) : 160, wysokosc: form.wysokosc ? Number(form.wysokosc) : 80 }
    const { error } = editId
      ? await supabase.from('folie').update(payload).eq('id', editId)
      : await supabase.from('folie').insert(payload)
    if (error) { toast.error('Nie udało się zapisać: ' + error.message); return }
    toast.success(editId ? 'Folia zaktualizowana' : 'Folia dodana')
    setOpen(false)
    load()
    setMapSignal(s => s + 1)
  }

  async function remove(id: number) {
    if (!confirm('Usunąć folię?')) return
    const { error } = await supabase.from('folie').delete().eq('id', id)
    if (error) { toast.error('Nie udało się usunąć: ' + error.message); return }
    toast.success('Folia usunięta')
    load()
    setMapSignal(s => s + 1)
  }

  return (
    <div className="space-y-6">
      {/* Mapa */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 mb-3">Folie</h1>
        <MapView allowEdit reloadSignal={mapSignal} />
      </div>

      {/* Lista folii */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-semibold text-gray-700">Folie ({folie.length})</h2>
          <Button onClick={openNew} size="sm">+ Dodaj folię</Button>
        </div>

        <div className="bg-white rounded-2xl border divide-y overflow-hidden">
          {folie.length === 0 && (
            <div className="py-10 text-center text-gray-400 text-sm">Brak folii</div>
          )}
          {folie.map(f => (
            <div key={f.id} className="flex items-center gap-3 px-4 py-3 active:bg-gray-50">
              <div className="w-3 self-stretch rounded-full shrink-0" style={{ background: f.kolor ?? '#d1d5db' }} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{f.nazwa}</p>
                <p className="text-sm text-gray-500">
                  {f.szerokosc} × {f.wysokosc} px
                  {f.data_nalozenia && <span> · Od {f.data_nalozenia}</span>}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEdit(f)} className="p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button onClick={() => remove(f.id)} className="p-2.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Edytuj folię' : 'Nowa folia'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Nazwa</Label>
              <Input value={form.nazwa} onChange={e => setForm(f => ({ ...f, nazwa: e.target.value }))} placeholder="np. Folia A1" />
            </div>
            <div>
              <Label>Data nałożenia</Label>
              <Input type="date" value={form.data_nalozenia} onChange={e => setForm(f => ({ ...f, data_nalozenia: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Szerokość na mapie (px)</Label>
                <Input type="number" value={form.szerokosc} onChange={e => setForm(f => ({ ...f, szerokosc: e.target.value }))} min="50" max="400" />
              </div>
              <div>
                <Label>Wysokość na mapie (px)</Label>
                <Input type="number" value={form.wysokosc} onChange={e => setForm(f => ({ ...f, wysokosc: e.target.value }))} min="30" max="300" />
              </div>
            </div>
            <p className="text-xs text-gray-400">Pozycję i kolor zmieniasz przeciągając prostokąt na mapie powyżej.</p>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Anuluj</Button>
              <Button onClick={save} disabled={!form.nazwa} className="flex-1">Zapisz</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
