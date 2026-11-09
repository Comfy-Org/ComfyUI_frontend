import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Workflow tabs', () => {
  test.describe('Path-backed active-tab identity', () => {
    const pathBackedWorkflowNames = [
      'path-backed-first',
      'path-backed-second'
    ] as const

    test.afterEach(async ({ comfyPage }) => {
      for (const name of pathBackedWorkflowNames) {
        await comfyPage.workflow.deleteWorkflow(name)
      }
    })

    test('keeps exactly one active tab after selecting several workflows', async ({
      comfyPage
    }) => {
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
      const topbar = comfyPage.menu.topbar
      const [firstWorkflow, secondWorkflow] = pathBackedWorkflowNames

      await topbar.saveWorkflow(firstWorkflow)
      await topbar.newWorkflowButton.click()
      await topbar.saveWorkflow(secondWorkflow)
      await topbar.getTab(0).click()

      await expect
        .poll(() => comfyPage.workflow.getActiveWorkflowPath())
        .toContain(firstWorkflow)
    })

    test('activates a valid neighbor when the active workflow is closed', async ({
      comfyPage
    }) => {
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
      'Tabs shrink to the 90px floor before the strip scrolls',
      { tag: '@ui' },
      async ({ comfyPage }) => {
        const topbar = comfyPage.menu.topbar

        await test.step('shrink tabs while they still fit', async () => {
          await topbar.openBlankWorkflows(5)
          const [firstTabName] = await topbar.getTabNames()
          await comfyPage.workflow.switchToTab(firstTabName)

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
          await expect
            .poll(() =>
              topbar.tabStrip.evaluate((strip) => ({
                fits: strip.scrollWidth <= strip.clientWidth + 1,
                scrollLeft: strip.scrollLeft
              }))
            )
            .toEqual({ fits: true, scrollLeft: 0 })
        })

        await test.step('scroll after inactive tabs reach 90px', async () => {
          await topbar.openBlankWorkflows(1)
          await expect
            .poll(async () => {
              const widths = await topbar.tabs.evaluateAll((tabs) =>
                tabs
                  .filter(
                    (tab) =>
                      !tab.querySelector('[role="tab"][aria-selected="true"]')
                  )
                  .map((tab) => Math.round(tab.getBoundingClientRect().width))
              )
              return widths
            })
            .toEqual(Array(6).fill(90))
          await expect
            .poll(() =>
              topbar.tabStrip.evaluate(
                (strip) => strip.scrollWidth > strip.clientWidth + 1
              )
            )
            .toBe(true)
        })
      }
    )

    test(
      'Keeps the active tab visible when the viewport narrows',
      { tag: '@ui' },
      async ({ comfyPage }) => {
        const topbar = comfyPage.menu.topbar

        await test.step('open tabs with the last tab active', async () => {
          await topbar.openBlankWorkflows(10)
          await expect(topbar.tabs.last()).toBeInViewport({ ratio: 1 })
        })

        await test.step('keep the active tab visible after resize', async () => {
          await comfyPage.page.setViewportSize({ width: 600, height: 720 })
          await expect(topbar.tabs.last()).toBeInViewport({ ratio: 1 })
        })

        await test.step('reveal a hidden tab when it becomes active', async () => {
          await topbar.openWorkflowOverflowMenu()
          await comfyPage.page
            .getByRole('menuitem', { name: 'Unsaved Workflow', exact: true })
            .click()

          await expect(topbar.tabs.first()).toBeInViewport({ ratio: 1 })
          await expect(topbar.tabs.last()).not.toBeInViewport({ ratio: 1 })
        })
      }
    )

    test(
      'Compact inactive tabs reveal their close button to keyboard only',
      { tag: '@ui' },
      async ({ comfyPage }) => {
        const topbar = comfyPage.menu.topbar

        await test.step('open compact tabs', async () => {
          await topbar.openBlankWorkflows(10)
          await expect(
            topbar.tabs.first(),
            'strip must overflow'
          ).not.toBeInViewport({ ratio: 1 })
        })

        const inactiveTab = topbar.getTab(9)

        await test.step('hide Close on inactive tab hover', async () => {
          await inactiveTab.hover()
          await expect(
            inactiveTab.getByTestId(TestIds.topbar.workflowDirtyIndicator)
          ).toBeVisible()
          await expect(
            inactiveTab.getByTestId(TestIds.topbar.closeWorkflowButton)
          ).toBeHidden()

          const activeTab = topbar.getActiveTab()
          await activeTab.hover()
          await expect(
            activeTab.getByTestId(TestIds.topbar.closeWorkflowButton)
          ).toBeVisible()
        })

        await test.step('focus and activate Close with the keyboard', async () => {
          const tabCount = await topbar.tabs.count()
          const closeButton = inactiveTab.getByTestId(
            TestIds.topbar.closeWorkflowButton
          )
          await inactiveTab.getByRole('tab').focus()
          await comfyPage.page.keyboard.press('Tab')
          await expect(closeButton).toBeFocused()
          await expect(closeButton).toBeVisible()
          await comfyPage.page.keyboard.press('Enter')
          await expect(topbar.tabs).toHaveCount(tabCount - 1)
        })
      }
    )

    test(
      'Keyboard overflow menu opens below its trigger and returns focus',
      { tag: '@ui' },
      async ({ comfyPage }) => {
        const topbar = comfyPage.menu.topbar

        await topbar.openBlankWorkflows(8)
        await topbar.openWorkflowOverflowMenu()
        await expect(async () => {
          const gap = await topbar.getWorkflowOverflowMenuVerticalGap()
          expect(gap).toBeGreaterThanOrEqual(0)
          expect(gap).toBeLessThan(10)
        }).toPass({ timeout: 5000 })

        await topbar.closeWorkflowOverflowMenu()
        await expect(topbar.workflowOverflowButton).toBeFocused()
      }
    )
  })

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
