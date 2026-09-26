import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import type { AgentConversationHarness } from '@e2e/fixtures/agentConversationFixture'
import { ComfyActionbar } from '@e2e/fixtures/components/Actionbar'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

/**
 * The color and title specs cover a follower rebind: returning to a workflow
 * tab (inactive -> active) resubscribes the follower, which used to force the
 * next doc frame through a full reconcile that replayed the doc snapshot over
 * the live node. Rebinding now applies only the doc changes collected while
 * the tab was inactive, so live-only state (color, a manual rename) that the
 * doc never carries is left alone.
 *
 * The widget-overwrite spec at the bottom of this file is a *different*
 * mechanism: it never goes through a follower rebind at all. It replays an
 * agent turn's `set_widget` while the target widget is focused — a plain
 * local-edit-vs-remote-write collision on one last-writer-wins register. The
 * follower holds a frame's value for a register with a local write in flight
 * until the document holds that write (`LocalWidgetWrites`), so the user's
 * keystrokes survive.
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
// the DOM, which is the browser-side apply signal below.
async function enableCrdtDebugPanel(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('Comfy.Agent.CrdtDebug.enabled', 'true')
    localStorage.setItem('Comfy.Agent.CrdtDevPanel.open', 'true')
  })
}

/**
 * Reads `status.outcomes.applied` off the CRDT debug panel's "outcomes" row.
 * That counter rises inside `useAgentCrdtFollower.ts` only after
 * `projection.applyFrame` has applied the frame to the live graph, as opposed
 * to `subscribeCount()`, which rises in the mock host the instant it calls
 * `socket.send`, before the browser has even received the frame.
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
 * follower subscription and its catch-up apply have happened, so this captures
 * `subscribeCount()` (proof the follower's request/response round-trip
 * happened) and `appliedFrameCount()` (proof the browser actually applied the
 * resulting catch-up frame) before switching, and polls both
 * before asserting anything about the canvas.
 *
 * `skipTitleCheckForNodeIds` forwards to `expectCanvasReplayed` for callers
 * that leave a node's live title diverged from the doc's projected title.
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
  'A full workflow-tab reload and a locally renamed node title',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: UNTOUCHED_CASE })

    test.beforeEach(async ({ page }) => enableCrdtDebugPanel(page))

    test('keeps a manual canvas rename after leaving and reloading the workflow tab', async ({
      agentConversation,
      page
    }, testInfo) => {
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
        // The doc never learns about the manual rename, so its projected
        // title for this node is stale; the final assertion is the check.
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
      // actually have been applied in the browser (the outcomes counter rises
      // only after `projection.applyFrame`), or a green result could just as
      // easily be documenting an unrelated regression — the replay never
      // arriving — instead of proving the remote value was held back while
      // the edit was in progress.
      await expect
        .poll(() => appliedFrameCount(page))
        .toBeGreaterThan(appliedBeforeTurn)

      await expect(textField).not.toHaveValue(/blurry, low quality/)
      await expect(textField).toHaveValue('hello world')
    })
  }
)

test.describe(
  'Completed widget edits survive unrelated agent turns',
  { tag: ['@cloud', '@agent', '@vue-nodes', '@widget'] },
  () => {
    test.use({ conversationCase: UNTOUCHED_CASE })

    test('keeps a completed widget edit after an unrelated agent turn', async ({
      agentConversation
    }) => {
      test.setTimeout(90_000)
      const textField = agentConversation.vueNodes
        .getNodeLocator(UNTOUCHED_NODE_ID)
        .getByLabel('text', { exact: true })
      const agentEditedField = agentConversation.vueNodes
        .getNodeLocator('3')
        .getByLabel('steps', { exact: true })
      const localValue = 'keep this completed local edit'

      await agentConversation.sendPrompt(0)

      await agentConversation.replayResponse(0, async () => {
        await test.step('the user completes and leaves a widget edit', async () => {
          await textField.fill(localValue)
          await textField.press('Tab')
          await expect(textField).not.toBeFocused()
          await expect(textField).toHaveValue(localValue)
        })
      })
      await agentConversation.waitForTurnComplete()

      await expect(agentEditedField.getByRole('spinbutton')).toHaveValue('30')
      await expect(textField).toHaveValue(localValue)
    })
  }
)
