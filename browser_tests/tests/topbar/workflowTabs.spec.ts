import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

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

    const activeNameBefore = await topbar.getActiveTabName()
    expect(activeNameBefore).toContain('Unsaved Workflow (2)')

    await topbar.getTab(0).click()
    await expect
      .poll(() => topbar.getActiveTabName())
      .toContain('Unsaved Workflow')

    const activeAfter = await topbar.getActiveTabName()
    expect(activeAfter).not.toContain('(2)')
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

    // Reka UI ContextMenuContent renders with role="menu"
    const contextMenu = comfyPage.page.getByRole('menu')
    await expect(contextMenu).toBeVisible({ timeout: 5000 })

    await expect(
      contextMenu.getByRole('menuitem', { name: /Close Tab/i })
    ).toBeVisible()
    await expect(
      contextMenu.getByRole('menuitem', { name: /Save/i })
    ).toBeVisible()
  })

  test('Context menu Close Tab action removes the tab', async ({
    comfyPage
  }) => {
    const topbar = comfyPage.menu.topbar

    await topbar.newWorkflowButton.click()
    await expect.poll(() => topbar.getTabNames()).toHaveLength(2)

    await topbar.getTab(1).click({ button: 'right' })
    const contextMenu = comfyPage.page.getByRole('menu')
    await expect(contextMenu).toBeVisible({ timeout: 5000 })

    await contextMenu.getByRole('menuitem', { name: /Close Tab/i }).click()
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

    // Add a node to modify the workflow
    await comfyPage.canvasOps.doubleClick()
    await comfyPage.searchBox.fillAndSelectFirstNode('KSampler')

    // The tab should display the status indicator dot
    const activeTab = topbar.getActiveTab()
    const statusDot = activeTab.locator('span:has-text("•")')
    await expect(statusDot).toBeVisible({ timeout: 5000 })
  })

  test('Multiple tabs can be created, switched, and closed', async ({
    comfyPage
  }) => {
    const topbar = comfyPage.menu.topbar

    // Create 3 additional tabs (4 total)
    await topbar.newWorkflowButton.click()
    await expect.poll(() => topbar.getTabNames()).toHaveLength(2)
    await topbar.newWorkflowButton.click()
    await expect.poll(() => topbar.getTabNames()).toHaveLength(3)
    await topbar.newWorkflowButton.click()
    await expect.poll(() => topbar.getTabNames()).toHaveLength(4)

    // Verify all tabs are visible
    const allNames = await topbar.getTabNames()
    expect(allNames).toHaveLength(4)

    // Switch to the second tab
    await topbar.getTab(1).click()
    await expect
      .poll(() => topbar.getActiveTabName())
      .toContain('Unsaved Workflow (2)')

    // Switch to the first tab
    await topbar.getTab(0).click()
    await expect
      .poll(() => topbar.getActiveTabName())
      .toContain('Unsaved Workflow')

    // Close the middle tab (index 1 = "Unsaved Workflow (2)")
    await topbar.closeWorkflowTab('Unsaved Workflow (2)')
    await expect.poll(() => topbar.getTabNames()).toHaveLength(3)

    // Verify the closed tab is gone
    const remaining = await topbar.getTabNames()
    expect(remaining).not.toContain('Unsaved Workflow (2)')
  })
})
