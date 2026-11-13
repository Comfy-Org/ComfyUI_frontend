import type { Page, Request } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  cloudAppExpect as expect,
  cloudAppFixture
} from '@e2e/fixtures/cloudAppFixture'
import {
  CONSENT_LOGIN_REQUIRED,
  OAUTH_REQUEST_ID
} from '@e2e/fixtures/data/oauthConsent'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
const CONSENT_COPY = enMessages.oauth.consent

/**
 * The Firebase users persisted in this origin's IndexedDB. A sign-out removes
 * the `firebase:authUser:*` entry, so an empty list after the click means the
 * page signed the person out.
 */
function persistedFirebaseUsers(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open('firebaseLocalStorageDb')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const keys = db
            .transaction('firebaseLocalStorage', 'readonly')
            .objectStore('firebaseLocalStorage')
            .getAllKeys()
          keys.onerror = () => reject(keys.error)
          keys.onsuccess = () => {
            db.close()
            resolve(
              keys.result
                .map(String)
                .filter((key) => key.startsWith('firebase:authUser:'))
            )
          }
        }
      })
  )
}

/**
 * A tab signed in to Cloud whose consent request ingest refuses with 401
 * `login_required`. The consent and sign-in pages are served the app shell,
 * as ingest does, and every session-cookie delete is recorded so the spec can
 * prove the page never signed out.
 */
const test = cloudAppFixture.extend<{ sessionDeletes: Request[] }>({
  sessionDeletes: async ({ page }, use) => {
    const deletes: Request[] = []
    await mockCloudBoot(page, { features: {} })
    await bootCloud(page)
    page.on('request', (request) => {
      if (
        request.method() === 'DELETE' &&
        new URL(request.url()).pathname === '/api/auth/session'
      ) {
        deletes.push(request)
      }
    })
    await page.route('**/oauth/authorize?**', (route) =>
      route.request().resourceType() === 'document'
        ? route.fallback()
        : route.fulfill({ status: 401, json: CONSENT_LOGIN_REQUIRED })
    )
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
    await use(deletes)
  }
})

test.describe(
  'Cloud OAuth consent when the consent request needs a new sign-in',
  { tag: ['@cloud', '@ui'] },
  () => {
    test('Sign in again opens sign-in for the same request without signing out', async ({
      page,
      sessionDeletes
    }) => {
      await page.goto(
        `${APP_URL}/cloud/oauth/consent?oauth_request_id=${OAUTH_REQUEST_ID}`
      )

      await expect(
        page.getByRole('alert').filter({ hasText: CONSENT_COPY.loginRequired })
      ).toBeVisible()
      const signInAgain = page.getByRole('button', {
        name: CONSENT_COPY.signInAgain
      })
      await expect(signInAgain).toBeVisible()

      await signInAgain.click()

      await expect(page).toHaveURL(/\/cloud\/login\?/)
      const loginQuery = new URL(page.url()).searchParams
      expect(loginQuery.get('switchAccount')).toBe('true')
      expect(loginQuery.get('oauth_request_id')).toBe(OAUTH_REQUEST_ID)
      expect(sessionDeletes).toEqual([])
      expect(await persistedFirebaseUsers(page)).toHaveLength(1)
    })
  }
)
