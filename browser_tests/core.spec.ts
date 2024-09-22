import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './ComfyPage'

test.describe('basic frontend page', () => {
  test('Basic front page loads and renders at all', async ({ comfyPage }) => {
    await comfyPage.gotoPath('/')
    await comfyPage.prepPage()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'basic-frontend-page-content.png'
    )
  })
})

test.describe('subrouting validation', () => {
  test('subrouted installs of the comfy frontend load as intended', async ({
    comfyPage
  }) => {
    await comfyPage.gotoPath('/testsubrouteindex')
    await comfyPage.prepPage()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'subrouted-frontend-page-content.png'
    )
  })
})
