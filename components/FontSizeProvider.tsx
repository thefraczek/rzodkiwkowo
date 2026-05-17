'use client'
import { createContext, useContext, useEffect, useState } from 'react'

type Size = 'normal' | 'large' | 'xl'

const fontSizes: Record<Size, string> = {
  normal: '16px',
  large:  '19px',
  xl:     '22px',
}

const Ctx = createContext<{ size: Size; setSize: (s: Size) => void }>({
  size: 'normal',
  setSize: () => {},
})

export const useFontSize = () => useContext(Ctx)

export default function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [size, setSize] = useState<Size>('normal')

  useEffect(() => {
    const saved = localStorage.getItem('fontSize') as Size | null
    if (saved && fontSizes[saved]) setSize(saved)
  }, [])

  useEffect(() => {
    document.documentElement.style.fontSize = fontSizes[size]
    localStorage.setItem('fontSize', size)
  }, [size])

  return <Ctx.Provider value={{ size, setSize }}>{children}</Ctx.Provider>
}
