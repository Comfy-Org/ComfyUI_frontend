import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe('Workflow tab order', { tag: ['@ui'] }, () => {
  test('restores the active tab across two reloads', async ({ comfyPage }) => {
    const { topbar } = comfyPage.menu

    // Save the default graph as the first tab.
    await topbar.saveWorkflowAs('tab-a')

    // Open a new blank workflow and save it as the second tab.
    await topbar.newWorkflowButton.click()
    await topbar.getWorkflowTab('Unsaved Workflow').dblclick()
    await topbar.saveWorkflowAs('tab-b')

    // Repeat for the remaining tabs, leaving tab-e active.
    for (const name of ['tab-c', 'tab-d', 'tab-e']) {
      await topbar.newWorkflowButton.click()
      await topbar.saveWorkflowAs(name)
    }

    // Close every tab to the right of tab-a.
    await topbar.getWorkflowTab('tab-a').click({ button: 'right' })
    await comfyPage.contextMenu.clickMenuItem('Close Tabs to Right')

    // After the first reload, tab-e is the active tab.
    await comfyPage.workflow.reloadAndWaitForApp()
    await expect(
      comfyPage.page.getByRole('tab', { name: 'tab-e', selected: true })
    ).toBeVisible()

    // After the second reload, tab-a is the active tab.
    await comfyPage.workflow.reloadAndWaitForApp()
    await expect(
      comfyPage.page.getByRole('tab', { name: 'tab-a', selected: true })
    ).toBeVisible()
  })
})
