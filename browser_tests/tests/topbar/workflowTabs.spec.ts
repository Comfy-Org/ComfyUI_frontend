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

    const contextMenu = comfyPage.page.locator(
      '[data-reka-context-menu-content]'
    )
    await expect(contextMenu).toBeVisible()

    await expect(contextMenu).toContainText('Close Tab')
    await expect(contextMenu).toContainText('Save')
  })
})
