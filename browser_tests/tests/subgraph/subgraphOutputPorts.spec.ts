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
      const panel = comfyPage.page.getByTestId('subgraph-output-ports')
      const ports = panel.getByTestId('subgraph-output-port')
      const empty = panel
        .getByTestId('subgraph-add-output')
        .getByTestId('slot-connection-dot')
      const sampler = await comfyPage.nodeOps.getNodeRefByType('KSampler', true)
      const encoder = await comfyPage.nodeOps.getNodeRefByType(
        'CLIPTextEncode',
        true
      )

      await test.step('Drag from the empty port to an interior output', async () => {
        await expect(ports).toHaveCount(0)
        await empty.dragTo(
          comfyPage.vueNodes.getOutputSlotConnectionDot(String(sampler.id), 0)
        )
        await expect(ports).toHaveCount(1)
        await expect(ports.first()).toHaveAccessibleName('LATENT')
        await (await sampler.getOutput(0)).expectLinkCount(1)
      })

      await test.step('Drag from an interior output to the empty port', async () => {
        await comfyPage.vueNodes
          .getOutputSlotConnectionDot(String(encoder.id), 0)
          .dragTo(empty)
        await expect(ports).toHaveCount(2)
        await expect(ports.nth(1)).toHaveAccessibleName('CONDITIONING')
        await (await encoder.getOutput(0)).expectLinkCount(1)
      })
    })
  }
)
