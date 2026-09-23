export interface CalendarEvent {
  title: string
  description: string
  location: string
  start: Date
  end: Date
}

function formatIcsUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

export function toGoogleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatIcsUtc(event.start)}/${formatIcsUtc(event.end)}`,
    details: event.description,
    location: event.location
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function toOutlookCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: event.start.toISOString(),
    enddt: event.end.toISOString(),
    body: event.description,
    location: event.location
  })
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

export function toIcsDataUri(event: CalendarEvent): string {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Comfy Org//Launches//EN',
    'BEGIN:VEVENT',
    `UID:${formatIcsUtc(event.start)}@comfy.org`,
    `DTSTAMP:${formatIcsUtc(event.start)}`,
    `DTSTART:${formatIcsUtc(event.start)}`,
    `DTEND:${formatIcsUtc(event.end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    `LOCATION:${escapeIcsText(event.location)}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n')
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`
}
