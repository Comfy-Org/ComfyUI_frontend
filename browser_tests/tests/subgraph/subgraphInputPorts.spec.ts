import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Unified subgraph input node',
  { tag: ['@subgraph', '@vue-nodes'] },
  () => {
    test('moves the input node with its linked port when dragged by a label row', async ({
      comfyPage,
      comfyMouse
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/shared-definition-two-hosts-promoted-text'
      )
      await comfyPage.vueNodes.enterSubgraph('11')
      const target = await comfyPage.nodeOps.getNodeRefById('10')
      const input = await target.getInputByName('clip')
      const { inputPanel } = comfyPage.subgraph

      await test.step('Dragging the clip label row moves the node, its port and its link together', async () => {
        const before = await inputPanel.boundingBox()
        if (!before) throw new Error('Expected the input node')
        const slot = await comfyPage.subgraph.getInputSlot('clip').getPosition()
        await comfyMouse.dragElementBy(
          inputPanel.getByText('clip', { exact: true }),
          { x: 20, y: 30 }
        )
        await expect
          .poll(async () => (await inputPanel.boundingBox())?.x)
          .toBeCloseTo(before.x + 20, 0)
        await expect
          .poll(async () => (await inputPanel.boundingBox())?.y)
          .toBeCloseTo(before.y + 30, 0)
        const moved = await comfyPage.subgraph
          .getInputSlot('clip')
          .getPosition()
        expect(moved.x).toBeCloseTo(slot.x + 20, 0)
        expect(moved.y).toBeCloseTo(slot.y + 30, 0)
        await expect
          .poll(() => input.getLink())
          .toMatchObject({
            origin_id: '-10',
            origin_slot: 1,
            target_id: target.id,
            target_slot: 1
          })
      })
    })
  }
)
