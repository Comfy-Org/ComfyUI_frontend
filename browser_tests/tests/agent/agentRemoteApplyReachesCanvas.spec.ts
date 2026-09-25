import { expect } from '@playwright/test'

import { agentTest as test } from '@e2e/fixtures/agentPanelFixture'
import {
  AGENT_NODE_IDS,
  addFiveLoadImageNodes,
  addLoadImageNode,
  deleteNode
} from '@e2e/fixtures/data/agent/agentRemoteApply'
import { AgentRemoteApplyHarness } from '@e2e/fixtures/helpers/AgentRemoteApplyHarness'

/**
 * The two golden paths that prove remote apply still reaches the canvas, and
 * still leaves it, after the graph-API remote-apply pivot (FE #18700).
 *
 * Source: `qa/user-story-test-matrix.md` ranks 25 and 10 in the in-app-agent
 * program repo -- `langfuse-19` ("add 5 load image nodes", a recurring prompt
 * whose `add_node` tool succeeded in 219 of 253 calls in the 2,635-turn
 * production corpus) and `langfuse-4` / `regr-20` ("the agent says it deleted
 * the nodes, or cleared the canvas, and they are still there", trace
 * `b275d6ab00eb8bb3dc838b8dc96f6dfe`).
 *
 * Both land GREEN: they are regression guards, not bug pins. They are worth
 * their place because nothing else in the suite asserts the plainest thing the
 * product does -- the agent says it added five nodes and five nodes are on the
 * canvas -- at the whole-batch granularity a user experiences. The existing
 * follower specs each pin one anomaly around a single node; a refactor that
 * quietly turned a five-op batch into a one-node canvas would pass all of them.
 *
 * Asserted as the DIFFERENCE the turn made to the rendered canvas, rather than
 * against a fixed total: what the tab holds before the follower's first
 * catch-up is the app's own starting graph, and pinning that number here would
 * make these specs fail for a reason that has nothing to do with the agent.
 *
 * Deliberately asserted on the canvas and the panel only: never the doc
 * projection, never the stores. The internals under
 * `src/workbench/extensions/agent/crdt/` that an older projection-shaped
 * assertion would have reached for are being deleted.
 */
test.describe(
  'Agent remote apply reaches the canvas',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test('GOLDEN PATH: "add 5 load image nodes" puts five nodes on the canvas', async ({
      page
    }) => {
      const agent = new AgentRemoteApplyHarness(page)
      await agent.setUp()
      await agent.openAndTarget()
      await agent.sendPrompt('add 5 load image nodes')
      await agent.hostSocket.waitForSubscribe()

      const before = await agent.settledCanvasNodeIds()
      // Precondition: none of the ids the agent is about to mint is already
      // rendered, so every one asserted below came from this turn.
      for (const nodeId of AGENT_NODE_IDS) {
        expect(before).not.toContain(String(nodeId))
      }

      agent.reportToolCall('add_node', 'call-add-five')
      agent.applyAndBroadcast(addFiveLoadImageNodes())
      agent.finishTurn('Added five Load Image nodes.')

      await agent.expectTurnReportedFinished()

      // The whole batch, not merely the first op: a partial apply that landed
      // one node and dropped four reads as success in the panel, and this is
      // the assertion that separates the two.
      for (const nodeId of AGENT_NODE_IDS) {
        await expect(agent.node(nodeId)).toBeVisible()
      }
      // ... and nothing else moved: the turn added exactly what it said.
      await expect
        .poll(() => agent.settledCanvasNodeIds())
        .toEqual([...before, ...AGENT_NODE_IDS.map(String)].sort())
    })

    test('GOLDEN PATH: a node the agent reports deleting is gone from the canvas', async ({
      page
    }) => {
      const agent = new AgentRemoteApplyHarness(page)
      await agent.setUp()
      await agent.openAndTarget()
      await agent.sendPrompt('add 5 load image nodes')
      await agent.hostSocket.waitForSubscribe()

      const before = await agent.settledCanvasNodeIds()
      agent.reportToolCall('add_node', 'call-add-five')
      agent.applyAndBroadcast(addFiveLoadImageNodes())
      for (const nodeId of AGENT_NODE_IDS) {
        await expect(agent.node(nodeId)).toBeVisible()
      }

      const [removed, ...kept] = AGENT_NODE_IDS
      agent.reportToolCall('delete_node', 'call-delete-one')
      agent.applyAndBroadcast([deleteNode(removed)])
      agent.finishTurn('Removed the first Load Image node.')

      await agent.expectTurnReportedFinished()

      // Reading the canvas straight back is the whole story: the reported
      // delete has to be absent from what the user can see, and the nodes it
      // did not name have to survive it.
      await expect(agent.node(removed)).toHaveCount(0)
      for (const nodeId of kept) {
        await expect(agent.node(nodeId)).toBeVisible()
      }
      await expect
        .poll(() => agent.settledCanvasNodeIds())
        .toEqual([...before, ...kept.map(String)].sort())
    })

    test('a reconnect replays the delta instead of duplicating the graph', async ({
      page
    }) => {
      const agent = new AgentRemoteApplyHarness(page)
      await agent.setUp()
      await agent.openAndTarget()
      await agent.sendPrompt('add 5 load image nodes')
      await agent.hostSocket.waitForSubscribe()

      agent.reportToolCall('add_node', 'call-add-five')
      agent.applyAndBroadcast(addFiveLoadImageNodes())
      agent.finishTurn('Added five Load Image nodes.')
      for (const nodeId of AGENT_NODE_IDS) {
        await expect(agent.node(nodeId)).toBeVisible()
      }
      const settled = await agent.settledCanvasNodeIds()

      // Source: rank 21 -- "reconnect or rapid tab switching duplicates the
      // graph or drops nodes", whose worst observed form is a whole
      // unconnected second copy layered over the original. KEEP-ALIVE #13 says
      // the recovery is a state-vector delta replay, never a wipe and never a
      // re-seed, and the user-visible consequence of getting that wrong is a
      // doubled canvas -- which is what this asserts, without reading a single
      // frame.
      const missedNodeId = 7_010_006
      await agent.reconnect([addLoadImageNode(missedNodeId, 5)])

      await expect(agent.node(missedNodeId)).toBeVisible()
      await expect
        .poll(() => agent.settledCanvasNodeIds())
        .toEqual([...settled, String(missedNodeId)].sort())
      for (const nodeId of AGENT_NODE_IDS) {
        await expect(agent.node(nodeId)).toHaveCount(1)
      }
    })
  }
)
