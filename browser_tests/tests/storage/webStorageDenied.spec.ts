import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  denyWebStorage,
  webStorageIsDenied
} from '@e2e/fixtures/utils/denyWebStorage'

test.describe('Web Storage denied to the document', { tag: '@smoke' }, () => {
  test('boots to a usable graph when only localStorage is denied', async ({
    comfyPage
  }) => {
    const uncaught: string[] = []
    comfyPage.page.on('pageerror', (error) => uncaught.push(error.message))

    await denyWebStorage(comfyPage.page, ['localStorage'])
    await comfyPage.page.addInitScript(
      (id: string) => sessionStorage.setItem('Comfy.userId', id),
      comfyPage.id
    )
    await comfyPage.workflow.reloadAndWaitForApp()

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

    await expect(
      comfyPage.page.getByRole('button', { name: 'Next' })
    ).toBeVisible()
    expect(await webStorageIsDenied(comfyPage.page)).toBe(true)
    expect(uncaught).toEqual([])
  })
})
