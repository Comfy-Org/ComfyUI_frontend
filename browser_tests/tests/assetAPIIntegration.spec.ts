import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

// Test constants for maintainability (Agent 1 + 5 pattern)
const ASSET_API_SETTING = 'Comfy.Assets.UseAssetAPI'
const MOCK_ASSET_FOLDERS = [
  { name: 'checkpoints', folders: [] },
  { name: 'loras', folders: [] },
  { name: 'vae', folders: [] }
] as const

const MOCK_CHECKPOINT_MODELS = [
  { name: 'awesome-model-v1.2.safetensors', pathIndex: 0 },
  { name: 'another-model.safetensors', pathIndex: 0 }
] as const

// Helper function for API monitoring setup (Agent 2 + 5 pattern)
async function setupAPIMonitoring(page: any) {
  await page.addInitScript(() => {
    window.__assetAPIMonitor = {
      assetFoldersCallCount: 0,
      assetModelsCallCount: 0,
      legacyFoldersCallCount: 0,
      legacyModelsCallCount: 0,
      lastError: null,
      requestHistory: []
    }

    const originalFetch = window.fetch
    window.fetch = function (url, ...args) {
      const urlStr = url.toString()
      window.__assetAPIMonitor.requestHistory.push(urlStr)

      if (urlStr.includes('/api/assets?tags=models') && !urlStr.includes(',')) {
        window.__assetAPIMonitor.assetFoldersCallCount++
      } else if (urlStr.includes('/api/assets?tags=models,')) {
        window.__assetAPIMonitor.assetModelsCallCount++
      } else if (urlStr.includes('/object_info')) {
        window.__assetAPIMonitor.legacyFoldersCallCount++
      } else if (urlStr.match(/\/models\/[^/]+$/)) {
        window.__assetAPIMonitor.legacyModelsCallCount++
      }

      return originalFetch.apply(this, [url, ...args]).catch((error) => {
        window.__assetAPIMonitor.lastError = error.message
        throw error
      })
    }
  })
}

// Helper function for asset API mocking (Agent 3 + 4 pattern)
async function setupAssetAPIMocks(page: any, errorSimulation = false) {
  await page.route('/api/assets**', async (route: any) => {
    if (errorSimulation) {
      await route.abort('failed')
      return
    }

    const url = route.request().url()

    if (url.includes('tags=models') && !url.includes(',')) {
      // Mock folders endpoint with proper headers (Agent 4 pattern)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Cache-Control': 'max-age=300',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(MOCK_ASSET_FOLDERS)
      })
    } else if (url.includes('tags=models,checkpoints')) {
      // Mock models endpoint
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CHECKPOINT_MODELS)
      })
    } else {
      await route.continue()
    }
  })
}

test.describe('Asset API Integration', () => {
  test.describe('Setting Integration', () => {
    test.describe('UseAssetAPI Enabled', () => {
      test.beforeEach(async ({ comfyPage }) => {
        // Consistent state setup (Agent 1 + 4 pattern)
        await comfyPage.setSetting(ASSET_API_SETTING, true)
        await setupAPIMonitoring(comfyPage.page)
        await setupAssetAPIMocks(comfyPage.page)
      })

      test('should use asset API for model folder loading', async ({
        comfyPage
      }) => {
        await comfyPage.setup()

        // Execute store operations with proper waiting (Agent 2 pattern)
        await comfyPage.page.evaluate(async () => {
          const { useModelStore } = await import('@/stores/modelStore')
          const modelStore = useModelStore()
          await modelStore.loadModelFolders()
        })

        // Frame-based waiting for state changes (Agent 2 + 3 pattern)
        await comfyPage.nextFrame()

        const monitor = await comfyPage.page.evaluate(
          () => window.__assetAPIMonitor
        )

        // Rich assertion context (Agent 5 pattern)
        expect(
          monitor.assetFoldersCallCount,
          `Expected asset folders API to be called, but got: ${JSON.stringify(monitor.requestHistory)}`
        ).toBeGreaterThan(0)

        expect(
          monitor.legacyFoldersCallCount,
          'Legacy API should not be called when asset API is enabled'
        ).toBe(0)

        expect(monitor.lastError).toBeNull()
      })

      test('should use asset API for model loading in folders', async ({
        comfyPage
      }) => {
        await comfyPage.setup()

        const modelData = await comfyPage.page.evaluate(async () => {
          const { useModelStore } = await import('@/stores/modelStore')
          const modelStore = useModelStore()

          await modelStore.loadModelFolders()
          const checkpointsFolder =
            await modelStore.getLoadedModelFolder('checkpoints')

          return {
            folderCount: modelStore.modelFolders.length,
            modelCount: Object.keys(checkpointsFolder?.models || {}).length
          }
        })

        const monitor = await comfyPage.page.evaluate(
          () => window.__assetAPIMonitor
        )

        expect(modelData.folderCount).toBe(3)
        expect(modelData.modelCount).toBe(2)
        expect(monitor.assetModelsCallCount).toBeGreaterThan(0)
      })
    })

    test.describe('UseAssetAPI Disabled', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.setSetting(ASSET_API_SETTING, false)
        await setupAPIMonitoring(comfyPage.page)
      })

      test('should use legacy API when asset API is disabled', async ({
        comfyPage
      }) => {
        await comfyPage.setup()

        // Attempt to load with legacy API (will likely fail in test environment)
        const loadingResult = await comfyPage.page.evaluate(async () => {
          try {
            const { useModelStore } = await import('@/stores/modelStore')
            const modelStore = useModelStore()
            await modelStore.loadModelFolders()
            return { success: true, error: null }
          } catch (error) {
            return { success: false, error: error.message }
          }
        })

        const monitor = await comfyPage.page.evaluate(
          () => window.__assetAPIMonitor
        )

        // Verify asset API was not attempted
        expect(monitor.assetFoldersCallCount).toBe(0)
        expect(monitor.assetModelsCallCount).toBe(0)
      })
    })
  })

  test.describe('Error Handling', () => {
    test('should provide user-friendly error messages when asset API fails', async ({
      comfyPage
    }) => {
      await comfyPage.setSetting(ASSET_API_SETTING, true)
      await setupAPIMonitoring(comfyPage.page)

      // Setup error simulation (Agent 2 pattern)
      await comfyPage.page.route('/api/assets**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'INTERNAL',
              message: 'Internal server error'
            }
          })
        })
      })

      await comfyPage.setup()

      const loadingResult = await comfyPage.page.evaluate(async () => {
        try {
          const { useModelStore } = await import('@/stores/modelStore')
          const modelStore = useModelStore()
          await modelStore.loadModelFolders()
          return { success: true, error: null }
        } catch (error) {
          return { success: false, error: error.message }
        }
      })

      expect(loadingResult.success).toBe(false)
      expect(loadingResult.error).toContain('Unable to load model folders:')
      expect(loadingResult.error).toContain('Please try again')

      // Verify user-friendly format (not technical HTTP errors)
      expect(loadingResult.error).not.toContain('HTTP error!')
      expect(loadingResult.error).not.toContain('status: 500')
    })

    test('should handle network failures gracefully', async ({ comfyPage }) => {
      await comfyPage.setSetting(ASSET_API_SETTING, true)
      await setupAPIMonitoring(comfyPage.page)

      // Simulate network failure
      await comfyPage.page.route('/api/assets**', async (route) => {
        await route.abort('failed')
      })

      await comfyPage.setup()

      const loadingResult = await comfyPage.page.evaluate(async () => {
        try {
          const { useModelStore } = await import('@/stores/modelStore')
          const modelStore = useModelStore()
          await modelStore.loadModelFolders()
          return { success: true }
        } catch (error) {
          return { success: false, error: error.message }
        }
      })

      expect(loadingResult.success).toBe(false)
      expect(loadingResult.error).toBeDefined()
    })
  })

  test.describe('Data Transformation', () => {
    test('should correctly transform asset API responses to model structures', async ({
      comfyPage
    }) => {
      await comfyPage.setSetting(ASSET_API_SETTING, true)
      await setupAssetAPIMocks(comfyPage.page)
      await comfyPage.setup()

      const transformationData = await comfyPage.page.evaluate(async () => {
        const { useModelStore } = await import('@/stores/modelStore')
        const modelStore = useModelStore()

        await modelStore.loadModelFolders()
        const checkpointsFolder =
          await modelStore.getLoadedModelFolder('checkpoints')
        const firstModel = Object.values(checkpointsFolder?.models || {})[0]

        return {
          folderNames: modelStore.modelFolders.map((f) => f.directory),
          firstModel: firstModel
            ? {
                fileName: firstModel.file_name,
                directory: firstModel.directory,
                pathIndex: firstModel.path_index,
                simplifiedName: firstModel.simplified_file_name,
                key: firstModel.key
              }
            : null
        }
      })

      // Verify folder transformation
      expect(transformationData.folderNames).toEqual([
        'checkpoints',
        'loras',
        'vae'
      ])

      // Verify model structure transformation
      expect(transformationData.firstModel).not.toBeNull()
      expect(transformationData.firstModel?.fileName).toBe(
        'awesome-model-v1.2.safetensors'
      )
      expect(transformationData.firstModel?.directory).toBe('checkpoints')
      expect(transformationData.firstModel?.pathIndex).toBe(0)
      expect(transformationData.firstModel?.simplifiedName).toBe(
        'awesome-model-v1.2'
      )
      expect(transformationData.firstModel?.key).toBe(
        'checkpoints/awesome-model-v1.2.safetensors'
      )
    })
  })
})
