import type { Page } from '@playwright/test'

import { E2E_FIREBASE_CONFIG, E2E_USER } from './fixtures/env'
import type { MockCloud } from './fixtures/cloud'
import { entryPath, expect, test } from './fixtures/test'

const POSTHOG_HOST = 'https://posthog.e2e.test'

function serveTelemetryConfig(cloud: MockCloud): void {
  cloud.reply('GET', '/features', () => ({
    body: {
      firebase_config: E2E_FIREBASE_CONFIG,
      posthog_project_token: 'phc_e2e',
      posthog_api_host: POSTHOG_HOST
    }
  }))
}

function recordPostHogRequests(page: Page): string[] {
  const seen: string[] = []
  page.on('request', (request) => {
    if (request.url().startsWith(POSTHOG_HOST)) seen.push(request.url())
  })
  return seen
}

test('a signed-in tab loads PostHog from the telemetry config', async ({
  page,
  cloud,
  signIn
}) => {
  serveTelemetryConfig(cloud)
  const posthog = recordPostHogRequests(page)

  await signIn(entryPath('subscription'))

  await expect.poll(() => posthog.length).toBeGreaterThan(0)
})

test('a handoff tab loads no third-party telemetry', async ({
  page,
  cloud
}) => {
  serveTelemetryConfig(cloud)
  cloud.reply('POST', '/auth/handoffs/exchange', () => ({
    body: {
      session_token: 'handoff-scoped-session',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      user: { id: E2E_USER.uid, email: E2E_USER.email },
      workspace: { id: E2E_USER.workspaceId, name: 'Acme', type: 'team' },
      role: 'owner'
    }
  }))
  const posthog = recordPostHogRequests(page)

  await page.goto('/handoff#token=one-time-token')
  await expect(page).not.toHaveURL(/\/handoff/)
  await page.goto(entryPath('subscription'))
  await expect(page).not.toHaveURL(/\/sign-in/)
  await page.waitForLoadState('networkidle')

  expect(posthog).toEqual([])
})
