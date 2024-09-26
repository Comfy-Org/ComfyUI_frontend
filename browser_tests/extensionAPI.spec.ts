import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './ComfyPage'

test.describe('Topbar commands', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Floating')
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
  })

  test('Should allow registering topbar commands', async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      window['app'].extensionManager.menu.registerTopbarCommands(
        ['ext'],
        [
          {
            id: 'foo',
            label: 'foo',
            function: () => {
              window['foo'] = true
            }
          }
        ]
      )
    })

    await comfyPage.menu.topbar.triggerTopbarCommand(['ext', 'foo'])
    expect(await comfyPage.page.evaluate(() => window['foo'])).toBe(true)
  })
})
