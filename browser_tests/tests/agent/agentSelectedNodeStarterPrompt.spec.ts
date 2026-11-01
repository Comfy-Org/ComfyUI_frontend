import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  addNodeBesideAgentPanel,
  agentTest as test
} from '@e2e/tests/agent/agentPanelMocks'

test.describe(
  'Agent selected-node starter prompt',
  { tag: ['@agent-harness', '@canvas', '@node'] },
  () => {
    test.use({ objectInfo: 'server' })

    test('shows the selected-node prompt after a node is added to the composer', async ({
      agentPanel,
      comfyPage
    }) => {
      await addNodeBesideAgentPanel(comfyPage, 'KSampler')
      const selectedNode = await comfyPage.nodeOps.addNode(
        'VAEDecode',
        undefined,
        { x: 100, y: 450 }
      )
      await comfyPage.nextFrame()
      const selectedNodePrompt = agentPanel.root.getByRole('button', {
        name: enMessages.agent.suggestedPrompts.local[2],
        exact: true
      })

      await agentPanel.consentRejectButton.click()
      await expect(agentPanel.consentDialog).toBeHidden()
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await expect(
        agentPanel.root.getByRole('button', {
          name: enMessages.agent.suggestedPrompts.local[0],
          exact: true
        })
      ).toBeVisible()
      await expect(selectedNodePrompt).toHaveCount(0)

      await agentPanel.composer.fill('@')
      await agentPanel.root
        .getByRole('menuitem', { name: enMessages.agent.nodes, exact: true })
        .click()
      await agentPanel.root
        .getByRole('menuitem', {
          name: 'KSampler',
          exact: true
        })
        .click()
      await expect(selectedNodePrompt).toHaveCount(0)

      await agentPanel.enterNodeSelectionMode()
      const [{ x, y }, { width, height }] = await Promise.all([
        selectedNode.getPosition(),
        selectedNode.getSize()
      ])
      await comfyPage.canvasOps.mouseClickAt({
        x: x + width / 2,
        y: y + height / 2
      })

      await expect(selectedNodePrompt).toBeVisible()
    })
  }
)
