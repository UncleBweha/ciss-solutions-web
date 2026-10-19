import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { parseIcs, findEventDate } = await import('@/lib/occasions/calendar')

const ICS = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20260403',
  'SUMMARY:Good Friday',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20260406',
  'SUMMARY:Easter Monday',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20260320',
  // A folded line: the summary continues on the next line after a space.
  'SUMMARY:Idd ul-Fitr (tenta',
  ' tive)',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20270326',
  'SUMMARY:Good Friday',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

describe('holiday calendar', () => {
  const events = parseIcs(ICS)

  it('reads every event with its date', () => {
    expect(events).toHaveLength(4)
    expect(events[0]).toEqual({ summary: 'Good Friday', year: 2026, month: 4, day: 3 })
  })

  it('finds an event for the given year, including suffixed and folded names', () => {
    expect(findEventDate(events, 'Good Friday', 2027)).toEqual({ month: 3, day: 26 })
    expect(findEventDate(events, 'Idd ul-Fitr', 2026)).toEqual({ month: 3, day: 20 })
    expect(findEventDate(events, 'Diwali', 2026)).toBeNull()
  })
})
