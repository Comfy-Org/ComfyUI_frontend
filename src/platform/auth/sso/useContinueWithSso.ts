import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { ssoStartUrl } from '@comfyorg/account-core/sso'

import { useErrorHandling } from '@/composables/useErrorHandling'
import type { SsoRequiredContext } from '@/platform/auth/sso/ssoRequired'
import { toSsoReturnPath } from '@/platform/auth/sso/ssoReturnPath'
import { SSO_ENTRY_OPEN_QUERY } from '@/platform/cloud/onboarding/sso/ssoEntryQuery'
import { useAuthStore } from '@/stores/authStore'

/** Signs out of Firebase and leaves for the refusing organization's SSO. */
export function useContinueWithSso(context: () => SsoRequiredContext) {
  const router = useRouter()
  const authStore = useAuthStore()
  const { toastErrorHandler } = useErrorHandling()
  const knownEmail = computed(() => context().email ?? authStore.userEmail)
  const leaving = ref(false)

  function destination(): string {
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
    if (!knownEmail.value) {
      return router.resolve({
        name: 'cloud-login',
        query: SSO_ENTRY_OPEN_QUERY
      }).href
    }
    return ssoStartUrl({ email: knownEmail.value, ...back })
  }

  async function continueWithSso() {
    leaving.value = true
    const target = destination()
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
