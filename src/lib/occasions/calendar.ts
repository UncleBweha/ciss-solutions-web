import 'server-only'

/* ===========================================================================
   Google's public holiday calendars — free, no API key, no auth. Confirmed
   live (Aug 2026, by the Toolsman store this is ported from) to be genuinely forward-looking (checked both 2026 and
   2027 entries) and to carry exactly the events this app needs: Good
   Friday, Easter Monday, Ramadan Start, Idd ul-Fitr and Eid al-Adha from
   Kenya's calendar; Diwali/Deepavali from the Indian one.

   This is a narrow, purpose-built ICS reader, not a general one — it only
   understands VEVENT/DTSTART;VALUE=DATE/SUMMARY, which is all these two
   feeds ever contain. A general .ics can have recurrence rules, timezoned
   datetimes, line-folding, etc.; none of that appears in a Google holiday
   feed, so none of it is handled here.
   ========================================================================= */

export type CalendarSource = 'kenya' | 'indian'

const FEED_URLS: Record<CalendarSource, string> = {
  kenya: 'https://calendar.google.com/calendar/ical/en.ke%23holiday%40group.v.calendar.google.com/public/basic.ics',
  indian: 'https://calendar.google.com/calendar/ical/en.indian%23holiday%40group.v.calendar.google.com/public/basic.ics',
}

export interface CalendarEvent {
  summary: string
  year: number
  month: number
  day: number
}

/** Fetches and parses one feed into its VEVENTs. Network/parse failures
    throw — the caller (the sync cron) is expected to catch per-source, so
    one feed being briefly unreachable doesn't block the other. Several
    occasions read from the same feed (e.g. Easter needs both "Good Friday"
    and "Easter Monday" from Kenya's), so this is meant to be called once per
    source per sync run and the result reused — not once per lookup. */
export async function fetchHolidayCalendar(source: CalendarSource): Promise<CalendarEvent[]> {
  const response = await fetch(FEED_URLS[source], {
    // Never cache a calendar fetch across cron runs — the whole point is
    // picking up whatever Google currently publishes.
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    throw new Error(`${source} calendar fetch failed: ${response.status}`)
  }
  const text = await response.text()
  return parseIcs(text)
}

export function parseIcs(text: string): CalendarEvent[] {
  const events: CalendarEvent[] = []
  // ICS lines can be "folded" (continued on the next line with a leading
  // space) — unfold first so a wrapped SUMMARY doesn't get truncated.
  const unfolded = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '')
  const lines = unfolded.split('\n')

  let inEvent = false
  let date: { year: number; month: number; day: number } | null = null
  let summary: string | null = null

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      inEvent = true
      date = null
      summary = null
      continue
    }
    if (line.startsWith('END:VEVENT')) {
      if (inEvent && date && summary) {
        events.push({ summary, year: date.year, month: date.month, day: date.day })
      }
      inEvent = false
      continue
    }
    if (!inEvent) continue

    if (line.startsWith('DTSTART')) {
      const match = line.match(/(\d{4})(\d{2})(\d{2})/)
      if (match) {
        date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
      }
    } else if (line.startsWith('SUMMARY:')) {
      summary = line.slice('SUMMARY:'.length).trim()
    }
  }

  return events
}

/** The date of `eventName` for `year` within an already-fetched event list —
    a substring match against SUMMARY (not exact), because Google suffixes
    some entries with "(tentative)" or "Day off for " in years the holiday
    falls on a weekend, and the underlying event is still the one being
    asked for. */
export function findEventDate(events: CalendarEvent[], eventName: string, year: number): { month: number; day: number } | null {
  const match = events.find((e) => e.year === year && e.summary.includes(eventName))
  return match ? { month: match.month, day: match.day } : null
}
