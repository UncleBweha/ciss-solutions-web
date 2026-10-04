// Only on listing routes that never call notFound(): a loading boundary sends the
// 200 status early, which would turn real 404s into soft 404s.
export { ListingLoading as default } from '@/components/storefront/listing-loading'
