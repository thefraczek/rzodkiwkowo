'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const links = [
  { href: '/', label: 'Pulpit' },
  { href: '/podsumowania', label: 'Podsumowania' },
  { href: '/mapa', label: 'Folie' },
  { href: '/sianie', label: 'Sianie' },
  { href: '/zbiory', label: 'Zbiory' },
  { href: '/dostawy', label: 'Dostawy' },
  { href: '/zamowienia', label: 'Zamówienia' },
  { href: '/odbiorcy', label: 'Odbiorcy' },
  { href: '/opryski', label: 'Opryski' },
  { href: '/nawozy', label: 'Nawozy' },
  { href: '/nawadnianie', label: 'Nawadnianie' },
]

export default function Nav() {
  const pathname = usePathname()
  return (
    <header className='hidden md:block bg-white border-b border-gray-200 sticky top-0 z-10'>
      <div className='max-w-5xl mx-auto px-4'>
        <div className='flex items-center gap-1 h-14'>
          <span className='font-bold text-green-700 mr-3 shrink-0'>🌱 Rzodkiewkowo</span>
          <div className='flex items-center gap-1 overflow-x-auto flex-1'>
            {links.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                  pathname === l.href
                    ? 'bg-green-100 text-green-800 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className='ml-2 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md whitespace-nowrap transition-colors shrink-0'
          >
            Wyloguj
          </button>
        </div>
      </div>
    </header>
  )
}
