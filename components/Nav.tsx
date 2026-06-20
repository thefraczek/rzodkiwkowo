'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const links = [
  { href: '/', label: 'Pulpit' },
  { href: '/nawadnianie', label: 'Podlewanie' },
  { href: '/harmonogram', label: 'Harmonogram' },
  { href: '/kolejka', label: 'Kolejka' },
  { href: '/sianie', label: 'Sianie' },
  { href: '/podsumowania', label: 'Podsumowania' },
  { href: '/zbiory', label: 'Zbiory' },
  { href: '/tempo', label: 'Tempo rwania' },
  { href: '/zamowienia', label: 'Zamówienia' },
  { href: '/dostawy', label: 'Dostawy' },
  { href: '/mapa', label: 'Folie' },
  { href: '/opryski', label: 'Opryski' },
  { href: '/nawozy', label: 'Nawozy' },
  { href: '/odbiorcy', label: 'Odbiorcy' },
]

export default function Nav() {
  const pathname = usePathname()
  return (
    <header className='hidden md:block shrink-0 bg-white border-b border-gray-200 z-10'>
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
