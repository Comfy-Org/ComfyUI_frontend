import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'

import { agentTwoSessionCrdtTest as test } from '@e2e/fixtures/agentTwoSessionCrdtFixture'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import type { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
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
  }
)
