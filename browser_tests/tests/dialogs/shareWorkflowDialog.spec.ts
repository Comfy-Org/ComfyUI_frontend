import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { AssetInfo } from '../../../src/schemas/apiSchema'
import { comfyPageFixture } from '../../fixtures/ComfyPage'
import { TestIds } from '../../fixtures/selectors'
import type { WorkspaceStore } from '../../types/globals'

interface PublishRecord {
  workflow_id: string
  share_id: string | null
  listed: boolean
  publish_time: string | null
}

const PUBLISHED_RECORD: PublishRecord = {
  workflow_id: 'wf-1',
  share_id: 'share-abc',
  listed: false,
  publish_time: new Date(Date.now() + 60_000).toISOString()
}

const PRIVATE_ASSET: AssetInfo = {
  id: 'asset-1',
  name: 'photo.png',
  preview_url: '',
  storage_url: '',
  model: false,
  public: false,
  in_library: false
}

const test = comfyPageFixture

/**
 * Enable the workflow_sharing_enabled server feature flag at runtime.
 * FeatureFlagHelper.mockServerFeatures() intercepts `/api/features` but the
 * flags are already loaded by the time tests run, so direct mutation of the
 * reactive ref is the only reliable approach for server-side flags.
 */
async function enableWorkflowSharing(page: Page): Promise<void> {
  await page.evaluate(() => {
    const api = window.app!.api
    api.serverFeatureFlags.value = {
      ...api.serverFeatureFlags.value,
      workflow_sharing_enabled: true
    }
  })
}

async function mockPublishStatus(
  page: Page,
  record: PublishRecord | null
): Promise<void> {
  await page.route('**/api/userdata/*/publish', async (route) => {
    if (route.request().method() === 'GET') {
      if (!record || !record.share_id) {
        await route.fulfill({ status: 404, body: 'Not found' })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(record)
        })
      }
    } else {
      await route.fallback()
    }
  })
}

async function mockPublishWorkflow(
  page: Page,
  result: PublishRecord
): Promise<void> {
  await page.route('**/api/userdata/*/publish', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(result)
      })
    } else {
      await route.fallback()
    }
  })
}

async function mockShareableAssets(
  page: Page,
  assets: AssetInfo[] = []
): Promise<void> {
  await page.route('**/api/assets/from-workflow', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ assets })
    })
  })
}

/**
 * Dismiss stale PrimeVue dialog masks left by cloud-mode's onboarding flow
 * or auth-triggered modals.  Tries Escape first; falls back to forceful DOM
 * removal because PrimeVue's transition system can leave orphaned mask
 * elements that block subsequent dialog interactions.
 */
async function dismissOverlays(page: Page): Promise<void> {
  const mask = page.locator('.p-dialog-mask')
  if ((await mask.count()) > 0) {
    await page.keyboard.press('Escape')
    await mask
      .first()
      .waitFor({ state: 'hidden', timeout: 2000 })
      .catch(() => {})
  }
  // Force-remove orphaned masks that CSS transitions left behind (cloud-only)
  if ((await mask.count()) > 0) {
    await page.evaluate(() => {
      document
        .querySelectorAll('.p-dialog-mask')
        .forEach((el) => el.remove())
    })
  }
}

/**
 * Save the active workflow via store methods instead of the topbar Save button.
 * In cloud mode, comfyPage.menu.topbar.saveWorkflow() is unreliable because
 * auth timing and fetchApi() retries cause intermittent 409 Conflict errors.
 * Driving the store directly avoids these cloud-specific timing issues.
 */
async function saveAndWait(
  comfyPage: { page: Page },
  workflowName: string
): Promise<void> {
  const filename = workflowName + (workflowName.endsWith('.json') ? '' : '.json')
  await comfyPage.page.route(
    /\/api\/userdata\/workflows(%2F|\/).*$/,
    async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            path: `workflows/${filename}`,
            size: 1024,
            modified: Date.now()
          })
        })
      } else {
        await route.fallback()
      }
    }
  )

  const evalResult = await comfyPage.page.evaluate(async (name: string) => {
    const store = (window.app!.extensionManager as WorkspaceStore).workflow
    const workflow = store.activeWorkflow
    if (!workflow) return { error: 'No active workflow' }

    const wasTemporary = workflow.isTemporary
    const oldPath = workflow.path

    const newPath =
      workflow.directory +
      '/' +
      name +
      (name.endsWith('.json') ? '' : '.json')

    if (workflow.isTemporary) {
      await store.renameWorkflow(workflow, newPath)
    }
    workflow.changeTracker?.checkState()
    await store.saveWorkflow(workflow)

    return {
      oldPath,
      newPath,
      wasTemporary,
      afterPath: workflow.path,
      afterSize: workflow.size,
      afterIsTemporary: workflow.isTemporary
    }
  }, workflowName)

  if ('error' in evalResult) {
    throw new Error(`saveAndWait failed: ${evalResult.error}`)
  }

  // In cloud mode, the detach/attach cycle during saveWorkflow can trigger
  // reactivity that switches activeWorkflow to a new default tab.
  // Re-open the saved workflow to ensure it's the active one.
  await comfyPage.page.evaluate(async (savedPath: string) => {
    const store = (window.app!.extensionManager as WorkspaceStore).workflow
    const saved = store.getWorkflowByPath(savedPath)
    if (saved && store.activeWorkflow?.path !== savedPath) {
      await store.openWorkflow(saved)
    }
  }, evalResult.afterPath)

  await expect
    .poll(
      () =>
        comfyPage.page.evaluate(() => {
          const wf = (window.app!.extensionManager as WorkspaceStore).workflow
            .activeWorkflow
          return wf && !wf.isTemporary ? wf.path : null
        }),
      { timeout: 5000 }
    )
    .toBe(evalResult.afterPath)

  // After save, the detach/attach cycle and graph serialization differences
  // can cause changeTracker.checkState() to set isModified back to true.
  // Force isModified=false and reset the changeTracker so the share dialog
  // sees a clean saved state.
  await comfyPage.page.evaluate(() => {
    const wf = (window.app!.extensionManager as WorkspaceStore).workflow
      .activeWorkflow
    if (wf) {
      wf.isModified = false
      wf.changeTracker?.reset()
    }
  })
}

async function openShareDialog(page: Page): Promise<void> {
  await enableWorkflowSharing(page)
  await dismissOverlays(page)
  const shareButton = page.getByRole('button', { name: 'Share workflow' })
  await shareButton.click()
}

function getShareDialog(page: Page) {
  return page.getByRole('dialog')
}

test.describe('Share Workflow Dialog', { tag: '@cloud' }, () => {
  test('should show unsaved state for a new workflow', async ({
    comfyPage
  }) => {
    const { page } = comfyPage

    await mockPublishStatus(page, null)
    await mockShareableAssets(page)
    await openShareDialog(page)

    const dialog = getShareDialog(page)
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: /save workflow/i })
    ).toBeVisible()
  })

  test('should show ready state with create link button', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    const workflowName = 'share-test-ready'

    await saveAndWait(comfyPage, workflowName)

    await mockPublishStatus(page, null)
    await mockShareableAssets(page)
    await openShareDialog(page)

    const dialog = getShareDialog(page)
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: /create a link/i })
    ).toBeVisible()
  })

  test('should show shared state with copy URL after publishing', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    const workflowName = 'share-test-shared'

    await saveAndWait(comfyPage, workflowName)

    await mockPublishStatus(page, PUBLISHED_RECORD)
    await mockShareableAssets(page)
    await openShareDialog(page)

    const dialog = getShareDialog(page)
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole('textbox', { name: /share.*url/i })
    ).toBeVisible()
  })

  test('should show stale state with update link button', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    const workflowName = 'share-test-stale'

    await saveAndWait(comfyPage, workflowName)

    const staleRecord: PublishRecord = {
      ...PUBLISHED_RECORD,
      publish_time: '2020-01-01T00:00:00Z'
    }

    await mockPublishStatus(page, staleRecord)
    await mockShareableAssets(page)
    await openShareDialog(page)

    const dialog = getShareDialog(page)
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: /update\s+link/i })
    ).toBeVisible()
  })

  test('should close dialog when close button is clicked', async ({
    comfyPage
  }) => {
    const { page } = comfyPage

    await mockPublishStatus(page, null)
    await mockShareableAssets(page)
    await openShareDialog(page)

    const dialog = getShareDialog(page)
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: /close/i }).click()
    await expect(dialog).toBeHidden()
  })

  test('should create link and transition to shared state', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    const workflowName = 'share-test-create'

    await saveAndWait(comfyPage, workflowName)

    await mockPublishStatus(page, null)
    await mockShareableAssets(page)
    await mockPublishWorkflow(page, PUBLISHED_RECORD)
    await openShareDialog(page)

    const dialog = getShareDialog(page)
    const createButton = dialog.getByRole('button', { name: /create a link/i })
    await expect(createButton).toBeVisible()
    await createButton.click()

    await expect(
      dialog.getByRole('textbox', { name: /share.*url/i })
    ).toBeVisible()
  })

  test('should show tab buttons when comfyHubUploadEnabled is true', async ({
    comfyPage
  }) => {
    const { page } = comfyPage

    await page.evaluate(() => {
      const api = window.app!.api
      api.serverFeatureFlags.value = {
        ...api.serverFeatureFlags.value,
        comfyhub_upload_enabled: true
      }
    })

    await mockPublishStatus(page, null)
    await mockShareableAssets(page)
    await openShareDialog(page)

    const dialog = getShareDialog(page)
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('tab', { name: /share/i })).toBeVisible()
    await expect(dialog.getByRole('tab', { name: /publish/i })).toBeVisible()
  })

  test('should switch between share link and publish tabs', async ({
    comfyPage
  }) => {
    const { page } = comfyPage

    await page.evaluate(() => {
      const api = window.app!.api
      api.serverFeatureFlags.value = {
        ...api.serverFeatureFlags.value,
        comfyhub_upload_enabled: true
      }
    })

    await mockPublishStatus(page, null)
    await mockShareableAssets(page)
    await openShareDialog(page)

    const dialog = getShareDialog(page)
    await expect(dialog).toBeVisible()

    await dialog.getByRole('tab', { name: /publish/i }).click()

    const publishPanel = dialog.getByTestId(TestIds.dialogs.publishTabPanel)
    await expect(publishPanel).toBeVisible()

    await dialog.getByRole('tab', { name: /share/i }).click()
    await expect(publishPanel).toBeHidden()
  })

  test('should require acknowledgment before publishing private assets', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    const workflowName = 'share-test-ack'

    await saveAndWait(comfyPage, workflowName)

    await mockPublishStatus(page, null)
    await mockShareableAssets(page, [PRIVATE_ASSET])
    await openShareDialog(page)

    const dialog = getShareDialog(page)
    const createButton = dialog.getByRole('button', { name: /create a link/i })
    await expect(createButton).toBeDisabled()

    await dialog.getByRole('checkbox').check()
    await expect(createButton).toBeEnabled()
  })
})
