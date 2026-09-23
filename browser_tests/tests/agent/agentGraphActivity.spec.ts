import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { expect } from '@playwright/test'

// Recorded full-stack source: the agent adds three nodes at x=1845, 2165 and
// 2485, beyond the visible canvas. See the fixture provenance for cloud SHA,
// thread, message and raw-capture digest.
const SEQUENTIAL_CASE = 'agent-rec-three-sequential-adds'

test.describe(
  'Agent graph activity',
  { tag: ['@cloud', '@canvas', '@vue-nodes'] },
  () => {
    test.describe.configure({ timeout: 90_000 })
    test.use({ conversationCase: SEQUENTIAL_CASE })

    test(`recorded ${SEQUENTIAL_CASE} reports every added node and frames them only on request`, async ({
      agentConversation,
      page
    }) => {
      const added = agentConversation.addedNodeIds()
      expect(added).toHaveLength(3)

      await test.step('replay reports arrivals without moving the camera', async () => {
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

        // The minimap is the passive locator while the camera remains under the
        // user's control. Its accessible summary is renderer-owned and reports
        // the same scoped decorations painted on the canvas.
        const minimap = page.getByTestId('minimap-container')
        await expect(minimap).toBeVisible()
        await expect(minimap).toHaveAttribute(
          'aria-label',
          'Minimap. Highlighted nodes: 3'
        )

        const report = page.getByTestId('agent-graph-added-toast')
        await expect(report).toBeVisible()
        await expect(report).toContainText(
          'The agent added 3 nodes to the graph'
        )
      })

      await test.step('View nodes frames every added node', async () => {
        const report = page.getByTestId('agent-graph-added-toast')
        await report.getByRole('button', { name: /View nodes/i }).click()
        await expect
          .poll(() => agentConversation.nodesOutsideVisibleCanvas(added))
          .toEqual([])
      })
    })
  }
)
