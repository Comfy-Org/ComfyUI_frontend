import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

import type { ErrorResponse, SsoDiscoverResponse } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { OAuthConsentChallenge } from '@/platform/cloud/oauth/oauthApi'
import type { operations } from '@/types/comfyRegistryTypes'

import {
  NOT_SSO,
  SSO_DISCOVERED,
  SSO_DISCOVER_DOWN,
  SSO_EMAIL,
  SSO_REQUIRED
} from '@e2e/fixtures/data/sso'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  CLOUD_SELF_EMAIL,
  CloudAuthHelper
} from '@e2e/fixtures/helpers/CloudAuthHelper'
import {
  mockCloudBoot,
  preselectCloudUser
} from '@e2e/fixtures/utils/cloudBootMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
const APP_ROOT = new RegExp(
  `^${APP_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?(\\?.*)?$`
)
const SSO_COPY = enMessages.auth.sso
const OAUTH_REQUEST_ID = '550e8400-e29b-41d4-a716-446655440000'
const CONSENT_CHALLENGE: OAuthConsentChallenge = {
  client_provenance: 'first_party',
  oauth_request_id: OAUTH_REQUEST_ID,
  csrf_token: 'csrf-token',
  client_display_name: 'Comfy Desktop',
  resource_display_name: 'Comfy Cloud',
  redirect_uri: 'http://127.0.0.1:50632/callback',
  client_application_type: 'native',
  scopes: ['comfy-cloud:user:read'],
  workspaces: [
    {
      id: 'personal-workspace',
      name: 'Personal',
      type: 'personal',
      role: 'owner'
    }
  ]
}
type CreateCustomerResponse =
  operations['createCustomer']['responses']['201']['content']['application/json']

function isPath(request: Request, pathname: string) {
  return new URL(request.url()).pathname === pathname
}

/**
 * The cloud login page's SSO entry, with `sso_enabled` served as the remote
 * config and ingest's SSO endpoints mocked at the network layer. Ingest's `/api/auth/sso/start` answers with a redirect
 * to WorkOS; here it is fulfilled in place so the navigation is observed and
 * never followed.
 */
const test = comfyPageFixture.extend<{
  ssoEnabled: boolean
  cloudAuth: CloudAuthHelper
  discoverRequests: Request[]
  ssoStarts: Request[]
}>({
  ssoEnabled: [true, { option: true }],
  discoverRequests: async ({ context }, use) => {
    const requests: Request[] = []
    context.on('request', (request) => {
      if (isPath(request, '/api/auth/sso/discover')) requests.push(request)
    })
    await use(requests)
  },
  ssoStarts: async ({ context }, use) => {
    const requests: Request[] = []
    context.on('request', (request) => {
      if (isPath(request, '/api/auth/sso/start')) requests.push(request)
    })
    await use(requests)
  },
  page: async ({ page, ssoEnabled, discoverRequests, ssoStarts }, use) => {
    void discoverRequests
    void ssoStarts
    await mockCloudBoot(page, { features: { sso_enabled: ssoEnabled } })
    await preselectCloudUser(page)
    await page.route('**/customers', (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      return route.fulfill({
        status: 201,
        json: { id: 'test-customer-e2e' } satisfies CreateCustomerResponse
      })
    })
    await page.route('**/api/auth/sso/start**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '' })
    )
    await use(page)
  },
  cloudAuth: async ({ page }, use) => {
    await use(new CloudAuthHelper(page))
  }
})

async function answerDiscover(
  page: Page,
  status: number,
  body: SsoDiscoverResponse | ErrorResponse
) {
  await page.route('**/api/auth/sso/discover', (route) =>
    route.fulfill({ status, json: body })
  )
}

async function openLogin(page: Page) {
  await page.goto(APP_URL)
  await expect(
    page.getByRole('heading', { name: 'Log in to your account' })
  ).toBeVisible()
}

async function signInWithEmail(page: Page) {
  await openLogin(page)
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page.locator('#cloud-sign-in-email').fill(CLOUD_SELF_EMAIL)
  await page
    .locator('#cloud-sign-in-password')
    .fill('correct-horse-battery-staple')
  await page.locator('#cloud-sign-in-password').blur()
  await page.getByRole('button', { name: 'Sign in' }).click()
}

async function continueWithSso(page: Page, email: string) {
  await openLogin(page)
  await page.getByRole('button', { name: SSO_COPY.continueWithSso }).click()
  await page.locator('#cloud-sso-email').fill(email)
  await page.getByRole('button', { name: SSO_COPY.submit, exact: true }).click()
}

test.describe('Cloud login SSO entry', { tag: ['@cloud', '@ui'] }, () => {
  test.describe('sso_enabled off', () => {
    test.use({ ssoEnabled: false })

    test('offers no SSO entry and signs an email in through Firebase without asking discover', async ({
      page,
      cloudAuth,
      discoverRequests
    }) => {
      await answerDiscover(page, 200, SSO_DISCOVERED)
      await cloudAuth.mockLiveEmailSignIn()

      const features = page.waitForResponse((response) =>
        isPath(response.request(), '/api/features')
      )
      await openLogin(page)
      await features
      await expect(
        page.getByRole('button', { name: SSO_COPY.continueWithSso })
      ).toHaveCount(0)
      await signInWithEmail(page)

      await expect(page).toHaveURL(APP_ROOT, { timeout: 10_000 })
      expect(discoverRequests).toEqual([])
    })
  })

  test.describe('sso_enabled on', () => {
    test('an SSO email navigates to ingest SSO start with its email and return path', async ({
      page,
      discoverRequests,
      ssoStarts
    }) => {
      await answerDiscover(page, 200, SSO_DISCOVERED)
      const start = page.waitForRequest((request) =>
        isPath(request, '/api/auth/sso/start')
      )

      await continueWithSso(page, SSO_EMAIL)

      const url = new URL((await start).url())
      expect({
        origin: url.origin,
        email: url.searchParams.get('email'),
        returnTo: url.searchParams.get('return_to'),
        navigation: (await start).isNavigationRequest()
      }).toEqual({
        origin: new URL(APP_URL).origin,
        email: SSO_EMAIL,
        returnTo: '/cloud/user-check',
        navigation: true
      })
      expect(discoverRequests.map((r) => r.postDataJSON())).toEqual([
        { email: SSO_EMAIL }
      ])
      expect(ssoStarts).toHaveLength(1)
    })

    test('an SSO sign-in for a pending OAuth request returns to a consent page the server serves', async ({
      page
    }) => {
      await answerDiscover(page, 200, SSO_DISCOVERED)
      await page.route('**/api/auth/sso/start**', (route) => {
        const returnTo = new URL(route.request().url()).searchParams.get(
          'return_to'
        )
        // Playwright does not route requests that follow a redirect, so the
        // IdP round trip ends in a fresh navigation to return_to instead.
        const target = new URL(returnTo ?? '/', APP_URL).toString()
        return route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: `<script>location.replace(${JSON.stringify(target)})</script>`
        })
      })
      // The server serves the SPA as a page only at /cloud/oauth/consent and
      // answers a document load of /oauth/consent with a JSON 404.
      await page.route('**/oauth/consent**', async (route) => {
        const request = route.request()
        if (request.resourceType() !== 'document') return route.fallback()
        const path = new URL(request.url()).pathname.replace(/\/+$/, '')
        if (path === '/cloud/oauth/consent') {
          const app = await route.fetch({ url: `${APP_URL}/` })
          return route.fulfill({ response: app })
        }
        return route.fulfill({
          status: 404,
          json: { code: 'NOT_FOUND', message: 'Not Found' }
        })
      })
      await page.route('**/oauth/authorize?**', (route) =>
        route.request().resourceType() === 'document'
          ? route.fallback()
          : route.fulfill({ status: 200, json: CONSENT_CHALLENGE })
      )

      await page.goto(`${APP_URL}/?oauth_request_id=${OAUTH_REQUEST_ID}`)
      await expect(page).toHaveURL(/\/cloud\/login/)
      await page.getByRole('button', { name: SSO_COPY.continueWithSso }).click()
      await page.locator('#cloud-sso-email').fill(SSO_EMAIL)
      await page
        .getByRole('button', { name: SSO_COPY.submit, exact: true })
        .click()

      await expect(
        page.getByRole('heading', {
          name: enMessages.oauth.consent.title.replace(
            '{client}',
            CONSENT_CHALLENGE.client_display_name
          )
        })
      ).toBeVisible()
      expect(new URL(page.url()).searchParams.get('oauth_request_id')).toBe(
        OAUTH_REQUEST_ID
      )
    })

    test('an email that does not use SSO stays on the login page with the not-SSO message', async ({
      page,
      ssoStarts
    }) => {
      await answerDiscover(page, 200, NOT_SSO)

      await continueWithSso(page, CLOUD_SELF_EMAIL)

      await expect(page.getByText(SSO_COPY.notSso)).toBeVisible()
      await expect(page).toHaveURL(/\/cloud\/login/)
      expect(ssoStarts).toEqual([])
    })

    test('a discover outage still signs a password login in through Firebase', async ({
      page,
      cloudAuth,
      discoverRequests,
      ssoStarts
    }) => {
      await answerDiscover(page, 500, SSO_DISCOVER_DOWN)
      await cloudAuth.mockLiveEmailSignIn()
      const firebaseSignIn = page.waitForRequest((request) =>
        request.url().includes('accounts:signInWithPassword')
      )

      await signInWithEmail(page)

      await firebaseSignIn
      await expect(page).toHaveURL(APP_ROOT, { timeout: 10_000 })
      expect(discoverRequests).toHaveLength(1)
      expect(ssoStarts).toEqual([])
    })

    test('an sso_error ingest sends back shows its message on the login page', async ({
      page
    }) => {
      await page.goto(`${APP_URL}/?sso_error=SSO_ORG_DISABLED`)

      await expect(page).toHaveURL(
        /\/cloud\/login\?.*sso_error=SSO_ORG_DISABLED/
      )
      await expect(page.getByText(SSO_COPY.errors.orgDisabled)).toBeVisible()
    })

    test('a customer record refused with sso_required opens the SSO dialog, not a failure toast', async ({
      page,
      cloudAuth
    }) => {
      await answerDiscover(page, 200, NOT_SSO)
      await cloudAuth.mockLiveEmailSignIn()
      await page.route('**/customers', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status: 403, json: SSO_REQUIRED })
          : route.fallback()
      )

      await signInWithEmail(page)

      await expect(
        page
          .getByRole('dialog')
          .getByRole('heading', { name: SSO_COPY.required.title })
      ).toBeVisible()
      await expect(page.getByText(/Failed to create customer/)).toHaveCount(0)
      await expect(page).toHaveURL(/\/cloud\/login/)
    })

    test('a Firebase sign-in ingest refuses with sso_required opens the SSO dialog', async ({
      page,
      cloudAuth
    }) => {
      await answerDiscover(page, 200, NOT_SSO)
      await cloudAuth.mockLiveEmailSignIn()
      await page.route('**/api/auth/session', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status: 403, json: SSO_REQUIRED })
          : route.fallback()
      )

      await signInWithEmail(page)

      const dialog = page.getByRole('dialog')
      await expect(
        dialog.getByRole('heading', { name: SSO_COPY.required.title })
      ).toBeVisible()
      await expect(
        dialog.getByText(
          SSO_COPY.required.bodyWithEmail.replace('{email}', CLOUD_SELF_EMAIL)
        )
      ).toBeVisible()
      await expect(page).toHaveURL(/\/cloud\/login/)
    })
  })
})
