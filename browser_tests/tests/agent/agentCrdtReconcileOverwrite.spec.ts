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
 * `set_widget` while the target widget is focused, which is a plain
 * local-edit-vs-remote-write collision in `applyWidgetValues`/
 * `setWidgetValue` (`graphMutations.ts`) — those write straight into
 * `widgetValueStore` with no focus/in-progress-edit guard.
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

const TRANSPARENT = 'rgba(0, 0, 0, 0)'

/**
 * Opens a second, blank workflow tab and returns to the first one, forcing
 * the agent CRDT follower to unbind and rebind against the original workflow
 * (see agentTabSwitchCatchUp.spec.ts for the mechanism this mirrors). The tab
 * control switching back only proves the click landed, not that the new
 * follower subscription and its reconcile have happened, so — mirroring
 * agentTabSwitchCatchUp.spec.ts's `returnToTabA` — this captures
 * `subscribeCount()` before switching and polls for it to rise by one before
 * asserting anything about the canvas.
 */
async function reconcileByReturningToTab(
  topbar: Topbar,
  agentConversation: AgentConversationHarness,
  throughTurn: number
): Promise<void> {
  const before = agentConversation.subscribeCount()
  await topbar.openBlankTabAndReturn()
  await expect.poll(() => agentConversation.subscribeCount()).toBe(before + 1)
  await agentConversation.expectCanvasReplayed(throughTurn)
}

test.describe(
  'Agent CRDT reconcile overwrites a locally set node color',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: UNTOUCHED_CASE })

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

      const coloredBackground =
        await test.step('user colors the node from the properties panel', async () => {
          await actionbar.propertiesButton.click()
          await agentConversation.vueNodes.selectNode(UNTOUCHED_NODE_ID)
          await panel.switchToTab('Settings')
          await panel.getColorSwatch('red').click()

          const background = await wrapper.evaluate(
            (el) => getComputedStyle(el).backgroundColor
          )
          expect(background).not.toBe(TRANSPARENT)
          return background
        })

      await testInfo.attach('node-colored-before-reconcile', {
        body: await wrapper.screenshot({
          path: testInfo.outputPath('node-colored-before-reconcile.png')
        }),
        contentType: 'image/png'
      })

      await test.step('an unrelated agent-driven reconcile runs (returning to the tab)', async () => {
        await reconcileByReturningToTab(topbar, agentConversation, lastTurn)
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
  'Agent CRDT reconcile stomps a locally renamed node title',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: UNTOUCHED_CASE })

    test('keeps a manual canvas rename after an unrelated agent reconcile', async ({
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

      await test.step('an unrelated agent-driven reconcile runs (returning to the tab)', async () => {
        await reconcileByReturningToTab(topbar, agentConversation, lastTurn)
      })

      await testInfo.attach('node-title-after-reconcile', {
        body: await titleLocator.screenshot({
          path: testInfo.outputPath('node-title-after-reconcile.png')
        }),
        contentType: 'image/png'
      })

      // Known, intentionally unfixed repro: the workflow-tab reload wipes
      // this node's reconcile baseline before the fix above ever runs — see
      // the file-level comment and agentNodeMaterializer.test.ts's matching
      // `it.fails` case for the mechanism.
      test.fail()
      await expect(titleLocator).toHaveText(CUSTOM_TITLE)
    })
  }
)

test.describe(
  'Agent CRDT reconcile overwrites a widget mid-edit',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: ADD_THEN_SET_CASE })

    test('preserves a user’s in-progress edit when an agent turn sets the same widget', async ({
      agentConversation
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

      // Known bug: graphMutations.ts's
      // applyWidgetValues/setWidgetValue write straight into
      // widgetValueStore with no check for a focused/in-progress local
      // edit, so an agent-driven set_widget on the same widget silently
      // overwrites (or corrupts) whatever the user was mid-typing.
      test.fail()
      await expect(textField).toHaveValue('hello world')
    })
  }
)
