import 'server-only'
import { cache } from 'react'
import { tags } from '@/lib/cache'
import { isSupabaseConfigured } from '@/lib/env'
import { CACHE, publicClient } from '@/lib/supabase/public'

export const CONTENT_PAGES = ['about', 'faqs', 'privacy', 'terms', 'refund-policy', 'shipping-policy', 'warranty'] as const
export type ContentSlug = (typeof CONTENT_PAGES)[number]
export type ContentPage = { title: string; description: string; body: string; reviewed: boolean }

export const getContentPage = cache(async (slug: string): Promise<ContentPage | null> => {
  if (!(CONTENT_PAGES as readonly string[]).includes(slug) || !isSupabaseConfigured) return null
  const { data } = await publicClient([tags.settings, `page:${slug}`], CACHE.settings).from('settings').select('value').eq('key', `page:${slug}`).maybeSingle()
  return (data?.value as ContentPage | undefined) ?? null
})
