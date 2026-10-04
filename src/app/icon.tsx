import { ImageResponse } from 'next/og'

export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

/** Favicon: the CISS "C" mark with the CMYK stripe. */
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#07152f', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', fontSize: 44, fontWeight: 900, fontFamily: 'sans-serif' }}>C</div>
        <div style={{ display: 'flex', height: 8 }}>
          <div style={{ flex: 1, background: '#06b6d4' }} />
          <div style={{ flex: 1, background: '#db2777' }} />
          <div style={{ flex: 1, background: '#facc15' }} />
          <div style={{ flex: 1, background: '#e2e8f0' }} />
        </div>
      </div>
    ),
    size,
  )
}
