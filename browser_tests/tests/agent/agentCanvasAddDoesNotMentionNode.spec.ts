import { expect } from '@playwright/test'

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.describe(
  'Canvas additions beside an empty Agent composer',
  { tag: ['@cloud', '@agent', '@canvas', '@node'] },
  () => {
    // Regression source: PM-1583 / PM-1584 and
    // https://github.com/Comfy-Org/ComfyUI_frontend/pull/18400
    // Adding a node on the canvas must not be mistaken for the explicit
    // "Add to prompt" gesture.
    test.use({ objectInfo: 'server' })

    test('does not auto-mention a node added on the canvas', async ({
      agentPanel,
      comfyPage
    }) => {
      await comfyPage.nodeOps.clearGraph()
      await agentPanel.open()
      await agentPanel.selectWorkflow()

      await expect(agentPanel.composer).toBeEmpty()
      await expect(
        agentPanel.root.getByTestId('composer-node-section')
      ).toHaveCount(0)

      await comfyPage.nodeOps.addNode('KSampler', undefined, {
        x: 400,
        y: 300
      })
      await comfyPage.nextFrame()

      await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(1)
      await expect(agentPanel.composer).toBeEmpty()
      await expect(
        agentPanel.root.getByTestId('composer-node-section')
      ).toHaveCount(0)
    })
  }
)
