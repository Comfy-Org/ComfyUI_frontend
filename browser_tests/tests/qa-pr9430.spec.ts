import { expect } from '@playwright/test'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Workflow Management UI', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    // Ensure a clean state for workflows and settings
    await comfyPage.workflow.setupWorkflowsDirectory({})
    await comfyPage.page.goto('/')
    await comfyPage.page.waitForLoadState('domcontentloaded')
  })

  test('Templates sidebar displays preview images for Getting Started cards', async ({
    comfyPage
  }) => {
    // Open the Workflows/Templates sidebar
    await comfyPage.menu.workflowsTab.open()

    // Locate the "Getting Started" section within the templates sidebar
    // We find the text "Getting Started" and then its parent element to scope the search for cards
    const gettingStartedSection = comfyPage.page
      .locator('.workflow-templates-sidebar-panel')
      .getByText('Getting Started', { exact: true })
      .locator('..')

    // Expect the section to be visible
    await expect(gettingStartedSection).toBeVisible()

    // Take a screenshot of the first template card in the "Getting Started" section.
    // This will visually assert if the preview image is present or if it's an empty placeholder.
    const firstTemplateCard = gettingStartedSection
      .locator('.workflow-template-card')
      .first()
    await expect(firstTemplateCard).toBeVisible()
    await expect(firstTemplateCard).toHaveScreenshot(
      'getting-started-template-card-with-image.png'
    )

    // Close the sidebar for cleanup
    await comfyPage.menu.workflowsTab.close()
  })

  test('User can successfully save a workflow via the File > Save menu', async ({
    comfyPage
  }) => {
    const workflowName = 'test-save-workflow-interaction'

    // Load a simple workflow to have content to save.
    // This also ensures the workflow is considered "modified" or savable.
    await comfyPage.workflow.loadWorkflow('empty_workflow')

    // Trigger the save action using the topbar helper.
    // This helper interacts with the save dialog, types the name, and confirms.
    await comfyPage.menu.topbar.saveWorkflow(workflowName)

    // Assert that the active tab name updates to the newly saved workflow name,
    // indicating the save operation was successful from a UI perspective.
    await expect(comfyPage.menu.topbar.getActiveTabName()).resolves.toBe(
      workflowName
    )

    // Verify the saved workflow appears in the Workflows sidebar.
    await comfyPage.menu.workflowsTab.open()
    await expect(
      comfyPage.menu.workflowsTab.getPersistedItem(workflowName)
    ).toBeVisible()
    await comfyPage.menu.workflowsTab.close()

    // Clean up the created workflow
    await comfyPage.workflow.deleteWorkflow(workflowName)
  })
})
