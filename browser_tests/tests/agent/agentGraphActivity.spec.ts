import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// Recorded full-stack source: the agent adds three nodes at x=1845, 2165 and
// 2485, beyond the visible canvas. See the fixture provenance for cloud SHA,
// thread, message and raw-capture digest.
const SEQUENTIAL_CASE = 'agent-rec-three-sequential-adds'

test.describe('Agent graph activity', { tag: ['@cloud', '@canvas'] }, () => {
  test.use({ conversationCase: SEQUENTIAL_CASE })

  test(`recorded ${SEQUENTIAL_CASE} reports every added node and frames them only on request`, async ({
    agentConversation,
    page
  }) => {
    test.setTimeout(90_000)
    const added = agentConversation.addedNodeIds()
    expect(added).toHaveLength(3)

    const before = await page.evaluate(() => {
      const { ds } = window.app!.canvas
      return { scale: ds.scale, offset: [...ds.offset] }
    })

    await agentConversation.runTurns()

    // Agent writes never move the user's camera implicitly.
    expect(
      await page.evaluate(() => {
        const { ds } = window.app!.canvas
        return { scale: ds.scale, offset: [...ds.offset] }
      })
    ).toEqual(before)
    expect(
      await agentConversation.nodesOutsideVisibleCanvas(added)
    ).not.toEqual([])

    const report = page.getByTestId('agent-graph-added-toast')
    await expect(report).toBeVisible()
    await expect(report).toContainText('The agent added 3 nodes to the graph')

    await report.getByRole('button', { name: /View nodes/i }).click()
    await expect
      .poll(() => agentConversation.nodesOutsideVisibleCanvas(added))
      .toEqual([])
  })
})
