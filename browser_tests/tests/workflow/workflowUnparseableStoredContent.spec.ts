import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const CORRUPT_WORKFLOW = 'broken-not-json.json'
const CORRUPT_WORKFLOW_NAME = 'broken-not-json'
const UNREADABLE_TOAST = "Can't open this workflow"

test.describe(
  'Opening a workflow whose stored content is not valid JSON (CLOUD-FRONTEND-PROD-3FG, CLOUD-FRONTEND-PROD-373)',
  { tag: '@workflow' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({
        [CORRUPT_WORKFLOW]: 'object-object-content.txt',
        'healthy.json': 'default.json'
      })
      await comfyPage.workflow.reloadAndWaitForApp()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
    })

    test('tells the user it cannot be opened and offers to delete it', async ({
      comfyPage
    }) => {
      const { page } = comfyPage
      const pageErrors: string[] = []
      page.on('pageerror', (error) => pageErrors.push(error.message))

      const { workflowsTab } = comfyPage.menu
      await workflowsTab.open()
      await workflowsTab.getPersistedItem(CORRUPT_WORKFLOW_NAME).click()

      const toast = comfyPage.toast.withText(UNREADABLE_TOAST)
      await expect(toast).toBeVisible()
      await expect(toast).toContainText(CORRUPT_WORKFLOW)
      expect(
        pageErrors,
        'the stored content must not escape as an unhandled SyntaxError'
      ).toEqual([])
      await test.info().attach('unparseable-workflow-toast', {
        body: await toast.screenshot(),
        contentType: 'image/png'
      })

      await toast.getByRole('button', { name: 'Delete' }).click()
      await comfyPage.confirmDialog.delete.click()
      await expect
        .poll(() => workflowsTab.getTopLevelSavedWorkflowNames())
        .not.toContain(CORRUPT_WORKFLOW_NAME)
    })

    test('leaves a healthy workflow in the same directory openable', async ({
      comfyPage
    }) => {
      const { workflowsTab } = comfyPage.menu
      await workflowsTab.open()
      await workflowsTab.getPersistedItem('healthy').click()

      await comfyPage.expectNodeCount(7)
      await expect(comfyPage.toast.withText(UNREADABLE_TOAST)).toBeHidden()
    })
  }
)
