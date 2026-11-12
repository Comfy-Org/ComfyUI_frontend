import { readonly, ref } from 'vue'

import { isCloud, isDesktop } from '@/platform/distribution/types'

const enabled = ref(false)

/** Which local app this view runs in, as the `local_billing_web` flag splits it. */
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

/** Whether this local view sends billing through a handoff: the flag is on and its surface has a launcher. */
export function opensLocalBillingHandoff(): boolean {
  return !isCloud && localSurface() === 'local_web' && enabled.value
}
