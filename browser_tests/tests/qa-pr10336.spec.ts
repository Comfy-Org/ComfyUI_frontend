import { expect } from '@playwright/test'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'

const generateUniqueFilename = (extension = '') =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${extension}`

test.describe('Workflow Tab Persistence', { tag: '@workflow' }, () => {
  let workflowA: string
  let workflowB: string

  test.beforeEach(async ({ comfyPage }) => {
    // Ensure clean state and top menu enabled
    await comfyPage.workflow.setupWorkflowsDirectory({})
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')

    // Create and save two workflows to establish open tabs
    workflowA = generateUniqueFilename()
    await comfyPage.menu.topbar.saveWorkflow(workflowA)

    workflowB = generateUniqueFilename()
    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    await comfyPage.menu.topbar.saveWorkflow(workflowB)

    // Wait for dual-write logic to persist pointers to localStorage (fallback for restart)
    await comfyPage.page.waitForFunction(() => {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key?.startsWith('Comfy.Workflow.LastOpenPaths:')) return true
      }
      return false
    })

    // Simulate browser restart: sessionStorage is cleared (lost on close), localStorage remains
    await comfyPage.page.evaluate(() => sessionStorage.clear())

    // Re-initialize page without clearing storage to trigger restoration logic
    await comfyPage.setup({ clearStorage: false })
  })

  test('restores workflow tabs in topbar after browser restart', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )

    // Verify both tabs are restored and visible in the UI
    const tabA = comfyPage.page.locator('.workflow-tabs .workflow-label', {
      hasText: workflowA
    })
    const tabB = comfyPage.page.locator('.workflow-tabs .workflow-label', {
      hasText: workflowB
    })

    await expect(tabA).toBeVisible()
    await expect(tabB).toBeVisible()

    const tabs = await comfyPage.menu.topbar.getTabNames()
    const activeTab = await comfyPage.menu.topbar.getActiveTabName()

    // Verify order (A then B) and that the last opened workflow is active
    expect(tabs).toEqual(expect.arrayContaining([workflowA, workflowB]))
    expect(tabs.indexOf(workflowA)).toBeLessThan(tabs.indexOf(workflowB))
    expect(activeTab).toBe(workflowB)

    await expect(comfyPage.page.locator('.workflow-tabs')).toHaveScreenshot(
      'restored-topbar-tabs.png'
    )
  })

  test('restores open workflows in sidebar after browser restart', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Sidebar'
    )
    await comfyPage.menu.workflowsTab.open()

    // Verify workflows are listed as open in the sidebar
    const itemA = comfyPage.menu.workflowsTab.getPersistedItem(workflowA)
    const itemB = comfyPage.menu.workflowsTab.getPersistedItem(workflowB)

    await expect(itemA).toBeVisible()
    await expect(itemB).toBeVisible()

    await expect(comfyPage.page.locator('.side-bar-panel')).toHaveScreenshot(
      'restored-sidebar-tabs.png'
    )
  })
})
