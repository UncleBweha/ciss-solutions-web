export type StockLevel = { stock_quantity: number; reserved_quantity: number; low_stock_threshold: number }

export function availableQuantity(level: Pick<StockLevel, 'stock_quantity' | 'reserved_quantity'>): number {
  return Math.max(0, level.stock_quantity - level.reserved_quantity)
}

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock'

export function stockStatus(available: number, lowThreshold: number): StockStatus {
  if (available <= 0) return 'out_of_stock'
  if (available <= lowThreshold) return 'low_stock'
  return 'in_stock'
}

export const stockLabels: Record<StockStatus, string> = {
  in_stock: 'In stock',
  low_stock: 'Limited stock',
  out_of_stock: 'Out of stock',
}

/** Clamps a requested quantity to what can be sold (and the per-item cap). */
export function clampQuantity(requested: number, available: number, maxPerItem = 20): number {
  if (!Number.isFinite(requested)) return 1
  return Math.max(0, Math.min(Math.floor(requested), available, maxPerItem))
}

/** Stock after a manual adjustment; rejects going below what is reserved for orders. */
export function applyAdjustment(level: Pick<StockLevel, 'stock_quantity' | 'reserved_quantity'>, change: number) {
  const next = level.stock_quantity + change
  if (next < level.reserved_quantity) {
    return { ok: false as const, error: `Stock cannot go below the ${level.reserved_quantity} units reserved for open orders.` }
  }
  return { ok: true as const, stock: next }
}
