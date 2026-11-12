import type { Locator } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Unified subgraph input node',
  { tag: ['@subgraph', '@vue-nodes'] },
  () => {
    test('creates and reconnects ports and drags their linked geometry with the node', async ({
      comfyPage,
      comfyMouse
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/shared-definition-two-hosts-promoted-text'
      )
      await comfyPage.vueNodes.enterSubgraph('11')
      const target = await comfyPage.nodeOps.getNodeRefById('10')
      const panel = comfyPage.page.getByTestId('subgraph-input-values')
      const empty = panel
        .getByTestId('subgraph-add-input')
        .getByTestId('slot-connection-dot')
      const input = await target.getInputByName('clip')
      const targetInput = comfyPage.vueNodes.getInputSlotConnectionDot(
        String(target.id),
        input.index
      )
      const clip = panel
        .getByTestId('subgraph-input-port')
        .and(panel.getByLabel('clip', { exact: true }))
        .getByTestId('slot-connection-dot')

      async function dragPort(source: Locator) {
        const from = await source.boundingBox()
        const to = await targetInput.boundingBox()
        if (!from || !to) throw new Error('Expected both socket controls')
        await comfyMouse.dragAndDrop(
          { x: from.x + from.width / 2, y: from.y + from.height / 2 },
          { x: to.x + to.width / 2, y: to.y + to.height / 2 }
        )
      }

      await test.step('Dragging the header moves the node and the connected port together', async () => {
        const before = await panel.boundingBox()
        if (!before) throw new Error('Expected the input node to be rendered')
        const slot = await comfyPage.subgraph.getInputSlot('clip').getPosition()
        await comfyMouse.dragAndDrop(
          { x: before.x + before.width - 6, y: before.y + 8 },
          { x: before.x + before.width + 34, y: before.y + 68 }
        )
        await expect
          .poll(async () => (await panel.boundingBox())?.x)
          .toBeCloseTo(before.x + 40, 0)
        await expect
          .poll(async () => (await panel.boundingBox())?.y)
          .toBeCloseTo(before.y + 60, 0)
        const moved = await comfyPage.subgraph
          .getInputSlot('clip')
          .getPosition()
        expect(moved.x).toBeCloseTo(slot.x + 40, 0)
        expect(moved.y).toBeCloseTo(slot.y + 60, 0)
      })

      await test.step('Dragging the node background also carries its linked port', async () => {
        const before = await panel.boundingBox()
        const body = await panel
          .getByTestId('subgraph-input-body')
          .boundingBox()
        if (!before || !body)
          throw new Error('Expected the input node and body to be rendered')
        const slot = await comfyPage.subgraph.getInputSlot('clip').getPosition()
        await comfyMouse.dragAndDrop(
          { x: body.x + 8, y: body.y + body.height - 6 },
          { x: body.x + 28, y: body.y + body.height + 24 }
        )
        await expect
          .poll(async () => (await panel.boundingBox())?.x)
          .toBeCloseTo(before.x + 20, 0)
        await expect
          .poll(async () => (await panel.boundingBox())?.y)
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

      await test.step('Drag the trailing empty slot to create a typed external input', async () => {
        await expect(panel.getByTestId('subgraph-input-port')).toHaveCount(6)
        await dragPort(empty)
        await expect(panel.getByTestId('subgraph-input-port')).toHaveCount(7)
        await expect(empty).toHaveCount(1)
        await expect
          .poll(() => input.getLink())
          .toMatchObject({
            origin_id: '-10',
            origin_slot: 6,
            target_id: target.id,
            target_slot: 1,
            type: 'CLIP'
          })
      })

      await test.step('An existing port connects to the same interior input', async () => {
        await dragPort(clip)
        await expect
          .poll(() => input.getLink())
          .toMatchObject({
            origin_id: '-10',
            origin_slot: 1,
            target_id: target.id,
            target_slot: 1,
            type: 'CLIP'
          })
        await expect(panel.getByTestId('subgraph-input-port')).toHaveCount(7)
      })
    })
  }
)
