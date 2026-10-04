import Link from 'next/link'
import type { ReactNode } from 'react'

// Minimal, safe Markdown subset for staff-edited pages: ## headings, paragraphs,
// "- " lists, **bold** and [links](/path). Output is React elements; raw HTML in
// the source is shown as text, never injected.

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1]) out.push(<strong key={`${key}-${i++}`}>{m[1]}</strong>)
    else {
      const href = m[3]
      const safe = href.startsWith('/') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:')
      out.push(
        safe ? (
          href.startsWith('/') ? (
            <Link key={`${key}-${i++}`} href={href} className="font-semibold text-primary-light underline">
              {m[2]}
            </Link>
          ) : (
            <a key={`${key}-${i++}`} href={href} className="font-semibold text-primary-light underline" rel="noopener noreferrer">
              {m[2]}
            </a>
          )
        ) : (
          m[2]
        ),
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Markdown({ source }: { source: string }) {
  const blocks = source.replace(/\r\n/g, '\n').split(/\n{2,}/)
  return (
    <div className="space-y-4 leading-relaxed text-fg-secondary">
      {blocks.map((block, b) => {
        const trimmed = block.trim()
        if (!trimmed) return null
        if (trimmed.startsWith('### ')) return <h3 key={b} className="pt-2 text-lg font-bold text-fg">{inline(trimmed.slice(4), `h${b}`)}</h3>
        if (trimmed.startsWith('## ')) return <h2 key={b} className="pt-4 text-xl font-bold text-fg">{inline(trimmed.slice(3), `h${b}`)}</h2>
        const lines = trimmed.split('\n')
        if (lines.every((l) => l.trim().startsWith('- '))) {
          return (
            <ul key={b} className="list-disc space-y-1.5 pl-5">
              {lines.map((l, i) => (
                <li key={i}>{inline(l.trim().slice(2), `l${b}-${i}`)}</li>
              ))}
            </ul>
          )
        }
        return <p key={b}>{inline(lines.join(' '), `p${b}`)}</p>
      })}
    </div>
  )
}
