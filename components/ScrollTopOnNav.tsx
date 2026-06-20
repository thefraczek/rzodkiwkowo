'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Przy zmianie strony przewijamy wewnetrzny kontener (#app-main) na gore.
// Potrzebne, bo w ukladzie "app-shell" to <main> jest scrollerem, a nie cale okno.
export default function ScrollTopOnNav() {
  const pathname = usePathname()
  useEffect(() => {
    document.getElementById('app-main')?.scrollTo({ top: 0 })
  }, [pathname])
  return null
}
