'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Folia, Nasiono } from '@/lib/types'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatDatePL } from '@/lib/date'

type Akcja = 'sianie' | 'zbior' | 'oprysk' | 'nawoz' | null
type Info = { ostatnieSianie: string | null; ostatniZbior: string | null; klatek: number }

const KOLORY = ['#86efac', '#fde68a', '#fdba74', '#a5b4fc', '#f9a8d4', '#67e8f9', '#d1d5db']
const SVG_W = 900
const SVG_H = 1000

export default function MapView({ allowEdit = false, reloadSignal = 0 }: { allowEdit?: boolean; reloadSignal?: number }) {
  const [folie, setFolie] = useState<Folia[]>([])
  const [selected, setSelected] = useState<Folia | null>(null)
  const [akcja, setAkcja] = useState<Akcja>(null)
  const [info, setInfo] = useState<Info | null>(null)
  const [nasiona, setNasiona] = useState<Nasiono[]>([])
  const [nawozy, setNawozy] = useState<{ id: number; nazwa: string }[]>([])
  const [editMode, setEditMode] = useState(false)
  const [dragging, setDragging] = useState<{ id: number; startX: number; startY: number; origX: number; origY: number } | null>(null)
  const [dragMoved, setDragMoved] = useState(false)
  const [svgRef, setSvgRef] = useState<SVGSVGElement | null>(null)

  const [sianie, setSianie] = useState({ nasiona_id: '', uwagi: '' })
  const [zbior, setZbior] = useState({ typ: 'jedynka', ilosc_klatek: '', ilosc_w_klatce: '25', uwagi: '' })
  const [oprysk, setOprysk] = useState({ preparat: '', uwagi: '' })
  const [nawoz, setNawoz] = useState({ nawoz_id: '', ilosc: '', jednostka: 'kg' })

  async function load() {
    const [f, n, nw] = await Promise.all([
      supabase.from('folie').select('*').order('nazwa'),
      supabase.from('nasiona').select('*').order('nazwa'),
      supabase.from('nawozy_slownik').select('*').order('nazwa'),
    ])
    setFolie(f.data ?? [])
    setNasiona(n.data ?? [])
    setNawozy(nw.data ?? [])
  }

  useEffect(() => { load() }, [reloadSignal])

  async function loadInfo(foliaId: number) {
    const [s, z] = await Promise.all([
      supabase.from('sianie').select('data').eq('folia_id', foliaId).order('data', { ascending: false }).limit(1),
      supabase.from('zbiory').select('data_zbioru, ilosc_klatek').eq('folia_id', foliaId).order('data_zbioru', { ascending: false }),
    ])
    const totalKlatek = (z.data ?? []).reduce((s, r) => s + (r.ilosc_klatek ?? 0), 0)
    setInfo({ ostatnieSianie: s.data?.[0]?.data ?? null, ostatniZbior: z.data?.[0]?.data_zbioru ?? null, klatek: totalKlatek })
  }

  function selectFolia(f: Folia) {
    if (editMode) return
    setSelected(f)
    setAkcja(null)
    setInfo(null)
    loadInfo(f.id)
  }

  function getSvgPoint(e: React.MouseEvent): { x: number; y: number } | null {
    if (!svgRef) return null
    const pt = svgRef.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const svgP = pt.matrixTransform(svgRef.getScreenCTM()!.inverse())
    return { x: svgP.x, y: svgP.y }
  }

  function onMouseDown(e: React.MouseEvent, f: Folia) {
    if (!editMode) return
    e.preventDefault()
    const pt = getSvgPoint(e)
    if (!pt) return
    setDragMoved(false)
    setDragging({ id: f.id, startX: pt.x, startY: pt.y, origX: f.pos_x, origY: f.pos_y })
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging) return
    const pt = getSvgPoint(e)
    if (!pt) return
    const dx = Math.round(pt.x - dragging.startX)
    const dy = Math.round(pt.y - dragging.startY)
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) setDragMoved(true)
    setFolie(prev => prev.map(f => f.id === dragging.id
      ? { ...f, pos_x: Math.max(0, dragging.origX + dx), pos_y: Math.max(0, dragging.origY + dy) }
      : f
    ))
  }

  async function onMouseUp() {
    if (!dragging) return
    const f = folie.find(f => f.id === dragging.id)
    if (f) await supabase.from('folie').update({ pos_x: f.pos_x, pos_y: f.pos_y }).eq('id', f.id)
    setDragging(null)
  }

  async function changeColor(kolor: string) {
    if (!selected) return
    const { error } = await supabase.from('folie').update({ kolor }).eq('id', selected.id)
    if (error) { toast.error(error.message); return }
    setFolie(folie.map(f => f.id === selected.id ? { ...f, kolor } : f))
    setSelected(s => s ? { ...s, kolor } : s)
  }

  async function changeSize(field: 'szerokosc' | 'wysokosc', val: string) {
    if (!selected) return
    const num = Math.max(40, Number(val) || 0)
    await supabase.from('folie').update({ [field]: num }).eq('id', selected.id)
    setFolie(folie.map(f => f.id === selected.id ? { ...f, [field]: num } : f))
    setSelected(s => s ? { ...s, [field]: num } : s)
  }

  async function saveSianie() {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('sianie').insert({ folia_id: selected!.id, nasiona_id: sianie.nasiona_id ? Number(sianie.nasiona_id) : null, data: today, uwagi: sianie.uwagi || null })
    if (error) { toast.error('Błąd: ' + error.message); return }
    toast.success('Zasiew dodany — ' + selected!.nazwa)
    setSianie({ nasiona_id: '', uwagi: '' }); setAkcja(null); loadInfo(selected!.id)
  }

  async function saveZbior() {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('zbiory').insert({
      folia_id: selected!.id,
      data_zbioru: today,
      typ: zbior.typ === 'dwojka' ? 'dwojka' : 'jedynka',
      ilosc_klatek: zbior.ilosc_klatek ? Number(zbior.ilosc_klatek) : null,
      ilosc_w_klatce: zbior.ilosc_w_klatce ? Number(zbior.ilosc_w_klatce) : 25,
      uwagi: zbior.uwagi || null,
    })
    if (error) { toast.error('Błąd: ' + error.message); return }
    toast.success('Zbiór dodany — ' + selected!.nazwa)
    setZbior({ typ: 'jedynka', ilosc_klatek: '', ilosc_w_klatce: '25', uwagi: '' }); setAkcja(null); loadInfo(selected!.id)
  }

  async function saveOprysk() {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('opryski').insert({ folia_id: selected!.id, data: today, preparat: oprysk.preparat || null, uwagi: oprysk.uwagi || null })
    if (error) { toast.error('Błąd: ' + error.message); return }
    toast.success('Oprysk dodany — ' + selected!.nazwa)
    setOprysk({ preparat: '', uwagi: '' }); setAkcja(null)
  }

  async function saveNawoz() {
    const today = new Date().toISOString().slice(0, 10)
    const { data: nav, error: e1 } = await supabase.from('nawozenie').insert({ folia_id: selected!.id, data: today }).select('id').single()
    if (e1) { toast.error('Błąd: ' + e1.message); return }
    if (nawoz.nawoz_id) {
      await supabase.from('nawozenie_pozycje').insert({ nawozenie_id: nav.id, nawoz_id: Number(nawoz.nawoz_id), ilosc: nawoz.ilosc ? Number(nawoz.ilosc) : null, jednostka: nawoz.jednostka })
    }
    toast.success('Nawożenie dodane — ' + selected!.nazwa)
    setNawoz({ nawoz_id: '', ilosc: '', jednostka: 'kg' }); setAkcja(null)
  }

  return (
    <div>
      {allowEdit && (
        <div className="flex justify-end mb-3">
          <button
            onClick={() => { setEditMode(e => !e); setSelected(null) }}
            title="Tryb edycji układu"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              editMode
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            {editMode ? 'Zakończ edycję' : 'Ustaw układ'}
          </button>
        </div>
      )}

      {allowEdit && editMode && (
        <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800 flex items-center gap-2">
          <span>✏️</span>
          <span>Tryb edycji — przeciągaj folie, zmieniaj kolor i rozmiar. Kliknij folię, aby edytować jej ustawienia.</span>
        </div>
      )}

      {folie.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center text-gray-400">
          Brak folii. <a href="/folie" className="text-green-600 underline">Dodaj folię</a> najpierw.
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-auto">
          <svg
            ref={el => setSvgRef(el)}
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            style={{ width: '100%', maxWidth: SVG_W, height: 'auto', display: 'block', cursor: dragging ? 'grabbing' : 'default' }}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            {folie.map(f => (
              <g key={f.id}>
                <rect
                  x={f.pos_x} y={f.pos_y}
                  width={f.szerokosc} height={f.wysokosc}
                  rx={6}
                  fill={f.kolor}
                  stroke={selected?.id === f.id ? '#15803d' : editMode ? '#f59e0b' : '#9ca3af'}
                  strokeWidth={selected?.id === f.id ? 3 : editMode ? 2 : 1.5}
                  strokeDasharray={editMode && selected?.id !== f.id ? '6 3' : undefined}
                  style={{ cursor: editMode ? 'grab' : 'pointer' }}
                  onMouseDown={e => onMouseDown(e, f)}
                  onClick={() => {
                    if (editMode) {
                      if (dragMoved) return
                      setSelected(f)
                      setAkcja(null)
                      return
                    }
                    selectFolia(f)
                  }}
                />
                <text
                  x={f.pos_x + f.szerokosc / 2}
                  y={f.pos_y + f.wysokosc / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={13}
                  fontWeight={600}
                  fill="#1f2937"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {f.nazwa}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}

      {/* Dialog: akcje (tryb normalny) */}
      <Dialog open={!!selected && !editMode && !akcja} onOpenChange={o => { if (!o) setSelected(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{selected?.nazwa}</DialogTitle></DialogHeader>
          {info && (
            <div className="text-sm text-gray-500 space-y-1 mb-1 border-b pb-3">
              {selected?.metry_kwadratowe != null && <p>Powierzchnia: <span className="font-medium text-gray-700">{selected.metry_kwadratowe} m²</span></p>}
              {info.ostatnieSianie && <p>Ostatnie sianie: <span className="font-medium text-gray-700">{formatDatePL(info.ostatnieSianie)}</span></p>}
              {info.ostatniZbior && <p>Ostatni zbiór: <span className="font-medium text-gray-700">{formatDatePL(info.ostatniZbior)}</span></p>}
              {info.klatek > 0 && <p>Łącznie klatek: <span className="font-medium text-gray-700">{info.klatek}</span></p>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button className="bg-green-600 hover:bg-green-700 text-white h-14 flex flex-col gap-0.5" onClick={() => setAkcja('sianie')}>
              <span className="text-lg">🌱</span><span className="text-xs">Zasiew</span>
            </Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white h-14 flex flex-col gap-0.5" onClick={() => setAkcja('zbior')}>
              <span className="text-lg">🥕</span><span className="text-xs">Zbiór</span>
            </Button>
            <Button className="bg-blue-500 hover:bg-blue-600 text-white h-14 flex flex-col gap-0.5" onClick={() => setAkcja('oprysk')}>
              <span className="text-lg">💧</span><span className="text-xs">Oprysk</span>
            </Button>
            <Button className="bg-yellow-600 hover:bg-yellow-700 text-white h-14 flex flex-col gap-0.5" onClick={() => setAkcja('nawoz')}>
              <span className="text-lg">🌿</span><span className="text-xs">Nawóz</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: ustawienia folii (tylko tryb edycji) */}
      {allowEdit && (
        <Dialog open={!!selected && editMode} onOpenChange={o => { if (!o) setSelected(null) }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Ustawienia — {selected?.nazwa}</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Szerokość (px)</Label>
                  <Input type="number" defaultValue={selected?.szerokosc} min={40} max={400}
                    onBlur={e => changeSize('szerokosc', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Wysokość (px)</Label>
                  <Input type="number" defaultValue={selected?.wysokosc} min={30} max={300}
                    onBlur={e => changeSize('wysokosc', e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-2 block">Kolor</Label>
                <div className="flex gap-2 flex-wrap">
                  {KOLORY.map(k => (
                    <button key={k} onClick={() => changeColor(k)}
                      className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ background: k, borderColor: selected?.kolor === k ? '#15803d' : '#e5e7eb' }}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-400">Pozycję zmienisz przeciągając prostokąt na mapie.</p>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog zasiew */}
      <Dialog open={akcja === 'sianie'} onOpenChange={o => { if (!o) setAkcja(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>🌱 Zasiew — {selected?.nazwa}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Nasiona</Label>
              <Select value={sianie.nasiona_id} onValueChange={v => setSianie(s => ({ ...s, nasiona_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Wybierz nasiona" /></SelectTrigger>
                <SelectContent>{nasiona.map(n => <SelectItem key={n.id} value={String(n.id)}>{n.nazwa}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Uwagi</Label>
              <Textarea value={sianie.uwagi} onChange={e => setSianie(s => ({ ...s, uwagi: e.target.value }))} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAkcja(null)}>Anuluj</Button>
              <Button className="bg-green-600 hover:bg-green-700" onClick={saveSianie}>Dodaj dzisiaj</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog zbiór */}
      <Dialog open={akcja === 'zbior'} onOpenChange={o => { if (!o) setAkcja(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>🥕 Zbiór — {selected?.nazwa}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Typ rzodkiewki</Label>
              <Select value={zbior.typ} onValueChange={v => setZbior(s => ({ ...s, typ: v === 'dwojka' ? 'dwojka' : 'jedynka' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="jedynka">Jedynka (większa)</SelectItem>
                  <SelectItem value="dwojka">Dwójka (mniejsza)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ilość klatek</Label>
              <Input type="number" value={zbior.ilosc_klatek} onChange={e => setZbior(s => ({ ...s, ilosc_klatek: e.target.value }))} min="0" autoFocus />
            </div>
            <div>
              <Label>Pęczków w klatce</Label>
              <Input type="number" value={zbior.ilosc_w_klatce} onChange={e => setZbior(s => ({ ...s, ilosc_w_klatce: e.target.value }))} min="1" />
            </div>
            <div>
              <Label>Uwagi</Label>
              <Textarea value={zbior.uwagi} onChange={e => setZbior(s => ({ ...s, uwagi: e.target.value }))} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAkcja(null)}>Anuluj</Button>
              <Button className="bg-orange-500 hover:bg-orange-600" onClick={saveZbior}>Dodaj dzisiaj</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog oprysk */}
      <Dialog open={akcja === 'oprysk'} onOpenChange={o => { if (!o) setAkcja(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>💧 Oprysk — {selected?.nazwa}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Preparat</Label>
              <Input value={oprysk.preparat} onChange={e => setOprysk(s => ({ ...s, preparat: e.target.value }))} placeholder="Nazwa preparatu" autoFocus />
            </div>
            <div>
              <Label>Uwagi</Label>
              <Textarea value={oprysk.uwagi} onChange={e => setOprysk(s => ({ ...s, uwagi: e.target.value }))} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAkcja(null)}>Anuluj</Button>
              <Button className="bg-blue-500 hover:bg-blue-600" onClick={saveOprysk}>Dodaj dzisiaj</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog nawóz */}
      <Dialog open={akcja === 'nawoz'} onOpenChange={o => { if (!o) setAkcja(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>🌿 Nawóz — {selected?.nazwa}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Nawóz</Label>
              <Select value={nawoz.nawoz_id} onValueChange={v => setNawoz(s => ({ ...s, nawoz_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Wybierz nawóz" /></SelectTrigger>
                <SelectContent>{nawozy.map(n => <SelectItem key={n.id} value={String(n.id)}>{n.nazwa}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>Ilość</Label>
                <Input type="number" value={nawoz.ilosc} onChange={e => setNawoz(s => ({ ...s, ilosc: e.target.value }))} />
              </div>
              <div>
                <Label>Jednostka</Label>
                <Select value={nawoz.jednostka} onValueChange={v => setNawoz(s => ({ ...s, jednostka: v ?? 'kg' }))}>
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="kg">kg</SelectItem><SelectItem value="g">g</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAkcja(null)}>Anuluj</Button>
              <Button className="bg-yellow-600 hover:bg-yellow-700" onClick={saveNawoz}>Dodaj dzisiaj</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

