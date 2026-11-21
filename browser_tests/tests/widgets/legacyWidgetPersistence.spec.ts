import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const SAVED_COMBO_WORKFLOW = 'legacy-combo-persistence'

test.describe(
  'Legacy widget persistence',
  { tag: ['@widget', '@workflow'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
    })

    test('preserves a non-default combo selection after save and reload', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('vueNodes/linked-int-widget')
      const [ksampler] = await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      const scheduler = await ksampler.getWidgetByName('scheduler')

      // Precondition, not decoration: if the fixture already shipped 'karras',
      // a graph that fell back to the fixture default would satisfy the final
      // assertion without anything having been persisted at all.
      await expect.poll(() => scheduler.getValue()).toBe('simple')

      await scheduler.click()
      await comfyPage.page
        .getByRole('menuitem', { name: 'karras', exact: true })
        .click()
      await expect.poll(() => scheduler.getValue()).toBe('karras')
      await comfyPage.menu.topbar.saveWorkflow(SAVED_COMBO_WORKFLOW)

      // Reloading in place cannot tell a durable save from draft restoration:
      // `reloadAndWaitForApp()` keeps localStorage, and the unload flush
      // rewrites the pending draft that the next boot reads back, so the
      // assertion passes even when the save is removed. Closing the tab drops
      // that pending draft and clearing the persisted keys removes the rest,
      // which leaves the server copy written by the save as the only source
      // the reopened workflow can come from.
      // The save has to have cleared the dirty flag before the tab is closed:
      // a still-modified workflow opens a "Save Changes?" prompt that would
      // both stall the close and hide a save that never landed.
      await expect
        .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
        .toBe(false)
      await comfyPage.menu.topbar.closeWorkflowTab(SAVED_COMBO_WORKFLOW)
      await comfyPage.workflow.clearPersistedDrafts()
      await comfyPage.workflow.reloadAndWaitForApp()

      const workflowsTab = comfyPage.menu.workflowsTab
      await workflowsTab.open()
      await workflowsTab.getPersistedItem(SAVED_COMBO_WORKFLOW).click()
      await comfyPage.workflow.waitForActiveWorkflow()
      await comfyPage.workflow.waitForWorkflowIdle()

      // The reopened graph has to be the saved file, not a restored draft or
      // the blank workflow the app boots with once the tab is gone.
      await expect
        .poll(() => comfyPage.workflow.getActiveWorkflowPath())
        .toBe(`workflows/${SAVED_COMBO_WORKFLOW}.json`)

      const [reloadedKsampler] =
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      await expect
        .poll(async () =>
          (await reloadedKsampler.getWidgetByName('scheduler')).getValue()
        )
        .toBe('karras')
    })

    test('preserves exact multiline paragraphs after save and reload', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('widgets/multiline_single_node')
      const paragraphs =
        'First paragraph: [subject] & café.\n\nSecond paragraph: <end> #100%.'
      const textarea = comfyPage.page.getByRole('textbox', {
        name: 'text',
        exact: true
      })
      await textarea.fill(paragraphs)
      await expect(textarea).toHaveValue(paragraphs)
      await comfyPage.menu.topbar.saveWorkflow('legacy-multiline-persistence')

      await comfyPage.workflow.reloadAndWaitForApp()

      await expect(
        comfyPage.page.getByRole('textbox', { name: 'text', exact: true })
      ).toHaveValue(paragraphs)
      const node = await comfyPage.nodeOps.getNodeRefById(1)
      await expect
        .poll(async () => (await node.getWidgetByName('text')).getValue())
        .toBe(paragraphs)
    })
  }
)
