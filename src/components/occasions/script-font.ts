import localFont from 'next/font/local'

/** Great Vibes, for the "Happy" / "Merry" lettering on occasion posters
    only. Not preloaded: most days no poster shows, and on the days one does
    the lettering swaps in a moment after the page. */
export const scriptFont = localFont({
  src: '../../app/fonts/great-vibes-latin.woff2',
  weight: '400',
  style: 'normal',
  display: 'swap',
  preload: false,
  fallback: ['cursive'],
})
