import { describe, expect, it } from 'vitest'
import { merchantFeed, type FeedProduct } from '@/lib/seo/feed'
import { productSnippet } from '@/lib/seo/metadata'
import { conditionOf } from '@/lib/seo/schema'

const site = { url: 'https://shop.example', name: 'Shop' }

const product = (over: Partial<FeedProduct> = {}): FeedProduct => ({
  id: 'p1',
  sku: 'C12C934591',
  slug: 'c9345-maintenance-box',
  name: 'C9345 Maintenance Box',
  short_description: null,
  description: null,
  price: 3000,
  compare_at_price: null,
  available_quantity: 4,
  part_number: 'C9345',
  barcode: null,
  condition: null,
  brand: 'Epson',
  category: 'Maintenance boxes',
  images: ['https://cdn.example/a.jpg'],
  variants: [],
  ...over,
})

describe('productSnippet', () => {
  it('rounds off a description that only repeats the name with price, stock and delivery', () => {
    const s = productSnippet({ ...product(), short_description: 'C9345 maintenance box' })
    expect(s).toBe('Buy C9345 Maintenance Box in Kenya. KSh 3,000, in stock. Delivery across Kenya, pay with M-Pesa.')
  })

  it('keeps a long description as written', () => {
    const long = 'A genuine Epson maintenance box that collects waste ink on L18050, L8050 and L15150 printers, fitted in under a minute.'
    expect(productSnippet({ ...product(), description: long })).toBe(long)
  })

  it('says "From" the lowest variant price and drops "in stock" when nothing is', () => {
    const s = productSnippet({
      ...product({ short_description: 'Ink bottle' }),
      variants: [
        { price: 900, available_quantity: 0 },
        { price: 750, available_quantity: 0 },
      ],
    })
    expect(s).toBe('Ink bottle. From KSh 750. Delivery across Kenya, pay with M-Pesa.')
  })
})

describe('conditionOf', () => {
  it('treats compatible and genuine parts as new', () => {
    expect(conditionOf('Compatible')).toBe('NewCondition')
    expect(conditionOf(null)).toBe('NewCondition')
  })
  it('recognises refurbished and used stock', () => {
    expect(conditionOf('Refurbished')).toBe('RefurbishedCondition')
    expect(conditionOf('Ex-UK')).toBe('UsedCondition')
  })
})

describe('merchantFeed', () => {
  it('lists a product with the fields Google requires', () => {
    const feed = merchantFeed([product()], site)
    expect(feed).toContain('<g:id>C12C934591</g:id>')
    expect(feed).toContain('<g:link>https://shop.example/p/c9345-maintenance-box</g:link>')
    expect(feed).toContain('<g:price>3000.00 KES</g:price>')
    expect(feed).toContain('<g:availability>in_stock</g:availability>')
    expect(feed).toContain('<g:condition>new</g:condition>')
    expect(feed).toContain('<g:mpn>C9345</g:mpn>')
    expect(feed).not.toContain('identifier_exists')
  })

  it('shows a discount as price plus sale_price', () => {
    const feed = merchantFeed([product({ price: 2500, compare_at_price: 3000 })], site)
    expect(feed).toContain('<g:price>3000.00 KES</g:price>')
    expect(feed).toContain('<g:sale_price>2500.00 KES</g:sale_price>')
  })

  it('prices a variant product as the variant its page opens on', () => {
    const feed = merchantFeed(
      [product({ variants: [{ price: 900, compare_at_price: null, available_quantity: 0 }, { price: 1200, compare_at_price: null, available_quantity: 3 }] })],
      site,
    )
    expect(feed).toContain('<g:price>1200.00 KES</g:price>')
    expect(feed).toContain('<g:availability>in_stock</g:availability>')
  })

  it('skips products without a raster image and flags missing identifiers', () => {
    const feed = merchantFeed([product({ images: ['https://cdn.example/a.svg'] }), product({ sku: 'X1', brand: null, part_number: null })], site)
    expect(feed).not.toContain('C12C934591')
    expect(feed).toContain('<g:identifier_exists>no</g:identifier_exists>')
  })

  it('escapes text so it cannot break the XML', () => {
    const feed = merchantFeed([product({ name: 'Ink & toner <set>' })], site)
    expect(feed).toContain('<g:title>Ink &amp; toner &lt;set&gt;</g:title>')
  })
})
