import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Subgraph output node ports',
  { tag: ['@subgraph', '@vue-nodes'] },
  () => {
    test('creates outputs by dragging to and from the trailing empty port', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/shared-definition-two-hosts-promoted-text'
      )
      await comfyPage.vueNodes.enterSubgraph('11')
      const { outputPorts, addOutputSocket } = comfyPage.subgraph
      const sampler = await comfyPage.nodeOps.getNodeRefByType('KSampler', true)
      const encoder = await comfyPage.nodeOps.getNodeRefByType(
        'CLIPTextEncode',
        true
      )

      await test.step('Drag from the empty port to an interior output', async () => {
        await expect(outputPorts).toHaveCount(0)
        await addOutputSocket.dragTo(
          comfyPage.vueNodes.getOutputSlotConnectionDot(String(sampler.id), 0)
        )
        await expect(outputPorts).toHaveCount(1)
        await expect(outputPorts.first()).toHaveAccessibleName('LATENT')
        await (await sampler.getOutput(0)).expectLinkCount(1)
      })

      await test.step('Drag from an interior output to the empty port', async () => {
        await comfyPage.vueNodes
          .getOutputSlotConnectionDot(String(encoder.id), 0)
          .dragTo(addOutputSocket)
        await expect(outputPorts).toHaveCount(2)
        await expect(outputPorts.nth(1)).toHaveAccessibleName('CONDITIONING')
        await (await encoder.getOutput(0)).expectLinkCount(1)
      })
    })
  }
)
