import { useI18n } from 'vue-i18n'

/** Formats an ISO timestamp as a long localized UTC date, or '' when it is missing or invalid. */
export function useLongDate() {
  const { d } = useI18n()

  function longDate(raw: string | null | undefined): string {
    const date = raw ? new Date(raw) : null
    if (!date || Number.isNaN(date.getTime())) return ''
    return d(date, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    })
  }

  return { longDate }
}
