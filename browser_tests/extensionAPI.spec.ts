import { expect, Locator } from '@playwright/test'
import { comfyPageFixture as test } from './fixtures/ComfyPage'

test.describe('Topbar commands', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
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

    const menuItem = comfyPage.menu.topbar.getMenuItem('ext')
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

  test.describe('Settings', () => {
    test('Should allow adding settings', async ({ comfyPage }) => {
      await comfyPage.page.evaluate(() => {
        window['app'].registerExtension({
          name: 'TestExtension1',
          settings: [
            {
              id: 'TestSetting',
              name: 'Test Setting',
              type: 'text',
              defaultValue: 'Hello, world!',
              onChange: () => {
                window['changeCount'] = (window['changeCount'] ?? 0) + 1
              }
            }
          ]
        })
      })
      // onChange is called when the setting is first added
      expect(await comfyPage.page.evaluate(() => window['changeCount'])).toBe(1)
      expect(await comfyPage.getSetting('TestSetting')).toBe('Hello, world!')

      await comfyPage.setSetting('TestSetting', 'Hello, universe!')
      expect(await comfyPage.getSetting('TestSetting')).toBe('Hello, universe!')
      expect(await comfyPage.page.evaluate(() => window['changeCount'])).toBe(2)
    })

    test('Should allow setting boolean settings', async ({ comfyPage }) => {
      await comfyPage.page.evaluate(() => {
        window['app'].registerExtension({
          name: 'TestExtension1',
          settings: [
            {
              id: 'Comfy.TestSetting',
              name: 'Test Setting',
              type: 'boolean',
              defaultValue: false,
              onChange: () => {
                window['changeCount'] = (window['changeCount'] ?? 0) + 1
              }
            }
          ]
        })
      })

      expect(await comfyPage.getSetting('Comfy.TestSetting')).toBe(false)
      expect(await comfyPage.page.evaluate(() => window['changeCount'])).toBe(1)

      await comfyPage.settingDialog.open()
      await comfyPage.settingDialog.toggleBooleanSetting('Comfy.TestSetting')
      expect(await comfyPage.getSetting('Comfy.TestSetting')).toBe(true)
      expect(await comfyPage.page.evaluate(() => window['changeCount'])).toBe(2)
    })
  })

  test.describe('About panel', () => {
    test('Should allow adding badges', async ({ comfyPage }) => {
      await comfyPage.page.evaluate(() => {
        window['app'].registerExtension({
          name: 'TestExtension1',
          aboutPageBadges: [
            {
              label: 'Test Badge',
              url: 'https://example.com',
              icon: 'pi pi-box'
            }
          ]
        })
      })

      await comfyPage.settingDialog.open()
      await comfyPage.settingDialog.goToAboutPanel()
      const badge = comfyPage.page.locator('.about-badge').last()
      expect(badge).toBeDefined()
      expect(await badge.textContent()).toContain('Test Badge')
    })
  })
})
