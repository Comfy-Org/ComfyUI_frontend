/**
 * An `SSO_REQUIRED` refusal, while `sso_enabled` is on, offers the SSO
 * sign-in that fixes it instead of the workspace refusal. Firebase is signed
 * out before leaving, or this page would restore the refused account and be
 * refused again when the customer comes back.
 */
import type { SessionErrorCode } from '@comfyorg/account-core/session'
import { ssoStartUrl } from '@comfyorg/account-core/sso'
import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { CLOUD_BASE_URL } from '@/config/env'
import { resolveBillingWebIdentity } from '@/config/firebase'
import { readBillingWebSsoEnabled } from '@/config/ssoEnabled'
import {
  reportSsoContinueClicked,
  reportSsoRequiredShown
} from '@/telemetry/ssoTelemetry'

interface SsoRequiredRefusal {
  readonly code: Readonly<Ref<SessionErrorCode | undefined>>
  readonly organizationId: Readonly<Ref<string | undefined>>
  /** This page, so the customer resumes here once SSO completes. */
  readonly returnTo: Readonly<Ref<string>>
}

async function signOutOfFirebase(): Promise<boolean> {
  const identity = await resolveBillingWebIdentity()
  if (!identity?.currentUser()) return true
  try {
    await identity.signOut()
    return true
  } catch {
    return false
  }
}

export function useSsoRequiredRefusal(refusal: SsoRequiredRefusal) {
  const enabled = ref(false)
  const email = ref<string>()

  watch(
    refusal.code,
    async (code) => {
      if (code !== 'SSO_REQUIRED') return
      const [flag, identity] = await Promise.all([
        readBillingWebSsoEnabled(),
        resolveBillingWebIdentity()
      ])
      enabled.value = flag
      email.value = identity?.currentUser()?.email ?? undefined
    },
    { immediate: true }
  )

  const destination = computed(() => {
    if (!enabled.value || refusal.code.value !== 'SSO_REQUIRED') return
    const back = {
      returnTo: refusal.returnTo.value,
      origin: CLOUD_BASE_URL,
      appOrigin: window.location.origin
    }
    const organizationId = refusal.organizationId.value
    if (organizationId)
      return ssoStartUrl({ organizationId, email: email.value, ...back })
    return email.value
      ? ssoStartUrl({ email: email.value, ...back })
      : undefined
  })

  const offered = computed(() => destination.value !== undefined)
  watch(offered, (shown) => {
    if (shown) reportSsoRequiredShown()
  })

  const leaving = ref(false)
  const signOutFailed = ref(false)

  async function continueWithSso(): Promise<void> {
    const target = destination.value
    if (target === undefined || leaving.value) return
    reportSsoContinueClicked()
    leaving.value = true
    signOutFailed.value = false
    if (!(await signOutOfFirebase())) {
      leaving.value = false
      signOutFailed.value = true
      return
    }
    window.location.assign(target)
  }

  return {
    offered,
    email,
    leaving,
    signOutFailed,
    continueWithSso
  }
}
