import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

const WORKFLOW_NAME = 'test-confirm-delete'

async function startDeletingFromSidebar(comfyPage: ComfyPage) {
  const { workflowsTab } = comfyPage.menu
  await workflowsTab.open()
  await workflowsTab.getPersistedItem(WORKFLOW_NAME).click({ button: 'right' })
  await comfyPage.contextMenu.clickMenuItem('Delete')
}

test.describe('Comfy.Workflow.ConfirmDelete', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.menu.topbar.saveWorkflowAs(WORKFLOW_NAME)
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({})
  })

  test('on (default): right-click → Delete prompts the confirm dialog', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.Workflow.ConfirmDelete', true)

    await startDeletingFromSidebar(comfyPage)

    await expect(comfyPage.confirmDialog.root).toBeVisible()
    await expect(comfyPage.confirmDialog.delete).toBeVisible()
  })

  test('off: right-click → Delete bypasses the confirm dialog', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.Workflow.ConfirmDelete', false)

    await startDeletingFromSidebar(comfyPage)

    const { workflowsTab } = comfyPage.menu
    await expect(comfyPage.confirmDialog.root).toBeHidden()
    await expect
      .poll(() => workflowsTab.getTopLevelSavedWorkflowNames())
      .not.toContain(WORKFLOW_NAME)
  })
})
