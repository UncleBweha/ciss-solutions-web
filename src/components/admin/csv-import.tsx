'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CheckCircle2, FileUp, XCircle } from 'lucide-react'
import { importProductsAction, previewImportAction, type ImportPreviewRow } from '@/actions/admin/products'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import { CSV_COLUMNS } from '@/lib/validation/product'
import { Panel, Table, Td, Th } from './admin-ui'

const TEMPLATE = `${CSV_COLUMNS.join(',')}\n"HP LaserJet Pro M404dn Pickup Roller",SP-RM2-5452,HP,Pickup Rollers,2500,,24,"Replacement Tray 2 pickup roller","Fixes misfeeds",spare_part,0.1,active\n`

export function CsvImport() {
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ImportPreviewRow[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const toast = useToast()
  const router = useRouter()
  const errors = rows?.filter((r) => r.errors.length).length ?? 0

  return (
    <div className="space-y-4">
      <Panel title="1. Upload CSV">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-surface">
            <FileUp className="h-4 w-4" aria-hidden="true" /> Choose file
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                setFileName(f.name)
                setCsv(await f.text())
                setRows(null)
                setMessage(null)
              }}
            />
          </label>
          <span className="text-sm text-fg-muted">{fileName || 'No file chosen'}</span>
          <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`} download="ciss-products-template.csv" className="ml-auto text-sm text-primary-light hover:underline">
            Download template
          </a>
        </div>
        <p className="mt-3 text-xs text-fg-muted">
          Columns: {CSV_COLUMNS.join(', ')}. Required: name, sku, price. Rows are matched by SKU: existing SKUs are updated, new SKUs are created (as drafts unless status is set). Brand and category must match existing names or slugs.
        </p>
      </Panel>

      <Panel title="2. Validate & preview">
        <Button disabled={!csv} loading={pending && !rows} onClick={() => start(async () => {
          const r = await previewImportAction(csv)
          if (!r.ok) return setMessage(r.message)
          setMessage(null)
          setRows(r.data!.rows)
        })}>
          Validate file
        </Button>
        {message ? <div className="mt-3"><FormMessage>{message}</FormMessage></div> : null}
        {rows ? (
          <div className="mt-4">
            <p className="mb-2 text-sm">
              {rows.length} rows · {rows.filter((r) => r.action === 'create').length} new · {rows.filter((r) => r.action === 'update').length} updates ·{' '}
              <span className={errors ? 'text-danger' : 'text-success'}>{errors} with errors</span>
            </p>
            <div className="max-h-96 overflow-y-auto rounded-lg border border-border">
              <Table>
                <thead><tr><Th>Line</Th><Th>SKU</Th><Th>Name</Th><Th>Price</Th><Th>Action</Th><Th>Result</Th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.line}>
                      <Td>{r.line}</Td><Td className="font-mono text-xs">{r.sku}</Td><Td className="max-w-xs truncate">{r.name}</Td>
                      <Td>{r.price ?? '—'}</Td><Td>{r.action}</Td>
                      <Td>{r.errors.length ? <span className="flex items-start gap-1 text-danger"><XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{r.errors.join('; ')}</span> : <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> OK</span>}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel title="3. Import">
        <Button disabled={!rows || errors > 0 || !rows.length} loading={pending && Boolean(rows)} onClick={() => start(async () => {
          const r = await importProductsAction(csv)
          toast(r.ok ? r.message ?? 'Imported' : r.message, r.ok ? 'success' : 'error')
          if (r.ok) router.push('/admin/products')
        })}>
          Import {rows?.length ?? 0} products
        </Button>
        {rows && errors ? <p className="mt-2 text-sm text-fg-muted">Fix the errors in your file and validate again before importing.</p> : null}
      </Panel>
    </div>
  )
}
