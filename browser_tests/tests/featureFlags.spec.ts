import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('Feature Flags', { tag: ['@slow', '@settings'] }, () => {
  test('Client and server exchange feature flags on connection', async ({
    comfyPage
  }) => {
    // Navigate to a new page to capture the initial WebSocket connection
    const newPage = await comfyPage.page.context().newPage()

    // Set up monitoring before navigation
    await newPage.addInitScript(() => {
      // This runs before any page scripts
      window.__capturedMessages = {
        clientFeatureFlags: null,
        serverFeatureFlags: null
      }

      // Capture outgoing client messages
      const originalSend = WebSocket.prototype.send
      WebSocket.prototype.send = function (data) {
        try {
          const parsed = JSON.parse(data as string)
          if (parsed.type === 'feature_flags') {
            window.__capturedMessages!.clientFeatureFlags = parsed
          }
        } catch (e) {
          // Not JSON, ignore
        }
        return originalSend.call(this, data)
      }

      // Monitor for server feature flags
      const checkInterval = setInterval(() => {
        const flags = window.app?.api?.serverFeatureFlags?.value
        if (flags && Object.keys(flags).length > 0) {
          window.__capturedMessages!.serverFeatureFlags = flags
          clearInterval(checkInterval)
        }
      }, 100)

      // Clear after 10 seconds
      setTimeout(() => clearInterval(checkInterval), 10000)
    })

    // Navigate to the app
    await newPage.goto(comfyPage.url)

    // Wait for both client and server feature flags
    await newPage.waitForFunction(
      () =>
        window.__capturedMessages!.clientFeatureFlags !== null &&
        window.__capturedMessages!.serverFeatureFlags !== null,
      { timeout: 10000 }
    )

    // Verify client sent feature flags
    await expect(async () => {
      const flags = await newPage.evaluate(
        () => window.__capturedMessages?.clientFeatureFlags
      )
      expect(flags).not.toBeNull()
      expect(flags?.type).toBe('feature_flags')
      expect(flags?.data).not.toBeNull()
      expect(flags?.data).toHaveProperty('supports_preview_metadata')
      expect(typeof flags?.data?.supports_preview_metadata).toBe('boolean')
    }).toPass()

    // Verify server sent feature flags back
    await expect(async () => {
      const flags = await newPage.evaluate(
        () => window.__capturedMessages?.serverFeatureFlags
      )
      expect(flags).not.toBeNull()
      expect(flags).toHaveProperty('supports_preview_metadata')
      expect(typeof flags?.supports_preview_metadata).toBe('boolean')
      expect(flags).toHaveProperty('max_upload_size')
      expect(typeof flags?.max_upload_size).toBe('number')
      expect(Object.keys(flags ?? {}).length).toBeGreaterThan(0)
    }).toPass()

    await newPage.close()
  })

  test('Server feature flags are received and accessible', async ({
    comfyPage
  }) => {
    // Verify we received real feature flags from the backend
    await expect(async () => {
      const flags = await comfyPage.page.evaluate(
        () => window.app!.api.serverFeatureFlags.value
      )
      expect(flags).not.toBeNull()
      expect(Object.keys(flags).length).toBeGreaterThan(0)
      // The backend should send feature flags
      expect(flags).toHaveProperty('supports_preview_metadata')
      expect(typeof flags.supports_preview_metadata).toBe('boolean')
      expect(flags).toHaveProperty('max_upload_size')
      expect(typeof flags.max_upload_size).toBe('number')
    }).toPass()
  })

  test('serverSupportsFeature method works with real backend flags', async ({
    comfyPage
  }) => {
    // Test serverSupportsFeature with real backend flags
    await expect
      .poll(() =>
        comfyPage.page.evaluate(
          () =>
            typeof window.app!.api.serverSupportsFeature(
              'supports_preview_metadata'
            )
        )
      )
      .toBe('boolean')

    // Test non-existent feature - should always return false
    await expect
      .poll(() =>
        comfyPage.page.evaluate(() =>
          window.app!.api.serverSupportsFeature('non_existent_feature_xyz')
        )
      )
      .toBe(false)

    // Test that the method only returns true for boolean true values
    const testResults = await comfyPage.page.evaluate(() => {
      // Temporarily modify serverFeatureFlags to test behavior
      const original = window.app!.api.serverFeatureFlags.value
      window.app!.api.serverFeatureFlags.value = {
        bool_true: true,
        bool_false: false,
        string_value: 'yes',
        number_value: 1,
        null_value: null
      }

      const results = {
        bool_true: window.app!.api.serverSupportsFeature('bool_true'),
        bool_false: window.app!.api.serverSupportsFeature('bool_false'),
        string_value: window.app!.api.serverSupportsFeature('string_value'),
        number_value: window.app!.api.serverSupportsFeature('number_value'),
        null_value: window.app!.api.serverSupportsFeature('null_value')
      }

      // Restore original
      window.app!.api.serverFeatureFlags.value = original
      return results
    })

    // serverSupportsFeature should only return true for boolean true values
    expect(testResults.bool_true).toBe(true)
    expect(testResults.bool_false).toBe(false)
    expect(testResults.string_value).toBe(false)
    expect(testResults.number_value).toBe(false)
    expect(testResults.null_value).toBe(false)
  })

  test('getServerFeature method works with real backend data', async ({
    comfyPage
  }) => {
    // Test getServerFeature method
    await expect
      .poll(() =>
        comfyPage.page.evaluate(
          () =>
            typeof window.app!.api.getServerFeature('supports_preview_metadata')
        )
      )
      .toBe('boolean')

    // Test getting max_upload_size
    await expect(async () => {
      const maxUpload = await comfyPage.page.evaluate(() =>
        window.app!.api.getServerFeature('max_upload_size')
      )
      expect(typeof maxUpload).toBe('number')
      expect(maxUpload as number).toBeGreaterThan(0)
    }).toPass()

    // Test getServerFeature with default value for non-existent feature
    await expect
      .poll(() =>
        comfyPage.page.evaluate(() =>
          window.app!.api.getServerFeature(
            'non_existent_feature_xyz',
            'default'
          )
        )
      )
      .toBe('default')
  })

  test('getServerFeatures returns all backend feature flags', async ({
    comfyPage
  }) => {
    // Test getServerFeatures returns all flags
    await expect(async () => {
      const features = await comfyPage.page.evaluate(() =>
        window.app!.api.getServerFeatures()
      )
      expect(features).not.toBeNull()
      expect(features).toHaveProperty('supports_preview_metadata')
      expect(typeof features.supports_preview_metadata).toBe('boolean')
      expect(features).toHaveProperty('max_upload_size')
      expect(Object.keys(features).length).toBeGreaterThan(0)
    }).toPass()
  })

  test('Client feature flags are immutable', async ({ comfyPage }) => {
    // Test that getClientFeatureFlags returns a copy
    const immutabilityTest = await comfyPage.page.evaluate(() => {
      const flags1 = window.app!.api.getClientFeatureFlags()
      const flags2 = window.app!.api.getClientFeatureFlags()

      // Modify the first object
      flags1.test_modification = true

      // Get flags again to check if original was modified
      const flags3 = window.app!.api.getClientFeatureFlags()

      return {
        areEqual: flags1 === flags2,
        hasModification: flags3.test_modification !== undefined,
        hasSupportsPreview: flags1.supports_preview_metadata !== undefined,
        supportsPreviewValue: flags1.supports_preview_metadata
      }
    })

    // Verify they are different objects (not the same reference)
    expect(immutabilityTest.areEqual).toBe(false)

    // Verify modification didn't affect the original
    expect(immutabilityTest.hasModification).toBe(false)

    // Verify the flags contain expected properties
    expect(immutabilityTest.hasSupportsPreview).toBe(true)
    expect(typeof immutabilityTest.supportsPreviewValue).toBe('boolean') // From clientFeatureFlags.json
  })

  test('Server features are immutable when accessed via getServerFeatures', async ({
    comfyPage
  }) => {
    const immutabilityTest = await comfyPage.page.evaluate(() => {
      // Get a copy of server features
      const features1 = window.app!.api.getServerFeatures()

      // Try to modify it
      features1.supports_preview_metadata = false
      features1.new_feature = 'added'

      // Get another copy
      const features2 = window.app!.api.getServerFeatures()

      return {
        modifiedValue: features1.supports_preview_metadata,
        originalValue: features2.supports_preview_metadata,
        hasNewFeature: features2.new_feature !== undefined,
        hasSupportsPreview: features2.supports_preview_metadata !== undefined
      }
    })

    // The modification should only affect the copy
    expect(immutabilityTest.modifiedValue).toBe(false)
    expect(typeof immutabilityTest.originalValue).toBe('boolean') // Backend sends boolean for supports_preview_metadata
    expect(immutabilityTest.hasNewFeature).toBe(false)
    expect(immutabilityTest.hasSupportsPreview).toBe(true)
  })

  test('Feature flags are negotiated early in connection lifecycle', async ({
    comfyPage
  }) => {
    // This test verifies that feature flags are available early in the app lifecycle
    // which is important for protocol negotiation

    // Create a new page to ensure clean state
    const newPage = await comfyPage.page.context().newPage()

    // Set up monitoring before navigation
    await newPage.addInitScript(() => {
      // Track when various app components are ready

      window.__appReadiness = {
        featureFlagsReceived: false,
        apiInitialized: false,
        appInitialized: false
      }

      // Monitor when feature flags arrive by checking periodically
      const checkFeatureFlags = setInterval(() => {
        if (
          window.app?.api?.serverFeatureFlags?.value
            ?.supports_preview_metadata !== undefined
        ) {
          window.__appReadiness!.featureFlagsReceived = true
          clearInterval(checkFeatureFlags)
        }
      }, 10)

      // Monitor API initialization
      const checkApi = setInterval(() => {
        if (window.app?.api) {
          window.__appReadiness!.apiInitialized = true
          clearInterval(checkApi)
        }
      }, 10)

      // Monitor app initialization
      const checkApp = setInterval(() => {
        if (window.app?.graph) {
          window.__appReadiness!.appInitialized = true
          clearInterval(checkApp)
        }
      }, 10)

      // Clean up after 10 seconds
      setTimeout(() => {
        clearInterval(checkFeatureFlags)
        clearInterval(checkApi)
        clearInterval(checkApp)
      }, 10000)
    })

    // Navigate to the app
    await newPage.goto(comfyPage.url)

    // Wait for feature flags to be received
    await newPage.waitForFunction(
      () =>
        window.app?.api?.serverFeatureFlags?.value
          ?.supports_preview_metadata !== undefined,
      {
        timeout: 10000
      }
    )

    // Verify feature flags are available
    await expect(async () => {
      const flags = await newPage.evaluate(
        () => window.app!.api.serverFeatureFlags.value
      )
      expect(flags).toHaveProperty('supports_preview_metadata')
      expect(typeof flags?.supports_preview_metadata).toBe('boolean')
      expect(flags).toHaveProperty('max_upload_size')
    }).toPass()

    // Verify feature flags were received and API was initialized
    await expect(async () => {
      const readiness = await newPage.evaluate(() => window.__appReadiness)
      expect(readiness?.featureFlagsReceived).toBe(true)
      expect(readiness?.apiInitialized).toBe(true)
    }).toPass()

    await newPage.close()
  })

  test('Backend /features endpoint returns feature flags', async ({
    comfyPage
  }) => {
    // Test the HTTP endpoint directly
    const response = await comfyPage.page.request.get(
      `${comfyPage.url}/api/features`
    )
    expect(response.ok()).toBe(true)

    const features = await response.json()
    expect(features).toBeTruthy()
    expect(features).toHaveProperty('supports_preview_metadata')
    expect(typeof features.supports_preview_metadata).toBe('boolean')
    expect(features).toHaveProperty('max_upload_size')
    expect(Object.keys(features).length).toBeGreaterThan(0)
  })
})
