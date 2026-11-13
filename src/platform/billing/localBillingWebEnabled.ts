import { readonly, ref } from 'vue'

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
  return !isCloud && enabled.value && localSurface() === 'local_web'
}
