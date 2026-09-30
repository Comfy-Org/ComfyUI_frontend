import { computed, ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { isEmbeddedWebView } from '@comfyorg/account-core/webviewDetection'

import { useSocialSignIn } from '@/platform/auth/social/useSocialSignIn'
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
  const authError = ref('')
  const authMode = ref<'social' | 'email' | 'sso'>('social')

  const { onAuthSuccess } = usePostAuthRedirect({
    authError,
    successSummary: options.successSummary,
    defaultRedirect: options.defaultRedirect
  })

  const social = useSocialSignIn({
    isNewUser: () => options.isNewUser,
    onSignedIn: onAuthSuccess
  })

  return {
    authError,
    authMode,
    showEmailForm: computed(() => authMode.value === 'email'),
    onAuthSuccess,
    /** Snapshots, not refs: neither can change while the page is mounted. */
    isSecureContext: globalThis.isSecureContext,
    showGoogleSsoInAppBrowserNotice: isEmbeddedWebView(),
    switchToEmailForm: () => {
      authMode.value = 'email'
    },
    switchToSsoForm: () => {
      authMode.value = 'sso'
    },
    switchToSocialLogin: () => {
      authMode.value = 'social'
    },
    signInWithGoogle: () => {
      authError.value = ''
      return social.signInWithGoogle()
    },
    signInWithGithub: () => {
      authError.value = ''
      return social.signInWithGithub()
    }
  }
}
