import type { NodeReference } from 'browser_tests/fixtures/utils/litegraphUtils'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../../fixtures/ComfyPage'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('Vue Node Selection', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.vueNodes.waitForNodes()
  })

  const modifiers = [
    { key: 'Control', name: 'ctrl' },
    { key: 'Shift', name: 'shift' },
    { key: 'Meta', name: 'meta' }
  ] as const

  for (const { key: modifier, name } of modifiers) {
    test(`should allow selecting multiple nodes with ${name}+click`, async ({
      comfyPage
    }) => {
      await comfyPage.page.getByText('Load Checkpoint').click()
      expect(await comfyPage.vueNodes.getSelectedNodeCount()).toBe(1)

      await comfyPage.page.getByText('Empty Latent Image').click({
        modifiers: [modifier]
      })
      expect(await comfyPage.vueNodes.getSelectedNodeCount()).toBe(2)

      await comfyPage.page.getByText('KSampler').click({
        modifiers: [modifier]
      })
      expect(await comfyPage.vueNodes.getSelectedNodeCount()).toBe(3)
    })

    test(`should allow de-selecting nodes with ${name}+click`, async ({
      comfyPage
    }) => {
      await comfyPage.page.getByText('Load Checkpoint').click()
      expect(await comfyPage.vueNodes.getSelectedNodeCount()).toBe(1)

      await comfyPage.page.getByText('Load Checkpoint').click({
        modifiers: [modifier]
      })
      expect(await comfyPage.vueNodes.getSelectedNodeCount()).toBe(0)
    })
  }

  test('should select pinned node without dragging', async ({ comfyPage }) => {
    // Get a node and pin it
    const node = (await comfyPage.getFirstNodeRef()) as NodeReference
    await node.pin()

    // Verify it's pinned
    await expect(node).toBePinned()

    // Click the node
    await comfyPage.page.getByText('Load Checkpoint').click()

    // Should be selected
    expect(await comfyPage.vueNodes.getSelectedNodeCount()).toBe(1)

    // Get initial position
    const initialPos = await node.getPosition()

    // Try to drag the node (should not move)
    await comfyPage.dragAndDrop(
      { x: initialPos.x, y: initialPos.y - 15 },
      { x: initialPos.x + 100, y: initialPos.y + 100 }
    )

    // Position should remain the same
    const finalPos = await node?.getPosition()
    expect(finalPos.x).toBeCloseTo(initialPos.x, 0)
    expect(finalPos.y).toBeCloseTo(initialPos.y, 0)

    // Should still be selected
    expect(await comfyPage.vueNodes.getSelectedNodeCount()).toBe(1)
  })
})
