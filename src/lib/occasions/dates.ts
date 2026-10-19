import type { Occasion, OccasionDateFormula } from './types'

/** Today in Nairobi, whatever timezone the server runs in. */
export function nairobiToday(now: Date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 1)
  return { year: part('year'), month: part('month'), day: part('day') }
}

/** Whether a month/day falls in the occasion's range, including ranges across New Year (31 Dec to 2 Jan). */
export function occasionCovers(occasion: Pick<Occasion, 'startMonth' | 'startDay' | 'endMonth' | 'endDay'>, month: number, day: number): boolean {
  const today = month * 100 + day
  const start = occasion.startMonth * 100 + occasion.startDay
  const end = occasion.endMonth * 100 + occasion.endDay
  return start <= end ? today >= start && today <= end : today >= start || today <= end
}

/** The nth weekday (0 = Sunday) of a month. */
function nthWeekdayOfMonth(year: number, month: number, dayOfWeek: number, n: number): { month: number; day: number } {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const offset = (dayOfWeek - firstWeekday + 7) % 7
  return { month, day: 1 + offset + (n - 1) * 7 }
}

/**
 * Dates worked out by rule rather than read from a calendar:
 *   Mother's Day            2nd Sunday of May
 *   Father's Day            3rd Sunday of June
 *   Customer Service Week   first full working week of October, Monday to Friday
 */
export function formulaDates(formula: OccasionDateFormula, year: number): { start: { month: number; day: number }; end: { month: number; day: number } } {
  switch (formula) {
    case 'mothers_day': {
      const day = nthWeekdayOfMonth(year, 5, 0, 2)
      return { start: day, end: day }
    }
    case 'fathers_day': {
      const day = nthWeekdayOfMonth(year, 6, 0, 3)
      return { start: day, end: day }
    }
    case 'customer_service_week': {
      const monday = nthWeekdayOfMonth(year, 10, 1, 1)
      // The first Monday is the 7th at the latest, so Friday stays in October.
      return { start: monday, end: { month: 10, day: monday.day + 4 } }
    }
  }
}
