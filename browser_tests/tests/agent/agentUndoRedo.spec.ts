import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// A single recorded turn that adds three nodes sequentially (a real cloud
// agent capture, replayed — see agentConversation.ts). Its shape is what
// makes it useful here: one agent-authored edit that changes an observable,
// cheap-to-poll signal (graph node count), isolated from any panel/composer
// UI state that undo/redo must not itself disturb.
const THREE_ADDS_CASE = 'agent-rec-three-sequential-adds'

async function graphNodeCount(page: Page): Promise<number> {
  return page.evaluate(() => window.app!.graph.nodes.length)
}

test.describe('Agent edit undo/redo', { tag: '@cloud' }, () => {
  test.use({ conversationCase: THREE_ADDS_CASE })

  // A user who undoes an agent-authored graph edit and then presses redo
  // (shortcut or the alternative Ctrl+Y-style binding) does not get the
  // edit back — the graph stays at the undone state.
  test('redo restores an agent edit that was just undone', async ({
    agentConversation,
    page
  }) => {
    test.setTimeout(90_000)
    await agentConversation.runTurns()

    const afterAgentEdit = await graphNodeCount(page)
    expect(afterAgentEdit).toBeGreaterThan(0)

    // Undo one of the agent's three add-node ops. This half is NOT the
    // reported defect and is asserted first, structurally, while a failure
    // here is still unexpected — it establishes that the agent's edit really
    // is on the undo stack before redo is exercised.
    await page.locator('#graph-canvas').click()
    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(() => graphNodeCount(page)).toBe(afterAgentEdit - 1)

    // Below is the known defect: redo (the standard shortcut) should restore
    // the node the undo above just removed, and does not.
    test.fail()
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect.poll(() => graphNodeCount(page)).toBe(afterAgentEdit)
  })
})
