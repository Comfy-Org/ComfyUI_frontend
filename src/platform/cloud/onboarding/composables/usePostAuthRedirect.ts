import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'

import { useOAuthPostLoginRedirect } from '@/platform/cloud/oauth/useOAuthPostLoginRedirect'
import { getSafePreviousFullPath } from '@/platform/cloud/onboarding/utils/previousFullPath'
import { useToastStore } from '@/platform/updates/common/toastStore'

/**
 * Shared post-authentication redirect logic used by both CloudLoginView and
 * CloudSignupView. Handles OAuth resume, previousFullPath redirect, and
 * default redirect after successful sign-in or sign-up.
 */
export function usePostAuthRedirect(options: {
  authError: Ref<string>
  successSummary: string
  defaultRedirect: () => RouteLocationRaw
}) {
  const { t } = useI18n()
  const router = useRouter()
  const route = useRoute()
  const toastStore = useToastStore()
  const { resumeOAuthIfNeeded } = useOAuthPostLoginRedirect()

  async function onAuthSuccess() {
    toastStore.add({
      severity: 'success',
      summary: options.successSummary,
      life: 2000
    })

    const oauthResume = await resumeOAuthIfNeeded(route.query)
    if (oauthResume.kind === 'error') {
      // authError renders only in email-form mode; surface the failure via
      // a toast so social-login users (Google / GitHub) can see it too.
      options.authError.value = oauthResume.message
      toastStore.add({
        severity: 'error',
        summary: t('oauth.consent.sessionErrorToastSummary'),
        detail: oauthResume.message,
        life: 4000
      })
      return
    }
    if (oauthResume.kind === 'resumed') return

    const previousFullPath = getSafePreviousFullPath(route.query)
    if (previousFullPath) {
      await router.replace(previousFullPath)
      return
    }

    await router.push(options.defaultRedirect())
  }

  return { onAuthSuccess }
}
