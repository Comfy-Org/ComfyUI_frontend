import type { BrowserContext, TestDetails, TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'

import { SessionAdmin } from '@e2e/fixtures/helpers/SessionAdmin'
import type { SessionAccount } from '@e2e/fixtures/helpers/SessionAdmin'
import { SessionTab } from '@e2e/fixtures/helpers/SessionTab'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import type {
  CrossOriginSessionEnv,
  CrossOriginSessionEnvKey,
  CrossOriginSessionOptions
} from '@e2e/fixtures/utils/crossOriginSessionConfig'
import {
  allowedOrigins,
  localUpstreamFor,
  missingSessionEnv,
  parseCrossOriginSessionEnv,
  refusedComfyEgress
} from '@e2e/fixtures/utils/crossOriginSessionConfig'
import type { NetworkPolicy } from '@e2e/fixtures/utils/networkPolicy'

type StringEnvKey = Exclude<
  CrossOriginSessionEnvKey,
  'SESSION_E2E_EXTRA_ORIGINS'
>

const UNIFIED_WEB_SESSION = 'unified_web_session'

/** Set on responses the harness served from a local upstream. */
export const SERVED_LOCALLY_HEADER = 'x-session-e2e-upstream'

function requireEnv(
  env: CrossOriginSessionEnv,
  keys: readonly StringEnvKey[],
  testInfo: TestInfo
) {
  const missing = missingSessionEnv(env, keys)
  testInfo.skip(
    missing.length > 0,
    `Set ${missing.join(', ')}. See browser_tests/tests/crossOriginSession/README.md.`
  )
}

function envValue(env: CrossOriginSessionEnv, key: StringEnvKey): string {
  const value = env[key]
  if (value === undefined) throw new Error(`${key} is not set`)
  return value
}

async function installSessionRouting(
  context: BrowserContext,
  env: CrossOriginSessionEnv,
  networkPolicy: NetworkPolicy
) {
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const localOrigin = localUpstreamFor(url, env)
    if (localOrigin) {
      const response = await route.fetch({
        url: `${localOrigin}${url.pathname}${url.search}`,
        maxRedirects: 0
      })
      const headers: Record<string, string> = {
        ...response.headers(),
        [SERVED_LOCALLY_HEADER]: localOrigin
      }
      if (headers.location) {
        headers.location = headers.location.replace(localOrigin, url.origin)
      }
      await route.fulfill({ response, headers })
      return
    }
    const refused = refusedComfyEgress(url, networkPolicy.origins)
    if (refused) {
      networkPolicy.unexpected.add(
        `${refused} ${request.method()} ${url.origin}${url.pathname}`
      )
      await route.abort('blockedbyclient')
      return
    }
    await route.fallback()
  })
}

export function blockedBy(description: string): TestDetails {
  return { annotation: { type: 'blocked-by', description } }
}

export function expectStepsWritten(): never {
  throw new Error(
    'This row has no steps yet. Write them before turning test.fixme into test.'
  )
}

export type SignInOptions = { unifiedWebSession: boolean }

async function openCloudLogin(cloud: SessionTab) {
  await cloud.goto('/cloud/login')
}

/** From the login page: email sign-in, then wait until Cloud accepts it. */
export async function submitEmailSignIn(
  cloud: SessionTab,
  account: SessionAccount,
  { unifiedWebSession }: SignInOptions
) {
  const { page } = cloud
  await page
    .getByRole('button', { name: 'Use email instead', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  const firebaseSignIn = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/v1/accounts:signInWithPassword'
  )
  const sessionCreate = unifiedWebSession
    ? page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/api/auth/session'
      )
    : undefined
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  expect((await firebaseSignIn).ok(), 'Firebase accepts the credentials').toBe(
    true
  )
  if (sessionCreate) {
    expect(
      (await sessionCreate).ok(),
      'session create refused; 429 means the hourly create limit'
    ).toBe(true)
  }
  await expect(page, 'Cloud leaves the login page').not.toHaveURL(/\/login/)
}

export async function signInOnCloud(
  cloud: SessionTab,
  account: SessionAccount,
  options: SignInOptions
) {
  await openCloudLogin(cloud)
  await submitEmailSignIn(cloud, account, options)
}

export async function waitForCloudApp(cloud: SessionTab) {
  await expect(
    cloud.page.getByTestId(TestIds.user.currentUserButton)
  ).toBeVisible()
}

/** Opens the user menu, reads the active workspace's name, closes it again. */
export async function expectActiveWorkspace(cloud: SessionTab, name: string) {
  const { page } = cloud
  const menuButton = page.getByTestId(TestIds.user.currentUserButton)
  const switcher = page.getByTestId('workspace-switcher-trigger')
  await menuButton.click()
  await expect(switcher).toContainText(name)
  await menuButton.click()
  await expect(switcher).toBeHidden()
}

export async function expectOnWebSession(cloud: SessionTab) {
  await expect
    .poll(() => cloud.sessionCalls.calls, {
      message: 'Cloud reads its web session'
    })
    .toContain(`GET ${cloud.origin}/api/auth/session`)
  const request = await cloud.nextSessionRequest(cloud.origin)
  expect(request.authorization, 'A session request carries no token').toBeNull()
}

export async function expectOffWebSession(cloud: SessionTab) {
  expect(
    cloud.sessionCalls.calls,
    'Flag off never reads a web session'
  ).not.toContain(`GET ${cloud.origin}/api/auth/session`)
  const request = await cloud.nextTokenRequest(cloud.origin)
  expect(request.authorization, 'Flag off sends the Firebase token').toMatch(
    /^Bearer /
  )
  await cloud.sockets.waitForSocket(
    ({ pathname, searchParams }) =>
      pathname === '/ws' && searchParams.has('token')
  )
}

type NewCloudTab = (options?: {
  unifiedWebSession?: boolean
}) => Promise<SessionTab>

export const crossOriginSessionFixture = base.extend<
  CrossOriginSessionOptions & {
    sessionEnv: CrossOriginSessionEnv
    sessionAccount: SessionAccount
    teamWorkspaceId: string
    sessionAdmin: SessionAdmin
    sessionCleanup: void
    newCloudTab: NewCloudTab
    cloudTab: SessionTab
    websiteTab: SessionTab
    billingTab: SessionTab
    platformTab: SessionTab
  }
>({
  unifiedWebSession: [false, { option: true }],
  sessionEnv: parseCrossOriginSessionEnv(process.env),
  networkPolicy: async ({ sessionEnv }, use, testInfo) => {
    const unexpected = new Set<string>()
    await use({ origins: allowedOrigins(sessionEnv), unexpected })
    const blocked = [...unexpected]
    await testInfo.attach('blocked-egress.json', {
      body: JSON.stringify(blocked),
      contentType: 'application/json'
    })
    expect(
      blocked.filter((entry) => entry.startsWith('Production ')),
      'A session E2E run reached production'
    ).toEqual([])
  },
  context: async (
    { context, sessionEnv, networkPolicy, unifiedWebSession },
    use
  ) => {
    await context.addInitScript(
      ({ flag, enabled }) => {
        if (location.protocol.startsWith('http')) {
          localStorage.setItem(`ff:${flag}`, JSON.stringify(enabled))
        }
      },
      { flag: UNIFIED_WEB_SESSION, enabled: unifiedWebSession }
    )
    await installSessionRouting(context, sessionEnv, networkPolicy)
    await use(context)
  },
  sessionAccount: async ({ sessionEnv }, use, testInfo) => {
    requireEnv(
      sessionEnv,
      ['SESSION_E2E_EMAIL', 'SESSION_E2E_PASSWORD'],
      testInfo
    )
    await use({
      email: envValue(sessionEnv, 'SESSION_E2E_EMAIL'),
      password: envValue(sessionEnv, 'SESSION_E2E_PASSWORD')
    })
  },
  teamWorkspaceId: async ({ sessionEnv }, use, testInfo) => {
    requireEnv(sessionEnv, ['SESSION_E2E_TEAM_WORKSPACE_ID'], testInfo)
    await use(envValue(sessionEnv, 'SESSION_E2E_TEAM_WORKSPACE_ID'))
  },
  sessionAdmin: async ({ playwright, sessionEnv, networkPolicy }, use) => {
    const request = await playwright.request.newContext()
    await use(new SessionAdmin(request, sessionEnv, networkPolicy))
    await request.dispose()
  },
  sessionCleanup: [
    async ({ sessionAdmin, sessionEnv, unifiedWebSession }, use, testInfo) => {
      if (!unifiedWebSession) {
        await use()
        return
      }
      requireEnv(
        sessionEnv,
        ['SESSION_E2E_CLOUD_URL', 'SESSION_E2E_EMAIL', 'SESSION_E2E_PASSWORD'],
        testInfo
      )
      await sessionAdmin.revokeAll()
      await use()
      await sessionAdmin.revokeAll()
    },
    { auto: true }
  ],
  newCloudTab: async (
    { context, sessionEnv, unifiedWebSession },
    use,
    testInfo
  ) => {
    requireEnv(sessionEnv, ['SESSION_E2E_CLOUD_URL'], testInfo)
    const cloudUrl = envValue(sessionEnv, 'SESSION_E2E_CLOUD_URL')
    await use(
      async ({ unifiedWebSession: flag = unifiedWebSession } = {}) =>
        new SessionTab(await context.newPage(), cloudUrl, {
          ff: `${UNIFIED_WEB_SESSION}:${flag}`
        })
    )
  },
  cloudTab: async ({ newCloudTab }, use) => {
    await use(await newCloudTab())
  },
  websiteTab: async ({ context, sessionEnv }, use, testInfo) => {
    requireEnv(
      sessionEnv,
      ['SESSION_E2E_WEBSITE_URL', 'SESSION_E2E_WEBSITE_UPSTREAM'],
      testInfo
    )
    await use(
      new SessionTab(
        await context.newPage(),
        envValue(sessionEnv, 'SESSION_E2E_WEBSITE_URL')
      )
    )
  },
  billingTab: async ({ context, sessionEnv }, use, testInfo) => {
    requireEnv(sessionEnv, ['SESSION_E2E_BILLING_URL'], testInfo)
    await use(
      new SessionTab(
        await context.newPage(),
        envValue(sessionEnv, 'SESSION_E2E_BILLING_URL')
      )
    )
  },
  platformTab: async ({ context, sessionEnv }, use, testInfo) => {
    requireEnv(sessionEnv, ['SESSION_E2E_PLATFORM_URL'], testInfo)
    await use(
      new SessionTab(
        await context.newPage(),
        envValue(sessionEnv, 'SESSION_E2E_PLATFORM_URL')
      )
    )
  }
})
