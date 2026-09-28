import { expect } from '@playwright/test'

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.describe(
  'Agent node selection chip removal',
  { tag: ['@cloud', '@canvas', '@node', '@screenshot'] },
  () => {
    // Source: https://linear.app/comfyorg/issue/PM-1227
    test.use({ objectInfo: 'server' })

    test('clears the canvas highlight when its reference chip is removed from the composer', async ({
      agentPanel,
      comfyPage
    }) => {
      test.setTimeout(30_000)

      const node = await test.step('Create one selectable node', async () => {
        await comfyPage.nodeOps.clearGraph()
        const node = await comfyPage.nodeOps.addNode('KSampler', undefined, {
          x: 400,
          y: 300
        })
        await comfyPage.nextFrame()
        return node
      })

      const panel = agentPanel.root
      await agentPanel.enterNodeSelectionMode()
      await comfyPage.canvasOps.waitForViewToSettle()
      const unselectedCanvas = await comfyPage.canvas.screenshot({
        mask: [panel]
      })

      await test.step('Select the node into the composer', async () => {
        const [{ x, y }, { width, height }] = await Promise.all([
          node.getPosition(),
          node.getSize()
        ])
        await comfyPage.canvasOps.mouseClickAt({
          x: x + width / 2,
          y: y + height / 2
        })

        await expect(
          panel.getByRole('button', {
            name: `Remove KSampler #${node.id} reference`
          })
        ).toBeVisible()
      })

      const removeButton = panel.getByRole('button', {
        name: `Remove KSampler #${node.id} reference`
      })

      await test.step('Remove the reference and clear its highlight', async () => {
        await removeButton.click()
        await expect(removeButton).toHaveCount(0)
        await expect
          .poll(() => comfyPage.canvas.screenshot({ mask: [panel] }))
          .toEqual(unselectedCanvas)
      })
    })
  }
)
