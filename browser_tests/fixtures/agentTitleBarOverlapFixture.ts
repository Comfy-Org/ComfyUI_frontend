import { mergeTests } from '@playwright/test'

import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { bindTitleBarOverlapTab } from '@e2e/fixtures/utils/agentTitleBarOverlap'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(agentTest, webSocketFixture)

export const titleBarOverlapTest = test.extend<{
  overlapTab: Awaited<ReturnType<typeof bindTitleBarOverlapTab>>
}>({
  overlapTab: async ({ page, getAgentSocket }, use) => {
    await use(await bindTitleBarOverlapTab(page, getAgentSocket))
  }
})
