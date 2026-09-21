import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('MiniMax RefMod schema-order wrappers @vue-nodes @widget', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('widgets/refmod_loader')
  })

  test('saving and reloading preserves values and unused-slot visibility', async ({
    comfyPage
  }) => {
    const mod = comfyPage.vueNodes.getWidgetByName(
      'RefMod Loader Compatibility',
      'mod_1'
    )
    const unused = comfyPage.vueNodes.getWidgetByName(
      'RefMod Loader Compatibility',
      'mod_8'
    )
    await expect(mod).toContainText('voice.refmod')
    await expect(unused).toBeHidden()

    const saved = await comfyPage.workflow.getExportedWorkflow()
    await comfyPage.workflow.loadGraphData(saved)

    const node = await comfyPage.nodeOps.getNodeRefByType(
      'DevToolsRefModLoader'
    )
    const selected = await node.getWidgetByName('mod_1')
    const strength = await node.getWidgetByName('strength_1')

    await expect.poll(() => selected.getValue()).toBe('voice.refmod')
    await expect.poll(() => strength.getValue()).toBe(0.65)
    await expect(unused).toBeHidden()
  })
})
