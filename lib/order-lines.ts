export type TypRzodkiewki = 'jedynka' | 'dwojka'

export type ZamowieniePozycja = {
  typ: TypRzodkiewki
  klatki: number
}

export function normalizePozycje(pozycje: ZamowieniePozycja[]): ZamowieniePozycja[] {
  return pozycje
    .map(p => ({ typ: p.typ, klatki: Number(p.klatki) || 0 }))
    .filter(p => p.klatki > 0)
}

export function serializePozycje(pozycje: ZamowieniePozycja[]): string | null {
  const clean = normalizePozycje(pozycje)
  if (!clean.length) return null
  return JSON.stringify(clean)
}

export function parsePozycjeFromTyp(typRaw: string | null, totalPeczkow?: number | null, peczkowWKlatce?: number | null): ZamowieniePozycja[] {
  if (!typRaw) {
    const fallback = fallbackFromTotals(totalPeczkow, peczkowWKlatce)
    return fallback ? [fallback] : []
  }

  // New format: JSON array [{ typ, klatki }]
  if (typRaw.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(typRaw) as Array<{ typ?: string; klatki?: number }>
      return normalizePozycje(
        parsed
          .filter(Boolean)
          .map(p => ({
            typ: p.typ === 'dwojka' ? 'dwojka' : 'jedynka',
            klatki: Number(p.klatki) || 0,
          }))
      )
    } catch {
      // fall through
    }
  }

  // Legacy format: plain typ text
  if (typRaw === 'jedynka' || typRaw === 'dwojka') {
    const fallback = fallbackFromTotals(totalPeczkow, peczkowWKlatce)
    return fallback ? [{ ...fallback, typ: typRaw }] : []
  }

  const fallback = fallbackFromTotals(totalPeczkow, peczkowWKlatce)
  return fallback ? [fallback] : []
}

function fallbackFromTotals(totalPeczkow?: number | null, peczkowWKlatce?: number | null): ZamowieniePozycja | null {
  if (!totalPeczkow || !peczkowWKlatce || peczkowWKlatce <= 0) return null
  return {
    typ: 'jedynka',
    klatki: Math.ceil(totalPeczkow / peczkowWKlatce),
  }
}

export function cratesFromPozycje(pozycje: ZamowieniePozycja[]): number {
  return normalizePozycje(pozycje).reduce((s, p) => s + p.klatki, 0)
}

export function formatPozycje(pozycje: ZamowieniePozycja[]): string {
  const clean = normalizePozycje(pozycje)
  if (!clean.length) return 'brak pozycji'
  return clean
    .map(p => `${p.klatki} kl. ${p.typ === 'jedynka' ? 'jedynki' : 'dwójki'}`)
    .join(' + ')
}
