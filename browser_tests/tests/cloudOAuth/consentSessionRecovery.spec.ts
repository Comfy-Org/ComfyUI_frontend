import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  CONSENT_CHALLENGE,
  OAUTH_REQUEST_ID
} from '@e2e/fixtures/data/oauthConsent'
import { oauthConsentSessionFixture as test } from '@e2e/fixtures/oauthConsentSessionFixture'

test.describe(
  'Cloud OAuth consent without a session cookie',
  { tag: ['@cloud', '@ui'] },
  () => {
    test('re-creates the session cookie and shows the consent for the request', async ({
      page,
      oauthConsent
    }) => {
      await page.goto(oauthConsent.url)

      await expect(
        page.getByRole('heading', {
          name: enMessages.oauth.consent.title.replace(
            '{client}',
            CONSENT_CHALLENGE.client_display_name
          )
        })
      ).toBeVisible()
      expect(oauthConsent.callsFromConsent()).toEqual([
        'consent',
        'create session',
        'consent'
      ])
      const consentUrl = new URL(page.url())
      expect(consentUrl.pathname).toBe('/oauth/consent')
      expect(consentUrl.searchParams.get('oauth_request_id')).toBe(
        OAUTH_REQUEST_ID
      )
    })

    test.describe('when the cookie cannot be re-created', () => {
      test.use({ sessionRecreation: 'fails' })

      test('sends the person to sign in again for the same request', async ({
        page,
        oauthConsent
      }) => {
        await page.goto(oauthConsent.url)

        await expect(page).toHaveURL(/\/cloud\/login\?/)
        const loginQuery = new URL(page.url()).searchParams
        expect(loginQuery.get('switchAccount')).toBe('true')
        expect(loginQuery.get('oauth_request_id')).toBe(OAUTH_REQUEST_ID)
        expect(oauthConsent.callsFromConsent()).toEqual([
          'consent',
          'create session'
        ])
      })
    })

    test.describe('when the consent request is refused with 401', () => {
      test.use({ consentRefusal: 'unauthorized' })

      test('shows the session error without re-creating the cookie', async ({
        page,
        oauthConsent
      }) => {
        await page.goto(oauthConsent.url)

        await expect(
          page
            .getByRole('alert')
            .filter({ hasText: enMessages.oauth.consent.sessionError })
        ).toBeVisible()
        expect(oauthConsent.callsFromConsent()).toEqual(['consent'])
        expect(new URL(page.url()).pathname).toBe('/oauth/consent')
      })
    })
  }
)
