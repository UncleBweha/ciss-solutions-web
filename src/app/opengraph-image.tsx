import { ImageResponse } from 'next/og'

export const alt = 'CISS Solutions – Printers & Spare Parts in Kenya'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Default social sharing image (products use their own photos). */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          background: '#ffffff',
          color: '#111827',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', height: 10, width: 360, marginBottom: 44 }}>
          <div style={{ flex: 1, background: '#0891b2' }} />
          <div style={{ flex: 1, background: '#db2777' }} />
          <div style={{ flex: 1, background: '#eab308' }} />
          <div style={{ flex: 1, background: '#111827' }} />
        </div>
        <div style={{ fontSize: 96, fontWeight: 800 }}>CISS Solutions</div>
        <div style={{ fontSize: 52, fontWeight: 700, color: '#0b6fd8', marginTop: 8 }}>Printers, spare parts, ink &amp; toner</div>
        <div style={{ fontSize: 30, marginTop: 32, color: '#374151' }}>Nairobi, Kenya · Delivery across Kenya · Pay with M-Pesa</div>
      </div>
    ),
    size,
  )
}
