import { readonly, ref } from 'vue'

import { canDesktopHostIssueBillingHandoff } from '@/platform/auth/desktopHost/desktopHostSession'
import { isCloud, isDesktop } from '@/platform/distribution/types'

const enabled = ref(false)
const cloudBillingNewUx = ref(false)
const cloudAutoTopUpAtCheckout = ref(false)

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

export function setLocalBillingNewUxEnabled(value: boolean): void {
  cloudBillingNewUx.value = value
}

export function setLocalAutoTopUpAtCheckoutEnabled(value: boolean): void {
  cloudAutoTopUpAtCheckout.value = value
}

export function opensLocalBillingHandoff(): boolean {
  if (isCloud || !enabled.value) return false
  return localSurface() === 'local_web' || canDesktopHostIssueBillingHandoff()
}

/** Cloud's `billing_new_ux_enabled` for the signed-in local account, counted only while the handoff its Platform and checkout links need is open. */
export function showsCloudBillingNewUxOnLocal(): boolean {
  return opensLocalBillingHandoff() && cloudBillingNewUx.value
}

/** Cloud's `billing_auto_top_up_at_checkout_enabled` for the signed-in local account, counted only on local web, whose handoff carries the auto top-up settings. */
export function offersAutoTopUpAtLocalCheckout(): boolean {
  return (
    localSurface() === 'local_web' &&
    opensLocalBillingHandoff() &&
    cloudAutoTopUpAtCheckout.value
  )
}
