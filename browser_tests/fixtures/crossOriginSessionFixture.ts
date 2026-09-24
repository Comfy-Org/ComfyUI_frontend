import type { BrowserContext, TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'

import { SESSION_PATH, SessionTab } from '@e2e/fixtures/helpers/SessionTab'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'
import type {
  CrossOriginSessionEnv,
  CrossOriginSessionEnvKey,
  CrossOriginSessionOptions
} from '@e2e/fixtures/utils/crossOriginSessionConfig'
import {
  allowedOrigins,
  isComfyHost,
  isProductionHost,
  mappedOrigins,
  missingSessionEnv,
  parseCrossOriginSessionEnv
} from '@e2e/fixtures/utils/crossOriginSessionConfig'
import type { NetworkPolicy } from '@e2e/fixtures/utils/networkPolicy'

type StringEnvKey = Exclude<
  CrossOriginSessionEnvKey,
  'SESSION_E2E_EXTRA_ORIGINS'
>

type SessionAccount = { email: string; password: string }

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
  const mapped = mappedOrigins(env)
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const localOrigin = mapped.get(url.origin)
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
    if (isProductionHost(url.hostname)) {
      networkPolicy.unexpected.add(
        `Production ${request.method()} ${url.origin}${url.pathname}`
      )
      await route.abort('blockedbyclient')
      return
    }
    if (isComfyHost(url.hostname)) networkPolicy.origins.add(url.origin)
    await route.fallback()
  })
}

export function sessionEndpoint(cloud: SessionTab): string {
  return `${cloud.origin}${SESSION_PATH}`
}

/** An untrusted page on a PR preview name, served blank by the harness. */
export async function openPreviewPage(
  context: BrowserContext,
  previewOrigin = 'https://pr-1.testenvs.comfy.org'
): Promise<SessionTab> {
  await context.route(`${previewOrigin}/**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html>' })
  )
  const preview = new SessionTab(await context.newPage(), previewOrigin)
  await preview.goto('/')
  return preview
}

export async function signInOnCloud(
  cloud: SessionTab,
  account: SessionAccount
) {
  const { page } = cloud
  await cloud.goto('/cloud/login')
  await page
    .getByRole('button', { name: 'Use email instead', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  const sessionCreated = cloud.waitForResponse('POST', sessionEndpoint(cloud))
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  expect((await sessionCreated).ok(), 'Cloud creates its session').toBe(true)
}

export const crossOriginSessionFixture = base.extend<
  CrossOriginSessionOptions & {
    sessionEnv: CrossOriginSessionEnv
    sessionAccount: SessionAccount
    teamWorkspaceId: string
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
  cloudTab: async (
    { context, sessionEnv, unifiedWebSession },
    use,
    testInfo
  ) => {
    requireEnv(sessionEnv, ['SESSION_E2E_CLOUD_URL'], testInfo)
    await use(
      new SessionTab(
        await context.newPage(),
        envValue(sessionEnv, 'SESSION_E2E_CLOUD_URL'),
        { ff: `${UNIFIED_WEB_SESSION}:${unifiedWebSession}` }
      )
    )
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

/**
 * What a credentialed fetch from `tab` gets back: the body when the browser
 * lets the page read it, `unreadable` when CORS or the network refuses.
 */
export function credentialedFetch(
  tab: SessionTab,
  url: string,
  method = 'GET'
): Promise<string> {
  return tab.page.evaluate(
    async ({ url, method }) => {
      try {
        const response = await fetch(url, { method, credentials: 'include' })
        return `${response.status} ${await response.text()}`
      } catch {
        return 'unreadable'
      }
    },
    { url, method }
  )
}
