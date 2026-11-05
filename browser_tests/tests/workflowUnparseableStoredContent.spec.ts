import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

/**
 * Production `workflow_load_failure`s CLOUD-FRONTEND-PROD-3FG (frontend 1.59.5,
 * `"[object Object]" is not valid JSON`) and -373 (1.58.0, `Unexpected token
 * 'O', "One Prompt"...`): a saved workflow whose stored file is not JSON at all.
 *
 * `JSON.parse` threw before `ComfyWorkflow.load` could classify the content, so
 * the native `SyntaxError` escaped past the `UnreadableWorkflowError` catch that
 * covers empty and non-object files. Clicking the workflow did nothing visible —
 * no message, no way to remove the file — and Sentry grouped on the quoted text,
 * so each corrupted file became its own issue carrying the user's content.
 *
 * The content is a fixture asset, not a literal: the stored bytes are the whole
 * point of the case.
 */

const CORRUPT_WORKFLOW = 'broken-not-json.json'

test.describe(
  'Opening a workflow whose stored content is not valid JSON',
  { tag: '@workflow' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({
        [CORRUPT_WORKFLOW]: 'object-object-content.txt'
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
      await workflowsTab.getPersistedItem('broken-not-json').click()

      const toast = comfyPage.toast.withText("Can't open this workflow")
      await expect(toast).toBeVisible()
      await expect(toast).toContainText(CORRUPT_WORKFLOW)
      // The old failure left the SyntaxError unhandled.
      expect(pageErrors).toEqual([])
      await test.info().attach('unparseable-workflow-toast', {
        body: await toast.screenshot(),
        contentType: 'image/png'
      })

      await toast.getByRole('button', { name: 'Delete' }).click()
      await comfyPage.confirmDialog.delete.click()
      await expect
        .poll(() => workflowsTab.getTopLevelSavedWorkflowNames())
        .not.toContain('broken-not-json')
    })

    test('leaves a healthy workflow openable from the same sidebar', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({
        [CORRUPT_WORKFLOW]: 'object-object-content.txt',
        'healthy.json': 'default.json'
      })

      const { workflowsTab } = comfyPage.menu
      await workflowsTab.open()
      await workflowsTab.getPersistedItem('healthy').click()

      await comfyPage.expectNodeCount(7)
      await expect(
        comfyPage.toast.withText("Can't open this workflow")
      ).toBeHidden()
    })
  }
)
