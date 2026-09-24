import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Workflow tabs', () => {
  // These Agent-adjacent path-identity cases are staged behind the stacked
  // workflow-tab slice: https://github.com/Comfy-Org/ComfyUI_frontend/pull/16184
  test.describe('Agent workflow-tab contract from slice 04', () => {
    test('keeps exactly one active tab after selecting several workflows', async ({
      comfyPage
    }) => {
      test.fixme(
        true,
        'Activates after slice PR 16184 merges: https://github.com/Comfy-Org/ComfyUI_frontend/pull/16184'
      )

      const topbar = comfyPage.menu.topbar
      await topbar.newWorkflowButton.click()
      await topbar.newWorkflowButton.click()
      await expect.poll(() => topbar.getTabNames()).toHaveLength(3)

      await topbar.getTab(1).click()
      await expect(topbar.getActiveTab()).toHaveCount(1)
    })

    test('keeps path-backed active identity after a tab switch', async ({
      comfyPage
    }) => {
      test.fixme(
        true,
        'Activates after slice PR 16184 merges: https://github.com/Comfy-Org/ComfyUI_frontend/pull/16184'
      )

      const topbar = comfyPage.menu.topbar
      await topbar.newWorkflowButton.click()
      const names = await topbar.getTabNames()
      await topbar.getTab(0).click()

      await expect.poll(() => topbar.getActiveTabName()).toContain(names[0])
    })

    test('activates a valid neighbor when the active workflow is closed', async ({
      comfyPage
    }) => {
      test.fixme(
        true,
        'Activates after slice PR 16184 merges: https://github.com/Comfy-Org/ComfyUI_frontend/pull/16184'
      )

      const topbar = comfyPage.menu.topbar
      await topbar.newWorkflowButton.click()
      await topbar.newWorkflowButton.click()
      await topbar.getTab(1).click()
      const activeTabName = await topbar.getActiveTabName()
      await topbar.closeWorkflowTab(activeTabName)

      await expect.poll(() => topbar.getTabNames()).toHaveLength(2)
      await expect.poll(() => topbar.getActiveTabName()).not.toBe(activeTabName)
    })

    test('preserves tab identity across browser reload', async ({
      comfyPage
    }) => {
      test.fixme(
        true,
        'Activates after slice PR 16184 merges: https://github.com/Comfy-Org/ComfyUI_frontend/pull/16184'
      )

      const topbar = comfyPage.menu.topbar
      await topbar.newWorkflowButton.click()
      await topbar.getTab(1).click()
      const activeName = await topbar.getActiveTabName()

      await comfyPage.workflow.reloadAndWaitForApp()
      await expect.poll(() => topbar.getActiveTabName()).toContain(activeName)
    })
  })

  test('Default workflow tab is visible on load', async ({ comfyPage }) => {
    await expect
      .poll(() => comfyPage.menu.topbar.getTabNames())
      .toEqual([expect.stringContaining('Unsaved Workflow')])
  })

  test('Creating a new workflow adds a tab', async ({ comfyPage }) => {
    const topbar = comfyPage.menu.topbar

    await expect.poll(() => topbar.getTabNames()).toHaveLength(1)

    await topbar.newWorkflowButton.click()
    await expect
      .poll(() => topbar.getTabNames())
      .toEqual(
        expect.arrayContaining([
          expect.stringContaining('Unsaved Workflow (2)')
        ])
      )
  })

  test('Switching tabs changes active workflow', async ({ comfyPage }) => {
    const topbar = comfyPage.menu.topbar

    await topbar.newWorkflowButton.click()
    await expect.poll(() => topbar.getTabNames()).toHaveLength(2)

    await expect(topbar.getActiveTab()).toContainText('Unsaved Workflow (2)')

    await topbar.getTab(0).click()
    await expect(topbar.getActiveTab()).toContainText('Unsaved Workflow')
    await expect(topbar.getActiveTab()).not.toContainText('(2)')
  })

  test('Closing a tab removes it', async ({ comfyPage }) => {
    const topbar = comfyPage.menu.topbar

    await topbar.newWorkflowButton.click()
    await expect.poll(() => topbar.getTabNames()).toHaveLength(2)

    await topbar.closeWorkflowTab('Unsaved Workflow (2)')
    await expect
      .poll(() => topbar.getTabNames())
      .toEqual([expect.stringContaining('Unsaved Workflow')])
  })

  test('Right-clicking a tab shows context menu', async ({ comfyPage }) => {
    const topbar = comfyPage.menu.topbar

    await topbar.getTab(0).click({ button: 'right' })

    // Reka UI ContextMenuContent gets data-state="open" when active
    const contextMenu = comfyPage.page
      .getByRole('menu')
      .and(comfyPage.page.locator('[data-state="open"]'))
    await expect(contextMenu).toBeVisible()

    await expect(
      contextMenu.getByRole('menuitem', { name: /Close Tab/i }).first()
    ).toBeVisible()
    await expect(
      contextMenu.getByRole('menuitem', { name: /Save/i }).first()
    ).toBeVisible()
  })

  test('Context menu Close Tab action removes the tab', async ({
    comfyPage
  }) => {
    const topbar = comfyPage.menu.topbar

    await topbar.newWorkflowButton.click()
    await expect.poll(() => topbar.getTabNames()).toHaveLength(2)

    await topbar.getTab(1).click({ button: 'right' })
    const contextMenu = comfyPage.page
      .getByRole('menu')
      .and(comfyPage.page.locator('[data-state="open"]'))
    await expect(contextMenu).toBeVisible()

    await contextMenu
      .getByRole('menuitem', { name: /Close Tab/i })
      .first()
      .click()
    await expect.poll(() => topbar.getTabNames()).toHaveLength(1)
  })

  test('Closing the last tab creates a new default workflow', async ({
    comfyPage
  }) => {
    const topbar = comfyPage.menu.topbar

    await expect.poll(() => topbar.getTabNames()).toHaveLength(1)

    await topbar.closeWorkflowTab('Unsaved Workflow')
    await expect
      .poll(() => topbar.getTabNames())
      .toEqual([expect.stringContaining('Unsaved Workflow')])
  })

  test('Modified workflow shows unsaved indicator', async ({ comfyPage }) => {
    const topbar = comfyPage.menu.topbar

    // Modify the graph via litegraph API to trigger unsaved state
    await comfyPage.page.evaluate(() => {
      const graph = window.app?.graph
      const node = window.LiteGraph?.createNode('Note')
      if (graph && node) graph.add(node)
    })

    // WorkflowTab renders the dirty-state dot when the workflow has unsaved changes
    const activeTab = topbar.getActiveTab()
    const indicator = activeTab.getByTestId('workflow-dirty-indicator')
    const closeButton = activeTab.getByTestId('close-workflow-button')
    await expect(indicator).toBeVisible()
    await expect(closeButton).toBeHidden()

    await activeTab.hover()
    await expect(indicator).toBeHidden()
    await expect(closeButton).toBeVisible()

    await comfyPage.canvas.hover()
    await expect(indicator).toBeVisible()
    await expect(closeButton).toBeHidden()
  })

  test('Can drag tab to end', async ({ comfyPage }) => {
    const topbar = comfyPage.menu.topbar

    await topbar.newWorkflowButton.click()
    await topbar.newWorkflowButton.click()
    await expect.poll(() => topbar.getTabNames()).toHaveLength(3)
    const [a, b, c] = await topbar.getTabNames()

    await topbar.getTab(0).dragTo(topbar.getTab(2))

    await expect.poll(() => topbar.getTabNames()).toEqual([b, c, a])
  })

  test('Can drag tab to start', async ({ comfyPage }) => {
    const topbar = comfyPage.menu.topbar

    await topbar.newWorkflowButton.click()
    await topbar.newWorkflowButton.click()
    await expect.poll(() => topbar.getTabNames()).toHaveLength(3)
    const [a, b, c] = await topbar.getTabNames()

    await topbar.getTab(2).dragTo(topbar.getTab(0))

    await expect.poll(() => topbar.getTabNames()).toEqual([c, a, b])
  })

  test('Dragging a tab activates it', async ({ comfyPage }) => {
    const topbar = comfyPage.menu.topbar

    await topbar.newWorkflowButton.click()
    await topbar.newWorkflowButton.click()
    await expect.poll(() => topbar.getTabNames()).toHaveLength(3)

    const [a, b] = await topbar.getTabNames()
    await topbar.getTab(1).click()
    await expect.poll(() => topbar.getActiveTabName()).toContain(b)

    await topbar.getTab(0).dragTo(topbar.getTab(2))

    await expect(topbar.getActiveTab()).toHaveText(a)
  })

  test('Multiple tabs can be created, switched, and closed', async ({
    comfyPage
  }) => {
    const topbar = comfyPage.menu.topbar

    // Create 2 additional tabs (3 total)
    await topbar.newWorkflowButton.click()
    await expect.poll(() => topbar.getTabNames()).toHaveLength(2)
    await topbar.newWorkflowButton.click()
    await expect.poll(() => topbar.getTabNames()).toHaveLength(3)

    // Switch to first tab
    await topbar.getTab(0).click()
    await expect
      .poll(() => topbar.getActiveTabName())
      .toContain('Unsaved Workflow')

    // Close the middle tab
    await topbar.closeWorkflowTab('Unsaved Workflow (2)')
    await expect.poll(() => topbar.getTabNames()).toHaveLength(2)
  })

  test.describe('with a narrow viewport', () => {
    test.use({ viewport: { width: 800, height: 720 } })

    test(
      'Overflowing tabs shrink to stay visible while the active tab keeps its width',
      { tag: '@ui' },
      async ({ comfyPage }) => {
        const topbar = comfyPage.menu.topbar
        await topbar.openBlankWorkflows(5)

        await topbar.getTab(0).click()

        await expect(topbar.tabs.last()).toBeInViewport({ ratio: 1 })
        await expect
          .poll(async () => {
            const [activeBox, inactiveBox] = await Promise.all([
              topbar.getActiveTab().boundingBox(),
              topbar.tabs.last().boundingBox()
            ])
            return activeBox && inactiveBox
              ? activeBox.width - inactiveBox.width
              : null
          })
          .toBeGreaterThan(0)
      }
    )

    test(
      'Scrolls the active tab into view once the strip overflows',
      { tag: '@ui' },
      async ({ comfyPage }) => {
        const topbar = comfyPage.menu.topbar
        await topbar.openBlankWorkflows(10)

        await expect(topbar.tabs.last()).toBeInViewport({ ratio: 1 })
        await expect(topbar.tabs.first()).not.toBeInViewport({ ratio: 1 })

        await topbar.workflowTabs
          .getByRole('button', { name: 'More workflows', exact: true })
          .click()
        await comfyPage.page
          .getByRole('menuitem', { name: 'Unsaved Workflow', exact: true })
          .click()

        await expect(topbar.tabs.first()).toBeInViewport({ ratio: 1 })
        await expect(topbar.tabs.last()).not.toBeInViewport({ ratio: 1 })
      }
    )

    test(
      'Keeps the active tab visible when the viewport narrows',
      { tag: '@ui' },
      async ({ comfyPage }) => {
        const topbar = comfyPage.menu.topbar
        await topbar.openBlankWorkflows(10)
        await expect(topbar.tabs.last()).toBeInViewport({ ratio: 1 })

        await comfyPage.page.setViewportSize({ width: 600, height: 720 })

        await expect(topbar.tabs.last()).toBeInViewport({ ratio: 1 })
      }
    )

    test(
      'Compact inactive tabs do not reveal a close button on hover',
      { tag: '@ui' },
      async ({ comfyPage }) => {
        const topbar = comfyPage.menu.topbar
        await topbar.openBlankWorkflows(10)
        const inactiveTab = topbar.getTab(9)
        const activeTab = topbar.getActiveTab()
        await expect(
          topbar.tabs.first(),
          'strip must overflow'
        ).not.toBeInViewport({ ratio: 1 })

        await inactiveTab.hover()
        await expect(
          inactiveTab.getByTestId(TestIds.topbar.closeWorkflowButton)
        ).toBeHidden()

        await activeTab.hover()
        await expect(
          activeTab.getByTestId(TestIds.topbar.closeWorkflowButton)
        ).toBeVisible()
      }
    )
  })

  test(
    'Hover popover is centered under the hovered tab',
    { tag: '@ui' },
    async ({ comfyPage }) => {
      const topbar = comfyPage.menu.topbar
      await topbar.openBlankWorkflows(2)
      const tab = topbar.getWorkflowTab('Unsaved Workflow (2)')
      const popover = topbar.getWorkflowPopover('Unsaved Workflow (2)')

      await tab.hover()

      await expect(popover).toBeVisible()
      await expect
        .poll(async () => {
          const [tabBox, popoverBox] = await Promise.all([
            tab.boundingBox(),
            popover.boundingBox()
          ])
          return tabBox && popoverBox
            ? Math.abs(
                tabBox.x +
                  tabBox.width / 2 -
                  (popoverBox.x + popoverBox.width / 2)
              )
            : null
        })
        .toBeLessThanOrEqual(1)
    }
  )

  test.describe('Closing a modified workflow tab (FE-419)', () => {
    async function modifyActiveWorkflow(page: Page, activeTab: Locator) {
      await page.evaluate(() => {
        const graph = window.app?.graph
        const node = window.LiteGraph?.createNode('Note')
        if (graph && node) graph.add(node)
      })
      await expect(
        activeTab.getByTestId('workflow-dirty-indicator')
      ).toHaveCount(1)
    }

    test('shows "Close anyway" label and no Cancel button on dirtyClose dialog', async ({
      comfyPage
    }) => {
      const topbar = comfyPage.menu.topbar

      await topbar.newWorkflowButton.click()
      await expect.poll(() => topbar.getTabNames()).toHaveLength(2)

      await modifyActiveWorkflow(comfyPage.page, topbar.getActiveTab())
      await topbar.closeWorkflowTab('Unsaved Workflow (2)')

      const dialog = comfyPage.page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(
        dialog.getByRole('button', { name: 'Close anyway' })
      ).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Save' })).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toHaveCount(
        0
      )
    })

    test('clicking "Close anyway" closes the tab without saving', async ({
      comfyPage
    }) => {
      const topbar = comfyPage.menu.topbar

      await topbar.newWorkflowButton.click()
      await expect.poll(() => topbar.getTabNames()).toHaveLength(2)

      await modifyActiveWorkflow(comfyPage.page, topbar.getActiveTab())
      await topbar.closeWorkflowTab('Unsaved Workflow (2)')

      await comfyPage.page
        .getByRole('dialog')
        .getByRole('button', { name: 'Close anyway' })
        .click()

      await expect.poll(() => topbar.getTabNames()).toHaveLength(1)
      await expect
        .poll(() => topbar.getActiveTabName())
        .toContain('Unsaved Workflow')
    })

    test('dismissing the dialog keeps the modified tab open', async ({
      comfyPage
    }) => {
      const topbar = comfyPage.menu.topbar

      await topbar.newWorkflowButton.click()
      await expect.poll(() => topbar.getTabNames()).toHaveLength(2)

      await modifyActiveWorkflow(comfyPage.page, topbar.getActiveTab())
      await topbar.closeWorkflowTab('Unsaved Workflow (2)')

      const dialog = comfyPage.page.getByRole('dialog', {
        name: 'Save Changes?',
        exact: true
      })
      await expect(dialog).toBeVisible()
      await comfyPage.page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()

      await expect.poll(() => topbar.getTabNames()).toHaveLength(2)
    })
  })
})
