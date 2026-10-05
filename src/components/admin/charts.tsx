'use client'
import { useState } from 'react'
import { formatKES } from '@/lib/ecommerce/money'

// Single-series charts for the admin dashboard. One validated hue (--primary
// against the admin surface), thin marks with a 2px gap, rounded data-ends on
// the baseline, a recessive grid, hover tooltips, and a table view.

type Point = { label: string; value: number }

function niceMax(max: number) {
  if (max <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(max))
  const n = max / pow
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow
}

const compact = new Intl.NumberFormat('en-KE', { notation: 'compact', maximumFractionDigits: 1 })

export type Unit = 'kes' | 'count'
const formatters: Record<Unit, (v: number) => string> = {
  kes: (v) => formatKES(v),
  count: (v) => v.toLocaleString('en-KE'),
}

export function ColumnChart({
  title,
  data,
  unit = 'count',
  height = 180,
}: {
  title: string
  data: Point[]
  unit?: Unit
  height?: number
}) {
  const format = formatters[unit]
  const [hover, setHover] = useState<number | null>(null)
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)))
  const ticks = [0, max / 2, max]
  const width = 100 // percentage-based columns
  const colWidth = width / Math.max(1, data.length)
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <figure>
      <figcaption className="sr-only">
        {title}. Total {format(total)}.
      </figcaption>
      <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
        {/* grid + axis labels */}
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${(t / max) * 100}%` }} aria-hidden="true">
            <span className="w-10 -translate-y-1/2 text-right text-[10px] tabular-nums text-fg-muted">{compact.format(t)}</span>
            <span className="h-px flex-1 -translate-y-1/2 bg-border" />
          </div>
        ))}
        <div className="absolute inset-y-0 left-12 right-0 flex items-end" role="img" aria-label={title}>
          {data.map((d, i) => (
            <div
              key={d.label + i}
              className="relative flex h-full items-end justify-center"
              style={{ width: `${colWidth}%`, paddingInline: 1 }}
              onMouseEnter={() => setHover(i)}
            >
              <div
                className="w-full max-w-6 rounded-t-[4px] transition-opacity"
                style={{
                  height: `${(d.value / max) * 100}%`,
                  minHeight: d.value > 0 ? 2 : 0,
                  background: 'var(--primary)',
                  opacity: hover === null || hover === i ? 1 : 0.45,
                }}
              />
            </div>
          ))}
          {hover !== null ? (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-border bg-background-secondary px-2.5 py-1.5 text-xs shadow-lg"
              style={{ left: `${(hover + 0.5) * colWidth}%` }}
            >
              <span className="block text-fg-muted">{data[hover].label}</span>
              <span className="font-semibold tabular-nums text-fg">{format(data[hover].value)}</span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="ml-12 mt-1.5 flex justify-between text-[10px] text-fg-muted" aria-hidden="true">
        <span>{data[0]?.label}</span>
        <span>{data[Math.floor(data.length / 2)]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
      <DataTable title={title} rows={data.map((d) => [d.label, format(d.value)])} />
    </figure>
  )
}

/** Ranked horizontal bars (top products / categories). */
export function BarList({ title, data, unit = 'count' }: { title: string; data: Point[]; unit?: Unit }) {
  const format = formatters[unit]
  const max = Math.max(1, ...data.map((d) => d.value))
  if (!data.length) return <p className="py-6 text-center text-sm text-fg-muted">No sales in this period yet.</p>
  return (
    <figure>
      <figcaption className="sr-only">{title}</figcaption>
      <ul className="space-y-2.5">
        {data.map((d) => (
          <li key={d.label} title={`${d.label}: ${format(d.value)}`}>
            <div className="mb-1 flex justify-between gap-3 text-xs">
              <span className="truncate text-fg-secondary">{d.label}</span>
              <span className="font-semibold tabular-nums text-fg">{format(d.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-surface">
              <div className="h-2 rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: 'var(--primary)' }} />
            </div>
          </li>
        ))}
      </ul>
    </figure>
  )
}

function DataTable({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer text-fg-muted hover:text-fg">Show data table</summary>
      <table className="mt-2 w-full">
        <caption className="sr-only">{title}</caption>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-border/50">
              <th scope="row" className="py-1 text-left font-normal text-fg-muted">{k}</th>
              <td className="py-1 text-right tabular-nums">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
