import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { MultiAutogrowRealignHarness } from '@e2e/fixtures/helpers/MultiAutogrowRealignHarness'

export {
  CORRUPTED_PROMPT,
  SENTINEL_HEIGHT,
  SENTINEL_PROMPT,
  SENTINEL_WIDTH
} from '@e2e/fixtures/helpers/MultiAutogrowRealignHarness'

/**
 * Boots the multi-autogrow realign app once per test: routed `/ws` host, agent
 * endpoints, saved-workflow persistence and the `/api/prompt` capture. Each
 * scenario's own acts and assertions stay in its `test()` body.
 */
export const multiAutogrowRealignTest = agentTest.extend<{
  realign: MultiAutogrowRealignHarness
}>({
  realign: async ({ page }, use) => {
    const harness = new MultiAutogrowRealignHarness(page)
    await harness.setUp()
    await use(harness)
  }
})
