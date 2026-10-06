// The 47 counties of Kenya (reference data for delivery forms).
export const KENYA_COUNTIES = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay', 'Isiolo',
  'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale',
  'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa',
  "Murang'a", 'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya',
  'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga',
  'Wajir', 'West Pokot',
] as const

export type County = (typeof KENYA_COUNTIES)[number]

export function isCounty(value: string): value is County {
  return (KENYA_COUNTIES as readonly string[]).includes(value)
}

/**
 * Normalises a Kenyan mobile number to the 2547XXXXXXXX / 2541XXXXXXXX format
 * M-Pesa expects. Returns null if it is not a valid Kenyan mobile number.
 */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '').replace(/^\+/, '')
  let local: string
  if (/^254[17]\d{8}$/.test(digits)) local = digits.slice(3)
  else if (/^0[17]\d{8}$/.test(digits)) local = digits.slice(1)
  else if (/^[17]\d{8}$/.test(digits)) local = digits
  else return null
  return `254${local}`
}

/** 254712345678 -> 0712345678, the way customers type it. No spaces, so it can be copied or edited as is. */
export function formatKenyanPhone(phone: string): string {
  const normalized = normalizeKenyanPhone(phone)
  return normalized ? `0${normalized.slice(3)}` : phone
}

/** 254712345678 -> 0712***678 for receipts and admin lists */
export function maskPhone(phone: string): string {
  return formatKenyanPhone(phone).replace(/^(\d{4})\d{3}/, '$1***')
}
