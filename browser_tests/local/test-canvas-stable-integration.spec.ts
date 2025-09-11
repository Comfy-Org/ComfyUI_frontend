/**
 * Simple test to validate waitForCanvasStable integration
 */
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Canvas Stability Integration Test', () => {
  test('waitForCanvasStable should be available and callable', async ({
    comfyPage
  }) => {
    // Verify the method exists
    expect(typeof comfyPage.waitForCanvasStable).toBe('function')

    // Verify it can be called without errors (short timeout to avoid waiting)
    await expect(comfyPage.waitForCanvasStable(100)).resolves.not.toThrow()
  })

  test('waitForToastStable should be available and callable', async ({
    comfyPage
  }) => {
    // Verify the method exists
    expect(typeof comfyPage.waitForToastStable).toBe('function')

    // Since there are no toasts initially, this should resolve quickly
    await expect(comfyPage.waitForToastStable(1000)).resolves.not.toThrow()
  })
})
