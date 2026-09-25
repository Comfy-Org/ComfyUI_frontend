import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

async function graphNodeCount(page: Page): Promise<number> {
  return page.evaluate(() => window.app!.graph.nodes.length)
}

test.describe('Agent edit undo/redo', { tag: ['@cloud', '@vue-nodes'] }, () => {
  test.use({ conversationCase: 'agent-rec-three-sequential-adds' })

  test('redo restores an agent edit that was just undone', async ({
    agentConversation,
    page
  }) => {
    test.setTimeout(90_000)
    await agentConversation.runTurns()

    const afterAgentEdit = await graphNodeCount(page)
    expect(afterAgentEdit).toBeGreaterThan(0)

    await page.locator('#graph-canvas').focus()
    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(() => graphNodeCount(page)).toBe(afterAgentEdit - 1)

    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect.poll(() => graphNodeCount(page)).toBe(afterAgentEdit)
  })
})
