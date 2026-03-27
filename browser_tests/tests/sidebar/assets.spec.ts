import { expect } from '@playwright/test'

import type { ComfyPage } from '../../fixtures/ComfyPage'
import { comfyPageFixture as test } from '../../fixtures/ComfyPage'
import type { GeneratedJobSeed } from '../../fixtures/helpers/AssetsHelper'

async function openAssetsSidebar(
  comfyPage: ComfyPage,
  seed: Parameters<ComfyPage['assets']['seedAssets']>[0]
) {
  await comfyPage.page
    .context()
    .grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: comfyPage.url
    })
  await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
  await comfyPage.assets.seedAssets(seed)

  const tab = comfyPage.menu.assetsTab
  await tab.open()

  return tab
}

function makeGeneratedAssets(comfyPage: ComfyPage) {
  const stacked: GeneratedJobSeed = {
    jobId: 'job-gallery-stack',
    outputs: [
      {
        filename: 'gallery-main.webp',
        displayName: 'Gallery Main',
        mediaType: 'images'
      },
      {
        filename: 'gallery-alt.webp',
        displayName: 'Gallery Alt',
        mediaType: 'images'
      },
      {
        filename: 'gallery-detail.webp',
        displayName: 'Gallery Detail',
        mediaType: 'images'
      }
    ]
  }

  return {
    sunrise: comfyPage.assets.generatedImage({
      jobId: 'job-sunrise',
      filename: 'sunrise.webp',
      displayName: 'Sunrise'
    }),
    forest: comfyPage.assets.generatedImage({
      jobId: 'job-forest',
      filename: 'forest.webp',
      displayName: 'Forest'
    }),
    stacked
  }
}

function makeImportedAssets(comfyPage: ComfyPage) {
  return {
    concept: comfyPage.assets.importedImage({
      name: 'concept.png'
    }),
    reference: comfyPage.assets.importedImage({
      name: 'reference.png'
    })
  }
}

test.describe('Assets sidebar', () => {
  test.describe.configure({ timeout: 30_000 })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('shows empty-state copy for generated and imported tabs', async ({
    comfyPage
  }) => {
    const tab = await openAssetsSidebar(comfyPage, {
      generated: [],
      imported: []
    })

    await expect(tab.emptyStateTitle('No generated files found')).toBeVisible()
    await expect(tab.emptyStateMessage).toBeVisible()

    await tab.showImported()

    await expect(tab.emptyStateTitle('No imported files found')).toBeVisible()
    await expect(tab.emptyStateMessage).toBeVisible()
  })

  test('shows generated and imported assets, and clears search when switching tabs', async ({
    comfyPage
  }) => {
    const generated = makeGeneratedAssets(comfyPage)
    const imported = makeImportedAssets(comfyPage)

    const tab = await openAssetsSidebar(comfyPage, {
      generated: [generated.sunrise, generated.forest],
      imported: [imported.concept, imported.reference]
    })

    await expect(tab.asset('Sunrise')).toBeVisible()
    await expect(tab.asset('Forest')).toBeVisible()

    await tab.search('Sunrise')

    await expect(tab.searchInput).toHaveValue('Sunrise')
    await expect(tab.asset('Sunrise')).toBeVisible()
    await expect(tab.asset('Forest')).not.toBeVisible()

    await tab.showImported()

    await expect(tab.searchInput).toHaveValue('')
    await expect(tab.asset('concept.png')).toBeVisible()
    await expect(tab.asset('reference.png')).toBeVisible()
  })

  test('opens preview from list view and shows the media dialog', async ({
    comfyPage
  }) => {
    const generated = makeGeneratedAssets(comfyPage)
    const tab = await openAssetsSidebar(comfyPage, {
      generated: [generated.sunrise]
    })

    await tab.switchToListView()
    await tab.openAssetPreview('Sunrise')

    await expect(tab.previewDialog).toBeVisible()
    await expect(tab.previewImage('sunrise.webp')).toBeVisible()

    await tab.previewDialog.getByLabel('Close').click()
    await expect(tab.previewDialog).not.toBeVisible()
  })

  test('expands stacked outputs in list view', async ({ comfyPage }) => {
    const generated = makeGeneratedAssets(comfyPage)
    const tab = await openAssetsSidebar(comfyPage, {
      generated: [generated.stacked]
    })

    await tab.switchToListView()
    await expect(tab.asset('Gallery Alt')).not.toBeVisible()

    await tab.toggleStack('Gallery Main')

    await expect(tab.asset('Gallery Alt')).toBeVisible()
    await expect(tab.asset('Gallery Detail')).toBeVisible()
  })

  test('opens folder view for multi-output assets, copies the job ID, and returns back', async ({
    comfyPage
  }) => {
    const generated = makeGeneratedAssets(comfyPage)
    const tab = await openAssetsSidebar(comfyPage, {
      generated: [generated.stacked]
    })

    await tab.openOutputFolder('Gallery Main')

    await expect(tab.backButton).toBeVisible()
    await expect(tab.copyJobIdButton).toBeVisible()
    await expect(tab.asset('Gallery Main')).toBeVisible()
    await expect(tab.asset('Gallery Alt')).toBeVisible()
    await expect(tab.asset('Gallery Detail')).toBeVisible()

    await tab.copyJobIdButton.click()

    await expect(comfyPage.visibleToasts).toContainText('Copied')
    await expect(comfyPage.visibleToasts).toContainText(
      'Job ID copied to clipboard'
    )
    await tab.searchInput.click()
    await comfyPage.clipboard.paste(tab.searchInput)

    await expect(tab.searchInput).toHaveValue(generated.stacked.jobId)

    await tab.backButton.click()
    await expect(tab.asset('Gallery Main')).toBeVisible()
    await expect(tab.asset('Gallery Alt')).not.toBeVisible()
    await expect(tab.asset('Gallery Detail')).not.toBeVisible()
  })

  test('shows the selection footer, can clear the selection, and can download a selected asset', async ({
    comfyPage
  }) => {
    const generated = makeGeneratedAssets(comfyPage)
    const tab = await openAssetsSidebar(comfyPage, {
      generated: [generated.sunrise, generated.forest]
    })

    await tab.selectAssets(['Sunrise', 'Forest'])

    await expect(tab.selectionCountButton).toBeVisible()
    await expect(tab.selectionCountButton).toContainText('Assets Selected: 2')

    await tab.selectionCountButton.click()
    await expect(tab.selectionCountButton).not.toBeVisible()

    await tab.selectAssets(['Sunrise'])
    const downloadPromise = comfyPage.page.waitForEvent('download')

    await tab.downloadSelectionButton.click()

    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain('Sunrise')
    await expect(tab.selectionCountButton).not.toBeVisible()
  })

  test('clears the current selection when switching tabs', async ({
    comfyPage
  }) => {
    const generated = makeGeneratedAssets(comfyPage)
    const imported = makeImportedAssets(comfyPage)

    const tab = await openAssetsSidebar(comfyPage, {
      generated: [generated.sunrise],
      imported: [imported.concept]
    })

    await tab.selectAssets(['Sunrise'])

    await expect(tab.selectionCountButton).toBeVisible()

    await tab.showImported()

    await expect(tab.selectionCountButton).not.toBeVisible()
    await expect(tab.asset('concept.png')).toBeVisible()
  })
})
