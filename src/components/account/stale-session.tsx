'use client'
import { useEffect } from 'react'

/**
 * Rendered on the sign-in page, which the server only shows when it has no valid session.
 * If this browser still holds one (it was ended from another device, or expired), clear it,
 * so the header stops showing the account as signed in and its links stop bouncing back here.
 */
export function ClearStaleSession() {
  useEffect(() => {
    void import('@/lib/supabase/client').then(async ({ createClient }) => {
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      if (data.session) await supabase.auth.signOut({ scope: 'local' })
    })
  }, [])
  return null
}
