import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Workflow tabs', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )
    await comfyPage.setup()
  })

  test('Default workflow tab is visible on load', async ({ comfyPage }) => {
    const tabNames = await comfyPage.menu.topbar.getTabNames()
    expect(tabNames.length).toBe(1)
    expect(tabNames[0]).toContain('Unsaved Workflow')
  })

  test('Creating a new workflow adds a tab', async ({ comfyPage }) => {
    const topbar = comfyPage.menu.topbar

    expect(await topbar.getTabNames()).toHaveLength(1)

    await topbar.newWorkflowButton.click()
    await expect.poll(() => topbar.getTabNames()).toHaveLength(2)

    const tabNames = await topbar.getTabNames()
    expect(tabNames[1]).toContain('Unsaved Workflow (2)')
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
    await expect.poll(() => topbar.getTabNames()).toHaveLength(1)

    const remaining = await topbar.getTabNames()
    expect(remaining[0]).toContain('Unsaved Workflow')
  })

  test('Right-clicking a tab shows context menu', async ({ comfyPage }) => {
    const topbar = comfyPage.menu.topbar

    await topbar.getTab(0).click({ button: 'right' })

    // Reka UI ContextMenuContent gets data-state="open" when active
    const contextMenu = comfyPage.page.locator(
      '[role="menu"][data-state="open"]'
    )
    await expect(contextMenu).toBeVisible({ timeout: 5000 })

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
    const contextMenu = comfyPage.page.locator(
      '[role="menu"][data-state="open"]'
    )
    await expect(contextMenu).toBeVisible({ timeout: 5000 })

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
    await expect.poll(() => topbar.getTabNames()).toHaveLength(1)

    const tabNames = await topbar.getTabNames()
    expect(tabNames[0]).toContain('Unsaved Workflow')
  })

  test('Modified workflow shows unsaved indicator', async ({ comfyPage }) => {
    const topbar = comfyPage.menu.topbar

    // Modify the graph via litegraph API to trigger unsaved state
    await comfyPage.page.evaluate(() => {
      const graph = window.app?.graph
      const node = window.LiteGraph?.createNode('Note')
      if (graph && node) graph.add(node)
    })

    // WorkflowTab renders "•" when the workflow has unsaved changes
    const activeTab = topbar.getActiveTab()
    await expect(activeTab.locator('text=•')).toBeVisible({ timeout: 5000 })
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
})
