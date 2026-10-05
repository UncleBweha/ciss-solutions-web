'use client'

// Last-resort error page when the root layout itself fails (500).
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en-KE">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f3f4f6', color: '#111827', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 24 }}>
        <div>
          <h1 style={{ fontSize: 28 }}>CISS Solutions is temporarily unavailable</h1>
          <p style={{ color: '#b9c7df' }}>Please try again in a moment.</p>
          <button onClick={reset} style={{ marginTop: 16, background: '#0b6fd8', color: '#fff', border: 0, borderRadius: 12, padding: '12px 20px', fontWeight: 700, cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
