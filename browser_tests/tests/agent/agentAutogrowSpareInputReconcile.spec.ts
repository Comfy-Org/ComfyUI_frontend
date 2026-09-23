import { autogrowTest as test } from '@e2e/fixtures/agentAutogrowSpareInputFixture'
import { expect } from '@playwright/test'

test.describe(
  'Agent CRDT autogrow node keeps a free slot across a tab switch',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test('keeps a free autogrow input on the graph after the switch', async ({
      autogrow
    }) => {
      await expect.poll(autogrow.readImageSlots).toEqual([
        { name: 'model.images.image_1', connected: true },
        { name: 'model.images.image_2', connected: false }
      ])
    })

    test('still draws the free autogrow slot on the node after the switch', async ({
      autogrow: { vueNodes, gptNodeId }
    }) => {
      await expect(vueNodes.getInputSlotRow(gptNodeId, 1)).toContainText(
        'image_2'
      )
    })
  }
)
