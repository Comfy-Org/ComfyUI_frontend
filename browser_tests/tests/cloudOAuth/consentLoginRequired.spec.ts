import { OAUTH_REQUEST_ID } from '@e2e/fixtures/data/oauthConsent'
import {
  expect,
  oauthConsentFixture as test
} from '@e2e/fixtures/oauthConsentFixture'

test.describe(
  'Cloud OAuth consent when the consent request needs a new sign-in',
  { tag: ['@cloud', '@ui'] },
  () => {
    test('Sign in again opens sign-in for the same request without signing out', async ({
      page,
      oauthConsent
    }) => {
      await oauthConsent.open()

      await expect(oauthConsent.loginRequiredAlert).toBeVisible()
      await expect(oauthConsent.signInAgainButton).toBeVisible()
      expect(await oauthConsent.persistedFirebaseUsers()).toHaveLength(1)

      await oauthConsent.signInAgainButton.click()

      await expect(page).toHaveURL(/\/cloud\/login\?/)
      await expect(oauthConsent.signInHeading).toBeVisible()
      const loginQuery = new URL(page.url()).searchParams
      expect(loginQuery.get('switchAccount')).toBe('true')
      expect(loginQuery.get('oauth_request_id')).toBe(OAUTH_REQUEST_ID)
      expect(oauthConsent.sessionDeletes).toEqual([])
      expect(await oauthConsent.persistedFirebaseUsers()).toHaveLength(1)
    })
  }
)
