'use client'
import { useEffect } from 'react'
import { track } from '@/lib/analytics'

export function SearchTracker({ query, results }: { query: string; results: number }) {
  useEffect(() => {
    track('search', { search_term: query, results })
  }, [query, results])
  return null
}
