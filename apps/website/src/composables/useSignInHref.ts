import { onMounted, ref } from 'vue'

import { getRoutes } from '../config/routes'
import type { Locale } from '../i18n/translations'

export const RETURN_PARAM = 'return'
// The prototype sign-in page sends the visitor back to the page that asked
// for it, so the playground form they were filling in is still there.
export function useSignInHref(locale: Locale = 'en') {
  const routes = getRoutes(locale)
  const href = ref<string>(routes.workshopSignIn)
  onMounted(() => {
    const here = `${location.pathname}${location.search}`
    href.value = `${routes.workshopSignIn}?${RETURN_PARAM}=${encodeURIComponent(here)}`
  })
  return href
}

// Resolving against a fixed base is the only reliable same-origin test: browsers
// strip tabs and newlines and fold backslashes into slashes before parsing, so
// `/\tevil.example` and `/\\evil.example` both escape a character blocklist.
const RESOLUTION_BASE = 'https://return-path.invalid'

export function safeReturnPath(value: string | null, fallback: string): string {
  if (!value?.startsWith('/')) return fallback
  try {
    const resolved = new URL(value, RESOLUTION_BASE)
    return resolved.origin === RESOLUTION_BASE
      ? `${resolved.pathname}${resolved.search}${resolved.hash}`
      : fallback
  } catch {
    return fallback
  }
}
