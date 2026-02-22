import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('Feature Flags', { tag: ['@slow', '@settings'] }, () => {
  test('Client sends feature flags on WebSocket connection', async ({
    comfyPage
  }) => {
    const newPage = await comfyPage.page.context().newPage()

    await newPage.addInitScript(() => {
      window.__capturedMessages = {
        clientFeatureFlags: null
      }

      const originalSend = WebSocket.prototype.send
      WebSocket.prototype.send = function (data) {
        try {
          const parsed = JSON.parse(data as string)
          if (parsed.type === 'feature_flags') {
            window.__capturedMessages!.clientFeatureFlags = parsed
          }
        } catch {
          // Not JSON, ignore
        }
        return originalSend.call(this, data)
      }
    })

    await newPage.goto(comfyPage.url)

    await newPage.waitForFunction(
      () => window.__capturedMessages!.clientFeatureFlags !== null,
      { timeout: 10000 }
    )

    const messages = await newPage.evaluate(() => window.__capturedMessages)

    expect(messages!.clientFeatureFlags).toBeTruthy()
    expect(messages!.clientFeatureFlags).toHaveProperty('type', 'feature_flags')
    expect(messages!.clientFeatureFlags).toHaveProperty('data')
    expect(messages!.clientFeatureFlags!.data).toHaveProperty(
      'supports_preview_metadata'
    )
    expect(
      typeof messages!.clientFeatureFlags!.data.supports_preview_metadata
    ).toBe('boolean')

    await newPage.close()
  })

  test('Backend /features endpoint returns server capabilities', async ({
    comfyPage
  }) => {
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

  test('Client feature flags are immutable', async ({ comfyPage }) => {
    const immutabilityTest = await comfyPage.page.evaluate(() => {
      const flags1 = window.app!.api.getClientFeatureFlags()
      const flags2 = window.app!.api.getClientFeatureFlags()

      flags1.test_modification = true

      const flags3 = window.app!.api.getClientFeatureFlags()

      return {
        areEqual: flags1 === flags2,
        hasModification: flags3.test_modification !== undefined,
        hasSupportsPreview: flags1.supports_preview_metadata !== undefined,
        supportsPreviewValue: flags1.supports_preview_metadata
      }
    })

    expect(immutabilityTest.areEqual).toBe(false)
    expect(immutabilityTest.hasModification).toBe(false)
    expect(immutabilityTest.hasSupportsPreview).toBe(true)
    expect(typeof immutabilityTest.supportsPreviewValue).toBe('boolean')
  })
})
