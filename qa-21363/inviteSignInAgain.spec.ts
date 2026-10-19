import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

import type { AcceptInviteResponse } from '@comfyorg/ingest-types'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { CLOUD_SELF_EMAIL } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { webSessionTest } from '@e2e/fixtures/webSessionFixture'

const SHOTS = 'temp/qa-evidence/pr-21363/visual/shots'
const INVITE_TOKEN = 'tok-123'
const ACCEPTED: AcceptInviteResponse = {
  workspace_id: 'ws-invited',
  workspace_name: 'Invited Workspace'
}
const SESSION_UID = 'test-user-e2e'
const ID_TOKEN = 'invite-qa-id-token'
const REFRESH_TOKEN = 'invite-qa-refresh-token'

function isAcceptRequest(request: Request): boolean {
  return /^\/api\/invites\/[^/]+\/accept$/.test(new URL(request.url()).pathname)
}

async function mockAccept(page: Page, accepted: string[]): Promise<void> {
  await page.route('**/api/invites/*/accept', async (route) => {
    accepted.push(new URL(route.request().url()).pathname.split('/')[3])
    await route.fulfill({ json: ACCEPTED })
  })
}

async function serveAppShellForLogin(page: Page, appUrl: string) {
  await page.route('**/cloud/login**', async (route) => {
    if (route.request().resourceType() !== 'document') return route.fallback()
    const shell = await route.fetch({ url: new URL('/', appUrl).toString() })
    await route.fulfill({ response: shell })
  })
}

async function mockFirebasePasswordSignIn(page: Page): Promise<void> {
  await page.route('**/identitytoolkit.googleapis.com/**', async (route) => {
    const url = route.request().url()
    if (url.includes('accounts:signInWithPassword')) {
      await route.fulfill({
        json: {
          kind: 'identitytoolkit#VerifyPasswordResponse',
          localId: SESSION_UID,
          email: CLOUD_SELF_EMAIL,
          displayName: 'E2E Test User',
          idToken: ID_TOKEN,
          registered: true,
          refreshToken: REFRESH_TOKEN,
          expiresIn: '3600'
        }
      })
      return
    }
    await route.fulfill({
      json: {
        kind: 'identitytoolkit#GetAccountInfoResponse',
        users: [
          {
            localId: SESSION_UID,
            email: CLOUD_SELF_EMAIL,
            displayName: 'E2E Test User',
            emailVerified: true,
            providerUserInfo: [
              {
                providerId: 'password',
                rawId: SESSION_UID,
                email: CLOUD_SELF_EMAIL,
                displayName: 'E2E Test User'
              }
            ],
            validSince: '0',
            lastLoginAt: String(Date.now()),
            createdAt: String(Date.now())
          }
        ]
      }
    })
  })
  await page.route('**/securetoken.googleapis.com/**', (route) =>
    route.fulfill({
      json: {
        access_token: ID_TOKEN,
        expires_in: '3600',
        token_type: 'Bearer',
        refresh_token: REFRESH_TOKEN,
        id_token: ID_TOKEN,
        user_id: SESSION_UID,
        project_id: 'dreamboothy-dev'
      }
    })
  )
  await page.route('**/customers', (route) =>
    route.fulfill({ status: 201, json: { id: 'test-customer-id' } })
  )
}

webSessionTest.describe(
  'Invite link on a tab with no Firebase login',
  { tag: '@cloud' },
  () => {
    webSessionTest.describe.configure({ timeout: 90_000 })
    webSessionTest.use({ firebaseLogin: false })

    webSessionTest(
      'offers a sign-in, then accepts the invite after the sign-in',
      async ({ comfyPage, firebaseRequests }) => {
        const page = comfyPage.page
        const accepted: string[] = []
        await mockAccept(page, accepted)

        await webSessionTest.step('Open the invite link', async () => {
          await comfyPage.goto({ url: `/?invite=${INVITE_TOKEN}` })
          await comfyPage.waitForAppReady()
          const toast = comfyPage.toast.withText(
            'Sign in to accept this invite'
          )
          await expect(toast).toBeVisible()
          await expect(
            toast.getByText(
              'This browser is signed in, but accepting an invite needs you to sign in here once.'
            )
          ).toBeVisible()
          await expect(toast.getByRole('button', { name: 'Sign in' })).toBeVisible()
          await expect(page).not.toHaveURL(/invite=/)
          expect(accepted).toEqual([])
          expect(firebaseRequests).toEqual([])
          await page.screenshot({ path: `${SHOTS}/1-session-only-toast.png` })
        })

        await webSessionTest.step('Click Sign in', async () => {
          await serveAppShellForLogin(page, comfyPage.url)
          await comfyPage.toast
            .withText('Sign in to accept this invite')
            .getByRole('button', { name: 'Sign in' })
            .click()
          await expect(page).toHaveURL(/\/cloud\/login\?/)
          const loginUrl = new URL(page.url())
          expect(loginUrl.searchParams.get('switchAccount')).toBe('true')
          expect(
            decodeURIComponent(loginUrl.searchParams.get('previousFullPath') ?? '')
          ).toBe(`/?invite=${INVITE_TOKEN}`)
          await expect(
            page.getByRole('button', { name: 'Use email instead' })
          ).toBeVisible()
          await page.screenshot({ path: `${SHOTS}/2-login-after-sign-in.png` })
        })

        await webSessionTest.step(
          'Sign in, then the app accepts the invite',
          async () => {
            await mockFirebasePasswordSignIn(page)
            await page.getByRole('button', { name: 'Use email instead' }).click()
            await page.getByLabel('Email').fill(CLOUD_SELF_EMAIL)
            await page
              .getByRole('textbox', { name: 'Password', exact: true })
              .fill('password')
            await page.getByRole('button', { name: 'Sign in' }).click()
            await expect
              .poll(() => accepted, { timeout: 45_000 })
              .toEqual([INVITE_TOKEN])
            await expect(
              comfyPage.toast.withText('Invite Accepted')
            ).toBeVisible()
            await page.screenshot({ path: `${SHOTS}/3-invite-accepted.png` })
          }
        )
      }
    )
  }
)

comfyPageFixture.describe(
  'Invite link on a tab with a Firebase login',
  { tag: '@cloud' },
  () => {
    comfyPageFixture(
      'accepts the invite with no sign-in toast',
      async ({ comfyPage }) => {
        const page = comfyPage.page
        const accepted: string[] = []
        await mockAccept(page, accepted)

        await comfyPage.goto({ url: `/?invite=${INVITE_TOKEN}` })
        await comfyPage.waitForAppReady()

        await expect.poll(() => accepted).toEqual([INVITE_TOKEN])
        await expect(comfyPage.toast.withText('Invite Accepted')).toBeVisible()
        await expect(
          comfyPage.toast.withText('Sign in to accept this invite')
        ).toHaveCount(0)
        await page.screenshot({ path: `${SHOTS}/4-firebase-tab-accepts.png` })
      }
    )
  }
)
