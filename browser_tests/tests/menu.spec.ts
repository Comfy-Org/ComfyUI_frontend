import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Menu', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test('Can register sidebar tab', async ({ comfyPage }) => {
    const initialChildrenCount = await comfyPage.menu.sideToolbar.evaluate(
      (el) => el.children.length
    )

    await comfyPage.page.evaluate(async () => {
      window['app'].extensionManager.registerSidebarTab({
        id: 'search',
        icon: 'pi pi-search',
        title: 'search',
        tooltip: 'search',
        type: 'custom',
        render: (el) => {
          el.innerHTML = '<div>Custom search tab</div>'
        }
      })
    })
    await comfyPage.nextFrame()

    const newChildrenCount = await comfyPage.menu.sideToolbar.evaluate(
      (el) => el.children.length
    )
    expect(newChildrenCount).toBe(initialChildrenCount + 1)
  })

  test.describe('Workflows topbar tabs', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.setSetting(
        'Comfy.Workflow.WorkflowTabsPosition',
        'Topbar'
      )
      await comfyPage.setupWorkflowsDirectory({})
    })

    test('Can show opened workflows', async ({ comfyPage }) => {
      expect(await comfyPage.menu.topbar.getTabNames()).toEqual([
        'Unsaved Workflow'
      ])
    })

    test('Can close saved-workflow tabs', async ({ comfyPage }) => {
      const workflowName = `tempWorkflow-${test.info().title}`
      await comfyPage.menu.topbar.saveWorkflow(workflowName)
      expect(await comfyPage.menu.topbar.getTabNames()).toEqual([workflowName])
      await comfyPage.menu.topbar.closeWorkflowTab(workflowName)
      await comfyPage.nextFrame()
      expect(await comfyPage.menu.topbar.getTabNames()).toEqual([
        'Unsaved Workflow'
      ])
    })
  })

  test.describe('Topbar submmenus', () => {
    test('@mobile Items fully visible on mobile screen width', async ({
      comfyPage
    }) => {
      await comfyPage.menu.topbar.openSubmenuMobile()
      const topLevelMenuItem = comfyPage.page
        .locator('a.p-menubar-item-link')
        .first()
      const isTextCutoff = await topLevelMenuItem.evaluate((el) => {
        return el.scrollWidth > el.clientWidth
      })
      expect(isTextCutoff).toBe(false)
    })

    test('Displays keybinding next to item', async ({ comfyPage }) => {
      const workflowMenuItem = comfyPage.menu.topbar.getMenuItem('Workflow')
      await workflowMenuItem.click()
      const exportTag = comfyPage.page.locator('.keybinding-tag', {
        hasText: 'Ctrl + s'
      })
      expect(await exportTag.count()).toBe(1)
    })

    test('Can catch error when executing command', async ({ comfyPage }) => {
      await comfyPage.page.evaluate(() => {
        window['app'].registerExtension({
          name: 'TestExtension1',
          commands: [
            {
              id: 'foo',
              label: 'foo-command',
              function: () => {
                throw new Error('foo!')
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
      expect(await comfyPage.getVisibleToastCount()).toBe(1)
    })
  })

  // Only test 'Top' to reduce test time.
  // ['Bottom', 'Top']
  ;['Top'].forEach(async (position) => {
    test(`Can migrate deprecated menu positions (${position})`, async ({
      comfyPage
    }) => {
      await comfyPage.setSetting('Comfy.UseNewMenu', position)
      expect(await comfyPage.getSetting('Comfy.UseNewMenu')).toBe('Top')
    })

    test(`Can migrate deprecated menu positions on initial load (${position})`, async ({
      comfyPage
    }) => {
      await comfyPage.setSetting('Comfy.UseNewMenu', position)
      await comfyPage.setup()
      expect(await comfyPage.getSetting('Comfy.UseNewMenu')).toBe('Top')
    })
  })
})
