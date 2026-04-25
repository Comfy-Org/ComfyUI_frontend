import { expect, mergeTests } from '@playwright/test'
import type { JobEntry } from '@comfyorg/ingest-types'

import { assetScenarioFixture } from '@e2e/fixtures/assetScenarioFixture'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { createMockJob } from '@e2e/fixtures/helpers/jobFixtures'

const test = mergeTests(comfyPageFixture, assetScenarioFixture)

const GENERATED_JOBS: JobEntry[] = [
  createMockJob({
    id: 'job-landscape',
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
    id: 'job-portrait',
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
    id: 'job-gallery',
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
    outputs_count: 3
  })
]

const IMPORTED_FILES = ['reference_photo.png', 'background.jpg', 'notes.txt']

test.describe('Assets sidebar browsing', () => {
  test.beforeEach(async ({ comfyPage, assetScenario }) => {
    await assetScenario.mockGeneratedHistory(GENERATED_JOBS)
    await assetScenario.mockImportedFiles(IMPORTED_FILES)
    await comfyPage.setup()
  })

  test('shows mocked generated and imported assets', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await expect(tab.getAssetCardByName('gallery.png')).toBeVisible()

    await tab.switchToImported()
    await expect(tab.getAssetCardByName('reference_photo.png')).toBeVisible()
  })

  test('switches between grid and list views with mocked results', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.openSettingsMenu()
    await tab.listViewOption.click()
    await expect(tab.listViewItems.first()).toBeVisible()

    await tab.openSettingsMenu()
    await tab.gridViewOption.click()
    await tab.waitForAssets()
    await expect(tab.getAssetCardByName('landscape.png')).toBeVisible()
  })

  test('clears search when switching tabs', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.searchInput.fill('landscape')
    await expect(tab.searchInput).toHaveValue('landscape')

    await tab.switchToImported()
    await expect(tab.searchInput).toHaveValue('')
  })

  test('opens folder view for multi-output jobs and returns to all assets', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab
      .getAssetCardByName('gallery.png')
      .getByRole('button', { name: 'See more outputs' })
      .click()

    await expect(tab.backToAssetsButton).toBeVisible()
    await expect(
      comfyPage.page.getByRole('button', { name: 'Copy job ID' })
    ).toBeVisible()
    await expect(tab.getAssetCardByName('gallery-2.png')).toBeVisible()

    await comfyPage.page.getByRole('button', { name: 'Copy job ID' }).click()
    await expect(
      comfyPage.page.locator('.p-toast-message-success')
    ).toBeVisible()

    await tab.backToAssetsButton.click()
    await expect(tab.getAssetCardByName('gallery.png')).toBeVisible()
  })

  test('opens the preview lightbox for generated assets', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets()

    await tab.getAssetCardByName('landscape.png').dblclick()

    await expect(comfyPage.mediaLightbox.root).toBeVisible()
  })
})

test.describe('Assets sidebar empty states', () => {
  test.beforeEach(async ({ comfyPage, assetScenario }) => {
    await assetScenario.mockEmptyState()
    await comfyPage.setup()
  })

  test('shows empty generated state', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await expect(tab.emptyStateTitle('No generated files found')).toBeVisible()
    await expect(tab.emptyStateMessage).toBeVisible()
  })

  test('shows empty imported state', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.switchToImported()

    await expect(tab.emptyStateTitle('No imported files found')).toBeVisible()
    await expect(tab.emptyStateMessage).toBeVisible()
  })
})
