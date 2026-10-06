'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { saveCartAction, syncCartAction } from '@/actions/cart'
import { setWishlistAction, syncWishlistAction } from '@/actions/wishlist'
import { track } from '@/lib/analytics'
import { isSupabaseConfigured } from '@/lib/env'

/** Display snapshot so the cart renders instantly; prices are re-quoted by the server. */
export type CartSnapshot = { name: string; slug: string; price: number; imageUrl: string | null; variantName: string | null; sku: string }
/** Who is signed in, for the header and bottom bar. */
export type AccountSummary = { name: string | null; avatarUrl: string | null }
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
  account: AccountSummary | null
  /** Re-reads the name and picture after the customer edits their profile. */
  refreshAccount: () => void
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
  const [account, setAccount] = useState<AccountSummary | null>(null)
  const refreshAccountRef = useRef<() => void>(() => {})
  const [bump, setBump] = useState(0)
  const signedInRef = useRef(false)
  // Wishlist taps made while an account sync is in flight, re-applied on its result.
  const pendingWishlist = useRef(new Map<string, boolean>())
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load from this browser, then merge with the account if signed in.
  useEffect(() => {
    const localCart = load<CartLine[]>(CART_KEY, [])
    const localWishlist = load<string[]>(WISHLIST_KEY, [])
    // Hydrate from localStorage after mount: reading it during render would make
    // the server and client HTML differ.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(localCart)
    setWishlist(new Set(localWishlist))
    setReady(true)

    if (!isSupabaseConfigured) return
    let unsubscribe: (() => void) | undefined
    let cancelled = false

    const syncForUser = async () => {
      pendingWishlist.current.clear()
      const [cart, wish] = await Promise.all([
        syncCartAction(load<CartLine[]>(CART_KEY, []).map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity }))),
        syncWishlistAction(load<string[]>(WISHLIST_KEY, [])),
      ])
      if (cart) {
        // The server merged this browser's cart as it was when sync started; keep
        // anything added since (max quantity wins) instead of overwriting it.
        setItems((current) => {
          const merged: CartLine[] = cart.map((c) => {
            const local = current.find((x) => same(x, c.productId, c.variantId))
            return { ...c, quantity: Math.max(c.quantity, local?.quantity ?? 0), snapshot: local?.snapshot }
          })
          for (const local of current) if (!merged.some((m) => same(m, local.productId, local.variantId))) merged.push(local)
          return merged
        })
      }
      if (wish) {
        setWishlist(() => {
          const next = new Set(wish)
          for (const [id, saved] of pendingWishlist.current) {
            if (saved) next.add(id)
            else next.delete(id)
          }
          return next
        })
      }
    }

    // The Supabase client is only needed after first paint (session check), so it
    // is loaded lazily to keep it off the critical rendering path.
    void import('@/lib/supabase/client').then(({ createClient }) => {
      if (cancelled) return
      const supabase = createClient()
      // Name and picture: straight from the session first, then the saved profile
      // (an edited name or an uploaded picture wins over the Google one).
      const loadAccount = async (user: { id: string; user_metadata?: Record<string, unknown> }, replace = false) => {
        const meta = user.user_metadata ?? {}
        const text = (value: unknown) => (typeof value === 'string' && value ? value : null)
        const fromSession = { name: text(meta.full_name) ?? text(meta.name), avatarUrl: text(meta.avatar_url) ?? text(meta.picture) }
        setAccount((current) => (replace ? fromSession : (current ?? fromSession)))
        const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).maybeSingle()
        if (profile && !cancelled) setAccount({ name: profile.full_name ?? fromSession.name, avatarUrl: profile.avatar_url ?? fromSession.avatarUrl })
      }
      refreshAccountRef.current = () => {
        void supabase.auth.getSession().then(({ data }) => (data.session ? loadAccount(data.session.user) : undefined))
      }
      supabase.auth.getSession().then(({ data }) => {
        const has = Boolean(data.session)
        signedInRef.current = has
        setSignedIn(has)
        if (data.session) {
          void syncForUser()
          void loadAccount(data.session.user)
        }
      })
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        const has = Boolean(session)
        if (event === 'SIGNED_IN' && !signedInRef.current) void syncForUser()
        if (event === 'SIGNED_OUT') {
          // The account keeps its cart; this shared browser starts empty.
          setItems([])
          setWishlist(new Set())
          setAccount(null)
        }
        // Deferred: Supabase must not be queried from inside its own auth callback.
        if (event === 'SIGNED_IN' && session && !signedInRef.current) setTimeout(() => void loadAccount(session.user, true), 0)
        signedInRef.current = has
        setSignedIn(has)
      })
      unsubscribe = () => sub.subscription.unsubscribe()
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
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
    pendingWishlist.current.set(productId, !wasSaved)
    if (!wasSaved) track('wishlist_add', { items: [{ item_id: productId, item_name: name }] })
    if (!signedInRef.current) return 'local' as const
    const result = await setWishlistAction(productId, !wasSaved)
    if ('error' in result) return 'local' as const
    return result.saved ? ('saved' as const) : ('removed' as const)
  }, [wishlist])

  const refreshAccount = useCallback(() => refreshAccountRef.current(), [])

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
      account,
      refreshAccount,
    }),
    [items, ready, bump, add, setQuantity, remove, clear, replace, wishlist, toggleWishlist, signedIn, account, refreshAccount],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
