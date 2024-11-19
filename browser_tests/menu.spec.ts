import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './fixtures/ComfyPage'

test.describe('Menu', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
  })

  // Skip reason: Flaky.
  test.skip('Toggle theme', async ({ comfyPage }) => {
    test.setTimeout(30000)

    expect(await comfyPage.menu.getThemeId()).toBe('dark')

    await comfyPage.menu.toggleTheme()

    expect(await comfyPage.menu.getThemeId()).toBe('light')

    // Theme id should persist after reload.
    await comfyPage.reload()
    expect(await comfyPage.menu.getThemeId()).toBe('light')

    await comfyPage.menu.toggleTheme()

    expect(await comfyPage.menu.getThemeId()).toBe('dark')
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

  test.describe('Node library sidebar', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', [])
      await comfyPage.setSetting('Comfy.NodeLibrary.BookmarksCustomization', {})
      // Open the sidebar
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.open()
    })

    test('Node preview and drag to canvas', async ({ comfyPage }) => {
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.getFolder('sampling').click()

      // Hover over a node to display the preview
      const nodeSelector = '.p-tree-node-leaf'
      await comfyPage.page.hover(nodeSelector)

      // Verify the preview is displayed
      const previewVisible = await comfyPage.page.isVisible(
        '.node-lib-node-preview'
      )
      expect(previewVisible).toBe(true)

      const count = await comfyPage.getGraphNodesCount()
      // Drag the node onto the canvas
      const canvasSelector = '#graph-canvas'

      // Get the bounding box of the canvas element
      const canvasBoundingBox = (await comfyPage.page
        .locator(canvasSelector)
        .boundingBox())!

      // Calculate the center position of the canvas
      const targetPosition = {
        x: canvasBoundingBox.x + canvasBoundingBox.width / 2,
        y: canvasBoundingBox.y + canvasBoundingBox.height / 2
      }

      await comfyPage.page.dragAndDrop(nodeSelector, canvasSelector, {
        targetPosition
      })

      // Verify the node is added to the canvas
      expect(await comfyPage.getGraphNodesCount()).toBe(count + 1)
    })

    test('Bookmark node', async ({ comfyPage }) => {
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.getFolder('sampling').click()

      // Bookmark the node
      await tab
        .getNode('KSampler (Advanced)')
        .locator('.bookmark-button')
        .click()

      // Verify the bookmark is added to the bookmarks tab
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual(['KSamplerAdvanced'])
      // Verify the bookmark node with the same name is added to the tree.
      expect(await tab.getNode('KSampler (Advanced)').count()).toBe(2)

      // Hover on the bookmark node to display the preview
      await comfyPage.page.hover('.node-lib-bookmark-tree-explorer .tree-leaf')
      expect(await comfyPage.page.isVisible('.node-lib-node-preview')).toBe(
        true
      )
    })

    test('Ignores unrecognized node', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', ['foo'])

      const tab = comfyPage.menu.nodeLibraryTab
      expect(await tab.getFolder('sampling').count()).toBe(1)
      expect(await tab.getNode('foo').count()).toBe(0)
    })

    test('Displays empty bookmarks folder', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', ['foo/'])
      const tab = comfyPage.menu.nodeLibraryTab
      expect(await tab.getFolder('foo').count()).toBe(1)
    })

    test('Can add new bookmark folder', async ({ comfyPage }) => {
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.newFolderButton.click()
      await comfyPage.page.keyboard.press('Enter')
      expect(await tab.getFolder('New Folder').count()).toBe(1)
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual(['New Folder/'])
    })

    test('Can add nested bookmark folder', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', ['foo/'])
      const tab = comfyPage.menu.nodeLibraryTab

      await tab.getFolder('foo').click({ button: 'right' })
      await comfyPage.page.getByLabel('New Folder').click()
      await comfyPage.page.keyboard.type('bar')
      await comfyPage.page.keyboard.press('Enter')

      expect(await tab.getFolder('bar').count()).toBe(1)
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual(['foo/', 'foo/bar/'])
    })

    test('Can delete bookmark folder', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', ['foo/'])
      const tab = comfyPage.menu.nodeLibraryTab

      await tab.getFolder('foo').click({ button: 'right' })
      await comfyPage.page.getByLabel('Delete').click()

      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual([])
    })

    test('Can rename bookmark folder', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', ['foo/'])
      const tab = comfyPage.menu.nodeLibraryTab

      await tab.getFolder('foo').click({ button: 'right' })
      await comfyPage.page
        .locator('.p-contextmenu-item-label:has-text("Rename")')
        .click()
      await comfyPage.page.keyboard.insertText('bar')
      await comfyPage.page.keyboard.press('Enter')

      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual(['bar/'])
    })

    test('Can add bookmark by dragging node to bookmark folder', async ({
      comfyPage
    }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', ['foo/'])
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.getFolder('sampling').click()
      await comfyPage.page.dragAndDrop(
        tab.nodeSelector('KSampler (Advanced)'),
        tab.folderSelector('foo')
      )
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual(['foo/', 'foo/KSamplerAdvanced'])
    })

    test('Can add bookmark by clicking bookmark button', async ({
      comfyPage
    }) => {
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.getFolder('sampling').click()
      await tab
        .getNode('KSampler (Advanced)')
        .locator('.bookmark-button')
        .click()
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual(['KSamplerAdvanced'])
    })

    test('Can unbookmark node (Top level bookmark)', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', [
        'KSamplerAdvanced'
      ])
      const tab = comfyPage.menu.nodeLibraryTab
      await tab
        .getNode('KSampler (Advanced)')
        .locator('.bookmark-button')
        .click()
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual([])
    })

    test('Can unbookmark node (Library node bookmark)', async ({
      comfyPage
    }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', [
        'KSamplerAdvanced'
      ])
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.getFolder('sampling').click()
      await comfyPage.page
        .locator(tab.nodeSelector('KSampler (Advanced)'))
        .nth(1)
        .locator('.bookmark-button')
        .click()
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual([])
    })
    test('Can customize icon', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', ['foo/'])
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.getFolder('foo').click({ button: 'right' })
      await comfyPage.page.getByLabel('Customize').click()
      await comfyPage.page
        .locator('.icon-field .p-selectbutton > *:nth-child(2)')
        .click()
      await comfyPage.page
        .locator('.color-field .p-selectbutton > *:nth-child(2)')
        .click()
      await comfyPage.page.getByLabel('Confirm').click()
      await comfyPage.nextFrame()
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.BookmarksCustomization')
      ).toEqual({
        'foo/': {
          icon: 'pi-folder',
          color: '#007bff'
        }
      })
    })
    // If color is left as default, it should not be saved
    test('Can customize icon (default field)', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', ['foo/'])
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.getFolder('foo').click({ button: 'right' })
      await comfyPage.page.getByLabel('Customize').click()
      await comfyPage.page
        .locator('.icon-field .p-selectbutton > *:nth-child(2)')
        .click()
      await comfyPage.page.getByLabel('Confirm').click()
      await comfyPage.nextFrame()
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.BookmarksCustomization')
      ).toEqual({
        'foo/': {
          icon: 'pi-folder'
        }
      })
    })
    test('Can rename customized bookmark folder', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', ['foo/'])
      await comfyPage.setSetting('Comfy.NodeLibrary.BookmarksCustomization', {
        'foo/': {
          icon: 'pi-folder',
          color: '#007bff'
        }
      })
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.getFolder('foo').click({ button: 'right' })
      await comfyPage.page
        .locator('.p-contextmenu-item-label:has-text("Rename")')
        .click()
      await comfyPage.page.keyboard.insertText('bar')
      await comfyPage.page.keyboard.press('Enter')
      await comfyPage.nextFrame()
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual(['bar/'])
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.BookmarksCustomization')
      ).toEqual({
        'bar/': {
          icon: 'pi-folder',
          color: '#007bff'
        }
      })
    })

    test('Can delete customized bookmark folder', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', ['foo/'])
      await comfyPage.setSetting('Comfy.NodeLibrary.BookmarksCustomization', {
        'foo/': {
          icon: 'pi-folder',
          color: '#007bff'
        }
      })
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.getFolder('foo').click({ button: 'right' })
      await comfyPage.page.getByLabel('Delete').click()
      await comfyPage.nextFrame()
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual([])
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.BookmarksCustomization')
      ).toEqual({})
    })

    test('Can filter nodes in both trees', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', [
        'foo/',
        'foo/KSamplerAdvanced',
        'KSampler'
      ])

      const tab = comfyPage.menu.nodeLibraryTab
      await tab.nodeLibrarySearchBoxInput.fill('KSampler')
      // Node search box is debounced and may take some time to update.
      await comfyPage.page.waitForTimeout(1000)
      expect(await tab.getNode('KSampler (Advanced)').count()).toBe(2)
    })

    test('Can migrate legacy bookmarks', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks', [
        'foo/',
        'foo/KSampler (Advanced)',
        'UNKNOWN',
        'KSampler'
      ])
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', [])
      await comfyPage.reload()
      expect(await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks')).toEqual(
        []
      )
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual(['foo/', 'foo/KSamplerAdvanced', 'KSampler'])
    })
  })

  test.describe('Workflows sidebar', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.setSetting(
        'Comfy.Workflow.WorkflowTabsPosition',
        'Sidebar'
      )

      // Open the sidebar
      const tab = comfyPage.menu.workflowsTab
      await tab.open()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.setupWorkflowsDirectory({})
    })

    test('Can create new blank workflow', async ({ comfyPage }) => {
      const tab = comfyPage.menu.workflowsTab
      expect(await tab.getOpenedWorkflowNames()).toEqual([
        '*Unsaved Workflow.json'
      ])

      await tab.newBlankWorkflowButton.click()
      expect(await tab.getOpenedWorkflowNames()).toEqual([
        '*Unsaved Workflow.json',
        'Unsaved Workflow (2).json'
      ])
    })

    test('Can show top level saved workflows', async ({ comfyPage }) => {
      await comfyPage.setupWorkflowsDirectory({
        'workflow1.json': 'default.json',
        'workflow2.json': 'default.json'
      })
      await comfyPage.setup()

      const tab = comfyPage.menu.workflowsTab
      await tab.open()
      expect(await tab.getTopLevelSavedWorkflowNames()).toEqual(
        expect.arrayContaining(['workflow1.json', 'workflow2.json'])
      )
    })

    test('Can rename nested workflow from opened workflow item', async ({
      comfyPage
    }) => {
      await comfyPage.setupWorkflowsDirectory({
        foo: {
          'bar.json': 'default.json'
        }
      })
      await comfyPage.setup()

      const tab = comfyPage.menu.workflowsTab
      await tab.open()
      // Switch to the parent folder
      await tab.getPersistedItem('foo').click()
      await comfyPage.page.waitForTimeout(300)
      // Switch to the nested workflow
      await tab.getPersistedItem('bar').click()
      await comfyPage.page.waitForTimeout(300)

      const openedWorkflow = tab.getOpenedItem('foo/bar')
      await tab.renameWorkflow(openedWorkflow, 'foo/baz')
      expect(await tab.getOpenedWorkflowNames()).toEqual([
        '*Unsaved Workflow.json',
        'foo/baz.json'
      ])
    })

    test('Can save workflow as', async ({ comfyPage }) => {
      await comfyPage.menu.workflowsTab.newBlankWorkflowButton.click()
      await comfyPage.menu.topbar.saveWorkflowAs('workflow3.json')
      expect(
        await comfyPage.menu.workflowsTab.getOpenedWorkflowNames()
      ).toEqual(['*Unsaved Workflow.json', 'workflow3.json'])

      await comfyPage.menu.topbar.saveWorkflowAs('workflow4.json')
      expect(
        await comfyPage.menu.workflowsTab.getOpenedWorkflowNames()
      ).toEqual(['*Unsaved Workflow.json', 'workflow3.json', 'workflow4.json'])
    })

    test('Can save workflow as with same name', async ({ comfyPage }) => {
      await comfyPage.menu.topbar.saveWorkflow('workflow5.json')
      expect(
        await comfyPage.menu.workflowsTab.getOpenedWorkflowNames()
      ).toEqual(['workflow5.json'])

      await comfyPage.menu.topbar.saveWorkflowAs('workflow5.json')
      await comfyPage.confirmDialog('Overwrite existing file?', 'Yes')
      expect(
        await comfyPage.menu.workflowsTab.getOpenedWorkflowNames()
      ).toEqual(['workflow5.json'])
    })

    test('Can overwrite other workflows with save as', async ({
      comfyPage
    }) => {
      const topbar = comfyPage.menu.topbar
      await topbar.saveWorkflow('workflow1.json')
      await topbar.saveWorkflowAs('workflow2.json')
      expect(
        await comfyPage.menu.workflowsTab.getOpenedWorkflowNames()
      ).toEqual(['workflow1.json', 'workflow2.json'])
      expect(await comfyPage.menu.workflowsTab.getActiveWorkflowName()).toEqual(
        'workflow2.json'
      )

      await topbar.saveWorkflowAs('workflow1.json')
      await comfyPage.confirmDialog('Overwrite existing file?', 'Yes')
      // The old workflow1.json should be deleted and the new one should be saved.
      expect(
        await comfyPage.menu.workflowsTab.getOpenedWorkflowNames()
      ).toEqual(['workflow2.json', 'workflow1.json'])
      expect(await comfyPage.menu.workflowsTab.getActiveWorkflowName()).toEqual(
        'workflow1.json'
      )
    })

    test('Does not report warning when switching between opened workflows', async ({
      comfyPage
    }) => {
      await comfyPage.loadWorkflow('missing_nodes')
      await comfyPage.closeDialog()

      // Load blank workflow
      await comfyPage.menu.workflowsTab.open()
      await comfyPage.menu.workflowsTab.newBlankWorkflowButton.click()

      // Switch back to the missing_nodes workflow
      await comfyPage.menu.workflowsTab.switchToWorkflow('missing_nodes')

      await expect(
        comfyPage.page.locator('.comfy-missing-nodes')
      ).not.toBeVisible()
    })

    test('Can close saved-workflows from the open workflows section', async ({
      comfyPage
    }) => {
      await comfyPage.menu.topbar.saveWorkflow(
        `tempWorkflow-${test.info().title}`
      )
      const closeButton = comfyPage.page.locator(
        '.comfyui-workflows-open .close-workflow-button'
      )
      await closeButton.click()
      expect(
        await comfyPage.menu.workflowsTab.getOpenedWorkflowNames()
      ).toEqual(['Unsaved Workflow.json'])
    })
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
