import type { Locator, Page, Request } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { cloudAppExpect, cloudAppFixture } from '@e2e/fixtures/cloudAppFixture'
import {
  CONSENT_LOGIN_REQUIRED,
  OAUTH_REQUEST_ID
} from '@e2e/fixtures/data/oauthConsent'
import { APP_URL } from '@e2e/fixtures/utils/cloudAppSetup'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'

const CONSENT_COPY = enMessages.oauth.consent
const SPA_DOCUMENT_ROUTES = ['**/cloud/oauth/consent?**', '**/cloud/login?**']

class OAuthConsentHelper {
  readonly sessionDeletes: Request[] = []
  readonly loginRequiredAlert: Locator
  readonly signInAgainButton: Locator
  readonly signInHeading: Locator

  constructor(private readonly page: Page) {
    this.loginRequiredAlert = page
      .getByRole('alert')
      .filter({ hasText: CONSENT_COPY.loginRequired })
    this.signInAgainButton = page.getByRole('button', {
      name: CONSENT_COPY.signInAgain
    })
    this.signInHeading = page.getByRole('heading', {
      name: enMessages.auth.login.title
    })
  }

  async mockSignedInLoginRequired(): Promise<void> {
    await mockCloudBoot(this.page, { features: {} })
    await bootCloud(this.page)
    this.page.on('request', (request) => {
      if (
        request.method() === 'DELETE' &&
        new URL(request.url()).pathname === '/api/auth/session'
      ) {
        this.sessionDeletes.push(request)
      }
    })
    await this.page.route('**/oauth/authorize?**', (route) =>
      route.request().resourceType() === 'document'
        ? route.fallback()
        : route.fulfill({ status: 401, json: CONSENT_LOGIN_REQUIRED })
    )
    const appShell = await this.page.request
      .get(APP_URL)
      .then((response) => response.text())
      .then((html) => html.replace('<head>', '<head><base href="/">'))
    for (const pattern of SPA_DOCUMENT_ROUTES) {
      await this.page.route(pattern, (route) =>
        route.request().resourceType() === 'document'
          ? route.fulfill({ contentType: 'text/html', body: appShell })
          : route.fallback()
      )
    }
  }

  async open(): Promise<void> {
    await this.page.goto(
      `${APP_URL}/cloud/oauth/consent?oauth_request_id=${OAUTH_REQUEST_ID}`
    )
  }

  persistedFirebaseUsers(): Promise<string[]> {
    return this.page.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        key.startsWith('firebase:authUser:')
      )
    )
  }
}

export const oauthConsentFixture = cloudAppFixture.extend<{
  oauthConsent: OAuthConsentHelper
}>({
  oauthConsent: async ({ page }, use) => {
    const oauthConsent = new OAuthConsentHelper(page)
    await oauthConsent.mockSignedInLoginRequired()
    await use(oauthConsent)
  }
})

export { cloudAppExpect as expect }
