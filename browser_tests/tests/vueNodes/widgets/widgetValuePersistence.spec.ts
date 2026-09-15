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

      await expect(
        comfyPage.vueNodes.getWidgetByName(
          'Node With String Input',
          'string_input'
        )
      ).toHaveValue('')
    })

    test('an emptied promoted text widget stays empty across a round-trip', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      const promotedTextbox = () =>
        comfyPage.vueNodes
          .getNodeLocator('11')
          .getByRole('textbox', { name: 'text' })

      async function roundTrip() {
        const serialized = await comfyPage.workflow.getExportedWorkflow()
        await comfyPage.workflow.loadGraphData(serialized)
        await comfyPage.vueNodes.waitForNodes()
      }

      const baseline = 'promoted value that must be cleared'
      await promotedTextbox().fill(baseline)
      await expect(promotedTextbox()).toHaveValue(baseline)

      await roundTrip()
      await expect(promotedTextbox()).toHaveValue(baseline)

      await promotedTextbox().fill('')
      await expect(promotedTextbox()).toHaveValue('')

      await roundTrip()
      await expect(promotedTextbox()).toHaveValue('')
    })
  }
)
