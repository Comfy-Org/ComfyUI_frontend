import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { ComfyActionbar } from '@e2e/fixtures/components/Actionbar'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

/**
 * Root cause (shared by all three specs below): whenever a follower session
 * is (re)bound (`EcsFollowerAdapter.bind`, ecsFollowerAdapter.ts), the very
 * next doc frame it applies is forced through a full reconcile
 * (`reconcileNextFrame`), which replays the CRDT doc's own snapshot over the
 * live node with no "is this field newer locally" check anywhere in
 * graphMutations.ts. Returning to a workflow tab (inactive -> active) is the
 * confirmed trigger for that rebind — see agentTabSwitchCatchUp.spec.ts,
 * whose "second follower subscribe" is exactly this rebind. These specs
 * reuse that same lever to reproduce three symptoms of the one defect:
 * lost presentation-only node color, a stomped local title rename, and a
 * widget value overwritten mid-edit with no focus guard.
 *
 * The color symptom is fixed, robustly, in `graphMutations.ts`'s
 * `prepareNode`: a reconcile now merges onto the live node's color instead
 * of always resetting it, and the doc never carries color at all, so this
 * holds regardless of what else has or hasn't reset a node's live state.
 *
 * The title symptom's fix (comparing the doc's title against the node's
 * last-synced doc baseline, `resolveNodeTitle`) only holds within a session:
 * it's proven correct for a follower rebind alone (this file's own test
 * below) and for a node re-materializing after a doc-only remote edit
 * (agentNodeMaterializer.test.ts's "keeps the record lastSerialization
 * baseline..."). It does NOT survive a full workflow-tab reload of a node
 * that predates the current reconcile — `LGraph.clear()` (called by
 * `configure()`, which returning to a tab triggers) tears each node down
 * individually before any store-level hook could preserve its baseline, so
 * the very next reconcile replays the doc's title over the reload's rename
 * regardless. That gap is intentionally left as a known repro below (see
 * agentNodeMaterializer.test.ts's own `it.fails` case for the same gap at
 * the unit level) — like the widget-mid-edit symptom, it needs the same
 * kind of dedicated cross-layer plumbing rather than a quick guard clause.
 *
 * Unit-level proof of the color fix and the title fix's in-session cases
 * lives alongside the code:
 * src/workbench/extensions/agent/crdt/graphMutations.test.ts
 * ("keeps a locally renamed title...", "keeps a locally set node color...").
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

/** Opens a second, blank workflow tab and returns to the first one, forcing
 * the agent CRDT follower to unbind and rebind against the original
 * workflow (see agentTabSwitchCatchUp.spec.ts for the mechanism this
 * mirrors). */
async function reconcileByReturningToTab(topbar: Topbar): Promise<void> {
  const tabs = topbar.workflowTabs.locator('.p-togglebutton')
  await expect(tabs).toHaveCount(1)
  await topbar.newWorkflowButton.click()
  await expect(tabs).toHaveCount(2)
  await topbar.getTab(0).click()
  await expect(topbar.getTab(0)).toHaveClass(/p-togglebutton-checked/)
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
        await reconcileByReturningToTab(topbar)
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
        await reconcileByReturningToTab(topbar)
      })

      await testInfo.attach('node-title-after-reconcile', {
        body: await titleLocator.screenshot({
          path: testInfo.outputPath('node-title-after-reconcile.png')
        }),
        contentType: 'image/png'
      })

      // Known bug, root cause confirmed but left as a repro (see
      // graphMutations.ts's resolveNodeTitle and agentNodeMaterializer.ts's
      // materialize() for the two related, already-fixed cases): returning
      // to a workflow tab reloads it, and `LGraph.clear()` (called by
      // `configure()`) tears each node down individually via
      // `teardownOwnedGraphs` *before* it resets the store bucket, so this
      // node's reconcile baseline is gone by the time any store-level hook
      // could try to preserve it. The rename itself survives the reload
      // (the tab's own saved JSON already carried it), but the very next
      // reconcile has no baseline to compare the doc's title against and
      // replays it over the reload's rename regardless. A real fix needs
      // the same kind of dedicated cross-layer plumbing as the
      // widget-overwrite case below - threading a "preserve this node's
      // reconcile baseline" signal through `LGraph.clear()`'s per-node
      // teardown - not a quick guard clause.
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
