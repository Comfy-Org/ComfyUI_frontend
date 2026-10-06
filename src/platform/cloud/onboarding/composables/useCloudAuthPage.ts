import { ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'

import { isEmbeddedWebView } from '@comfyorg/account-core/webviewDetection'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSessionCookie } from '@/platform/auth/session/useSessionCookie'
import { useSocialSignIn } from '@/platform/auth/social/useSocialSignIn'
import { presentSsoRequired } from '@/platform/auth/sso/ssoRequired'
import { resolveSsoReturnTo } from '@/platform/cloud/onboarding/composables/useSsoSignIn'
import { usePostAuthRedirect } from '@/platform/cloud/onboarding/composables/usePostAuthRedirect'
import { SSO_ENTRY_OPEN_QUERY } from '@/platform/cloud/onboarding/sso/ssoEntryQuery'
import { useAuthStore } from '@/stores/authStore'

type AuthMode = 'social' | 'email' | 'sso'

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
  const route = useRoute()
  const router = useRouter()
  const { flags } = useFeatureFlags()
  const authError = ref('')
  const authMode = ref<AuthMode>(
    flags.ssoEnabled && route.query.sso === SSO_ENTRY_OPEN_QUERY.sso
      ? 'sso'
      : 'social'
  )

  const { onAuthSuccess: redirectAfterAuth } = usePostAuthRedirect({
    authError,
    successSummary: options.successSummary,
    defaultRedirect: options.defaultRedirect
  })

  /**
   * Firebase accepts an account an SSO organization holds; ingest refuses its
   * session. That account is signed out again and sent to SSO.
   */
  async function onAuthSuccess() {
    if (flags.ssoEnabled && (await useSessionCookie().sessionRequiresSso())) {
      const authStore = useAuthStore()
      presentSsoRequired({
        email: authStore.userEmail ?? undefined,
        returnTo: resolveSsoReturnTo(route, router)
      })
      await authStore.logout()
      return
    }
    await redirectAfterAuth()
  }

  const social = useSocialSignIn({
    isNewUser: () => options.isNewUser,
    onSignedIn: onAuthSuccess
  })

  return {
    authError,
    authMode,
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
