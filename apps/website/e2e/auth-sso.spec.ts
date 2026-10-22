import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

import type {
  GetFeaturesResponse,
  SsoDiscoverResponse
} from '@comfyorg/ingest-types'

import { test } from './fixtures/blockExternalMedia'
import {
  WORKSHOP_EMAIL,
  forceWorkshopAuthFlag,
  jsonRoute,
  mockFirebaseSignIn,
  mockFirebaseSignUp,
  mockProvisioning,
  mockWorkspaceMint
} from './fixtures/workshopAuth'

const SIGN_UP_EMAIL = 'new-workshop-user@test.comfy.org'
const PASSWORD = 'Sup3r-secret!1'
const CORS = { 'access-control-allow-origin': '*' }

type SsoFeatures = GetFeaturesResponse & { sso_enabled?: boolean }

const FLAG_ABSENT: SsoFeatures = {
  'agent-free-use-message-placement': 'control'
}
const FLAG_OFF: SsoFeatures = { ...FLAG_ABSENT, sso_enabled: false }
const FLAG_ON: SsoFeatures = { ...FLAG_ABSENT, sso_enabled: true }

const SSO_ORG: SsoDiscoverResponse = { sso: true, organization_name: 'Acme' }
const NOT_SSO: SsoDiscoverResponse = { sso: false }

function isCloudPath(request: Request, pathname: string) {
  const url = new URL(request.url())
  return url.hostname.endsWith('cloud.comfy.org') && url.pathname === pathname
}

/**
 * Cloud's anonymous `/api/features`, its SSO discover and its SSO start, all
 * answered in place. The start is a full-page navigation that Cloud answers
 * with a redirect to the identity provider; it is fulfilled here, never
 * followed.
 */
async function mockCloudSso(
  page: Page,
  features: SsoFeatures,
  discovery: SsoDiscoverResponse
) {
  const discoverRequests: Request[] = []
  const firebaseRequests: string[] = []
  page.on('request', (request) => {
    if (isCloudPath(request, '/api/auth/sso/discover'))
      discoverRequests.push(request)
    if (request.url().includes('identitytoolkit.googleapis.com'))
      firebaseRequests.push(request.url())
  })
  await page.route('**/api/features', (route) =>
    route.fulfill({ ...jsonRoute(features), headers: CORS })
  )
  await page.route('**/api/auth/sso/discover', (route) =>
    route.fulfill({ ...jsonRoute(discovery), headers: CORS })
  )
  await page.route('**/api/auth/sso/start**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '' })
  )
  return { discoverRequests, firebaseRequests }
}

const MODES = [
  {
    name: 'sign-in',
    path: '/login/',
    email: WORKSHOP_EMAIL,
    mockFirebase: mockFirebaseSignIn,
    async submit(page: Page) {
      await page.getByLabel('Email').fill(WORKSHOP_EMAIL)
      await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    }
  },
  {
    name: 'sign-up',
    path: '/signup/',
    email: SIGN_UP_EMAIL,
    mockFirebase: mockFirebaseSignUp,
    async submit(page: Page) {
      await page.getByLabel('Email').fill(SIGN_UP_EMAIL)
      await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
      await page.getByLabel('Confirm Password').fill(PASSWORD)
      await page.getByRole('button', { name: 'Sign up', exact: true }).click()
    }
  }
] as const

async function openEmailForm(page: Page, path: string) {
  await page.goto(path)
  await page.getByRole('button', { name: 'Use email instead' }).click()
}

test.describe('Website email auth with enterprise SSO', () => {
  test.beforeEach(async ({ page }) => {
    await forceWorkshopAuthFlag(page)
    await mockWorkspaceMint(page)
    await mockProvisioning(page)
  })

  for (const mode of MODES) {
    for (const [flag, features] of [
      ['absent', FLAG_ABSENT],
      ['false', FLAG_OFF]
    ] as const) {
      test(`${mode.name} with sso_enabled ${flag} asks no discover and signs in through Firebase`, async ({
        page
      }) => {
        const { discoverRequests } = await mockCloudSso(page, features, SSO_ORG)
        await mode.mockFirebase(page)
        await openEmailForm(page, mode.path)

        await mode.submit(page)

        await expect(page).toHaveURL('/', { timeout: 10_000 })
        expect(discoverRequests).toEqual([])
      })
    }

    test(`${mode.name} sends an SSO email to Cloud's SSO start instead of Firebase`, async ({
      page
    }) => {
      const { discoverRequests, firebaseRequests } = await mockCloudSso(
        page,
        FLAG_ON,
        SSO_ORG
      )
      await mode.mockFirebase(page)
      const start = page.waitForRequest((request) =>
        isCloudPath(request, '/api/auth/sso/start')
      )
      await openEmailForm(page, mode.path)

      await mode.submit(page)

      const startRequest = await start
      expect(discoverRequests.map((r) => r.postDataJSON())).toEqual([
        { email: mode.email }
      ])
      const startUrl = new URL(startRequest.url())
      expect({
        origin: startUrl.origin,
        email: startUrl.searchParams.get('email'),
        returnTo: startUrl.searchParams.get('return_to'),
        navigation: startRequest.isNavigationRequest()
      }).toEqual({
        origin: new URL(discoverRequests[0].url()).origin,
        email: mode.email,
        returnTo: '/cloud/user-check',
        navigation: true
      })
      await expect(page).toHaveURL(startUrl.href)
      expect(firebaseRequests).toEqual([])
    })

    test(`${mode.name} with sso_enabled on signs a non-SSO email in through Firebase`, async ({
      page
    }) => {
      const { discoverRequests } = await mockCloudSso(page, FLAG_ON, NOT_SSO)
      await mode.mockFirebase(page)
      await openEmailForm(page, mode.path)

      await mode.submit(page)

      await expect(page).toHaveURL('/', { timeout: 10_000 })
      expect(discoverRequests.map((r) => r.postDataJSON())).toEqual([
        { email: mode.email }
      ])
    })
  }
})
