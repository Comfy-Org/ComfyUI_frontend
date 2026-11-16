import { expect } from '@playwright/test'

import {
  addNodeBesideAgentPanel,
  agentTest as test,
  sentTurn
} from '@e2e/tests/agent/agentPanelMocks'

test.describe(
  'Agent tagged node selection payload',
  { tag: ['@cloud', '@canvas', '@node'] },
  () => {
    test.use({ objectInfo: 'server' })

    test('sends the node picked in node selection mode as the turn selection', async ({
      agentPanel,
      comfyPage,
      postedMessages
    }) => {
      const node = await addNodeBesideAgentPanel(comfyPage, 'KSampler')
      const chip = agentPanel.root.getByTestId('node-reference-chip')

      await agentPanel.enterNodeSelectionMode()
      await expect(chip).toHaveCount(0)
      const [{ x, y }, { width, height }] = await Promise.all([
        node.getPosition(),
        node.getSize()
      ])
      await comfyPage.canvasOps.mouseClickAt({
        x: x + width / 2,
        y: y + height / 2
      })
      await expect(chip).toBeVisible()
      await expect(chip).toContainText(`#${node.id}`)

      await agentPanel.composer.click()
      await comfyPage.page.keyboard.press('End')
      await comfyPage.page.keyboard.type('what node is selected')
      await agentPanel.sendButton.click()

      await expect.poll(() => postedMessages).toHaveLength(1)
      expect(sentTurn(postedMessages).selection?.node_ids).toEqual([
        String(node.id)
      ])
    })

    test('does not send an ordinary canvas selection', async ({
      agentPanel,
      comfyPage,
      postedMessages
    }) => {
      const node = await addNodeBesideAgentPanel(comfyPage, 'KSampler')

      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await node.click('title')
      await expect
        .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
        .toEqual([node.id])
      await expect(
        agentPanel.root.getByTestId('node-reference-chip')
      ).toHaveCount(0)

      await agentPanel.sendMessage('what node is selected')

      await expect.poll(() => postedMessages).toHaveLength(1)
      expect(sentTurn(postedMessages).selection).toBeUndefined()
    })
  }
)
