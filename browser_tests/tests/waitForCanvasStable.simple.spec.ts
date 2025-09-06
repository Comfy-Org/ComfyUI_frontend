/**
 * Simple test to validate waitForCanvasStable() works without complex setup
 */
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('waitForCanvasStable() Simple Validation', () => {
  test('waitForCanvasStable() should complete without throwing errors', async ({
    comfyPage
  }) => {
    // Just test that the method exists and runs
    await expect(comfyPage.waitForCanvasStable(1000)).resolves.not.toThrow()
  })

  test('waitForToastStable() should complete without throwing errors', async ({
    comfyPage
  }) => {
    // Just test that the method exists and runs
    await expect(comfyPage.waitForToastStable(1000)).resolves.not.toThrow()
  })
})
