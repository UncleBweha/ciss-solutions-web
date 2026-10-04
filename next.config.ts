import type { NextConfig } from 'next'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
const supabaseHost = supabaseUrl ? new URL(supabaseUrl) : null
const canonicalHost = siteUrl ? new URL(siteUrl).host : null

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: supabaseHost
      ? [
          {
            protocol: supabaseHost.protocol.replace(':', '') as 'http' | 'https',
            hostname: supabaseHost.hostname,
            port: supabaseHost.port,
            pathname: '/storage/v1/object/public/**',
          },
        ]
      : [],
    // Local Supabase storage runs on 127.0.0.1 in development.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== 'production',
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  async rewrites() {
    // Browsers request /favicon.ico directly; serve the generated icon.
    return [{ source: '/favicon.ico', destination: '/icon' }]
  },
  async redirects() {
    // www.example.com -> example.com (canonical host from NEXT_PUBLIC_SITE_URL)
    if (!canonicalHost || canonicalHost.startsWith('www.') || canonicalHost.startsWith('localhost')) return []
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: `www.${canonicalHost}` }],
        destination: `${siteUrl}/:path*`,
        permanent: true,
      },
    ]
  },
}

export default nextConfig
