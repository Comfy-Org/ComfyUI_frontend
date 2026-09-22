import { expect } from '@playwright/test'

import {
  CORRUPTED_PROMPT,
  SENTINEL_HEIGHT,
  SENTINEL_PROMPT,
  SENTINEL_WIDTH,
  multiAutogrowRealignTest as test
} from '@e2e/fixtures/multiAutogrowRealignFixture'

/**
 * A node with two independent COMFY_AUTOGROW_V3 groups (reduced from
 * MiniMaxH3ReferenceToVideo's `ref_images`/`ref_videos` shape) had its links
 * silently re-target to the wrong input once both groups had already grown
 * on a saved graph.
 *
 * Root cause: the CRDT follower materialized an agent-authored node by
 * building link adapters against the saved DOCUMENT's input positions.
 * `node.configure()` and COMFY_AUTOGROW_V3 growth reorder LIVE inputs as the
 * node is built, so with two or more autogrow groups sharing a node the
 * adapters kept pointing at stale indexes: a link painted on the wrong
 * socket, and the value read at submit time was wrong for the same reason.
 *
 * Fixed in `graphMutations.ts`'s `mergeInputSlotsByName`/`prepareNode`: a
 * reconcile now resolves each saved link's destination by the input's NAME
 * against the live node, not by the document's position.
 *
 * See `agentNodeMaterializer.multiAutogrow.test.ts` for the Vitest regression
 * on the same interleaved shape, `agentAutogrowTabSwitchReconcile.spec.ts` for
 * the same tab-switch replay mechanism, and `agentFollowerReloadBinding.spec.ts`
 * for the saved-workflow reattachment contract, which owns the second-turn
 * reattach path these scenarios deliberately stop short of.
 */
test.describe(
  'Agent CRDT multi-autogrow link realignment',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    // Each test below boots its own app, reloads the page and submits a real
    // Run. CI's default `workers: 2` would otherwise put them in concurrent
    // Chromium instances, and that contention -- not a logic bug -- is what
    // first pushed them past their budget
    // (https://github.com/Comfy-Org/ComfyUI_frontend/actions/runs/35656959584/job/106524115146).
    test.describe.configure({ mode: 'serial' })

    test('keeps every link and scalar under its named slot across a reconcile and a resubscribe', async ({
      realign
    }) => {
      test.setTimeout(90_000)
      await realign.targetActiveWorkflow()
      await realign.sendTurn('hello')
      await realign.hostSocket.waitForSubscribe()

      await expect(realign.targetNode).toBeVisible()
      await realign.expectEveryLinkOnItsNamedSlot()

      await realign.switchTabsAwayAndBack()
      await expect(realign.targetNode).toBeVisible()
      await realign.expectEveryLinkOnItsNamedSlot()

      await realign.fillSentinelWidgetValues()
      await realign.expectSubmittedValuesNamedCorrectly()
      await realign.expectHostDocHasSentinelValues()
    })

    test('serializes and restores every scalar and link under its own name across a save and a reload', async ({
      realign
    }, testInfo) => {
      test.setTimeout(120_000)
      await realign.targetActiveWorkflow()
      await realign.sendTurn('hello')
      await realign.hostSocket.waitForSubscribe()
      await expect(realign.targetNode).toBeVisible()
      await realign.fillSentinelWidgetValues()

      const saved = await realign.saveAndReadPostedGraph()
      expect(saved.widgetValues).toEqual([
        SENTINEL_PROMPT,
        SENTINEL_WIDTH,
        SENTINEL_HEIGHT
      ])
      expect(saved.linkTargets).toEqual(realign.expectedSavedLinkTargets())

      await realign.reloadAndReopenSavedWorkflow()

      await expect(realign.targetNode).toBeVisible({ timeout: 30_000 })
      await realign.expectEveryLinkOnItsNamedSlot()
      await realign.expectSentinelWidgetValues()
      await realign.expectSubmittedValuesNamedCorrectly()
      await realign.attachScreenshot(testInfo, 'saved-file-restored')
    })

    test('reads the restored prompt from the saved GET response, not from draft or cache state', async ({
      realign
    }) => {
      test.setTimeout(120_000)
      await realign.targetActiveWorkflow()
      await realign.sendTurn('hello')
      await realign.hostSocket.waitForSubscribe()
      await expect(realign.targetNode).toBeVisible()
      await realign.fillSentinelWidgetValues()
      await realign.saveAndReadPostedGraph()

      // A real save always contains the sentinel prompt verbatim; replacing
      // just that value (rather than fulfilling an unrelated body) keeps the
      // graph structure intact, so the reopen below differs from the live
      // canvas in exactly one readable place.
      realign.corruptSavedContentPrompt(CORRUPTED_PROMPT)

      await realign.reloadAndReopenSavedWorkflow()

      await expect(realign.targetNode).toBeVisible({ timeout: 30_000 })
      // The exact corrupted value, not merely "some assertion failed": the
      // restored prompt has to be what the GET served.
      await realign.expectSentinelWidgetValues(CORRUPTED_PROMPT)
      await realign.expectSubmittedValuesNamedCorrectly(CORRUPTED_PROMPT)
    })
  }
)
