import type { Page } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import {
  cloudAppExpect as expect,
  cloudAppFixture,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import type { WorkspaceStore } from '@e2e/types/globals'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
const USER_ID = 'test-user-e2e'
const WORKSPACE_ID = 'personal'
const SCOPE = `${USER_ID}:${WORKSPACE_ID}`
const BOOT_FEATURES = {} satisfies RemoteConfig
const BOOT_SETTINGS = {
  'Comfy.TutorialCompleted': true,
  'Comfy.Workflow.Persist': true
}

type StorageSnapshot = Record<string, string | null>

class IdentityScopedDraftHelper {
  readonly scope = SCOPE
  readonly workspaceId = WORKSPACE_ID

  constructor(private readonly page: Page) {}

  async seedStorage(entries: Record<string, string>): Promise<void> {
    await this.page.addInitScript((seedEntries) => {
      for (const [key, value] of Object.entries(seedEntries)) {
        localStorage.setItem(key, value)
      }
    }, entries)
  }

  async boot(): Promise<void> {
    await mockCloudBoot(this.page, {
      features: BOOT_FEATURES,
      settings: BOOT_SETTINGS
    })
    await bootCloud(this.page)
    await this.page.goto(APP_URL)
    await waitForCloudApp(this.page)
    await this.page.waitForFunction(() => {
      const app = window.app
      return (
        !!app &&
        !!(app.extensionManager as WorkspaceStore).workflow.activeWorkflow
          ?.activeState
      )
    })
  }

  async touchGraph(): Promise<string> {
    return await this.page.evaluate(() => {
      const app = window.app
      if (!app) throw new Error('app is not ready')
      const activeState = (app.extensionManager as WorkspaceStore).workflow
        .activeWorkflow?.activeState
      if (!activeState) throw new Error('no active workflow to persist')

      const marker = crypto.randomUUID()
      app.rootGraph.extra = { ...app.rootGraph.extra, marker }
      app.api.dispatchCustomEvent('graphChanged', activeState)
      return marker
    })
  }

  async waitForMarker(scope: string, marker: string): Promise<void> {
    await this.page.waitForFunction(
      ({ expectedMarker, expectedScope }) => {
        const prefix = `Comfy.Workflow.Draft.v2:${expectedScope}:`
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (!key?.startsWith(prefix)) continue
          const raw = localStorage.getItem(key)
          if (!raw) continue
          const payload: unknown = JSON.parse(raw)
          if (
            typeof payload !== 'object' ||
            payload === null ||
            !('data' in payload) ||
            typeof payload.data !== 'string'
          )
            continue
          const graph: unknown = JSON.parse(payload.data)
          if (
            typeof graph === 'object' &&
            graph !== null &&
            'extra' in graph &&
            typeof graph.extra === 'object' &&
            graph.extra !== null &&
            'marker' in graph.extra &&
            graph.extra.marker === expectedMarker
          )
            return true
        }
        return false
      },
      { expectedMarker: marker, expectedScope: scope }
    )
  }

  readStorage(keys: string[]): Promise<StorageSnapshot> {
    return this.page.evaluate(
      (storageKeys) =>
        Object.fromEntries(
          storageKeys.map((key) => [key, localStorage.getItem(key)])
        ),
      keys
    )
  }

  readStorageKeys(): Promise<string[]> {
    return this.page.evaluate(() => Object.keys(localStorage).sort())
  }

  async logout(): Promise<void> {
    await this.page.route('**/cloud/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><body></body></html>'
      })
    )
    await this.page.getByTestId(TestIds.user.currentUserButton).click()
    await this.page.getByTestId('logout-menu-item').click()
    const confirmLogout = this.page.getByRole('button', {
      name: 'Sign out anyway'
    })
    if (await confirmLogout.isVisible()) await confirmLogout.click()
    await this.page.waitForURL('**/cloud/login')
  }
}

export const identityScopedDraftFixture = cloudAppFixture.extend<{
  identityDraft: IdentityScopedDraftHelper
}>({
  identityDraft: async ({ page }, use) => {
    await use(new IdentityScopedDraftHelper(page))
  }
})

export { expect }
