import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  denyWebStorage,
  webStorageIsDenied
} from '@e2e/fixtures/utils/denyWebStorage'

/**
 * A browser that denies Web Storage to the document throws a `SecurityError`
 * on the `localStorage` property read itself, before any `getItem` call. An
 * unguarded read during boot therefore aborts the first module that runs, and
 * the user is left on the splash screen with nothing to click — which is what
 * cloud-frontend-prod reported.
 *
 * These are the durable form of the manual before/after screenshots on
 * https://github.com/Comfy-Org/ComfyUI_frontend/pull/23934: both fail on its
 * parent, where boot dies inside a dependency's module-level storage read.
 */
test.describe('Web Storage denied to the document', { tag: '@smoke' }, () => {
  test('boots to a usable graph when only localStorage is denied', async ({
    comfyPage
  }) => {
    const uncaught: string[] = []
    comfyPage.page.on('pageerror', (error) => uncaught.push(error.message))

    await denyWebStorage(comfyPage.page, ['localStorage'])
    // The multi-user backend identifies the user from storage, and a client
    // that never had localStorage would have written that id to the fallback
    // the provider is about to read. Seed it there so the boot under test is
    // a returning user rather than a first visit.
    await comfyPage.page.addInitScript(
      (id: string) => sessionStorage.setItem('Comfy.userId', id),
      comfyPage.id
    )
    await comfyPage.page.reload()
    await comfyPage.waitForAppReady()

    expect(await webStorageIsDenied(comfyPage.page, ['localStorage'])).toBe(
      true
    )
    await expect(comfyPage.canvas).toBeVisible()
    await comfyPage.expectNodeCountMinimum(1)
    expect(uncaught).toEqual([])
  })

  test('still reaches an interactive screen when all storage is denied', async ({
    comfyPage
  }) => {
    const uncaught: string[] = []
    comfyPage.page.on('pageerror', (error) => uncaught.push(error.message))

    await denyWebStorage(comfyPage.page)
    await comfyPage.page.reload()

    // With no readable storage anywhere there is no stored user id to recover,
    // so this backend asks who is signing in. That screen is the proof: it is
    // rendered by the same Vue app whose boot the unguarded read aborted.
    await expect(
      comfyPage.page.getByRole('button', { name: 'Next' })
    ).toBeVisible()
    expect(await webStorageIsDenied(comfyPage.page)).toBe(true)
    expect(uncaught).toEqual([])
  })
})
