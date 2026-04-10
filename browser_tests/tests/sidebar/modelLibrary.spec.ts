import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const MOCK_FOLDERS: Record<string, string[]> = {
  checkpoints: [
    'sd_xl_base_1.0.safetensors',
    'dreamshaper_8.safetensors',
    'realisticVision_v51.safetensors'
  ],
  loras: ['detail_tweaker_xl.safetensors', 'add_brightness.safetensors'],
  vae: ['sdxl_vae.safetensors']
}

// ==========================================================================
// 1. Tab open/close
// ==========================================================================

test.describe('Model library sidebar - tab', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.modelLibrary.mockFoldersWithFiles(MOCK_FOLDERS)
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.modelLibrary.clearMocks()
  })

  test('Opens model library tab and shows tree', async ({ comfyPage }) => {
    const tab = comfyPage.menu.modelLibraryTab
    await tab.open()

    await expect(tab.modelTree).toBeVisible()
    await expect(tab.searchInput).toBeVisible()
  })

  test('Shows refresh and load all folders buttons', async ({ comfyPage }) => {
    const tab = comfyPage.menu.modelLibraryTab
    await tab.open()

    await expect(tab.refreshButton).toBeVisible()
    await expect(tab.loadAllFoldersButton).toBeVisible()
  })
})

// ==========================================================================
// 2. Folder display
// ==========================================================================

test.describe('Model library sidebar - folders', () => {
  // Mocks are set up before setup(), so app.ts's loadModelFolders()
  // call during initialization hits the mock and populates the store.
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.modelLibrary.mockFoldersWithFiles(MOCK_FOLDERS)
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.modelLibrary.clearMocks()
  })

  test('Displays model folders after opening tab', async ({ comfyPage }) => {
    const tab = comfyPage.menu.modelLibraryTab
    await tab.open()

    await expect(tab.getFolderByLabel('checkpoints')).toBeVisible()
    await expect(tab.getFolderByLabel('loras')).toBeVisible()
    await expect(tab.getFolderByLabel('vae')).toBeVisible()
  })

  test('Expanding a folder loads and shows models', async ({ comfyPage }) => {
    const tab = comfyPage.menu.modelLibraryTab
    await tab.open()

    // Click the folder to expand it
    await tab.getFolderByLabel('checkpoints').click()

    // Models should appear as leaf nodes
    await expect(tab.getLeafByLabel('sd_xl_base_1.0')).toBeVisible()
    await expect(tab.getLeafByLabel('dreamshaper_8')).toBeVisible()
    await expect(tab.getLeafByLabel('realisticVision_v51')).toBeVisible()
  })

  test('Expanding a different folder shows its models', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.modelLibraryTab
    await tab.open()

    await tab.getFolderByLabel('loras').click()

    await expect(tab.getLeafByLabel('detail_tweaker_xl')).toBeVisible()
    await expect(tab.getLeafByLabel('add_brightness')).toBeVisible()
  })
})

// ==========================================================================
// 3. Search
// ==========================================================================

test.describe('Model library sidebar - search', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.modelLibrary.mockFoldersWithFiles(MOCK_FOLDERS)
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.modelLibrary.clearMocks()
  })

  test('Search filters models by filename', async ({ comfyPage }) => {
    const tab = comfyPage.menu.modelLibraryTab
    await tab.open()

    await tab.searchInput.fill('dreamshaper')

    // Wait for debounce (300ms) + load + render
    await expect(tab.getLeafByLabel('dreamshaper_8')).toBeVisible()

    // Other models should not be visible
    await expect(tab.getLeafByLabel('sd_xl_base_1.0')).not.toBeVisible()
  })

  test('Clearing search restores folder view', async ({ comfyPage }) => {
    const tab = comfyPage.menu.modelLibraryTab
    await tab.open()

    await tab.searchInput.fill('dreamshaper')
    await expect(tab.getLeafByLabel('dreamshaper_8')).toBeVisible()

    // Clear the search
    await tab.searchInput.fill('')

    // Folders should be visible again (collapsed)
    await expect(tab.getFolderByLabel('checkpoints')).toBeVisible()
    await expect(tab.getFolderByLabel('loras')).toBeVisible()
  })

  test('Search with no matches shows empty tree', async ({ comfyPage }) => {
    const tab = comfyPage.menu.modelLibraryTab
    await tab.open()

    // Expand a folder and verify models are present before searching
    await tab.getFolderByLabel('checkpoints').click()
    await expect(tab.leafNodes).not.toHaveCount(0)

    await tab.searchInput.fill('nonexistent_model_xyz')

    // Wait for debounce, then verify no leaf nodes
    await expect.poll(() => tab.leafNodes.count()).toBe(0)
  })
})

// ==========================================================================
// 4. Refresh and load all
// ==========================================================================

test.describe('Model library sidebar - refresh', () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.modelLibrary.clearMocks()
  })

  test('Refresh button reloads folder list', async ({ comfyPage }) => {
    await comfyPage.modelLibrary.mockFoldersWithFiles({
      checkpoints: ['model_a.safetensors']
    })
    await comfyPage.setup()

    const tab = comfyPage.menu.modelLibraryTab
    await tab.open()

    await expect(tab.getFolderByLabel('checkpoints')).toBeVisible()

    // Update mock to include a new folder
    await comfyPage.modelLibrary.clearMocks()
    await comfyPage.modelLibrary.mockFoldersWithFiles({
      checkpoints: ['model_a.safetensors'],
      loras: ['lora_b.safetensors']
    })

    // Wait for the refresh request to complete
    const refreshRequest = comfyPage.page.waitForRequest(
      (req) => req.url().endsWith('/experiment/models'),
      { timeout: 5000 }
    )
    await tab.refreshButton.click()
    await refreshRequest

    await expect(tab.getFolderByLabel('loras')).toBeVisible()
  })

  test('Load all folders button triggers loading all model data', async ({
    comfyPage
  }) => {
    await comfyPage.modelLibrary.mockFoldersWithFiles(MOCK_FOLDERS)
    await comfyPage.setup()

    const tab = comfyPage.menu.modelLibraryTab
    await tab.open()

    // Wait for a per-folder model files request triggered by load all
    const folderRequest = comfyPage.page.waitForRequest(
      (req) =>
        /\/api\/experiment\/models\/[^/]+$/.test(req.url()) &&
        req.method() === 'GET',
      { timeout: 5000 }
    )

    await tab.loadAllFoldersButton.click()
    await folderRequest
  })
})

// ==========================================================================
// 5. Empty state
// ==========================================================================

test.describe('Model library sidebar - empty state', () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.modelLibrary.clearMocks()
  })

  test('Shows empty tree when no model folders exist', async ({
    comfyPage
  }) => {
    await comfyPage.modelLibrary.mockFoldersWithFiles({})
    await comfyPage.setup()

    const tab = comfyPage.menu.modelLibraryTab
    await tab.open()

    await expect(tab.modelTree).toBeVisible()
    await expect(tab.folderNodes).toHaveCount(0)
    await expect(tab.leafNodes).toHaveCount(0)
  })
})
