import type { UserCredential } from 'firebase/auth'
import { ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { isEmbeddedWebView } from '@/base/webviewDetection'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { usePostAuthRedirect } from '@/platform/cloud/onboarding/composables/usePostAuthRedirect'

/**
 * State shared by CloudLoginView and CloudSignupView. Sign-up passes
 * `isNewUser` so the provider reports the right telemetry action; the two pages
 * are otherwise identical.
 */
export function useCloudAuthPage(options: {
  isNewUser?: boolean
  successSummary: string
  defaultRedirect: () => RouteLocationRaw
}) {
  const authActions = useAuthActions()
  const authError = ref('')
  const showEmailForm = ref(false)

  const { onAuthSuccess } = usePostAuthRedirect({
    authError,
    successSummary: options.successSummary,
    defaultRedirect: options.defaultRedirect
  })

  const providerOptions = options.isNewUser ? { isNewUser: true } : undefined

  /** `undefined` means useAuthActions already toasted the failure. */
  const signInWith = async (
    provider: (opts?: {
      isNewUser?: boolean
    }) => Promise<UserCredential | undefined>
  ) => {
    authError.value = ''
    if (await provider(providerOptions)) {
      await onAuthSuccess()
    }
  }

  return {
    authError,
    showEmailForm,
    onAuthSuccess,
    /** Snapshots, not refs: neither can change while the page is mounted. */
    isSecureContext: globalThis.isSecureContext,
    showGoogleSsoInAppBrowserNotice: isEmbeddedWebView(),
    switchToEmailForm: () => {
      showEmailForm.value = true
    },
    switchToSocialLogin: () => {
      showEmailForm.value = false
    },
    signInWithGoogle: () => signInWith(authActions.signInWithGoogle),
    signInWithGithub: () => signInWith(authActions.signInWithGithub)
  }
}
