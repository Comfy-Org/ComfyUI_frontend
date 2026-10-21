import { expect } from '@playwright/test'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

// Source: Windows QA case R5 ("Agent sees the selected node"), reported in
// #comfy-agent-user-feedback on 2026-10-21. The case means node-tagging mode:
// a node picked into the composer is sent to the Agent as the turn's
// selection, while an ordinary canvas selection is not (PM-1583).
async function addNode(comfyPage: ComfyPage) {
  await comfyPage.nodeOps.clearGraph()
  // Left of the floating Agent panel, so its title stays clickable.
  const node = await comfyPage.nodeOps.addNode('KSampler', undefined, {
    x: 100,
    y: 150
  })
  await comfyPage.nextFrame()
  return node
}

function sentTurn(postedMessages: string[]) {
  return zAgentPostMessageRequest.parse(JSON.parse(postedMessages[0]))
}

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
      const node = await addNode(comfyPage)
      const chip = agentPanel.root.getByTestId('node-reference-chip')

      await agentPanel.enterNodeSelectionMode()
      await expect(chip).toHaveCount(0)
      // The body, not the title: selection mode fits the view and its banner
      // can cover the title, while widgets are inert in this mode.
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

      // Typed rather than filled: filling would replace the inline chip.
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
      const node = await addNode(comfyPage)

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
