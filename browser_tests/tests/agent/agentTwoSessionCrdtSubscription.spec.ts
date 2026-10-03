import { expect } from '@playwright/test'

import { agentTwoSessionCrdtTest as test } from '@e2e/fixtures/agentTwoSessionCrdtFixture'
import type {
  AgentBoundWorkflow,
  AgentTwoSessionCrdtHarness
} from '@e2e/fixtures/agentTwoSessionCrdtFixture'
import { loadAgentConversation } from '@e2e/fixtures/data/agent/agentConversation'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import { emptySeed } from '@e2e/fixtures/data/agent/agentRemoteApply'

const WORKFLOW_A = { id: '11111111-1111-4111-8111-111111111111', name: 'Alpha' }
const WORKFLOW_B = { id: '22222222-2222-4222-8222-222222222222', name: 'Bravo' }

const BUILD_PROMPT = 'Build a basic text to image workflow'
const SETTLE_TIMEOUT = 20_000

const BUILD_OPS: RecordedGraphOperation[] = loadAgentConversation(
  'agent-rec-three-sequential-adds'
)
  .turns.flatMap((turn) => turn.response)
  .flatMap((entry) => (entry.kind === 'graph_ops' ? entry.ops : []))
const BUILT_NODE_IDS = [
  '2478057798252548',
  '2514973844700532',
  '2772376668635982'
]

test.describe(
  'Agent build displaced by a second thread',
  { tag: ['@cloud', '@agent', '@vue-nodes', '@slow'] },
  () => {
    test.describe.configure({ timeout: 120_000 })

    /**
     * PM-1535: thread one's build reaches Alpha's document, but thread two
     * holds the binding by then, so nothing is subscribed to Alpha and
     * returning to its tab shows an empty canvas.
     *
     * Scope: only Alpha is ever built, so the report's second empty canvas is
     * out of scope and still unexplained.
     */
    async function displacedBuild(
      twoSessionCrdt: AgentTwoSessionCrdtHarness
    ): Promise<AgentBoundWorkflow> {
      const alpha = twoSessionCrdt.addWorkflow(
        WORKFLOW_A.id,
        WORKFLOW_A.name,
        emptySeed
      )
      const bravo = twoSessionCrdt.addWorkflow(
        WORKFLOW_B.id,
        WORKFLOW_B.name,
        emptySeed
      )

      await test.step('thread one binds Alpha', async () => {
        await twoSessionCrdt.boot()
        await twoSessionCrdt.runBoundTurn(`${BUILD_PROMPT} in Alpha`, alpha)
      })

      await test.step('thread two binds Bravo, displacing Alpha', async () => {
        await twoSessionCrdt.newChat()
        await twoSessionCrdt.runBoundTurn(`${BUILD_PROMPT} in Bravo`, bravo)
      })

      await test.step("thread one's build lands while Bravo is on screen", () => {
        twoSessionCrdt.hostEdit(alpha, BUILD_OPS)
      })

      return alpha
    }

    test('returning to the displaced build shows it on the canvas', async ({
      twoSessionCrdt
    }) => {
      await displacedBuild(twoSessionCrdt)

      await test.step('user clicks back to Alpha', async () => {
        await twoSessionCrdt.topbar.getWorkflowTab(WORKFLOW_A.name).click()
        await expect(twoSessionCrdt.topbar.getActiveTab()).toContainText(
          WORKFLOW_A.name
        )
      })

      const canvas = await twoSessionCrdt.canvasNodeIdsWhenSettled(
        BUILT_NODE_IDS,
        SETTLE_TIMEOUT
      )
      // Anything other than "empty" or "the build" is a different defect and
      // fails here, before the marker below can absorb it.
      expect([[], BUILT_NODE_IDS]).toContainEqual(canvas)
      // KNOWN BUG (PM-1535): the follower's subscribe target is the session's
      // boundWorkflowId, still Bravo after thread two bound it, so returning
      // to Alpha unsubscribes rather than resubscribing. The marker is
      // unconditional on purpose: when the fix lands this reports an
      // unexpected pass, which is the signal to delete this test.fail call
      // and the toContainEqual guard, leaving the final assertion.
      test.fail(
        true,
        'PM-1535: returning to Alpha does not resubscribe its document'
      )
      expect(canvas).toEqual(BUILT_NODE_IDS)
    })

    // The recovery the reporter found, and the proof that the build really is
    // in Alpha's document and reachable from this app.
    test('a later turn bound to the same workflow brings its build to the canvas', async ({
      twoSessionCrdt
    }) => {
      const alpha = await displacedBuild(twoSessionCrdt)

      await test.step('a later turn rebinds Alpha', async () => {
        await twoSessionCrdt.newChat()
        await twoSessionCrdt.runBoundTurn('What is on my canvas?', alpha)
      })

      await expect
        .poll(() => twoSessionCrdt.canvasNodeIds(), {
          timeout: SETTLE_TIMEOUT
        })
        .toEqual(BUILT_NODE_IDS)
    })
  }
)
