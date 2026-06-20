'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Zbior, Folia } from '@/lib/types'
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

const empty = { folia_id: '', data_zbioru: '', jedynka_klatki: '', dwojka_klatki: '', ilosc_w_klatce: '25', uwagi: '' }

function typLabel(typ: Zbior['typ']) {
  return typ === 'dwojka' ? 'Dwójka' : 'Jedynka'
}

function peczki(klatek: number | null, wKlatce: number | null): number | null {
  if (!klatek || !wKlatce) return null
  return klatek * wKlatce
}

function todayISO() { return new Date().toISOString().slice(0, 10) }
function minusDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

export default function ZbioryPage() {
  const [zbiory, setZbiory] = useState<Zbior[]>([])
  const [folie, setFolie] = useState<Folia[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState<number | null>(null)
  const [editTyp, setEditTyp] = useState<'jedynka' | 'dwojka'>('jedynka')
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null)
  const [okres, setOkres] = useState<'dzis' | '2dni' | '3dni' | 'wszystko'>('dzis')

  async function load() {
    const [z, f, s] = await Promise.all([
      supabase.from('zbiory').select('*, folie(nazwa)').order('data_zbioru', { ascending: false }),
      supabase.from('folie').select('*').order('nazwa'),
      supabase.from('sianie').select('folia_id, data').order('data', { ascending: true }),
    ])
    const rawFolie = (f.data as Folia[]) ?? []
    // oldest sowing date per folia
    const oldestSowing = new Map<number, string>()
    for (const row of s.data ?? []) {
      if (row.folia_id && !oldestSowing.has(row.folia_id)) oldestSowing.set(row.folia_id, row.data)
    }
    const sorted = [...rawFolie].sort((a, b) => {
      const aD = oldestSowing.get(a.id)
      const bD = oldestSowing.get(b.id)
      if (aD && bD) return aD.localeCompare(bD)
      if (aD) return -1
      if (bD) return 1
      return 0
    })
    setZbiory((z.data as Zbior[]) ?? [])
    setFolie(sorted)
  }

  useEffect(() => { load() }, [])
  useRefreshOnFocus(load)

  function openNew() {
    setForm({ ...empty, data_zbioru: new Date().toISOString().slice(0, 10) })
    setEditId(null)
    setOpen(true)
  }

  function openEdit(z: Zbior) {
    const typ = z.typ === 'dwojka' ? 'dwojka' : 'jedynka'
    setEditTyp(typ)
    setForm({
      folia_id: String(z.folia_id ?? ''),
      data_zbioru: z.data_zbioru,
      jedynka_klatki: typ === 'jedynka' ? String(z.ilosc_klatek ?? '') : '',
      dwojka_klatki: typ === 'dwojka' ? String(z.ilosc_klatek ?? '') : '',
      ilosc_w_klatce: String(z.ilosc_w_klatce ?? 25),
      uwagi: z.uwagi ?? '',
    })
    setEditId(z.id)
    setOpen(true)
  }

  async function save() {
    const base = {
      folia_id: form.folia_id ? Number(form.folia_id) : null,
      data_zbioru: form.data_zbioru,
      ilosc_w_klatce: form.ilosc_w_klatce ? Number(form.ilosc_w_klatce) : 25,
      uwagi: form.uwagi || null,
    }

    if (editId) {
      const klatki = editTyp === 'jedynka'
        ? (form.jedynka_klatki ? Number(form.jedynka_klatki) : 0)
        : (form.dwojka_klatki ? Number(form.dwojka_klatki) : 0)
      const { error } = await supabase.from('zbiory').update({ ...base, typ: editTyp, ilosc_klatek: klatki }).eq('id', editId)
      if (error) { toast.error('Nie udało się zapisać: ' + error.message); return }
      toast.success('Zbiór zaktualizowany')
      setOpen(false)
      load()
      return
    }

    const records: object[] = []
    const j = form.jedynka_klatki ? Number(form.jedynka_klatki) : 0
    const d = form.dwojka_klatki ? Number(form.dwojka_klatki) : 0
    if (j > 0) records.push({ ...base, typ: 'jedynka', ilosc_klatek: j })
    if (d > 0) records.push({ ...base, typ: 'dwojka', ilosc_klatek: d })
    if (records.length === 0) { toast.error('Wpisz ilość klatek dla przynajmniej jednego typu'); return }

    const { error } = await supabase.from('zbiory').insert(records)
    if (error) { toast.error('Nie udało się zapisać: ' + error.message); return }
    toast.success('Zbiór dodany')
    setOpen(false)
    load()
  }

  function remove(id: number) {
    setConfirmAction(() => async () => {
      const { error } = await supabase.from('zbiory').delete().eq('id', id)
      if (error) { toast.error('Nie udało się usunąć: ' + error.message); return }
      toast.success('Zbiór usunięty')
      load()
    })
  }

  const okresDni = okres === 'dzis' ? 1 : okres === '2dni' ? 2 : okres === '3dni' ? 3 : null
  const cutoff = okresDni ? minusDays(todayISO(), okresDni - 1) : null
  const wOkresie = cutoff ? zbiory.filter(z => z.data_zbioru >= cutoff) : zbiory
  const sumKlatki = wOkresie.reduce((s, z) => s + (z.ilosc_klatek ?? 0), 0)
  const sumJedynki = wOkresie.reduce((s, z) => s + ((z.typ !== 'dwojka' ? z.ilosc_klatek : 0) ?? 0), 0)
  const sumDwojki = wOkresie.reduce((s, z) => s + ((z.typ === 'dwojka' ? z.ilosc_klatek : 0) ?? 0), 0)
  const sumPeczki = wOkresie.reduce((s, z) => s + (peczki(z.ilosc_klatek, z.ilosc_w_klatce) ?? 0), 0)

  const pwk = form.ilosc_w_klatce ? Number(form.ilosc_w_klatce) : 25
  const previewJ = form.jedynka_klatki ? Number(form.jedynka_klatki) * pwk : 0
  const previewD = form.dwojka_klatki ? Number(form.dwojka_klatki) * pwk : 0
  const previewTotal = previewJ + previewD

  return (
    <div>
      <div className='flex justify-between items-center gap-2 mb-4'>
        <h1 className='text-xl font-bold text-gray-900'>Zbiory</h1>
        <Button size='sm' onClick={openNew} className='shrink-0'>+ Dodaj zbiór</Button>
      </div>

      {/* podsumowanie wg okresu */}
      <div className='bg-white rounded-2xl border p-4 mb-4'>
        <div className='flex gap-1.5 mb-3'>
          {([
            { v: 'dzis', label: 'Dziś' },
            { v: '2dni', label: '2 dni' },
            { v: '3dni', label: '3 dni' },
            { v: 'wszystko', label: 'Wszystko' },
          ] as const).map(o => (
            <button
              key={o.v}
              onClick={() => setOkres(o.v)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${okres === o.v ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 active:bg-gray-50'}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {wOkresie.length === 0 ? (
          <p className='text-sm text-gray-400 py-2 text-center'>Brak zbiorów w tym okresie</p>
        ) : (
          <div className='flex items-end justify-between'>
            <div>
              <p className='text-3xl font-bold text-gray-900 leading-none'>
                {sumKlatki} <span className='text-base font-medium text-gray-400'>klatek</span>
              </p>
              <div className='flex gap-4 mt-2 text-sm'>
                <span className='text-gray-600'>Jedynka <span className='font-semibold text-gray-900'>{sumJedynki}</span> kl.</span>
                <span className='text-gray-600'>Dwójka <span className='font-semibold text-gray-900'>{sumDwojki}</span> kl.</span>
              </div>
            </div>
            {sumPeczki > 0 && (
              <div className='text-right shrink-0'>
                <p className='text-xl font-bold text-orange-600 leading-none'>{sumPeczki}</p>
                <p className='text-xs text-gray-400 mt-0.5'>pęczków</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className='bg-white rounded-2xl border divide-y overflow-hidden'>
        {zbiory.length === 0 && (
          <div className='py-12 text-center text-gray-400 text-sm'>Brak zbiorów</div>
        )}

        {zbiory.map(z => {
          const suma = peczki(z.ilosc_klatek, z.ilosc_w_klatce)
          return (
            <div key={z.id} className='flex items-center gap-3 px-4 py-3.5 active:bg-gray-50'>
              <div className='bg-orange-100 rounded-xl p-2.5 shrink-0 flex items-center justify-center w-12 h-12'>
                <span className='text-xl leading-none'>🥕</span>
              </div>

              <div className='flex-1 min-w-0'>
                <p className='font-semibold text-gray-900'>{(z.folie as any)?.nazwa ?? '—'}</p>
                <p className='text-sm text-gray-500'>
                  {formatDatePL(z.data_zbioru)}
                  <span className='text-gray-400'> · {typLabel(z.typ)}</span>
                  {z.ilosc_w_klatce != null && (
                    <span className='text-gray-400'> · {z.ilosc_w_klatce} szt./kl.</span>
                  )}
                </p>
                {(z.ilosc_klatek != null || suma != null) && (
                  <p className='text-sm font-medium text-orange-600'>
                    {z.ilosc_klatek != null && <span>{z.ilosc_klatek} kl.</span>}
                    {z.ilosc_klatek != null && suma != null && <span className='text-orange-300'> · </span>}
                    {suma != null && <span>{suma} pęczków</span>}
                  </p>
                )}
                {z.uwagi && <p className='text-xs text-gray-400 mt-0.5 truncate'>{z.uwagi}</p>}
              </div>

              <div className='flex gap-1 shrink-0'>
                <button onClick={() => openEdit(z)} className='p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors'>
                  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/><path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'/></svg>
                </button>
                <button onClick={() => remove(z.id)} className='p-2.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors'>
                  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><polyline points='3 6 5 6 21 6'/><path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2'/></svg>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Edytuj zbiór' : 'Nowy zbiór'}</DialogTitle></DialogHeader>
          <div className='space-y-4 mt-2'>
            <div>
              <Label>Data zbioru</Label>
              <Input type='date' value={form.data_zbioru} onChange={e => setForm(f => ({ ...f, data_zbioru: e.target.value }))} />
            </div>
            <div>
              <Label>Folia <span className='text-gray-400 font-normal'>(opcjonalnie)</span></Label>
              <Select key={folie.length} value={form.folia_id} onValueChange={v => setForm(f => ({ ...f, folia_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder='Wybierz folię'>{folie.find(f => String(f.id) === form.folia_id)?.nazwa}</SelectValue></SelectTrigger>
                <SelectContent>{folie.map(fl => <SelectItem key={fl.id} value={String(fl.id)}>{fl.nazwa}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div>
                <Label>Jedynka (klatki)</Label>
                <Input
                  type='number'
                  inputMode='numeric'
                  value={form.jedynka_klatki}
                  onChange={e => setForm(f => ({ ...f, jedynka_klatki: e.target.value }))}
                  min='0'
                  placeholder='0'
                />
              </div>
              <div>
                <Label>Dwójka (klatki)</Label>
                <Input
                  type='number'
                  inputMode='numeric'
                  value={form.dwojka_klatki}
                  onChange={e => setForm(f => ({ ...f, dwojka_klatki: e.target.value }))}
                  min='0'
                  placeholder='0'
                />
              </div>
            </div>

            <div>
              <Label>Pęczków w klatce</Label>
              <Input type='number' value={form.ilosc_w_klatce} onChange={e => setForm(f => ({ ...f, ilosc_w_klatce: e.target.value }))} min='0' placeholder='25' />
            </div>

            {previewTotal > 0 && (
              <div className='bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 space-y-1'>
                {previewJ > 0 && (
                  <div className='flex justify-between text-sm'>
                    <span className='text-orange-600'>Jedynka</span>
                    <span className='font-semibold text-orange-700'>{previewJ} pęczków</span>
                  </div>
                )}
                {previewD > 0 && (
                  <div className='flex justify-between text-sm'>
                    <span className='text-orange-600'>Dwójka</span>
                    <span className='font-semibold text-orange-700'>{previewD} pęczków</span>
                  </div>
                )}
                {previewJ > 0 && previewD > 0 && (
                  <div className='flex justify-between text-sm border-t border-orange-200 pt-1 mt-1'>
                    <span className='text-orange-700 font-semibold'>Razem</span>
                    <span className='font-bold text-orange-800'>{previewTotal} pęczków</span>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>Uwagi</Label>
              <Textarea value={form.uwagi} onChange={e => setForm(f => ({ ...f, uwagi: e.target.value }))} rows={2} />
            </div>
            <div className='flex gap-2 pt-1'>
              <Button variant='outline' onClick={() => setOpen(false)} className='flex-1'>Anuluj</Button>
              <Button onClick={save} disabled={!form.data_zbioru} className='flex-1'>Zapisz</Button>
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
