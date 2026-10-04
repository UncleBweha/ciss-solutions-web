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
          background: 'radial-gradient(60% 80% at 85% 20%, rgba(22,140,255,0.45), transparent 60%), radial-gradient(50% 70% at 0% 100%, rgba(139,92,246,0.35), transparent 60%), #07152f',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', height: 10, width: 360, marginBottom: 40 }}>
          <div style={{ flex: 1, background: '#06b6d4' }} />
          <div style={{ flex: 1, background: '#db2777' }} />
          <div style={{ flex: 1, background: '#facc15' }} />
          <div style={{ flex: 1, background: '#e2e8f0' }} />
        </div>
        <div style={{ fontSize: 28, letterSpacing: 6, color: '#38bdf8', fontWeight: 700 }}>PRINT SMARTER. SHOP BETTER.</div>
        <div style={{ fontSize: 92, fontWeight: 800, marginTop: 16 }}>CISS Solutions</div>
        <div style={{ fontSize: 64, fontWeight: 800, color: '#38bdf8' }}>Printers & Spare Parts</div>
        <div style={{ fontSize: 30, marginTop: 28, color: '#b9c7df' }}>Genuine printers, ink, toner and spare parts · Delivery across Kenya · M-Pesa</div>
      </div>
    ),
    size,
  )
}
