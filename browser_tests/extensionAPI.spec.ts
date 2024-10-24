import { expect, Locator } from '@playwright/test'
import { comfyPageFixture as test } from './ComfyPage'

test.describe('Topbar commands', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
  })

  test('Should allow registering topbar commands', async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      window['app'].registerExtension({
        name: 'TestExtension1',
        commands: [
          {
            id: 'foo',
            label: 'foo-command',
            function: () => {
              window['foo'] = true
            }
          }
        ],
        menuCommands: [
          {
            path: ['ext'],
            commands: ['foo']
          }
        ]
      })
    })

    await comfyPage.menu.topbar.triggerTopbarCommand(['ext', 'foo-command'])
    expect(await comfyPage.page.evaluate(() => window['foo'])).toBe(true)
  })

  test('Should not allow register command defined in other extension', async ({
    comfyPage
  }) => {
    await comfyPage.registerCommand('foo', () => alert(1))
    await comfyPage.page.evaluate(() => {
      window['app'].registerExtension({
        name: 'TestExtension1',
        menuCommands: [
          {
            path: ['ext'],
            commands: ['foo']
          }
        ]
      })
    })

    const menuItem: Locator = await comfyPage.menu.topbar.getMenuItem('ext')
    expect(await menuItem.count()).toBe(0)
  })

  test('Should allow registering keybindings', async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      const app = window['app']
      app.registerExtension({
        name: 'TestExtension1',
        commands: [
          {
            id: 'TestCommand',
            function: () => {
              window['TestCommand'] = true
            }
          }
        ],
        keybindings: [
          {
            combo: { key: 'k' },
            commandId: 'TestCommand'
          }
        ]
      })
    })

    await comfyPage.page.keyboard.press('k')
    expect(await comfyPage.page.evaluate(() => window['TestCommand'])).toBe(
      true
    )
  })

  test('Should allow adding settings', async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      window['app'].registerExtension({
        name: 'TestExtension1',
        settings: [
          {
            id: 'TestSetting',
            name: 'Test Setting',
            type: 'text',
            defaultValue: 'Hello, world!'
          }
        ]
      })
    })
    expect(await comfyPage.getSetting('TestSetting')).toBe('Hello, world!')
    await comfyPage.setSetting('TestSetting', 'Hello, universe!')
    expect(await comfyPage.getSetting('TestSetting')).toBe('Hello, universe!')
  })
})
