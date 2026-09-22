import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

for (const renderer of [
  { name: 'LiteGraph', tag: ['@slow', '@subgraph', '@ui'] },
  { name: 'Vue', tag: ['@slow', '@subgraph', '@ui', '@vue-nodes'] }
]) {
  test.describe(
    `${renderer.name} promoted widget labels`,
    { tag: renderer.tag },
    () => {
      test('clearing a promoted label preserves its value after reopening', async ({
        comfyPage
      }) => {
        test.slow()
        await comfyPage.workflow.setupWorkflowsDirectory({})
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-text-widget'
        )
        const host = await comfyPage.nodeOps.getNodeRefById('11')
        await host.expectPromotedWidgetCount(0)

        await test.step('Promote and edit the text widget', async () => {
          await comfyPage.subgraph.editor.promoteWidget(host, {
            nodeName: 'CLIP Text Encode (Prompt)',
            widgetName: 'text'
          })
          await host.fillPromotedTextWidget(
            'text',
            'Value must not be cleared with the label'
          )
        })

        const identity = await comfyPage.subgraph.getHostIdentity(host)

        await test.step('Rename and clear the promoted label', async () => {
          await host.select()
          await comfyPage.menu.propertiesPanel.open()
          await comfyPage.menu.propertiesPanel.renameParameterLabel(
            'text',
            'Temporary promoted label'
          )
          await comfyPage.menu.propertiesPanel.clearParameterLabel(
            'Temporary promoted label',
            'text'
          )
        })

        const workflowName = `${renderer.name.toLowerCase()}-cleared-promoted-label`

        await test.step('Save and reopen the workflow', async () => {
          await comfyPage.workflow.saveWorkflow(workflowName)
          await expect(comfyPage.toast.toastErrors).toHaveCount(0)
          await comfyPage.workflow.reloadAndOpenPersistedWorkflow(workflowName)
        })

        await test.step('The host keeps its value without a custom label', async () => {
          const restored = await comfyPage.nodeOps.getNodeRefById('11')
          await comfyPage.subgraph.expectPromotedWidget(restored, 'text', {
            ...identity,
            label: null,
            value: 'Value must not be cleared with the label'
          })
          await restored.expectPromotedTextWidgetValue(
            'text',
            'Value must not be cleared with the label'
          )
          await expect(comfyPage.toast.toastErrors).toHaveCount(0)
        })
      })
    }
  )
}
