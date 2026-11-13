import { cloudAppFixture as base } from '@e2e/fixtures/cloudAppFixture'
import {
  CONSENT_CHALLENGE,
  CONSENT_UNAUTHORIZED,
  OAUTH_REQUEST_ID,
  SESSION_CREATE_FAILED
} from '@e2e/fixtures/data/oauthConsent'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

type ConsentBackendCall = 'consent' | 'create session'

interface OAuthConsentSession {
  /** The consent URL ingest sends a browser to for `OAUTH_REQUEST_ID`. */
  url: string
  /** Consent fetches and session-cookie creates, in the order they arrived. */
  calls: ConsentBackendCall[]
  /** The calls from the first consent fetch on. */
  callsFromConsent: () => ConsentBackendCall[]
}

/**
 * A tab signed in to Cloud through Firebase whose Cloud session cookie is
 * gone. With `consentRefusal: 'redirect'` ingest answers the consent fetch
 * with a same-origin redirect to sign-in until a session-cookie create
 * succeeds after that refusal; `sessionRecreation: 'fails'` makes every such
 * create fail. With `consentRefusal: 'unauthorized'` the consent fetch is
 * refused with a 401 instead. The consent and sign-in pages are served the
 * app shell, as ingest does.
 */
export const oauthConsentSessionFixture = base.extend<{
  sessionRecreation: 'succeeds' | 'fails'
  consentRefusal: 'redirect' | 'unauthorized'
  oauthConsent: OAuthConsentSession
}>({
  sessionRecreation: ['succeeds', { option: true }],
  consentRefusal: ['redirect', { option: true }],
  oauthConsent: async ({ page, sessionRecreation, consentRefusal }, use) => {
    const calls: ConsentBackendCall[] = []
    let consentRefused = false
    let hasCookie = false

    await mockCloudBoot(page, { features: {} })
    await bootCloud(page)
    await page.route('**/api/auth/session', (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      calls.push('create session')
      if (!consentRefused) return route.fulfill({ status: 204 })
      if (sessionRecreation === 'fails') {
        return route.fulfill({ status: 500, json: SESSION_CREATE_FAILED })
      }
      hasCookie = true
      return route.fulfill({ status: 204 })
    })
    await page.route('**/oauth/authorize?**', (route) => {
      if (route.request().resourceType() === 'document') return route.fallback()
      calls.push('consent')
      if (consentRefusal === 'unauthorized') {
        return route.fulfill({ status: 401, json: CONSENT_UNAUTHORIZED })
      }
      if (hasCookie) {
        return route.fulfill({ status: 200, json: CONSENT_CHALLENGE })
      }
      consentRefused = true
      return route.fulfill({
        status: 302,
        headers: {
          location: `${APP_URL}/cloud/login?oauth_request_id=${OAUTH_REQUEST_ID}`
        }
      })
    })

    const appShell = await page.request
      .get(APP_URL)
      .then((response) => response.text())
      .then((html) => html.replace('<head>', '<head><base href="/">'))
    for (const pattern of ['**/cloud/oauth/consent?**', '**/cloud/login?**']) {
      await page.route(pattern, (route) =>
        route.request().resourceType() === 'document'
          ? route.fulfill({ contentType: 'text/html', body: appShell })
          : route.fallback()
      )
    }

    await use({
      url: `${APP_URL}/cloud/oauth/consent?oauth_request_id=${OAUTH_REQUEST_ID}`,
      calls,
      callsFromConsent: () => calls.slice(calls.indexOf('consent'))
    })
  }
})
