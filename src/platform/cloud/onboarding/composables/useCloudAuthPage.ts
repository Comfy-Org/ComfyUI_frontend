import type { UserCredential } from 'firebase/auth'
import { onScopeDispose, ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { isEmbeddedWebView } from '@comfyorg/account-core/webviewDetection'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import type { SocialSignInOptions } from '@/stores/authStore'
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

  let pageOpen = true
  onScopeDispose(() => {
    pageOpen = false
  })

  /** `undefined` means useAuthActions already toasted the failure. */
  const signInWith = async (
    provider: (
      opts?: SocialSignInOptions
    ) => Promise<UserCredential | undefined>,
    resumed?: Promise<UserCredential>
  ) => {
    authError.value = ''
    const signedIn = await provider({
      isNewUser: options.isNewUser,
      resumed,
      popup: {
        onResumed: (credential) => void signInWith(provider, credential),
        keepLateResult: () => pageOpen
      }
    })
    if (signedIn) await onAuthSuccess()
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
