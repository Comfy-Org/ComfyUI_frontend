import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import {
  cloudAppExpect,
  cloudAppFixture as test,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

/**
 * End-to-end coverage for the cloud email sign-in flow. Existing cloud specs
 * reach `/cloud/login` but none completes a sign-in and asserts the outcome,
 * so a broken deep-link round trip or a swallowed credential error would ship
 * green.
 *
 * Firebase is mocked at its REST boundary (identitytoolkit / securetoken) the
 * way CloudAuthHelper and authAccountSwitch.spec.ts already do — no emulator,
 * no real popups.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL ?? 'http://localhost:8188'

const SIGN_IN_USER = {
  uid: 'test-user-e2e',
  email: 'e2e@test.comfy.org',
  displayName: 'E2E Test User',
  idToken: 'mock-firebase-id-token',
  refreshToken: 'mock-refresh-token'
} as const

const BOOT_FEATURES = {
  onboarding_survey_enabled: false
} satisfies RemoteConfig

interface FirebasePasswordSignInResponse {
  kind: 'identitytoolkit#VerifyPasswordResponse'
  localId: string
  email: string
  displayName: string
  idToken: string
  registered: boolean
  refreshToken: string
  expiresIn: string
}

interface FirebaseLookupResponse {
  kind: 'identitytoolkit#GetAccountInfoResponse'
  users: Array<{
    localId: string
    email: string
    displayName: string
    emailVerified: boolean
    validSince: string
    lastLoginAt: string
    createdAt: string
  }>
}

interface FirebaseErrorResponse {
  error: {
    code: number
    message: string
    errors: Array<{ message: string; domain: string; reason: string }>
  }
}

const lookupResponse: FirebaseLookupResponse = {
  kind: 'identitytoolkit#GetAccountInfoResponse',
  users: [
    {
      localId: SIGN_IN_USER.uid,
      email: SIGN_IN_USER.email,
      displayName: SIGN_IN_USER.displayName,
      emailVerified: true,
      validSince: '0',
      lastLoginAt: String(Date.now()),
      createdAt: String(Date.now())
    }
  ]
}

function firebaseError(message: string): FirebaseErrorResponse {
  return {
    error: {
      code: 400,
      message,
      errors: [{ message, domain: 'global', reason: 'invalid' }]
    }
  }
}

/**
 * Route Firebase's password sign-in endpoint. `outcome` picks between a
 * successful credential and the error code the backend returns for a bad
 * password; every other identitytoolkit call resolves to the account lookup.
 */
async function mockFirebasePasswordSignIn(
  page: Page,
  outcome: 'success' | 'wrong-password'
) {
  await page.unroute('**/identitytoolkit.googleapis.com/**')
  await page.route('**/identitytoolkit.googleapis.com/**', async (route) => {
    const request = route.request()

    if (request.url().includes('accounts:signInWithPassword')) {
      if (outcome === 'wrong-password') {
        await route.fulfill({
          status: 400,
          json: firebaseError('INVALID_LOGIN_CREDENTIALS')
        })
        return
      }

      const response = {
        kind: 'identitytoolkit#VerifyPasswordResponse',
        localId: SIGN_IN_USER.uid,
        email: SIGN_IN_USER.email,
        displayName: SIGN_IN_USER.displayName,
        idToken: SIGN_IN_USER.idToken,
        registered: true,
        refreshToken: SIGN_IN_USER.refreshToken,
        expiresIn: '3600'
      } satisfies FirebasePasswordSignInResponse
      await route.fulfill({ json: response })
      return
    }

    await route.fulfill({ json: lookupResponse })
  })
}

/** Boots the cloud app signed out, so navigation lands on /cloud/login. */
async function bootSignedOut(page: Page) {
  await mockCloudBoot(page, { features: BOOT_FEATURES })
  await page.route('**/api/auth/token', (r) =>
    r.fulfill(
      jsonRoute({
        token: 'mock-workspace-token',
        expires_at: new Date(Date.now() + 3_600_000).toISOString()
      })
    )
  )
  await page.route('**/customers', (r) =>
    r.fulfill({ status: 201, json: { id: 'test-customer-id' } })
  )
}

async function submitEmailSignIn(page: Page) {
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page.getByLabel('Email').fill(SIGN_IN_USER.email)
  await page.getByLabel('Password').fill('correct-horse-battery')
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test.describe('Cloud email sign-in', { tag: '@cloud' }, () => {
  test('a signed-out visitor to a deep link returns there after signing in', async ({
    page
  }) => {
    await bootSignedOut(page)
    await mockFirebasePasswordSignIn(page, 'success')

    // The guard bounces an unauthenticated visitor to login, recording where
    // they were headed. Losing previousFullPath here strands the user on the
    // app root and silently drops the link they followed.
    await page.goto(
      `${APP_URL}/cloud/login?previousFullPath=${encodeURIComponent('/?deepLink=1')}`
    )
    await expect(page).toHaveURL(/\/cloud\/login/)

    await submitEmailSignIn(page)

    await cloudAppExpect(page).toHaveURL(/deepLink=1/)
  })

  test('a wrong password surfaces a visible error and stays on the form', async ({
    page
  }) => {
    await bootSignedOut(page)
    await mockFirebasePasswordSignIn(page, 'wrong-password')

    await page.goto(`${APP_URL}/cloud/login`)
    await expect(page).toHaveURL(/\/cloud\/login/)

    await submitEmailSignIn(page)

    // Before the banner was wired, this failure was toast-only and the user was
    // left staring at an unchanged form with no idea what went wrong.
    await expect(
      page.getByText(/invalid login credentials|password you entered/i)
    ).toBeVisible()
    await expect(page).toHaveURL(/\/cloud\/login/)
  })

  test('an already-signed-in visitor to /cloud/login is passed through to the app', async ({
    page
  }) => {
    await mockCloudBoot(page, { features: BOOT_FEATURES })
    await bootCloud(page)

    await page.goto(`${APP_URL}/cloud/login`)

    // The beforeEnter guard's integrated form: a signed-in user must never be
    // parked on a login screen they have no reason to see.
    await waitForCloudApp(page)
    await expect(page).not.toHaveURL(/\/cloud\/login/)
  })

  test('?switchAccount keeps a signed-in visitor on the login form', async ({
    page
  }) => {
    await mockCloudBoot(page, { features: BOOT_FEATURES })
    await bootCloud(page)

    await page.goto(`${APP_URL}/cloud/login?switchAccount=1`)

    // The escape hatch: without it, signing into a different account is
    // impossible because the guard bounces you into the session you are
    // trying to leave.
    await expect(
      page.getByRole('button', { name: 'Use email instead' })
    ).toBeVisible()
    await expect(page).toHaveURL(/switchAccount=1/)
  })
})
