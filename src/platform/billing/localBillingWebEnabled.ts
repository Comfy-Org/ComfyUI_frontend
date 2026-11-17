import { readonly, ref } from 'vue'

import { canDesktopHostIssueBillingHandoff } from '@/platform/auth/desktopHost/desktopHostSession'
import { isCloud, isDesktop } from '@/platform/distribution/types'

const enabled = ref(false)

export function localSurface(): 'desktop' | 'local_web' {
  return isDesktop || window.__comfyDesktop2 !== undefined
    ? 'desktop'
    : 'local_web'
}

/** Cloud's `local_billing_web` as the local flag store last read it; false until a read succeeds. */
export const localBillingWebEnabled = readonly(enabled)

export function setLocalBillingWebEnabled(value: boolean): void {
  enabled.value = value
}

export function opensLocalBillingHandoff(): boolean {
  if (isCloud || !enabled.value) return false
  return localSurface() === 'local_web' || canDesktopHostIssueBillingHandoff()
}
