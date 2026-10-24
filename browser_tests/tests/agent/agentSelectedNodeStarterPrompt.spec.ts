import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  addNodeBesideAgentPanel,
  agentTest as test
} from '@e2e/tests/agent/agentPanelMocks'

test.describe(
  'Agent selected-node starter prompt',
  { tag: ['@cloud', '@canvas', '@node'] },
  () => {
    test.use({ objectInfo: 'server' })

    test('shows the selected-node prompt after a node is added to the composer', async ({
      agentPanel,
      comfyPage
    }) => {
      const node = await addNodeBesideAgentPanel(comfyPage, 'KSampler')
      const selectedNodePrompt = agentPanel.root.getByRole('button', {
        name: enMessages.agent.suggestedPrompts.cloud[2],
        exact: true
      })

      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await expect(selectedNodePrompt).toHaveCount(0)

      await agentPanel.enterNodeSelectionMode()
      const [{ x, y }, { width, height }] = await Promise.all([
        node.getPosition(),
        node.getSize()
      ])
      await comfyPage.canvasOps.mouseClickAt({
        x: x + width / 2,
        y: y + height / 2
      })

      await expect(selectedNodePrompt).toBeVisible()
    })
  }
)
