import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import type { AgentConversationHarness } from '@e2e/fixtures/agentConversationFixture'
import { ComfyActionbar } from '@e2e/fixtures/components/Actionbar'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

/**
 * The color and title specs below share one root cause: whenever a follower
 * session is (re)bound (`EcsFollowerAdapter.bind`, ecsFollowerAdapter.ts),
 * the very next doc frame it applies is forced through a full reconcile
 * (`reconcileNextFrame`), which replays the CRDT doc's own snapshot over the
 * live node with no "is this field newer locally" check anywhere in
 * graphMutations.ts. Returning to a workflow tab (inactive -> active) is the
 * confirmed trigger for that rebind — see agentTabSwitchCatchUp.spec.ts,
 * whose "second follower subscribe" is exactly this rebind.
 *
 * Color is fixed, robustly, in `graphMutations.ts`'s `prepareNode`: a
 * reconcile now merges onto the live node's color instead of always
 * resetting it, and the doc never carries color at all, so this holds
 * regardless of what else has or hasn't reset a node's live state. Unit-level
 * proof: `graphMutations.test.ts`'s "keeps a locally set node color...".
 *
 * Title's fix (comparing the doc's title against the node's last-synced doc
 * baseline, `resolveNodeTitle`) only holds within a session — it does NOT
 * survive a full workflow-tab reload of a node that predates the current
 * reconcile, because `LGraph.clear()` (called by `configure()`, which
 * returning to a tab triggers) tears each node down individually before any
 * store-level hook could preserve its baseline. That gap is intentionally
 * left as a known repro below (see agentNodeMaterializer.test.ts's own
 * `it.fails` case for the same gap at the unit level). Unit-level proof of
 * the in-session case: `graphMutations.test.ts`'s "keeps a locally renamed
 * title...".
 *
 * The widget-overwrite spec at the bottom of this file is a *different*
 * mechanism, not a third symptom of the reconcile root cause above: it never
 * goes through a follower rebind at all. It replays an agent turn's
 * `set_widget` while the target widget is focused — a plain
 * local-edit-vs-remote-write collision on the incremental `setWidget` path
 * in `graphMutations.ts`. Since PM-1191/PM-1697 that path consults the same
 * `skipStaleReconcile` local-dirty guard a full reconcile does: a remote
 * value that differs from an in-progress local edit is skipped until the
 * document catches up to the local value, so the user's keystrokes survive.
 */

// Five wired nodes (checkpoint -> CLIPTextEncode -> KSampler -> VAEDecode ->
// SaveImage). The recorded turn only ever touches the KSampler's steps/cfg,
// so node 6 ("Positive prompt") is free for these tests to color or rename
// without racing the agent's own edit.
const UNTOUCHED_CASE = 'agent-rec-set-widget-existing'
const UNTOUCHED_NODE_ID = '6'

// Turn 0 adds a brand new CLIPTextEncode node; turn 1 sets that same node's
// `text` widget. A user typing into the freshly added (empty) widget while
// turn 1 lands is exactly the widget-overwrite-mid-edit scenario.
const ADD_THEN_SET_CASE = 'agent-rec-add-set-delete'
const ADDED_NODE_ID = '2785690574723683'

// Real product opt-in for the CRDT debug instrument (crdtDebugGate.ts), not
// test-only furniture — the same keys `agentDebugPanel.spec.ts` sets. Turning
// it on surfaces `useAgentCrdtFollower`'s own `status.outcomes` counters in
// the DOM, which is the browser-side apply/reconcile signal below.
async function enableCrdtDebugPanel(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('Comfy.Agent.CrdtDebug.enabled', 'true')
    localStorage.setItem('Comfy.Agent.CrdtDevPanel.open', 'true')
  })
}

/**
 * Reads `status.outcomes.applied` off the CRDT debug panel's "outcomes" row.
 * That counter rises inside `useAgentCrdtFollower.ts`'s `applyAndReconcile`
 * only after `projection.applyFrame` has merged the frame into the stores
 * AND `projection.reconcileLiveGraph` has run for it — the actual apply +
 * reconcile boundary, as opposed to `subscribeCount()`, which rises in the
 * mock host the instant it calls `socket.send`, before the browser has even
 * received the frame.
 */
async function appliedFrameCount(page: Page): Promise<number> {
  const outcomesCell = page
    .locator('[data-testid="crdt-dev-panel"] tr', { hasText: 'outcomes' })
    .locator('td')
    .nth(1)
  const applied = Number.parseInt(
    (await outcomesCell.innerText()).split('/')[1] ?? '',
    10
  )
  // Used as an expect.poll callback: a transient unparseable render (the
  // panel cell not yet in its `x/y` shape) must let the poll retry rather
  // than fail the test immediately, so this returns a sentinel instead of
  // throwing.
  return Number.isNaN(applied) ? -1 : applied
}

/**
 * Opens a second, blank workflow tab and returns to the first one, forcing
 * the agent CRDT follower to unbind and rebind against the original workflow
 * (see agentTabSwitchCatchUp.spec.ts for the mechanism this mirrors). The tab
 * control switching back only proves the click landed, not that the new
 * follower subscription and its reconcile have happened, so this captures
 * `subscribeCount()` (proof the follower's request/response round-trip
 * happened) and `appliedFrameCount()` (proof the browser actually applied and
 * reconciled the resulting catch-up frame) before switching, and polls both
 * before asserting anything about the canvas.
 *
 * `skipTitleCheckForNodeIds` forwards to `expectCanvasReplayed` for callers
 * (the title-stomp repro below) that intentionally leave a node's live title
 * diverged from the doc's own stale projected title — see that parameter's
 * doc comment. It must stay independent of that contested value so a real
 * fix flips this test from an expected failure to a genuine pass instead of
 * hard-failing forever on a title this call site never actually cares about.
 */
async function reconcileByReturningToTab(
  page: Page,
  topbar: Topbar,
  agentConversation: AgentConversationHarness,
  throughTurn: number,
  skipTitleCheckForNodeIds?: ReadonlySet<string>
): Promise<void> {
  const beforeSubscribes = agentConversation.subscribeCount()
  const beforeApplied = await appliedFrameCount(page)
  await topbar.openBlankTabAndReturn()
  // >= rather than ===: an extra frame in the window between sampling the
  // baseline and the return click (the blank workflow's own activation, or a
  // catch-up split across multiple doc_update frames) would overshoot an
  // exact +1, and toBe() can never recover from an overshoot — it would hang
  // to the timeout instead of failing fast.
  await expect
    .poll(() => agentConversation.subscribeCount())
    .toBeGreaterThanOrEqual(beforeSubscribes + 1)
  await expect
    .poll(() => appliedFrameCount(page))
    .toBeGreaterThanOrEqual(beforeApplied + 1)
  await agentConversation.expectCanvasReplayed(
    throughTurn,
    skipTitleCheckForNodeIds
  )
}

test.describe(
  'Agent CRDT reconcile overwrites a locally set node color',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: UNTOUCHED_CASE })

    test.beforeEach(async ({ page }) => enableCrdtDebugPanel(page))

    test('keeps a manually applied node color after an unrelated agent reconcile', async ({
      agentConversation,
      page
    }, testInfo) => {
      test.setTimeout(90_000)
      const topbar = new Topbar(page)
      const actionbar = new ComfyActionbar(page)
      const panel = new PropertiesPanelHelper(page)
      const wrapper = agentConversation.vueNodes
        .getNodeLocator(UNTOUCHED_NODE_ID)
        .getByTestId('node-inner-wrapper')
      const lastTurn = agentConversation.conversation.turns.length - 1

      await agentConversation.runTurns()

      const beforeClick = await wrapper.evaluate(
        (el) => getComputedStyle(el).backgroundColor
      )

      const coloredBackground =
        await test.step('user colors the node from the properties panel', async () => {
          await actionbar.propertiesButton.click()
          await agentConversation.vueNodes.selectNode(UNTOUCHED_NODE_ID)
          await panel.switchToTab('Settings')
          await panel.getColorSwatch('red').click()

          // `node-inner-wrapper` always carries a surface background class,
          // so it is never transparent; comparing against the pre-click
          // background is what actually proves a color was applied, and the
          // retrying `toHaveCSS` (unlike a one-shot `evaluate`) waits out the
          // swatch click instead of racing it.
          await expect(wrapper).not.toHaveCSS('background-color', beforeClick)
          return wrapper.evaluate((el) => getComputedStyle(el).backgroundColor)
        })

      await testInfo.attach('node-colored-before-reconcile', {
        body: await wrapper.screenshot({
          path: testInfo.outputPath('node-colored-before-reconcile.png')
        }),
        contentType: 'image/png'
      })

      await test.step('an unrelated agent-driven reconcile runs (returning to the tab)', async () => {
        await reconcileByReturningToTab(
          page,
          topbar,
          agentConversation,
          lastTurn
        )
      })

      await testInfo.attach('node-color-after-reconcile', {
        body: await wrapper.screenshot({
          path: testInfo.outputPath('node-color-after-reconcile.png')
        }),
        contentType: 'image/png'
      })

      await expect(wrapper).toHaveCSS('background-color', coloredBackground)
    })
  }
)

test.describe(
  'A full workflow-tab reload stomps a locally renamed node title',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: UNTOUCHED_CASE })

    test.beforeEach(async ({ page }) => enableCrdtDebugPanel(page))

    test('keeps a manual canvas rename after leaving and reloading the workflow tab', async ({
      agentConversation,
      page
    }, testInfo) => {
      // PM-1717. Known, intentionally unfixed repro: the workflow-tab reload wipes
      // this node's reconcile baseline before the title fix ever runs — see
      // the file-level comment and agentNodeMaterializer.test.ts's matching
      // `it.fails` case for the mechanism. The reconcile step below still
      // runs `expectCanvasReplayed`, but with this node's title check
      // skipped (`skipTitleCheckForNodeIds`) — the doc's own projection never
      // learns about the manual rename, so its title stays stale whether or
      // not the real gap is fixed, and hard-asserting on that stale value
      // there would fail the test for the wrong reason (a contested,
      // unrelated value) even once the real gap closes, permanently masking
      // whether it actually did. The only check this test's outcome should
      // hinge on is the final assertion below.
      test.fail()
      test.setTimeout(90_000)
      const topbar = new Topbar(page)
      const actionbar = new ComfyActionbar(page)
      const panel = new PropertiesPanelHelper(page)
      const CUSTOM_TITLE = 'My Custom Prompt'
      const titleLocator = agentConversation.vueNodes
        .getNodeLocator(UNTOUCHED_NODE_ID)
        .getByTestId('node-title')
      const lastTurn = agentConversation.conversation.turns.length - 1

      await agentConversation.runTurns()

      await test.step('user renames the node from the properties panel', async () => {
        await actionbar.propertiesButton.click()
        await agentConversation.vueNodes.selectNode(UNTOUCHED_NODE_ID)
        await panel.editTitle(CUSTOM_TITLE)
        await expect(titleLocator).toHaveText(CUSTOM_TITLE)
      })

      await testInfo.attach('node-title-before-reconcile', {
        body: await titleLocator.screenshot({
          path: testInfo.outputPath('node-title-before-reconcile.png')
        }),
        contentType: 'image/png'
      })

      await test.step('leaving and returning fully reloads the workflow tab', async () => {
        // The doc's own projection never learns about this manual rename, so
        // its title stays stale regardless of whether the real "survives a
        // tab reload" gap below is fixed — skip only this node's title check
        // here rather than hard-coding the stale title as an expectation.
        await reconcileByReturningToTab(
          page,
          topbar,
          agentConversation,
          lastTurn,
          new Set([UNTOUCHED_NODE_ID])
        )
      })

      await testInfo.attach('node-title-after-reconcile', {
        body: await titleLocator.screenshot({
          path: testInfo.outputPath('node-title-after-reconcile.png')
        }),
        contentType: 'image/png'
      })

      await expect(titleLocator).toHaveText(CUSTOM_TITLE)
    })
  }
)

test.describe(
  'Agent CRDT reconcile overwrites a widget mid-edit',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: ADD_THEN_SET_CASE })

    test.beforeEach(async ({ page }) => enableCrdtDebugPanel(page))

    test('preserves a user’s in-progress edit when an agent turn sets the same widget', async ({
      agentConversation,
      page
    }, testInfo) => {
      test.setTimeout(90_000)
      const textField = agentConversation.vueNodes
        .getNodeLocator(ADDED_NODE_ID)
        .getByLabel('text', { exact: true })

      await test.step('the agent adds the new (empty) node', async () => {
        await agentConversation.sendPrompt(0)
        await agentConversation.replayResponse(0)
        await agentConversation.waitForTurnComplete()
        await expect(textField).toBeVisible()
      })

      await test.step('the agent is asked to set the same widget', async () => {
        // Sent before the user starts typing: the request is already in
        // flight (as it would be for any real turn) by the time the user
        // begins editing the widget below.
        await agentConversation.sendPrompt(1)
      })

      await test.step('the user starts typing into the widget', async () => {
        await textField.click()
        await textField.fill('hello ')
        await expect(textField).toHaveValue('hello ')
      })

      await testInfo.attach('widget-mid-edit-before-reconcile', {
        body: await textField.screenshot({
          path: testInfo.outputPath('widget-mid-edit-before-reconcile.png')
        }),
        contentType: 'image/png'
      })

      const appliedBeforeTurn = await appliedFrameCount(page)

      await test.step('the agent turn lands while the widget is still focused', async () => {
        await agentConversation.replayResponse(1)
      })

      await test.step('the user keeps typing, unaware anything changed', async () => {
        await textField.pressSequentially('world')
        await agentConversation.waitForTurnComplete()
      })

      await testInfo.attach('widget-mid-edit-after-reconcile', {
        body: await textField.screenshot({
          path: testInfo.outputPath('widget-mid-edit-after-reconcile.png')
        }),
        contentType: 'image/png'
      })

      // Pins the mechanism, not just the symptom: the turn's doc frame must
      // actually have been applied and reconciled in the browser (the
      // outcomes counter rises only after applyFrame + reconcileLiveGraph),
      // or a green result could just as easily be documenting an unrelated
      // regression — the replay never arriving — instead of proving the
      // remote write was deliberately skipped while the edit was in
      // progress.
      await expect
        .poll(() => appliedFrameCount(page))
        .toBeGreaterThan(appliedBeforeTurn)

      // The guarded behavior (PM-1191/PM-1697): the remote value must not
      // land under the cursor, and the user's full text survives.
      await expect(textField).not.toHaveValue(/blurry, low quality/)
      await expect(textField).toHaveValue('hello world')
    })
  }
)
