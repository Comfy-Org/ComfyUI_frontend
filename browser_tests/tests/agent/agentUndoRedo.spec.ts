import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// Source: https://linear.app/comfyorg/issue/PM-914
const THREE_ADDS_CASE = 'agent-rec-three-sequential-adds'

async function graphNodeCount(page: Page): Promise<number> {
  return page.evaluate(() => window.app!.graph.nodes.length)
}

test.describe('Agent edit undo/redo', { tag: ['@cloud', '@vue-nodes'] }, () => {
  test.use({ conversationCase: THREE_ADDS_CASE })

  test('redo restores an agent edit that was just undone', async ({
    agentConversation,
    page
  }) => {
    test.setTimeout(90_000)
    await agentConversation.runTurns()

    await expect
      .poll(() => graphNodeCount(page))
      .toBe(agentConversation.hostNodeIds().length)
    const afterAgentEdit = await graphNodeCount(page)
    expect(afterAgentEdit).toBeGreaterThan(0)

    const canvas = page.locator('#graph-canvas')
    await canvas.press('Control+KeyZ')
    await expect.poll(() => graphNodeCount(page)).not.toBe(afterAgentEdit)

    await canvas.press('Control+KeyY')
    await expect.poll(() => graphNodeCount(page)).toBe(afterAgentEdit)
  })
})
