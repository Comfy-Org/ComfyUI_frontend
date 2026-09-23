import type { Locator, Page } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import {
  cloudAppExpect as expect,
  cloudAppFixture,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import type { WorkspaceStore } from '@e2e/types/globals'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
const BOOT_FEATURES = {} satisfies RemoteConfig
const BOOT_SETTINGS = {
  'Comfy.TutorialCompleted': true,
  'Comfy.Workflow.Persist': true
}

class WorkflowDraftForeignWindowSignInHelper {
  public readonly logoutButton: Locator

  constructor(private readonly page: Page) {
    this.logoutButton = page.getByRole('button', {
      name: 'Logout (E2E Test User)'
    })
  }

  async boot(): Promise<void> {
    await this.bootWindow(this.page)
  }

  async touchGraph(): Promise<string> {
    return await this.page.evaluate(() => {
      const app = window.app!
      const graph = app.rootGraph
      const e2eTouch = crypto.randomUUID()
      graph.extra = { ...graph.extra, e2eTouch }

      const { activeWorkflow } = (app.extensionManager as WorkspaceStore)
        .workflow
      const activeState = activeWorkflow?.activeState
      if (!activeState) throw new Error('no active workflow to persist')

      app.api.dispatchCustomEvent('graphChanged', activeState)
      return e2eTouch
    })
  }

  getDraftKeys(): Promise<string[]> {
    return this.page.evaluate(() => {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('Comfy.Workflow.Draft.v2:')) keys.push(key)
      }
      return keys.sort()
    })
  }

  hasPersistedTouch(e2eTouch: string): Promise<boolean> {
    return this.page.evaluate((expectedTouch) => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key?.startsWith('Comfy.Workflow.Draft.v2:')) continue

        const rawPayload = localStorage.getItem(key)
        if (!rawPayload) continue

        const payload: unknown = JSON.parse(rawPayload)
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
          'e2eTouch' in graph.extra &&
          graph.extra.e2eTouch === expectedTouch
        )
          return true
      }

      return false
    }, e2eTouch)
  }

  hasWorkspaceContext(): Promise<boolean> {
    return this.page.evaluate(
      () => sessionStorage.getItem('Comfy.Workspace.Current') !== null
    )
  }

  hasClearedWorkspaceContext(): Promise<boolean> {
    return this.page.evaluate(
      () => sessionStorage.getItem('Comfy.Workspace.Current') === null
    )
  }

  seedIdentityScopedDrafts(): Promise<{
    departingKey: string
    otherIdentityKey: string
  }> {
    return this.page.evaluate(() => {
      const departingKey = Object.keys(localStorage).find((key) =>
        key.startsWith('Comfy.Workflow.Draft.v2:')
      )
      if (!departingKey) throw new Error('no departing identity draft')
      const otherIdentityKey =
        'Comfy.Workflow.Draft.v2:other-user:ws-personal:other'
      localStorage.setItem(otherIdentityKey, '{"data":"{}","updatedAt":1}')
      return { departingKey, otherIdentityKey }
    })
  }

  hasStorageValue(key: string): Promise<boolean> {
    return this.page.evaluate(
      (storageKey) => localStorage.getItem(storageKey) !== null,
      key
    )
  }

  async logout(): Promise<void> {
    await this.page.getByRole('button', { name: 'Current user' }).click()
    await this.page.getByTestId('logout-menu-item').click()
    await this.page.getByRole('button', { name: 'Sign out anyway' }).click()
  }

  private async bootWindow(page: Page): Promise<void> {
    await mockCloudBoot(page, {
      features: BOOT_FEATURES,
      settings: BOOT_SETTINGS
    })
    await bootCloud(page)
    await page.goto(APP_URL)
    await waitForCloudApp(page)
    await page.evaluate(() => {
      sessionStorage.setItem(
        'Comfy.Workspace.Current',
        JSON.stringify({
          id: 'ws-personal',
          name: 'Personal Workspace',
          type: 'personal',
          role: 'owner',
          created_at: '2026-01-01T00:00:00Z',
          joined_at: '2026-01-01T00:00:00Z'
        })
      )
      sessionStorage.setItem('Comfy.Workspace.Token', 'mock-workspace-token')
      sessionStorage.setItem(
        'Comfy.Workspace.ExpiresAt',
        String(Date.now() + 60 * 60 * 1000)
      )
      sessionStorage.setItem('Comfy.Workspace.OwnerUid', 'test-user-e2e')
    })
    await page.waitForFunction(
      () =>
        !!(window.app!.extensionManager as WorkspaceStore).workflow
          .activeWorkflow?.activeState
    )
  }
}

export const workflowDraftForeignWindowSignInFixture = cloudAppFixture.extend<{
  workflowDraft: WorkflowDraftForeignWindowSignInHelper
}>({
  workflowDraft: async ({ page }, use) => {
    const workflowDraft = new WorkflowDraftForeignWindowSignInHelper(page)
    await workflowDraft.boot()
    await use(workflowDraft)
  }
})

export { expect }
