import { useI18n } from 'vue-i18n'
import type { LocationQuery } from 'vue-router'
import { useRouter } from 'vue-router'

import { useSessionCookie } from '@/platform/auth/session/useSessionCookie'
import {
  captureOAuthRequestId,
  getOAuthRequestId
} from '@/platform/cloud/oauth/oauthState'

type OAuthResumeResult =
  | { kind: 'no-oauth' }
  | { kind: 'resumed' }
  | { kind: 'error'; message: string }

/**
 * Post-login OAuth resume. If the current login flow originated from an OAuth
 * authorize request, establishes the Cloud session cookie and navigates to the
 * consent route. Used by both `CloudLoginView` and `CloudSignupView`.
 */
export function useOAuthPostLoginRedirect() {
  const router = useRouter()
  const sessionCookie = useSessionCookie()
  const { t } = useI18n()

  async function resumeOAuthIfNeeded(
    query: LocationQuery
  ): Promise<OAuthResumeResult> {
    captureOAuthRequestId(query)
    const oauthRequestId = getOAuthRequestId()
    if (!oauthRequestId) return { kind: 'no-oauth' }

    try {
      await sessionCookie.createSessionOrThrow()
    } catch (error) {
      return {
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('oauth.consent.sessionError')
      }
    }

    await router.push({
      name: 'cloud-oauth-consent',
      query: { oauth_request_id: oauthRequestId }
    })
    return { kind: 'resumed' }
  }

  return { resumeOAuthIfNeeded }
}
