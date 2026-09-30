import { expect } from '@playwright/test'

import {
  agentTwoSessionCrdtTest as test,
  emptySeed
} from '@e2e/fixtures/agentTwoSessionCrdtFixture'
import type {
  AgentBoundWorkflow,
  AgentTwoSessionCrdtHarness
} from '@e2e/fixtures/agentTwoSessionCrdtFixture'
import { loadAgentConversation } from '@e2e/fixtures/data/agent/agentConversation'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'

const WORKFLOW_A = { id: '11111111-1111-4111-8111-111111111111', name: 'Alpha' }
const WORKFLOW_B = { id: '22222222-2222-4222-8222-222222222222', name: 'Bravo' }

// The prompt the report's two threads were both given. The backend is mocked,
// so it only labels the turn; what the agent "builds" is BUILD_OPS below.
const BUILD_PROMPT = 'Build a basic text to image workflow'
// Three recorded add_node ops the backend really emitted. Landed in a workflow
// seeded empty, they make the canvas assertion structural: nodes exist at all.
const BUILD_OPS: RecordedGraphOperation[] = loadAgentConversation(
  'agent-rec-three-sequential-adds'
)
  .turns.flatMap((turn) => turn.response)
  .flatMap((entry) => (entry.kind === 'graph_ops' ? entry.ops : []))
// The three ids that recording adds, ascending. Literal so the expectation
// is checkable by hand; `hostNodeIds` is asserted against it on every arrange,
// which is what catches the recording drifting away from this list.
const BUILT_NODE_IDS = [
  '2478057798252548',
  '2514973844700532',
  '2772376668635982'
]

test.describe(
  'Agent build displaced by a second thread',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    /**
     * PM-1535: two agent threads, two tabs, each asked to build a workflow,
     * and the canvas the user lands on is empty while the agent reports the
     * workflow built. Alpha's build reaches Alpha's document, but by then
     * thread two holds the binding, so nothing is subscribed to Alpha and
     * clicking back to its tab does not resubscribe. Where PM-1319 showed a
     * stale widget value, the tab the user returns to has no nodes at all.
     *
     * Both tests assert the behaviour the app owes the user — the build on the
     * canvas — so neither has to be inverted when PM-1535 is fixed. The first
     * marks itself expected-to-fail only while the canvas is empty, so what it
     * pins today is that the build is still missing, while a canvas that fills
     * with the wrong nodes stays a real failure. The recovery case passes
     * already and proves the same build is reachable once a later turn binds
     * Alpha again.
     *
     * Two things this arrangement does not model. Thread one's turn is over
     * before its build lands, where the report had both threads working at
     * once; the inbound gate is stamped by workflow, not by thread, so both
     * routes leave the follower targeting Bravo and the tab return meets the
     * same state either way. And only Alpha is ever built, which keeps the
     * canvas unambiguous but leaves the report's SECOND empty canvas
     * unexplained. Current-main golden-path coverage separately proves a bound,
     * active tab materializes agent-added nodes, so this carrier does not
     * duplicate that case.
     */
    async function displacedBuild(
      twoSessionCrdt: AgentTwoSessionCrdtHarness
    ): Promise<AgentBoundWorkflow> {
      const alpha = twoSessionCrdt.addWorkflow(
        WORKFLOW_A.id,
        WORKFLOW_A.name,
        emptySeed()
      )
      const bravo = twoSessionCrdt.addWorkflow(
        WORKFLOW_B.id,
        WORKFLOW_B.name,
        emptySeed()
      )

      await twoSessionCrdt.boot()
      await twoSessionCrdt.runBoundTurn(`${BUILD_PROMPT} in Alpha`, alpha)
      await twoSessionCrdt.newChat()
      await twoSessionCrdt.runBoundTurn(`${BUILD_PROMPT} in Bravo`, bravo)

      // Alpha's build lands while Bravo is the tab on screen. Only Alpha's
      // document ever receives a node, so anything a canvas shows below can
      // only have come from Alpha.
      twoSessionCrdt.hostEdit(alpha, BUILD_OPS)
      expect(twoSessionCrdt.hostNodeIds(alpha)).toEqual(BUILT_NODE_IDS)
      expect(twoSessionCrdt.hostNodeIds(bravo)).toEqual([])
      await expect(twoSessionCrdt.vueNodes.nodes).toHaveCount(0)

      return alpha
    }

    test('returning to the displaced build shows it on the canvas', async ({
      twoSessionCrdt
    }) => {
      test.setTimeout(120_000)
      await displacedBuild(twoSessionCrdt)
      await twoSessionCrdt.topbar.getWorkflowTab(WORKFLOW_A.name).click()
      await expect(twoSessionCrdt.topbar.getActiveTab()).toContainText(
        WORKFLOW_A.name
      )

      const canvas = await twoSessionCrdt.canvasNodeIdsWhenSettled(
        BUILT_NODE_IDS,
        20_000
      )
      // KNOWN BUG (PM-1535): the follower's subscribe target is the session's
      // boundWorkflowId, still Bravo after thread two bound it, so returning to
      // Alpha unsubscribes rather than resubscribing and Alpha's build is never
      // projected. Only the empty canvas is expected: nodes that arrive but do
      // not match fail this outright, and once the follower resubscribes the
      // active tab's workflow the marker goes inert and can be deleted.
      test.fail(
        canvas.length === 0,
        'PM-1535: returning to Alpha does not resubscribe its document'
      )
      expect(canvas).toEqual(BUILT_NODE_IDS)
    })

    // The recovery the reporter found, and the proof that the build really is
    // in Alpha's document and reachable from this app: a turn that binds Alpha
    // again subscribes it, and the catch-up materializes everything the tab
    // return did not. This one passes today, and must keep passing.
    test('a later turn bound to the same workflow brings its build to the canvas', async ({
      twoSessionCrdt
    }) => {
      test.setTimeout(120_000)
      const alpha = await displacedBuild(twoSessionCrdt)

      await twoSessionCrdt.newChat()
      await twoSessionCrdt.runBoundTurn('What is on my canvas?', alpha)

      await expect
        .poll(() => twoSessionCrdt.canvasNodeIds(), { timeout: 20_000 })
        .toEqual(BUILT_NODE_IDS)
    })
  }
)
