'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useFontSize } from './FontSizeProvider'

const primary = [
  { href: '/', icon: '🏠', label: 'Pulpit' },
  { href: '/zamowienia', icon: '📦', label: 'Zamówienia' },
  { href: '/zbiory', icon: '🥕', label: 'Zbiory' },
  { href: '/sianie', icon: '🌱', label: 'Sianie' },
]

const moreOperacyjne = [
  { href: '/podsumowania', icon: '📊', label: 'Podsumowania' },
  { href: '/dostawy', icon: '🚚', label: 'Dostawy' },
  { href: '/opryski', icon: '💧', label: 'Opryski' },
  { href: '/nawozy', icon: '🌿', label: 'Nawozy' },
]

const moreKonfiguracja = [
  { href: '/mapa', icon: '⚙️', label: 'Folie' },
  { href: '/odbiorcy', icon: '👥', label: 'Odbiorcy' },
]

const moreLinks = [...moreOperacyjne, ...moreKonfiguracja]

export default function BottomNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const moreActive = moreLinks.some(m => m.href === pathname)
  const { size, setSize } = useFontSize()

  return (
    <>
      <nav className='fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white border-t border-gray-200' style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className='flex' style={{ height: '64px' }}>
          {primary.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${active ? 'text-green-600' : 'text-gray-400'}`}>
                {active && <span className='absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-green-600 rounded-full' />}
                <span className='text-[22px] leading-none'>{item.icon}</span>
                <span className='text-[10px] font-medium'>{item.label}</span>
              </Link>
            )
          })}

          <button onClick={() => setOpen(true)} className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${moreActive ? 'text-green-600' : 'text-gray-400'}`}>
            {moreActive && <span className='absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-green-600 rounded-full' />}
            <svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'>
              <line x1='3' y1='6' x2='21' y2='6' /><line x1='3' y1='12' x2='21' y2='12' /><line x1='3' y1='18' x2='21' y2='18' />
            </svg>
            <span className='text-[10px] font-medium'>Więcej</span>
          </button>
        </div>
      </nav>

      {open && (
        <>
          <div className='fixed inset-0 bg-black/50 z-40 md:hidden' onClick={() => setOpen(false)} />
          <div className='fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[85svh]' style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {/* drag handle + header — zawsze widoczne */}
            <div className='shrink-0'>
              <div className='w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-3' />
              <div className='px-4 pb-3 flex items-center justify-between gap-3 border-b border-gray-100'>
                <div>
                  <p className='text-base font-semibold text-gray-900'>Więcej</p>
                  <p className='text-xs text-gray-400'>Dodatkowe sekcje i ustawienia</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label='Zamknij menu'
                  className='shrink-0 rounded-xl border border-gray-200 p-2.5 text-gray-500 active:bg-gray-100 transition-colors'
                >
                  <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'>
                    <line x1='18' y1='6' x2='6' y2='18' />
                    <line x1='6' y1='6' x2='18' y2='18' />
                  </svg>
                </button>
              </div>
            </div>

            {/* scrollowalna treść */}
            <div className='overflow-y-auto px-4 py-4 space-y-4'>
              <div>
                <p className='text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2'>Operacyjne</p>
                <div className='grid grid-cols-3 gap-2'>
                  {moreOperacyjne.map(item => (
                    <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-colors ${pathname === item.href ? 'bg-green-50 text-green-700' : 'text-gray-600 active:bg-gray-100'}`}>
                      <span className='text-2xl leading-none'>{item.icon}</span>
                      <span className='text-[11px] font-medium text-center leading-tight'>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <p className='text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2'>Konfiguracja</p>
                <div className='grid grid-cols-3 gap-2'>
                  {moreKonfiguracja.map(item => (
                    <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-colors ${pathname === item.href ? 'bg-green-50 text-green-700' : 'text-gray-500 active:bg-gray-100'}`}>
                      <span className='text-2xl leading-none'>{item.icon}</span>
                      <span className='text-[11px] font-medium text-center leading-tight'>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <p className='text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2'>Rozmiar czcionki</p>
                <div className='flex gap-2'>
                  {([
                    { value: 'normal', label: 'A', cls: 'text-sm' },
                    { value: 'large', label: 'A', cls: 'text-base' },
                    { value: 'xl', label: 'A', cls: 'text-xl' },
                  ] as const).map(opt => (
                    <button key={opt.value} onClick={() => setSize(opt.value)} className={`flex-1 py-3 rounded-xl font-semibold border-2 transition-colors ${opt.cls} ${size === opt.value ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 active:bg-gray-50'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className='pt-1 flex justify-end'>
                <button
                  onClick={() => { supabase.auth.signOut(); setOpen(false) }}
                  className='inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-sm text-red-500 active:bg-red-50 transition-colors'
                >
                  <span className='text-base'>🚪</span>
                  <span className='font-medium'>Wyloguj</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
