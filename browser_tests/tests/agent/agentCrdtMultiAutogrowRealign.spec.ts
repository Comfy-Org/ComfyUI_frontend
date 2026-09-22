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
 * on the same interleaved shape and `agentAutogrowTabSwitchReconcile.spec.ts`
 * for the same tab-switch replay mechanism.
 *
 * NOT covered here, or by `agentFollowerReloadBinding.spec.ts` (which only
 * reattaches an ordinary scalar widget edit, not a multi-autogrow node): the
 * outbound leg's own link-position corruption, where the page mints a link
 * by LIVE position into the host document while the host document's own
 * inputs are ordered by NAME, so `[link, originSlot, ..., targetSlot, ...]`
 * can point at the wrong input once a save/reload/reattach round-trips a
 * node with more than one autogrow group. That defect is tracked and
 * reproduced with a real failing unit test at
 * https://github.com/Comfy-Org/ComfyUI_frontend/pull/18332
 * (`linkMintOutboundPositionCorruption.test.ts`).
 */
test.describe(
  'Agent CRDT multi-autogrow link realignment',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    // Each test below boots its own app and submits a real Run; only the
    // second and third also reload the page. CI's default `workers: 2`
    // would otherwise put them in concurrent Chromium instances, and that
    // contention -- not a logic bug -- is what first pushed them past their
    // budget
    // (https://github.com/Comfy-Org/ComfyUI_frontend/actions/runs/35656959584/job/106524115146).
    //
    // `mode: 'serial'` also means Playwright skips the remaining tests in
    // this file after the first failure, which is the wrong contract for
    // three tests that share no state -- see review comment
    // https://github.com/Comfy-Org/ComfyUI_frontend/pull/18275#discussion_r4067888620.
    // Kept as-is this round: this file's `@cloud` project inherits this
    // repo's top-level `fullyParallel: true` (unlike the dedicated
    // `custom-nodes`/`performance`/`audit` projects, which opt out of it
    // for exactly this reason), so removing `serial` here risks reproducing
    // the worker-contention timeout `serial` was added to fix, and this
    // environment has no way to run the real, video-recording CI job to
    // confirm a replacement doesn't regress it. Splitting this file into
    // its own `fullyParallel: false` project with a dedicated `--workers=1`
    // CI job, matching that existing pattern, is the real fix and needs a
    // CI workflow change to verify.
    test.describe.configure({ mode: 'serial' })

    test('keeps every link and scalar under its named slot across a reconcile and a resubscribe', async ({
      realign
    }) => {
      test.setTimeout(90_000)

      await test.step('every link lands on its named slot after materialization', async () => {
        await realign.expectEveryLinkOnItsNamedSlot()
      })

      await test.step('reconciles the same way after a tab-switch resubscribe', async () => {
        await realign.switchTabsAwayAndBack()
        await expect(realign.targetNode).toBeVisible()
        await realign.expectEveryLinkOnItsNamedSlot()
      })

      await test.step('submitted values and the host doc match by name', async () => {
        await realign.fillSentinelWidgetValues()
        await realign.expectSubmittedValuesNamedCorrectly()
        await realign.expectHostDocHasSentinelValues()
      })
    })

    test('serializes and restores every scalar and link under its own name across a save and a reload', async ({
      realign
    }) => {
      test.setTimeout(120_000)

      await test.step('save the graph and read back the posted bytes', async () => {
        await realign.fillSentinelWidgetValues()
        const saved = await realign.saveAndReadPostedGraph()
        expect(saved.widgetValues).toEqual([
          SENTINEL_PROMPT,
          SENTINEL_WIDTH,
          SENTINEL_HEIGHT
        ])
        expect(saved.linkTargets).toEqual(realign.expectedSavedLinkTargets())
      })

      await test.step('reload and reopen the saved workflow', async () => {
        await realign.reloadAndReopenSavedWorkflow()
        await expect(realign.targetNode).toBeVisible({ timeout: 30_000 })
      })

      await test.step('verify restored links, values and submission', async () => {
        await realign.expectEveryLinkOnItsNamedSlot()
        await realign.expectSentinelWidgetValues()
        await realign.expectSubmittedValuesNamedCorrectly()
      })
    })

    test('reads the restored prompt from the saved GET response, not from draft or cache state', async ({
      realign
    }) => {
      test.setTimeout(120_000)

      await test.step('save then corrupt the persisted bytes', async () => {
        await realign.fillSentinelWidgetValues()
        await realign.saveAndReadPostedGraph()
        // A real save always contains the sentinel prompt verbatim;
        // replacing just that value (rather than fulfilling an unrelated
        // body) keeps the graph structure intact, so the reopen below
        // differs from the live canvas in exactly one readable place.
        realign.corruptSavedContentPrompt(CORRUPTED_PROMPT)
      })

      await test.step('reload and reopen the corrupted saved workflow', async () => {
        await realign.reloadAndReopenSavedWorkflow()
        await expect(realign.targetNode).toBeVisible({ timeout: 30_000 })
      })

      await test.step('the corrupted value round-tripped, not a cached one', async () => {
        // The exact corrupted value, not merely "some assertion failed":
        // the restored prompt has to be what the GET served.
        await realign.expectSentinelWidgetValues(CORRUPTED_PROMPT)
        await realign.expectSubmittedValuesNamedCorrectly(CORRUPTED_PROMPT)
      })
    })
  }
)
