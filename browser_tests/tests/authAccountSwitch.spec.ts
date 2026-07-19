import { expect } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { WorkspaceTokenResponse } from '@/platform/workspace/stores/workspaceAuthStore'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { AssetsSidebarTab } from '@e2e/fixtures/components/SidebarTab'
import {
  DEFAULT_TEAM_MEMBERS,
  TEAM_WORKSPACE,
  WORKSPACE_FEATURE_FLAG
} from '@e2e/fixtures/data/cloudWorkspace'
import { AssetsHelper, createMockJob } from '@e2e/fixtures/helpers/AssetsHelper'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { member } from '@e2e/fixtures/utils/workspaceMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL ?? 'http://localhost:8188'

const ACCOUNT_A = {
  id: 'a',
  uid: 'test-user-e2e',
  email: 'e2e@test.comfy.org',
  displayName: 'E2E Test User',
  idToken: 'mock-firebase-id-token',
  refreshToken: 'mock-refresh-token'
} as const

const ACCOUNT_B = {
  id: 'b',
  uid: 'test-user-b',
  email: 'account-b@test.comfy.org',
  displayName: 'Account B',
  idToken: 'firebase-id-token-b',
  refreshToken: 'firebase-refresh-token-b'
} as const

type MockAccount = typeof ACCOUNT_A | typeof ACCOUNT_B

function accountForToken(token: string | null): MockAccount {
  if (
    token?.includes(ACCOUNT_B.idToken) ||
    token?.includes(ACCOUNT_B.refreshToken)
  ) {
    return ACCOUNT_B
  }
  if (
    token?.includes(ACCOUNT_A.idToken) ||
    token?.includes(ACCOUNT_A.refreshToken)
  ) {
    return ACCOUNT_A
  }
  throw new Error(`Unexpected account token: ${token ?? 'missing'}`)
}

function firebaseLookupResponse(account: MockAccount) {
  return {
    kind: 'identitytoolkit#GetAccountInfoResponse',
    users: [
      {
        localId: account.uid,
        email: account.email,
        displayName: account.displayName,
        emailVerified: true,
        providerUserInfo: [
          {
            providerId: 'password',
            rawId: account.uid,
            email: account.email,
            displayName: account.displayName
          }
        ],
        validSince: '0',
        lastLoginAt: String(Date.now()),
        createdAt: String(Date.now())
      }
    ]
  }
}

test.describe('Cloud account switch', { tag: '@cloud' }, () => {
  test('keeps workspace bearer and session cookie on the switched account', async ({
    page
  }) => {
    await new CloudWorkspaceMockHelper(page).setup([
      ...DEFAULT_TEAM_MEMBERS,
      member({
        id: ACCOUNT_B.uid,
        name: ACCOUNT_B.displayName,
        email: ACCOUNT_B.email,
        role: 'member'
      })
    ])

    await page.unroute('**/api/features')
    await page.unroute('**/api/auth/token')
    await page.unroute('**/api/auth/session')
    await page.unroute('**/identitytoolkit.googleapis.com/**')
    await page.unroute('**/securetoken.googleapis.com/**')

    const features = {
      ...WORKSPACE_FEATURE_FLAG,
      onboarding_survey_enabled: false,
      unified_cloud_auth: false
    } satisfies RemoteConfig

    await page.route('**/api/features', (route) =>
      route.fulfill({ json: features })
    )

    await page.route('**/identitytoolkit.googleapis.com/**', async (route) => {
      const request = route.request()
      if (request.url().includes('accounts:signInWithPassword')) {
        await route.fulfill({
          json: {
            kind: 'identitytoolkit#VerifyPasswordResponse',
            localId: ACCOUNT_B.uid,
            email: ACCOUNT_B.email,
            displayName: ACCOUNT_B.displayName,
            idToken: ACCOUNT_B.idToken,
            registered: true,
            refreshToken: ACCOUNT_B.refreshToken,
            expiresIn: '3600'
          }
        })
        return
      }

      const body = request.postDataJSON() as { idToken?: string }
      await route.fulfill({
        json: firebaseLookupResponse(accountForToken(body.idToken ?? null))
      })
    })

    await page.route('**/securetoken.googleapis.com/**', async (route) => {
      const refreshToken = new URLSearchParams(
        route.request().postData() ?? ''
      ).get('refresh_token')
      const account = accountForToken(refreshToken)
      await route.fulfill({
        json: {
          access_token: account.idToken,
          expires_in: '3600',
          token_type: 'Bearer',
          refresh_token: account.refreshToken,
          id_token: account.idToken,
          user_id: account.uid,
          project_id: 'dreamboothy-dev'
        }
      })
    })

    const workspaceMintOwners: string[] = []
    await page.route('**/api/auth/token', async (route) => {
      const authorization = await route.request().headerValue('authorization')
      const account = accountForToken(authorization)
      workspaceMintOwners.push(account.id)
      const response = {
        token: `workspace-jwt-${account.id}`,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        workspace: {
          id: TEAM_WORKSPACE.id,
          name: TEAM_WORKSPACE.name,
          type: TEAM_WORKSPACE.type
        },
        role: account === ACCOUNT_A ? 'owner' : 'member',
        permissions: []
      } satisfies WorkspaceTokenResponse
      await route.fulfill({ json: response })
    })

    const sessionOwners: string[] = []
    await page.route('**/api/auth/session', async (route) => {
      const authorization = await route.request().headerValue('authorization')
      const account = accountForToken(authorization)
      sessionOwners.push(account.id)
      await route.fulfill({
        status: 200,
        headers: {
          'set-cookie': `mock-cloud-session=${account.id}; Path=/; HttpOnly; SameSite=Lax`
        },
        json: {}
      })
    })

    await page.route('**/customers', (route) =>
      route.fulfill({ status: 201, json: { id: 'test-customer-id' } })
    )

    const assets = new AssetsHelper(page)
    await assets.mockOutputHistory([
      createMockJob({
        id: 'account-switch-job',
        preview_output: {
          filename: 'account-switch.webp',
          subfolder: '',
          type: 'output',
          nodeId: '9',
          mediaType: 'images'
        }
      })
    ])
    await assets.mockEmptyCloudAssets()

    let jobsAuthorization: string | null = null
    await page.route('**/api/jobs?*', async (route) => {
      jobsAuthorization = await route.request().headerValue('authorization')
      await route.fallback()
    })

    let viewCookie: string | null = null
    let viewStatus: number | null = null
    await page.route('**/api/view?*', async (route) => {
      viewCookie = await route.request().headerValue('cookie')
      const bearerOwner = jobsAuthorization?.endsWith('-b') ? 'b' : 'a'
      const cookieOwner = viewCookie?.includes('mock-cloud-session=b')
        ? 'b'
        : 'a'

      if (bearerOwner !== cookieOwner) {
        viewStatus = 404
        await route.fulfill({
          status: 404,
          json: { code: 'FILE_NOT_FOUND' }
        })
        return
      }

      viewStatus = 200
      await route.fulfill({
        status: 200,
        contentType: 'image/webp',
        path: assetPath('image32x32.webp')
      })
    })

    await page.goto(APP_URL)
    await expect.poll(() => workspaceMintOwners).toContain('a')
    await expect.poll(() => sessionOwners).toContain('a')

    await page.goto(`${APP_URL}/cloud/login?switchAccount=true`)
    await page.getByRole('button', { name: 'Use email instead' }).click()
    await page.getByLabel('Email').fill(ACCOUNT_B.email)
    await page.getByLabel('Password').fill('password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(
      page.getByRole('button', { name: 'Current user' })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Current user' }).click()
    await expect(page.getByText(ACCOUNT_B.email, { exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect.poll(() => workspaceMintOwners).toContain('b')
    await expect.poll(() => sessionOwners).toContain('b')

    await new AssetsSidebarTab(page).open()
    const card = page.locator('[data-asset-id="account-switch-job"]')
    const image = card.getByRole('img', { name: 'account-switch.webp' })

    await expect(card).toBeVisible()
    await expect(image).toBeVisible()
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => element.naturalWidth)
      )
      .toBeGreaterThan(0)
    expect(jobsAuthorization).toBe('Bearer workspace-jwt-b')
    expect(viewCookie).toContain('mock-cloud-session=b')
    expect(viewStatus).toBe(200)
  })
})
