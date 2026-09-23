import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'

import {
  agentTwoSessionCrdtTest as test,
  emptySeed
} from '@e2e/fixtures/agentTwoSessionCrdtFixture'
import type {
  AgentBoundWorkflow,
  AgentTwoSessionCrdtHarness
} from '@e2e/fixtures/agentTwoSessionCrdtFixture'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import type { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { loadAgentConversation } from '@e2e/fixtures/data/agent/agentConversation'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'

// The seed KSampler; its cfg widget is a number so a doc edit is a value on
// the canvas, not a structural change.
const KSAMPLER_ID = '3'
const SEED_CFG = 7
const EDITED_CFG = 5
const HUMAN_CFG = 9

const WORKFLOW_A = { id: '11111111-1111-4111-8111-111111111111', name: 'Alpha' }
const WORKFLOW_B = { id: '22222222-2222-4222-8222-222222222222', name: 'Bravo' }

const setCfg = (value: number): RecordedGraphOperation[] => [
  { op: 'set_widget', node_id: 3, widget: 'cfg', old: SEED_CFG, value }
]

// The prompt the report's two threads were both given. The backend is mocked,
// so it only labels the turn; what the agent "builds" is BUILD_OPS below.
const BUILD_PROMPT = 'Build a basic text to image workflow'
// Three recorded add_node ops the backend really emitted — unconnected nodes,
// not a wired graph, but real payloads the applier and the materializer
// accept. Landed in a workflow seeded empty, they make the canvas assertion
// structural: nodes exist at all, which is what PM-1535 is about.
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

async function cfgValue(node: Locator): Promise<number> {
  const input = node.getByLabel('cfg', { exact: true }).locator('input')
  return Number(await input.first().inputValue())
}

// A human widget edit on the active tab's KSampler, typed into the real number
// widget and committed, so it flows through the widget store and the agent mint
// port exactly as a user's edit would.
async function editCfg(vueNodes: VueNodeHelpers, value: number): Promise<void> {
  const input = vueNodes
    .getNodeLocator(KSAMPLER_ID)
    .getByLabel('cfg', { exact: true })
    .locator('input')
    .first()
  // ScrubableNumberInput commits on blur; fill focuses without a pointer click,
  // so the drag-scrub overlay never intercepts.
  await input.fill(String(value))
  await input.blur()
}

test.describe(
  'Agent CRDT follower across two bound workflows',
  { tag: ['@cloud', '@agent'] },
  () => {
    // Two agent threads, opened through the composer like a user would, target
    // two workflow tabs. After the second thread binds, returning to the first
    // tab must resubscribe its doc and show the edit that finished while it was
    // away — without waiting for the first thread's next turn.
    test('returning to the first session tab shows the edit made while away', async ({
      twoSessionCrdt,
      page
    }) => {
      test.setTimeout(120_000)
      const topbar = new Topbar(page)
      const a = twoSessionCrdt.addWorkflow(WORKFLOW_A.id, WORKFLOW_A.name)
      const b = twoSessionCrdt.addWorkflow(WORKFLOW_B.id, WORKFLOW_B.name)

      await twoSessionCrdt.boot()

      await test.step('thread one binds workflow Alpha', async () => {
        const one = await twoSessionCrdt.startThread('Open Alpha')
        await twoSessionCrdt.bindViaActiveTab(one, a)
        const ksampler = twoSessionCrdt.vueNodes.getNodeLocator(KSAMPLER_ID)
        await expect(ksampler).toBeVisible()
        await expect.poll(() => cfgValue(ksampler)).toBe(SEED_CFG)
        await twoSessionCrdt.finishTurn(one)
      })

      await test.step('thread two binds workflow Bravo', async () => {
        await twoSessionCrdt.newChat()
        const two = await twoSessionCrdt.startThread('Open Bravo')
        await twoSessionCrdt.bindViaActiveTab(two, b)
        await expect(topbar.getActiveTab()).toContainText(WORKFLOW_B.name)
        await twoSessionCrdt.finishTurn(two)
      })

      await test.step('Alpha is edited while Bravo is on screen', async () => {
        twoSessionCrdt.hostEdit(a, setCfg(EDITED_CFG))
        // The edit landed in Alpha's doc and did not leak onto Bravo's canvas.
        expect(twoSessionCrdt.hostWidgetValue(a, KSAMPLER_ID, 'cfg')).toBe(
          EDITED_CFG
        )
        const bravoKsampler =
          twoSessionCrdt.vueNodes.getNodeLocator(KSAMPLER_ID)
        await expect(bravoKsampler).toBeVisible()
        await expect.poll(() => cfgValue(bravoKsampler)).toBe(SEED_CFG)
      })

      await test.step('user returns to Alpha', async () => {
        await topbar.getWorkflowTab(WORKFLOW_A.name).click()
        await expect(topbar.getActiveTab()).toContainText(WORKFLOW_A.name)
        await expect(
          twoSessionCrdt.vueNodes.getNodeLocator(KSAMPLER_ID)
        ).toBeVisible()
      })

      // KNOWN BUG: the follower's subscribe target is the session's
      // boundWorkflowId, still Bravo after thread two bound it. Returning to
      // Alpha's tab does not re-derive the target from the active tab, so Alpha
      // never resubscribes and keeps the pre-edit cfg until its own thread's
      // next turn ack. Remove this test.fail once the follower resubscribes the
      // active tab's workflow on return.
      test.fail()
      const ksampler = twoSessionCrdt.vueNodes.getNodeLocator(KSAMPLER_ID)
      await expect
        .poll(() => cfgValue(ksampler), { timeout: 20_000 })
        .toBe(EDITED_CFG)
    })

    // Control for the write path: a human widget edit on a workflow that is
    // both bound and active mints an op and the sender delivers it to that
    // workflow's doc. This is the behaviour that breaks once the active tab and
    // the bound workflow disagree; if this control ever stops passing the bug
    // test below proves nothing.
    test('a human edit on the bound active tab reaches its doc', async ({
      twoSessionCrdt
    }) => {
      test.setTimeout(120_000)
      const a = twoSessionCrdt.addWorkflow(WORKFLOW_A.id, WORKFLOW_A.name)

      await twoSessionCrdt.boot()
      const one = await twoSessionCrdt.startThread('Open Alpha')
      await twoSessionCrdt.bindViaActiveTab(one, a)
      await twoSessionCrdt.finishTurn(one)
      const ksampler = twoSessionCrdt.vueNodes.getNodeLocator(KSAMPLER_ID)
      await expect(ksampler).toBeVisible()
      await expect.poll(() => cfgValue(ksampler)).toBe(SEED_CFG)

      const before = twoSessionCrdt.docOpsCount(WORKFLOW_A.id, 'set_widget')
      await editCfg(twoSessionCrdt.vueNodes, HUMAN_CFG)
      await expect
        .poll(() => twoSessionCrdt.docOpsCount(WORKFLOW_A.id, 'set_widget'), {
          timeout: 20_000
        })
        .toBeGreaterThan(before)
      // The host applied it, so the roundtrip is real, not just a frame count.
      await expect
        .poll(() => twoSessionCrdt.hostWidgetValue(a, KSAMPLER_ID, 'cfg'))
        .toBe(HUMAN_CFG)
    })

    // Switching between agent-synced workflow tabs leaves the mint port bound
    // to a workflow other than the active tab, so a node operation on the tab
    // the user is actually looking at is never minted — it reaches neither the
    // active workflow's doc nor the bound one's.
    test('a human edit on the returned-to tab is dropped, never reaching its doc', async ({
      twoSessionCrdt,
      page
    }) => {
      test.setTimeout(120_000)
      const topbar = new Topbar(page)
      const a = twoSessionCrdt.addWorkflow(WORKFLOW_A.id, WORKFLOW_A.name)
      const b = twoSessionCrdt.addWorkflow(WORKFLOW_B.id, WORKFLOW_B.name)

      await twoSessionCrdt.boot()
      const one = await twoSessionCrdt.startThread('Open Alpha')
      await twoSessionCrdt.bindViaActiveTab(one, a)
      await twoSessionCrdt.finishTurn(one)
      await twoSessionCrdt.newChat()
      const two = await twoSessionCrdt.startThread('Open Bravo')
      await twoSessionCrdt.bindViaActiveTab(two, b)
      await expect(topbar.getActiveTab()).toContainText(WORKFLOW_B.name)
      await twoSessionCrdt.finishTurn(two)

      await topbar.getWorkflowTab(WORKFLOW_A.name).click()
      await expect(topbar.getActiveTab()).toContainText(WORKFLOW_A.name)
      const ksampler = twoSessionCrdt.vueNodes.getNodeLocator(KSAMPLER_ID)
      await expect(ksampler).toBeVisible()
      await expect.poll(() => cfgValue(ksampler)).toBe(SEED_CFG)

      const beforeAlpha = twoSessionCrdt.docOpsCount(
        WORKFLOW_A.id,
        'set_widget'
      )
      const beforeBravo = twoSessionCrdt.docOpsCount(
        WORKFLOW_B.id,
        'set_widget'
      )

      // The edit itself succeeds on screen, whatever the sync layer does with it.
      await editCfg(twoSessionCrdt.vueNodes, HUMAN_CFG)
      await expect.poll(() => cfgValue(ksampler)).toBe(HUMAN_CFG)
      // The op coalescer flushes on a microtask, so a frame misrouted to Bravo
      // would already be on the wire by now; a hard assertion is sufficient.
      expect(twoSessionCrdt.docOpsCount(WORKFLOW_B.id, 'set_widget')).toBe(
        beforeBravo
      )

      // KNOWN BUG: Alpha is the active, on-screen tab, but the session is still
      // bound to Bravo, so the mint gate is closed for Alpha and the edit never
      // reaches Alpha's doc. Remove this test.fail once the active tab's
      // workflow is the one edits are minted against.
      test.fail()
      await expect
        .poll(() => twoSessionCrdt.docOpsCount(WORKFLOW_A.id, 'set_widget'), {
          timeout: 20_000
        })
        .toBeGreaterThan(beforeAlpha)
    })

    // Control for the read path from an empty canvas: a build the agent lands
    // in the doc of the tab that is both bound and on screen materializes
    // there, over a live doc_update on a subscription that already exists.
    // Its counterpart for the catch-up path the displaced tests need is the
    // third test below, which drives a real resubscribe and passes today.
    test('a build the agent lands on the bound active tab appears on its canvas', async ({
      twoSessionCrdt
    }) => {
      test.setTimeout(120_000)
      const a = twoSessionCrdt.addWorkflow(
        WORKFLOW_A.id,
        WORKFLOW_A.name,
        emptySeed()
      )

      await twoSessionCrdt.boot()
      const one = await twoSessionCrdt.startThread(BUILD_PROMPT)
      await twoSessionCrdt.bindViaActiveTab(one, a)
      await expect(twoSessionCrdt.topbar.getActiveTab()).toContainText(
        WORKFLOW_A.name
      )
      await expect(twoSessionCrdt.vueNodes.nodes).toHaveCount(0)

      twoSessionCrdt.hostEdit(a, BUILD_OPS)
      expect(twoSessionCrdt.hostNodeIds(a)).toEqual(BUILT_NODE_IDS)
      await twoSessionCrdt.finishTurn(one)

      await expect
        .poll(() => canvasNodeIds(twoSessionCrdt.vueNodes), { timeout: 20_000 })
        .toEqual(BUILT_NODE_IDS)
    })

    /**
     * PM-1535: two agent threads, two tabs, each asked to build a workflow,
     * and the canvas the user lands on is empty while the agent reports the
     * workflow built. Alpha's build reaches Alpha's document, but by then
     * thread two holds the binding, so nothing is subscribed to Alpha and
     * clicking back to its tab does not resubscribe. Where PM-1319 showed a
     * stale widget value, the tab the user returns to has no nodes at all.
     *
     * Each test below arranges that state and then asserts the build IS on
     * the canvas — on return, after a refresh, and after the next turn bound
     * to that workflow. The first two are marked test.fail, so what they pin
     * is that the build is still missing; only the third passes today. Note
     * what that idiom cannot see: an expected failure is satisfied by any
     * canvas that is not the built one, so a regression projecting the WRONG
     * nodes onto Alpha would keep these green until the markers come off.
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

    // KNOWN BUG: the follower's subscribe target is the session's
    // boundWorkflowId, still Bravo after thread two bound it, so returning to
    // Alpha unsubscribes rather than resubscribing and Alpha's build is never
    // projected. Remove this test.fail once the follower subscribes the active
    // tab's workflow on return.
    test('the build displaced by a second thread appears when the user returns to its tab', async ({
      twoSessionCrdt
    }) => {
      test.setTimeout(120_000)
      await displacedBuild(twoSessionCrdt)

      test.fail()
      await expect
        .poll(() => canvasNodeIds(twoSessionCrdt.vueNodes), { timeout: 20_000 })
        .toEqual(BUILT_NODE_IDS)
    })

    // KNOWN BUG, and a separate one from the tab return above: a reload leaves
    // the session with no binding at all until the next turn ack, so nothing
    // subscribes Alpha and its build never arrives. The persisted doc id does
    // not cover this — it is refused across a reload by design
    // (agentCrdtDocLifecycle's FEC-5 nonce, which must stay), and in this
    // arrangement it names Bravo anyway, the last doc to confirm a subscribe.
    // This is the reporter's "did not recover on refresh". It reaches that
    // state by its own path, but a fix that derives the subscribe target from
    // the active agent-bound tab rather than from the session could well close
    // both this and the tab return at once — so whoever removes either
    // test.fail should re-run the other before assuming it still fails.
    test('the displaced build survives a refresh of its tab', async ({
      twoSessionCrdt
    }) => {
      test.setTimeout(120_000)
      await displacedBuild(twoSessionCrdt)

      await twoSessionCrdt.reload()
      await expect(twoSessionCrdt.topbar.getActiveTab()).toContainText(
        WORKFLOW_A.name
      )

      test.fail()
      await expect
        .poll(() => canvasNodeIds(twoSessionCrdt.vueNodes), { timeout: 20_000 })
        .toEqual(BUILT_NODE_IDS)
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
