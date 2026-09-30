import { expect } from '@playwright/test'

import {
  agentTwoSessionCrdtTest as test,
  emptySeed
} from '@e2e/fixtures/agentTwoSessionCrdtFixture'
import type {
  AgentBoundWorkflow,
  AgentTwoSessionCrdtHarness
} from '@e2e/fixtures/agentTwoSessionCrdtFixture'
import type { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
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

// Canvas order is the renderer's, not the document's, so both sides sort.
async function canvasNodeIds(vueNodes: VueNodeHelpers): Promise<string[]> {
  return (await vueNodes.getNodeIds()).sort()
}

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
     * The first two tests assert the current regression directly: Alpha is
     * selected and its host holds the build, but its visible canvas is empty.
     * The recovery case proves the same build is reachable after a later turn
     * binds Alpha again.
     *
     * Two things this arrangement does not model. Thread one's turn is over
     * before its build lands, where the report had both threads working at
     * once; the inbound gate is stamped by workflow, not by thread, so both
     * routes leave the follower targeting Bravo and the tab return meets the
     * same state either way. And only Alpha is ever built, which keeps the
     * canvas unambiguous but leaves the report's SECOND empty canvas
     * unexplained: the control above shows a bound, active tab does
     * materialize its build, so whatever emptied Bravo is not what emptied
     * Alpha, and PM-1535 is not fully covered until that is found.
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
      await twoSessionCrdt.runBoundTurn(BUILD_PROMPT, alpha)
      await twoSessionCrdt.newChat()
      await twoSessionCrdt.runBoundTurn(BUILD_PROMPT, bravo)

      // Alpha's build lands while Bravo is the tab on screen. Only Alpha's
      // document ever receives a node, so anything a canvas shows below can
      // only have come from Alpha.
      twoSessionCrdt.hostEdit(alpha, BUILD_OPS)
      expect(twoSessionCrdt.hostNodeIds(alpha)).toEqual(BUILT_NODE_IDS)
      expect(twoSessionCrdt.hostNodeIds(bravo)).toEqual([])

      // The checked tab and the follower's own activity gate read the same
      // workflowStore.activeWorkflow, so seeing Alpha checked is what rules
      // out a click the app never processed — without which "the canvas
      // filled" below could pass on an app that never heard it.
      await twoSessionCrdt.topbar.getWorkflowTab(WORKFLOW_A.name).click()
      await expect(twoSessionCrdt.topbar.getActiveTab()).toContainText(
        WORKFLOW_A.name
      )
      return alpha
    }

    test('returning to the displaced build leaves its selected canvas empty', async ({
      twoSessionCrdt
    }) => {
      test.setTimeout(120_000)
      await displacedBuild(twoSessionCrdt)

      await expect
        .poll(() => canvasNodeIds(twoSessionCrdt.vueNodes), { timeout: 20_000 })
        .toEqual([])
    })

    // KNOWN BUG, and a separate one from the tab return above: a reload leaves
    // the session with no binding at all until the next turn ack, so nothing
    // subscribes Alpha and its build never arrives. The persisted doc id does
    // not cover this — it is refused across a reload by design
    // (agentCrdtDocLifecycle's FEC-5 nonce, which must stay), and in this
    // arrangement it names Bravo anyway, the last doc to confirm a subscribe.
    // This is the reporter's "did not recover on refresh". It reaches that
    // state by its own path, but the tab-return and refresh cases stay separate
    // because either lifecycle can change without the other.
    test('refreshing the displaced build keeps its selected canvas empty', async ({
      twoSessionCrdt
    }) => {
      test.setTimeout(120_000)
      await displacedBuild(twoSessionCrdt)

      await twoSessionCrdt.reload()
      await expect(twoSessionCrdt.topbar.getActiveTab()).toContainText(
        WORKFLOW_A.name
      )

      await expect
        .poll(() => canvasNodeIds(twoSessionCrdt.vueNodes), { timeout: 20_000 })
        .toEqual([])
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
        .poll(() => canvasNodeIds(twoSessionCrdt.vueNodes), { timeout: 20_000 })
        .toEqual(BUILT_NODE_IDS)
    })
  }
)
