import { onUnmounted, readonly, shallowRef } from 'vue'

import type { SsoRequiredContext } from '@/platform/auth/sso/ssoRequired'

let hosts = 0
const notice = shallowRef<SsoRequiredContext>()

/**
 * Shows the refusal on the auth page that hosts it, in that page's brand
 * design system, instead of the app-styled shared dialog. False without one.
 */
export function presentInline(context: SsoRequiredContext): boolean {
  if (hosts === 0) return false
  notice.value = { ...notice.value, ...context }
  return true
}

/** Makes the calling auth page the place an SSO refusal is shown. */
export function useSsoRequiredInlineHost() {
  hosts++
  onUnmounted(() => {
    hosts--
    notice.value = undefined
  })
  return { notice: readonly(notice) }
}
