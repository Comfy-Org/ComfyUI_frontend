import { onUnmounted, readonly, shallowRef } from 'vue'

import type {
  SsoRequiredTrigger,
  SsoSurface
} from '@comfyorg/account-core/telemetry'

import type { SsoRequiredContext } from '@/platform/auth/sso/ssoRequired'
import {
  abandonSsoFlow,
  trackSsoRequiredShown
} from '@/platform/auth/sso/ssoTelemetry'

const hostSurfaces: SsoSurface[] = []
const notice = shallowRef<SsoRequiredContext>()

/**
 * Shows the refusal on the auth page that hosts it, in that page's brand
 * design system, instead of the app-styled shared dialog. False without one.
 */
export function presentInline(
  context: SsoRequiredContext,
  trigger: SsoRequiredTrigger
): boolean {
  const surface = hostSurfaces.at(-1)
  if (!surface) return false
  if (!notice.value) trackSsoRequiredShown(surface, trigger, 'notice')
  notice.value = { ...notice.value, ...context }
  return true
}

/** Makes the calling auth page the place an SSO refusal is shown. */
export function useSsoRequiredInlineHost(surface: SsoSurface) {
  hostSurfaces.push(surface)
  onUnmounted(() => {
    hostSurfaces.splice(hostSurfaces.lastIndexOf(surface), 1)
    if (notice.value) abandonSsoFlow()
    notice.value = undefined
  })
  return { notice: readonly(notice) }
}
