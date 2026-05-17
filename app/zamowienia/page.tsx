'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Zamowienie, Odbiorca } from '@/lib/types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { type ZamowieniePozycja, serializePozycje, parsePozycjeFromTyp, cratesFromPozycje, formatPozycje } from '@/lib/order-lines'

const today = new Date().toISOString().slice(0, 10)

type FormPozycja = { typ: 'jedynka' | 'dwojka'; klatki: string }

const emptyPozycja = (): FormPozycja => ({ typ: 'jedynka', klatki: '' })

const empty = {
  odbiorca_id: '',
  data_na_kiedy: today,
  peczkow_w_klatce: '25',
  cena_za_peczek: '',
  uwagi: '',
  pozycje: [emptyPozycja()] as FormPozycja[],
}

function odbiorcaName(o: Odbiorca | undefined) {
  return o?.ksywa || [o?.imie, o?.nazwisko].filter(Boolean).join(' ') || '?'
}

function toNumber(value: string): number | null {
  if (!value) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function toModelPozycje(rows: FormPozycja[]): ZamowieniePozycja[] {
  return rows
    .map(r => ({ typ: r.typ, klatki: Number(r.klatki) || 0 }))
    .filter(r => r.klatki > 0)
}

export default function ZamowieniaPage() {
  const [zamowienia, setZamowienia] = useState<Zamowienie[]>([])
  const [odbiorcy, setOdbiorcy] = useState<Odbiorca[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState<number | null>(null)

  async function load() {
    const [z, o] = await Promise.all([
      supabase.from('zamowienia').select('*, odbiorcy(*)').order('data_na_kiedy', { ascending: false }).order('data_utworzenia', { ascending: false }),
      supabase.from('odbiorcy').select('*').order('ksywa'),
    ])
    setZamowienia((z.data as Zamowienie[]) ?? [])
    setOdbiorcy((o.data as Odbiorca[]) ?? [])
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setForm(empty)
    setEditId(null)
    setOpen(true)
  }

  function openEdit(z: Zamowienie) {
    const pwk = z.ilosc_w_klatce ?? 25
    const parsed = parsePozycjeFromTyp(z.typ, z.ilosc, pwk)

    setForm({
      odbiorca_id: String(z.odbiorca_id ?? ''),
      data_na_kiedy: z.data_na_kiedy ?? today,
      peczkow_w_klatce: String(pwk),
      cena_za_peczek: z.cena_za_peczek != null ? String(z.cena_za_peczek) : '',
      uwagi: z.uwagi ?? '',
      pozycje: parsed.length ? parsed.map(p => ({ typ: p.typ, klatki: String(p.klatki) })) : [emptyPozycja()],
    })
    setEditId(z.id)
    setOpen(true)
  }

  const preview = useMemo(() => {
    const pozycje = toModelPozycje(form.pozycje)
    const totalKlatek = cratesFromPozycje(pozycje)
    const pwk = toNumber(form.peczkow_w_klatce) ?? 25
    const totalPeczkow = totalKlatek * pwk
    const cenaZa = toNumber(form.cena_za_peczek)
    const cena = cenaZa != null ? totalPeczkow * cenaZa : null
    return { pozycje, totalKlatek, totalPeczkow, cena }
  }, [form])

  function updatePozycja(idx: number, patch: Partial<FormPozycja>) {
    setForm(f => ({
      ...f,
      pozycje: f.pozycje.map((p, i) => i === idx ? { ...p, ...patch } : p),
    }))
  }

  function addPozycja() {
    setForm(f => ({ ...f, pozycje: [...f.pozycje, emptyPozycja()] }))
  }

  function removePozycja(idx: number) {
    setForm(f => ({ ...f, pozycje: f.pozycje.filter((_, i) => i !== idx) || [emptyPozycja()] }))
  }

  async function save() {
    if (!form.odbiorca_id || preview.totalKlatek <= 0) {
      toast.error('Wybierz odbiorcę i podaj co najmniej jedną pozycję')
      return
    }

    const pwk = toNumber(form.peczkow_w_klatce) ?? 25
    const cenaZaPeczek = toNumber(form.cena_za_peczek)

    const payload = {
      odbiorca_id: Number(form.odbiorca_id),
      data_na_kiedy: form.data_na_kiedy || null,
      ilosc: preview.totalPeczkow,
      ilosc_w_klatce: pwk,
      typ: serializePozycje(preview.pozycje),
      cena_za_peczek: cenaZaPeczek,
      cena_calkowita: cenaZaPeczek != null ? Number((preview.totalPeczkow * cenaZaPeczek).toFixed(2)) : null,
      uwagi: form.uwagi || null,
    }

    const { error } = editId
      ? await supabase.from('zamowienia').update(payload).eq('id', editId)
      : await supabase.from('zamowienia').insert(payload)

    if (error) {
      toast.error('Nie udało się zapisać: ' + error.message)
      return
    }

    toast.success(editId ? 'Zamówienie zaktualizowane' : 'Zamówienie dodane')
    setOpen(false)
    load()
  }

  async function remove(id: number) {
    if (!confirm('Usunąć zamówienie?')) return
    const { error } = await supabase.from('zamowienia').delete().eq('id', id)
    if (error) {
      toast.error('Nie udało się usunąć: ' + error.message)
      return
    }
    toast.success('Zamówienie usunięte')
    load()
  }

  return (
    <div className='space-y-4'>
      <div className='flex justify-between items-center'>
        <h1 className='text-xl font-bold text-gray-900'>Zamówienia</h1>
        <Button onClick={openNew}>+ Dodaj</Button>
      </div>

      <div className='bg-white rounded-2xl border divide-y overflow-hidden'>
        {zamowienia.length === 0 && (
          <div className='py-12 text-center text-gray-400 text-sm'>Brak zamówień</div>
        )}

        {zamowienia.map(z => {
          const pwk = z.ilosc_w_klatce ?? 25
          const pozycje = parsePozycjeFromTyp(z.typ, z.ilosc, pwk)
          const totalK = cratesFromPozycje(pozycje)
          const peczki = z.ilosc ?? (totalK * pwk)

          return (
            <div key={z.id} className='flex items-center gap-3 px-4 py-3.5'>
              <div className='bg-purple-100 rounded-xl p-2.5 shrink-0'>
                <span className='text-xl leading-none'>📦</span>
              </div>

              <div className='flex-1 min-w-0'>
                <p className='font-semibold text-gray-900'>{odbiorcaName((z as any).odbiorcy)}</p>
                <p className='text-sm text-gray-500'>
                  {z.data_na_kiedy ?? 'bez daty'}
                  <span className='text-gray-400'> · </span>
                  {formatPozycje(pozycje)}
                  <span className='text-gray-400'> · </span>
                  {peczki} pęczków
                </p>
                {z.cena_calkowita != null && (
                  <p className='text-sm text-gray-500'>
                    do zapłaty: <span className='font-semibold text-gray-800'>{z.cena_calkowita} zł</span>
                  </p>
                )}
              </div>

              <div className='flex gap-1 shrink-0'>
                <button onClick={() => openEdit(z)} className='p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100'>
                  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/><path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'/></svg>
                </button>
                <button onClick={() => remove(z.id)} className='p-2.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50'>
                  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><polyline points='3 6 5 6 21 6'/><path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2'/></svg>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>{editId ? 'Edytuj zamówienie' : 'Nowe zamówienie'}</DialogTitle>
          </DialogHeader>

          <div className='space-y-3 mt-2'>
            <div>
              <Label>Odbiorca</Label>
              <Select value={form.odbiorca_id} onValueChange={v => setForm(p => ({ ...p, odbiorca_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder='Wybierz odbiorcę' /></SelectTrigger>
                <SelectContent>
                  {odbiorcy.map(o => <SelectItem key={o.id} value={String(o.id)}>{odbiorcaName(o)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data na kiedy</Label>
              <Input type='date' value={form.data_na_kiedy} onChange={e => setForm(p => ({ ...p, data_na_kiedy: e.target.value }))} />
            </div>

            <div>
              <div className='flex items-center justify-between mb-1'>
                <Label>Pozycje</Label>
                <Button type='button' variant='outline' size='sm' onClick={addPozycja}>+ Dodaj typ</Button>
              </div>
              <div className='space-y-2'>
                {form.pozycje.map((p, idx) => (
                  <div key={idx} className='grid grid-cols-[1fr_1fr_auto] gap-2'>
                    <Select value={p.typ} onValueChange={v => updatePozycja(idx, { typ: (v === 'dwojka' ? 'dwojka' : 'jedynka') })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value='jedynka'>Jedynka (duża)</SelectItem>
                        <SelectItem value='dwojka'>Dwójka (mała)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type='number' min='0' value={p.klatki} onChange={e => updatePozycja(idx, { klatki: e.target.value })} placeholder='Klatek' />
                    {form.pozycje.length > 1 && (
                      <Button type='button' variant='ghost' size='icon-sm' onClick={() => removePozycja(idx)}>✕</Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div>
                <Label>Pęczków w klatce</Label>
                <Input type='number' min='1' value={form.peczkow_w_klatce} onChange={e => setForm(p => ({ ...p, peczkow_w_klatce: e.target.value }))} />
              </div>
              <div>
                <Label>Cena za pęczek (opcjonalnie)</Label>
                <Input type='number' step='0.01' min='0' value={form.cena_za_peczek} onChange={e => setForm(p => ({ ...p, cena_za_peczek: e.target.value }))} />
              </div>
            </div>

            <div className='rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm text-purple-900'>
              <div><b>Razem:</b> {preview.totalKlatek} klatek</div>
              <div><b>Pęczków:</b> {preview.totalPeczkow}</div>
              {preview.cena != null && <div><b>Cena:</b> {preview.cena.toFixed(2)} zł</div>}
            </div>

            <div>
              <Label>Uwagi</Label>
              <Textarea value={form.uwagi} onChange={e => setForm(p => ({ ...p, uwagi: e.target.value }))} rows={2} />
            </div>

            <div className='flex gap-2 pt-1'>
              <Button variant='outline' onClick={() => setOpen(false)} className='flex-1'>Anuluj</Button>
              <Button onClick={save} className='flex-1'>Zapisz</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
