'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { adjustStockAction, type AdjustInput } from '@/actions/admin/inventory'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'

const reasons = {
  purchase: 'Purchase / restock',
  return: 'Customer return',
  damage: 'Damaged / lost',
  correction: 'Stock count correction',
  manual_adjustment: 'Other manual adjustment',
}

export function StockAdjustButton({ productId, variantId, name, stock, reserved }: { productId: string; variantId: string | null; name: string; stock: number; reserved: number }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<AdjustInput['mode']>('add')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState<AdjustInput['reason']>('purchase')
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()
  const toast = useToast()
  const router = useRouter()
  const q = Number(quantity) || 0
  const next = mode === 'add' ? stock + q : mode === 'remove' ? stock - q : q

  return (
    <>
      <Button size="sm" variant="glass" onClick={() => setOpen(true)}>Adjust</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Adjust stock: ${name}`}>
        <div className="space-y-3">
          <p className="text-sm text-fg-secondary">On hand: <strong>{stock}</strong> · Reserved for orders: <strong>{reserved}</strong></p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Action" htmlFor="adj-mode">
              <Select id="adj-mode" value={mode} onChange={(e) => {
                const m = e.target.value as AdjustInput['mode']
                setMode(m)
                setReason(m === 'add' ? 'purchase' : m === 'remove' ? 'damage' : 'correction')
              }}>
                <option value="add">Add stock</option>
                <option value="remove">Remove stock</option>
                <option value="set">Set exact count</option>
              </Select>
            </Field>
            <Field label="Quantity" htmlFor="adj-qty"><Input id="adj-qty" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))} /></Field>
          </div>
          <Field label="Reason" htmlFor="adj-reason">
            <Select id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value as AdjustInput['reason'])}>
              {Object.entries(reasons).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Note" htmlFor="adj-note" hint="e.g. supplier invoice number"><Input id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <p className={next < reserved ? 'text-sm text-danger' : 'text-sm text-fg-secondary'}>
            New stock: <strong>{next}</strong>{next < reserved ? ' (below reserved; not allowed)' : ''}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={pending} disabled={!quantity || next < reserved} onClick={() => start(async () => {
              const r = await adjustStockAction({ productId, variantId, mode, quantity: q, reason, note })
              toast(r.ok ? r.message ?? 'Updated' : r.message, r.ok ? 'success' : 'error')
              if (r.ok) {
                setOpen(false)
                setQuantity('')
                setNote('')
                router.refresh()
              }
            })}>Save</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
