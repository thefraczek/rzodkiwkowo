import { ImageResponse } from 'next/og'

// iOS "Dodaj do ekranu poczatkowego" uzywa apple-touch-icon (PNG). Next generuje go z tego pliku.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// pelne tlo (bez zaokraglenia) - iOS sam zaokragla ikone
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#16a34a"/><g fill="#bbf7d0"><ellipse cx="50" cy="30" rx="7" ry="15"/><ellipse cx="35" cy="35" rx="6" ry="13" transform="rotate(-30 35 35)"/><ellipse cx="65" cy="35" rx="6" ry="13" transform="rotate(30 65 35)"/></g><path d="M50 48V33M50 48L37 39M50 48L63 39" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" fill="none"/><ellipse cx="50" cy="64" rx="23" ry="25" fill="#e11d48"/><ellipse cx="41" cy="56" rx="6" ry="9" fill="#fb7185" opacity="0.7"/><path d="M50 88q4 5-1 10" stroke="#fecdd3" stroke-width="3" stroke-linecap="round" fill="none"/></svg>`

export default function AppleIcon() {
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={180} height={180} alt="Rzodkiewkowo" />
      </div>
    ),
    size,
  )
}
