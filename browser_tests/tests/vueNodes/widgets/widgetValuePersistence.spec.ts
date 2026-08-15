import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Widget value persistence',
  { tag: ['@widget', '@vue-nodes'] },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
    })

    test('an emptied text widget remains empty after save and reopen', async ({
      comfyPage
    }) => {
      test.slow()
      await comfyPage.workflow.loadWorkflow('inputs/string_input')

      const widget = comfyPage.vueNodes.getWidgetByName(
        'Node With String Input',
        'string_input'
      )
      await widget.fill('temporary value')
      await expect(widget).toHaveValue('temporary value')
      await widget.fill('')
      await expect(widget).toHaveValue('')

      await comfyPage.menu.topbar.saveWorkflow('empty-widget-value')
      await comfyPage.menu.topbar.closeWorkflowTab('empty-widget-value')
      await comfyPage.page.keyboard.press('w')
      await comfyPage.menu.workflowsTab
        .getPersistedItem('empty-widget-value')
        .dblclick()
      await expect
        .poll(() => comfyPage.workflow.getActiveWorkflowPath())
        .toContain('empty-widget-value')
      await comfyPage.vueNodes.waitForNodes()

      await expect(
        comfyPage.vueNodes.getWidgetByName(
          'Node With String Input',
          'string_input'
        )
      ).toHaveValue('')
    })
  }
)
