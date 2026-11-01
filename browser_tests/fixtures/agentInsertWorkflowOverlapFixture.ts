import { mergeTests } from '@playwright/test'

import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { bindPopulatedTab } from '@e2e/fixtures/utils/agentInsertWorkflowOverlap'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(agentTest, webSocketFixture)

export const insertOverlapTest = test.extend<{
  populatedTab: Awaited<ReturnType<typeof bindPopulatedTab>>
}>({
  populatedTab: async ({ page, getAgentSocket }, use) => {
    await use(await bindPopulatedTab(page, getAgentSocket))
  }
})
