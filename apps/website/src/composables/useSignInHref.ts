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

export function safeReturnPath(value: string | null, fallback: string): string {
  return value && value.startsWith('/') && !value.startsWith('//')
    ? value
    : fallback
}
