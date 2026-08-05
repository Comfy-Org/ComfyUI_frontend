import type { Page } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { mockSystemStats } from '@e2e/fixtures/data/systemStats'
import { CloudAuthHelper } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

interface CloudBootOptions {
  /** Remote-config payload for `/api/features` (enables the flags under test). */
  features: RemoteConfig
  /** Body for `/api/settings` (defaults to `{}`). */
  settings?: unknown
}

/**
 * Stub the core endpoints the cloud app hits on boot so a raw `page` reaches the
 * working app without falling through to the OSS devtools backend. Specs layer
 * their own feature- or flow-specific routes on top.
 */
export async function mockCloudBoot(
  page: Page,
  { features, settings = {} }: CloudBootOptions
) {
  await page.route('**/api/features', (r) => r.fulfill(jsonRoute(features)))
  await page.route('**/api/system_stats', (r) =>
    r.fulfill(jsonRoute(mockSystemStats))
  )
  await page.route('**/api/users', (r) =>
    r.fulfill(
      jsonRoute({
        storage: 'server',
        migrated: true,
        users: { 'test-user-e2e': 'E2E Test User' }
      })
    )
  )
  await page.route('**/api/user', (r) =>
    r.fulfill(jsonRoute({ status: 'active' }))
  )
  await page.route('**/api/settings', (r) => r.fulfill(jsonRoute(settings)))
  await page.route('**/api/userdata**', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/extensions', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/object_info', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/global_subgraphs', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/i18n', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/auth/session', (r) =>
    r.fulfill(jsonRoute({ token: 'mock-workspace-token' }))
  )
  await page.route('**/releases**', (r) => r.fulfill(jsonRoute([])))
}

/**
 * Mock Firebase auth and pre-select the e2e user so the cloud app boots
 * signed-in. The signed-in email (`CLOUD_SELF_EMAIL`) is what the
 * original-owner gate matches against the members self-row.
 */
export async function bootCloud(page: Page) {
  const auth = new CloudAuthHelper(page)
  await auth.mockAuth()
  await page.addInitScript(() => {
    localStorage.setItem('Comfy.userId', 'test-user-e2e')
  })
}
