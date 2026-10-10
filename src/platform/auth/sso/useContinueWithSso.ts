import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { ssoStartUrl } from '@comfyorg/account-core/sso'

import { useErrorHandling } from '@/composables/useErrorHandling'
import type { SsoRequiredContext } from '@/platform/auth/sso/ssoRequired'
import { toSsoReturnPath } from '@/platform/auth/sso/ssoReturnPath'
import { trackSsoContinueClicked } from '@/platform/auth/sso/ssoTelemetry'
import { SSO_ENTRY_OPEN_QUERY } from '@/platform/cloud/onboarding/sso/ssoEntryQuery'
import { useAuthStore } from '@/stores/authStore'

/** Signs out of Firebase and leaves for the refusing organization's SSO. */
export function useContinueWithSso(context: () => SsoRequiredContext) {
  const router = useRouter()
  const authStore = useAuthStore()
  const { toastErrorHandler } = useErrorHandling()
  const knownEmail = computed(() => context().email ?? authStore.userEmail)
  const leaving = ref(false)

  /** The SSO start URL, or undefined when the sign-in page must ask for an email. */
  function ssoDestination(): string | undefined {
    const { returnTo, organizationId } = context()
    const back = {
      returnTo: toSsoReturnPath(returnTo ?? router.currentRoute.value.fullPath),
      origin: window.location.origin
    }
    if (organizationId) {
      return ssoStartUrl({
        organizationId,
        email: knownEmail.value ?? undefined,
        ...back
      })
    }
    if (!knownEmail.value) return undefined
    return ssoStartUrl({ email: knownEmail.value, ...back })
  }

  async function continueWithSso() {
    leaving.value = true
    const ssoTarget = ssoDestination()
    if (ssoTarget) trackSsoContinueClicked('cloud_app')
    const target =
      ssoTarget ??
      router.resolve({ name: 'cloud-login', query: SSO_ENTRY_OPEN_QUERY }).href
    try {
      if (authStore.currentUser) await authStore.logout()
    } catch (error) {
      leaving.value = false
      toastErrorHandler(error)
      return
    }
    window.location.assign(target)
  }

  return { knownEmail, leaving, continueWithSso }
}
