import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { BAD_DO_NOT_DO_THIS_LegacyApiHelper } from '@e2e/fixtures/helpers/BAD_DO_NOT_DO_THIS_LegacyApiHelper'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'

test(
  'A rejected link topology update is reported instead of dropped silently',
  { tag: ['@canvas', '@node'] },
  async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')
    const legacyApi = new BAD_DO_NOT_DO_THIS_LegacyApiHelper(comfyPage.page)

    // `reportError` writes its `errorType` to the console in every
    // environment — Sentry is off in DEV and RUM only comes up behind
    // `initTelemetry()` — so the slug is the product-owned observable that
    // the refusal was surfaced rather than swallowed. Matched as a literal at
    // a word boundary, after the collector is listening.
    using consoleErrors = collectConsoleErrors(comfyPage.page)

    // KSampler `positive` (slot 1) and `negative` (slot 2) are both connected
    // in the default workflow, so moving one onto the other is refused.
    const topology = await legacyApi.moveLinkOntoOccupiedInputSlot(
      'KSampler',
      1,
      2
    )

    await expect
      .poll(() =>
        consoleErrors.errors.filter((line) =>
          /\blink_endpoint_update_rejected(?!\w)/.test(line)
        )
      )
      .toHaveLength(1)

    // The refusal still has to hold: neither link moved.
    expect(topology.movingSlotAfter).toBe(1)
    expect(topology.occupantRetained).toBe(true)
  }
)
