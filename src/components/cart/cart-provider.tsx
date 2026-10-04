'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { saveCartAction, syncCartAction } from '@/actions/cart'
import { syncWishlistAction, toggleWishlistAction } from '@/actions/wishlist'
import { track } from '@/lib/analytics'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/env'

/** Display snapshot so the cart renders instantly; prices are re-quoted by the server. */
export type CartSnapshot = { name: string; slug: string; price: number; imageUrl: string | null; variantName: string | null; sku: string }
export type CartLine = { productId: string; variantId: string | null; quantity: number; snapshot?: CartSnapshot }

type CartContextValue = {
  items: CartLine[]
  count: number
  ready: boolean
  bump: number
  add: (line: CartLine) => void
  setQuantity: (productId: string, variantId: string | null, quantity: number) => void
  remove: (productId: string, variantId: string | null) => void
  clear: () => void
  replace: (lines: CartLine[]) => void
  wishlist: Set<string>
  toggleWishlist: (productId: string, name?: string) => Promise<'saved' | 'removed' | 'local'>
  signedIn: boolean
}

const CartContext = createContext<CartContextValue | null>(null)
const CART_KEY = 'ciss-cart-v1'
const WISHLIST_KEY = 'ciss-wishlist-v1'
const same = (a: CartLine, productId: string, variantId: string | null) => a.productId === productId && (a.variantId ?? null) === (variantId ?? null)

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage full or blocked (private mode): the in-memory cart still works
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([])
  const [wishlist, setWishlist] = useState<Set<string>>(new Set())
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [bump, setBump] = useState(0)
  const signedInRef = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load from this browser, then merge with the account if signed in.
  useEffect(() => {
    const localCart = load<CartLine[]>(CART_KEY, [])
    const localWishlist = load<string[]>(WISHLIST_KEY, [])
    setItems(localCart)
    setWishlist(new Set(localWishlist))
    setReady(true)

    if (!isSupabaseConfigured) return
    const supabase = createClient()

    const syncForUser = async () => {
      const [cart, wish] = await Promise.all([
        syncCartAction(load<CartLine[]>(CART_KEY, []).map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity }))),
        syncWishlistAction(load<string[]>(WISHLIST_KEY, [])),
      ])
      if (cart) {
        setItems((current) =>
          cart.map((c) => ({ ...c, snapshot: current.find((x) => same(x, c.productId, c.variantId))?.snapshot })),
        )
      }
      if (wish) setWishlist(new Set(wish))
    }

    supabase.auth.getSession().then(({ data }) => {
      const has = Boolean(data.session)
      signedInRef.current = has
      setSignedIn(has)
      if (has) void syncForUser()
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const has = Boolean(session)
      if (event === 'SIGNED_IN' && !signedInRef.current) void syncForUser()
      if (event === 'SIGNED_OUT') {
        // The account keeps its cart; this shared browser starts empty.
        setItems([])
        setWishlist(new Set())
      }
      signedInRef.current = has
      setSignedIn(has)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Persist locally always; to the account (debounced) when signed in.
  useEffect(() => {
    if (!ready) return
    store(CART_KEY, items)
    if (!signedInRef.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void saveCartAction(items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })))
    }, 700)
  }, [items, ready])

  useEffect(() => {
    if (ready) store(WISHLIST_KEY, [...wishlist])
  }, [wishlist, ready])

  const add = useCallback((line: CartLine) => {
    setItems((current) => {
      const existing = current.find((x) => same(x, line.productId, line.variantId))
      if (existing) {
        return current.map((x) =>
          same(x, line.productId, line.variantId) ? { ...x, quantity: Math.min(99, x.quantity + line.quantity), snapshot: line.snapshot ?? x.snapshot } : x,
        )
      }
      return [...current, line]
    })
    setBump((b) => b + 1)
    track('add_to_cart', {
      value: (line.snapshot?.price ?? 0) * line.quantity,
      items: [{ item_id: line.snapshot?.sku ?? line.productId, item_name: line.snapshot?.name, price: line.snapshot?.price, quantity: line.quantity }],
    })
  }, [])

  const setQuantity = useCallback((productId: string, variantId: string | null, quantity: number) => {
    setItems((current) =>
      quantity <= 0
        ? current.filter((x) => !same(x, productId, variantId))
        : current.map((x) => (same(x, productId, variantId) ? { ...x, quantity: Math.min(99, quantity) } : x)),
    )
  }, [])

  const remove = useCallback((productId: string, variantId: string | null) => {
    setItems((current) => {
      const line = current.find((x) => same(x, productId, variantId))
      if (line) track('remove_from_cart', { items: [{ item_id: line.snapshot?.sku ?? productId, quantity: line.quantity }] })
      return current.filter((x) => !same(x, productId, variantId))
    })
  }, [])

  const clear = useCallback(() => setItems([]), [])
  const replace = useCallback((lines: CartLine[]) => setItems(lines), [])

  const toggleWishlist = useCallback(async (productId: string, name?: string) => {
    const wasSaved = wishlist.has(productId)
    setWishlist((current) => {
      const next = new Set(current)
      if (wasSaved) next.delete(productId)
      else next.add(productId)
      return next
    })
    if (!wasSaved) track('wishlist_add', { items: [{ item_id: productId, item_name: name }] })
    if (!signedInRef.current) return 'local' as const
    const result = await toggleWishlistAction(productId)
    if ('error' in result) return 'local' as const
    return result.saved ? ('saved' as const) : ('removed' as const)
  }, [wishlist])

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      ready,
      bump,
      add,
      setQuantity,
      remove,
      clear,
      replace,
      wishlist,
      toggleWishlist,
      signedIn,
    }),
    [items, ready, bump, add, setQuantity, remove, clear, replace, wishlist, toggleWishlist, signedIn],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
