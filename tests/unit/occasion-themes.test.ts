import { describe, expect, it } from 'vitest'
import { occasionDateLabel, occasionIntensity, peakCountdown, posterMessage, splitHeadline, themeFor, themeKeyFor } from '@/lib/occasions/themes'

const occasion = (slug: string, name: string, kind = 'international', decoration = 'none') =>
  ({ slug, name, kind, decoration, accentColor: '#1d6fd8' }) as Parameters<typeof themeFor>[0]

describe('occasion themes', () => {
  it('matches each occasion to its look', () => {
    expect(themeKeyFor(occasion('utamaduni-day', 'Mazingira Day', 'kenyan_national', 'flag_bunting'))).toBe('mazingira')
    expect(themeKeyFor(occasion('jamhuri-day', 'Jamhuri Day', 'kenyan_national', 'flag_bunting'))).toBe('kenya')
    expect(themeKeyFor(occasion('girlfriends-day', "Girlfriend's Day", 'international', 'hearts'))).toBe('love')
    expect(themeKeyFor(occasion('eid-al-adha', 'Eid al-Adha', 'religious', 'crescent_lanterns'))).toBe('eid')
    expect(themeKeyFor(occasion('customer-service-week', 'Customer Service Week'))).toBe('service')
    expect(themeKeyFor(occasion('shop-anniversary', 'Shop Anniversary'))).toBe('celebration')
  })

  it('splits the headline into script, title and tagline', () => {
    expect(splitHeadline('Happy Mazingira Day')).toEqual({ script: 'Happy', title: 'Mazingira Day', tagline: null })
    expect(splitHeadline('Happy New Year!')).toEqual({ script: 'Happy', title: 'New Year', tagline: null })
    expect(splitHeadline('Eid Mubarak')).toEqual({ script: null, title: 'Eid Mubarak', tagline: null })
    expect(splitHeadline('Customer Service Week: thank you for shopping with us')).toEqual({
      script: null,
      title: 'Customer Service Week',
      tagline: 'thank you for shopping with us',
    })
  })

  it('never shows an admin date note to customers', () => {
    const theme = themeFor(occasion('eid-al-fitr', 'Eid al-Fitr', 'religious', 'crescent_lanterns'))
    expect(posterMessage("Date is synced automatically from Google's Kenya holiday calendar.", theme)).toBe(theme.message)
    expect(posterMessage("Celebrating Kenya's environment.", theme)).toBe(theme.message)
    expect(posterMessage('Free delivery all week.', theme)).toBe('Free delivery all week.')
  })

  it('labels single days, ranges and the New Year', () => {
    const today = { year: 2026, month: 10 }
    expect(occasionDateLabel({ startMonth: 10, startDay: 10, endMonth: 10, endDay: 10 }, today)).toBe('10 October 2026')
    expect(occasionDateLabel({ startMonth: 10, startDay: 5, endMonth: 10, endDay: 9 }, today)).toBe('5 to 9 October 2026')
    expect(occasionDateLabel({ startMonth: 12, startDay: 30, endMonth: 1, endDay: 2 }, today)).toBe('30 December to 2 January')
  })
})

describe('build-up to the big day', () => {
  const christmas = {
    slug: 'christmas',
    name: 'Christmas',
    kind: 'international',
    decoration: 'snow_lights_tree',
    startMonth: 12,
    startDay: 15,
    endMonth: 12,
    endDay: 30,
  } as Parameters<typeof occasionIntensity>[0]
  const newYear = {
    slug: 'new-year',
    name: 'New Year',
    kind: 'international',
    decoration: 'fireworks_confetti',
    startMonth: 12,
    startDay: 31,
    endMonth: 1,
    endDay: 2,
  } as Parameters<typeof occasionIntensity>[0]

  it('builds Christmas up to the 25th and winds it down to the 30th', () => {
    const levels = Array.from({ length: 16 }, (_, i) => occasionIntensity(christmas, { month: 12, day: 15 + i }))
    expect(levels).toEqual([1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 3, 2, 2, 1, 1])
  })

  it("starts New Year's Eve as a party and peaks on the 1st", () => {
    expect(occasionIntensity(newYear, { month: 12, day: 31 })).toBe(3)
    expect(occasionIntensity(newYear, { month: 1, day: 1 })).toBe(4)
    expect(occasionIntensity(newYear, { month: 1, day: 2 })).toBe(3)
  })

  it('keeps other occasions at full throughout', () => {
    const eid = {
      slug: 'eid-al-fitr',
      name: 'Eid al-Fitr',
      kind: 'religious',
      decoration: 'crescent_lanterns',
      startMonth: 3,
      startDay: 20,
      endMonth: 3,
      endDay: 20,
    } as Parameters<typeof occasionIntensity>[0]
    expect(occasionIntensity(eid, { month: 3, day: 20 })).toBe(4)
  })

  it('counts down to Christmas', () => {
    expect(peakCountdown(christmas, { month: 12, day: 15 })).toBe('10 days to Christmas')
    expect(peakCountdown(christmas, { month: 12, day: 24 })).toBe('Christmas Eve')
    expect(peakCountdown(christmas, { month: 12, day: 25 })).toBe("It's Christmas!")
    expect(peakCountdown(christmas, { month: 12, day: 27 })).toBeNull()
  })
})
