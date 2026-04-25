import { expect, mergeTests } from '@playwright/test'
import type { JobEntry } from '@comfyorg/ingest-types'

import { assetScenarioFixture } from '@e2e/fixtures/assetScenarioFixture'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { createMockJob } from '@e2e/fixtures/helpers/jobFixtures'

const test = mergeTests(comfyPageFixture, assetScenarioFixture)

const GENERATED_JOBS: JobEntry[] = [
  createMockJob({
    id: 'job-alpha',
    create_time: 1_000_000,
    execution_start_time: 1_000_000,
    execution_end_time: 1_010_000,
    preview_output: {
      filename: 'landscape.png',
      subfolder: '',
      type: 'output',
      nodeId: '1',
      mediaType: 'images'
    },
    outputs_count: 1
  }),
  createMockJob({
    id: 'job-beta',
    create_time: 2_000_000,
    execution_start_time: 2_000_000,
    execution_end_time: 2_008_000,
    preview_output: {
      filename: 'portrait.webp',
      subfolder: '',
      type: 'output',
      nodeId: '2',
      mediaType: 'images'
    },
    outputs_count: 1
  }),
  createMockJob({
    id: 'job-gamma',
    create_time: 3_000_000,
    execution_start_time: 3_000_000,
    execution_end_time: 3_015_000,
    preview_output: {
      filename: 'gallery.png',
      subfolder: '',
      type: 'output',
      nodeId: '3',
      mediaType: 'images'
    },
    outputs_count: 2
  })
]

test.describe('Assets sidebar actions', () => {
  test.beforeEach(async ({ comfyPage, assetScenario }) => {
    await assetScenario.mockGeneratedHistory(GENERATED_JOBS)
    await comfyPage.setup()
  })

  test('shows selection footer actions after selecting an asset', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.asset('gallery.png').click()

    await expect(tab.selectionFooter).toBeVisible()
    await expect(tab.selectionCountButton).toHaveText(/Assets Selected:\s*2\b/)
    await expect(tab.downloadSelectedButton).toBeVisible()
    await expect(tab.deleteSelectedButton).toBeVisible()
  })

  test('supports multi-select and deselect all', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.selectAssets(['landscape.png', 'portrait.webp'])

    await expect(tab.selectedCards).toHaveCount(2)
    await expect(tab.selectionCountButton).toHaveText(/Assets Selected:\s*2\b/)

    await tab.selectionCountButton.hover()
    await expect(tab.deselectAllButton).toBeVisible()

    await tab.deselectAllButton.click()
    await expect(tab.selectedCards).toHaveCount(0)
  })

  test('shows the output asset context menu actions', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.openContextMenuForAsset('landscape.png')

    await expect(tab.contextMenuAction('Download')).toBeVisible()
    await expect(tab.contextMenuAction('Inspect asset')).toBeVisible()
    await expect(tab.contextMenuAction('Delete')).toBeVisible()
    await expect(tab.contextMenuAction('Copy job ID')).toBeVisible()
  })

  test('shows the bulk context menu for multi-selection', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.selectAssets(['landscape.png', 'portrait.webp'])
    await expect(tab.selectionFooter).toBeVisible()

    await tab.asset('landscape.png').dispatchEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2
    })

    await expect(tab.contextMenuAction('Download all')).toBeVisible()
  })

  test('confirms delete and removes the selected asset', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    const initialCount = await tab.assetCards.count()

    await tab.runContextMenuAction('gallery.png', 'Delete')

    await expect(comfyPage.confirmDialog.root).toBeVisible()
    await expect(
      comfyPage.confirmDialog.root.getByText('Delete this asset?')
    ).toBeVisible()

    await comfyPage.confirmDialog.click('delete')

    await expect(comfyPage.confirmDialog.root).toBeHidden()
    await expect(tab.assetCards).toHaveCount(initialCount - 1)
    await expect(
      comfyPage.page.locator('.p-toast-message-success')
    ).toBeVisible()
  })
})
