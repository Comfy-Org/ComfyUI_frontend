import { expect } from '@playwright/test'

import {
  CORRUPTED_PROMPT,
  SENTINEL_HEIGHT,
  SENTINEL_PROMPT,
  SENTINEL_WIDTH,
  multiAutogrowRealignTest as test
} from '@e2e/fixtures/multiAutogrowRealignFixture'
import {
  SOURCE_NODE_ID,
  TARGET_ID
} from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'

test.describe(
  'Agent CRDT multi-autogrow link realignment',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('keeps every link and scalar under its named slot across a reconcile and a resubscribe', async ({
      realign
    }) => {
      test.setTimeout(90_000)

      await test.step('every link lands on its named slot after materialization', async () => {
        await realign.expectEveryLinkOnItsNamedSlot()
      })

      await test.step('fill sentinel scalar values before the resubscribe', async () => {
        await realign.fillSentinelWidgetValues()
      })

      await test.step('reconciles the same way after a tab-switch resubscribe', async () => {
        await realign.switchTabsAwayAndBack()
        await expect(realign.targetNode).toBeVisible()
        await realign.expectEveryLinkOnItsNamedSlot()
      })

      await test.step('scalars, submitted values and the host doc survived the resubscribe', async () => {
        await realign.expectSentinelWidgetValues()
        await realign.expectSubmittedValuesNamedCorrectly()
        await realign.expectHostDocHasSentinelValues()
      })
    })

    test('serializes and restores named links from the saved workflow response', async ({
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
        realign.corruptSavedContentPrompt(CORRUPTED_PROMPT)
      })

      await test.step('reload and reopen the corrupted saved workflow', async () => {
        await realign.reloadAndReopenSavedWorkflow()
        await expect(realign.targetNode).toBeVisible({ timeout: 30_000 })
      })

      await test.step('the corrupted value round-tripped, not a cached one', async () => {
        await realign.expectEveryLinkOnItsNamedSlot()
        await realign.expectSentinelWidgetValues(CORRUPTED_PROMPT)
        await realign.expectSubmittedValuesNamedCorrectly(CORRUPTED_PROMPT)
      })
    })

    test('queues every connected node that is visible on the canvas', async ({
      realign
    }) => {
      await expect(
        realign.vueNodes.getNodeLocator(String(SOURCE_NODE_ID))
      ).toBeVisible()
      await expect(realign.targetNode).toBeVisible()

      const submittedPrompt = await realign.submitAndReadPrompt()
      expect(Object.keys(submittedPrompt).sort()).toEqual([
        String(SOURCE_NODE_ID),
        TARGET_ID
      ])
    })
  }
)
