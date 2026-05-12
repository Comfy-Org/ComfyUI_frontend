import type { LocationQuery } from 'vue-router'
import { useRouter } from 'vue-router'

import { useSessionCookie } from '@/platform/auth/session/useSessionCookie'
import {
  captureOAuthRequestId,
  getOAuthRequestId
} from '@/platform/cloud/oauth/oauthState'

export type OAuthResumeResult =
  | { kind: 'no-oauth' }
  | { kind: 'resumed' }
  | { kind: 'error'; message: string }

const FALLBACK_ERROR_MESSAGE = 'Failed to establish session. Please try again.'

/**
 * Post-login OAuth resume. If the current login flow originated from an OAuth
 * authorize request, establishes the Cloud session cookie and navigates to the
 * consent route. Used by both `CloudLoginView` and `CloudSignupView`.
 */
export function useOAuthPostLoginRedirect() {
  const router = useRouter()
  const sessionCookie = useSessionCookie()

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
        message: error instanceof Error ? error.message : FALLBACK_ERROR_MESSAGE
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
