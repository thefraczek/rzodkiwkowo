'use client'

import { useState } from 'react'

export default function MobileHeader() {
  const [spinning, setSpinning] = useState(false)

  function reload() {
    setSpinning(true)
    window.location.reload()
  }

  return (
    <header
      className='xl:hidden sticky top-0 bg-white border-b border-gray-200 z-30 flex items-center px-4'
      style={{ height: '44px', paddingTop: 'env(safe-area-inset-top)' }}
    >
      <span className='font-bold text-green-700 flex-1 text-sm'>🌱 Rzodkiewkowo</span>
      <button
        onClick={reload}
        aria-label='Odśwież'
        className='p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors'
      >
        <svg
          width='18'
          height='18'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          className={spinning ? 'animate-spin' : ''}
        >
          <path d='M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' />
          <path d='M21 3v5h-5' />
          <path d='M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' />
          <path d='M8 16H3v5' />
        </svg>
      </button>
    </header>
  )
}
